/*
 * backend/controllers/financialReportsController.js
 * Controller for financial reports and analytics
 */
const mongoose = require('mongoose');
const FinancialReportingService = require('../services/financialReportingService');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Expense = require('../../models/Expense');
const School = require('../../models/School');
const json2csv = require('json2csv');

// GET: Financial Reports Dashboard
exports.getFinancialReports = async (req, res) => {
  try {
    res.render('finance/reports/index', {
      user: req.session.user,
      page: 'finance/reports'
    });
  } catch (err) {
    console.error('Error loading financial reports:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load reports' });
  }
};

// GET: P&L Summary Report
exports.getPLReport = async (req, res) => {
  try {
    const { startDate, endDate, schoolId, format = 'html' } = req.query;

    const reportData = await FinancialReportingService.generatePLSummary({
      startDate,
      endDate,
      schoolId
    });

    if (format === 'json') {
      return res.json({ success: true, data: reportData });
    }

    if (format === 'csv') {
      const csvData = this.convertPLToCSV(reportData);
      res.header('Content-Type', 'text/csv');
      res.attachment(`pl-summary-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvData);
    }

    // HTML view
    res.render('finance/reports/pl-summary', {
      user: req.session.user,
      page: 'finance/reports',
      reportData,
      filters: { startDate, endDate, schoolId },
      schools: await School.find({}).select('_id name').lean()
    });
  } catch (err) {
    console.error('Error generating P&L report:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to generate report' });
  }
};

// GET: School Revenue Report
exports.getSchoolRevenueReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      minRevenue,
      sortBy = 'revenue',
      sortOrder = 'desc',
      format = 'html'
    } = req.query;

    const reportData = await FinancialReportingService.generateSchoolRevenueReport({
      startDate,
      endDate,
      minRevenue: minRevenue ? parseFloat(minRevenue) : undefined,
      sortBy,
      sortOrder
    });

    if (format === 'json') {
      return res.json({ success: true, data: reportData });
    }

    if (format === 'csv') {
      const csvData = this.convertSchoolRevenueToCSV(reportData);
      res.header('Content-Type', 'text/csv');
      res.attachment(`school-revenue-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvData);
    }

    res.render('finance/reports/school-revenue', {
      user: req.session.user,
      page: 'finance/reports',
      reportData,
      filters: { startDate, endDate, minRevenue, sortBy, sortOrder }
    });
  } catch (err) {
    console.error('Error generating school revenue report:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to generate report' });
  }
};

