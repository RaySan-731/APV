// Notification System for Trainer Portal
// This module handles notification bell, badge, panel, and message modal

// Ensure showToast is available
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6b7280'};
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => document.body.removeChild(toast), 300); }, duration);
    };
}

let notificationPanelOpen = false;
let notificationCurrentTab = 'notifications';

// Initialize notification system
function initNotifications() {
    const bell = document.getElementById('notificationBell');
    const panel = document.getElementById('notificationPanel');
    const closeBtn = document.getElementById('closeNotificationPanel');
    const markAllBtn = document.getElementById('markAllReadBtn');

    if (!bell || !panel) {
        console.warn('Notification elements not found');
        return;
    }

    // Bell click handler
    bell.addEventListener('click', function(e) {
        e.stopPropagation();
        notificationPanelOpen = !notificationPanelOpen;
        panel.style.display = notificationPanelOpen ? 'block' : 'none';
        if (notificationPanelOpen) {
            notificationCurrentTab = 'notifications';
            const tabs = panel.querySelectorAll('.panel-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tabs[0]?.classList.add('active');
            loadPanelContent(notificationCurrentTab);
        }
    });

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            panel.style.display = 'none';
            notificationPanelOpen = false;
        });
    }

    // Mark all read button
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async function() {
            try {
                if (notificationCurrentTab === 'notifications') {
                    await fetch('/api/notifications/read-all', { method: 'POST' });
                } else if (notificationCurrentTab === 'messages') {
                    await fetch('/api/messages/mark-all-read', { method: 'POST' });
                }
                loadPanelContent(notificationCurrentTab);
                loadNotificationBadge();
                showToast('All marked as read', 'success');
            } catch (err) {
                console.error('Error:', err);
                showToast('Failed to mark all as read', 'error');
            }
        });
    }

    // Tab switching
    const tabs = panel.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            notificationCurrentTab = this.dataset.tab;
            loadPanelContent(notificationCurrentTab);
        });
    });

    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (notificationPanelOpen && !bell.contains(e.target) && !panel.contains(e.target)) {
            panel.style.display = 'none';
            notificationPanelOpen = false;
        }
    });

    // Load initial badge count
    loadNotificationBadge();
}

