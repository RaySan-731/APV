const analyticsState = {
  trainerChart: null,
  eventChart: null,
  schoolChart: null,
  statusChart: null,
  trendChart: null
};

let currentTimeRange = '90d';

const CHART_COLORS = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  success: '#10b981',
  successLight: '#34d399',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',
  teal: '#14b8a6',
  pink: '#ec4899'
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

function updateKpi(id, value, suffix = '') {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = typeof value === 'number' ? `${value}${suffix}` : value || '—';
}

function setActiveTimePill(range) {
  document.querySelectorAll('.time-pill').forEach(btn => {
    if (btn.dataset.range === range) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function attachTimeRangeListeners() {
  const pills = document.querySelectorAll('.time-pill');
  if (!pills.length) return;

  pills.forEach(pill => {
    // Remove old listeners if any (defensive)
    pill.onclick = null;
    pill.addEventListener('click', (e) => {
      const range = pill.dataset.range;
      if (!range || range === currentTimeRange) return;
      currentTimeRange = range;
      setActiveTimePill(range);
      // Small delay to let the UI update the active class
      setTimeout(() => refreshAnalytics(), 10);
    }, { passive: true });
  });
}

function buildChart(context, config) {
  if (!context) return null;
  return new Chart(context, config);
}

function destroyChart(chartRef) {
  if (chartRef) {
    chartRef.destroy();
  }
  return null;
}

function getProfessionalBarOptions(yMax = null, showLegend = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: showLegend },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: { color: '#64748b', font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        max: yMax,
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: { color: '#64748b', font: { size: 11 }, precision: 0 }
      }
    }
  };
}

function renderTrainerChart(data) {
  const canvas = document.getElementById('trainerProductivityChart');
  if (!canvas) return;

  destroyChart(analyticsState.trainerChart);

  const labels = data.map(item => item.staff?.name || 'Unknown');
  const values = data.map(item => item.eventsCompleted || 0);

  const colors = [
    CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning,
    CHART_COLORS.purple, CHART_COLORS.teal, CHART_COLORS.pink
  ];

  const bgColors = labels.map((_, i) => colors[i % colors.length]);

  analyticsState.trainerChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Completed Events',
        data: values,
        backgroundColor: bgColors,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      ...getProfessionalBarOptions(null, false),
      indexAxis: labels.length > 6 ? 'y' : 'x'
    }
  });
}

function renderEventChart(data) {
  const canvas = document.getElementById('eventEngagementChart');
  if (!canvas) return;

  destroyChart(analyticsState.eventChart);

  const labels = data.map(item => item.eventType || 'Unknown');
  const values = data.map(item => Math.round(item.avgAttendanceRate || 0));

  analyticsState.eventChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Attendance %',
        data: values,
        backgroundColor: CHART_COLORS.success,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      ...getProfessionalBarOptions(100, false),
      plugins: {
        ...getProfessionalBarOptions(100, false).plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}% attendance`
          }
        }
      }
    }
  });
}

function renderSchoolChart(data) {
  const canvas = document.getElementById('schoolParticipationChart');
  if (!canvas) return;

  destroyChart(analyticsState.schoolChart);

  const labels = data.map(item => item.schoolName || 'Unknown');
  const values = data.map(item => item.engagementScore || 0);

  analyticsState.schoolChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Engagement Score',
        data: values,
        backgroundColor: CHART_COLORS.warning,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: getProfessionalBarOptions(100, false)
  });
}

function renderReportSubmissionChart(trainerData = []) {
  const canvas = document.getElementById('reportSubmissionChart');
  if (!canvas) return;
  destroyChart(analyticsState.reportSubmissionChart);

  const totals = trainerData.reduce((acc, t) => {
    acc.onTime += t.reportsOnTime || 0;
    acc.late += t.reportsLate || 0;
    return acc;
  }, { onTime: 0, late: 0 });

  const labels = ['On-time', 'Late'];
  const values = [totals.onTime, totals.late];
  const bg = [CHART_COLORS.success, CHART_COLORS.warning];

  analyticsState.reportSubmissionChart = buildChart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: bg, borderWidth: 2, borderColor: '#fff' }] },
    options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%', responsive: true, maintainAspectRatio: false }
  });
}

function renderEventAttendeesChart(data = []) {
  const canvas = document.getElementById('eventAttendeesChart');
  if (!canvas) return;
  destroyChart(analyticsState.eventAttendeesChart);

  const labels = data.map(i => i.eventType || 'Unknown');
  const values = data.map(i => i.totalAttended || i.totalRegistered || i.totalEvents || 0);

  analyticsState.eventAttendeesChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Total Attended', data: values, backgroundColor: CHART_COLORS.primaryLight, borderRadius: 6 }] },
    options: { ...getProfessionalBarOptions(null, false), indexAxis: labels.length > 6 ? 'y' : 'x' }
  });
}

function renderRevenueChart(dashboardData = {}) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;
  destroyChart(analyticsState.revenueChart);

  const collected = dashboardData.revenueCollected || 0;
  const outstanding = dashboardData.outstandingPayments || 0;
  const labels = ['Collected', 'Outstanding'];
  const values = [collected, outstanding];
  const bg = [CHART_COLORS.success, CHART_COLORS.warning];

  analyticsState.revenueChart = buildChart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: bg, borderWidth: 2, borderColor: '#fff' }] },
    options: { plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ₦${Number(ctx.raw).toLocaleString()}` } } }, cutout: '60%', responsive: true, maintainAspectRatio: false }
  });
}

