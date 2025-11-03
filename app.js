require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const redisClient = require('./config/redis');


const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');


const app = express();
const PORT = process.env.PORT || 4000;


app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(cors());


app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);


app.get('/', (req, res) => res.send('Event Management API is running'));


async function start() {
    try {
        await connectDB();
        await redisClient.connect();

        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
        console.error('Failed to start server', err);
        process.exit(1);
    }
}


start();