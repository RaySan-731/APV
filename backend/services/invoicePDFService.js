/*
 * backend/services/invoicePDFService.js
 * Service for generating professional invoice PDFs with APV branding
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Invoice = require('../../models/Invoice');
const School = require('../../models/School');
const SystemSettings = require('../../models/SystemSettings');

class InvoicePDFService {
  static async generateInvoicePDF(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate('schoolId', 'name address contactPerson billingAddress paymentTerms bankDetails')
        .populate('items.eventId', 'name startDate location')
        .populate('items.servicePackageId', 'name displayName');

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get system settings for APV details
      const systemSettings = await SystemSettings.findOne() || {};

      return new Promise((resolve, reject) => {
        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          bufferPages: true
        });

        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Generate PDF content
        this.generatePDFContent(doc, invoice, systemSettings);

        doc.end();
      });
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  static generatePDFContent(doc, invoice, systemSettings) {
    const school = invoice.schoolId;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Colors
    const primaryColor = '#1a365d'; // Dark blue
    const secondaryColor = '#4a5568'; // Gray
    const accentColor = '#e53e3e'; // Red for overdue

    // Header Section
    this.addHeader(doc, invoice, systemSettings, pageWidth);

    // Invoice Details Section
    this.addInvoiceDetails(doc, invoice, school, pageWidth);

    // Billing Addresses
    this.addBillingAddresses(doc, invoice, school, systemSettings, pageWidth);

    // Invoice Items Table
    this.addInvoiceItemsTable(doc, invoice, pageWidth);

    // Totals Section
    this.addTotalsSection(doc, invoice, pageWidth);

    // Payment Information
    this.addPaymentInformation(doc, invoice, school, systemSettings, pageWidth);

    // Footer
    this.addFooter(doc, systemSettings, pageWidth, pageHeight);
  }

  static addHeader(doc, invoice, systemSettings, pageWidth) {
    // APV Logo/Branding (placeholder)
    doc.fontSize(24).fillColor('#1a365d').font('Helvetica-Bold');
    doc.text('ARROW-PARK VENTURES', 50, 50);

    doc.fontSize(12).fillColor('#4a5568').font('Helvetica');
    doc.text('Scout Management & Training Services', 50, 75);

    // Contact info
    doc.fontSize(10).fillColor('#666');
    doc.text(systemSettings.companyAddress || 'Nairobi, Kenya', 50, 90);
    doc.text(systemSettings.companyPhone || '+254 XXX XXX XXX', 50, 105);
    doc.text(systemSettings.companyEmail || 'info@apv-scouts.com', 50, 120);

    // Invoice title
    doc.fontSize(20).fillColor('#1a365d').font('Helvetica-Bold');
    doc.text('INVOICE', pageWidth - 200, 50);

    // Invoice number
    doc.fontSize(12).fillColor('#333').font('Helvetica');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - 200, 80);

    // Status badge
    const statusColor = invoice.status === 'paid' ? '#38a169' :
                       invoice.status === 'overdue' ? '#e53e3e' :
                       invoice.status === 'partial' ? '#d69e2e' : '#4a5568';

    doc.fillColor(statusColor).font('Helvetica-Bold');
    doc.text(invoice.status.toUpperCase(), pageWidth - 200, 95);
  }

  static addInvoiceDetails(doc, invoice, school, pageWidth) {
    const yPos = 150;

    // Issue and Due dates
    doc.fillColor('#333').font('Helvetica-Bold').fontSize(11);
    doc.text('Issue Date:', 50, yPos);
    doc.font('Helvetica').text(invoice.issueDate.toDateString(), 120, yPos);

    doc.font('Helvetica-Bold');
    doc.text('Due Date:', 300, yPos);
    doc.font('Helvetica');
    const dueDateColor = new Date() > invoice.dueDate && invoice.status !== 'paid' ? '#e53e3e' : '#333';
    doc.fillColor(dueDateColor);
    doc.text(invoice.dueDate.toDateString(), 370, yPos);

    // School name
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(14);
    doc.text(`Bill To: ${school.name}`, 50, yPos + 30);

    // Contact person
    if (school.contactPerson) {
      doc.fillColor('#666').font('Helvetica').fontSize(10);
      doc.text(`Contact: ${school.contactPerson.name}`, 50, yPos + 50);
      if (school.contactPerson.email) {
        doc.text(`Email: ${school.contactPerson.email}`, 50, yPos + 65);
      }
      if (school.contactPerson.phone) {
        doc.text(`Phone: ${school.contactPerson.phone}`, 50, yPos + 80);
      }
    }
  }

  static addBillingAddresses(doc, invoice, school, systemSettings, pageWidth) {
    const yPos = 250;

    // APV Billing Address
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(11);
    doc.text('From:', 50, yPos);

    doc.fillColor('#333').font('Helvetica').fontSize(10);
    const apvAddress = systemSettings.companyAddress || 'Arrow-Park Ventures\nNairobi, Kenya';
    doc.text(apvAddress, 50, yPos + 15);

    // School Billing Address
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(11);
    doc.text('Bill To:', pageWidth - 200, yPos);

    doc.fillColor('#333').font('Helvetica').fontSize(10);
    const schoolAddress = school.billingAddress || school.address;
    if (schoolAddress) {
      let addressText = '';
      if (schoolAddress.name) addressText += `${schoolAddress.name}\n`;
      if (schoolAddress.address) addressText += `${schoolAddress.address}\n`;
      if (schoolAddress.city) addressText += `${schoolAddress.city}\n`;
      if (schoolAddress.country) addressText += schoolAddress.country;

      doc.text(addressText, pageWidth - 200, yPos + 15);
    }
  }

  static addInvoiceItemsTable(doc, invoice, pageWidth) {
    const tableTop = 350;
    const itemHeight = 25;

    // Table headers
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(10);
    doc.text('Description', 50, tableTop);
    doc.text('Quantity', 300, tableTop);
    doc.text('Unit Price', 380, tableTop);
    doc.text('Total', pageWidth - 100, tableTop);

    // Header line
    doc.moveTo(50, tableTop + 15).lineTo(pageWidth - 50, tableTop + 15).stroke('#ddd');

    // Items
    let yPos = tableTop + 25;
    doc.fillColor('#333').font('Helvetica').fontSize(9);

    invoice.items.forEach((item, index) => {
      // Description
      const description = item.description || 'Service';
      const lines = doc.heightOfString(description, { width: 240 });
      const lineHeight = lines > 12 ? 12 : 10;

      doc.text(description, 50, yPos, { width: 240 });

      // Quantity
      doc.text(item.quantity.toString(), 300, yPos);

      // Unit Price
      doc.text(`KES ${item.unitPrice.toLocaleString()}`, 380, yPos);

      // Total
      doc.text(`KES ${item.total.toLocaleString()}`, pageWidth - 100, yPos);

      yPos += Math.max(itemHeight, lines + 5);

      // Item separator line
      if (index < invoice.items.length - 1) {
        doc.moveTo(50, yPos - 5).lineTo(pageWidth - 50, yPos - 5).stroke('#f0f0f0');
      }
    });

    return yPos;
  }

  static addTotalsSection(doc, invoice, pageWidth) {
    const yPos = 500;

    // Subtotal
    doc.fillColor('#333').font('Helvetica').fontSize(10);
    doc.text('Subtotal:', pageWidth - 200, yPos);
    doc.text(`KES ${invoice.subtotal.toLocaleString()}`, pageWidth - 100, yPos);

    let currentY = yPos + 20;

    // Tax
    if (invoice.taxTotal > 0) {
      doc.text('Tax:', pageWidth - 200, currentY);
      doc.text(`KES ${invoice.taxTotal.toLocaleString()}`, pageWidth - 100, currentY);
      currentY += 20;
    }

    // Discount
    if (invoice.discountAmount > 0) {
      doc.text('Discount:', pageWidth - 200, currentY);
      doc.text(`-KES ${invoice.discountAmount.toLocaleString()}`, pageWidth - 100, currentY);
      currentY += 20;
    }

    // Total line
    doc.moveTo(pageWidth - 200, currentY + 5).lineTo(pageWidth - 50, currentY + 5).stroke('#333');

    // Total
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL:', pageWidth - 200, currentY + 15);
    doc.text(`KES ${invoice.totalAmount.toLocaleString()}`, pageWidth - 100, currentY + 15);

    // Amount Paid
    if (invoice.amountPaid > 0) {
      doc.fillColor('#38a169').font('Helvetica').fontSize(10);
      doc.text('Amount Paid:', pageWidth - 200, currentY + 40);
      doc.text(`KES ${invoice.amountPaid.toLocaleString()}`, pageWidth - 100, currentY + 40);

      // Balance Due
      const balance = invoice.totalAmount - invoice.amountPaid;
      const balanceColor = balance > 0 ? '#e53e3e' : '#38a169';
      doc.fillColor(balanceColor).font('Helvetica-Bold');
      doc.text('Balance Due:', pageWidth - 200, currentY + 60);
      doc.text(`KES ${balance.toLocaleString()}`, pageWidth - 100, currentY + 60);
    }
  }

  static addPaymentInformation(doc, invoice, school, systemSettings, pageWidth) {
    const yPos = 650;

    // Payment Instructions
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(12);
    doc.text('Payment Information', 50, yPos);

    doc.fillColor('#333').font('Helvetica').fontSize(10);
    doc.text('Please make payment to:', 50, yPos + 20);

    // APV Bank Details
    const bankDetails = systemSettings.bankDetails || {
      bankName: 'Example Bank',
      accountName: 'Arrow-Park Ventures Ltd',
      accountNumber: '1234567890',
      branch: 'Nairobi Branch',
      swiftCode: 'EXBKKE'
    };

    let bankY = yPos + 35;
    doc.font('Helvetica-Bold');
    doc.text('Bank Transfer Details:', 70, bankY);
    bankY += 15;

    doc.font('Helvetica');
    doc.text(`Bank: ${bankDetails.bankName}`, 70, bankY); bankY += 12;
    doc.text(`Account Name: ${bankDetails.accountName}`, 70, bankY); bankY += 12;
    doc.text(`Account Number: ${bankDetails.accountNumber}`, 70, bankY); bankY += 12;
    doc.text(`Branch: ${bankDetails.branch}`, 70, bankY); bankY += 12;
    if (bankDetails.swiftCode) {
      doc.text(`SWIFT Code: ${bankDetails.swiftCode}`, 70, bankY); bankY += 12;
    }

    // M-Pesa Option
    if (systemSettings.mpesaNumber) {
      bankY += 10;
      doc.font('Helvetica-Bold');
      doc.text('M-Pesa:', 70, bankY);
      doc.font('Helvetica');
      doc.text(`PayBill: ${systemSettings.mpesaNumber}`, 70, bankY + 12);
      doc.text(`Account: ${invoice.invoiceNumber}`, 70, bankY + 24);
    }

    // Payment Terms
    doc.fillColor('#666').font('Helvetica').fontSize(9);
    doc.text(`Payment is due within ${school.invoiceSettings?.paymentTermsDays || 30} days of invoice date.`, 50, bankY + 50);
    doc.text('Late payments may incur additional charges.', 50, bankY + 62);
  }

  static addFooter(doc, systemSettings, pageWidth, pageHeight) {
    const footerY = pageHeight - 50;

    doc.fillColor('#999').font('Helvetica').fontSize(8);
    doc.text('Thank you for your business!', pageWidth / 2 - 50, footerY, { align: 'center' });

    doc.text(`Generated on ${new Date().toDateString()} by APV Management System`, 50, footerY + 15);

    // Page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#999').font('Helvetica').fontSize(8);
      doc.text(`Page ${i + 1} of ${pages.count}`, pageWidth - 100, footerY + 15);
    }
  }

  // Save PDF to file
  static async saveInvoicePDF(invoiceId, outputPath) {
    try {
      const pdfBuffer = await this.generateInvoicePDF(invoiceId);

      return new Promise((resolve, reject) => {
        fs.writeFile(outputPath, pdfBuffer, (err) => {
          if (err) reject(err);
          else resolve(outputPath);
        });
      });
    } catch (error) {
      console.error('Error saving invoice PDF:', error);
      throw error;
    }
  }
}

module.exports = InvoicePDFService;