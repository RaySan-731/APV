/*
 * backend/utils/aggregations.js
 * Reusable MongoDB aggregation pipelines for analytics and reporting
 */

const mongoose = require('mongoose');
const Event = require('../../models/Event');
const School = require('../../models/School');
const Staff = require('../../models/Staff');
const Payment = require('../../models/Payment');
const Feedback = require('../../models/Feedback');
const VisitLog = require('../../models/VisitLog');

/**
 * Get KPI dashboard metrics
 */
async function getKPIMetrics(dateRange = '30d') {
  const now = new Date();
  const daysAgo = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  // Active schools (status: active)
  const activeSchools = await School.countDocuments({ status: 'active' });

  // Events this month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const eventsThisMonth = await Event.countDocuments({
    startDate: { $gte: thisMonthStart }
  });

  // Trainers deployed (active staff with trainer role)
  const trainersDeployed = await Staff.countDocuments({
    role: { $in: ['trainer', 'senior trainer'] },
    status: 'Active'
  });

  // Total scouts reached (sum of actualAttendeeCount from completed events)
  const scoutsReachedPipeline = await Event.aggregate([
    { $match: { status: 'completed', 'review.actualAttendeeCount': { $exists: true, $ne: null } } },
    { $group: { _id: null, total: { $sum: '$review.actualAttendeeCount' } } }
  ]);
  const totalScoutsReached = scoutsReachedPipeline[0]?.total || 0;

  // Revenue collected (sum of amountPaid)
  const revenuePipeline = await Payment.aggregate([
    { $group: { _id: null, total: { $sum: '$amountPaid' } } }
  ]);
  const revenueCollected = revenuePipeline[0]?.total || 0;

  // Outstanding payments (sum of balance for pending/partial payments)
  const outstandingPipeline = await Payment.aggregate([
    { $match: { status: { $in: ['pending', 'partial', 'overdue'] } } },
    { $group: { _id: null, total: { $sum: '$balance' } } }
  ]);
  const outstandingPayments = outstandingPipeline[0]?.total || 0;

  // Report submission rate
  const totalCompletedEvents = await Event.countDocuments({ status: 'completed' });
  const reportedEvents = await Event.countDocuments({
    status: 'completed',
    'review.reportSubmittedAt': { $exists: true, $ne: null }
  });
  const reportSubmissionRate = totalCompletedEvents > 0
    ? Math.round((reportedEvents / totalCompletedEvents) * 100)
    : 0;

  return {
    activeSchools,
    eventsThisMonth,
    trainersDeployed,
    totalScoutsReached,
    revenueCollected,
    outstandingPayments,
    reportSubmissionRate
  };
}

/**
 * Get trainer performance data for reports
 */
