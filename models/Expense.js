/*
 * models/Expense.js
 * Mongoose schema for tracking operational expenses.
 * Supports per-event expenses, general operational costs, with receipt attachments.
 */
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Expense identification
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  // Category
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
    ],
    required: true
  },

  // Amount and currency
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR', 'GBP']
  },

  // Tax and adjustments
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Association
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }, // Who incurred this expense

  // Payment details
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mpesa', 'credit_card', 'petty_cash', 'other'],
    required: true
  },
  paymentReference: String, // Transaction ID/receipt number
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }, // Who made the payment
  paidDate: Date,

  // Receipt/Proof attachment
  receiptUrl: String,
  receiptFileName: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  uploadedAt: Date,

  // Reimbursement tracking
  isReimbursement: {
    type: Boolean,
    default: false
  },
  reimbursedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  reimbursedAt: Date,
  reimbursementStatus: {
    type: String,
    enum: ['pending', 'approved', 'reimbursed', 'rejected'],
    default: 'pending'
  },

  // Budget linkage
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget' },

  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid', 'archived'],
    default: 'pending'
  },

  // Approvals
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  approvedAt: Date,
  approvedAmount: Number, // May differ from claimed amount after review

  // Notes
  notes: String,
  rejectionReason: String,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook
expenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Calculate net amount if not set
  if (this.netAmount === undefined) {
    this.netAmount = this.amount - (this.discount || 0);
  }
  next();
});

// Indexes
expenseSchema.index({ eventId: 1 });
expenseSchema.index({ schoolId: 1 });
expenseSchema.index({ staffId: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ paidDate: -1 });
expenseSchema.index({ createdAt: -1 });
expenseSchema.index({ 'budgetId': 1 });

module.exports = mongoose.model('Expense', expenseSchema);
