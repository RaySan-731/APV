/*
 * models/Permission.js
 * Mongoose schema for defining role-based permissions.
 */
const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    unique: true,
    enum: ['founder', 'commissioner', 'training_officer', 'medical', 'rover', 'trainer', 'staff', 'senior trainer', 'supervisor', 'admin', 'coordinator']
  },

  permissions: {
    // Staff Management
    canViewStaff: { type: Boolean, default: false },
    canCreateStaff: { type: Boolean, default: false },
    canEditStaff: { type: Boolean, default: false },
    canDeleteStaff: { type: Boolean, default: false },
    canInviteStaff: { type: Boolean, default: false },
    canResetPasswords: { type: Boolean, default: false },

    // School Management
    canViewSchools: { type: Boolean, default: true },
    canCreateSchools: { type: Boolean, default: false },
    canEditSchools: { type: Boolean, default: false },
    canDeleteSchools: { type: Boolean, default: false },
    canAssignTrainers: { type: Boolean, default: false },

    // Event Management
    canViewEvents: { type: Boolean, default: true },
    canCreateEvents: { type: Boolean, default: false },
    canEditEvents: { type: Boolean, default: false },
    canDeleteEvents: { type: Boolean, default: false },
    canScheduleEvents: { type: Boolean, default: false },

    // Program Management
    canViewPrograms: { type: Boolean, default: true },
    canCreatePrograms: { type: Boolean, default: false },
    canEditPrograms: { type: Boolean, default: false },
    canDeletePrograms: { type: Boolean, default: false },

    // Booking Management
    canViewBookings: { type: Boolean, default: false },
    canCreateBookings: { type: Boolean, default: false },
    canEditBookings: { type: Boolean, default: false },
    canDeleteBookings: { type: Boolean, default: false },
    canApproveBookings: { type: Boolean, default: false },

    // Financial Access
    canViewFinancials: { type: Boolean, default: false },
    canManageBudgets: { type: Boolean, default: false },

    // Analytics & Reports
    canViewAnalytics: { type: Boolean, default: false },
    canGenerateReports: { type: Boolean, default: false },
    canApproveReports: { type: Boolean, default: false },

    // System Administration
    canManageSystem: { type: Boolean, default: false },
    canViewAuditLogs: { type: Boolean, default: false },
    canManagePermissions: { type: Boolean, default: false }
  },

  description: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

permissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Permission', permissionSchema);