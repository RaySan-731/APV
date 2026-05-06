/*
 * backend/routes/finance.js
 * Routes for finance and billing management (founder/admin only).
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import models (for direct queries in routes)
const School = require('../../models/School');
const Event = require('../../models/Event');
const ServicePackage = require('../../models/ServicePackage');
const Invoice = require('../../models/Invoice');

// Import controllers
const invoiceController = require('../controllers/invoiceController');
const payrollController = require('../controllers/payrollController');
const expenseController = require('../controllers/expenseController');
const budgetController = require('../controllers/budgetController');
const servicePackageController = require('../controllers/servicePackageController');
const financeController = require('../controllers/financeController');

// Middleware: Ensure user is authenticated and has finance permissions
const requireFinanceAccess = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  // Only admin/founder roles have access
  if (!['admin', 'founder', 'supervisor'].includes(req.session.user.role)) {
    return res.status(403).render('404', {
      user: req.session.user,
      error: 'Access denied. Finance features require admin privileges.'
    });
  }
  next();
};

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './public/uploads/receipts';
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'receipt-' + uniqueSuffix + ext);
  }
});

const receiptUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type for receipt'));
    }
  }
});

// ========== FINANCIAL DASHBOARD ==========
router.get('/dashboard', requireFinanceAccess, financeController.getFinancialDashboard);

// ========== INVOICES ==========
router.get('/invoices', requireFinanceAccess, invoiceController.getInvoices);
router.get('/invoices/create', requireFinanceAccess, async (req, res) => {
  try {
    const [schools, events, packages] = await Promise.all([
      School.find({}).select('_id name').lean(),
      Event.find({ status: { $in: ['completed', 'in_progress'] } }).select('_id name startDate').lean(),
      ServicePackage.find({ isActive: true }).select('_id name displayName pricingModel').lean()
    ]);
    res.render('finance/invoices/create', {
      user: req.session.user,
      page: 'finance/invoices',
      schools,
      events,
      packages
    });
  } catch (err) {
    console.error('Error loading invoice create form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
});
router.post('/invoices/create', requireFinanceAccess, invoiceController.createInvoice);
router.get('/invoices/:id', requireFinanceAccess, invoiceController.getInvoice);
router.post('/invoices/:id/cancel', requireFinanceAccess, invoiceController.cancelInvoice);
router.post('/invoices/:id/send-reminder', requireFinanceAccess, invoiceController.sendReminder);
router.get('/invoices/:id/download', requireFinanceAccess, invoiceController.downloadInvoicePDF);

// Record payment against invoice
router.post('/invoices/:id/payments', requireFinanceAccess, (req, res) => {
  const { amount, paymentDate, method, reference, notes } = req.body;
  invoiceController.recordPayment(req, res);
});

// Auto-suggest invoice
router.get('/invoices/suggest', requireFinanceAccess, invoiceController.getInvoiceSuggestion);

// ========== EXPENSES ==========
router.get('/expenses', requireFinanceAccess, expenseController.getExpenses);
router.get('/expenses/create', requireFinanceAccess, expenseController.getCreateExpense);
router.post('/expenses/create', requireFinanceAccess, expenseController.createExpense);
router.post('/expenses/:id', requireFinanceAccess, expenseController.updateExpenseStatus);
router.post('/expenses/upload-receipt', requireFinanceAccess, receiptUpload.single('receipt'), expenseController.uploadReceipt);
router.get('/expenses/analytics', requireFinanceAccess, expenseController.getExpenseAnalytics);

// ========== PAYROLL ==========
router.get('/payroll', requireFinanceAccess, payrollController.getPayrollDashboard);
router.get('/payroll/calculate', requireFinanceAccess, payrollController.calculatePayroll);
router.post('/payroll/create', requireFinanceAccess, payrollController.createPayroll);
router.post('/payroll/:id/approve', requireFinanceAccess, payrollController.approvePayroll);
router.post('/payroll/:id/mark-paid', requireFinanceAccess, payrollController.markAsPaid);
router.get('/payroll/:id/payslip', requireFinanceAccess, payrollController.generatePayslipPDF);
router.get('/payroll/trainer/:id/history', requireFinanceAccess, payrollController.getTrainerPayrollHistory);

// ========== BUDGETS ==========
router.get('/budgets', requireFinanceAccess, budgetController.getBudgets);
router.get('/budgets/create', requireFinanceAccess, budgetController.getCreateBudget);
router.post('/budgets/create', requireFinanceAccess, budgetController.createBudget);
router.get('/budgets/:id', requireFinanceAccess, budgetController.getBudget);
router.post('/budgets/:id/status', requireFinanceAccess, budgetController.updateBudgetStatus);
router.get('/budgets/analytics', requireFinanceAccess, budgetController.getBudgetAnalytics);

// ========== SERVICE PACKAGES ==========
router.get('/service-packages', requireFinanceAccess, servicePackageController.getServicePackages);
router.get('/service-packages/create', requireFinanceAccess, servicePackageController.getPackageForm);
router.get('/service-packages/:id/edit', requireFinanceAccess, servicePackageController.getPackageForm);
router.post('/service-packages/save', requireFinanceAccess, servicePackageController.savePackage);
router.post('/service-packages/:id', requireFinanceAccess, servicePackageController.savePackage);
router.post('/service-packages/:id/delete', requireFinanceAccess, servicePackageController.deletePackage);

// ========== FINANCIAL REPORTS ==========
router.get('/reports', requireFinanceAccess, financeController.getFinancialReports);
router.post('/reports/export', requireFinanceAccess, financeController.exportReportCSV);

// ========== AUTO-ALERTS (can be called by cron) ==========
// This endpoint can be hit by a scheduled job to check for overdue invoices
router.get('/alerts/overdue', requireFinanceAccess, async (req, res) => {
  const count = await invoiceController.checkOverdueInvoices();
  res.json({ success: true, overdueCount: count });
});

module.exports = router;
