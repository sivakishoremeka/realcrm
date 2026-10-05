const express = require('express');
const multer = require('multer');
const Property = require('../models/Property');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { getOwnerTermsTemplate, TERMS_VERSION } = require('../constants/ownerTermsTemplate');
const {
  buildListingImageKey,
  uploadListingImage,
  deleteObjectByUrl,
  deleteObjectsByUrls,
  withSignedImages,
  withSignedImagesMany,
  imageUrlsEqual,
  canonicalImageUrl,
} = require('../services/s3');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

function populateListing(query) {
  return query
    .populate('zone', 'name city slug lat lng')
    .populate('owner', 'name email')
    .populate('agent', 'name email');
}

async function findOwnedListing(id, ownerId) {
  return Property.findOne({ _id: id, owner: ownerId });
}

router.use(auth);

router.get('/terms-template', requireRole('owner', 'admin'), (req, res) => {
  const listingType = req.query.listingType || 'Sale';
  res.json(getOwnerTermsTemplate(listingType));
});

router.get('/mine', requireRole('owner'), async (req, res) => {
  try {
    const listings = await populateListing(
      Property.find({ owner: req.user._id }).sort({ createdAt: -1 })
    );
    res.json(await withSignedImagesMany(listings));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch listings' });
  }
});

router.get('/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : { _id: req.params.id, owner: req.user._id };
    const listing = await populateListing(Property.findOne(filter));
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(await withSignedImages(listing));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch listing' });
  }
});

router.post('/', requireRole('owner'), async (req, res) => {
  try {
    const {
      title,
      type,
      listingType,
      bhk,
      price,
      areaSqft,
      zone,
      address,
      notes,
      listedViaAgent,
      viaAgentNote,
      termsText,
    } = req.body;

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

    const template = getOwnerTermsTemplate(listingType);
    const listing = await Property.create({
      owner: req.user._id,
      agent: null,
      title,
      type,
      listingType,
      bhk: bhk != null && bhk !== '' ? Number(bhk) : null,
      price: Number(price),
      areaSqft: areaSqft != null && areaSqft !== '' ? Number(areaSqft) : null,
      zone,
      address: address || '',
      notes: notes || '',
      listedViaAgent: !!listedViaAgent,
      viaAgentNote: viaAgentNote || '',
      termsText: termsText || template.text,
      termsVersion: TERMS_VERSION,
      status: 'Draft',
      images: [],
    });

    const populated = await populateListing(Property.findById(listing._id));
    res.status(201).json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create listing' });
  }
});

router.put('/:id', requireRole('owner'), async (req, res) => {
  try {
    const listing = await findOwnedListing(req.params.id, req.user._id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const fields = [
      'title',
      'type',
      'listingType',
      'bhk',
      'price',
      'areaSqft',
      'zone',
      'address',
      'notes',
      'listedViaAgent',
      'viaAgentNote',
      'termsText',
      'status',
    ];
    fields.forEach((field) => {
      if (req.body[field] === undefined) return;
      if (['bhk', 'price', 'areaSqft'].includes(field)) {
        listing[field] =
          req.body[field] === '' || req.body[field] == null
            ? field === 'price'
              ? listing.price
              : null
            : Number(req.body[field]);
      } else if (field === 'listedViaAgent') {
        listing.listedViaAgent = !!req.body[field];
      } else if (field === 'status') {
        // Publish only via POST /:id/publish; allow unpublish / hold / sold here
        if (['Draft', 'Hold', 'Sold'].includes(req.body.status)) {
          listing.status = req.body.status;
        }
      } else {
        listing[field] = req.body[field];
      }
    });

    await listing.save();
    const populated = await populateListing(Property.findById(listing._id));
    res.json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update listing' });
  }
});

router.post(
  '/:id/images',
  requireRole('owner'),
  upload.array('images', 12),
  async (req, res) => {
    try {
      const listing = await findOwnedListing(req.params.id, req.user._id);
      if (!listing) return res.status(404).json({ message: 'Listing not found' });
      if (!req.files?.length) {
        return res.status(400).json({ message: 'At least one image file is required' });
      }

      const urls = [];
      for (const file of req.files) {
        const key = buildListingImageKey({
          ownerId: req.user._id,
          listingId: listing._id,
          originalName: file.originalname,
        });
        const url = await uploadListingImage({
          buffer: file.buffer,
          contentType: file.mimetype || 'image/jpeg',
          key,
        });
        urls.push(url);
      }

      listing.images = [...(listing.images || []), ...urls];
      await listing.save();

      const populated = await populateListing(Property.findById(listing._id));
      res.json(await withSignedImages(populated));
    } catch (err) {
      console.error('Listing image upload failed:', err.message);
      res.status(500).json({ message: err.message || 'Image upload failed' });
    }
  }
);

router.delete('/:id/images', requireRole('owner'), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'url is required' });

    const listing = await findOwnedListing(req.params.id, req.user._id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const before = listing.images || [];
    const match = before.find((u) => imageUrlsEqual(u, url));
    listing.images = before.filter((u) => !imageUrlsEqual(u, url));
    const removed = !!match;
    await listing.save();

    if (removed) {
      try {
        await deleteObjectByUrl(canonicalImageUrl(match));
      } catch (err) {
        console.warn('S3 image delete failed:', err.message);
      }
    }

    const populated = await populateListing(Property.findById(listing._id));
    res.json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete image' });
  }
});

router.post('/:id/publish', requireRole('owner'), async (req, res) => {
  try {
    const listing = await findOwnedListing(req.params.id, req.user._id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    if (!['Draft', 'Hold'].includes(listing.status)) {
      return res.status(400).json({
        message: 'Only Draft or Hold listings can be published',
      });
    }
    if (!listing.images?.length) {
      return res.status(400).json({ message: 'Add at least one photo before publishing' });
    }
    if (!listing.termsText?.trim()) {
      return res.status(400).json({ message: 'Terms & conditions text is required' });
    }
    if (!req.body.accepted) {
      return res.status(400).json({
        message: 'You must accept the Terms & Conditions to publish (accepted: true)',
      });
    }

    listing.status = 'Available';
    listing.termsAcceptedAt = new Date();
    listing.termsVersion = listing.termsVersion || TERMS_VERSION;
    await listing.save();

    const populated = await populateListing(Property.findById(listing._id));
    res.json(await withSignedImages(populated));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to publish listing' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const listing = await findOwnedListing(req.params.id, req.user._id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    const images = [...(listing.images || [])];
    await listing.deleteOne();
    await deleteObjectsByUrls(images);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete listing' });
  }
});

module.exports = router;
