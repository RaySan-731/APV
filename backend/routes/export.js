/*
 * backend/routes/export.js
 * Routes for data export (CSV/PDF) and scheduled reports
 */

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { requireAuth, requirePermission } = require('../middleware/auth');

/**
 * GET /api/export/:reportType
 * Export report to CSV or PDF
 * Query: format=csv|pdf, filters...
 */
router.get('/export/:reportType', requireAuth, requirePermission('canViewAnalytics'), exportController.exportReport);

/**
 * POST /api/reports/templates/save
 * Save custom report template
 */
router.post('/templates/save', requireAuth, requirePermission('canGenerateReports'), exportController.saveTemplate);

/**
 * GET /api/reports/templates
 * Get all saved templates
 */
router.get('/templates', requireAuth, requirePermission('canGenerateReports'), exportController.getReportTemplates);

/**
 * GET /api/reports/scheduled
 * Get all scheduled reports
 */
router.get('/scheduled', requireAuth, requirePermission('canGenerateReports'), exportController.getScheduledReports);

/**
 * POST /api/reports/scheduled
 * Create scheduled report
 */
router.post('/scheduled', requireAuth, requirePermission('canGenerateReports'), exportController.createScheduledReport);

module.exports = router;
