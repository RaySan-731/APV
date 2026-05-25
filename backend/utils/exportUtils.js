/**
 * backend/utils/exportUtils.js
 * Shared utilities for CSV and PDF table export
 */

/**
 * Escape a single CSV field value according to RFC 4180.
 */
function escapeCsv(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from an array of row objects and a header array.
 * @param {string[]} headers - Column header strings
 * @param {Record<string,any>[]} rows - Row data objects
 * @returns {string}
 */
function buildCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(','))
  ];
  return lines.join('\n');
}

/**
 * Build a branded PDF using pdfkit and pipe to a response Writable.
 * @param {import('pdfkit').PDFDocumentOptions} [opts] - Options passed to new PDFDocument
 * @returns {{ doc: any, finish: () => void }}
 */
function createPdfStream(res) {
  const PDFDocument = require('pdfkit');
  const path = require('path');
  const fs = require('fs');
  const SystemSettings = require('../../models/SystemSettings');

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  return { doc, async finish() { doc.end(); } };
}

/**
 * Render a branded PDF (logo + org name + tagline + timestamp + table) directly
 * into the response object and call `res` to finish the download.
 *
 * @param {import('express').Response} res   - Express response
 * @param {string[]}  headers   - Column headers
 * @param {Record<string,any>[]} rows   - Row data objects
 * @param {string} title        - Report / table title
 * @param {string} filename     - Suggested filename (without extension)
 */
