/**
 * Custom Report Builder JS
 */

const API_BASE = '/api/reports';
const EXPORT_BASE = '/api/export';

let currentReportData = [];

document.addEventListener('DOMContentLoaded', function() {
    loadTemplates();
});

async function previewReport() {
    const config = collectFormConfig();
    const btn = document.querySelector('button[onclick="previewReport()"]');
    const originalText = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/custom/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const json = await response.json();
        if (json.success) {
            currentReportData = json.data;
            renderPreview(json.data, config);
        } else {
            showToast(json.error || 'Failed to generate report', 'error');
        }
    } catch (error) {
        console.error('Error building report:', error);
        showToast('Network error', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function collectFormConfig() {
    const groupBy = document.querySelector('input[name="groupBy"]:checked').value;
    const metrics = Array.from(document.querySelectorAll('input[name="metrics"]:checked')).map(cb => cb.value);
    const dateRange = document.querySelector('select[name="dateRange"]').value;
    const eventTypes = Array.from(document.querySelector('select[name="eventTypes"]').selectedOptions).map(opt => opt.value);
    const schoolIds = Array.from(document.querySelector('select[name="schoolIds"]').selectedOptions).map(opt => opt.value);
    const trainerIds = Array.from(document.querySelector('select[name="trainerIds"]').selectedOptions).map(opt => opt.value);

    return {
        dimensions: [groupBy],
        metrics,
        filters: { dateRange, eventTypes, schoolIds, trainerIds },
        groupBy
    };
}

async function renderPreview(data, config) {
    const section = document.getElementById('previewSection');
    const thead = document.getElementById('previewHead');
    const tbody = document.getElementById('previewBody');

    section.style.display = 'block';
    tbody.innerHTML = '';

    // Build header
    const groupByLabels = {
        eventType: 'Event Type',
        region: 'Region',
        trainer: 'Trainer',
        school: 'School',
        month: 'Month'
    };
    const metricsLabels = {
        totalEvents: 'Total Events',
        totalScouts: 'Total Scouts',
        avgAttendance: 'Avg Attendance (%)',
        totalRevenue: 'Total Revenue',
        feedbackScore: 'Feedback Avg'
    };

    let headerHTML = '<tr><th>' + (groupByLabels[config.groupBy] || config.groupBy) + '</th>';
    config.metrics.forEach(m => {
        headerHTML += `<th>${metricsLabels[m] || m}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

    // Build rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        let cellHTML = `<td>${row._id || 'Total'}</td>`;
        config.metrics.forEach(metric => {
            const val = row[metric];
            cellHTML += `<td>${formatNumber(val)}</td>`;
        });
        tr.innerHTML = cellHTML;
        tbody.appendChild(tr);
    });
}

function formatNumber(val) {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'number') {
        return Number.isInteger(val) ? val : val.toFixed(2);
    }
    return val;
}

function exportReport(format) {
    const config = collectFormConfig();
    const params = new URLSearchParams({
        reportType: 'custom',
        format,
        ...config
    });
    // Build a full query string for export - simplified version
    const exportURL = `${API_BASE}/custom/export?${params.toString()}`;
    window.location.href = exportURL;
}

async function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    if (!name) {
        showToast('Please enter a template name', 'error');
        return;
    }

    const config = collectFormConfig();
    const configPayload = {
        name,
        description: document.getElementById('templateDesc').value,
        isShared: document.getElementById('templateShared').checked,
        config
    };

    try {
        const response = await fetch(`${API_BASE}/templates/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configPayload)
        });

        const json = await response.json();
        if (json.success) {
            showToast('Template saved successfully', 'success');
            closeModal('saveTemplateModal');
            loadTemplates();
            // Clear form
            document.getElementById('templateName').value = '';
            document.getElementById('templateDesc').value = '';
        } else {
            showToast(json.error || 'Failed to save template', 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showToast('Network error', 'error');
    }
}

async function loadTemplates() {
    try {
        const response = await fetch(`${API_BASE}/templates`);
        const json = await response.json();
        if (json.success) {
            renderTemplates(json.templates);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function renderTemplates(templates) {
    const container = document.getElementById('templatesList');
    container.innerHTML = '';

    if (templates.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No saved templates.</p>';
        return;
    }

    templates.forEach(tpl => {
        const div = document.createElement('div');
        div.className = 'template-card';
        div.innerHTML = `
            <strong>${tpl.name}</strong>
            <p style="margin: 0.25rem 0; color: var(--muted-foreground); font-size: 0.9rem;">${tpl.description || ''}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button class="btn btn-sm btn-outline" onclick="loadTemplate('${tpl._id}')">Load</button>
                <small style="color: var(--muted-foreground); align-self: center;">By ${tpl.createdBy?.name || 'Unknown'} on ${new Date(tpl.createdAt).toLocaleDateString()}</small>
            </div>
        `;
        container.appendChild(div);
    });
}

function loadTemplate(templateId) {
    // In a full implementation, you'd fetch template config and populate form
    showToast('Template loading would populate form (implementation pending)', 'info');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}
