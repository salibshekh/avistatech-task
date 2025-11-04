const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const { notify } = require('../utils/notify');
const redisClient = require('../config/redis');
const { insertEvent, updateEvent, deleteEvent } = require('../utils/googleCalendar');

// Helper: check overlap for a given email (creator or participant)
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

// CREATE EVENT
const createEvent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { title, description, startTime, endTime, location, participants = [], isRecurring = false, recurringDates = [] } = req.body;
        if (!title || !startTime || !endTime) return res.status(400).json({ message: 'Missing fields' });
        if (new Date(endTime) <= new Date(startTime)) return res.status(400).json({ message: 'endTime must be after startTime' });

        const creator = await User.findById(req.user._id);
        if (!creator) return res.status(400).json({ message: 'Creator not found' });

        // Prevent overlaps
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
            recurringDates: isRecurring ? recurringDates : [],
            organizerEmail: creator.email
        });

        // Sync to Google Calendar if user connected
        if (creator.google && creator.google.tokens) {
            try {
                const gEvent = {
                    summary: title,
                    description: description || '',
                    start: { dateTime: new Date(startTime).toISOString() },
                    end: { dateTime: new Date(endTime).toISOString() },
                    location: location || undefined,
                    attendees: participants.map(p => ({ email: p }))
                };
                const calendarId = process.env.GOOGLE_DEFAULT_CALENDAR || 'primary';
                const inserted = await insertEvent(creator.google.tokens, calendarId, gEvent);
                event.googleEventId = inserted.id;
            } catch (gErr) {
                console.error('Google create failed', gErr);
            }
        }

        await event.save({ session });

        for (const p of event.participants) {
            await notify({
                toEmail: p.email,
                subject: `Invited: ${event.title}`,
                body: `You are invited to ${event.title} from ${event.startTime} to ${event.endTime}`
            });
        }

        // Invalidate Redis cache
        const key = ['events', creator._id.toString(), JSON.stringify({})].join(':');
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

// GET EVENTS (cached)
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

// GET EVENT BY ID
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

// UPDATE EVENT
const updateEvent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const data = req.body;
        const event = await Event.findById(id).populate('creator');
        if (!event) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.creator._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not allowed' });
        }

        // Merge new data
        Object.assign(event, data);

        // Sync to Google Calendar if connected
        if (event.googleEventId && event.creator.google && event.creator.google.tokens) {
            try {
                const calendarId = process.env.GOOGLE_DEFAULT_CALENDAR || 'primary';
                const gEvent = {
                    summary: event.title,
                    description: event.description || '',
                    start: { dateTime: new Date(event.startTime).toISOString() },
                    end: { dateTime: new Date(event.endTime).toISOString() },
                    location: event.location || undefined,
                    attendees: event.participants.map(p => ({ email: p.email }))
                };
                await updateEvent(event.creator.google.tokens, calendarId, event.googleEventId, gEvent);
            } catch (gErr) {
                console.error('Google update failed', gErr);
            }
        }

        await event.save({ session });

        const key = ['events', event.creator._id.toString(), JSON.stringify({})].join(':');
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

// DELETE EVENT
const deleteEventController = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id).populate('creator');
        if (!event) return res.status(404).json({ message: 'Event not found' });

        if (event.creator._id.toString() !== req.user._id.toString() && req.user.role !== 'admin')
            return res.status(403).json({ message: 'Not allowed' });

        event.canceled = true;
        await event.save();

        // Delete from Google Calendar if synced
        if (event.googleEventId && event.creator.google && event.creator.google.tokens) {
            try {
                const calendarId = process.env.GOOGLE_DEFAULT_CALENDAR || 'primary';
                await deleteEvent(event.creator.google.tokens, calendarId, event.googleEventId);
            } catch (gErr) {
                console.error('Google delete failed', gErr);
            }
        }

        const key = ['events', event.creator._id.toString(), JSON.stringify({})].join(':');
        await redisClient.del(key).catch(() => { });

        res.json({ message: 'Event canceled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createEvent,
    getEvents,
    getEventById,
    updateEvent,
    deleteEvent: deleteEventController
};
