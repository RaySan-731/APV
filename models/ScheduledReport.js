/*
 * models/ScheduledReport.js
 * Mongoose schema for scheduled/automated reports
 */

const mongoose = require('mongoose');

const scheduledReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  reportType: {
    type: String,
    required: true,
    enum: ['trainers', 'events', 'schools', 'custom']
  },
  frequency: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly']
  },
  config: {
    // Report-specific configuration
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // users with founder/admin roles
    required: true
  }],
  lastSentAt: Date,
  nextSendAt: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date, // optional end date
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt before save
scheduledReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
scheduledReportSchema.index({ nextSendAt: 1, isActive: 1 });
scheduledReportSchema.index({ reportType: 1 });
scheduledReportSchema.index({ createdBy: 1 });

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema);
