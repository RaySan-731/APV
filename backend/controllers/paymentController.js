/*
 * backend/controllers/paymentController.js
 * Controller for payment recording and management
 */
const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const School = require('../../models/School');
const PaymentService = require('../services/paymentService');
const InvoiceService = require('../services/invoiceService');

// GET: List payments with filters
exports.getPayments = async (req, res) => {
  try {
    const {
      schoolId,
      invoiceId,
      status,
      method,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (schoolId) query.schoolId = new mongoose.Types.ObjectId(schoolId);
    if (invoiceId) query.invoiceId = new mongoose.Types.ObjectId(invoiceId);
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('schoolId', 'name')
        .populate('invoiceId', 'invoiceNumber totalAmount')
        .populate('recordedBy', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(query)
    ]);

    // Calculate summary stats
    const summary = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          avgPayment: { $avg: '$amount' },
          methods: {
            $addToSet: '$method'
          }
        }
      }
    ]);

    res.render('finance/payments/index', {
      user: req.session.user,
      page: 'finance/payments',
      payments,
      summary: summary[0] || { totalAmount: 0, paymentCount: 0, avgPayment: 0, methods: [] },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: { schoolId, invoiceId, status, method, startDate, endDate },
      schools: await School.find({}).select('_id name').lean()
    });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load payments' });
  }
};

// GET: Create payment form
exports.getCreatePayment = async (req, res) => {
  try {
    const { schoolId, invoiceId } = req.query;

    let preselectedSchool = null;
    let preselectedInvoice = null;
    let outstandingInvoices = [];

    if (schoolId) {
      preselectedSchool = await School.findById(schoolId).lean();
      // Get outstanding invoices for this school
      outstandingInvoices = await Invoice.find({
        schoolId: schoolId,
        status: { $in: ['issued', 'partial'] },
        $expr: { $gt: ['$totalAmount', '$amountPaid'] }
      }).select('_id invoiceNumber totalAmount amountPaid balance').lean();
    }

    if (invoiceId) {
      preselectedInvoice = await Invoice.findById(invoiceId)
        .populate('schoolId', 'name')
        .lean();
    }

    res.render('finance/payments/create', {
      user: req.session.user,
      page: 'finance/payments',
      schools: await School.find({}).select('_id name').lean(),
      invoices: outstandingInvoices, // renamed to match view expectation
      preselectedSchool,
      preselectedInvoice
    });
  } catch (err) {
    console.error('Error loading payment create form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
};

// POST: Create new payment
exports.createPayment = async (req, res) => {
  try {
    const {
      schoolId: bodySchoolId,
      invoiceId,
      amount,
      method,
      reference,
      notes,
      receipt,
      paymentDate
    } = req.body;

    // Validate required fields
    if (!amount || !method) {
      return res.status(400).render('finance/payments/create', {
        user: req.session.user,
        page: 'finance/payments',
        error: 'Amount and payment method are required',
        formData: req.body,
        schools: await School.find({}).select('_id name').lean(),
        invoices: []
      });
    }

    // Determine schoolId: use provided or fetch from invoice
    let schoolId = bodySchoolId;
    if (!schoolId && invoiceId) {
      const invoice = await Invoice.findById(invoiceId).populate('schoolId', '_id');
      if (invoice && invoice.schoolId) {
        schoolId = invoice.schoolId._id;
      }
    }

    if (!schoolId) {
      return res.status(400).render('finance/payments/create', {
        user: req.session.user,
        page: 'finance/payments',
        error: 'School is required. Please select an invoice.',
        formData: req.body,
        schools: await School.find({}).select('_id name').lean(),
        invoices: []
      });
    }

    // Handle file upload
    let receiptFile = null;
    if (req.file) {
      receiptFile = req.file;
    }

    // Record the payment
    const payment = await PaymentService.recordPayment({
      schoolId,
      invoiceId: invoiceId || null,
      amount: parseFloat(amount),
      method,
      reference,
      notes,
      receiptFile,
      recordedBy: req.session.user._id,
      paymentDate: paymentDate || undefined
    });

    req.flash?.('success', `Payment of KES ${parseFloat(amount).toLocaleString()} recorded successfully`);
    res.redirect('/finance/payments');
  } catch (err) {
    console.error('Error creating payment:', err);
    res.status(500).render('finance/payments/create', {
      user: req.session.user,
      page: 'finance/payments',
      error: 'Failed to record payment: ' + err.message,
      formData: req.body,
      schools: await School.find({}).select('_id name').lean(),
      invoices: []
    });
  }
};

// GET: Payment details
exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('schoolId', 'name contactPerson')
      .populate('invoiceId', 'invoiceNumber totalAmount amountPaid')
      .populate('recordedBy', 'name')
      .lean();

    if (!payment) {
      return res.status(404).render('404', {
        user: req.session.user,
        error: 'Payment not found'
      });
    }

    res.render('finance/payments/view', {
      user: req.session.user,
      page: 'finance/payments',
      payment
    });
  } catch (err) {
    console.error('Error fetching payment:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load payment' });
  }
};

// POST: Cancel payment
exports.cancelPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Only allow cancellation of pending payments
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Only pending payments can be cancelled'
      });
    }

    payment.status = 'cancelled';
    await payment.save();

    // Update invoice status if payment was for an invoice
    if (payment.invoiceId) {
      await InvoiceService.updateInvoiceStatus(payment.invoiceId);
    }

    res.json({ success: true, message: 'Payment cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling payment:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel payment' });
  }
};

// GET: Overdue payments summary
exports.getOverduePayments = async (req, res) => {
  try {
    const overdueSummary = await PaymentService.getOverduePaymentsSummary();

    res.render('finance/payments/overdue', {
      user: req.session.user,
      page: 'finance/payments',
      overdueSummary
    });
  } catch (err) {
    console.error('Error fetching overdue payments:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load overdue payments' });
  }
};

// POST: Send payment reminder
exports.sendPaymentReminder = async (req, res) => {
  try {
    const { invoiceId } = req.body;

    const invoice = await Invoice.findById(invoiceId)
      .populate('schoolId', 'name contactPerson email');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Send reminder email
    const emailService = require('../services/emailService');
    await emailService.sendEmail({
      to: invoice.schoolId.contactPerson?.email,
      subject: `Payment Reminder - Invoice ${invoice.invoiceNumber}`,
      templateId: 'payment_reminder',
      templateData: {
        schoolName: invoice.schoolId.name,
        invoiceNumber: invoice.invoiceNumber,
        amountDue: invoice.totalAmount - invoice.amountPaid,
        dueDate: invoice.dueDate.toDateString(),
        daysOverdue: Math.max(0, Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24)))
      }
    });

    res.json({ success: true, message: 'Payment reminder sent successfully' });
  } catch (err) {
    console.error('Error sending payment reminder:', err);
    res.status(500).json({ success: false, error: 'Failed to send reminder' });
  }
};

// API: Get payment methods summary
exports.getPaymentMethodsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.paymentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const methodsSummary = await Payment.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      {
        $group: {
          _id: '$method',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({ success: true, data: methodsSummary });
  } catch (err) {
    console.error('Error fetching payment methods summary:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
};