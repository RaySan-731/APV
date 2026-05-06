/*
 * backend/controllers/financeController.js
 * Main finance controller - dashboard overview, financial reports, analytics.
 */
const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const Expense = require('../../models/Expense');
const Budget = require('../../models/Budget');
const Payroll = require('../../models/Payroll');
const School = require('../../models/School');
const Event = require('../../models/Event');
const Payment = require('../../models/Payment');
const json2csv = require('json2csv');

// GET: Financial Dashboard (overview for founders)
exports.getFinancialDashboard = async (req, res) => {
  try {
    const { dateRange = 'month', startDate, endDate, schoolId } = req.query;

    const now = new Date();
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        issueDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };
    } else {
      // Default based on dateRange
      switch (dateRange) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = { issueDate: { $gte: weekAgo } };
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          dateFilter = { issueDate: { $gte: monthAgo } };
          break;
        case 'quarter':
          const quarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          dateFilter = { issueDate: { $gte: quarterAgo } };
          break;
        case 'year':
          const yearAgo = new Date(now.getFullYear() - 1, 0, 1);
          dateFilter = { issueDate: { $gte: yearAgo } };
          break;
      }
    }

    // Build school filter
    const schoolFilter = schoolId ? { schoolId: mongoose.Types.ObjectId(schoolId) } : {};

    // Key metrics
    const [
      revenueSummary,
      expenseSummary,
      topSchools,
      monthlyTrend,
      expenseByCategory,
      budgetAlerts
    ] = await Promise.all([
      // Revenue metrics (invoices)
      Invoice.aggregate([
        { $match: { ...dateFilter, status: { $in: ['issued', 'sent', 'partial', 'paid'] } } },
        { $match: schoolId ? { schoolId: mongoose.Types.ObjectId(schoolId) } : {} },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalCollected: { $sum: '$amountPaid' },
            outstandingBalance: { $sum: '$balance' },
            invoiceCount: { $sum: 1 },
            overdueCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'overdue'] }, { $gt: ['$balance', 0] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      // Expense metrics
      Expense.aggregate([
        { $match: { ...dateFilter, status: 'approved' } },
        { $match: schoolId ? { schoolId: mongoose.Types.ObjectId(schoolId) } : {} },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$netAmount' },
            expenseCount: { $sum: 1 },
            avgExpense: { $avg: '$netAmount' }
          }
        }
      ]),
      // Top schools by revenue
      Invoice.aggregate([
        { $match: { ...dateFilter, status: { $in: ['issued', 'sent', 'partial', 'paid'] } } },
        {
          $group: {
            _id: '$schoolId',
            totalRevenue: { $sum: '$totalAmount' },
            invoiceCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'schools',
            localField: '_id',
            foreignField: '_id',
            as: 'school'
          }
        },
        { $unwind: '$school' },
        {
          $project: {
            schoolName: '$school.name',
            totalRevenue: 1,
            invoiceCount: 1
          }
        }
      ]),
      // Monthly revenue trend (last 12 months)
      Invoice.aggregate([
        {
          $match: {
            issueDate: { $gte: new Date(now.getFullYear() - 1, 0, 1) },
            status: { $in: ['issued', 'sent', 'partial', 'paid'] }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$issueDate' } },
            revenue: { $sum: '$totalAmount' },
            collected: { $sum: '$amountPaid' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Expenses by category
      Expense.aggregate([
        { $match: { ...dateFilter, status: 'approved' } },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$netAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ]),
      // Budget alerts
      Budget.find({
        status: 'active',
        alertTriggered: true
      }).populate('eventId', 'name').limit(10).lean()
    ]);

    // Calculate net income
    const revenue = revenueSummary[0] || { totalRevenue: 0, totalCollected: 0, outstandingBalance: 0, invoiceCount: 0, overdueCount: 0 };
    const expenses = expenseSummary[0] || { totalExpenses: 0, expenseCount: 0, avgExpense: 0 };
    const netIncome = revenue.totalRevenue - expenses.totalExpenses;

    // Profit margin
    const profitMargin = revenue.totalRevenue > 0 ? (netIncome / revenue.totalRevenue) * 100 : 0;

    const stats = {
      totalRevenue: revenue.totalRevenue,
      totalCollected: revenue.totalCollected,
      outstandingInvoices: revenue.outstandingBalance,
      overdueInvoices: revenue.overdueCount,
      invoiceCount: revenue.invoiceCount,
      totalExpenses: expenses.totalExpenses,
      expenseCount: expenses.expenseCount,
      netIncome,
      profitMargin,
      topSchools
    };

    res.render('finance/dashboard', {
      user: req.session.user,
      page: 'finance/dashboard',
      stats,
      monthlyTrend,
      expenseByCategory,
      budgetAlerts,
      dateRange,
      startDate,
      endDate,
      schoolId,
      schools: await School.find({}).select('_id name').lean()
    });
  } catch (err) {
    console.error('Error loading finance dashboard:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load dashboard' });
  }
};

// GET: Financial reports (P&L, school revenue, trainer costs)
exports.getFinancialReports = async (req, res) => {
  try {
    const { reportType, startDate, endDate, format = 'html' } = req.query;

    if (!startDate || !endDate) {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      startDate = threeMonthsAgo.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dateFilter = { issueDate: { $gte: start, $lte: end } };
    const expenseDateFilter = { paidDate: { $gte: start, $lte: end } };

    let reportData = {};
    let template = 'finance/reports/select';

    if (reportType === 'profit_loss') {
      // P&L Statement
      const revenue = await Invoice.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            collected: { $sum: '$amountPaid' },
            outstanding: { $sum: '$balance' }
          }
        }
      ]);

      const expenses = await Expense.aggregate([
        { $match: { ...expenseDateFilter, status: 'approved' } },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$netAmount' }
          }
        }
      ]);

      const payroll = await Payroll.aggregate([
        { $match: { periodStart: { $gte: start }, periodEnd: { $lte: end }, status: { $in: ['approved', 'paid'] } } },
        {
          $group: {
            _id: null,
            totalPayroll: { $sum: '$netAmount' }
          }
        }
      ]);

      reportData = {
        revenue: revenue[0]?.totalRevenue || 0,
        collected: revenue[0]?.collected || 0,
        outstanding: revenue[0]?.outstanding || 0,
        expenses: expenses[0]?.totalExpenses || 0,
        payroll: payroll[0]?.totalPayroll || 0,
        netIncome: (revenue[0]?.totalRevenue || 0) - (expenses[0]?.totalExpenses || 0) - (payroll[0]?.totalPayroll || 0)
      };
      template = 'finance/reports/profit_loss';
    } else if (reportType === 'school_revenue') {
      // Revenue by school
      reportData = await Invoice.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$schoolId',
            totalBilled: { $sum: '$totalAmount' },
            totalPaid: { $sum: '$amountPaid' },
            outstanding: { $sum: '$balance' },
            invoiceCount: { $sum: 1 }
          }
        },
        { $sort: { totalBilled: -1 } },
        {
          $lookup: {
            from: 'schools',
            localField: '_id',
            foreignField: '_id',
            as: 'school'
          }
        },
        { $unwind: '$school' },
        {
          $project: {
            schoolName: '$school.name',
            totalBilled: 1,
            totalPaid: 1,
            outstanding: 1,
            invoiceCount: 1
          }
        }
      ]);
      template = 'finance/reports/school_revenue';
    } else if (reportType === 'trainer_costs') {
      // Trainer cost breakdown
      const eventCosts = await Event.aggregate([
        {
          $match: {
            startDate: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        { $unwind: '$trainers' },
        {
          $group: {
            _id: '$trainers.trainerId',
            eventsCount: { $sum: 1 },
            totalDays: {
              $sum: {
                $ceil: {
                  $divide: [
                    { $subtract: ['$endDate', '$startDate'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              }
            }
          }
        },
        {
          $lookup: {
            from: 'staff',
            localField: '_id',
            foreignField: '_id',
            as: 'trainer'
          }
        },
        { $unwind: '$trainer' },
        {
          $project: {
            trainerName: '$trainer.name',
            eventsCount: 1,
            totalDays: 1,
            dailyRate: '$trainer.compensationRates.dailyRate',
            estimatedCost: { $multiply: ['$totalDays', '$trainer.compensationRates.dailyRate'] }
          }
        },
        { $sort: { estimatedCost: -1 } }
      ]);

      // Also get actual payroll to compare
      const actualPayroll = await Payroll.aggregate([
        {
          $match: {
            periodStart: { $gte: start },
            periodEnd: { $lte: end },
            status: { $in: ['approved', 'paid'] }
          }
        },
        {
          $group: {
            _id: '$trainerId',
            actualPaid: { $sum: '$netAmount' },
            payments: { $sum: 1 }
          }
        }
      ]);

      const actualMap = new Map(actualPayroll.map(p => [p._id.toString(), p.actualPaid]));
      eventCosts.forEach(ec => {
        ec.actualPaid = actualMap.get(ec._id.toString()) || 0;
      });

      reportData = eventCosts;
      template = 'finance/reports/trainer_costs';
    }

    res.render(template, {
      user: req.session.user,
      page: 'finance/reports',
      reportData,
      reportType,
      startDate,
      endDate,
      dateFilter: { startDate, endDate }
    });
  } catch (err) {
    console.error('Error generating financial report:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to generate report' });
  }
};

// POST: Export financial report as CSV
exports.exportReportCSV = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let data = [];

    switch (reportType) {
      case 'profit_loss':
        // Simplified P&L as CSV
        const revenue = await Invoice.aggregate([
          { $match: { issueDate: { $gte: start, $lte: end } } },
          { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const expenses = await Expense.aggregate([
          { $match: { paidDate: { $gte: start, $lte: end }, status: 'approved' } },
          { $group: { _id: null, totalExpenses: { $sum: '$netAmount' } } }
        ]);
        data = [{
          Metric: 'Total Revenue',
          Value: revenue[0]?.totalRevenue || 0
        }, {
          Metric: 'Total Expenses',
          Value: expenses[0]?.totalExpenses || 0
        }, {
          Metric: 'Net Income',
          Value: (revenue[0]?.totalRevenue || 0) - (expenses[0]?.totalExpenses || 0)
        }];
        break;

      case 'school_revenue':
        const schoolData = await Invoice.aggregate([
          { $match: { issueDate: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: '$schoolId',
              schoolName: { $first: '$schoolId' },
              totalBilled: { $sum: '$totalAmount' },
              totalPaid: { $sum: '$amountPaid' },
              outstanding: { $sum: '$balance' }
            }
          }
        ]);
        data = schoolData.map(d => ({
          School: d.schoolName,
          TotalBilled: d.totalBilled,
          TotalPaid: d.totalPaid,
          Outstanding: d.outstanding
        }));
        break;

      case 'trainer_costs':
        const trainerData = await Payroll.aggregate([
          {
            $match: {
              periodStart: { $gte: start },
              periodEnd: { $lte: end },
              status: { $in: ['approved', 'paid'] }
            }
          },
          {
            $group: {
              _id: '$trainerId',
              totalPaid: { $sum: '$netAmount' },
              payments: { $sum: 1 }
            }
          }
        ]);
        data = trainerData.map(d => ({
          TrainerId: d._id,
          TotalPaid: d.totalPaid,
          PaymentCount: d.payments
        }));
        break;
    }

    const csv = json2csv.parse(data);
    const filename = `${reportType}_${startDate}_to_${endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ success: false, error: 'Failed to export CSV' });
  }
};

module.exports = exports;
