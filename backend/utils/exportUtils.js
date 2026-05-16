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
  const SystemSettings = require('../models/SystemSettings');

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
  const SystemSettings = require('../models/SystemSettings');

  const systemSettings = await SystemSettings.findOne({ _id: 'global-settings' });
  const org = systemSettings?.organization || {};

  const doc = new PDFDocument({ margin: 50 });
  const unused = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename || title || 'export'}_${unused}.pdf"`);
  doc.pipe(res);

  let currentY = 50;
  const pageWidth = doc.page.width;

  // ── logo ──────────────────────────────────────────────────────────────
  const logoWidth = org.logoWidth || 40;
  let logoPlaced = false;

  if (org.logoUrl) {
    let imagePath = org.logoUrl;
    let imageLoaded = false;

    try {
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        const x = (pageWidth - logoWidth) / 2;
        doc.image(imagePath, x, currentY, { width: logoWidth });
        imageLoaded = true;
      } else {
        const relativePath = imagePath.replace(/^\//, '');
        const absolutePath = path.join(__dirname, '..', '..', 'public', relativePath);
        if (fs.existsSync(absolutePath)) {
          const x = (pageWidth - logoWidth) / 2;
          doc.image(absolutePath, x, currentY, { width: logoWidth });
          imageLoaded = true;
        }
      }
    } catch (_) { /* logo optional */ }

    if (imageLoaded) {
      logoPlaced = true;
      currentY += logoWidth + 15;
      doc.y = currentY;
    }
  }

  // ── header text ───────────────────────────────────────────────────────
  doc.fontSize(20).text(org.organizationName || title || 'Export', { align: 'center' });
  if (org.tagline) doc.fontSize(10).text(org.tagline, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(1);

  // ── table ─────────────────────────────────────────────────────────────
  doc.fontSize(10);
  const tableTop = doc.y;
  const colWidth = (pageWidth - 100) / headers.length;
  const rowHeight = 20;

  headers.forEach((header, i) => {
    doc.text(header, 50 + i * colWidth, tableTop, { width: colWidth, align: 'left' });
  });

  let y = tableTop + rowHeight;
  rows.forEach((row) => {
    headers.forEach((header, i) => {
      doc.text(String(row[header] ?? ''), 50 + i * colWidth, y, { width: colWidth, align: 'left' });
    });
    y += rowHeight;
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 50;
    }
  });

  doc.end();
}

module.exports = { escapeCsv, buildCsv, createPdfStream, streamBrandedPdf };
