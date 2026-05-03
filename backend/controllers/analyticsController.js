/*
 * backend/controllers/analyticsController.js
 * Controller for KPI dashboard and analytics endpoints
 */

const { getKPIMetrics } = require('../utils/aggregations');

/**
 * GET Dashboard KPI data
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const kpis = await getKPIMetrics(timeRange);

    // Get recent activities from audit logs
    const AuditLog = require('../../models/AuditLog');
    const recentAuditLogs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    const recentActivities = recentAuditLogs.map(log => ({
      title: log.entityName ? `${log.entityName} ${log.action.replace(/_/g, ' ')}` : log.action.replace(/_/g, ' '),
      description: `Performed by ${log.performedBy?.userName || log.performedBy?.userEmail || 'System'}`,
      time: new Date(log.timestamp).toLocaleString()
    }));

    res.json({
      ...kpis,
      recentActivities
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

/**
 * GET Schools analytics overview
 */
exports.getSchoolsAnalytics = async (req, res) => {
  try {
    const { timeRange = '6m' } = req.query;
    let dateFilter = {};
    if (timeRange === '3m') {
      dateFilter.createdAt = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
    } else if (timeRange === '6m') {
      dateFilter.createdAt = { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) };
    } else if (timeRange === '1y') {
      dateFilter.createdAt = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
    }

    const School = require('../models/School');
    const Event = require('../models/Event');

    // Total schools
    const totalSchools = await School.countDocuments();

    // Schools by status
    const byStatus = await School.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Schools by service status
    const byServiceStatus = await School.aggregate([
      { $group: { _id: '$serviceStatus', count: { $sum: 1 } } }
    ]);

    // Top engaged schools
    const topEngaged = await Event.aggregate([
      { $unwind: '$targetSchools' },
      { $group: { _id: '$targetSchools.schoolId', eventCount: { $sum: 1 } } },
      { $sort: { eventCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'schools',
          localField: '_id',
          foreignField: '_id',
          as: 'schoolInfo'
        }
      },
      { $unwind: '$schoolInfo' },
      { $project: { schoolName: '$schoolInfo.name', eventCount: 1, _id: 0 } }
    ]);

    // Inactive schools
    const inactiveThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const inactiveSchools = await School.find({
      $or: [
        { lastVisitDate: { $lt: inactiveThreshold } },
        { lastVisitDate: null }
      ]
    }).select('name lastVisitDate').lean();

    // Region breakdown
    const byRegion = await School.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } }
    ]);

    // Onboarding trends
    const onboardingTrends = await School.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$onboardingDate' },
            month: { $month: '$onboardingDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json({
      totalSchools,
      byStatus,
      byServiceStatus,
      topEngaged,
      inactiveSchools: inactiveSchools.length,
      inactiveDetails: inactiveSchools.slice(0, 10),
      byRegion,
      onboardingTrends
    });
  } catch (error) {
    console.error('Error fetching schools analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
