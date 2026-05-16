/**
 * backend/controllers/tableExportController.js
 * Generic table-export controller (CSV + PDF) for any page table.
 * Data is extracted client-side from the DOM and POSTed here.
 */

const { escapeCsv, buildCsv, streamBrandedPdf } = require('../utils/exportUtils');

/**
 * POST /api/table/export
 * Body: { tableId, headers[], rows[], title?, filename?, excludeColumns? }
 * Query: ?format=csv|pdf
 */
exports.exportTable = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    let {
      headers = [],
      rows = [],
      title = 'Export',
      filename = 'export',
      excludeColumns = [],
    } = req.body;

    // Normalise exclude columns for case-insensitive comparison
    const normalize = (s) => (s || '').trim().toLowerCase();
    const excludeSet = new Set(excludeColumns.map(normalize));

    if (headers.length === 0 || rows.length === 0) {
      return res.status(400).json({ error: 'No data to export' });
    }

    // Build filtered row data
    const safeRows = rows.map((row) => {
      const safe = {};
      headers.forEach((h) => {
        if (excludeSet.has(normalize(h))) return;
        safe[h] = row[h] ?? '';
      });
      return safe;
    });

    const safeHeaders = headers.filter((h) => !excludeSet.has(normalize(h)));
    const baseFilename = (filename || title || 'export').replace(/\s+/g, '_');
    const dateSuffix = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const csv = buildCsv(safeHeaders, safeRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}_${dateSuffix}.csv"`);
      res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
    } else if (format === 'pdf') {
      await streamBrandedPdf(res, safeHeaders, safeRows, title, baseFilename);
    } else {
      res.status(400).json({ error: 'Unsupported format. Use csv or pdf.' });
    }
  } catch (error) {
    console.error('Table export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};
