/*
 * models/Payroll.js
 * Mongoose schema for trainer payroll and allowances.
 * Tracks trainer earnings per period with detailed breakdowns.
 */
const mongoose = require('mongoose');

const payrollItemSchema = new mongoose.Schema({
  // Type of earnings/allowance
  type: {
    type: String,
    enum: [
      'event_rate',
      'daily_rate',
      'transport_allowance',
      'meal_allowance',
      'overnight_allowance',
      'bonus',
      'deduction',
      'commission'
    ],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  // Quantity (days, events, etc.)
  quantity: {
    type: Number,
    default: 1,
    min: 0
  },
  // Rate per unit
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  // Total amount = quantity * rate
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Linked events (for verification)
  eventIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  // Additional notes
  notes: String
});

const payrollSchema = new mongoose.Schema({
  // Payroll identifier
  payrollNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Trainer
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },

  // Pay period
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  paymentDate: Date,

  // Earnings breakdown
  items: [payrollItemSchema],

  // Totals
  grossAmount: {
    type: Number,
    required: true,
    min: 0
  },
  deductions: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Currency
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR', 'GBP']
  },

  // Payment details
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'mpesa', 'cash', 'cheque'],
    default: 'mpesa'
  },
  paymentReference: String, // Transaction ID
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  paidAt: Date,

  // Status
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },

  // Payslip generation
  payslipGenerated: {
    type: Boolean,
    default: false
  },
  payslipUrl: String,

  // Approval workflow
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  approvedAt: Date,

  // Notes
  notes: String,
  rejectionReason: String,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook
payrollSchema.pre('save', function(next) {
  // Recalculate totals
  this.grossAmount = (this.items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  this.netAmount = this.grossAmount - (this.deductions || 0) - (this.taxAmount || 0);
  this.updatedAt = Date.now();
  next();
});

// Indexes
payrollSchema.index({ trainerId: 1, periodStart: -1 });
payrollSchema.index({ status: 1 });
payrollSchema.index({ paymentDate: 1 });
payrollSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);
