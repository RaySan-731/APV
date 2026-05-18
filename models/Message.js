/*
 * models/Message.js
 * Mongoose schema for internal direct messaging system.
 * Supports one-to-one and one-to-many messaging with text and file attachments.
 * All messages are stored and searchable.
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Sender (required)
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  senderRole: {
    type: String,
    enum: ['trainer', 'senior trainer', 'supervisor', 'admin', 'coordinator', 'founder', 'commissioner', 'training_officer', 'medical', 'rover', 'staff'],
    required: true
  },

  // Recipients (at least one required)
  recipients: [{
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent'
    },
    readAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  }],

  // Message content
  subject: {
    type: String,
    trim: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    trim: true
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
    size: {
      type: Number, // bytes
      required: true
    },
    path: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Conversation threading
  parentMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Message type for grouping
  messageType: {
    type: String,
    enum: ['direct', 'group', 'system', 'announcement_reply'],
    default: 'direct'
  },

  // Labels/tags for organization
  labels: [{
    type: String,
    trim: true
  }],

  // Context: links message to an event, region/zone, or school (for team chats / event chat)
  context: {
    type: {
      type: String,
      enum: ['event', 'region', 'school']
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    zone: {
      type: String,
      trim: true
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School'
    }
  },

  // Importance and tracking
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isImportant: {
    type: Boolean,
    default: false
  },

  // Message state
  status: {
    type: String,
    enum: ['draft', 'sending', 'sent', 'delivered', 'read_by_all', 'failed'],
    default: 'sent'
  },
  failedReason: String,

  // Audit
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date,
  lastReadAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for fast queries
messageSchema.index({ senderId: 1, sentAt: -1 });
messageSchema.index({ 'recipients.staffId': 1, 'recipients.status': 1 });
messageSchema.index({ 'recipients.staffId': 1, sentAt: -1 });
messageSchema.index({ parentMessageId: 1 });
messageSchema.index({ subject: 'text', body: 'text' }); // Full-text search
messageSchema.index({ sentAt: -1 });
messageSchema.index({ priority: 1 });
messageSchema.index({ 'recipients.deleted': 1 });

// Update updatedAt before saving
messageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if all recipients have read
messageSchema.virtual('allRead').get(function() {
  return this.recipients.every(r => r.status === 'read');
});

// Virtual for unread count per recipient (computed client-side)
messageSchema.virtual('recipients.unreadCount').get(function() {
  return this.recipients.filter(r => r.status !== 'read' && !r.deleted).length;
});

module.exports = mongoose.model('Message', messageSchema);