function renderStatusChart(byStatus = []) {
  const canvas = document.getElementById('schoolStatusChart');
  if (!canvas) return;

  destroyChart(analyticsState.statusChart);

  const statusMap = {};
  byStatus.forEach(item => {
    const key = item._id || 'Unknown';
    statusMap[key] = (statusMap[key] || 0) + item.count;
  });

  const labels = Object.keys(statusMap);
  const values = Object.values(statusMap);

  const statusColors = {
    active: CHART_COLORS.success,
    on_hold: CHART_COLORS.warning,
    pending: CHART_COLORS.primary,
    inactive: '#94a3b8',
    default: CHART_COLORS.purple
  };

  const bg = labels.map(l => statusColors[l] || statusColors.default);

  analyticsState.statusChart = buildChart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.raw} schools`
          }
        }
      }
    }
  });
}

function renderTrendChart(trends = []) {
  const canvas = document.getElementById('onboardingTrendChart');
  if (!canvas) return;

  destroyChart(analyticsState.trendChart);

  // Sort ascending by date
  const sorted = [...trends].sort((a, b) => {
    const da = new Date(a._id.year, a._id.month - 1);
    const db = new Date(b._id.year, b._id.month - 1);
    return da - db;
  });

  const labels = sorted.map(t => `${t._id.month}/${t._id.year}`);
  const values = sorted.map(t => t.count);

  analyticsState.trendChart = buildChart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'New Schools Onboarded',
        data: values,
        borderColor: CHART_COLORS.primary,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: CHART_COLORS.primary,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { color: '#64748b', font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { color: '#64748b', precision: 0 } }
      }
    }
  });
}

async function loadAnalyticsWidgets(range = '90d') {
  const timeParam = `timeRange=${range}`;
  const dateParam = `dateRange=${range}`;

  const [dashboardData, trainerReport, eventReport, schoolReport] = await Promise.all([
    fetchJson(`/api/dashboard-data?${timeParam}`).catch(() => ({})),
    fetchJson(`/api/reports/trainer-performance?${dateParam}`).catch(() => ({ success: false, data: [] })),
    fetchJson(`/api/reports/event-effectiveness?${dateParam}`).catch(() => ({ success: false, data: [] })),
    fetchJson(`/api/reports/school-engagement?${dateParam}`).catch(() => ({ success: false, data: [] }))
  ]);

  // Schools analytics is optional (extra charts only) — never let it break the main dashboard
  let schoolsAnalytics = { byStatus: [], onboardingTrends: [] };
  try {
    const res = await fetch(`/api/schools/analytics?${timeParam}`);
    if (res.ok) {
      const sa = await res.json();
      if (sa) schoolsAnalytics = sa;
    }
  } catch (e) {
    // Silently ignore — status doughnut and trend line will just be empty
  }

  // Update rich KPIs
  updateKpi('kpiTotalSchools', dashboardData.totalSchools || 0);
  updateKpi('kpiActiveSchools', dashboardData.activeSchools || 0);
  updateKpi('kpiEventsThisMonth', dashboardData.eventsThisMonth || 0);
  updateKpi('kpiTotalStudents', dashboardData.totalStudents || 0);
  updateKpi('kpiStaffProductivity', dashboardData.avgEventsPerTrainer || 0);
  updateKpi('kpiSchoolParticipation', dashboardData.schoolParticipationPercent || 0, '%');
  updateKpi('kpiEventEngagement', dashboardData.avgEventAttendanceRate || 0, '%');
  updateKpi('kpiBookingLeadTime', dashboardData.avgBookingLeadDays || 0);

  // Charts
  const topTrainers = trainerReport.success ? trainerReport.data.slice(0, 12) : [];
  renderTrainerChart(topTrainers);

  const eventMetrics = eventReport.success ? eventReport.data : [];
  renderEventChart(eventMetrics);

  const schoolMetrics = (schoolReport.success ? schoolReport.data : [])
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 10);
  renderSchoolChart(schoolMetrics);

  // New charts: report submission pie, event attendees, revenue
  renderReportSubmissionChart(topTrainers);
  renderEventAttendeesChart(eventMetrics);
  renderRevenueChart(dashboardData);

  // Extra real-data charts
  const statusData = schoolsAnalytics.byStatus || [];
  renderStatusChart(statusData);

  const trendData = schoolsAnalytics.onboardingTrends || [];
  renderTrendChart(trendData);
}

function getCurrentTimeRange() {
  const activePill = document.querySelector('.time-pill.active');
  if (activePill && activePill.dataset.range) {
    currentTimeRange = activePill.dataset.range;
  }
  return currentTimeRange;
}

async function refreshAnalytics() {
  try {
    const range = getCurrentTimeRange();
    await loadAnalyticsWidgets(range);
  } catch (err) {
    console.error('Unable to refresh analytics:', err);
  }
}

function initAnalyticsPage() {
  const canvas = document.getElementById('trainerProductivityChart');
  if (!canvas) return;

  // Initialize default range pill state
  setActiveTimePill(currentTimeRange);
  attachTimeRangeListeners();

  refreshAnalytics().catch(err => console.error('Analytics initialization failed:', err));
}

window.refreshAnalytics = refreshAnalytics;

document.addEventListener('DOMContentLoaded', initAnalyticsPage);
