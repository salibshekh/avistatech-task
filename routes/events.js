const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { cacheEvents } = require('../middleware/cache');
const {
    createEvent,
    getEvents,
    getEventById,
    updateEvent,
    deleteEvent
} = require('../controllers/eventController');

router.use(auth);

router.post('/', createEvent);
router.get('/', cacheEvents, getEvents);
router.get('/:id', getEventById);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;
