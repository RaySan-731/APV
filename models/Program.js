/*
 * models/Program.js
 * Mongoose schema defining the available programs offered by APV.
 * Includes metadata like category, age groups, duration, pricing and instructors.
 */
const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['leadership', 'outdoor', 'team-building', 'first-aid', 'environmental', 'community-service'],
    required: true
  },
  ageGroup: {
    min: {
      type: Number,
      required: true,
      min: 5
    },
    max: {
      type: Number,
      required: true,
      max: 18
    }
  },
  duration: {
    type: String,
    enum: ['half-day', 'full-day', 'weekend', 'week', 'month'],
    required: true
  },
  maxParticipants: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  prerequisites: [String],
  learningObjectives: [String],
  materials: [String],
  instructors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
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

// Update the updatedAt field before saving
programSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for formatted price
programSchema.virtual('formattedPrice').get(function() {
  return `$${this.price.amount} ${this.price.currency}`;
});

// Index for faster queries
programSchema.index({ category: 1 });
programSchema.index({ status: 1 });
programSchema.index({ 'ageGroup.min': 1, 'ageGroup.max': 1 });

module.exports = mongoose.model('Program', programSchema);