const { google } = require('googleapis');


function createOAuthClient(tokens) {
    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    if (tokens) oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}


async function generateAuthUrl() {
    const oAuth2Client = createOAuthClient();
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ];
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes
    });
}


async function getTokensFromCode(code) {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    return tokens;
}


async function insertEvent(tokens, calendarId, eventData) {
    const oAuth2Client = createOAuthClient(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const res = await calendar.events.insert({
        calendarId,
        requestBody: eventData
    });
    return res.data; // contains id, htmlLink, etc
}


async function updateEvent(tokens, calendarId, eventId, eventData) {
    const oAuth2Client = createOAuthClient(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const res = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: eventData
    });
    return res.data;
}


async function deleteEvent(tokens, calendarId, eventId) {
    const oAuth2Client = createOAuthClient(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    await calendar.events.delete({ calendarId, eventId });
    return true;
}


module.exports = { generateAuthUrl, getTokensFromCode, insertEvent, updateEvent, deleteEvent };