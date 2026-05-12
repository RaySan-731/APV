/*
 * models/Student.js
 * Mongoose schema for student records captured by trainers.
 * Links to schools, tracks scout section progression, and stores parent contact info.
 */

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  // Personal Information
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  age: {
    type: Number,
    min: 0
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },

  // Parent/Guardian Contact
  parentContact: {
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      enum: ['Parent', 'Guardian', 'Sibling', 'Other'],
      default: 'Parent'
    }
  },

  // School Association
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },

  // Scout Section
  scoutSection: {
    type: String,
    enum: ['Sungura', 'Chipukizi', 'Mwamba', 'Rover'],
    required: true
  },
  sectionJoinDate: {
    type: Date,
    default: Date.now
  },
  sectionHistory: [{
    section: {
      type: String,
      enum: ['Sungura', 'Chipukizi', 'Mwamba', 'Rover']
    },
    startDate: Date,
    endDate: Date,
    notes: String
  }],

  // Participation tracking (light references)
  participationRecords: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    attended: Boolean,
    attendanceDate: Date,
    notes: String
  }],

   // Trainer who added this student
   addedBy: {
     trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
     addedDate: {
       type: Date,
       default: Date.now
     }
   },

   // Currently assigned trainer (responsible for this student)
   assignedTrainer: {
     type: mongoose.Schema.Types.ObjectId,
     ref: 'Staff'
   },

   // Additional notes
   medicalNotes: String,
   specialNeeds: String,
   notes: String,
   // Advancement tracking
   advancementNotes: String,
   // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'graduated', 'transferred'],
    default: 'active'
  },

  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to calculate age from DOB
studentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Calculate age if DOB is present
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    this.age = age;
  }

  next();
});

// Pre-save hook: capture old school for count adjustment
studentSchema.pre('save', async function(next) {
  if (this.isModified('school') && !this.isNew) {
    const old = await this.constructor.findById(this._id).select('school');
    this._oldSchool = old ? old.school : null;
  }
  next();
});

// Automatic section history entry when section changes
studentSchema.pre('save', async function(next) {
  if (this.isModified('scoutSection') && !this.isNew) {
    const oldStudent = await this.constructor.findById(this._id);
    if (oldStudent && oldStudent.scoutSection !== this.scoutSection) {
      // Close previous section record
      const historyEntry = {
        section: oldStudent.scoutSection,
        startDate: oldStudent.sectionJoinDate,
        endDate: new Date(),
        notes: `Advanced to ${this.scoutSection}`
      };
      this.sectionHistory.push(historyEntry);
      this.sectionJoinDate = new Date();
    }
  }
  next();
});

// After save (both create and update) – sync school.studentCount
studentSchema.post('save', async function(doc) {
  try {
    const School = require('./School');
    
    // Update new school count (only active students)
    const newSchoolId = doc.school;
    if (newSchoolId) {
      const newCount = await doc.constructor.countDocuments({ 
        school: newSchoolId, 
        status: 'active' 
      });
      await School.findByIdAndUpdate(newSchoolId, { $set: { studentCount: newCount } });
    }
    
    // If school changed, also decrement old school count
    if (doc._oldSchool && !doc._oldSchool.equals(doc.school)) {
      const oldCount = await doc.constructor.countDocuments({ 
        school: doc._oldSchool, 
        status: 'active' 
      });
      await School.findByIdAndUpdate(doc._oldSchool, { $set: { studentCount: oldCount } });
    }
  } catch (err) {
    console.error('Error updating school student count (post-save):', err);
  }
});

// Before delete – capture school for count adjustment
studentSchema.pre('remove', async function(next) {
  this._schoolForDeletion = this.school;
  next();
});

// After delete – decrement school.studentCount
studentSchema.post('remove', async function(doc) {
  try {
    const School = require('./School');
    const schoolId = doc._schoolForDeletion;
    if (!schoolId) return;

    const count = await doc.constructor.countDocuments({ 
      school: schoolId, 
      status: 'active' 
    });
    await School.findByIdAndUpdate(schoolId, { $set: { studentCount: count } });
  } catch (err) {
    console.error('Error updating school student count (post-remove):', err);
  }
});

// Indexes for query performance
studentSchema.index({ fullName: 1 });
studentSchema.index({ school: 1 });
studentSchema.index({ scoutSection: 1 });
studentSchema.index({ 'addedBy.trainerId': 1 });
studentSchema.index({ assignedTrainer: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Student', studentSchema);
