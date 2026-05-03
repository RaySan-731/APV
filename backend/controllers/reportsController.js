/*
 * backend/controllers/reportsController.js
 * Controller for various analytics reports
 */

const { getTrainerPerformance, getEventEffectiveness, getSchoolEngagement } = require('../utils/aggregations');

/**
 * GET Trainer Performance Report
 * Query params: trainerId, dateRange, sortBy, sortOrder
 */
exports.getTrainerPerformanceReport = async (req, res) => {
  try {
    const { trainerId, dateRange = '90d', sortBy = 'eventsCompleted', sortOrder = 'desc' } = req.query;

    const data = await getTrainerPerformance({
      trainerId,
      dateRange,
      sortBy,
      sortOrder
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching trainer performance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trainer performance data' });
  }
};

/**
 * GET Event Effectiveness Report
 */
exports.getEventEffectivenessReport = async (req, res) => {
  try {
    const { eventType, dateRange = '90d', region } = req.query;
    const data = await getEventEffectiveness({ eventType, dateRange, region });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching event effectiveness:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event effectiveness data' });
  }
};

/**
 * GET School Engagement Report
 */
exports.getSchoolEngagementReport = async (req, res) => {
  try {
    const { schoolId, dateRange = '90d' } = req.query;
    const data = await getSchoolEngagement({ schoolId, dateRange });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching school engagement:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch school engagement data' });
  }
};

/**
 * POST Custom Report Builder
 */
exports.buildCustomReport = async (req, res) => {
  try {
    const config = req.body; // { dimensions, metrics, filters, groupBy }
    const data = await buildCustomReport(config);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error building custom report:', error);
    res.status(500).json({ success: false, error: 'Failed to build report' });
  }
};
