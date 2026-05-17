/*
 * backend/services/financialReportingService.js
 * Service for generating comprehensive financial reports
 */
const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Expense = require('../../models/Expense');
const Payroll = require('../../models/Payroll');
const Budget = require('../../models/Budget');
const School = require('../../models/School');
const Event = require('../../models/Event');
const Staff = require('../../models/Staff');

class FinancialReportingService {
  // Generate Profit & Loss Summary
  static async generatePLSummary(options = {}) {
    try {
      const { startDate, endDate, schoolId } = options;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.$gte = new Date(startDate);
        dateFilter.$lte = new Date(endDate);
      } else {
        // Default to current month
        const now = new Date();
        dateFilter.$gte = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter.$lte = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const schoolFilter = schoolId ? { schoolId: new mongoose.Types.ObjectId(schoolId) } : {};

      // Revenue calculations
      const revenueData = await Invoice.aggregate([
        {
          $match: {
            issueDate: dateFilter,
            status: { $in: ['issued', 'partial', 'paid'] },
            ...schoolFilter
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            collectedRevenue: { $sum: '$amountPaid' },
            outstandingRevenue: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } }
          }
        }
      ]);

      // Expense calculations
      const expenseData = await Expense.aggregate([
        {
          $match: {
            paidDate: dateFilter,
            status: 'approved',
            ...schoolFilter
          }
        },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$netAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Payroll calculations
      const payrollData = await Payroll.aggregate([
        {
          $match: {
            paymentDate: dateFilter,
            ...schoolFilter
          }
        },
        {
          $group: {
            _id: null,
            totalPayroll: { $sum: '$grossAmount' },
            totalDeductions: { $sum: '$deductions' },
            netPayroll: { $sum: { $subtract: ['$grossAmount', '$deductions'] } }
          }
        }
      ]);

      const revenue = revenueData[0] || { totalRevenue: 0, collectedRevenue: 0, outstandingRevenue: 0 };
      const payroll = payrollData[0] || { totalPayroll: 0, totalDeductions: 0, netPayroll: 0 };

      const totalExpenses = expenseData.reduce((sum, exp) => sum + exp.totalAmount, 0);
      const grossProfit = revenue.collectedRevenue - totalExpenses - payroll.netPayroll;
      const netProfit = grossProfit; // Add taxes if needed

      return {
        period: {
          startDate: dateFilter.$gte,
          endDate: dateFilter.$lte
        },
        revenue: {
          totalInvoiced: revenue.totalRevenue,
          collected: revenue.collectedRevenue,
          outstanding: revenue.outstandingRevenue
        },
        expenses: {
          byCategory: expenseData,
          total: totalExpenses
        },
        payroll: {
          gross: payroll.totalPayroll,
          deductions: payroll.totalDeductions,
          net: payroll.netPayroll
        },
        profit: {
          gross: grossProfit,
          net: netProfit
        }
      };
    } catch (error) {
      console.error('Error generating P&L summary:', error);
      throw error;
    }
  }

