/**
 * Trainer Performance Report JS
 * Handles data loading, filtering, table rendering, and export
 */

const API_BASE = '/api/reports';
const EXPORT_BASE = '/api/export';

let currentData = [];

// Initial load on page
document.addEventListener('DOMContentLoaded', function() {
    loadReportData();

    document.getElementById('filterForm').addEventListener('submit', function(e) {
        e.preventDefault();
        loadReportData();
    });
});

async function loadReportData() {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = 'block';

    const params = new URLSearchParams();
    params.set('trainerId', document.getElementById('trainerFilter').value);
    params.set('dateRange', document.getElementById('dateRange').value);
    params.set('sortBy', document.getElementById('sortBy').value);
    params.set('sortOrder', document.getElementById('sortOrder').value);

    try {
        const response = await fetch(`${API_BASE}/trainer-performance?${params}`);
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
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${item.staff?.name || 'Unknown'}</strong><br>
                <small>${item.staff?.email || ''}</small>
            </td>
            <td>${item.eventsCompleted}</td>
            <td>${item.totalAttendance}</td>
            <td>${item.reportsOnTime}</td>
            <td>${item.reportsLate}</td>
            <td>${item.avgFeedback.toFixed(1)}</td>
            <td>${item.schoolsVisited}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="viewTrainerDetails('${item.trainerId}')">Details</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function exportReport(format) {
    const params = new URLSearchParams({
        reportType: 'trainers',
        format,
        dateRange: document.getElementById('dateRange').value
    });
    if (document.getElementById('trainerFilter').value) {
        params.set('trainerId', document.getElementById('trainerFilter').value);
    }

    window.location.href = `${EXPORT_BASE}/export/${params.toString()}`;
}

function resetFilters() {
    document.getElementById('filterForm').reset();
    loadReportData();
}

function viewTrainerDetails(trainerId) {
    window.location.href = `/dashboard/trainer/${trainerId}/details`;
}

function showError(message) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = `<tr><td colspan="8" class="placeholder-text">${message}</td></tr>`;
}

function showToast(message, type = 'info') {
    // Reuse existing toast from dashboard.js if available; otherwise simple alert
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}