async function getTrainerPerformance(filters = {}) {
  const { trainerId, dateRange, sortBy = 'eventsCompleted', sortOrder = 'desc' } = filters;

  const now = new Date();
  const daysAgo = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : dateRange === '1y' ? 365 : 0;
  const startDate = daysAgo > 0 ? new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000) : null;

  const matchStage = { status: 'completed' };
  if (startDate) matchStage.startDate = { $gte: startDate };
  if (trainerId) matchStage['trainers.trainerId'] = mongoose.Types.ObjectId(trainerId);

  // Pipeline 1: Event-based metrics (events, attendance, reports)
  const eventStatsPipeline = [
    { $match: matchStage },
    { $unwind: '$trainers' },
    {
      $group: {
        _id: '$trainers.trainerId',
        eventsCompleted: { $sum: 1 },
        totalAttendance: {
          $sum: {
            $cond: [{ $ifNull: ['$review.actualAttendeeCount', false] }, '$review.actualAttendeeCount', 0]
          }
        },
        reportsOnTime: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$review.reportSubmittedAt', null] },
                  { $ne: ['$review.reportDueDate', null] },
                  { $lte: ['$review.reportSubmittedAt', '$review.reportDueDate'] }
                ]
              },
              1,
              0
            ]
          }
        },
        reportsLate: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$review.reportSubmittedAt', null] },
                  { $ne: ['$review.reportDueDate', null] },
                  { $gt: ['$review.reportSubmittedAt', '$review.reportDueDate'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ];

  const eventStats = await Event.aggregate(eventStatsPipeline);

  // Pipeline 2: Distinct schools visited per trainer
  const schoolDistinctPipeline = [
    { $match: matchStage },
    { $unwind: '$trainers' },
    { $unwind: '$targetSchools' },
    {
      $group: {
        _id: {
          trainerId: '$trainers.trainerId',
          schoolId: '$targetSchools.schoolId'
        }
      }
    },
    {
      $group: {
        _id: '$_id.trainerId',
        distinctSchoolsCount: { $sum: 1 }
      }
    }
  ];

  const schoolCounts = await Event.aggregate(schoolDistinctPipeline);
  const schoolCountMap = new Map();
  schoolCounts.forEach(sc => {
    schoolCountMap.set(sc._id.toString(), sc.distinctSchoolsCount);
  });

  // Pipeline 3: Feedback avg per trainer from Feedback collection
  const feedbackPipeline = [
    {
      $project: {
        trainerId: 1,
        numericRating: {
          $switch: {
            branches: [
              { case: { $eq: ['$engagementLevel', 'high'] }, then: 3 },
              { case: { $eq: ['$engagementLevel', 'medium'] }, then: 2 },
              { case: { $eq: ['$engagementLevel', 'low'] }, then: 1 }
            ],
            default: 0
          }
        }
      }
    },
    {
      $group: {
        _id: '$trainerId',
        avgFeedback: { $avg: '$numericRating' }
      }
    }
  ];

  const feedbackResults = await Feedback.aggregate(feedbackPipeline);
  const feedbackMap = new Map();
  feedbackResults.forEach(f => {
    feedbackMap.set(f._id.toString(), f.avgFeedback ? parseFloat(f.avgFeedback.toFixed(2)) : 0);
  });

  // Merge data from all pipelines
  const merged = eventStats.map(es => {
    const tid = es._id.toString();
    return {
      trainerId: es._id,
      eventsCompleted: es.eventsCompleted,
      totalAttendance: es.totalAttendance,
      reportsOnTime: es.reportsOnTime,
      reportsLate: es.reportsLate,
      schoolsVisited: schoolCountMap.get(tid) || 0,
      avgFeedback: feedbackMap.get(tid) || 0
    };
  });

  // Sort
  merged.sort((a, b) => {
    const valA = a[sortBy] ?? 0;
    const valB = b[sortBy] ?? 0;
    return sortOrder === 'desc' ? valB - valA : valA - valB;
  });

  // Populate trainer names
  const trainerIds = merged.map(m => mongoose.Types.ObjectId(m.trainerId));
  const staff = await Staff.find({ _id: { $in: trainerIds } }).select('name email role').lean();
  const staffMap = staff.reduce((acc, s) => acc.set(s._id.toString(), s), new Map());

  merged.forEach(item => {
    item.staff = staffMap.get(item.trainerId.toString());
  });

  return merged;
}

/**
 * Get event effectiveness data
 */
async function getEventEffectiveness(filters = {}) {
  const { eventType, dateRange, region } = filters;

  const now = new Date();
  const daysAgo = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  const matchStage = { status: 'completed', startDate: { $gte: startDate } };
  if (eventType) matchStage.eventType = eventType;
  if (region) matchStage.region = region;

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$eventType',
        totalEvents: { $sum: 1 },
        totalRegistered: { $sum: '$currentParticipants' },
        totalAttended: {
          $sum: {
            $cond: [{ $ifNull: ['$review.actualAttendeeCount', false] }, '$review.actualAttendeeCount', 0]
          }
        },
        totalTrainers: { $sum: { $size: '$trainers' } }
      }
    },
    {
      $project: {
        eventType: '$_id',
        totalEvents: 1,
        avgAttendanceRate: {
          $cond: [
            { $eq: ['$totalRegistered', 0] },
            0,
            { $multiply: [{ $divide: ['$totalAttended', '$totalRegistered'] }, 100] }
          ]
        },
        avgTrainerToScoutRatio: {
          $cond: [
            { $eq: ['$totalTrainers', 0] },
            0,
            { $round: [{ $divide: ['$totalAttended', '$totalTrainers'] }, 2] }
          ]
        }
      }
    }
  ];

  return await Event.aggregate(pipeline);
}

/**
 * Get school engagement data
 */
