/**
 * Event Effectiveness Report JS
 * Handles data loading, chart rendering, table population, export
 */

const API_BASE = '/api/reports';
const EXPORT_BASE = '/api/export';

let chartInstances = {};

document.addEventListener('DOMContentLoaded', function() {
    loadReportData();

    document.getElementById('filterForm').addEventListener('submit', function(e) {
        e.preventDefault();
        loadReportData();
    });
});

async function loadReportData() {
    const spinner = document.getElementById('loading');
    spinner.style.display = 'block';

    const params = new URLSearchParams();
    params.set('dateRange', document.getElementById('dateRange').value);
    const eventType = document.getElementById('eventType').value;
    if (eventType) params.set('eventType', eventType);
    const region = document.getElementById('region').value;
    if (region) params.set('region', region);

    try {
        const response = await fetch(`${API_BASE}/event-effectiveness?${params}`);
        const json = await response.json();

        if (json.success) {
            renderCharts(json.data);
            renderTable(json.data);
        } else {
            showError(json.error || 'Failed to load data');
        }
    } catch (error) {
        console.error('Error loading report:', error);
        showToast('Network error', 'error');
    } finally {
        spinner.style.display = 'none';
    }
}

function renderCharts(data) {
    // Destroy previous charts
    if (chartInstances.attendance) chartInstances.attendance.destroy();
    if (chartInstances.feedback) chartInstances.feedback.destroy();

    const labels = data.map(d => d.eventType.replace(/_/g, ' '));
    const attendanceData = data.map(d => d.avgAttendanceRate);
    const feedbackData = data.map(d => d.avgFeedbackScore);
    const colors = [
        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'
    ];

    // Attendance Chart
    const ctx1 = document.getElementById('attendanceChart').getContext('2d');
    chartInstances.attendance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Avg Attendance Rate (%)',
                data: attendanceData,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.6', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Average Attendance Rate by Event Type' } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });

    // Feedback Chart
    const ctx2 = document.getElementById('feedbackChart').getContext('2d');
    chartInstances.feedback = new Chart(ctx2, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Avg Feedback Score',
                data: feedbackData,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Average Feedback Score by Event Type' } },
            scales: { y: { beginAtZero: true, max: 5 } }
        }
    });
}

function renderTable(data) {
    const tbody = document.getElementById('resultsBody');
    const noResults = document.getElementById('noResults');
    tbody.innerHTML = '';

    if (data.length === 0) {
        noResults.style.display = 'block';
        return;
    }
    noResults.style.display = 'none';

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.eventType.replace(/_/g, ' ')}</strong></td>
            <td>${item.totalEvents}</td>
            <td>${item.avgAttendanceRate.toFixed(1)}%</td>
            <td>${item.avgTrainerToScoutRatio.toFixed(2)}</td>
            <td>${item.avgFeedbackScore.toFixed(1)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportReport(format) {
    const params = new URLSearchParams({
        reportType: 'events',
        format,
        dateRange: document.getElementById('dateRange').value
    });
    if (document.getElementById('eventType').value) params.set('eventType', document.getElementById('eventType').value);
    if (document.getElementById('region').value) params.set('region', document.getElementById('region').value);
    window.location.href = `${EXPORT_BASE}/export/${params.toString()}`;
}

function resetFilters() {
    document.getElementById('filterForm').reset();
    loadReportData();
}

function showError(message) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = `<tr><td colspan="5" class="placeholder-text">${message}</td></tr>`;
}
