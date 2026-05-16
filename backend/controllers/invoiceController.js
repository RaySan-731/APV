/*
 * backend/controllers/invoiceController.js
 * Controller for invoice management, generation, and PDF exports.
 */
const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const School = require('../../models/School');
const Event = require('../../models/Event');
const ServicePackage = require('../../models/ServicePackage');
const Payment = require('../../models/Payment');
const PaymentService = require('../services/paymentService');
const InvoicePDFService = require('../services/invoicePDFService');
const fs = require('fs');
const path = require('path');

// Helper: Generate unique invoice number
const generateInvoiceNumber = (prefix = 'INV') => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

// GET: List invoices with filters
exports.getInvoices = async (req, res) => {
  try {
    const {
      schoolId,
      status,
      startDate,
      endDate,
      invoiceType,
      page = 1,
      limit = 20,
      sortBy = 'issueDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (schoolId) query.schoolId = mongoose.Types.ObjectId(schoolId);
    if (status) query.status = status;
    if (invoiceType) query.invoiceType = invoiceType;
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('schoolId', 'name contactPerson')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Invoice.countDocuments(query)
    ]);

    // Calculate summary stats
    const summary = await Invoice.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          totalOutstanding: { $sum: '$balance' }
        }
      }
    ]);

     res.render('finance/invoices/index', {
       user: req.session.user,
       page: 'finance/invoices',
       invoices,
       summary: summary[0] || { totalCount: 0, totalAmount: 0, totalPaid: 0, totalOutstanding: 0 },
       pagination: {
         page: parseInt(page),
         limit: parseInt(limit),
         total,
         pages: Math.ceil(total / parseInt(limit))
       },
       filters: { schoolId, status, startDate, endDate, invoiceType },
       schools: await School.find({}).select('_id name').lean()
     });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load invoices' });
  }
};

// GET: Single invoice detail
exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('schoolId', 'name email contactPerson billingAddress paymentTerms')
      .populate('issuedBy', 'name email')
      .populate('items.eventId', 'name startDate')
      .lean();

    if (!invoice) {
      return res.status(404).render('404', { user: req.session.user, error: 'Invoice not found' });
    }

    // Get associated payments
    const payments = await Payment.find({ invoiceId: invoice._id })
      .sort({ paymentDate: -1 })
      .lean();

    res.render('finance/invoices/detail', {
      user: req.session.user,
      page: 'finance/invoices',
      invoice,
      payments,
      bankDetails: {
        bankName: process.env.BANK_NAME || 'APV Ventures Ltd',
        accountName: process.env.BANK_ACCOUNT_NAME || 'Arrow-Park Ventures',
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
        branch: process.env.BANK_BRANCH || 'Nairobi',
        swiftCode: process.env.BANK_SWIFT || 'AFRIKENXXX',
        mpesaTillNumber: process.env.MPESA_TILL || '123456'
      }
    });
  } catch (err) {
    console.error('Error fetching invoice:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load invoice' });
  }
};

