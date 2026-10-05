const express = require('express');
const mongoose = require('mongoose');
const AgentReview = require('../models/AgentReview');
const AgentProfile = require('../models/AgentProfile');
const Requirement = require('../models/Requirement');
const Enquiry = require('../models/Enquiry');
const Property = require('../models/Property');
const auth = require('../middleware/auth');
const { requireRole, normalizeRole } = require('../middleware/roles');

const router = express.Router({ mergeParams: true });

router.use(auth);

async function recomputeAgentRating(agentId) {
  const oid = new mongoose.Types.ObjectId(String(agentId));
  const stats = await AgentReview.aggregate([
    { $match: { agent: oid } },
    {
      $group: {
        _id: '$agent',
        ratingAvg: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  const avg = stats[0] ? Math.round(stats[0].ratingAvg * 10) / 10 : 0;
  const count = stats[0]?.ratingCount || 0;

  let profile = await AgentProfile.findOne({ user: agentId });
  if (!profile) {
    profile = await AgentProfile.create({ user: agentId });
  }
  profile.ratingAvg = avg;
  profile.ratingCount = count;
  await profile.save();
  return { ratingAvg: avg, ratingCount: count };
}

function publisherIdsOnProperty(property) {
  const ids = [];
  if (property?.agent) ids.push(String(property.agent._id || property.agent));
  if (property?.owner) ids.push(String(property.owner._id || property.owner));
  return ids;
}

/**
 * Resolve review eligibility.
 * - Business Owner (admin): always, one general review per agent (or per requirement)
 * - Customer: must have an enquiry on a property of that publisher
 * - Publisher/agent: lead generator / creator on assigned requirement
 */
async function resolveReviewContext(user, agentId, { requirementId, enquiryId } = {}) {
  const role = normalizeRole(user);
  const uid = String(user._id);
  const aid = String(agentId);

  if (uid === aid) {
    return { ok: false, status: 400, message: 'You cannot review yourself' };
  }

  if (role === 'admin') {
    if (requirementId) {
      const requirement = await Requirement.findById(requirementId);
      if (!requirement) {
        return { ok: false, status: 404, message: 'Requirement not found' };
      }
      if (String(requirement.assignedAgent || '') !== aid) {
        return {
          ok: false,
          status: 400,
          message: 'Agent is not assigned to this requirement',
        };
      }
      return {
        ok: true,
        source: 'admin',
        contextKey: `req:${requirementId}`,
        requirement: requirementId,
        enquiry: null,
      };
    }
    return {
      ok: true,
      source: 'admin',
      contextKey: 'admin',
      requirement: null,
      enquiry: null,
    };
  }

  if (role === 'customer') {
    if (!enquiryId) {
      return {
        ok: false,
        status: 400,
        message: 'enquiry is required for customer ratings',
      };
    }
    const enquiry = await Enquiry.findById(enquiryId).populate('property');
    if (!enquiry) {
      return { ok: false, status: 404, message: 'Enquiry not found' };
    }
    if (String(enquiry.customer) !== uid) {
      return { ok: false, status: 403, message: 'Not your enquiry' };
    }
    const pubIds = publisherIdsOnProperty(enquiry.property);
    if (!pubIds.includes(aid)) {
      return {
        ok: false,
        status: 403,
        message: 'You can only rate the publisher for this listing',
      };
    }
    return {
      ok: true,
      source: 'customer',
      contextKey: `enq:${enquiryId}`,
      requirement: null,
      enquiry: enquiryId,
    };
  }

  // publisher / legacy agent — lead-gen path
  if (!requirementId) {
    return {
      ok: false,
      status: 400,
      message: 'requirement is required to rate the serving agent',
    };
  }
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) {
    return { ok: false, status: 404, message: 'Requirement not found' };
  }
  if (String(requirement.assignedAgent || '') !== aid) {
    return {
      ok: false,
      status: 400,
      message: 'Agent is not assigned to this requirement',
    };
  }
  const isLeadGen =
    String(requirement.createdBy) === uid ||
    String(requirement.leadGenerator || '') === uid;
  if (!isLeadGen) {
    return {
      ok: false,
      status: 403,
      message: 'Only the lead generator can review the serving agent',
    };
  }
  return {
    ok: true,
    source: 'leadgen',
    contextKey: `req:${requirementId}`,
    requirement: requirementId,
    enquiry: null,
  };
}

router.get(
  '/',
  requireRole('admin', 'agent', 'publisher', 'customer', 'owner'),
  async (req, res) => {
    try {
      const agentId = req.params.id;
      const reviews = await AgentReview.find({ agent: agentId })
        .populate('author', 'name email profilePic')
        .populate('requirement', 'status listingType')
        .populate('enquiry', 'status message')
        .sort({ createdAt: -1 })
        .limit(50);
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to fetch reviews' });
    }
  }
);

router.post(
  '/',
  requireRole('admin', 'agent', 'publisher', 'customer', 'owner'),
  async (req, res) => {
    try {
      const agentId = req.params.id;
      const { rating, comment, requirement, enquiry } = req.body;
      const score = Number(rating);

      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ message: 'rating must be between 1 and 5' });
      }

      const ctx = await resolveReviewContext(req.user, agentId, {
        requirementId: requirement,
        enquiryId: enquiry,
      });
      if (!ctx.ok) {
        return res.status(ctx.status).json({ message: ctx.message });
      }

      const review = await AgentReview.findOneAndUpdate(
        {
          author: req.user._id,
          agent: agentId,
          contextKey: ctx.contextKey,
        },
        {
          author: req.user._id,
          agent: agentId,
          contextKey: ctx.contextKey,
          requirement: ctx.requirement,
          enquiry: ctx.enquiry,
          source: ctx.source,
          rating: score,
          comment: comment || '',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
        .populate('author', 'name email profilePic')
        .populate('requirement', 'status listingType')
        .populate('enquiry', 'status message');

      const aggregates = await recomputeAgentRating(review.agent);

      res.status(201).json({ review, ...aggregates });
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(400)
          .json({ message: 'You already reviewed this agent for this context' });
      }
      res.status(500).json({ message: err.message || 'Failed to save review' });
    }
  }
);

module.exports = router;