async function streamBrandedPdf(res, headers, rows, title, filename) {
  const PDFDocument = require('pdfkit');
  const path = require('path');
  const fs = require('fs');
  const SystemSettings = require('../../models/SystemSettings');

  const systemSettings = await SystemSettings.findOne({ _id: 'global-settings' });
  const org = systemSettings?.organization || {};

  const doc = new PDFDocument({ 
    margin: 45,
    size: 'A4',
    info: {
      Title: title || 'Report',
      Author: org.organizationName || 'Arrow-Park Ventures',
      Subject: 'Financial Report'
    }
  });

  const primaryColor = org.primaryColor || '#1e40af'; // Professional blue
  const accentColor = '#1e3a8a'; // Darker blue for accents
  const lightGray = '#f1f5f9';
  const borderColor = '#cbd5e1';

  const unused = new Date().toISOString().split('T')[0];
  const safeFilename = (filename || title || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}_${unused}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const leftMargin = 45;
  const rightMargin = 45;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  let y = 50;

  // ─────────────────────────────────────────────────────────────
  // HEADER SECTION
  // ─────────────────────────────────────────────────────────────

  // Top accent bar
  doc.rect(0, 0, pageWidth, 8).fill(primaryColor);

  // Logo
  const logoWidth = Math.min(org.logoWidth || 48, 60);
  let logoPlaced = false;

  if (org.logoUrl) {
    try {
      let imagePath = org.logoUrl;
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        const x = leftMargin;
        doc.image(imagePath, x, y, { width: logoWidth });
        logoPlaced = true;
      } else {
        const relativePath = imagePath.replace(/^\//, '');
        const absolutePath = path.join(__dirname, '..', '..', 'public', relativePath);
        if (fs.existsSync(absolutePath)) {
          doc.image(absolutePath, leftMargin, y, { width: logoWidth });
          logoPlaced = true;
        }
      }
    } catch (e) {
      // Logo is optional
    }
  }

  if (logoPlaced) {
    y += logoWidth + 12;
  }

  // Organization Name
  doc.font('Helvetica-Bold')
     .fontSize(22)
     .fillColor('#1e293b')
     .text(org.organizationName || 'Arrow-Park Ventures', leftMargin, y);

  y += 26;

  // Tagline (if exists)
  if (org.tagline) {
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#64748b')
       .text(org.tagline, leftMargin, y);
    y += 16;
  }

  // Report Title
  doc.font('Helvetica-Bold')
     .fontSize(16)
     .fillColor(primaryColor)
     .text(title || 'Report', leftMargin, y);

  y += 20;

  // Subtle separator line
  doc.strokeColor(primaryColor)
     .lineWidth(1.5)
     .moveTo(leftMargin, y)
     .lineTo(pageWidth - rightMargin, y)
     .stroke();

  y += 18;

  // Generated timestamp
  doc.font('Helvetica')
     .fontSize(9)
     .fillColor('#64748b')
     .text(`Generated on ${new Date().toLocaleString()}`, leftMargin, y);

  y += 25;

  // ─────────────────────────────────────────────────────────────
  // TABLE
  // ─────────────────────────────────────────────────────────────

  if (!headers || headers.length === 0 || !rows || rows.length === 0) {
    doc.font('Helvetica-Oblique')
       .fontSize(11)
       .fillColor('#64748b')
       .text('No data available for this report.', leftMargin, y);
    doc.end();
    return;
  }

  const tableLeft = leftMargin;
  const tableWidth = contentWidth;
  const colWidth = tableWidth / headers.length;
  const headerHeight = 26;
  const rowHeight = 22;
  const padding = 6;

  // Draw table header background
  doc.rect(tableLeft, y, tableWidth, headerHeight)
     .fill(primaryColor);

  // Header text
  doc.font('Helvetica-Bold')
     .fontSize(10)
     .fillColor('#ffffff');

  headers.forEach((header, i) => {
    const x = tableLeft + i * colWidth + padding;
    doc.text(header, x, y + 7, {
      width: colWidth - padding * 2,
      align: 'left'
    });
  });

  y += headerHeight;

  // Draw rows
  rows.forEach((row, rowIndex) => {
    // Check for page break
    if (y + rowHeight > pageHeight - 70) {
      // Footer for current page
      drawFooter(doc, pageWidth, pageHeight, primaryColor);
      doc.addPage();
      y = 50;

      // Repeat header on new page
      doc.rect(tableLeft, y, tableWidth, headerHeight)
         .fill(primaryColor);

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('#ffffff');

      headers.forEach((header, i) => {
        const x = tableLeft + i * colWidth + padding;
        doc.text(header, x, y + 7, {
          width: colWidth - padding * 2,
          align: 'left'
        });
      });

      y += headerHeight;
    }

    const isEven = rowIndex % 2 === 0;
    const bgColor = isEven ? '#ffffff' : lightGray;

    // Row background
    doc.rect(tableLeft, y, tableWidth, rowHeight)
       .fill(bgColor);

    // Draw light horizontal line
    doc.strokeColor(borderColor)
       .lineWidth(0.5)
       .moveTo(tableLeft, y + rowHeight)
       .lineTo(tableLeft + tableWidth, y + rowHeight)
       .stroke();

    // Cell content
    headers.forEach((header, i) => {
      const value = row[header] ?? '';
      const x = tableLeft + i * colWidth + padding;
      const cellWidth = colWidth - padding * 2;

      const isNumber = typeof value === 'number' || 
                      (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value));

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#1e293b');

      doc.text(String(value), x, y + 6, {
        width: cellWidth,
        align: isNumber ? 'right' : 'left'
      });
    });

    y += rowHeight;
  });

  // Final bottom border
  doc.strokeColor(primaryColor)
     .lineWidth(1)
     .moveTo(tableLeft, y)
     .lineTo(tableLeft + tableWidth, y)
     .stroke();

  y += 20;

  // ─────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────
  drawFooter(doc, pageWidth, pageHeight, primaryColor);

  doc.end();
}

function drawFooter(doc, pageWidth, pageHeight, primaryColor) {
  const footerY = pageHeight - 35;
  
  // Subtle top line
  doc.strokeColor('#e2e8f0')
     .lineWidth(0.5)
     .moveTo(45, footerY - 5)
     .lineTo(pageWidth - 45, footerY - 5)
     .stroke();

  doc.font('Helvetica')
     .fontSize(8)
     .fillColor('#64748b')
     .text('Arrow-Park Ventures • Confidential', 45, footerY);

  // Page number (right aligned)
  const pageNum = doc.bufferedPageRange ? 
    (doc.bufferedPageRange().start + 1) : 
    (doc.page ? doc.page.number || 1 : 1);

  doc.text(`Page ${pageNum}`, pageWidth - 120, footerY, {
    width: 75,
    align: 'right'
  });
}

module.exports = { escapeCsv, buildCsv, createPdfStream, streamBrandedPdf };
