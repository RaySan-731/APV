/*
 * models/Notification.js
 * Mongoose schema for in-app system notifications and alerts.
 * Supports push and in-app notifications for key events.
 */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Recipient (required)
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },

  // Notification content
  type: {
    type: String,
    enum: [
      'assignment',          // New assignment
      'overdue',             // Overdue item (report, payment)
      'upcoming_event',      // Event within 48hrs
      'payment_received',    // Payment received
      'new_message',         // New internal message
      'document_approval',   // Document approved/rejected
      'event_reminder',      // General event reminder
      'report_reminder',     // Report submission reminder
      'announcement',        // Bulk announcement
      'system',              // System maintenance, updates
      'feedback',            // New feedback/rating
      'approval_required'    // Action required
    ],
    required: true
  },

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  message: {
    type: String,
    required: true,
    trim: true
  },

  // Icon and visual styling
  icon: {
    type: String,
    default: 'bell', // bell, envelope, calendar, alert, check, etc.
    maxlength: 50
  },
  color: {
    type: String,
    enum: ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'gray'],
    default: 'blue'
  },

  // Actionable link
  actionUrl: {
    type: String,
    trim: true
  },
  actionLabel: {
    type: String,
    trim: true,
    maxlength: 50
  },

  // Related entity (what triggered this notification)
  entityType: {
    type: String,
    enum: ['event', 'staff', 'school', 'payment', 'report', 'message', 'announcement', 'document', 'system'],
    default: 'system'
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },

  // Priority and urgency
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent', 'critical'],
    default: 'normal'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,

  // Expiration and persistence
  expiresAt: Date, // auto-cleanup after this date
  isSticky: {
    type: Boolean,
    default: false // stays until manually dismissed
  },

  // Delivery tracking
  channels: [{
    type: String,
    enum: ['in-app', 'email'],
    default: ['in-app']
  }],
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,

  // Dismissal
  dismissed: {
    type: Boolean,
    default: false
  },
  dismissedAt: Date,

  // Metadata for context
  metadata: {
    relatedNames: [String], // e.g., event name, staff name
    extra: mongoose.Schema.Types.Mixed
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

// Indexes for performance
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ type: 1, priority: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Update updatedAt before saving
notificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
