/*
 * models/Payment.js
 * Mongoose schema for tracking payment history per school.
 * Supports billing, financial reporting, and audit trail.
 */
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  // Payment identifier
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
    required: true
  },
  dueDate: Date,
  paidDate: Date,
  method: {
    type: String,
    enum: ['bank_transfer', 'mpesa', 'cheque', 'cash', 'credit_card', 'other'],
    default: 'bank_transfer'
  },
  reference: String, // Transaction reference from bank/mpesa
  // Associated program or event
  programBooked: {
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    programName: String
  },
  eventBooked: {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    eventName: String
  },
  // Payment status and tracking
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending'
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  // Notes and attachments
  notes: String,
  receiptUrl: String,
  // Who recorded this payment
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to calculate balance
paymentSchema.pre('save', function(next) {
  this.balance = this.amount - (this.amountPaid || 0);
  this.updatedAt = Date.now();
  next();
});

  // Indexes for querying
  paymentSchema.index({ schoolId: 1, paymentDate: -1 });
  paymentSchema.index({ status: 1 });
  paymentSchema.index({ dueDate: 1 });
  // Note: invoiceNumber already indexed by unique:true constraint (line 18)

  module.exports = mongoose.model('Payment', paymentSchema);
