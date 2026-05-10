/**
 * Trainer Events Page JavaScript
 * Handles events list, calendar views, accept/decline actions for trainers
 */

let allEvents = [];
let filteredEvents = [];
let currentTab = 'upcoming'; // 'upcoming' or 'past'
let calendarViewType = 'month';
let calendarCurrentDate = new Date();
let calendarCurrentView = 'month';

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

async function initializePage() {
    setupEventListeners();
    await loadEvents();
    updateStats();
}

function setupEventListeners() {
    // Search and filters
    document.getElementById('eventSearch').addEventListener('input', applyFilters);
    document.getElementById('typeFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('startDateFilter').addEventListener('change', applyFilters);
    document.getElementById('endDateFilter').addEventListener('change', applyFilters);

    // View toggles
    document.getElementById('tableViewBtn').addEventListener('click', () => switchView('table'));
    document.getElementById('calendarViewBtn').addEventListener('click', () => switchView('calendar'));

    // Calendar navigation
    document.getElementById('prevPeriodBtn').addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('nextPeriodBtn').addEventListener('click', () => navigateCalendar(1));
    document.getElementById('calendarViewType').addEventListener('change', function() {
        calendarViewType = this.value;
        renderCalendar(filteredEvents);
    });
}

async function loadEvents() {
    try {
        // Get all events assigned to trainer (no date filter to get all)
        const response = await fetch('/api/trainer/events');
        const data = await response.json();

        if (data.success) {
            allEvents = data.events.map(ev => ({
                ...ev,
                startDate: new Date(ev.start),
                endDate: new Date(ev.end)
            }));

            applyFilters();
        } else {
            showAlert('Failed to load events: ' + data.error, 'danger');
        }
    } catch (err) {
        console.error('Error loading events:', err);
        showAlert('Error connecting to server', 'danger');
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('eventSearch').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const startDateFilter = document.getElementById('startDateFilter').value;
    const endDateFilter = document.getElementById('endDateFilter').value;

    const now = new Date();

    filteredEvents = allEvents.filter(ev => {
        // Search filter
        if (searchTerm && !ev.title.toLowerCase().includes(searchTerm) && !ev.location?.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Type filter
        if (typeFilter && ev.type !== typeFilter) {
            return false;
        }

        // Status filter
        if (statusFilter && ev.status !== statusFilter) {
            return false;
        }

        // Date range filter
        if (startDateFilter) {
            const start = new Date(startDateFilter);
            if (ev.endDate < start) return false;
        }
        if (endDateFilter) {
            const end = new Date(endDateFilter);
            end.setHours(23, 59, 59);
            if (ev.startDate > end) return false;
        }

        // Tab filter (upcoming vs past)
        if (currentTab === 'upcoming') {
            // Upcoming: events with endDate >= now, not cancelled/archived, and assignment not declined/removed
            if (ev.endDate < now) return false;
            if (['cancelled', 'archived'].includes(ev.status)) return false;
            const assignmentStatus = ev.trainerAssignmentStatus || 'not_assigned';
            if (['declined', 'removed', 'not_assigned'].includes(assignmentStatus)) return false;
        } else if (currentTab === 'past') {
            // Past: events that have ended OR assignment declined/removed OR status completed/reviewed/cancelled/archived
            const assignmentStatus = ev.trainerAssignmentStatus || 'not_assigned';
            const isPastByDate = ev.endDate < now;
            const isPastByAssignment = ['declined', 'removed'].includes(assignmentStatus);
            const isPastByStatus = ['completed', 'reviewed', 'cancelled', 'archived'].includes(ev.status);
            if (!(isPastByDate || isPastByAssignment || isPastByStatus)) return false;
        }

        return true;
    });

    // Sort by start date
    filteredEvents.sort((a, b) => a.startDate - b.startDate);

    // Update table or calendar
    renderTableView();
    renderCalendar(filteredEvents);
    updateStats();
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('upcomingTabBtn').classList.toggle('active', tab === 'upcoming');
    document.getElementById('pastTabBtn').classList.toggle('active', tab === 'past');

    // Clear filters when switching tabs for better UX
    document.getElementById('statusFilter').value = '';
    applyFilters();
}

function switchView(view) {
    const tableView = document.getElementById('tableView');
    const calendarView = document.getElementById('calendarView');
    const tableBtn = document.getElementById('tableViewBtn');
    const calBtn = document.getElementById('calendarViewBtn');

    if (view === 'table') {
        tableView.style.display = 'block';
        calendarView.style.display = 'none';
        tableBtn.classList.add('active');
        calBtn.classList.remove('active');
        renderTableView();
    } else {
        tableView.style.display = 'none';
        calendarView.style.display = 'block';
        tableBtn.classList.remove('active');
        calBtn.classList.add('active');
        renderCalendar(filteredEvents);
    }
}

function renderTableView() {
    const tbody = document.getElementById('eventsTableBody');
    const emptyState = document.getElementById('eventsEmptyState');
    tbody.innerHTML = '';

    if (filteredEvents.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    filteredEvents.forEach(ev => {
        const tr = document.createElement('tr');

        const trainerRole = ev.trainerRoles && ev.trainerRoles.length > 0
            ? ev.trainerRoles.map(r => formatRole(r)).join(', ')
            : '—';

        // Use the trainer-specific assignment status
        const assignmentStatus = getAssignmentStatusBadge(ev.trainerAssignmentStatus || 'not_assigned');
        const actions = getActionButtons(ev);

        tr.innerHTML = `
            <td><strong><a href="/trainer/events/${ev.id}" style="color: inherit;">${escapeHtml(ev.title)}</a></strong></td>
            <td><span class="badge ${getEventTypeBadgeClass(ev.type)}">${formatEventType(ev.type)}</span></td>
            <td>${formatDateRange(ev.startDate, ev.endDate)}</td>
            <td>${escapeHtml(ev.location || '—')}</td>
            <td><span class="badge ${getStatusBadgeClass(ev.status)}">${formatStatus(ev.status)}</span></td>
            <td>${trainerRole}</td>
            <td>${assignmentStatus}</td>
            <td>${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

function getActionButtons(ev) {
    const assignmentStatus = ev.trainerAssignmentStatus || 'not_assigned';
    const now = new Date();

    // If trainer is assigned but not confirmed, show accept/decline
    if (assignmentStatus === 'assigned') {
        return `
            <button class="btn btn-sm btn-success" onclick="confirmAccept('${ev.id}')">Accept</button>
            <button class="btn btn-sm btn-danger" onclick="confirmDecline('${ev.id}')">Decline</button>
            <a href="/trainer/events/${ev.id}" class="btn btn-sm btn-outline">Details</a>
        `;
    }

    // For confirmed/declined/other assignments, just show view details or report action
    let buttons = `<a href="/trainer/events/${ev.id}" class="btn btn-sm btn-outline">View Details</a>`;

    // If event is completed and assignment is confirmed, check if report is needed
    if (ev.status === 'completed' && (assignmentStatus === 'confirmed' || assignmentStatus === 'assigned')) {
        const reportSubmitted = ev.review?.reportSubmittedAt;
        if (!reportSubmitted) {
            buttons = `<a href="/trainer/events/${ev.id}" class="btn btn-sm btn-primary">Submit Report</a>`;
        }
    }

    return buttons;
}

function confirmAccept(eventId) {
    showConfirmModal(
        'Accept Event',
        'Are you sure you want to accept this event assignment?',
        false,
        async () => {
            await submitResponse(eventId, 'accept');
        }
    );
}

function confirmDecline(eventId) {
    showConfirmModal(
        'Decline Event',
        'Are you sure you want to decline this event assignment? Please provide a reason (optional).',
        true,
        async (reason) => {
            await submitResponse(eventId, 'decline', reason);
        }
    );
}

function showConfirmModal(title, message, needsReason, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const reasonContainer = document.getElementById('declineReasonContainer');
    const reasonInput = document.getElementById('declineReason');
    const confirmBtn = document.getElementById('confirmModalBtn');

    titleEl.textContent = title;
    messageEl.textContent = message;
    reasonContainer.style.display = needsReason ? 'block' : 'none';
    reasonInput.value = '';

    modal.style.display = 'flex';

    confirmBtn.onclick = async () => {
        const reason = needsReason ? reasonInput.value.trim() : null;
        closeConfirmModal();
        await onConfirm(reason);
    };
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

async function submitResponse(eventId, action, reason = null) {
    try {
        const url = `/trainer/events/${eventId}/${action}`;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        if (action === 'decline' && reason !== undefined) {
            options.body = JSON.stringify({ reason });
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (data.success) {
            showAlert(`Event ${action === 'accept' ? 'accepted' : 'declined'} successfully`, 'success');
            await loadEvents();
            updateStats();
        } else {
            showAlert(`Failed to ${action} event: ${data.error}`, 'danger');
        }
    } catch (err) {
        console.error('Error submitting response:', err);
        showAlert('Error connecting to server', 'danger');
    }
}

// Calendar Functions
function navigateCalendar(direction) {
    const current = calendarCurrentDate;
    const newDate = new Date(current);

    if (calendarViewType === 'month') {
        newDate.setMonth(current.getMonth() + direction);
    } else if (calendarViewType === 'week') {
        newDate.setDate(current.getDate() + (direction * 7));
    } else { // list
        newDate.setMonth(current.getMonth() + direction);
    }

    calendarCurrentDate = newDate;
    renderCalendar(filteredEvents);
}

function renderCalendar(events) {
    if (!events || events.length === 0) {
        document.getElementById('calendarContainer').innerHTML = '<p class="placeholder-text">No events to display.</p>';
        return;
    }

    switch (calendarViewType) {
        case 'month':
            renderCalendarMonth(events);
            break;
        case 'week':
            renderCalendarWeek(events);
            break;
        case 'list':
            renderCalendarList(events);
            break;
    }
}

function renderCalendarMonth(events) {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const title = calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('calendarTitle').textContent = title;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    let html = '<div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem;">';

    // Day headers
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dayNames.forEach(day => {
        html += `<div style="font-weight: bold; text-align: center; padding: 0.5rem; background: var(--muted); border-radius: var(--radius);">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startPadding; i++) {
        html += '<div style="min-height: 80px; background: var(--card); padding: 0.25rem; border-radius: var(--radius);"></div>';
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayEvents = events.filter(e => {
            const d = new Date(e.startDate);
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        });

        html += `<div style="min-height: 80px; background: var(--card); padding: 0.25rem; border-radius: var(--radius); border: 1px solid var(--border);">`;
        html += `<div style="font-weight: 600; font-size: 0.875rem;">${day}</div>`;

        dayEvents.forEach(ev => {
            html += `
                <div class="event-marker ${getEventColorBadge(ev.type)}" style="font-size: 0.75rem; padding: 0.25rem; margin-top: 0.25rem; border-radius: 4px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(ev.title)} - ${formatStatus(ev.status)}" onclick="window.location.href='/trainer/events/${ev.id}'">
                    ${escapeHtml(truncate(ev.title, 15))}
                </div>
            `;
        });

        html += '</div>';
    }

    html += '</div>';
    document.getElementById('calendarContainer').innerHTML = html;
}

function renderCalendarWeek(events) {
    const weekStart = new Date(calendarCurrentDate);
    weekStart.setDate(calendarCurrentDate.getDate() - calendarCurrentDate.getDay());
    const title = `${weekStart.toLocaleDateString()} - ${new Date(weekStart.getTime() + 6*24*60*60*1000).toLocaleDateString()}`;
    document.getElementById('calendarTitle').textContent = title;

    let html = '<div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem;">';

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dayNames.forEach(day => {
        html += `<div style="font-weight: bold; text-align: center; padding: 0.5rem; background: var(--muted); border-radius: var(--radius);">${day}</div>`;
    });

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dayEvents = events.filter(e => {
            const d = new Date(e.startDate);
            return d.toDateString() === currentDate.toDateString();
        });

        html += `<div style="min-height: 100px; background: var(--card); padding: 0.25rem; border-radius: var(--radius); border: 1px solid var(--border);">`;
        html += `<div style="font-weight: 600; font-size: 0.875rem;">${currentDate.getDate()}</div>`;

        dayEvents.forEach(ev => {
            const colorBadge = getEventColorBadge(ev.type);
            html += `
                <div class="event-marker ${colorBadge}" style="font-size: 0.75rem; padding: 0.25rem; margin-top: 0.25rem; border-radius: 4px; cursor: pointer;" title="${escapeHtml(ev.title)} - ${formatStatus(ev.status)}" onclick="window.location.href='/trainer/events/${ev.id}'">
                    ${escapeHtml(truncate(ev.title, 12))}
                </div>
            `;
        });

        html += '</div>';
    }

    html += '</div>';
    document.getElementById('calendarContainer').innerHTML = html;
}

function renderCalendarList(events) {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const title = calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('calendarTitle').textContent = `${title} (List View)`;

    const monthEvents = events.filter(e => {
        const d = new Date(e.startDate);
        return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

    let html = '<div class="events-list">';
    if (monthEvents.length === 0) {
        html = '<p class="placeholder-text">No events this month.</p>';
    } else {
        monthEvents.forEach(ev => {
            html += `
                <div style="padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.75rem; border-left: 4px solid ${getEventColorHex(ev.type)};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0;"><a href="/trainer/events/${ev.id}" style="color: inherit; text-decoration: none;">${escapeHtml(ev.title)}</a></h4>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--muted-foreground);">
                                <span>📅 ${formatDateRange(ev.startDate, ev.endDate)}</span>
                                <span>📍 ${ev.location || '—'}</span>
                                <span>🏷️ ${formatEventType(ev.type)}</span>
                            </div>
                        </div>
                        <span class="badge ${getStatusBadgeClass(ev.status)}">${formatStatus(ev.status)}</span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                        Role: ${ev.trainerRoles?.map(r => formatRole(r)).join(', ') || 'Not assigned'} |
                        <a href="/trainer/events/${ev.id}">View Details →</a>
                    </div>
                </div>
            `;
        });
    }
    html += '</div>';
    document.getElementById('calendarContainer').innerHTML = html;
}

function updateStats() {
    const now = new Date();

    // Upcoming: future events that are not cancelled/archived and trainer hasn't declined/removed
    const upcoming = allEvents.filter(ev => {
        if (ev.endDate < now) return false;
        if (['cancelled', 'archived'].includes(ev.status)) return false;
        const assignment = ev.trainerAssignmentStatus || 'not_assigned';
        if (['declined', 'removed', 'not_assigned'].includes(assignment)) return false;
        return true;
    });

    // Completed: events marked completed or reviewed
    const completed = allEvents.filter(ev =>
        ['completed', 'reviewed'].includes(ev.status)
    );

    // Pending assignments: events where trainer still needs to accept/decline
    const pendingAssignments = allEvents.filter(ev => {
        const assignment = ev.trainerAssignmentStatus || 'not_assigned';
        return assignment === 'assigned' && ev.endDate >= now;
    });

    // Reports due: completed events where trainer hasn't submitted report
    const reportsDue = allEvents.filter(ev => {
        const assignment = ev.trainerAssignmentStatus || 'not_assigned';
        const isConfirmed = assignment === 'confirmed' || assignment === 'assigned';
        const isCompleted = ev.status === 'completed';
        const reportSubmitted = ev.review?.reportSubmittedAt;
        return isCompleted && isConfirmed && !reportSubmitted;
    });

    document.getElementById('upcomingEventsCount').textContent = upcoming.length;
    document.getElementById('completedEventsCount').textContent = completed.length;
    document.getElementById('pendingAssignmentsCount').textContent = pendingAssignments.length;
    document.getElementById('reportsDueCount').textContent = reportsDue.length;
}

// Utility Functions
function formatDateRange(start, end) {
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    if (startStr === endStr) return startStr;
    return `${startStr} - ${endStr}`;
}

function formatEventType(type) {
    const types = {
        'camp': 'Camp',
        'hike': 'Hike',
        'team_building': 'Team Building',
        'training_session': 'Training Session',
        'inter_school_competition': 'Inter-School Competition',
        'other': 'Other'
    };
    return types[type] || type;
}

function getEventTypeBadgeClass(type) {
    const badgeMap = {
        'camp': 'badge-primary',
        'hike': 'badge-success',
        'team_building': 'badge-accent',
        'training_session': 'badge-secondary',
        'inter_school_competition': 'badge-warning',
        'other': 'badge-secondary'
    };
    return badgeMap[type] || 'badge-secondary';
}

function formatStatus(status) {
    return status.replace('_', ' ');
}

function getStatusBadgeClass(status) {
    const statusMap = {
        'draft': 'badge-secondary',
        'scheduled': 'badge-accent',
        'published': 'badge-primary',
        'confirmed': 'badge-success',
        'in_progress': 'badge-warning',
        'completed': 'badge-success',
        'reviewed': 'badge-primary',
        'cancelled': 'badge-danger',
        'archived': 'badge-secondary',
        'assigned': 'badge-warning',
        'declined': 'badge-danger',
        'removed': 'badge-danger'
    };
    return statusMap[status] || 'badge-secondary';
}

function getAssignmentStatusBadge(assignmentStatus) {
    // Returns HTML badge string for trainer assignment status
    let label, badgeClass;
    switch (assignmentStatus) {
        case 'assigned':
            label = 'Pending';
            badgeClass = 'badge-warning';
            break;
        case 'confirmed':
            label = 'Confirmed';
            badgeClass = 'badge-success';
            break;
        case 'declined':
            label = 'Declined';
            badgeClass = 'badge-danger';
            break;
        case 'removed':
            label = 'Removed';
            badgeClass = 'badge-secondary';
            break;
        case 'not_assigned':
            label = 'Not Assigned';
            badgeClass = 'badge-secondary';
            break;
        default:
            label = assignmentStatus;
            badgeClass = 'badge-secondary';
    }
    return `<span class="badge ${badgeClass}">${label}</span>`;
}

function getEventColorClass(type) {
    const colors = {
        'camp': 'primary',
        'hike': 'success',
        'team_building': 'accent',
        'training_session': 'secondary',
        'inter_school_competition': 'warning',
        'other': 'secondary'
    };
    return colors[type] || 'secondary';
}

function getEventColorBadge(type) {
    const badgeMap = {
        'camp': 'badge-success',          // Green
        'hike': 'badge-info',             // Blue
        'team_building': 'badge-warning', // Yellow/Orange
        'training_session': 'badge-secondary', // Gray
        'inter_school_competition': 'badge-danger', // Red
        'other': 'badge-secondary'
    };
    return badgeMap[type] || 'badge-secondary';
}

function getEventColorHex(type) {
    const colorClass = getEventColorClass(type);
    // Map the color class to a CSS variable for the border color
    const colorVarMap = {
        'primary': 'var(--success)',   // camp maps to green
        'success': 'var(--info)',      // hike maps to blue/info
        'accent': 'var(--warning)',    // team_building maps to warning
        'secondary': 'var(--muted-foreground)',
        'warning': 'var(--danger)'     // inter_school_competition maps to danger
    };
    return colorVarMap[colorClass] || 'var(--secondary)';
}

function formatRole(role) {
    const roles = {
        'lead_trainer': 'Lead Trainer',
        'assistant_trainer': 'Assistant',
        'coordinator': 'Coordinator',
        'volunteer': 'Volunteer'
    };
    return roles[role] || role;
}

function truncate(str, n) {
    return (str.length > n) ? str.substr(0, n-1) + '&hellip;' : str;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Reusable showAlert function
function showAlert(message, type = 'info') {
    // Simple alert for now - can enhance with toast notifications
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
}
