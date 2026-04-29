/*
 * models/School.js
 * Mongoose schema representing partner schools and their program enrollments.
 * Tracks school contact info, student count, enrolled programs, and partnership status.
 */
const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'USA'
    }
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String
  },
  studentCount: {
    type: Number,
    default: 0
  },
  programsEnrolled: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program'
  }],
  partnershipDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  assignedStaff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }],
  scoutGroups: [{
    name: String,
    leader: String,
    size: Number,
    advancement: String
  }],
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
schoolSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
schoolSchema.index({ name: 1 });
schoolSchema.index({ 'address.city': 1 });
schoolSchema.index({ status: 1 });
module.exports = mongoose.model('School', schoolSchema);     