// GET: Trainer Cost Report
exports.getTrainerCostReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      trainerId,
      sortBy = 'totalCost',
      sortOrder = 'desc',
      format = 'html'
    } = req.query;

    const reportData = await FinancialReportingService.generateTrainerCostReport({
      startDate,
      endDate,
      trainerId,
      sortBy,
      sortOrder
    });

    if (format === 'json') {
      return res.json({ success: true, data: reportData });
    }

    if (format === 'csv') {
      const csvData = this.convertTrainerCostToCSV(reportData);
      res.header('Content-Type', 'text/csv');
      res.attachment(`trainer-costs-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvData);
    }

    res.render('finance/reports/trainer-costs', {
      user: req.session.user,
      page: 'finance/reports',
      reportData,
      filters: { startDate, endDate, trainerId, sortBy, sortOrder }
    });
  } catch (err) {
    console.error('Error generating trainer cost report:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to generate report' });
  }
};

// GET: Financial Trends (Monthly)
exports.getFinancialTrends = async (req, res) => {
  try {
    const { months = 12, schoolId, format = 'json' } = req.query;

    const trends = await FinancialReportingService.generateFinancialTrends({
      months: parseInt(months),
      schoolId
    });

    if (format === 'json') {
      return res.json({ success: true, data: trends });
    }

    res.render('finance/reports/trends', {
      user: req.session.user,
      page: 'finance/reports',
      trends,
      filters: { months, schoolId }
    });
  } catch (err) {
    console.error('Error generating financial trends:', err);
    res.status(500).json({ success: false, error: 'Failed to generate trends' });
  }
};

// GET: Revenue vs Expenses Comparison
exports.getRevenueVsExpenses = async (req, res) => {
  try {
    const { startDate, endDate, schoolId } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.$gte = new Date(startDate);
      dateFilter.$lte = new Date(endDate);
    } else {
      // Default to last 6 months
      const now = new Date();
      dateFilter.$gte = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      dateFilter.$lte = new Date();
    }

    const schoolFilter = schoolId ? { schoolId: new mongoose.Types.ObjectId(schoolId) } : {};

    // Get monthly revenue and expenses
    const monthlyData = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(dateFilter.$gte.getFullYear(), dateFilter.$gte.getMonth() + i, 1);
      const monthEnd = new Date(dateFilter.$gte.getFullYear(), dateFilter.$gte.getMonth() + i + 1, 0);

      const [revenue, expenses] = await Promise.all([
        Invoice.aggregate([
          {
            $match: {
              issueDate: { $gte: monthStart, $lte: monthEnd },
              status: { $in: ['issued', 'partial', 'paid'] },
              ...schoolFilter
            }
          },
          { $group: { _id: null, total: { $sum: '$amountPaid' } } }
        ]),
        Expense.aggregate([
          {
            $match: {
              paidDate: { $gte: monthStart, $lte: monthEnd },
              status: 'approved',
              ...schoolFilter
            }
          },
          { $group: { _id: null, total: { $sum: '$netAmount' } } }
        ])
      ]);

      monthlyData.push({
        month: monthStart.toISOString().slice(0, 7),
        revenue: revenue[0]?.total || 0,
        expenses: expenses[0]?.total || 0,
        net: (revenue[0]?.total || 0) - (expenses[0]?.total || 0)
      });
    }

    res.json({ success: true, data: monthlyData });
  } catch (err) {
    console.error('Error generating revenue vs expenses:', err);
    res.status(500).json({ success: false, error: 'Failed to generate comparison' });
  }
};

// Helper: Convert P&L data to CSV
exports.convertPLToCSV = (reportData) => {
  const fields = [
    'Metric', 'Amount'
  ];

  const data = [
    { Metric: 'Total Revenue', Amount: reportData.revenue.collected },
    { Metric: 'Outstanding Revenue', Amount: reportData.revenue.outstanding },
    { Metric: 'Total Expenses', Amount: reportData.expenses.total },
    { Metric: 'Payroll Costs', Amount: reportData.payroll.net },
    { Metric: 'Gross Profit', Amount: reportData.profit.gross },
    { Metric: 'Net Profit', Amount: reportData.profit.net }
  ];

  return json2csv.parse(data, { fields });
};

// Helper: Convert School Revenue data to CSV
exports.convertSchoolRevenueToCSV = (reportData) => {
  const fields = [
    'School Name', 'Region', 'Total Invoiced', 'Total Collected',
    'Outstanding Amount', 'Collection Rate (%)', 'Invoice Count', 'Paid Invoices', 'Overdue Invoices'
  ];

  const data = reportData.schools.map(school => ({
    'School Name': school.schoolName,
    'Region': school.schoolRegion || '',
    'Total Invoiced': school.totalInvoiced,
    'Total Collected': school.totalCollected,
    'Outstanding Amount': school.outstandingAmount,
    'Collection Rate (%)': school.collectionRate.toFixed(1),
    'Invoice Count': school.invoiceCount,
    'Paid Invoices': school.paidInvoices,
    'Overdue Invoices': school.overdueInvoices
  }));

  return json2csv.parse(data, { fields });
};

// Helper: Convert Trainer Cost data to CSV
exports.convertTrainerCostToCSV = (reportData) => {
  const fields = [
    'Trainer Name', 'Role', 'Payroll Gross', 'Payroll Deductions', 'Payroll Net',
    'Event Expenses', 'Total Cost'
  ];

  const data = reportData.trainers.map(trainer => ({
    'Trainer Name': trainer.trainerName,
    'Role': trainer.trainerRole,
    'Payroll Gross': trainer.payrollCosts.gross,
    'Payroll Deductions': trainer.payrollCosts.deductions,
    'Payroll Net': trainer.payrollCosts.net,
    'Event Expenses': trainer.eventExpenses.total,
    'Total Cost': trainer.totalCost
  }));

  return json2csv.parse(data, { fields });
};