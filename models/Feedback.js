/*
 * models/Feedback.js
 * Mongoose schema for trainer feedback on schools.
 */
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
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
  engagementLevel: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true
  },
  concerns: String,
  suggestions: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Feedback', feedbackSchema);