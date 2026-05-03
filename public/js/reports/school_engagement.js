/**
 * School Engagement Report JS
 */

const API_BASE = '/api/reports';
const EXPORT_BASE = '/api/export';

let currentData = [];

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
    const schoolId = document.getElementById('schoolFilter').value;
    if (schoolId) params.set('schoolId', schoolId);

    try {
        const response = await fetch(`${API_BASE}/school-engagement?${params}`);
        const json = await response.json();

        if (json.success) {
            currentData = json.data;
            renderTable(currentData);
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
        const statusClass = item.serviceStatus === 'active' ? 'badge-success' : item.serviceStatus === 'on_hold' ? 'badge-warning' : 'badge-secondary';
        const scoreClass = item.engagementScore >= 80 ? 'badge-success' : item.engagementScore >= 60 ? 'badge-warning' : 'badge-danger';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.schoolName}</strong></td>
            <td>${item.studentCount}</td>
            <td>${item.eventsAttended}</td>
            <td>${item.onTimePayments} / ${item.totalPayments}</td>
            <td>${item.avgFeedback.toFixed(1)}</td>
            <td><span class="badge ${scoreClass}">${item.engagementScore}</span></td>
            <td><span class="badge ${statusClass}">${item.serviceStatus.replace('_', ' ')}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function exportReport(format) {
    const params = new URLSearchParams({
        reportType: 'schools',
        format,
        dateRange: document.getElementById('dateRange').value
    });
    if (document.getElementById('schoolFilter').value) params.set('schoolId', document.getElementById('schoolFilter').value);
    window.location.href = `${EXPORT_BASE}/export/${params.toString()}`;
}

function resetFilters() {
    document.getElementById('filterForm').reset();
    loadReportData();
}

function showError(message) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = `<tr><td colspan="7" class="placeholder-text">${message}</td></tr>`;
}

function showToast(message, type) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}
