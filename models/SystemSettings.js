/*
 * SystemSettings model
 * Stores organization profile, system-wide defaults, and backup configuration
 */

const mongoose = require('mongoose');

const publicHolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  name: { type: String, required: true },
  year: { type: Number, required: true },
  isRecurring: { type: Boolean, default: true } // for annual holidays
});

const backupConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  frequency: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly'], 
    default: 'daily' 
  },
  time: { type: String, default: '02:00' }, // HH:mm format
  retentionDays: { type: Number, default: 30 },
  cloudProvider: { 
    type: String, 
    enum: ['local', 's3', 'azure', 'gcp'], 
    default: 'local' 
  },
  lastBackupAt: { type: Date },
  nextScheduledAt: { type: Date },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'error'], 
    default: 'active' 
  }
});

const organizationSettingsSchema = new mongoose.Schema({
  // Organization Profile
  organizationName: { type: String, default: 'Arrow-Park Ventures' },
  tagline: { type: String, default: '' },
  logoUrl: { type: String, default: '/images/logo.png' },
  logoWidth: { type: Number, default: 40 },
  primaryColor: { type: String, default: '#0066cc' },
  
  // Contact Details
  contactEmail: { type: String },
  contactPhone: { type: String },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String, default: 'Kenya' }
  },
  
  // Regional Settings
  timezone: { type: String, default: 'Africa/Nairobi' },
  dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD/MM/YYYY' },
  currency: { type: String, default: 'KES' },
  fiscalYearStart: { type: String, default: '01-01' }, // MM-DD format
  
  // Email Branding
  emailFooter: { type: String, default: '' },
  emailHeader: { type: String, default: '' }
});

const systemDefaultsSchema = new mongoose.Schema({
  // Report Settings
  reportSubmissionDeadlineDays: { type: Number, default: 3 }, // days after event completion
  
  // Payment Settings
  paymentTermsDays: { type: Number, default: 30 }, // net 30
  overdueThresholdDays: { type: Number, default: 7 }, // mark overdue after 7 days
  latePaymentPenaltyPercent: { type: Number, default: 0 },
  
  // Event Settings
  eventReminderDays: { type: Number, default: 2 }, // remind trainers 2 days before
  autoArchiveMonths: { type: Number, default: 12 }, // archive events older than X months
  
  // Working Calendar
  workingDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  workingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '17:00' }
  },
  
  // Custom Fields
  customFields: {
    schools: mongoose.Schema.Types.Mixed,
    events: mongoose.Schema.Types.Mixed,
    staff: mongoose.Schema.Types.Mixed
  }
});

const systemSettingsSchema = new mongoose.Schema({
  // Single document to store all settings
  type: { 
    type: String, 
    enum: ['organization', 'system', 'backup', 'combined'], 
    default: 'combined' 
  },
  _id: { type: String, default: 'global-settings' }, // Force single document
  
  organization: organizationSettingsSchema,
  system: systemDefaultsSchema,
  backup: backupConfigSchema,
  publicHolidays: [publicHolidaySchema],
  
  // Audit
  lastModifiedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  lastModifiedAt: { type: Date, default: Date.now }
});

// Prevent delete
systemSettingsSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Global settings cannot be deleted'));
});

// Index for fast retrieval
systemSettingsSchema.index({ _id: 1 });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);