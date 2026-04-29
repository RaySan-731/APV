/*
 * models/School.js
 * Mongoose schema representing partner schools and their program enrollments.
 * Tracks school contact info, student count, enrolled programs, partnership status,
 * and comprehensive management data for admin dashboard.
 */
const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Kenya'
    }
  },
  // Geographic zone/region for reporting
  zone: {
    type: String,
    trim: true
  },
  region: {
    type: String,
    trim: true
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
    position: String
  },
  studentCount: {
    type: Number,
    default: 0
  },
  programsEnrolled: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program'
  }],
  // Service package tier
  servicePackage: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'custom'],
    default: 'standard'
  },
  // Payment terms configuration
  paymentTerms: {
    method: { type: String, enum: ['bank_transfer', 'mpesa', ' cheque', 'cash'], default: 'bank_transfer' },
    billingCycle: { type: String, enum: ['monthly', 'quarterly', 'per_event', 'annual'], default: 'per_event' },
    currency: { type: String, default: 'KES' },
    ratePerStudent: Number,
    notes: String
  },
  partnershipDate: {
    type: Date,
    default: Date.now
  },
  onboardingDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  serviceStatus: {
    type: String,
    enum: ['active', 'on_hold', 'churned'],
    default: 'active'
  },
  assignedStaff: [{
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    assignmentType: { type: String, enum: ['primary', 'secondary', 'consultant'], default: 'primary' },
    assignedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'transferred', 'completed'], default: 'active' }
  }],
  // Scout groups (will be migrated to separate ScoutGroup model)
  scoutGroups: [{
    name: String,
    leader: String,
    size: Number,
    patrol: String,
    advancementLevel: String,
    notes: String
  }],
  // Participation tracking
  participationMetrics: {
    totalEventsAttended: { type: Number, default: 0 },
    lastEventDate: Date,
    averageAttendanceRate: { type: Number, default: 0, min: 0, max: 100 },
    engagementScore: { type: Number, default: 0, min: 0, max: 100 }
  },
  // Notes and documentation
  notes: String,
  visitNotes: [{
    date: Date,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    content: String
  }],
  // Document storage references
  documents: [{
    type: { type: String, enum: ['contract', 'insurance', 'permission_slip', 'payment_receipt', 'other'] },
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
  }],
  // Payment history (light references; full details in Payment model)
  paymentHistory: [{
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    date: Date,
    amount: Number,
    status: String,
    method: String
  }],
  // Key dates for monitoring
  lastVisitDate: Date,
  lastContactDate: Date,
  nextScheduledVisit: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
schoolSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for query performance
schoolSchema.index({ name: 1 });
schoolSchema.index({ 'address.city': 1 });
schoolSchema.index({ zone: 1 });
schoolSchema.index({ region: 1 });
schoolSchema.index({ status: 1 });
schoolSchema.index({ serviceStatus: 1 });
schoolSchema.index({ 'assignedStaff.staffId': 1 });
schoolSchema.index({ createdAt: -1 });

module.exports = mongoose.model('School', schoolSchema);     