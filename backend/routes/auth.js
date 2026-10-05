const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const AgentProfile = require('../models/AgentProfile');
const auth = require('../middleware/auth');
const { normalizeRole } = require('../middleware/roles');
const {
  buildAvatarKey,
  uploadListingImage,
  deleteObjectByUrl,
  signStoredImageUrl,
} = require('../services/s3');

const router = express.Router();
const googleClient = new OAuth2Client();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

function resolveRoleForEmail(email, requestedRole) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (adminEmail && email.toLowerCase() === adminEmail) return 'admin';
  if (requestedRole === 'customer') return 'customer';
  // publisher (default); accept legacy owner/agent from old clients
  if (
    requestedRole === 'publisher' ||
    requestedRole === 'owner' ||
    requestedRole === 'agent' ||
    !requestedRole
  ) {
    return 'publisher';
  }
  return 'publisher';
}

function signToken(user) {
  const role = normalizeRole(user);
  return jwt.sign(
    { id: user._id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function publicUser(user) {
  const role = normalizeRole(user);
  const profilePic = user.profilePic
    ? await signStoredImageUrl(user.profilePic)
    : '';
  const base = {
    id: user._id,
    name: user.name,
    email: user.email,
    role,
    authProvider: user.authProvider,
    onboardingComplete: true,
    profilePic,
    ratingAvg: 0,
    ratingCount: 0,
  };

  if (role === 'publisher') {
    const profile = await AgentProfile.findOne({ user: user._id }).select(
      'onboardingComplete ratingAvg ratingCount'
    );
    base.onboardingComplete = !!profile?.onboardingComplete;
    base.ratingAvg = profile?.ratingAvg || 0;
    base.ratingCount = profile?.ratingCount || 0;
  }

  return base;
}

function googleAudiences() {
  const raw = process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role: requestedRole } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const role = resolveRoleForEmail(email, requestedRole);
    const user = await User.create({
      name,
      email,
      password,
      role,
      authProvider: 'local',
    });

    if (role === 'publisher') {
      await AgentProfile.create({ user: user._id });
    }

    const token = signToken(user);
    res.status(201).json({
      token,
      user: await publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({
        message: 'This account uses Google sign-in. Please continue with Google.',
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Promote configured admin email / migrate legacy roles
    let dirty = false;
    const desired = resolveRoleForEmail(user.email, user.role);
    if (desired === 'admin' && user.role !== 'admin') {
      user.role = 'admin';
      dirty = true;
    } else if (['agent', 'owner', 'sales'].includes(user.role)) {
      user.role = 'publisher';
      dirty = true;
    }
    if (dirty) await user.save();

    if (normalizeRole(user) === 'publisher') {
      const existing = await AgentProfile.findOne({ user: user._id });
      if (!existing) await AgentProfile.create({ user: user._id });
    }

    const token = signToken(user);
    res.json({
      token,
      user: await publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken, role: requestedRole } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Google idToken is required' });
    }

    const audiences = googleAudiences();
    if (!audiences.length) {
      return res.status(500).json({ message: 'Google sign-in is not configured on the server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      return res.status(401).json({ message: 'Invalid Google token payload' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ message: 'Google email is not verified' });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email }],
    });

    if (user) {
      let dirty = false;
      if (!user.googleId) {
        user.googleId = payload.sub;
        dirty = true;
      }
      if (user.authProvider !== 'google' && !user.password) {
        user.authProvider = 'google';
        dirty = true;
      }
      if (payload.name && user.name !== payload.name) {
        user.name = payload.name;
        dirty = true;
      }
      const desired = resolveRoleForEmail(email, user.role);
      if (desired === 'admin' && user.role !== 'admin') {
        user.role = 'admin';
        dirty = true;
      } else if (['agent', 'owner', 'sales'].includes(user.role)) {
        user.role = 'publisher';
        dirty = true;
      }
      if (dirty) await user.save();
    } else {
      const role = resolveRoleForEmail(email, requestedRole);
      user = await User.create({
        name: payload.name || email.split('@')[0],
        email,
        googleId: payload.sub,
        authProvider: 'google',
        role,
      });
      if (role === 'publisher') {
        await AgentProfile.create({ user: user._id });
      }
    }

    if (normalizeRole(user) === 'publisher') {
      const existing = await AgentProfile.findOne({ user: user._id });
      if (!existing) await AgentProfile.create({ user: user._id });
    }

    const token = signToken(user);
    res.json({
      token,
      user: await publicUser(user),
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ message: 'Google authentication failed' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: await publicUser(req.user) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load user' });
  }
});

router.post(
  '/avatar',
  auth,
  avatarUpload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'avatar image file is required' });
      }

      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const previous = user.profilePic;
      const key = buildAvatarKey({
        userId: user._id,
        originalName: req.file.originalname,
      });
      const url = await uploadListingImage({
        buffer: req.file.buffer,
        contentType: req.file.mimetype || 'image/jpeg',
        key,
      });
      user.profilePic = url;
      await user.save();

      if (previous && previous !== url) {
        try {
          await deleteObjectByUrl(previous);
        } catch {
          // ignore stale delete failures
        }
      }

      res.json({ user: await publicUser(user) });
    } catch (err) {
      console.error('Avatar upload failed:', err.message);
      res.status(500).json({ message: err.message || 'Avatar upload failed' });
    }
  }
);

router.delete('/avatar', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.profilePic) {
      try {
        await deleteObjectByUrl(user.profilePic);
      } catch {
        // ignore
      }
      user.profilePic = '';
      await user.save();
    }
    res.json({ user: await publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to remove avatar' });
  }
});

module.exports = router;
