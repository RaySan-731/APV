/*
 * models/NotificationPreference.js
 * Mongoose schema for user notification preferences.
 * Allows admins and users to configure which events trigger notifications
 * and set escalation rules for critical actions.
 */
const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
  // User (Staff member)
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
    unique: true
  },

  // Global on/off switch
  notificationsEnabled: {
    type: Boolean,
    default: true
  },

  // Channel preferences (in-app, email)
  channels: {
    inApp: {
      enabled: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    },
    email: {
      enabled: { type: Boolean, default: true },
      digest: { type: Boolean, default: false }, // immediate vs daily digest
      schedule: {
        allowed: { type: Boolean, default: true },
        startHour: { type: Number, min: 0, max: 23, default: 8 },
        endHour: { type: Number, min: 0, max: 23, default: 17 },
        weekendsOnly: { type: Boolean, default: false }
      }
    }
  },

  // Notification type preferences (per-type toggles)
  types: {
    assignment: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    overdue: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true }, urgent: { type: Boolean, default: true } },
    upcoming_event: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true }, hoursBefore: { type: Number, default: 48 } },
    payment_received: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    new_message: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
    document_approval: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    event_reminder: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    report_reminder: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    announcement: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    system: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
    feedback: { enabled: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
    approval_required: { enabled: { type: Boolean, default: true }, email: { type: Boolean, default: true } }
  },

  // Escalation rules for critical actions
  escalation: {
    overduePayments: {
      enabled: { type: Boolean, default: true },
      escalateAfterDays: { type: Number, default: 3 },
      escalateToRoles: [{ type: String, enum: ['admin', 'supervisor', 'founder'] }],
      frequency: { type: String, enum: ['daily', 'weekly', 'once'], default: 'daily' }
    },
    missedReports: {
      enabled: { type: Boolean, default: true },
      escalateAfterDays: { type: Number, default: 2 },
      escalateToRoles: [{ type: String, enum: ['admin', 'supervisor', 'founder'] }],
      frequency: { type: String, enum: ['daily', 'weekly', 'once'], default: 'daily' }
    },
    unresolvedConflicts: {
      enabled: { type: Boolean, default: true },
      escalateAfterHours: { type: Number, default: 24 },
      escalateToRoles: [{ type: String, enum: ['admin', 'founder'] }],
      frequency: { type: String, enum: ['hourly', 'daily'], default: 'daily' }
    }
  },

  // Quiet hours / Do not disturb
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' }, // HH:MM format
    endTime: { type: String, default: '07:00' },
    timezone: { type: String, default: 'Africa/Nairobi' }
  },

  // Weekly digest settings
  weeklyDigest: {
    enabled: { type: Boolean, default: true },
    dayOfWeek: { type: Number, min: 0, max: 6, default: 0 }, // 0 = Sunday
    includeUnread: { type: Boolean, default: true },
    includePending: { type: Boolean, default: true },
    includeActivitySummary: { type: Boolean, default: true }
  },

  // Muted notifications (specific notification IDs to ignore)
  mutedNotifications: [{
    notificationType: { type: String },
    entityId: mongoose.Schema.Types.ObjectId,
    mutedUntil: Date
  }],

  // Role-specific defaults (set by admins, applies to all users with that role)
  roleDefaults: {
    applyRoleDefaults: { type: Boolean, default: false },
    overriddenTypes: [String] // list of types user has overridden
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

// Indexes
notificationPreferenceSchema.index({ staffId: 1 }, { unique: true });
notificationPreferenceSchema.index({ 'channels.email.digest': 1 });

// Update updatedAt before saving
notificationPreferenceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
