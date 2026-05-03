/*
 * models/Staff.js
 * Mongoose schema for APV staff members with comprehensive profile management.
 */
const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  // Basic Information
  idNumber: { type: String, trim: true, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, trim: true },
  dateOfBirth: { type: Date },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Kenya' }
  },

  // Employment Information
  role: {
    type: String,
    required: true,
    enum: ['trainer', 'senior trainer', 'supervisor', 'admin', 'coordinator'],
    default: 'trainer'
  },
  status: {
    type: String,
    enum: ['Active', 'On Leave', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  employmentStartDate: { type: Date, default: Date.now },
  employmentEndDate: { type: Date },
  department: { type: String, default: 'Training' },

  // Profile Information
  certifications: [{
    name: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    status: { type: String, enum: ['active', 'expired', 'pending'], default: 'active' }
  }],
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  notes: String,

  // Assignment Information
  assignedSchools: [{
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    assignmentType: { type: String, enum: ['primary', 'secondary'], default: 'primary' },
    assignedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'transferred'], default: 'active' }
  }],
  zones: [{ type: String }], // Geographic zones assigned to

  // Permissions & Access
  permissions: {
    canViewFinancials: { type: Boolean, default: false },
    canApproveReports: { type: Boolean, default: false },
    canScheduleEvents: { type: Boolean, default: false },
    canManageStaff: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canManageSchools: { type: Boolean, default: false },
    canSendInvitations: { type: Boolean, default: false }
  },

  // Availability & Leave
  availability: [{
    date: Date,
    status: { type: String, enum: ['available', 'unavailable', 'leave', 'training'], default: 'available' },
    notes: String
  }],
  leaveHistory: [{
    startDate: Date,
    endDate: Date,
    type: { type: String, enum: ['annual', 'sick', 'maternity', 'emergency', 'training'] },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    approvedDate: Date,
    notes: String
  }],

  // Performance Metrics
  performanceMetrics: {
    eventsCompleted: { type: Number, default: 0 },
    reportsSubmitted: { type: Number, default: 0 },
    schoolsVisited: { type: Number, default: 0 },
    averageAttendanceRate: { type: Number, default: 0 },
    averageFeedbackRating: { type: Number, default: 0 },
    lastPerformanceReview: Date
  },

  // Account Management
  invitationToken: String,
  invitationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  accountActivated: { type: Boolean, default: false },
  activationDate: Date,

  // Audit Fields
  lastActive: { type: Date, default: Date.now },
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

staffSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

staffSchema.index({ role: 1 });
staffSchema.index({ status: 1 }); // For active staff queries

module.exports = mongoose.model('Staff', staffSchema);
