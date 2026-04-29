/*
 * models/VisitLog.js
 * Mongoose schema for logging trainer visits to schools.
 */
const mongoose = require('mongoose');

const visitLogSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  purpose: {
    type: String,
    required: true
  },
  metWith: String,
  discussed: String,
  actionItems: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VisitLog', visitLogSchema);