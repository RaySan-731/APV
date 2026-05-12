const analyticsState = {
  trainerChart: null,
  eventChart: null,
  schoolChart: null
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

function buildChart(context, config) {
  if (!context) return null;
  return new Chart(context, config);
}

function renderTrainerChart(data) {
  const canvas = document.getElementById('trainerProductivityChart');
  if (!canvas) return;
  const labels = data.map(item => item.staff?.name || 'Unknown');
  const values = data.map(item => item.eventsCompleted || 0);

  if (analyticsState.trainerChart) {
    analyticsState.trainerChart.data.labels = labels;
    analyticsState.trainerChart.data.datasets[0].data = values;
    analyticsState.trainerChart.update();
    return;
  }

  analyticsState.trainerChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Completed Events',
        data: values,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        hoverBackgroundColor: '#60a5fa'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { autoSkip: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

function renderEventChart(data) {
  const canvas = document.getElementById('eventEngagementChart');
  if (!canvas) return;
  const labels = data.map(item => item.eventType || 'Unknown');
  const values = data.map(item => Math.round(item.avgAttendanceRate || 0));

  if (analyticsState.eventChart) {
    analyticsState.eventChart.data.labels = labels;
    analyticsState.eventChart.data.datasets[0].data = values;
    analyticsState.eventChart.update();
    return;
  }

  analyticsState.eventChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Attendance Rate',
        data: values,
        backgroundColor: '#10b981',
        borderRadius: 6,
        hoverBackgroundColor: '#34d399'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

function renderSchoolChart(data) {
  const canvas = document.getElementById('schoolParticipationChart');
  if (!canvas) return;
  const labels = data.map(item => item.schoolName || 'Unknown');
  const values = data.map(item => item.engagementScore || 0);

  if (analyticsState.schoolChart) {
    analyticsState.schoolChart.data.labels = labels;
    analyticsState.schoolChart.data.datasets[0].data = values;
    analyticsState.schoolChart.update();
    return;
  }

  analyticsState.schoolChart = buildChart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Engagement Score',
        data: values,
        backgroundColor: '#f59e0b',
        borderRadius: 6,
        hoverBackgroundColor: '#fbbf24'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

async function loadAnalyticsWidgets() {
  const [dashboardData, trainerReport, eventReport, schoolReport] = await Promise.all([
    fetchJson('/api/dashboard-data?timeRange=90d'),
    fetchJson('/api/reports/trainer-performance?dateRange=90d'),
    fetchJson('/api/reports/event-effectiveness?dateRange=90d'),
    fetchJson('/api/reports/school-engagement?dateRange=90d')
  ]);

  const staffProductivity = dashboardData.avgEventsPerTrainer || 0;
  updateKpi('kpiStaffProductivity', staffProductivity);
  updateKpi('kpiSchoolParticipation', dashboardData.schoolParticipationPercent || 0, '%');
  updateKpi('kpiEventEngagement', dashboardData.avgEventAttendanceRate || 0, '%');
  updateKpi('kpiBookingLeadTime', dashboardData.avgBookingLeadDays || 0);

  const topTrainers = trainerReport.success ? trainerReport.data.slice(0, 10) : [];
  renderTrainerChart(topTrainers);

  const eventMetrics = eventReport.success ? eventReport.data : [];
  renderEventChart(eventMetrics);

  const schoolMetrics = (schoolReport.success ? schoolReport.data : []).sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 8);
  renderSchoolChart(schoolMetrics);
}

async function refreshAnalytics() {
  try {
    await loadAnalyticsWidgets();
  } catch (err) {
    console.error('Unable to refresh analytics:', err);
  }
}

function initAnalyticsPage() {
  const analyticsContainer = document.getElementById('trainerProductivityChart');
  if (!analyticsContainer) {
    return;
  }
  refreshAnalytics().catch(err => console.error('Analytics initialization failed:', err));
}

window.refreshAnalytics = refreshAnalytics;

document.addEventListener('DOMContentLoaded', initAnalyticsPage);
