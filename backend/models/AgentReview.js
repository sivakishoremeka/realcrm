const mongoose = require('mongoose');

const agentReviewSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Unique per author+agent+context (admin | req:<id> | enq:<id>)
  contextKey: {
    type: String,
    required: true,
  },
  requirement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
    default: null,
  },
  enquiry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enquiry',
    default: null,
  },
  // admin | customer | leadgen
  source: {
    type: String,
    enum: ['admin', 'customer', 'leadgen'],
    default: 'leadgen',
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    default: '',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

agentReviewSchema.index({ author: 1, agent: 1, contextKey: 1 }, { unique: true });
agentReviewSchema.index({ agent: 1, createdAt: -1 });

module.exports = mongoose.model('AgentReview', agentReviewSchema);
