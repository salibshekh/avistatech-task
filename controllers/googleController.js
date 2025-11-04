const User = require('../models/User');
const { generateAuthUrl, getTokensFromCode } = require('../utils/googleCalendar');

async function oauthStart(req, res) {
    try {
        const url = await generateAuthUrl();
        res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to generate auth url' });
    }
}

async function oauthCallback(req, res) {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send('Missing code');
        const tokens = await getTokensFromCode(code);

        const state = req.query.state;
        res.json({ tokens });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'OAuth callback failed' });
    }
}

async function disconnect(req, res) {
    try {
        const user = req.user;
        user.google = undefined;
        await user.save();
        res.json({ message: 'Disconnected Google account' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to disconnect' });
    }
}


module.exports = { oauthStart, oauthCallback, disconnect };