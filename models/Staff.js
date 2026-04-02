/*
 * models/Staff.js
 * Mongoose schema for APV staff members.
 */
const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  idNumber: { type: String, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  role: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Active', 'On Leave', 'Inactive'], default: 'Active' },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

staffSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

staffSchema.index({ role: 1 });

module.exports = mongoose.model('Staff', staffSchema);
