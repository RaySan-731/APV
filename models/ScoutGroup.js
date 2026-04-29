/*
 * models/ScoutGroup.js
 * Mongoose schema for tracking scout groups within each school.
 * Includes patrol composition, advancement levels, and participation history.
 */
const mongoose = require('mongoose');

const scoutGroupSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  patrol: {
    type: String,
    trim: true
  },
  leaderName: {
    type: String,
    trim: true
  },
  leaderContact: {
    email: String,
    phone: String
  },
  memberCount: {
    type: Number,
    required: true,
    min: 0
  },
  ageRange: {
    min: Number,
    max: Number
  },
  advancementLevel: {
    type: String,
    enum: ['cubs', 'scouts', 'seniors', 'rovers', 'mixed'],
    default: 'scouts'
  },
  meetingSchedule: {
    day: String,
    time: String,
    location: String
  },
  notes: String,
  // Track when this group was first registered
  startDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'paused'],
    default: 'active'
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

// Pre-save hook for updatedAt
scoutGroupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
scoutGroupSchema.index({ schoolId: 1 });
scoutGroupSchema.index({ name: 1 });
scoutGroupSchema.index({ status: 1 });

module.exports = mongoose.model('ScoutGroup', scoutGroupSchema);
