/*
 * models/AuditLog.js
 * Mongoose schema for tracking all admin-level actions and system changes.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'staff_created', 'staff_updated', 'staff_deleted', 'staff_invited',
      'school_created', 'school_updated', 'school_deleted',
      'event_created', 'event_updated', 'event_deleted',
      'program_created', 'program_updated', 'program_deleted',
      'booking_created', 'booking_updated', 'booking_deleted',
      'permission_changed', 'role_changed', 'status_changed',
      'password_reset', 'account_activated', 'account_deactivated',
      'leave_approved', 'leave_rejected', 'assignment_changed',
      'feedback_submitted', 'visit_logged'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['staff', 'school', 'event', 'program', 'booking', 'user', 'system']
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  entityName: String, // Human-readable name of the entity

  performedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    userName: String,
    userEmail: String,
    userRole: String
  },

  changes: {
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    fieldsChanged: [String]
  },

  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String,
    sessionId: String
  },

  timestamp: { type: Date, default: Date.now },
  notes: String
});

// Indexes for efficient querying
auditLogSchema.index({ 'performedBy.userId': 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);