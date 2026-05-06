/*
 * backend/controllers/payrollController.js
 * Controller for trainer payroll calculation, payslip generation, and payment tracking.
 */
const mongoose = require('mongoose');
const Payroll = require('../../models/Payroll');
const Staff = require('../../models/Staff');
const Event = require('../../models/Event');
const Payment = require('../../models/Payment');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper: Generate unique payroll number
const generatePayrollNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PAY-${timestamp}-${random}`;
};

// GET: Payroll dashboard
exports.getPayrollDashboard = async (req, res) => {
  try {
    const { trainerId, period, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (trainerId) query.trainerId = mongoose.Types.ObjectId(trainerId);
    if (period) {
      const [year, month] = period.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      query.periodStart = { $gte: start };
      query.periodEnd = { $lte: end };
    }
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payrolls, total] = await Promise.all([
      Payroll.find(query)
        .populate('trainerId', 'name email idNumber')
        .populate('approvedBy', 'name')
        .sort({ periodStart: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payroll.countDocuments(query)
    ]);

    // Summary stats
    const summary = await Payroll.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netAmount' },
          totalDeductions: { $sum: '$deductions' }
        }
      }
    ]);

    res.render('finance/payroll/index', {
      user: req.session.user,
      page: 'finance/payroll',
      payrolls,
      trainers: await Staff.find({ role: 'trainer' }).select('_id name').lean(),
      summary: summary[0] || { totalCount: 0, totalGross: 0, totalNet: 0, totalDeductions: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: { trainerId, period, status }
    });
  } catch (err) {
    console.error('Error fetching payroll:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load payroll data' });
  }
};

// GET: Calculate payroll for a trainer/period
exports.calculatePayroll = async (req, res) => {
  try {
    const { trainerId, periodStart, periodEnd } = req.query;

    const trainer = await Staff.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999);

    // Get completed events for this trainer in the period
    const events = await Event.find({
      'trainers.trainerId': trainerId,
      status: 'completed',
      startDate: { $gte: startDate, $lte: endDate }
    }).lean();

    const items = [];
    let grossAmount = 0;

    // Daily rate earnings
    events.forEach(event => {
      const days = Math.ceil((new Date(event.endDate) - new Date(event.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      const dailyRate = trainer.compensationRates?.dailyRate || 0;

      items.push({
        type: 'daily_rate',
        description: `Daily rate - ${event.name}`,
        quantity: days,
        rate: dailyRate,
        amount: days * dailyRate,
        eventIds: [event._id]
      });
      grossAmount += days * dailyRate;

      // Transport allowance
      if (trainer.compensationRates?.transportAllowance) {
        items.push({
          type: 'transport_allowance',
          description: `Transport allowance - ${event.name}`,
          quantity: 1,
          rate: trainer.compensationRates.transportAllowance,
          amount: trainer.compensationRates.transportAllowance,
          eventIds: [event._id]
        });
        grossAmount += trainer.compensationRates.transportAllowance;
      }

      // Meal allowance
      if (trainer.compensationRates?.mealAllowance) {
        items.push({
          type: 'meal_allowance',
          description: `Meal allowance - ${event.name}`,
          quantity: days,
          rate: trainer.compensationRates.mealAllowance,
          amount: days * trainer.compensationRates.mealAllowance,
          eventIds: [event._id]
        });
        grossAmount += days * trainer.compensationRates.mealAllowance;
      }

      // Overnight allowance
      if (trainer.compensationRates?.overnightAllowance) {
        items.push({
          type: 'overnight_allowance',
          description: `Overnight allowance - ${event.name}`,
          quantity: days,
          rate: trainer.compensationRates.overnightAllowance,
          amount: days * trainer.compensationRates.overnightAllowance,
          eventIds: [event._id]
        });
        grossAmount += days * trainer.compensationRates.overnightAllowance;
      }
    });

    // Any existing manual adjustments could be added here

    res.json({
      success: true,
      trainer: {
        name: trainer.name,
        idNumber: trainer.idNumber,
        paymentMethod: trainer.paymentMethod,
        paymentDetails: trainer.paymentDetails
      },
      period: { start: startDate, end: endDate },
      items,
      grossAmount,
      deductions: 0,
      taxAmount: 0,
      netAmount: grossAmount
    });
  } catch (err) {
    console.error('Error calculating payroll:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate payroll' });
  }
};

// POST: Create payroll record
exports.createPayroll = async (req, res) => {
  try {
    const {
      trainerId,
      periodStart,
      periodEnd,
      items,
      deductions,
      taxAmount,
      notes
    } = req.body;

    // Generate payroll number
    const payrollNumber = generatePayrollNumber();

    const payroll = new Payroll({
      payrollNumber,
      trainerId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      items: items || [],
      deductions: parseFloat(deductions) || 0,
      taxAmount: parseFloat(taxAmount) || 0,
      notes,
      status: 'draft',
      createdBy: req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null
    });

    await payroll.save(); // pre-save hook calculates gross and net

    res.json({ success: true, payroll });
  } catch (err) {
    console.error('Error creating payroll:', err);
    res.status(500).json({ success: false, error: 'Failed to create payroll' });
  }
};

// POST: Approve payroll
exports.approvePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({ success: false, error: 'Payroll not found' });
    }

    if (payroll.status !== 'calculated') {
      return res.status(400).json({ success: false, error: 'Payroll must be in calculated state to approve' });
    }

    payroll.status = 'approved';
    payroll.approvedBy = req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null;
    payroll.approvedAt = new Date();
    await payroll.save();

    res.json({ success: true, payroll });
  } catch (err) {
    console.error('Error approving payroll:', err);
    res.status(500).json({ success: false, error: 'Failed to approve payroll' });
  }
};

// POST: Mark payroll as paid
exports.markAsPaid = async (req, res) => {
  try {
    const { paymentReference, paymentMethod } = req.body;
    const payroll = await Payroll.findById(req.params.id)
      .populate('trainerId', 'name paymentMethod paymentDetails');

    if (!payroll) {
      return res.status(404).json({ success: false, error: 'Payroll not found' });
    }

    if (payroll.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Payroll must be approved before marking as paid' });
    }

    payroll.status = 'paid';
    payroll.paidAt = new Date();
    payroll.paymentReference = paymentReference;
    payroll.paymentMethod = paymentMethod || payroll.trainerId?.paymentMethod || 'mpesa';
    payroll.paidBy = req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null;
    await payroll.save();

    // Create Payment record for outflow
    const payment = new Payment({
      paymentType: 'trainer_payroll',
      payrollId: payroll._id,
      trainerId: payroll.trainerId._id,
      amount: payroll.netAmount,
      paymentDate: new Date(),
      paidDate: new Date(),
      method: payroll.paymentMethod,
      reference: paymentReference,
      status: 'completed',
      notes: `Payroll payment for period ${payroll.periodStart.toLocaleDateString()} - ${payroll.periodEnd.toLocaleDateString()}`,
      recordedBy: req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null
    });
    await payment.save();

    res.json({ success: true, payroll, payment });
  } catch (err) {
    console.error('Error marking payroll as paid:', err);
    res.status(500).json({ success: false, error: 'Failed to mark payroll as paid' });
  }
};

// GET: Generate payslip PDF
exports.generatePayslipPDF = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('trainerId', 'name idNumber email paymentDetails')
      .populate('approvedBy', 'name');

    if (!payroll) {
      return res.status(404).send('Payroll not found');
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `payslip_${payroll.payrollNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(18).text('PAYSLIP', { align: 'center' });
    doc.fontSize(10);
    doc.text(`Payroll Number: ${payroll.payrollNumber}`, { align: 'right' });
    doc.moveDown();

    // Employee details
    doc.fontSize(12);
    doc.text('Employee:', { continued: true });
    doc.font('Helvetica-Bold');
    doc.text(`${payroll.trainerId.name} (${payroll.trainerId.idNumber || 'N/A'})`);
    doc.font('Helvetica');
    doc.text(`Payment Method: ${payroll.paymentMethod || 'M-Pesa'}`);
    if (payroll.trainerId.paymentDetails?.mpesaNumber) {
      doc.text(`M-Pesa: ${payroll.trainerId.paymentDetails.mpesaNumber}`);
    } else if (payroll.trainerId.paymentDetails?.accountNumber) {
      doc.text(`Account: ${payroll.trainerId.paymentDetails.accountNumber}`);
    }
    doc.moveDown();

    // Period
    doc.text(`Period: ${payroll.periodStart.toLocaleDateString()} - ${payroll.periodEnd.toLocaleDateString()}`);
    doc.text(`Payment Date: ${payroll.paymentDate ? new Date(payroll.paymentDate).toLocaleDateString() : 'Pending'}`);
    doc.moveDown();

    // Earnings breakdown
    doc.fontSize(14).text('Earnings', { underline: true });
    doc.fontSize(12);
    doc.moveDown();

    payroll.items.forEach(item => {
      doc.text(`${item.description}`, { continued: true, width: 300 });
      doc.text(`KES ${item.amount.toFixed(2)}`, { align: 'right' });
      doc.moveDown();
    });

    doc.moveDown();
    // Totals
    doc.font('Helvetica-Bold');
    doc.text(`Gross Pay: KES ${payroll.grossAmount.toFixed(2)}`, { align: 'right' });
    doc.text(`Deductions: KES ${payroll.deductions.toFixed(2)}`, { align: 'right' });
    doc.text(`Tax: KES ${payroll.taxAmount.toFixed(2)}`, { align: 'right' });
    doc.moveDown();
    doc.text(`NET PAY: KES ${payroll.netAmount.toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica');

    if (payroll.notes) {
      doc.moveDown();
      doc.text(`Notes: ${payroll.notes}`);
    }

    doc.end();
  } catch (err) {
    console.error('Error generating payslip:', err);
    res.status(500).send('Failed to generate payslip');
  }
};

// GET: Trainer payroll history
exports.getTrainerPayrollHistory = async (req, res) => {
  try {
    const trainerId = req.params.trainerId;
    const trainer = await Staff.findById(trainerId);

    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    const payrolls = await Payroll.find({ trainerId })
      .sort({ periodStart: -1 })
      .limit(12)
      .lean();

    res.json({ success: true, trainer: { name: trainer.name }, payrolls });
  } catch (err) {
    console.error('Error fetching trainer payroll:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch payroll history' });
  }
};

module.exports = exports;
