/*
 * backend/services/invoiceService.js
 * Service for auto-generating invoices based on events and programs
 */
const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const School = require('../../models/School');
const Event = require('../../models/Event');
const Program = require('../../models/Program');
const ServicePackage = require('../../models/ServicePackage');

class InvoiceService {
  // Generate unique invoice number
  static generateInvoiceNumber(prefix = 'INV') {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  // Auto-generate invoices for completed events
  static async generateEventInvoices(eventId) {
    try {
      const event = await Event.findById(eventId)
        .populate('targetSchools.schoolId')
        .populate('trainers.trainerId');

      if (!event || event.status !== 'completed') {
        throw new Error('Event not found or not completed');
      }

      const invoices = [];

      for (const targetSchool of event.targetSchools) {
        const school = targetSchool.schoolId;
        if (!school) continue;

        // Check if invoice already exists for this event and school
        const existingInvoice = await Invoice.findOne({
          schoolId: school._id,
          'items.eventId': event._id
        });

        if (existingInvoice) continue;

        // Calculate invoice amount based on attendance and rates
        const attendance = targetSchool.attendance?.attended || 0;
        const ratePerStudent = school.paymentTerms?.ratePerStudent || 500; // Default KES 500 per student
        const subtotal = attendance * ratePerStudent;

        if (subtotal === 0) continue;

        // Create invoice items
        const items = [{
          description: `${event.name} - Scout Program (${attendance} participants)`,
          quantity: attendance,
          unitPrice: ratePerStudent,
          total: subtotal,
          eventId: event._id,
          notes: `Event held on ${event.startDate.toDateString()}`
        }];

        // Calculate due date (30 days from issue date)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (school.invoiceSettings?.paymentTermsDays || 30));

        const invoice = new Invoice({
          invoiceNumber: this.generateInvoiceNumber(),
          schoolId: school._id,
          issueDate: new Date(),
          dueDate: dueDate,
          items: items,
          subtotal: subtotal,
          taxTotal: 0,
          discountAmount: 0,
          totalAmount: subtotal,
          status: 'issued'
        });

        await invoice.save();
        invoices.push(invoice);
      }

      return invoices;
    } catch (error) {
      console.error('Error generating event invoices:', error);
      throw error;
    }
  }

  // Auto-generate invoices for weekly/monthly programs
  static async generateProgramInvoices(schoolId, period = 'monthly') {
    try {
      const school = await School.findById(schoolId);
      if (!school) throw new Error('School not found');

      const now = new Date();
      let startDate, endDate;

      if (period === 'weekly') {
        // Previous week
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else {
        // Previous month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      }

      // Check if invoice already exists for this period
      const existingInvoice = await Invoice.findOne({
        schoolId: school._id,
        issueDate: { $gte: startDate, $lte: endDate },
        'items.description': new RegExp(`${period} program`, 'i')
      });

      if (existingInvoice) return null;

      // Get enrolled programs
      const enrolledPrograms = await Program.find({
        _id: { $in: school.programsEnrolled },
        status: 'active'
      });

      if (enrolledPrograms.length === 0) return null;

      const items = [];
      let subtotal = 0;

      for (const program of enrolledPrograms) {
        // Calculate based on billing cycle
        let quantity = 1;
        let description = `${program.name} - ${period} program`;

        if (school.paymentTerms?.billingCycle === 'weekly' && period === 'weekly') {
          quantity = 1;
        } else if (school.paymentTerms?.billingCycle === 'monthly' && period === 'monthly') {
          quantity = 1;
        } else {
          continue; // Skip if billing cycle doesn't match period
        }

        const total = quantity * program.price.amount;
        items.push({
          description: description,
          quantity: quantity,
          unitPrice: program.price.amount,
          total: total,
          servicePackageId: program._id,
          notes: `${period} billing period: ${startDate.toDateString()} - ${endDate.toDateString()}`
        });

        subtotal += total;
      }

      if (subtotal === 0) return null;

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (school.invoiceSettings?.paymentTermsDays || 30));

      const invoice = new Invoice({
        invoiceNumber: this.generateInvoiceNumber(),
        schoolId: school._id,
        issueDate: new Date(),
        dueDate: dueDate,
        items: items,
        subtotal: subtotal,
        taxTotal: 0,
        discountAmount: 0,
        totalAmount: subtotal,
        status: 'issued'
      });

      await invoice.save();
      return invoice;
    } catch (error) {
      console.error('Error generating program invoices:', error);
      throw error;
    }
  }

  // Update invoice status based on payments
  static async updateInvoiceStatus(invoiceId) {
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
      console.error('Error updating invoice status:', error);
      throw error;
    }
  }

  // Get overdue accounts
  static async getOverdueAccounts() {
    try {
      const now = new Date();
      const overdueInvoices = await Invoice.find({
        dueDate: { $lt: now },
        status: { $in: ['issued', 'partial'] },
        totalAmount: { $gt: 0 }
      })
      .populate('schoolId', 'name contactPerson email')
      .sort({ dueDate: 1 });

      return overdueInvoices.map(invoice => ({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        schoolName: invoice.schoolId?.name || 'Unknown School',
        schoolEmail: invoice.schoolId?.contactPerson?.email || '',
        amountDue: invoice.totalAmount - invoice.amountPaid,
        daysOverdue: Math.floor((now - invoice.dueDate) / (1000 * 60 * 60 * 24)),
        dueDate: invoice.dueDate
      }));
    } catch (error) {
      console.error('Error getting overdue accounts:', error);
      throw error;
    }
  }
}

module.exports = InvoiceService;