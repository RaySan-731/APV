/*
 * backend/controllers/exportController.js
 * Controller for data export (CSV, PDF) and scheduled reports
 */

const { Parser } = require('json2csv');
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
const { getTrainerPerformance } = require('../utils/aggregations');
const Event = require('../../models/Event');
const School = require('../../models/School');
const User = require('../../models/User');

/**
 * Export report data to CSV or PDF
 */
exports.exportReport = async (req, res) => {
  try {
    const { reportType, format = 'csv' } = req.params;
    const { dateRange, eventType, schoolId, trainerId, region } = req.query;

    let data = [];
    let headers = [];
    let filename = `report_${new Date().toISOString().split('T')[0]}`;

    switch (reportType) {
      case 'trainers':
        headers = ['Name', 'Email', 'Role', 'Events Completed', 'Total Attendance', 'Reports On-Time', 'Reports Late', 'Avg Feedback', 'Schools Visited'];
        const rawTrainerData = await getTrainerPerformance({ dateRange });
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
        headers = ['Event Name', 'Type', 'Start Date', 'End Date', 'Location', 'Status', 'Registered', 'Attended', 'Report Submitted'];
        const events = await Event.find({})
          .populate('trainers.trainerId', 'name')
          .populate('targetSchools.schoolId', 'name')
          .sort({ startDate: -1 });
        data = events.map(e => ({
          'Event Name': e.name,
          'Type': e.eventType,
          'Start Date': e.startDate.toISOString().split('T')[0],
          'End Date': e.endDate.toISOString().split('T')[0],
          'Location': e.location?.name || '',
          'Status': e.status,
          'Registered': e.currentParticipants,
          'Attended': e.review?.actualAttendeeCount || 0,
          'Report Submitted': e.review?.reportSubmittedAt ? 'Yes' : 'No'
        }));
        filename += '_events';
        break;

      case 'schools':
        headers = ['School Name', 'City', 'Region', 'Students', 'Service Status', 'Events Attended', 'Avg Attendance', 'Payment Reliability'];
        const schools = await School.find({});
        data = [];
        for (const school of schools) {
          const eventsCount = await Event.countDocuments({ 'targetSchools.schoolId': school._id });
          data.push({
            'School Name': school.name,
            'City': school.address?.city || '',
            'Region': school.region || '',
            'Students': school.studentCount,
            'Service Status': school.serviceStatus,
            'Events Attended': eventsCount,
            'Avg Attendance': school.participationMetrics?.averageAttendanceRate || 0,
            'Payment Reliability': 'TBD'
          });
        }
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
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      doc.pipe(res);

      // PDF Header
      doc.fontSize(20).text('Analytics Report', { align: 'center' });
      doc.moveDown();
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
      csvData.forEach((row, rowIndex) => {
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
