const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    minlength: 6,
    required: function passwordRequired() {
      return !this.googleId;
    },
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  role: {
    // publisher = Owner/Agent (post as either); customer = buyer/renter; admin = Business Owner
    // agent/owner/sales kept for legacy documents
    type: String,
    enum: ['admin', 'publisher', 'customer', 'agent', 'owner', 'sales'],
    default: 'publisher',
  },
  // Canonical S3 URL for profile photo (clients get a signed URL via API)
  profilePic: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function hashPassword(next) {
  if (this.role === 'sales' || this.role === 'agent' || this.role === 'owner') {
    this.role = 'publisher';
  }
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.normalizedRole = function normalizedRole() {
  if (this.role === 'sales' || this.role === 'agent' || this.role === 'owner') {
    return 'publisher';
  }
  return this.role;
};

module.exports = mongoose.model('User', userSchema);
