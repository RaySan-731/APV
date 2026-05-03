/*
 * backend/routes/analytics.js
 * Routes for KPI dashboard and analytics
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth, requirePermission } = require('../middleware/auth');

/**
 * GET /api/dashboard-data
 * Main KPI dashboard metrics
 */
router.get('/dashboard-data', requireAuth, analyticsController.getDashboardData);

/**
 * GET /api/schools/analytics
 * Schools analytics overview
 */
router.get('/schools/analytics', requireAuth, requirePermission('canViewAnalytics'), analyticsController.getSchoolsAnalytics);

module.exports = router;
