const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { oauthStart, oauthCallback, disconnect } = require('../controllers/googleController');


router.get('/start', auth, oauthStart);
router.get('/oauth2callback', oauthCallback);
router.post('/disconnect', auth, disconnect);


module.exports = router;