// Load notification badge count
async function loadNotificationBadge() {
    try {
        const res = await fetch('/api/notifications?limit=1&unreadOnly=true');
        const data = await res.json();
        const badge = document.getElementById('notificationBadge');
        if (badge && data.success) {
            if (data.unreadCount > 0) {
                badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error loading notification count:', err);
    }
}

// Load panel content based on tab
async function loadPanelContent(tab) {
    switch(tab) {
        case 'notifications':
            await loadNotificationsPanel();
            break;
        case 'messages':
            await loadMessagesPanel();
            break;
        case 'announcements':
            await loadAnnouncementsPanel();
            break;
    }
}

// Load notifications into panel
async function loadNotificationsPanel() {
    const container = document.getElementById('notificationPanelList');
    if (!container) return;

    container.innerHTML = '<div style="padding: 1rem; text-align: center;">Loading...</div>';

    try {
        const res = await fetch('/api/notifications?limit=50');
        const data = await res.json();
        if (data.success && data.notifications.length > 0) {
            container.innerHTML = data.notifications.map(notif => {
                const isMessage = notif.type === 'new_message';
                const viewButton = isMessage
                    ? `<button class="btn btn-sm btn-primary" onclick="openMessageModal('${notif.entityId}')">View</button>`
                    : (notif.actionUrl ? `<a href="${notif.actionUrl}" class="btn btn-sm btn-primary">${notif.actionLabel || 'View'}</a>` : '');

                return `
                <div class="notification-item ${!notif.isRead ? 'unread' : ''}" data-id="${notif._id}">
                    <div style="padding: 1rem;">
                        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">${getNotificationIcon(notif.type)}</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                                    <h4 style="margin: 0; font-size: 1rem;">${escapeHtml(notif.title)}</h4>
                                    <small style="color: var(--muted-foreground); font-size: 0.75rem;">${new Date(notif.createdAt).toLocaleDateString()}</small>
                                </div>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--muted-foreground);">${escapeHtml(notif.message)}</p>
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    ${!notif.isRead ? `<button class="btn btn-sm btn-outline" onclick="markNotificationRead('${notif._id}')">Mark Read</button>` : ''}
                                    ${!notif.dismissed ? `<button class="btn btn-sm btn-outline" onclick="dismissNotification('${notif._id}')">Dismiss</button>` : ''}
                                    ${viewButton}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `}).join('');
        } else {
            container.innerHTML = '<div class="notification-dropdown-empty">No notifications yet</div>';
        }
    } catch (err) {
        console.error('Error loading notifications:', err);
        container.innerHTML = '<div class="notification-dropdown-empty">Error loading notifications</div>';
    }
}

// Load messages into panel
async function loadMessagesPanel() {
    const container = document.getElementById('notificationPanelList');
    if (!container) return;

    container.innerHTML = '<div style="padding: 1rem; text-align: center;">Loading...</div>';

    try {
        const res = await fetch('/api/messages?folder=inbox&limit=20');
        const data = await res.json();
        if (data.success && data.messages.length > 0) {
            const currentUserId = window.currentUserId;
            container.innerHTML = data.messages.map(msg => `
                <div class="notification-item ${msg.recipients?.some(r => r.staffId === currentUserId && r.status !== 'read') ? 'unread' : ''}" data-id="${msg._id}">
                    <div style="padding: 1rem;">
                        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">✉️</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                                    <h4 style="margin: 0; font-size: 1rem;">${escapeHtml(msg.subject || '(No Subject)')}</h4>
                                    <small style="color: var(--muted-foreground); font-size: 0.75rem;">${new Date(msg.sentAt).toLocaleDateString()}</small>
                                </div>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--muted-foreground);">From: ${escapeHtml(msg.senderName)} — ${escapeHtml(msg.body.substring(0, 80))}${msg.body.length > 80 ? '...' : ''}</p>
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    <button class="btn btn-sm btn-primary" onclick="openMessageModal('${msg._id}')">View</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="notification-dropdown-empty">No messages</div>';
        }
    } catch (err) {
        console.error('Error loading messages:', err);
        container.innerHTML = '<div class="notification-dropdown-empty">Error loading messages</div>';
    }
}

// Load announcements into panel
async function loadAnnouncementsPanel() {
    const container = document.getElementById('notificationPanelList');
    if (!container) return;

    container.innerHTML = '<div style="padding: 1rem; text-align: center;">Loading...</div>';

    try {
        const res = await fetch('/api/announcements?limit=20');
        const data = await res.json();
        if (data.success && data.announcements.length > 0) {
            container.innerHTML = data.announcements.map(ann => `
                <div class="notification-item" data-id="${ann._id}">
                    <div style="padding: 1rem;">
                        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">📢</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                                    <h4 style="margin: 0; font-size: 1rem;">${escapeHtml(ann.title)}</h4>
                                    <small style="color: var(--muted-foreground); font-size: 0.75rem;">${new Date(ann.createdAt).toLocaleDateString()}</small>
                                </div>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--muted-foreground);">${escapeHtml(ann.content?.substring(0, 100) || '')}${ann.content?.length > 100 ? '...' : ''}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="notification-dropdown-empty">No announcements</div>';
        }
    } catch (err) {
        console.error('Error loading announcements:', err);
        container.innerHTML = '<div class="notification-dropdown-empty">Error loading announcements</div>';
    }
}

// Open message modal
async function openMessageModal(messageId) {
    try {
        const res = await fetch(`/api/messages/${messageId}`);
        const data = await res.json();
        if (data.success && data.message) {
            const msg = data.message;
            const subjectEl = document.getElementById('modalMessageSubject');
            const bodyEl = document.getElementById('modalMessageBody');
            const modal = document.getElementById('messageModal');

            if (subjectEl && bodyEl && modal) {
                subjectEl.textContent = msg.subject || '(No Subject)';
                bodyEl.innerHTML = `
                    <div style="margin-bottom: 1rem;">
                        <p><strong>From:</strong> ${escapeHtml(msg.senderName)} (${escapeHtml(msg.senderRole)})</p>
                        <p><strong>Sent:</strong> ${new Date(msg.sentAt).toLocaleString()}</p>
                        ${msg.priority ? `<p><strong>Priority:</strong> ${escapeHtml(msg.priority)}</p>` : ''}
                    </div>
                    <hr style="border: none; border-top: 1px solid var(--border); margin: 1rem 0;">
                    <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(msg.body)}</div>
                `;
                modal.style.display = 'flex';

                // Mark as read when opening
                await fetch(`/api/messages/${messageId}/read`, { method: 'POST' });
                loadNotificationBadge();
            }
        } else {
            showToast('Message not found', 'error');
        }
    } catch (err) {
        console.error('Error loading message:', err);
        showToast('Failed to load message', 'error');
    }
}

// Close message modal
function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) modal.style.display = 'none';
}

// Mark notification as read
async function markNotificationRead(notificationId) {
    try {
        await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
        loadNotificationBadge();
        loadPanelContent(notificationCurrentTab);
    } catch (err) {
        console.error('Error:', err);
        showToast('Failed to mark notification as read', 'error');
    }
}

// Dismiss notification
async function dismissNotification(notificationId) {
    try {
        await fetch(`/api/notifications/${notificationId}/dismiss`, { method: 'POST' });
        loadPanelContent(notificationCurrentTab);
        loadNotificationBadge();
    } catch (err) {
        console.error('Error:', err);
        showToast('Failed to dismiss notification', 'error');
    }
}

// Get icon for notification type
function getNotificationIcon(type) {
    const icons = {
        assignment: '📌',
        overdue: '⚠️',
        upcoming_event: '📅',
        payment_received: '💰',
        new_message: '✉️',
        document_approval: '📄',
        event_reminder: '🔔',
        report_reminder: '📊',
        announcement: '📢',
        system: '⚙️',
        feedback: '⭐',
        approval_required: '✅'
    };
    return icons[type] || '🔔';
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initNotifications();
});
