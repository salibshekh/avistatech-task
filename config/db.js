const mongoose = require('mongoose');


module.exports = async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set');
    return mongoose.connect(uri).then(() => console.log('MongoDB connected'));
};