/*
 * models/Budget.js
 * Mongoose schema for budget management.
 * Supports per-event and monthly budgets with tracking against actual spending.
 */
const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  // Budget identification
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Budget type and scope
  type: {
    type: String,
    enum: ['event', 'monthly', 'quarterly', 'annual', 'project'],
    required: true
  },
  period: {
    // For type=monthly/quarterly/annual: "2026-05", "Q2-2026", "2026"
    type: String,
    required: true,
    trim: true
  },

  // Associated entities
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // if type=event
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' }, // optional filter
  department: { type: String, trim: true }, // e.g., "Training", "Operations"

  // Budget amounts by category
  categories: [{
    category: {
      type: String,
      enum: [
        'equipment',
        'transport',
        'venue',
        'materials',
        'catering',
        'accommodation',
        'trainer_allowance',
        'marketing',
        'utilities',
        'office',
        'other'
      ]
    },
    allocated: {
      type: Number,
      required: true,
      min: 0
    },
    spent: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: String
  }],

  // Overall totals
  totalAllocated: {
    type: Number,
    required: true,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRemaining: {
    type: Number,
    default: 0,
    min: 0
  },

  // Alert thresholds (percentage)
  alertThresholdPercent: {
    type: Number,
    default: 80,
    min: 0,
    max: 100
  },
  criticalThresholdPercent: {
    type: Number,
    default: 90,
    min: 0,
    max: 100
  },

  // Alerts status
  alertTriggered: {
    type: Boolean,
    default: false
  },
  criticalAlertTriggered: {
    type: Boolean,
    default: false
  },
  lastAlertSentAt: Date,

  // Approval
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  approvedAt: Date,

  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'cancelled'],
    default: 'draft'
  },

  // Notes
  notes: String,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to calculate totals
budgetSchema.pre('save', function(next) {
  this.totalSpent = (this.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0);
  this.totalRemaining = this.totalAllocated - this.totalSpent;

  // Calculate alert percentages
  const spentPercent = this.totalAllocated > 0 ? (this.totalSpent / this.totalAllocated) * 100 : 0;
  this.alertTriggered = spentPercent >= this.alertThresholdPercent;
  this.criticalAlertTriggered = spentPercent >= this.criticalThresholdPercent;

  this.updatedAt = Date.now();
  next();
});

// Indexes
budgetSchema.index({ type: 1, period: 1 });
budgetSchema.index({ eventId: 1 });
budgetSchema.index({ status: 1 });
budgetSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Budget', budgetSchema);
