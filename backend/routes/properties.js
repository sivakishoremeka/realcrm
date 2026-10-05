const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const Property = require('../models/Property');
const auth = require('../middleware/auth');
const { requireRole, normalizeRole } = require('../middleware/roles');
const AgentProfile = require('../models/AgentProfile');
const { generatePropertyCaption } = require('../services/captionLlm');
const { publishReel } = require('../services/instagramPublish');
const { getAgentIgCredentials } = require('../services/instagramCredentials');
const { decryptToken } = require('../services/tokenCrypto');
const { searchPosts } = require('../services/facetSearch');
const {
  buildInventoryImageKey,
  uploadListingImage,
  deleteObjectByUrl,
  deleteObjectsByUrls,
  withSignedImages,
  withSignedImagesMany,
  imageUrlsEqual,
  canonicalImageUrl,
} = require('../services/s3');

const router = express.Router();

const STATUS_SORT = {
  Available: 0,
  Hold: 1,
  Deal: 2,
  Blocked: 3,
  Sold: 4,
  Draft: 5,
};

const PROPERTY_DETAIL_FIELDS = [
  'title',
  'type',
  'listingType',
  'residenceStyle',
  'facing',
  'carpetArea',
  'bhk',
  'villaType',
  'plotSize',
  'price',
  'areaSqft',
  'zone',
  'address',
  'status',
  'notes',
  'videoUrl',
];

const uploadDir = path.join(__dirname, '..', 'uploads', 'videos');
fs.mkdirSync(uploadDir, { recursive: true });

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'));
    }
    cb(null, true);
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

function applyPropertyFields(property, body) {
  PROPERTY_DETAIL_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    if (['bhk', 'price', 'areaSqft', 'carpetArea'].includes(field)) {
      property[field] =
        body[field] === '' || body[field] == null
          ? field === 'price'
            ? property.price
            : null
          : Number(body[field]);
    } else {
      property[field] = body[field];
    }
  });
}

function publicBaseUrl(req) {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');
}

function canAccessProperty(user, property) {
  if (normalizeRole(user) === 'admin') return true;
  if (!property.agent) return false;
  return String(property.agent._id || property.agent) === String(user._id);
}

router.use(auth);

router.get('/', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const filter =
      normalizeRole(req.user) === 'admin'
        ? req.query.agentId
          ? { agent: req.query.agentId }
          : { agent: { $ne: null } }
        : { agent: req.user._id };

    const properties = await Property.find(filter)
      .populate('zone', 'name city slug lat lng')
      .populate('agent', 'name email')
      .sort({ createdAt: -1 });

    properties.sort((a, b) => {
      const sa = STATUS_SORT[a.status] ?? 99;
      const sb = STATUS_SORT[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(await withSignedImagesMany(properties));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch properties' });
  }
});

// My posts: everything the publisher posted (as agent or as owner), with
// search, filters and facet counts. See services/facetSearch.js for the params.
router.get('/mine', requireRole('agent', 'owner'), async (req, res) => {
  try {
    const userId = String(req.user._id);
    const posts = await Property.find({
      $or: [{ agent: req.user._id }, { owner: req.user._id }],
    })
      .populate('zone', 'name city slug lat lng')
      .sort({ createdAt: -1 })
      .lean();

    const tagged = posts.map((p) => ({
      ...p,
      postAs: String(p.agent) === userId ? 'agent' : 'owner',
    }));
    const result = searchPosts(tagged, req.query);
    result.items = await withSignedImagesMany(result.items || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch posts' });
  }
});

router.get('/:id', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('zone', 'name city slug lat lng')
      .populate('agent', 'name email');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!canAccessProperty(req.user, property)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(await withSignedImages(property));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch property' });
  }
});

router.post('/', requireRole('agent'), async (req, res) => {
  try {
    const { title, type, listingType, price, zone } = req.body;
    if (!title || !type || !listingType || price == null || !zone) {
      return res.status(400).json({
        message: 'title, type, listingType, price, and zone are required',
      });
    }
    if (!['Sale', 'Rent', 'Lease'].includes(listingType)) {
      return res.status(400).json({ message: 'listingType must be Sale, Rent, or Lease' });
    }
    if (!['Apartment', 'Villa', 'Plot', 'Commercial'].includes(type)) {
      return res.status(400).json({
        message: 'type must be Apartment, Villa, Plot, or Commercial',
      });
    }

    const property = new Property({
      agent: req.user._id,
      owner: null,
      title,
      type,
      listingType,
      price: Number(price),
      zone,
      status: req.body.status || 'Available',
    });
    applyPropertyFields(property, req.body);
    await property.save();

    const populated = await Property.findById(property._id)
      .populate('zone', 'name city slug lat lng')
      .populate('agent', 'name email');
    res.status(201).json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create property' });
  }
});

router.put('/:id', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!canAccessProperty(req.user, property)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    applyPropertyFields(property, req.body);
    await property.save();
    const populated = await Property.findById(property._id)
      .populate('zone', 'name city slug lat lng')
      .populate('agent', 'name email');
    res.json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update property' });
  }
});

router.patch('/:id/status', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Available', 'Hold', 'Deal', 'Blocked', 'Sold', 'Draft'].includes(status)) {
      return res.status(400).json({
        message: 'status must be Available, Hold, Deal, Blocked, Sold, or Draft',
      });
    }
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!canAccessProperty(req.user, property)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    property.status = status;
    await property.save();
    const populated = await Property.findById(property._id)
      .populate('zone', 'name city slug lat lng')
      .populate('agent', 'name email');
    res.json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update status' });
  }
});

