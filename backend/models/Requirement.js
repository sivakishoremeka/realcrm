const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  leadGenerator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  listingType: {
    type: String,
    enum: ['Sale', 'Rent', 'Lease'],
    required: true,
  },
  propertyType: {
    type: String,
    enum: ['Apartment', 'Villa', 'Plot', 'Commercial', 'Any'],
    default: 'Any',
  },
  bhkMin: {
    type: Number,
    default: null,
  },
  bhkMax: {
    type: Number,
    default: null,
  },
  budgetMin: {
    type: Number,
    default: 0,
  },
  budgetMax: {
    type: Number,
    default: null,
  },
  preferredZones: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceZone',
    },
  ],
  notes: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Open', 'Matched', 'Assigned', 'Closed'],
    default: 'Open',
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Split commission: total brokerage %; leadGenSharePercent of that goes to lead generator
  commissionPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  leadGenSharePercent: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
  },
  commissionNotes: {
    type: String,
    default: '',
  },
  nextFollowUpAt: {
    type: Date,
    default: null,
  },
  buyerHappyNotes: {
    type: String,
    default: '',
  },
  // Users who marked this lead as read. Not returned unless selected.
  readBy: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

requirementSchema.pre('validate', function setLeadGenerator(next) {
  if (!this.leadGenerator) {
    this.leadGenerator = this.createdBy;
  }
  next();
});

module.exports = mongoose.model('Requirement', requirementSchema);
