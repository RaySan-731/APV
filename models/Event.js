/*
 * models/Event.js
 * Mongoose schema for APV events.
 */
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  location: { type: String, required: true, trim: true },
  team: { type: String, trim: true },
  registeredCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['Planning', 'Confirmed', 'Completed', 'Cancelled'], default: 'Planning' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', eventSchema);