  // Generate School-by-School Revenue Report
  static async generateSchoolRevenueReport(options = {}) {
    try {
      const { startDate, endDate, minRevenue, sortBy = 'revenue', sortOrder = 'desc' } = options;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.$gte = new Date(startDate);
        dateFilter.$lte = new Date(endDate);
      } else {
        // Default to last 12 months
        const now = new Date();
        dateFilter.$gte = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
        dateFilter.$lte = new Date();
      }

      const pipeline = [
        {
          $match: {
            issueDate: dateFilter,
            status: { $in: ['issued', 'partial', 'paid'] }
          }
        },
        {
          $lookup: {
            from: 'schools',
            localField: 'schoolId',
            foreignField: '_id',
            as: 'school'
          }
        },
        {
          $unwind: '$school'
        },
        {
          $group: {
            _id: '$schoolId',
            schoolName: { $first: '$school.name' },
            schoolRegion: { $first: '$school.region' },
            schoolZone: { $first: '$school.zone' },
            totalInvoiced: { $sum: '$totalAmount' },
            totalCollected: { $sum: '$amountPaid' },
            outstandingAmount: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } },
            invoiceCount: { $sum: 1 },
            paidInvoices: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'paid'] },
                  1,
                  0
                ]
              }
            },
            overdueInvoices: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$status', 'overdue'] },
                    { $gt: [{ $subtract: ['$totalAmount', '$amountPaid'] }, 0] }
                  ]},
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            schoolName: 1,
            schoolRegion: 1,
            schoolZone: 1,
            totalInvoiced: 1,
            totalCollected: 1,
            outstandingAmount: 1,
            collectionRate: {
              $cond: [
                { $eq: ['$totalInvoiced', 0] },
                0,
                { $multiply: [{ $divide: ['$totalCollected', '$totalInvoiced'] }, 100] }
              ]
            },
            invoiceCount: 1,
            paidInvoices: 1,
            overdueInvoices: 1
          }
        }
      ];

      // Add minimum revenue filter
      if (minRevenue) {
        pipeline.push({
          $match: { totalInvoiced: { $gte: minRevenue } }
        });
      }

      // Add sorting
      const sortField = sortBy === 'revenue' ? 'totalInvoiced' :
                       sortBy === 'collected' ? 'totalCollected' :
                       sortBy === 'outstanding' ? 'outstandingAmount' :
                       sortBy === 'collectionRate' ? 'collectionRate' : 'totalInvoiced';

      pipeline.push({
        $sort: { [sortField]: sortOrder === 'desc' ? -1 : 1 }
      });

      const schoolRevenue = await Invoice.aggregate(pipeline);

      // Calculate summary statistics
      const summary = {
        totalSchools: schoolRevenue.length,
        totalRevenue: schoolRevenue.reduce((sum, school) => sum + school.totalInvoiced, 0),
        totalCollected: schoolRevenue.reduce((sum, school) => sum + school.totalCollected, 0),
        totalOutstanding: schoolRevenue.reduce((sum, school) => sum + school.outstandingAmount, 0),
        averageCollectionRate: schoolRevenue.length > 0 ?
          schoolRevenue.reduce((sum, school) => sum + school.collectionRate, 0) / schoolRevenue.length : 0,
        schoolsWithOverdue: schoolRevenue.filter(school => school.overdueInvoices > 0).length
      };

      return {
        period: {
          startDate: dateFilter.$gte,
          endDate: dateFilter.$lte
        },
        summary,
        schools: schoolRevenue
      };
    } catch (error) {
      console.error('Error generating school revenue report:', error);
      throw error;
    }
  }

  // Generate Trainer Cost Breakdown Report
  static async generateTrainerCostReport(options = {}) {
    try {
      const { startDate, endDate, trainerId, sortBy = 'totalCost', sortOrder = 'desc' } = options;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.$gte = new Date(startDate);
        dateFilter.$lte = new Date(endDate);
      } else {
        // Default to last 3 months
        const now = new Date();
        dateFilter.$gte = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        dateFilter.$lte = new Date();
      }

      const trainerFilter = trainerId ? { trainerId: new mongoose.Types.ObjectId(trainerId) } : {};

      // Get payroll data
      const payrollData = await Payroll.aggregate([
        {
          $match: {
            periodStart: dateFilter,
            ...trainerFilter
          }
        },
        {
          $lookup: {
            from: 'staff',
            localField: 'trainerId',
            foreignField: '_id',
            as: 'trainer'
          }
        },
        {
          $unwind: '$trainer'
        },
        {
          $group: {
            _id: '$trainerId',
            trainerName: { $first: '$trainer.name' },
            trainerRole: { $first: '$trainer.role' },
            totalGrossPay: { $sum: '$grossAmount' },
            totalDeductions: { $sum: '$deductions' },
            totalNetPay: { $sum: { $subtract: ['$grossAmount', '$deductions'] } },
            payrollCount: { $sum: 1 },
            averageGrossPay: { $avg: '$grossAmount' }
          }
        }
      ]);

      // Get event-based costs (allowances, etc.)
      const eventExpenses = await Expense.aggregate([
        {
          $match: {
            paidDate: dateFilter,
            category: { $in: ['trainer_allowance', 'transport', 'meal_allowance', 'overnight_allowance'] },
            ...trainerFilter
          }
        },
        {
          $lookup: {
            from: 'staff',
            localField: 'staffId',
            foreignField: '_id',
            as: 'trainer'
          }
        },
        {
          $unwind: { path: '$trainer', preserveNullAndEmptyArrays: true }
        },
        {
          $group: {
            _id: '$staffId',
            trainerName: { $first: '$trainer.name' },
            totalEventExpenses: { $sum: '$netAmount' },
            expenseCount: { $sum: 1 },
            expensesByCategory: {
              $push: {
                category: '$category',
                amount: '$netAmount',
                date: '$paidDate'
              }
            }
          }
        }
      ]);

      // Combine payroll and expense data
      const trainerCosts = new Map();

      // Add payroll data
      payrollData.forEach(payroll => {
        trainerCosts.set(payroll._id.toString(), {
          trainerId: payroll._id,
          trainerName: payroll.trainerName,
          trainerRole: payroll.trainerRole,
          payrollCosts: {
            gross: payroll.totalGrossPay,
            deductions: payroll.totalDeductions,
            net: payroll.totalNetPay,
            count: payroll.payrollCount,
            average: payroll.averageGrossPay
          },
          eventExpenses: {
            total: 0,
            count: 0,
            byCategory: []
          },
          totalCost: payroll.totalNetPay
        });
      });

      // Add/merge expense data
      eventExpenses.forEach(expense => {
        const trainerId = expense._id?.toString();
        if (!trainerId) return;

        const existing = trainerCosts.get(trainerId) || {
          trainerId: expense._id,
          trainerName: expense.trainerName || 'Unknown Trainer',
          trainerRole: 'Unknown',
          payrollCosts: { gross: 0, deductions: 0, net: 0, count: 0, average: 0 },
          eventExpenses: { total: 0, count: 0, byCategory: [] },
          totalCost: 0
        };

        existing.eventExpenses.total = expense.totalEventExpenses;
        existing.eventExpenses.count = expense.expenseCount;
        existing.eventExpenses.byCategory = expense.expensesByCategory;
        existing.totalCost = existing.payrollCosts.net + expense.totalEventExpenses;

        trainerCosts.set(trainerId, existing);
      });

      // Convert to array and sort
      let result = Array.from(trainerCosts.values());

      const sortField = sortBy === 'totalCost' ? 'totalCost' :
                       sortBy === 'payroll' ? 'payrollCosts.net' :
                       sortBy === 'expenses' ? 'eventExpenses.total' :
                       sortBy === 'name' ? 'trainerName' : 'totalCost';

      result.sort((a, b) => {
        let aVal = this.getNestedValue(a, sortField);
        let bVal = this.getNestedValue(b, sortField);

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (sortOrder === 'desc') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        } else {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
      });

      // Calculate summary
      const summary = {
        totalTrainers: result.length,
        totalPayrollCosts: result.reduce((sum, t) => sum + t.payrollCosts.net, 0),
        totalEventExpenses: result.reduce((sum, t) => sum + t.eventExpenses.total, 0),
        totalCosts: result.reduce((sum, t) => sum + t.totalCost, 0),
        averageCostPerTrainer: result.length > 0 ? result.reduce((sum, t) => sum + t.totalCost, 0) / result.length : 0
      };

      return {
        period: {
          startDate: dateFilter.$gte,
          endDate: dateFilter.$lte
        },
        summary,
        trainers: result
      };
    } catch (error) {
      console.error('Error generating trainer cost report:', error);
      throw error;
    }
  }

  // Helper function to get nested object values
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj) || 0;
  }

  // Generate monthly financial trends
  static async generateFinancialTrends(options = {}) {
    try {
      const { months = 12, schoolId } = options;
      const now = new Date();

      const trends = [];

      for (let i = months - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const schoolFilter = schoolId ? { schoolId: new mongoose.Types.ObjectId(schoolId) } : {};

        const [revenue, expenses, payroll] = await Promise.all([
          Invoice.aggregate([
            {
              $match: {
                issueDate: { $gte: monthStart, $lte: monthEnd },
                status: { $in: ['issued', 'partial', 'paid'] },
                ...schoolFilter
              }
            },
            {
              $group: {
                _id: null,
                invoiced: { $sum: '$totalAmount' },
                collected: { $sum: '$amountPaid' }
              }
            }
          ]),
          Expense.aggregate([
            {
              $match: {
                paidDate: { $gte: monthStart, $lte: monthEnd },
                status: 'approved',
                ...schoolFilter
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$netAmount' }
              }
            }
          ]),
          Payroll.aggregate([
            {
              $match: {
                paymentDate: { $gte: monthStart, $lte: monthEnd },
                ...schoolFilter
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: { $subtract: ['$grossAmount', '$deductions'] } }
              }
            }
          ])
        ]);

        const rev = revenue[0] || { invoiced: 0, collected: 0 };
        const exp = expenses[0] || { total: 0 };
        const pay = payroll[0] || { total: 0 };

        trends.push({
          month: monthStart.toISOString().slice(0, 7), // YYYY-MM format
          revenue: {
            invoiced: rev.invoiced,
            collected: rev.collected
          },
          expenses: exp.total,
          payroll: pay.total,
          netIncome: rev.collected - exp.total - pay.total
        });
      }

      return trends;
    } catch (error) {
      console.error('Error generating financial trends:', error);
      throw error;
    }
  }
}

module.exports = FinancialReportingService;