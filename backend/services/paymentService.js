/*
 * backend/services/paymentService.js
 * Service for recording and tracking payments from schools
 */
const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const School = require('../../models/School');
const emailService = require('./emailService');

class PaymentService {
   // Record a new payment
   static async recordPayment(paymentData) {
     try {
       const {
         invoiceId,
         schoolId,
         amount,
         method,
         reference,
         notes,
         receiptFile,
         recordedBy,
         paymentDate
       } = paymentData;

       // Validate invoice exists
       let invoice = null;
       if (invoiceId) {
         invoice = await Invoice.findById(invoiceId);
         if (!invoice) {
           throw new Error('Invoice not found');
         }
       }

       // Validate school exists
       const school = await School.findById(schoolId);
       if (!school) {
         throw new Error('School not found');
       }

       // Generate payment reference if not provided
       const paymentReference = reference || this.generatePaymentReference(method);

       // Create payment record
       const payment = new Payment({
         paymentType: invoiceId ? 'invoice' : 'other',
         invoiceId: invoiceId || null,
         invoiceNumber: invoice?.invoiceNumber || null,
         schoolId: schoolId,
         amount: amount,
         currency: school.paymentTerms?.currency || 'KES',
         paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
         method: method,
         reference: paymentReference,
         receiptUrl: receiptFile ? `/uploads/receipts/${receiptFile.filename}` : null,
         receiptFileName: receiptFile ? receiptFile.filename : null,
       checkoutRequestId: paymentData.checkoutRequestId || null,
       transactionMeta: paymentData.transactionMeta || null,
       status: paymentData.status || 'completed',
       notes: notes,
       recordedBy: recordedBy,
       paidDate: paymentData.status === 'completed' ? new Date() : null
     });

       await payment.save();

       // Update invoice status if payment is for an invoice and the payment is completed
       if (invoice && payment.status === 'completed') {
         await this.updateInvoicePaymentStatus(invoice._id);
       }

       // Send confirmation email only once the payment is complete
       if (payment.status === 'completed') {
         await this.sendPaymentConfirmation(payment, school);
       }

       return payment;
     } catch (error) {
       console.error('Error recording payment:', error);
       throw error;
     }
   }

  // Update invoice payment status
  static async updateInvoicePaymentStatus(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) return;

      const payments = await Payment.find({
        invoiceId: invoice._id,
        status: 'completed'
      });

      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = invoice.totalAmount - totalPaid;

      let newStatus = 'issued';
      if (totalPaid === 0) {
        newStatus = 'issued';
      } else if (balance > 0) {
        newStatus = 'partial';
      } else if (balance === 0) {
        newStatus = 'paid';
      }

      // Check if overdue
      const now = new Date();
      if (now > invoice.dueDate && balance > 0) {
        newStatus = 'overdue';
      }

      invoice.amountPaid = totalPaid;
      invoice.status = newStatus;

      await invoice.save();
      return invoice;
    } catch (error) {
      console.error('Error updating invoice payment status:', error);
      throw error;
    }
  }

  static async completePendingPayment({ checkoutRequestId, mpesaReceiptNumber, resultCode, resultDesc, amount, transactionMeta }) {
    try {
      const payment = await Payment.findOne({ checkoutRequestId });
      if (!payment) {
        throw new Error('Pending payment not found');
      }

      payment.status = resultCode === 0 ? 'completed' : 'failed';
      payment.reference = mpesaReceiptNumber || payment.reference || resultDesc || payment.reference;
      payment.notes = [payment.notes, resultDesc].filter(Boolean).join(' | ');
      payment.paidDate = new Date();
      payment.paymentDate = new Date();
      if (amount && amount > 0) {
        payment.amount = amount;
      }
      payment.transactionMeta = transactionMeta || payment.transactionMeta;

      await payment.save();

      if (payment.status === 'completed' && payment.invoiceId) {
        await this.updateInvoicePaymentStatus(payment.invoiceId);
      }

      return payment;
    } catch (error) {
      console.error('Error completing pending payment:', error);
      throw error;
    }
  }

  // Get payment history for a school
  static async getSchoolPaymentHistory(schoolId, options = {}) {
    try {
      const { startDate, endDate, status, page = 1, limit = 20 } = options;

      const query = { schoolId: schoolId };

      if (status) query.status = status;
      if (startDate || endDate) {
        query.paymentDate = {};
        if (startDate) query.paymentDate.$gte = new Date(startDate);
        if (endDate) query.paymentDate.$lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .populate('invoiceId', 'invoiceNumber totalAmount')
          .populate('recordedBy', 'name')
          .sort({ paymentDate: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Payment.countDocuments(query)
      ]);

      const summary = await Payment.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            paymentCount: { $sum: 1 },
            avgPayment: { $avg: '$amount' }
          }
        }
      ]);

      return {
        payments,
        summary: summary[0] || { totalAmount: 0, paymentCount: 0, avgPayment: 0 },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error('Error getting school payment history:', error);
      throw error;
    }
  }

  // Get overdue payments summary
  static async getOverduePaymentsSummary() {
    try {
      const now = new Date();

      const overdueInvoices = await Invoice.aggregate([
        {
          $match: {
            dueDate: { $lt: now },
            status: { $in: ['issued', 'partial'] },
            $expr: { $gt: ['$totalAmount', '$amountPaid'] }
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
          $project: {
            invoiceNumber: 1,
            schoolName: '$school.name',
            schoolEmail: '$school.contactPerson.email',
            totalAmount: 1,
            amountPaid: 1,
            balance: { $subtract: ['$totalAmount', '$amountPaid'] },
            dueDate: 1,
            daysOverdue: {
              $floor: {
                $divide: [
                  { $subtract: [now, '$dueDate'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        },
        { $sort: { daysOverdue: -1 } }
      ]);

      const summary = {
        totalOverdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0),
        overdueCount: overdueInvoices.length,
        accountsOverdue: overdueInvoices
      };

      return summary;
    } catch (error) {
      console.error('Error getting overdue payments summary:', error);
      throw error;
    }
  }

  // Generate payment reference number
  static generatePaymentReference(method) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const prefix = method === 'mpesa' ? 'MPESA' : method === 'bank_transfer' ? 'BT' : 'PAY';
    return `${prefix}-${timestamp}-${random}`;
  }

  // Send payment confirmation email
  static async sendPaymentConfirmation(payment, school) {
    try {
      const emailData = {
        schoolName: school.name,
        amount: payment.amount.toLocaleString(),
        currency: payment.currency,
        paymentDate: payment.paymentDate.toDateString(),
        reference: payment.reference,
        method: payment.method.replace('_', ' ').toUpperCase(),
        invoiceNumber: payment.invoiceNumber || 'N/A'
      };

      await emailService.sendEmail({
        to: school.contactPerson?.email,
        subject: `Payment Confirmation - ${payment.reference}`,
        templateId: 'payment_confirmation',
        templateData: emailData
      });
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      // Don't throw - payment was recorded successfully
    }
  }

  // Process bulk payments (for CSV import)
  static async processBulkPayments(paymentsData, recordedBy) {
    const results = {
      successful: [],
      failed: []
    };

    for (const paymentData of paymentsData) {
      try {
        const payment = await this.recordPayment({
          ...paymentData,
          recordedBy
        });
        results.successful.push(payment);
      } catch (error) {
        results.failed.push({
          data: paymentData,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = PaymentService;