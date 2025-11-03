const redisClient = require('../config/redis');


const cacheEvents = async (req, res, next) => {
    // Cache is per user + query params
    try {
        if (!req.user) return next();
        const keyParts = ['events', req.user.id, JSON.stringify(req.query || {})];
        const key = keyParts.join(':');
        const cached = await redisClient.get(key);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        // attach cache key to request for controller to set
        req._cacheKey = key;
        next();
    } catch (err) {
        console.error('Cache middleware error', err);
        next();
    }
};


module.exports = { cacheEvents };