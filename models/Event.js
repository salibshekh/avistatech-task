const mongoose = require('mongoose');


const ParticipantSchema = new mongoose.Schema({
    email: { type: String, required: true },
    status: { type: String, enum: ['invited', 'accepted', 'declined'], default: 'invited' },
    googleEventId: { type: String } // optional per participant mapping
});


const EventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    location: String,
    participants: [ParticipantSchema],
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isRecurring: { type: Boolean, default: false },
    recurringDates: [Date],
    canceled: { type: Boolean, default: false },
    googleEventId: { type: String },
    organizerEmail: { type: String }
}, { timestamps: true });


module.exports = mongoose.model('Event', EventSchema);