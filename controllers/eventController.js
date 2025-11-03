const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const { notify } = require('../utils/notify');
const redisClient = require('../config/redis');

async function hasOverlap(email, startTime, endTime) {
    const query = {
        canceled: false,
        $and: [
            { startTime: { $lt: new Date(endTime) } },
            { endTime: { $gt: new Date(startTime) } }
        ],
        $or: [
            { 'participants.email': email }
        ]
    };

    const events = await Event.find(query).populate('creator');
    const creatorMatches = events.filter(e => e.creator && e.creator.email === email);
    const participantMatches = events.filter(e => e.participants.some(p => p.email === email));
    return (creatorMatches.length + participantMatches.length) > 0;
}

const createEvent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { title, description, startTime, endTime, location, participants = [], isRecurring = false, recurringDates = [] } = req.body;
        if (!title || !startTime || !endTime) return res.status(400).json({ message: 'Missing fields' });
        if (new Date(endTime) <= new Date(startTime)) return res.status(400).json({ message: 'endTime must be after startTime' });

        const creator = await User.findById(req.user._id);
        if (!creator) return res.status(400).json({ message: 'Creator not found' });

        const creatorOverlap = await hasOverlap(creator.email, startTime, endTime);
        if (creatorOverlap) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Creator has overlapping event' });
        }

        for (const pEmail of participants) {
            const pOverlap = await hasOverlap(pEmail, startTime, endTime);
            if (pOverlap) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `Participant ${pEmail} has overlapping event` });
            }
        }

        const event = new Event({
            title,
            description,
            startTime,
            endTime,
            location,
            participants: participants.map(e => ({ email: e })),
            creator: creator._id,
            isRecurring,
            recurringDates: isRecurring ? recurringDates : []
        });

        await event.save({ session });

        for (const p of event.participants) {
            await notify({ toEmail: p.email, subject: `Invited: ${event.title} `, body: `You are invited to ${event.title} from ${event.startTime} to ${event.endTime} ` });
        }

        const ttlKeyParts = ['events', creator._id.toString(), JSON.stringify({})];
        const key = ttlKeyParts.join(':');
        await redisClient.del(key).catch(() => { });

        await session.commitTransaction();
        session.endSession();
        res.status(201).json(event);


    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const getEvents = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { from, to, participant } = req.query;


        const q = { canceled: false, $or: [{ 'participants.email': userEmail }, { creator: req.user._id }] };
        if (participant) q['participants.email'] = participant;
        if (from || to) q.startTime = {};
        if (from) q.startTime.$gte = new Date(from);
        if (to) q.startTime.$lte = new Date(to);

        const events = await Event.find(q).populate('creator').sort({ startTime: 1 });

        if (req._cacheKey) {
            const ttl = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);
            await redisClient.setEx(req._cacheKey, ttl, JSON.stringify(events));
        }

        res.json(events);


    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id).populate('creator');
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateEvent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const data = req.body;
        const event = await Event.findById(id);
        if (!event) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not allowed' });
        }

        if (data.startTime || data.endTime) {
            const newStart = data.startTime ? new Date(data.startTime) : event.startTime;
            const newEnd = data.endTime ? new Date(data.endTime) : event.endTime;
            if (newEnd <= newStart) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'endTime must be after startTime' });
            }

            const overlapping = await Event.findOne({
                _id: { $ne: event._id },
                canceled: false,
                $and: [{ startTime: { $lt: newEnd } }, { endTime: { $gt: newStart } }],
                $or: [{ 'participants.email': req.user.email }, { creator: req.user._id }]
            });
            if (overlapping) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'Updated times cause overlap' });
            }
        }

        Object.assign(event, data);
        await event.save({ session });

        const key = ['events', event.creator.toString(), JSON.stringify({})].join(':');
        await redisClient.del(key).catch(() => { });

        await session.commitTransaction();
        session.endSession();
        res.json(event);


    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        if (event.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') return res.status(403).json({ message: 'Not allowed' });

        event.canceled = true;
        await event.save();

        const key = ['events', event.creator.toString(), JSON.stringify({})].join(':');
        await redisClient.del(key).catch(() => { });

        res.json({ message: 'Event canceled' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createEvent, getEvents, getEventById, updateEvent, deleteEvent };
