/*
 * backend/controllers/exportController.js
 * Controller for data export (CSV, PDF) and scheduled reports
 */

const { Parser } = require('json2csv');
const path = require('path');
const fs = require('fs');
let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  PDFDocument = null;
  console.warn('pdfkit not available, PDF export will be disabled');
}
const emailService = require('../../backend/services/emailService');
const ReportTemplate = require('../../models/ReportTemplate');
const ScheduledReport = require('../../models/ScheduledReport');
const SystemSettings = require('../../models/SystemSettings');
const { getTrainerPerformance, getEventEffectiveness, getSchoolEngagement } = require('../utils/aggregations');
const Event = require('../../models/Event');
const School = require('../../models/School');
const User = require('../../models/User');

/**
 * Export report data to CSV or PDF
 */
exports.exportReport = async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format = 'csv', dateRange, eventType, schoolId, trainerId, region, status } = req.query;

    let data = [];
    let headers = [];
    let filename = `report_${new Date().toISOString().split('T')[0]}`;

    switch (reportType) {
      case 'trainers':
        headers = ['Name', 'Email', 'Role', 'Events Completed', 'Total Attendance', 'Reports On-Time', 'Reports Late', 'Avg Feedback', 'Schools Visited'];
        const rawTrainerData = await getTrainerPerformance({ trainerId, dateRange, sortBy: 'eventsCompleted', sortOrder: 'desc' });
        data = rawTrainerData.map(item => ({
          'Name': item.staff?.name || '',
          'Email': item.staff?.email || '',
          'Role': item.staff?.role || '',
          'Events Completed': item.eventsCompleted,
          'Total Attendance': item.totalAttendance,
          'Reports On-Time': item.reportsOnTime,
          'Reports Late': item.reportsLate,
          'Avg Feedback': item.avgFeedback,
          'Schools Visited': item.schoolsVisited
        }));
        filename += '_trainers';
        break;

      case 'events':
        headers = ['Event Type', 'Total Events', 'Avg Attendance Rate', 'Avg Trainer-to-Scout Ratio'];
        const eventData = await getEventEffectiveness({ eventType, dateRange, region });
        data = eventData.map(item => ({
          'Event Type': item.eventType,
          'Total Events': item.totalEvents,
          'Avg Attendance Rate': item.avgAttendanceRate,
          'Avg Trainer-to-Scout Ratio': item.avgTrainerToScoutRatio
        }));
        filename += '_events';
        break;

      case 'schools':
        headers = ['School Name', 'Students', 'Events Attended', 'On-Time Payments', 'Total Payments', 'Avg Feedback', 'Engagement Score', 'Service Status'];
        const schoolData = await getSchoolEngagement({ schoolId, dateRange });
        data = schoolData.map(item => ({
          'School Name': item.schoolName,
          'Students': item.studentCount,
          'Events Attended': item.eventsAttended,
          'On-Time Payments': item.onTimePayments,
          'Total Payments': item.totalPayments,
          'Avg Feedback': item.avgFeedback,
          'Engagement Score': item.engagementScore,
          'Service Status': item.serviceStatus
        }));
        filename += '_schools';
        break;

      default:
        return res.status(400).json({ error: 'Unknown report type' });
    }

    if (format === 'csv') {
      // Manual CSV generation
      const escapeCsv = (field) => {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvLines = [
        headers.map(escapeCsv).join(','),
        ...data.map(row => headers.map(header => escapeCsv(row[header])).join(','))
      ];
      const csv = csvLines.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else if (format === 'pdf') {
      // Fetch organization settings for branding
      const systemSettings = await SystemSettings.findOne({ _id: 'global-settings' });
      const org = systemSettings?.organization || {};
      
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      doc.pipe(res);

       let currentY = 50;
       const pageWidth = doc.page.width;

       // Add logo if available
       const logoWidth = org.logoWidth || 40;
       let logoPlaced = false;

       if (org.logoUrl) {
         let imagePath = org.logoUrl;
         let imageLoaded = false;

         if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
           try {
             const x = (pageWidth - logoWidth) / 2;
             doc.image(imagePath, x, currentY, { width: logoWidth });
             imageLoaded = true;
           } catch (err) {
             console.warn('Failed to load external logo:', err);
           }
         } else {
           // Local file within public directory
           const relativePath = imagePath.replace(/^\//, '');
           const absolutePath = path.join(__dirname, '..', '..', 'public', relativePath);
           if (fs.existsSync(absolutePath)) {
             try {
               const x = (pageWidth - logoWidth) / 2;
               doc.image(absolutePath, x, currentY, { width: logoWidth });
               imageLoaded = true;
             } catch (err) {
               console.warn('Failed to load local logo:', err);
             }
           } else {
             console.warn('Logo file not found:', absolutePath);
           }
         }

         if (imageLoaded) {
           logoPlaced = true;
           currentY += logoWidth + 15;
           // Move PDF cursor down to avoid overlap
           doc.y = currentY;
         }
       }

       // Organization name as heading
       doc.fontSize(20).text(org.organizationName || 'Analytics Report', { align: 'center' });
       if (org.tagline) {
         doc.fontSize(10).text(org.tagline, { align: 'center' });
       }
       doc.moveDown(0.5);
       doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
       doc.moveDown();

      // Table
      doc.fontSize(10);
      const tableTop = doc.y;
      const colWidth = (doc.page.width - 100) / headers.length;
      const rowHeight = 20;

      // Header row
      headers.forEach((header, i) => {
        doc.text(header, 50 + i * colWidth, tableTop, { width: colWidth, align: 'left' });
      });

      // Data rows
      let y = tableTop + rowHeight;
      data.forEach((row, rowIndex) => {
        headers.forEach((header, i) => {
          doc.text(String(row[header] || ''), 50 + i * colWidth, y, { width: colWidth, align: 'left' });
        });
        y += rowHeight;
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = 50;
        }
      });

      doc.end();
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

/**
 * Get list of saved report templates
 */
exports.getReportTemplates = async (req, res) => {
  try {
    const templates = await ReportTemplate.find({ isShared: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
};

/**
 * Save report template
 */
exports.saveTemplate = async (req, res) => {
  try {
    const { name, description, config, isShared = true } = req.body;

    if (!name || !config) {
      return res.status(400).json({ success: false, error: 'Name and config are required' });
    }

    const template = new ReportTemplate({
      name,
      description,
      config,
      isShared,
      createdBy: req.session.user._id || req.session.user.id
    });

    await template.save();
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ success: false, error: 'Failed to save template' });
  }
};

/**
 * Get scheduled reports list
 */
exports.getScheduledReports = async (req, res) => {
  try {
    const reports = await ScheduledReport.find({})
      .populate('createdBy', 'name email')
      .populate('recipients', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduled reports' });
  }
};

/**
 * Create scheduled report
 */
exports.createScheduledReport = async (req, res) => {
  try {
    const { name, reportType, frequency, config, recipientIds } = req.body;

    if (!name || !reportType || !frequency || !recipientIds?.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Calculate next send date based on frequency
    const nextSendDate = new Date();
    if (frequency === 'monthly') {
      nextSendDate.setDate(1);
      nextSendDate.setMonth(nextSendDate.getMonth() + 1);
      // Ensure year rollover
      if (nextSendDate.getMonth() === 0) {
        nextSendDate.setFullYear(nextSendDate.getFullYear() + 1);
      }
    } else if (frequency === 'weekly') {
      nextSendDate.setDate(nextSendDate.getDate() + 7);
    } else if (frequency === 'daily') {
      nextSendDate.setDate(nextSendDate.getDate() + 1);
    }

    const scheduled = new ScheduledReport({
      name,
      reportType,
      frequency,
      config,
      recipients: recipientIds,
      createdBy: req.session.user._id || req.session.user.id,
      nextSendAt: nextSendDate,
      isActive: true
    });

    await scheduled.save();
    res.json({ success: true, scheduled });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    res.status(500).json({ success: false, error: 'Failed to create scheduled report' });
  }
};
