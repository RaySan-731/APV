/*
 * models/EmailLog.js
 * Mongoose schema for tracking all outgoing emails.
 * Provides audit trail, delivery status, and engagement metrics.
 */
const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  // Email metadata
  messageId: {
    type: String,
    unique: true,
    sparse: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  // Sender
  from: {
    email: { type: String, required: true },
    name: { type: String, trim: true }
  },

  // Recipients
  to: [{
    email: { type: String, required: true },
    name: { type: String, trim: true }
  }],
  cc: [{
    email: { type: String, required: true },
    name: { type: String, trim: true }
  }],
  bcc: [{
    email: { type: String, required: true },
    name: { type: String, trim: true }
  }],

  // Content
  textBody: String,
  htmlBody: String,
  templateId: {
    type: String,
    trim: true
  },
  templateVersion: String,

  // Attachments
  attachments: [{
    fileName: String,
    mimeType: String,
    size: Number
  }],

  // Related entity (what triggered this email)
  entityType: {
    type: String,
    enum: ['staff', 'event', 'school', 'payment', 'report', 'message', 'announcement', 'password_reset', 'invitation', 'system'],
    default: 'system'
  },
  entityId: mongoose.Schema.Types.ObjectId,

  // Triggering user
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  triggerReason: {
    type: String,
    trim: true
  },

  // Delivery status
  status: {
    type: String,
    enum: ['pending', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'cancelled'],
    default: 'pending'
  },
  sentAt: Date,
  deliveredAt: Date,
  openedAt: Date,
  clickedAt: Date,

  // SMTP response
  smtpResponse: String,
  smtpCode: Number,
  errorMessage: String,
  errorDetails: mongoose.Schema.Types.Mixed,

  // Retry logic
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  lastRetryAt: Date,
  nextRetryAt: Date,

  // Tracking
  trackingId: {
    type: String,
    unique: true,
    sparse: true
  },
  trackingPixel: String,

  // User interaction tracking
  userAction: {
    opened: { type: Boolean, default: false },
    openedAt: Date,
    clicked: { type: Boolean, default: false },
    clickedAt: Date,
    replied: { type: Boolean, default: false },
    repliedAt: Date
  },

  // Timestamps
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
emailLogSchema.index({ 'to.email': 1, sentAt: -1 });
emailLogSchema.index({ status: 1, sentAt: -1 });
emailLogSchema.index({ entityType: 1, entityId: 1 });
emailLogSchema.index({ triggeredBy: 1, createdAt: -1 });
emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });

// TTL index for cleanup (keep logs for 90 days by default)
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Pre-save hook
emailLogSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
