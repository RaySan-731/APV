/*
 * models/SchoolDocument.js
 * Tracks document uploads for schools (contracts, insurance, permission slips, etc).
 */
const mongoose = require('mongoose');

const schoolDocumentSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  documentType: {
    type: String,
    enum: ['contract', 'insurance', 'permission_slip', 'payment_receipt', 'visit_report', 'certificate', 'other'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  // URL to stored file (local or S3)
  url: {
    type: String,
    required: true
  },
  // File metadata
  fileSize: Number,
  mimeType: String,
  // Versions for versioning
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    url: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
  }],
  // Who uploaded and when
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  // Expiry tracking for time-sensitive docs
  expiryDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  // Audit
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook
schoolDocumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
schoolDocumentSchema.index({ schoolId: 1, documentType: 1 });
schoolDocumentSchema.index({ uploadedBy: 1 });
schoolDocumentSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('SchoolDocument', schoolDocumentSchema);
