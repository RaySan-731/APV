/*
 * models/Announcement.js
 * Mongoose schema for bulk announcement broadcasts.
 * Supports sending to all trainers, specific zones, or all schools.
 */
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  // Creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  createdByRole: {
    type: String,
    enum: ['admin', 'founder', 'commissioner', 'supervisor'],
    required: true
  },

  // Announcement content
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true
  },

  // Rich text / formatting
  format: {
    type: String,
    enum: ['plain', 'markdown', 'html'],
    default: 'plain'
  },

  // Attachments
  attachments: [{
    fileName: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: { type: Number },
    path: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Target audience
  targetType: {
    type: String,
    enum: ['all_trainers', 'all_staff', 'all_schools', 'specific_zones', 'specific_roles', 'specific_schools', 'specific_staff'],
    required: true
  },
  targetDetails: {
    // For specific_zones
    zones: [{ type: String, trim: true }],
    // For specific_roles
    roles: [{
      type: String,
      enum: ['trainer', 'senior trainer', 'supervisor', 'admin', 'coordinator', 'staff', 'founder', 'commissioner', 'training_officer', 'medical', 'rover']
    }],
    // For specific_schools or specific_staff
    ids: [{ type: mongoose.Schema.Types.ObjectId }],
    // All target emails (computed at send time)
    recipientCount: { type: Number, default: 0 }
  },

  // Delivery scheduling
  deliveryType: {
    type: String,
    enum: ['immediate', 'scheduled', 'recurring'],
    default: 'immediate'
  },
  scheduledAt: Date, // for scheduled delivery
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: { type: Number, default: 1 },
    daysOfWeek: [Number], // 0-6 for weekly
    dayOfMonth: { type: Number, min: 1, max: 31 },
    untilDate: Date,
    occurrences: Number
  },

  // Importance and tracking
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  requiresAcknowledgment: {
    type: Boolean,
    default: false
  },
  acknowledgmentDeadline: Date,

  // Notification settings
  sendAsNotification: {
    type: Boolean,
    default: true
  },
  sendEmail: {
    type: Boolean,
    default: true
  },
  emailSubject: {
    type: String,
    trim: true,
    maxlength: 200
  },
  emailTemplate: {
    type: String,
    enum: ['default', 'policy', 'emergency', 'event', 'reminder'],
    default: 'default'
  },

  // Delivery tracking
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  sentAt: Date,
  deliveredAt: Date,

  // Engagement metrics
  metrics: {
    totalRecipients: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    acknowledgedCount: { type: Number, default: 0 },
    emailOpenRate: { type: Number, default: 0 },
    clickThroughRate: { type: Number, default: 0 }
  },

  // Recipient acknowledgments
  acknowledgments: [{
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    acknowledgedAt: Date,
    notes: String
  }],

  // Audit
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
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

// Indexes for queries
announcementSchema.index({ createdBy: 1, createdAt: -1 });
announcementSchema.index({ targetType: 1 });
announcementSchema.index({ status: 1, scheduledAt: 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ 'targetDetails.zones': 1 });
announcementSchema.index({ 'targetDetails.roles': 1 });

// Pre-save hook
announcementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);
