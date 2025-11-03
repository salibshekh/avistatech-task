const jwt = require('jsonwebtoken');
const User = require('../models/User');


const auth = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'Authorization header missing' });


    const token = header.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token missing' });


    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id).select('-password');
        if (!user) return res.status(401).json({ message: 'User not found' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};


const requireRole = (role) => (req, res, next) => {
    if (!req.user) return res.status(401).end();
    if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden' });
    next();
};


module.exports = { auth, requireRole };