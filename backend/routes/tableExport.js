/**
 * backend/routes/tableExport.js
 * Routes for generic table export (CSV / PDF)
 */

const express = require('express');
const router = express.Router();
const tableExportController = require('../controllers/tableExportController');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/table/export
 * Body: { tableId, headers[], rows[], title, filename, excludeColumns }
 * Query: ?format=csv|pdf
 */
router.post('/table/export', requireAuth, tableExportController.exportTable);

module.exports = router;
