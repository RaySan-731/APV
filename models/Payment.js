/*
 * models/Payment.js
 * Mongoose schema for tracking payment history per school.
 * Supports billing, financial reporting, and audit trail.
 */
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment type (invoice payment, trainer payroll, expense, other)
  paymentType: {
    type: String,
    enum: ['invoice', 'trainer_payroll', 'expense', 'other'],
    required: true,
    default: 'invoice'
  },

  // For invoice payments
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  invoiceNumber: String, // Denormalized for quick lookup

  // School/Billing party (for invoice payments)
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School'
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

  // Payment details
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: Date,
  paidDate: Date,
  method: {
    type: String,
    enum: ['bank_transfer', 'mpesa', 'cheque', 'cash', 'credit_card', 'other'],
    default: 'bank_transfer'
  },
  reference: String, // Transaction reference from bank/mpesa
  receiptUrl: String,
  receiptFileName: String,

  // For payroll payments
  payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

  // For expense payments
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },

  // Status and tracking
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Notes
  notes: String,

  // Who recorded this payment
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },

  // Audit
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
paymentSchema.index({ schoolId: 1, paymentDate: -1 });
paymentSchema.index({ paymentType: 1, status: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ paidDate: 1 });
paymentSchema.index({ invoiceNumber: 1 });
paymentSchema.index({ trainerId: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
