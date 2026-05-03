/*
 * backend/routes/reports.js
 * Routes for reports: trainer performance, event effectiveness, school engagement, custom builder, templates
 */

const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { requireAuth, requirePermission } = require('../middleware/auth');

/**
 * GET /api/reports/trainer-performance
 * Trainer performance breakdown
 */
router.get('/trainer-performance', requireAuth, requirePermission('canViewAnalytics'), reportsController.getTrainerPerformanceReport);

/**
 * GET /api/reports/event-effectiveness
 * Event effectiveness analysis
 */
router.get('/event-effectiveness', requireAuth, requirePermission('canViewAnalytics'), reportsController.getEventEffectivenessReport);

/**
 * GET /api/reports/school-engagement
 * School engagement metrics
 */
router.get('/school-engagement', requireAuth, requirePermission('canViewAnalytics'), reportsController.getSchoolEngagementReport);

/**
 * POST /api/reports/custom/build
 * Build custom report based on config
 */
router.post('/custom/build', requireAuth, requirePermission('canGenerateReports'), reportsController.buildCustomReport);

module.exports = router;
