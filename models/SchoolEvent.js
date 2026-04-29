/*
 * models/SchoolEvent.js
 * Tracks school participation and attendance at specific events.
 * Allows monitoring of engagement trends per school.
 */
const mongoose = require('mongoose');

const schoolEventSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  // Participation details
  participantsCount: {
    type: Number,
    required: true,
    min: 0
  },
  primaryContact: {
    name: String,
    phone: String
  },
  // Attendance record
  attendance: {
    registered: { type: Number, default: 0 },
    attended: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  },
  // Associated staff/trainers
  assignedStaff: [{
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    role: String
  }],
  // Any notes about this school's participation
  notes: String,
  status: {
    type: String,
    enum: ['registered', 'attended', 'cancelled', 'no_show'],
    default: 'registered'
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

// Pre-save hook
schoolEventSchema.pre('save', function(next) {
  if (this.attendance.registered > 0) {
    this.attendance.percentage = Math.round((this.attendance.attended / this.attendance.registered) * 100);
  }
  this.updatedAt = Date.now();
  next();
});

// Indexes
schoolEventSchema.index({ schoolId: 1, eventId: 1 }, { unique: true });
schoolEventSchema.index({ eventId: 1 });
schoolEventSchema.index({ status: 1 });

module.exports = mongoose.model('SchoolEvent', schoolEventSchema);