async function getSchoolEngagement(filters = {}) {
  const { schoolId, dateRange = '90d' } = filters;

  const now = new Date();
  const daysAgo = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  // Get schools list
  const schoolMatch = {};
  if (schoolId) schoolMatch._id = mongoose.Types.ObjectId(schoolId);
  const schools = await School.find(schoolMatch).lean();

  const results = [];
  for (const school of schools) {
    // Events attended in date range
    const eventsAttended = await Event.countDocuments({
      'targetSchools.schoolId': school._id,
      status: 'completed',
      startDate: { $gte: startDate }
    });

    // Payment metrics
    const paymentStats = await Payment.aggregate([
      { $match: { schoolId: school._id } },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          onTimePayments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$paidDate', null] },
                    { $ne: ['$dueDate', null] },
                    { $lte: ['$paidDate', '$dueDate'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const paymentData = paymentStats[0] || { totalPayments: 0, onTimePayments: 0 };

    // Feedback average - numeric conversion
    const avgFeedbackResult = await Feedback.aggregate([
      { $match: { schoolId: school._id } },
      {
        $project: {
          numericRating: {
            $switch: {
              branches: [
                { case: { $eq: ['$engagementLevel', 'high'] }, then: 3 },
                { case: { $eq: ['$engagementLevel', 'medium'] }, then: 2 },
                { case: { $eq: ['$engagementLevel', 'low'] }, then: 1 }
              ],
              default: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$numericRating' }
        }
      }
    ]);

    const avgFeedback = avgFeedbackResult[0]?.avg || 0;

    // Calculate engagement score (0-100)
    const attendanceScore = Math.min(eventsAttended * 10, 40); // max 40
    const paymentScore = paymentData.totalPayments > 0
      ? (paymentData.onTimePayments / paymentData.totalPayments) * 30
      : 0;
    const feedbackScore = (avgFeedback / 3) * 10; // normalize to 10 points
    const engagementScore = Math.round(attendanceScore + paymentScore + feedbackScore);

    results.push({
      schoolId: school._id,
      schoolName: school.name,
      eventsAttended,
      totalPayments: paymentData.totalPayments,
      onTimePayments: paymentData.onTimePayments,
      avgFeedback,
      engagementScore,
      studentCount: school.studentCount || 0,
      serviceStatus: school.serviceStatus
    });
  }

  return results;
}

/**
 * Custom report builder - dynamic aggregation
 */
async function buildCustomReport(config) {
  const { dimensions = [], metrics = [], filters = {}, groupBy = null } = config;

  const now = new Date();
  const matchStage = {};

  // Apply filters
  if (filters.dateRange) {
    const daysAgo = filters.dateRange === '30d' ? 30 : filters.dateRange === '90d' ? 90 : 365;
    matchStage.startDate = { $gte: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000) };
  }
  if (filters.schoolIds?.length) {
    matchStage['targetSchools.schoolId'] = { $in: filters.schoolIds.map(id => mongoose.Types.ObjectId(id)) };
  }
  if (filters.trainerIds?.length) {
    matchStage['trainers.trainerId'] = { $in: filters.trainerIds.map(id => mongoose.Types.ObjectId(id)) };
  }
  if (filters.eventType) matchStage.eventType = filters.eventType;
  if (filters.status) matchStage.status = filters.status;

  // Build group stage
  const groupStage = { _id: {} };
  dimensions.forEach(dim => {
    groupStage._id[dim] = `$${dim}`;
  });

  metrics.forEach(metric => {
    switch (metric) {
      case 'totalEvents':
        groupStage.totalEvents = { $sum: 1 };
        break;
      case 'totalScouts':
        groupStage.totalScouts = {
          $sum: {
            $cond: [{ $ifNull: ['$review.actualAttendeeCount', false] }, '$review.actualAttendeeCount', 0]
          }
        };
        break;
      case 'avgAttendance':
        groupStage.avgAttendance = {
          $avg: {
            $cond: [
              { $ifNull: ['$currentParticipants', false] },
              {
                $cond: [
                  { $gt: ['$currentParticipants', 0] },
                  {
                    $multiply: [
                      { $divide: ['$review.actualAttendeeCount', '$currentParticipants'] },
                      100
                    ]
                  },
                  0
                ]
              },
              0
            ]
          }
        };
        break;
    }
  });

  const pipeline = [
    { $match: matchStage },
    { $group: groupStage },
    { $sort: { _id: 1 } }
  ];

  return await Event.aggregate(pipeline);
}

module.exports = {
  getKPIMetrics,
  getTrainerPerformance,
  getEventEffectiveness,
  getSchoolEngagement,
  buildCustomReport
};
