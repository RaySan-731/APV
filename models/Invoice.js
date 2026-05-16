/*
 * models/Invoice.js
 * Mongoose schema for school invoices with itemized line items.
 * Supports auto-generation from events, service packages, and monthly retainers.
 */
const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  // Item description
  description: {
    type: String,
    required: true,
    trim: true
  },
  // Quantity
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  },
  // Unit price
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // Total for this line (quantity * unitPrice)
  total: {
    type: Number,
    required: true,
    min: 0
  },
  // Optional reference to event or service package
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  servicePackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePackage' },
  // Additional notes
  notes: String,
  // Tax information
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  taxAmount: { type: Number, default: 0, min: 0 }
});

const invoiceSchema = new mongoose.Schema({
  // Invoice number (auto-generated, unique)
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // School/Billing party
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },

  // Invoice dates
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: Date,

  // Line items
  items: [invoiceItemSchema],

  // Totals
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
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

  // Invoice type/source
  invoiceType: {
    type: String,
    enum: ['event', 'monthly_retainer', 'service_package', 'custom'],
    required: true
  },

  // References (optional linkage)
  relatedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  servicePackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePackage' },

  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'issued', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },

  // Payment method preferred
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'mpesa', 'cheque', 'cash', 'other'],
    default: 'bank_transfer'
  },

  // APV Bank details (for payment instructions)
  bankDetails: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    branch: { type: String, default: '' },
    swiftCode: { type: String, default: '' },
    mpesaTillNumber: { type: String, default: '' }
  },

  // Customer billing address
  billingAddress: {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, default: 'Kenya' },
    taxId: { type: String, trim: true }
  },

  // Notes and terms
  notes: String,
  terms: String,

  // Payment history
  payments: [{
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    amount: Number,
    paidDate: Date,
    method: String,
    reference: String,
    notes: String
  }],

  // Who created/issued this invoice
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  sentAt: Date,

  // Reminders
  remindersSent: [{
    sentAt: Date,
    method: String,
    successful: Boolean
  }],
  lastReminderAt: Date,

  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to calculate balance
invoiceSchema.pre('save', function(next) {
  this.balance = this.totalAmount - (this.amountPaid || 0);
  this.updatedAt = Date.now();

  // Auto-update status based on balance
  if (this.status !== 'cancelled' && this.status !== 'refunded') {
    if (this.balance <= 0) {
      this.status = 'paid';
      this.paidDate = this.paidDate || new Date();
    } else if (this.amountPaid > 0) {
      this.status = 'partial';
    }
  }

  next();
});

// Indexes
invoiceSchema.index({ schoolId: 1, issueDate: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ 'issuedBy': 1 });
invoiceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
