/*
 * models/Booking.js
 * Mongoose schema for program booking requests submitted by users.
 * Captures program selection, participant count, date, requester info, and booking status.
 */
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  program: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['school', 'individual', 'group'],
    default: 'school'
  },
  date: {
    type: Date,
    required: true
  },
  participants: {
    type: Number,
    required: true,
    min: 1
  },
  notes: {
    type: String,
    trim: true
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  requesterName: {
    type: String,
    trim: true
  },
  // Preserve any legacy/third-party ID values from the original JSON store
  // so administrators can cross-reference migrated records with legacy data.
  legacyId: {
    type: String,
    index: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
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
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
bookingSchema.index({ userEmail: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
