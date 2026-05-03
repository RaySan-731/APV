/*
 * models/ReportTemplate.js
 * Mongoose schema for storing custom report templates
 */

const mongoose = require('mongoose');

const reportTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  config: {
    dimensions: [String], // e.g., ['eventType', 'region', 'startDate']
    metrics: [String],    // e.g., ['totalEvents', 'totalScouts', 'avgAttendance']
    filters: {
      dateRange: String, // '30d', '90d', '1y'
      eventTypes: [String],
      regions: [String],
      statuses: [String]
    },
    groupBy: String, // optional grouping field
    sortBy: { type: String, default: '_id' },
    sortOrder: { type: String, enum: ['asc', 'desc'], default: 'asc' }
  },
  isShared: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: Date
});

module.exports = mongoose.model('ReportTemplate', reportTemplateSchema);
