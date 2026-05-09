/*
 * backend/controllers/settingsController.js
 * Controller for System Settings & Configuration
 */

const SystemSettings = require('../../models/SystemSettings');
const emailService = require('../../backend/services/emailService');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * GET System Settings (all or by section)
 */
exports.getSettings = async (req, res) => {
  try {
    const { section } = req.query; // 'organization', 'system', 'backup', or all
    
    let settings = await SystemSettings.findOne({ _id: 'global-settings' });
    
    // Initialize if doesn't exist
    if (!settings) {
      settings = await SystemSettings.create({
        _id: 'global-settings',
        type: 'combined'
      });
    }
    
    if (section === 'organization') {
      return res.json({ success: true, settings: settings.organization });
    } else if (section === 'system') {
      return res.json({ success: true, settings: settings.system });
    } else if (section === 'backup') {
      return res.json({ success: true, settings: settings.backup });
    } else {
      // Return combined settings (omit audit fields)
      const safeSettings = settings.toObject ? settings.toObject() : settings;
      delete safeSettings.__v;
      return res.json({ success: true, settings: safeSettings });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

/**
 * POST Update Organization Profile
 */
exports.updateOrganizationProfile = async (req, res) => {
  try {
    const {
      organizationName,
      tagline,
      logoUrl,
      logoWidth,
      primaryColor,
      contactEmail,
      contactPhone,
      address,
      timezone,
      dateFormat,
      currency,
      fiscalYearStart,
      emailFooter,
      emailHeader
    } = req.body;

    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    if (!settings) {
      settings._id = 'global-settings';
      settings.type = 'combined';
    }

    // Update organization fields
    const orgUpdates = {};
    if (organizationName !== undefined) orgUpdates.organizationName = organizationName;
    if (tagline !== undefined) orgUpdates.tagline = tagline;
    if (logoUrl !== undefined) orgUpdates.logoUrl = logoUrl;
    if (logoWidth !== undefined) orgUpdates.logoWidth = logoWidth;
    if (primaryColor !== undefined) orgUpdates.primaryColor = primaryColor;
    if (contactEmail !== undefined) orgUpdates.contactEmail = contactEmail;
    if (contactPhone !== undefined) orgUpdates.contactPhone = contactPhone;
    if (address !== undefined) {
      orgUpdates.address = { ...(settings.organization.address || {}), ...address };
    }
    if (timezone !== undefined) orgUpdates.timezone = timezone;
    if (dateFormat !== undefined) orgUpdates.dateFormat = dateFormat;
    if (currency !== undefined) orgUpdates.currency = currency;
    if (fiscalYearStart !== undefined) orgUpdates.fiscalYearStart = fiscalYearStart;
    if (emailFooter !== undefined) orgUpdates.emailFooter = emailFooter;
    if (emailHeader !== undefined) orgUpdates.emailHeader = emailHeader;

    settings.organization = { ...settings.organization, ...orgUpdates };
    settings.lastModifiedBy = req.session.user._id || req.session.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({ 
      success: true, 
      settings: settings.organization,
      message: 'Organization profile updated successfully' 
    });
  } catch (error) {
    console.error('Error updating organization profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update organization profile' });
  }
};

/**
 * POST Update System Defaults
 */
exports.updateSystemDefaults = async (req, res) => {
  try {
    const {
      reportSubmissionDeadlineDays,
      paymentTermsDays,
      overdueThresholdDays,
      latePaymentPenaltyPercent,
      eventReminderDays,
      autoArchiveMonths,
      workingDays,
      workingHours,
      customFields
    } = req.body;

    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    if (!settings) {
      settings._id = 'global-settings';
      settings.type = 'combined';
    }

    const systemUpdates = {};
    if (reportSubmissionDeadlineDays !== undefined) systemUpdates.reportSubmissionDeadlineDays = reportSubmissionDeadlineDays;
    if (paymentTermsDays !== undefined) systemUpdates.paymentTermsDays = paymentTermsDays;
    if (overdueThresholdDays !== undefined) systemUpdates.overdueThresholdDays = overdueThresholdDays;
    if (latePaymentPenaltyPercent !== undefined) systemUpdates.latePaymentPenaltyPercent = latePaymentPenaltyPercent;
    if (eventReminderDays !== undefined) systemUpdates.eventReminderDays = eventReminderDays;
    if (autoArchiveMonths !== undefined) systemUpdates.autoArchiveMonths = autoArchiveMonths;
    if (workingDays !== undefined) systemUpdates.workingDays = workingDays;
    if (workingHours !== undefined) systemUpdates.workingHours = { ...settings.system.workingHours, ...workingHours };
    if (customFields !== undefined) systemUpdates.customFields = { ...settings.system.customFields, ...customFields };

    settings.system = { ...settings.system, ...systemUpdates };
    settings.lastModifiedBy = req.session.user._id || req.session.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({ 
      success: true, 
      settings: settings.system,
      message: 'System defaults updated successfully' 
    });
  } catch (error) {
    console.error('Error updating system defaults:', error);
    res.status(500).json({ success: false, error: 'Failed to update system defaults' });
  }
};

/**
 * POST Update Backup Configuration
 */
exports.updateBackupConfig = async (req, res) => {
  try {
    const { enabled, frequency, time, retentionDays, cloudProvider } = req.body;

    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    if (!settings) {
      settings._id = 'global-settings';
      settings.type = 'combined';
    }

    const backupUpdates = {};
    if (enabled !== undefined) backupUpdates.enabled = enabled;
    if (frequency !== undefined) backupUpdates.frequency = frequency;
    if (time !== undefined) backupUpdates.time = time;
    if (retentionDays !== undefined) backupUpdates.retentionDays = retentionDays;
    if (cloudProvider !== undefined) backupUpdates.cloudProvider = cloudProvider;

    settings.backup = { ...settings.backup, ...backupUpdates };
    settings.backup.status = settings.backup.enabled ? 'active' : 'paused';
    
    // Recalculate next scheduled backup time
    if (settings.backup.enabled && frequency) {
      const now = new Date();
      const nextDate = new Date();
      if (frequency === 'daily') {
        nextDate.setDate(now.getDate() + 1);
      } else if (frequency === 'weekly') {
        nextDate.setDate(now.getDate() + 7);
      } else if (frequency === 'monthly') {
        nextDate.setMonth(now.getMonth() + 1);
        nextDate.setDate(1);
      }
      const [hours, minutes] = time.split(':');
      nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      settings.backup.nextScheduledAt = nextDate;
    }

    settings.lastModifiedBy = req.session.user._id || req.session.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({ 
      success: true, 
      settings: settings.backup,
      message: 'Backup configuration updated successfully' 
    });
  } catch (error) {
    console.error('Error updating backup config:', error);
    res.status(500).json({ success: false, error: 'Failed to update backup configuration' });
  }
};

/**
 * POST Trigger Manual Backup
 */
exports.triggerBackup = async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    const backupFile = path.join(backupDir, `apv_backup_${timestamp}.json`);
    
    // Run mongodump command to create a compressed archive
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apv_scoutmate';
    
    exec(`mongodump --uri="${mongoURI}" --gzip --archive="${backupFile}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup failed:', error);
        return res.status(500).json({ success: false, error: 'Backup failed: ' + error.message });
      }
      
      // Update settings
      SystemSettings.findOneAndUpdate(
        { _id: 'global-settings' },
        {
          'backup.lastBackupAt': new Date(),
          'backup.status': 'active',
          'lastModifiedAt': new Date()
        },
        { new: true }
      ).exec();

      res.json({ 
        success: true, 
        message: 'Backup completed successfully',
        backupFile: backupFile,
        timestamp: new Date()
      });
    });

  } catch (error) {
    console.error('Error triggering backup:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger backup' });
  }
};

/**
 * GET Backup History
 */
exports.getBackupHistory = async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../../backups');
    let backups = [];
    
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      backups = files
        .filter(f => f.startsWith('apv_backup_') && f.endsWith('.json.gz'))
        .map(f => {
          const filePath = path.join(backupDir, f);
          const stats = fs.statSync(filePath);
          const dateStr = f.replace('apv_backup_', '').replace('.json.gz', '');
          return {
            filename: f,
            date: new Date(dateStr.replace(/-/g, 'T').replace(/-/g, ':')),
            size: stats.size,
            path: filePath
          };
        })
        .sort((a, b) => b.date - a.date);
    }

    res.json({ success: true, backups });
  } catch (error) {
    console.error('Error fetching backup history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch backup history' });
  }
};

/**
 * POST Download Backup
 */
exports.downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const backupDir = path.join(__dirname, '../../backups');
    const filePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }
    
    res.download(filePath, filename);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ success: false, error: 'Failed to download backup' });
  }
};

/**
 * POST Delete Backup
 */
exports.deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const backupDir = path.join(__dirname, '../../backups');
    const filePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ success: false, error: 'Failed to delete backup' });
  }
};

/**
 * POST Save Public Holiday
 */
exports.savePublicHoliday = async (req, res) => {
  try {
    const { date, name, isRecurring } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ success: false, error: 'Date and name are required' });
    }

    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    if (!settings) {
      settings._id = 'global-settings';
      settings.type = 'combined';
      settings.publicHolidays = [];
    }

    // Parse date
    const holidayDate = new Date(date);
    
    // Check if holiday already exists
    const existingIdx = settings.publicHolidays.findIndex(h => 
      h.date.toDateString() === holidayDate.toDateString()
    );
    
    if (existingIdx > -1) {
      // Update existing
      settings.publicHolidays[existingIdx] = {
        ...settings.publicHolidays[existingIdx],
        date: holidayDate,
        name: name.trim(),
        year: holidayDate.getFullYear(),
        isRecurring: isRecurring !== false
      };
    } else {
      // Add new
      settings.publicHolidays.push({
        date: holidayDate,
        name: name.trim(),
        year: holidayDate.getFullYear(),
        isRecurring: isRecurring !== false
      });
    }

    settings.lastModifiedBy = req.session.user._id || req.session.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({ 
      success: true, 
      holidays: settings.publicHolidays,
      message: 'Holiday saved successfully' 
    });
  } catch (error) {
    console.error('Error saving holiday:', error);
    res.status(500).json({ success: false, error: 'Failed to save holiday' });
  }
};

/**
 * DELETE Public Holiday
 */
exports.deletePublicHoliday = async (req, res) => {
  try {
    const { date } = req.params; // ISO date string
    
    const holidayDate = new Date(date);
    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    
    if (!settings) {
      return res.status(404).json({ success: false, error: 'Settings not found' });
    }

    settings.publicHolidays = settings.publicHolidays.filter(h => 
      h.date.toDateString() !== holidayDate.toDateString()
    );

    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({ 
      success: true, 
      holidays: settings.publicHolidays,
      message: 'Holiday deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ success: false, error: 'Failed to delete holiday' });
  }
};

/**
 * GET Public Holidays
 */
exports.getPublicHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    
    if (!settings) {
      return res.json({ success: true, holidays: [] });
    }

    let holidays = settings.publicHolidays;
    
    // Filter by year if provided
    if (year) {
      holidays = holidays.filter(h => h.year === parseInt(year) || h.isRecurring);
    }

    // Sort by date
    holidays.sort((a, b) => a.date - b.date);

    res.json({ success: true, holidays });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch holidays' });
  }
};

/**
 * GET Organization Profile (for email templates, invoices, etc.)
 */
exports.getOrganizationProfile = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({ _id: 'global-settings' });
    if (!settings) {
      return res.json({ success: false, error: 'Settings not found' });
    }
    
    res.json({ 
      success: true, 
      profile: {
        name: settings.organization.organizationName,
        tagline: settings.organization.tagline,
        logoUrl: settings.organization.logoUrl,
        primaryColor: settings.organization.primaryColor,
        contactEmail: settings.organization.contactEmail,
        contactPhone: settings.organization.contactPhone,
        address: settings.organization.address,
        emailFooter: settings.organization.emailFooter,
        emailHeader: settings.organization.emailHeader
      }
    });
  } catch (error) {
    console.error('Error fetching organization profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch organization profile' });
  }
};