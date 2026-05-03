/*
 * models/Event.js
 * Mongoose schema for APV events with comprehensive event management.
 * Supports multiple event types, trainer assignments, school invitations, RSVP tracking.
 */
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  eventType: {
    type: String,
    enum: ['camp', 'hike', 'team_building', 'training_session', 'inter_school_competition', 'other'],
    required: true
  },
  agenda: {
    type: String,
    trim: true
  },

  // Schedule
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  defaultInvitationDeadline: Date, // Default deadline for invitations

  // Location & Region
  location: {
    name: { type: String, required: true, trim: true },
    address: String,
    city: String,
    region: String,
    country: { type: String, default: 'Kenya' },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  region: {
    type: String,
    trim: true
  },

   // Target Audience & Invitations
   targetSchools: [{
     schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
     invitedAt: { type: Date, default: Date.now },
     invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
     invitationMethod: {
       type: String,
       enum: ['email', 'phone', 'in_person', 'other'],
       default: 'email'
     },
     customMessage: String,
     rsvpStatus: {
       type: String,
       enum: ['invited', 'confirmed', 'declined', 'pending', 'no_response'],
       default: 'invited'
     },
     rsvpResponseDate: Date,
     rsvpResponseBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
     rsvpDeadline: { type: Date, required: true },

     // Attendance tracking (post-event)
     attendance: {
       registered: { type: Number, min: 0, default: 0 },
       attended: { type: Number, min: 0, default: 0 },
       percentage: { type: Number, min: 0, max: 100, default: 0 },
       recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
       recordedAt: Date,
       notes: String
     },

     participantDetails: [{
       name: String,
       age: Number,
       gender: String,
       dietaryRestrictions: String,
       medicalConditions: String
     }],
     remindersSent: [{
       sentAt: Date,
       method: String,
       successful: Boolean,
       template: String
     }],
     lastReminderAt: Date,
     notes: String
   }],
  estimatedScoutCount: {
    type: Number,
    min: 0,
    default: 0
  },

  // Requirements
  requiredEquipment: [{
    item: { type: String, required: true },
    quantity: { type: Number, min: 1, default: 1 },
    providedBy: { type: String, enum: ['APV', 'School', 'Participant'], default: 'APV' },
    notes: String
  }],
  prerequisites: [{
    description: String,
    mandatory: { type: Boolean, default: true }
  }],

  // Trainer Assignments
  trainers: [{
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    role: {
      type: String,
      enum: ['lead_trainer', 'assistant_trainer', 'coordinator', 'volunteer'],
      default: 'assistant_trainer'
    },
    assignedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['assigned', 'confirmed', 'declined', 'removed'],
      default: 'assigned'
    },
    notes: String
  }],

  // Capacity & Registration
  maxParticipants: {
    type: Number,
    min: 1,
    required: true
  },
  currentParticipants: {
    type: Number,
    default: 0,
    min: 0
  },
  waitlistEnabled: { type: Boolean, default: false },
  registrationDeadline: Date,

  // Financial
  budget: {
    total: { type: Number, min: 0, default: 0 },
    breakdown: mongoose.Schema.Types.Mixed
  },
  costPerParticipant: { type: Number, min: 0, default: 0 },

  // Status & Publishing
  status: {
    type: String,
    enum: ['draft', 'published', 'scheduled', 'confirmed', 'in_progress', 'completed', 'reviewed', 'cancelled', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invited_only'],
    default: 'private'
  },
  publishedAt: Date,
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

  // Post-Event Review & Sign-off
  review: {
    // Trainer's post-event report
    trainerReport: String,
    reportSubmittedAt: Date,
    reportSubmittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

    // Attendance verification
    actualAttendeeCount: { type: Number, min: 0 },
    attendanceVerified: { type: Boolean, default: false },
    attendanceVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    attendanceVerifiedAt: Date,

    // Admin review & approval
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'needs_revision', 'rejected'],
      default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    reviewedAt: Date,
    reviewNotes: String,

    // Event closure
    closureStatus: {
      type: String,
      enum: ['open', 'closed', 'reopened'],
      default: 'open'
    },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
  },

  // Conflict Detection Flags (set by system)
  conflicts: [{
    type: {
      type: String,
      enum: ['trainer_double_book', 'school_overlap', 'resource_constraint', 'other'],
      required: true
    },
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    detectedAt: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    resolvedAt: Date,
    resolutionNotes: String
  }],

  // Notifications
  reminderSchedule: [{
    daysBefore: { type: Number, min: 0 },
    sentAt: Date,
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }]
  }],

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for optimization
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ region: 1 });
eventSchema.index({ 'trainers.trainerId': 1 });
eventSchema.index({ 'targetSchools.schoolId': 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ 'review.reviewStatus': 1 });
eventSchema.index({ 'review.closureStatus': 1 });
eventSchema.index({ 'review.reportSubmittedAt': 1 }); // For report submission rate queries
eventSchema.index({ 'trainers.trainerId': 1, startDate: 1, endDate: 1 }, { name: 'idx_trainer_availability' });
eventSchema.index({ 'targetSchools.schoolId': 1, startDate: 1, endDate: 1 }, { name: 'idx_school_conflicts' });

eventSchema.pre('save', function(next) {
  // Always update the updatedAt timestamp
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Event', eventSchema);
