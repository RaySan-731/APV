/*
 * models/ServicePackage.js
 * Mongoose schema for service packages/pricing tiers for schools.
 * Defines pricing structures for different service levels.
 */
const mongoose = require('mongoose');

const servicePackageSchema = new mongoose.Schema({
  // Package identification
  name: {
    type: String,
    required: true,
    trim: true,
    enum: ['basic', 'standard', 'premium', 'custom'],
    unique: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Pricing configuration
  pricingModel: {
    type: String,
    enum: ['per_student', 'per_event', 'monthly_retainer', 'quarterly', 'annual'],
    default: 'per_student'
  },
  ratePerStudent: {
    type: Number,
    min: 0,
    default: 0
  },
  monthlyRetainer: {
    type: Number,
    min: 0,
    default: 0
  },
  perEventFee: {
    type: Number,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR', 'GBP']
  },

  // Features included
  features: [{
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    included: { type: Boolean, default: true }
  }],

  // Billing cycle default
  defaultBillingCycle: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'per_event', 'annual'],
    default: 'weekly'
  },

  // Invoice settings
  invoicePrefix: {
    type: String,
    trim: true,
    default: 'INV'
  },
  paymentTermsDays: {
    type: Number,
    default: 30,
    min: 0
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook
servicePackageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
servicePackageSchema.index({ name: 1 });
servicePackageSchema.index({ isActive: 1 });

module.exports = mongoose.model('ServicePackage', servicePackageSchema);
