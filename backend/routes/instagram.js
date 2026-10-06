const express = require('express');
const jwt = require('jsonwebtoken');
const AgentProfile = require('../models/AgentProfile');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { encryptToken } = require('../services/tokenCrypto');
const {
  exchangeCodeForToken,
  resolveInstagramBusinessAccount,
} = require('../services/instagramPublish');

const router = express.Router();

function publicBaseUrl(req) {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');
}

function oauthRedirectUri(req) {
  return (
    process.env.META_REDIRECT_URI ||
    `${publicBaseUrl(req)}/api/instagram/callback`
  );
}

router.get('/status', auth, requireRole('agent'), async (req, res) => {
  try {
    const profile = await AgentProfile.findOne({ user: req.user._id }).select(
      '+metaAccessTokenEnc'
    );
    res.json({
      connected: !!(profile?.instagramUserId && profile?.metaAccessTokenEnc),
      instagramUsername: profile?.instagramUsername || '',
      instagramUserId: profile?.instagramUserId || '',
      connectedAt: profile?.instagramConnectedAt || null,
      configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load Instagram status' });
  }
});

router.get('/oauth-url', auth, requireRole('agent'), async (req, res) => {
  try {
    const appId = process.env.META_APP_ID;
    if (!appId) {
      return res.status(500).json({
        message: 'META_APP_ID is not configured on the server',
      });
    }

    const state = jwt.sign(
      { uid: String(req.user._id), purpose: 'ig_oauth' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const redirectUri = oauthRedirectUri(req);
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ].join(',');

    const url =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code`;

    res.json({ url, redirectUri });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to build OAuth URL' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      return res
        .status(400)
        .send(`Instagram connect failed: ${errorDescription || error}`);
    }
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    if (decoded.purpose !== 'ig_oauth') {
      return res.status(400).send('Invalid OAuth state');
    }

    const redirectUri = oauthRedirectUri(req);
    const userToken = await exchangeCodeForToken(code, redirectUri);
    const ig = await resolveInstagramBusinessAccount(userToken);

    let profile = await AgentProfile.findOne({ user: decoded.uid }).select(
      '+metaAccessTokenEnc'
    );
    if (!profile) {
      profile = await AgentProfile.create({ user: decoded.uid });
    }

    profile.instagramUserId = ig.instagramUserId;
    profile.instagramUsername = ig.instagramUsername;
    profile.facebookPageId = ig.facebookPageId;
    profile.metaAccessTokenEnc = encryptToken(ig.pageAccessToken);
    profile.instagramConnectedAt = new Date();
    await profile.save();

    res.send(
      `<html><body style="font-family:sans-serif;padding:24px">
        <h2>Instagram connected</h2>
        <p>Connected as <b>@${ig.instagramUsername || ig.instagramUserId}</b>.</p>
        <p>You can close this window and return to Your Bhoomi.</p>
      </body></html>`
    );
  } catch (err) {
    console.error('Instagram OAuth callback error:', err.message);
    res.status(500).send(`Instagram connect failed: ${err.message}`);
  }
});

router.post('/disconnect', auth, requireRole('agent'), async (req, res) => {
  try {
    const profile = await AgentProfile.findOne({ user: req.user._id }).select(
      '+metaAccessTokenEnc'
    );
    if (!profile) return res.json({ message: 'Disconnected' });
    profile.instagramUserId = '';
    profile.instagramUsername = '';
    profile.facebookPageId = '';
    profile.metaAccessTokenEnc = '';
    profile.instagramConnectedAt = null;
    await profile.save();
    res.json({ message: 'Instagram disconnected' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to disconnect' });
  }
});

module.exports = router;
