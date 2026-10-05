const express = require('express');
const Property = require('../models/Property');
const Enquiry = require('../models/Enquiry');
const AgentProfile = require('../models/AgentProfile');
const auth = require('../middleware/auth');
const { requireRole, normalizeRole } = require('../middleware/roles');
const {
  withSignedImages,
  withSignedImagesMany,
  signStoredImageUrl,
} = require('../services/s3');

const router = express.Router();

router.use(auth);

function populateProperty(query) {
  return query
    .populate('zone', 'name city slug lat lng')
    .populate('agent', 'name email profilePic')
    .populate('owner', 'name email profilePic');
}

async function attachPublisherCard(listingDoc) {
  const listing =
    typeof listingDoc.toObject === 'function' ? listingDoc.toObject() : { ...listingDoc };

  const pubUser = listing.agent || listing.owner;
  if (!pubUser?._id && !pubUser) {
    listing.publisher = null;
    return listing;
  }

  const userObj =
    typeof pubUser.toObject === 'function' ? pubUser.toObject() : { ...pubUser };
  const userId = userObj._id || userObj;
  const profile = await AgentProfile.findOne({ user: userId }).select(
    'ratingAvg ratingCount agencyName phone'
  );

  const profilePic = userObj.profilePic
    ? await signStoredImageUrl(userObj.profilePic)
    : '';

  listing.publisher = {
    id: String(userId),
    name: userObj.name || 'Publisher',
    email: userObj.email || '',
    profilePic,
    agencyName: profile?.agencyName || '',
    phone: profile?.phone || '',
    ratingAvg: profile?.ratingAvg || 0,
    ratingCount: profile?.ratingCount || 0,
  };
  return listing;
}

async function attachPublisherCards(listings) {
  return Promise.all(listings.map((l) => attachPublisherCard(l)));
}

/** Published inventory + owner listings available to customers */
router.get(
  '/listings',
  requireRole('customer', 'admin', 'publisher', 'agent', 'owner'),
  async (req, res) => {
    try {
      const filter = { status: 'Available' };
      if (req.query.listingType) filter.listingType = req.query.listingType;
      if (req.query.type) filter.type = req.query.type;
      if (req.query.zone) filter.zone = req.query.zone;
      if (req.query.budgetMax != null && req.query.budgetMax !== '') {
        filter.price = { ...(filter.price || {}), $lte: Number(req.query.budgetMax) };
      }
      if (req.query.budgetMin != null && req.query.budgetMin !== '') {
        filter.price = { ...(filter.price || {}), $gte: Number(req.query.budgetMin) };
      }

      const listings = await populateProperty(
        Property.find(filter).sort({ createdAt: -1 }).limit(100)
      );
      const signed = await withSignedImagesMany(listings);
      res.json(await attachPublisherCards(signed));
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to load marketplace' });
    }
  }
);

router.get(
  '/listings/:id',
  requireRole('customer', 'admin', 'publisher', 'agent', 'owner'),
  async (req, res) => {
    try {
      const listing = await populateProperty(Property.findById(req.params.id));
      if (!listing) return res.status(404).json({ message: 'Listing not found' });
      if (
        normalizeRole(req.user) === 'customer' &&
        listing.status !== 'Available'
      ) {
        return res.status(404).json({ message: 'Listing not found' });
      }
      const signed = await withSignedImages(listing);
      res.json(await attachPublisherCard(signed));
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to load listing' });
    }
  }
);

router.post('/enquiries', requireRole('customer'), async (req, res) => {
  try {
    const { property, message } = req.body;
    if (!property) {
      return res.status(400).json({ message: 'property is required' });
    }
    const prop = await Property.findById(property);
    if (!prop || prop.status !== 'Available') {
      return res.status(400).json({ message: 'Property is not available for enquiry' });
    }

    const enquiry = await Enquiry.create({
      customer: req.user._id,
      property,
      message: message || '',
      status: 'Open',
    });

    const populated = await Enquiry.findById(enquiry._id)
      .populate('customer', 'name email profilePic')
      .populate({
        path: 'property',
        populate: [
          { path: 'zone', select: 'name city' },
          { path: 'agent', select: 'name email profilePic' },
          { path: 'owner', select: 'name email profilePic' },
        ],
      });
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create enquiry' });
  }
});

router.get('/enquiries/mine', requireRole('customer'), async (req, res) => {
  try {
    const items = await Enquiry.find({ customer: req.user._id })
      .populate({
        path: 'property',
        populate: [
          { path: 'zone', select: 'name city' },
          { path: 'agent', select: 'name email profilePic' },
          { path: 'owner', select: 'name email profilePic' },
        ],
      })
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(
      items.map(async (item) => {
        const obj = item.toObject();
        if (obj.property) {
          obj.property = await attachPublisherCard(obj.property);
        }
        return obj;
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch enquiries' });
  }
});

router.get(
  '/enquiries',
  requireRole('admin', 'publisher', 'agent', 'owner'),
  async (req, res) => {
    try {
      let filter = {};
      if (normalizeRole(req.user) !== 'admin') {
        const myProps = await Property.find({
          $or: [{ agent: req.user._id }, { owner: req.user._id }],
        }).select('_id');
        filter = { property: { $in: myProps.map((p) => p._id) } };
      }

      const items = await Enquiry.find(filter)
        .populate('customer', 'name email')
        .populate({
          path: 'property',
          populate: [{ path: 'zone', select: 'name city' }],
        })
        .sort({ createdAt: -1 })
        .limit(200);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to fetch enquiries' });
    }
  }
);

router.patch(
  '/enquiries/:id',
  requireRole('admin', 'publisher', 'agent', 'owner'),
  async (req, res) => {
    try {
      const enquiry = await Enquiry.findById(req.params.id).populate('property');
      if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });

      if (normalizeRole(req.user) !== 'admin') {
        const prop = enquiry.property;
        const uid = String(req.user._id);
        const ok =
          String(prop.agent || '') === uid || String(prop.owner || '') === uid;
        if (!ok) return res.status(403).json({ message: 'Not authorized' });
      }

      if (req.body.status && ['Open', 'Contacted', 'Closed'].includes(req.body.status)) {
        enquiry.status = req.body.status;
      }
      await enquiry.save();

      const populated = await Enquiry.findById(enquiry._id)
        .populate('customer', 'name email')
        .populate({
          path: 'property',
          populate: [{ path: 'zone', select: 'name city' }],
        });
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to update enquiry' });
    }
  }
);

module.exports = router;