// POST: Create new invoice (manual or auto-generated)
exports.createInvoice = async (req, res) => {
  try {
    const {
      schoolId,
      invoiceType,
      relatedEvents,
      servicePackageId,
      customItems,
      issueDate,
      dueDate,
      notes,
      terms,
      currency = 'KES'
    } = req.body;

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    let items = [];
    let subtotal = 0;

    if (invoiceType === 'event' && relatedEvents) {
      // Auto-generate invoice from events
      const events = await Event.find({
        _id: { $in: relatedEvents },
        'targetSchools.schoolId': schoolId,
        status: { $in: ['completed', 'in_progress'] }
      });

      const ratePerStudent = school.paymentTerms?.ratePerStudent || 0;

      for (const event of events) {
        // Prefer event-specific attendee count when available; fall back to school.studentCount.
        const eventQuantity =
          event.review?.actualAttendeeCount ||
          event.review?.actualParticipantCount ||
          event.review?.actualScoutCount ||
          event.estimatedScoutCount ||
          school.studentCount ||
          0;

        if (eventQuantity <= 0) continue;

        const rate = ratePerStudent || event.costPerParticipant || 0;
        if (rate <= 0) continue;

        const total = rate * eventQuantity;

        items.push({
          description: `Event: ${event.name} (${event.startDate ? event.startDate.toLocaleDateString() : 'No date'}) - ${eventQuantity} participants`,
          quantity: eventQuantity,
          unitPrice: rate,
          total,
          eventId: event._id
        });

        subtotal += total;
      }
    } else if (invoiceType === 'service_package' && servicePackageId) {
      // Invoice based on service package
      const pkg = await ServicePackage.findById(servicePackageId);
      if (!pkg) {
        return res.status(404).json({ success: false, error: 'Service package not found' });
      }

      let quantity = 1;
      if (pkg.pricingModel === 'per_student') {
        quantity = school.studentCount || 1;
      }

      items.push({
        description: `Service Package: ${pkg.displayName}`,
        quantity,
        unitPrice: pkg.ratePerStudent || pkg.monthlyRetainer,
        total: quantity * (pkg.ratePerStudent || pkg.monthlyRetainer),
        servicePackageId: pkg._id
      });
      subtotal = items[0].total;
    } else if (customItems) {
      // Manual line items
      try {
        const parsed = JSON.parse(customItems);
        if (!Array.isArray(parsed)) {
          return res.status(400).json({ success: false, error: 'Custom items must be a JSON array' });
        }
        items = parsed.map(item => ({
          description: item.description || 'Unnamed item',
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0),
          notes: item.notes || ''
        }));
        subtotal = items.reduce((sum, item) => sum + item.total, 0);
      } catch (parseErr) {
        console.error('Error parsing customItems JSON:', parseErr.message);
        return res.status(400).json({ success: false, error: 'Invalid JSON format for custom line items' });
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'No billable items found for invoice' });
    }

    // Calculate totals
    const totalAmount = subtotal;
    const dueDateValue = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const issueDateValue = issueDate ? new Date(issueDate) : new Date();

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber: generateInvoiceNumber(school.invoiceSettings?.prefix || 'INV'),
      schoolId,
      issueDate: issueDateValue,
      dueDate: dueDateValue,
      items,
      subtotal,
      taxTotal: 0,
      totalAmount,
      balance: totalAmount,
      currency,
      invoiceType,
      relatedEvents: relatedEvents || [],
      servicePackageId: servicePackageId || null,
      status: 'issued',
      issuedBy: req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null,
      bankDetails: {
        bankName: process.env.BANK_NAME || 'APV Ventures Ltd',
        accountName: process.env.BANK_ACCOUNT_NAME || 'Arrow-Park Ventures',
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
        branch: process.env.BANK_BRANCH || 'Nairobi',
        swiftCode: process.env.BANK_SWIFT || 'AFRIKENXXX',
        mpesaTillNumber: process.env.MPESA_TILL || '123456'
      },
      billingAddress: school.billingAddress || {
        name: school.name,
        address: school.address?.street,
        city: school.address?.city,
        country: school.address?.country || 'Kenya'
      },
      notes,
      terms: terms || 'Payment due within 30 days. Thank you for your business.'
    });

    await invoice.save();

    res.json({ success: true, invoice });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
};

// POST: Record payment against invoice
exports.recordPayment = async (req, res) => {
  try {
    const { amount, paymentDate, method, reference, notes, receiptFile } = req.body;
    const invoiceId = req.params.id || req.body.invoiceId;

    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Invoice ID is required' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    if (paymentAmount > invoice.balance) {
      return res.status(400).json({ 
        success: false, 
        error: `Payment amount (KES ${paymentAmount}) exceeds outstanding balance (KES ${invoice.balance})` 
      });
    }

    // Use PaymentService to record payment (handles email, status updates)
    const payment = await PaymentService.recordPayment({
      schoolId: invoice.schoolId,
      invoiceId: invoice._id,
      amount: paymentAmount,
      method: method || invoice.paymentMethod,
      reference,
      notes,
      receiptFile: receiptFile || (req.file ? req.file : null),
      recordedBy: req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null
    });

    res.json({ success: true, payment, invoiceBalance: invoice.balance - paymentAmount });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ success: false, error: 'Failed to record payment: ' + err.message });
  }
};