router.post(
  '/:id/images',
  requireRole('agent', 'admin'),
  imageUpload.array('images', 12),
  async (req, res) => {
    try {
      const property = await Property.findById(req.params.id);
      if (!property) return res.status(404).json({ message: 'Property not found' });
      if (!canAccessProperty(req.user, property)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      if (!req.files?.length) {
        return res.status(400).json({ message: 'At least one image file is required' });
      }

      const agentId = property.agent || req.user._id;
      const urls = [];
      for (const file of req.files) {
        const key = buildInventoryImageKey({
          agentId,
          propertyId: property._id,
          originalName: file.originalname,
        });
        const url = await uploadListingImage({
          buffer: file.buffer,
          contentType: file.mimetype || 'image/jpeg',
          key,
        });
        urls.push(url);
      }
      property.images = [...(property.images || []), ...urls];
      await property.save();

      const populated = await Property.findById(property._id)
        .populate('zone', 'name city slug lat lng')
        .populate('agent', 'name email');
      res.json(await withSignedImages(populated));
    } catch (err) {
      console.error('Property image upload failed:', err.message);
      res.status(500).json({ message: err.message || 'Image upload failed' });
    }
  }
);

router.delete('/:id/images', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'url is required' });
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!canAccessProperty(req.user, property)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const before = property.images || [];
    const match = before.find((u) => imageUrlsEqual(u, url));
    property.images = before.filter((u) => !imageUrlsEqual(u, url));
    const removed = !!match;
    await property.save();
    if (removed) {
      try {
        await deleteObjectByUrl(canonicalImageUrl(match));
      } catch (err) {
        console.warn('S3 image delete failed:', err.message);
      }
    }
    const populated = await Property.findById(property._id)
      .populate('zone', 'name city slug lat lng')
      .populate('agent', 'name email');
    res.json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete image' });
  }
});

router.post(
  '/:id/video',
  requireRole('agent', 'admin'),
  upload.single('video'),
  async (req, res) => {
    try {
      const property = await Property.findById(req.params.id);
      if (!property) return res.status(404).json({ message: 'Property not found' });
      if (!canAccessProperty(req.user, property)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'video file is required' });
      }

      property.videoPath = req.file.filename;
      property.videoUrl = `${publicBaseUrl(req)}/uploads/videos/${req.file.filename}`;
      await property.save();

      const populated = await Property.findById(property._id)
        .populate('zone', 'name city slug lat lng')
        .populate('agent', 'name email');
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: err.message || 'Video upload failed' });
    }
  }
);

router.post('/:id/generate-caption', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('zone', 'name city slug')
      .populate('agent', 'name email');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!canAccessProperty(req.user, property)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Always bill the property owner's OpenAI key (agent's own credits)
    const ownerId = property.agent._id || property.agent;
    const ownerProfile = await AgentProfile.findOne({ user: ownerId }).select(
      '+openaiApiKeyEnc openaiModel'
    );
    const apiKey = ownerProfile?.openaiApiKeyEnc
      ? decryptToken(ownerProfile.openaiApiKeyEnc)
      : '';

    const result = await generatePropertyCaption(property, {
      apiKey,
      model: ownerProfile?.openaiModel || 'gpt-4o-mini',
      allowFallback: false,
    });
    property.generatedCaption = result.caption;
    property.generatedScript = result.script;
    await property.save();

    res.json({
      caption: result.caption,
      script: result.script,
      provider: result.provider,
      model: result.model,
      property,
    });
  } catch (err) {
    const status = err.code === 'OPENAI_KEY_MISSING' ? 400 : 500;
    res.status(status).json({ message: err.message || 'Caption generation failed' });
  }
});

router.post('/:id/publish-reel', requireRole('agent'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('zone', 'name city slug')
      .populate('agent', 'name email');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (String(property.agent._id || property.agent) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const creds = await getAgentIgCredentials(req.user._id);
    if (!creds) {
      return res.status(400).json({
        message: 'Connect Instagram on your Profile before publishing a Reel',
      });
    }

    const caption = req.body.caption || property.generatedCaption || property.title;
    const videoUrl = req.body.videoUrl || property.videoUrl;
    if (!videoUrl) {
      return res.status(400).json({
        message:
          'Upload a video clip first. Meta requires a publicly reachable HTTPS video URL.',
      });
    }
    if (!String(videoUrl).startsWith('https://') && process.env.ALLOW_HTTP_VIDEO !== 'true') {
      return res.status(400).json({
        message:
          'Instagram requires an HTTPS public video URL. Set PUBLIC_API_URL to your https tunnel (e.g. ngrok) and re-upload the video.',
      });
    }

    const published = await publishReel({
      igUserId: creds.igUserId,
      accessToken: creds.accessToken,
      videoUrl,
      caption,
    });

    property.generatedCaption = caption;
    property.lastInstagramReelId = published.reelId;
    property.lastInstagramPostedAt = new Date();
    await property.save();

    res.json({
      message: 'Reel published',
      reelId: published.reelId,
      creationId: published.creationId,
      property,
    });
  } catch (err) {
    console.error('publish-reel error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to publish Reel' });
  }
});

router.delete('/:id', requireRole('agent', 'admin'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!canAccessProperty(req.user, property)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const images = [...(property.images || [])];
    await property.deleteOne();
    await deleteObjectsByUrls(images);
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete property' });
  }
});

module.exports = router;
