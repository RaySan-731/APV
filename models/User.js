/*
 * models/User.js
 * Mongoose schema for application users.
 * Fields include email, hashed password, display name, role, activity flags and timestamps.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  idNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['founder', 'commissioner', 'training_officer', 'medical', 'rover'],
    default: 'rover'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
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
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);