// GET: Auto-generate invoice suggestion based on school
exports.getInvoiceSuggestion = async (req, res) => {
  try {
    const { schoolId } = req.query;

    const school = await School.findById(schoolId)
      .populate('servicePackage')
      .lean();

    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    // Suggest invoice based on billing cycle
    const now = new Date();
    let suggestion = { type: 'custom', items: [], total: 0 };

    if (school.paymentTerms.billingCycle === 'monthly') {
      // Suggest monthly retainer
      suggestion = {
        type: 'monthly_retainer',
        items: [{
          description: `Monthly Service Fee - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          quantity: 1,
          unitPrice: school.servicePackage?.monthlyRetainer || 0,
          total: school.servicePackage?.monthlyRetainer || 0
        }],
        total: school.servicePackage?.monthlyRetainer || 0
      };
    } else if (school.paymentTerms.billingCycle === 'per_event' && school.paymentTerms.ratePerStudent) {
      // Suggest invoice for completed events this period without invoices
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const events = await Event.find({
        'targetSchools.schoolId': schoolId,
        status: 'completed',
        startDate: { $gte: startOfMonth }
      });

      let total = 0;
      suggestion.items = events.map(event => {
        const qty = event.review?.actualAttendeeCount || event.estimatedScoutCount || 0;
        const rate = school.paymentTerms.ratePerStudent;
        const itemTotal = qty * rate;
        total += itemTotal;
        return {
          description: `Event: ${event.name} - ${qty} participants`,
          quantity: qty,
          unitPrice: rate,
          total: itemTotal,
          eventId: event._id
        };
      });
      suggestion.type = 'event';
      suggestion.total = total;
    } else if (school.paymentTerms.billingCycle === 'annual') {
      suggestion = {
        type: 'annual',
        items: [{
          description: 'Annual Service Package Fee',
          quantity: 1,
          unitPrice: school.paymentTerms.ratePerStudent * (school.studentCount || 1),
          total: school.paymentTerms.ratePerStudent * (school.studentCount || 1)
        }],
        total: school.paymentTerms.ratePerStudent * (school.studentCount || 1)
      };
    }

    res.json({ success: true, suggestion, school });
  } catch (err) {
    console.error('Error generating invoice suggestion:', err);
    res.status(500).json({ success: false, error: 'Failed to generate suggestion' });
  }
};

// GET: Download invoice as PDF
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).render('404', { user: req.session.user, error: 'Invoice not found' });
    }

    const pdfBuffer = await InvoicePDFService.generateInvoicePDF(req.params.id);
    const filename = `invoice_${invoice.invoiceNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to generate PDF' });
  }
};


// DELETE: Cancel invoice
exports.cancelInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a paid invoice' });
    }

    invoice.status = 'cancelled';
    await invoice.save();

    res.json({ success: true, message: 'Invoice cancelled' });
  } catch (err) {
    console.error('Error cancelling invoice:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel invoice' });
  }
};

// POST: Send invoice reminder
exports.sendReminder = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('schoolId', 'name contactPerson email');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // TODO: Implement email reminder via emailService
    // For now, just mark reminder sent
    invoice.remindersSent.push({
      sentAt: new Date(),
      method: 'email',
      successful: true
    });
    invoice.lastReminderAt = new Date();
    await invoice.save();

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (err) {
    console.error('Error sending reminder:', err);
    res.status(500).json({ success: false, error: 'Failed to send reminder' });
  }
};

// Helper: Check for overdue invoices (cron job)
exports.checkOverdueInvoices = async () => {
  try {
    const now = new Date();
    const overdueInvoices = await Invoice.find({
      status: { $in: ['issued', 'sent', 'partial'] },
      dueDate: { $lt: now },
      balance: { $gt: 0 }
    }).populate('schoolId', 'name email contactPerson');

    for (const invoice of overdueInvoices) {
      invoice.status = 'overdue';
      await invoice.save();

      // TODO: Send overdue notifications
      console.log(`Invoice ${invoice.invoiceNumber} for ${invoice.schoolId.name} is now overdue.`);
    }

    return overdueInvoices.length;
  } catch (err) {
    console.error('Error checking overdue invoices:', err);
    return 0;
  }
};

// POST: Auto-generate invoices for completed events
exports.generateEventInvoices = async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'Event ID is required' });
    }

    const invoices = await InvoiceService.generateEventInvoices(eventId);

    res.json({
      success: true,
      message: `Generated ${invoices.length} invoice(s) for event`,
      invoices: invoices.map(inv => ({ id: inv._id, number: inv.invoiceNumber }))
    });
  } catch (err) {
    console.error('Error generating event invoices:', err);
    res.status(500).json({ success: false, error: 'Failed to generate invoices: ' + err.message });
  }
};

// POST: Auto-generate program invoices (weekly/monthly)
exports.generateProgramInvoices = async (req, res) => {
  try {
    const { schoolId, period = 'monthly' } = req.body;

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' });
    }

    const invoice = await InvoiceService.generateProgramInvoices(schoolId, period);

    if (invoice) {
      res.json({
        success: true,
        message: `Generated ${period} invoice for school`,
        invoice: { id: invoice._id, number: invoice.invoiceNumber }
      });
    } else {
      res.json({
        success: true,
        message: `No ${period} invoice needed for school (no enrolled programs or already invoiced)`
      });
    }
  } catch (err) {
    console.error('Error generating program invoices:', err);
    res.status(500).json({ success: false, error: 'Failed to generate invoice: ' + err.message });
  }
};

// GET: Get overdue accounts
exports.getOverdueAccounts = async (req, res) => {
  try {
    const overdueAccounts = await InvoiceService.getOverdueAccounts();

    res.render('finance/invoices/overdue', {
      user: req.session.user,
      page: 'finance/invoices',
      overdueAccounts
    });
  } catch (err) {
    console.error('Error fetching overdue accounts:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load overdue accounts' });
  }
};

module.exports = exports;
