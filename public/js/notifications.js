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

// ===== TRAINER COMPOSE HELPERS (must be on window for inline onclick) =====

// openComposeModal — called by the ✉️ Compose button in the Messages tab
window.openComposeModal = function() {
    var modal = document.getElementById('composeModal');
    if (!modal) return;
    modal.style.display = 'flex';
    var s = document.getElementById('composeRecipient');
    if (s) { s.value = ''; s.selectedIndex = 0; }
    var subj = document.getElementById('composeSubject');
    if (subj) { subj.value = ''; }
    var body = document.getElementById('composeBody');
    if (body) { body.value = ''; }
    var imp = document.getElementById('composeImportant');
    if (imp) { imp.checked = false; }
    var pri = document.getElementById('composePriority');
    if (pri) { pri.value = 'normal'; }
    var err = document.getElementById('composeError');
    if (err) { err.style.display = 'none'; }
    window.loadFounderRecipients && window.loadFounderRecipients();
};

// replyToMessage — called by the Reply button below the message modal body
window.replyToMessage = function() {
    if (!window._currentMessageData || !window._currentMessageData.senderId) {
        showToast('Cannot reply \u2013 sender information unavailable', 'error');
        return;
    }
    var msgModal = document.getElementById('messageModal');
    if (msgModal) msgModal.style.display = 'none';
    window.openComposeModal();
    var sel = document.getElementById('composeRecipient');
    if (sel && window._currentMessageData) {
        sel.innerHTML = '<option value="' + window._currentMessageData.senderId + '">' + escapeHtml(String(window._currentMessageData.senderName || '')) + '</option>';
    }
    var subjEl = document.getElementById('composeSubject');
    if (subjEl && window._currentMessageData) {
        var orig = window._currentMessageData.subject || '';
        subjEl.value = orig ? 'Re: ' + orig : '';
    }
    window._currentMessageData = null;
};

// ===== END TRAINER COMPOSE HELPERS =====

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
                let viewButton = '';
                if (isMessage) {
                    viewButton = `<button class="btn btn-sm btn-primary" onclick="openMessageModal('${notif.entityId}')">View</button>`;
                } else if (notif.type === 'report_reminder' && notif.entityId) {
                    // Always point trainers to their own event detail page for report submission
                    const trainerReportUrl = `/trainer/events/${notif.entityId}`;
                    viewButton = `<a href="${trainerReportUrl}" class="btn btn-sm btn-primary">Submit Report</a>`;
                } else if (notif.actionUrl) {
                    viewButton = `<a href="${notif.actionUrl}" class="btn btn-sm btn-primary">${notif.actionLabel || 'View'}</a>`;
                }

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

            // Add click handlers to navigate actionUrl when present
            document.querySelectorAll('.notification-item').forEach(el => {
                const id = el.dataset.id;
                const notif = data.notifications.find(n => String(n._id) === String(id));
                if (notif && notif.actionUrl) {
                    el.style.cursor = 'pointer';
                    el.addEventListener('click', function(e) {
                        // Avoid triggering buttons inside the card
                        if (e.target.closest('button')) return;
                        window.location.href = notif.actionUrl;
                    });
                }
            });
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

    container.innerHTML = `
        <div id="msgPanelToolbar" style="padding: 0.65rem 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--card); position: sticky; top: 0; z-index: 1;">
            <span style="font-size: 0.85rem; font-weight: 500; color: var(--muted-foreground);">Inbox</span>
            <button id="msgPanelComposeBtn" class="btn btn-sm btn-primary" onclick="openComposeModal()" style="display: flex; align-items: center; gap: 0.35rem;">
                ✉️ Compose
            </button>
        </div>
        <div id="messagesListInner" style="max-height: calc(100vh - 10rem); overflow-y: auto;">
            <div style="padding: 1rem; text-align: center;">Loading…</div>
        </div>
    `;

    const innerContainer = document.getElementById('messagesListInner');
    if (!innerContainer) return;

    try {
        const res = await fetch('/api/messages?folder=inbox&limit=20');
        const data = await res.json();
        if (data.success && data.messages.length > 0) {
            const currentUserId = window.currentUserId;
            innerContainer.innerHTML = data.messages.map(msg => `
                <div class="notification-item ${msg.recipients?.some(r => r.staffId === currentUserId && r.status !== 'read') ? 'unread' : ''}" data-id="${msg._id}">
                    <div style="padding: 1rem;">
                        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">✉️</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                                    <h4 style="margin: 0; font-size: 1rem;">${escapeHtml(msg.subject || '(No Subject)')}</h4>
                                    <small style="color: var(--muted-foreground); font-size: 0.75rem;">${new Date(msg.sentAt).toLocaleDateString()}</small>
                                </div>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--muted-foreground);">From: ${escapeHtml(msg.senderName)} — ${escapeHtml(msg.body.substring(0, 80))}${msg.body.length > 80 ? '…' : ''}</p>
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    <button class="btn btn-sm btn-primary" onclick="openMessageModal('${msg._id}')">View</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            innerContainer.innerHTML = '<div class="notification-dropdown-empty" style="padding: 2rem 1rem; text-align: center; color: var(--muted-foreground);">No messages yet.<br><small>Use <strong>✉️ Compose</strong> above to send one to your admin or founder.</small></div>';
        }
    } catch (err) {
        console.error('Error loading messages:', err);
        innerContainer.innerHTML = '<div class="notification-dropdown-empty" style="padding: 1rem; text-align: center;">Error loading messages</div>';
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
window._currentMessageData = null; // shared reply context for inline onclick handlers

// Open message modal
async function openMessageModal(messageId) {
    try {
        const res = await fetch(`/api/messages/${messageId}`);
        const data = await res.json();
        if (data.success && data.message) {
            const msg = data.message;
            window._currentMessageData = { _id: msg._id, senderId: msg.senderId?._id || msg.senderId, senderName: msg.senderName, subject: msg.subject || '' };

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
                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button class="btn btn-sm btn-primary" onclick="replyToMessage()">Reply</button>
                    </div>
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

// (replyToMessage defined in TRAINER COMPOSE HELPERS above — window.replyToMessage)
// Send messages to founders

// Load founders into trainer compose dropdown
window.loadFounderRecipients = async function() {
    var sel = document.getElementById('composeRecipient');
    var loading = document.getElementById('composeRecipientLoading');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading recipients...</option>';
    sel.disabled = true;
    if (loading) loading.style.display = 'inline';
    try {
        var res = await fetch('/api/trainer/founders');
        var data = await res.json();
        if (data.success && data.founders && data.founders.length > 0) {
            sel.innerHTML = '<option value="">Select a founder or admin...</option>' +
                data.founders.map(function(f) { return '<option value="' + f._id + '">' + escapeHtml(f.name) + ' \u2014 ' + escapeHtml(f.role || 'Admin') + '</option>'; }).join('');
        } else {
            sel.innerHTML = '<option value="">No founders or admins available</option>';
        }
    } catch (err) {
        sel.innerHTML = '<option value="">Error loading recipients</option>';
    } finally {
        sel.disabled = false;
        if (loading) loading.style.display = 'none';
    }
};

// Send the composed message from the trainer compose modal
window.sendComposedMessage = async function() {
    var sel = document.getElementById('composeRecipient');
    var bodyEl = document.getElementById('composeBody');
    var subjEl = document.getElementById('composeSubject');
    var impEl = document.getElementById('composeImportant');
    var priEl = document.getElementById('composePriority');
    var errEl = document.getElementById('composeError');
    var btn = document.getElementById('composeSendBtn');
    var lbl = document.getElementById('composeSendLabel');
    var spn = document.getElementById('composeSpinner');
    if (!sel || !bodyEl || !errEl) return;

    // Read value via both .value and selectedIndex[0] for robustness
    var recipientId = (sel.value || '').trim();
    if (!recipientId && sel.selectedIndex >= 0) {
        recipientId = (sel.options[sel.selectedIndex]?.value || '').trim();
    }
    console.log('[sendComposedMessage] sel.value="', sel.value, '" recipientId="', recipientId, '" selectedIndex=', sel.selectedIndex);
    var body = (bodyEl.value || '').trim();
    var subject = subjEl ? (subjEl.value || '').trim() : '';
    var isImportant = impEl ? impEl.checked : false;
    var priority = priEl ? priEl.value : 'normal';

    if (!recipientId || !body) {
        errEl.textContent = 'Please select a recipient and enter a message body.';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';
    if (btn) btn.disabled = true;
    if (lbl) lbl.style.display = 'none';
    if (spn) spn.style.display = 'inline';

    try {
        var payload = {
            recipientIds: [recipientId],
            subject: subject || 'Message from Trainer',
            body: body,
            priority: priority,
            isImportant: isImportant,
            messageType: 'direct'
        };
        console.log('[sendComposedMessage] payload:', JSON.stringify(payload));
        var res = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('[sendComposedMessage] response status:', res.status);
        var data = await res.json();
        if (data.success) {
            showToast('Message sent successfully', 'success');
            document.getElementById('composeModal') && (document.getElementById('composeModal').style.display = 'none');
            loadNotificationBadge();
            loadMessagesPanel();
        } else {
            console.error('[sendComposedMessage] server error:', data);
            errEl.textContent = 'Error: ' + (data.error || 'Failed to send message');
            errEl.style.display = 'block';
        }
    } catch (err) {
        console.error('[sendComposedMessage] network error:', err);
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
    } finally {
        if (btn) btn.disabled = false;
        if (lbl) lbl.style.display = 'inline';
        if (spn) spn.style.display = 'none';
    }
};

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
    // Poll unread counts periodically so admins see newly created booking notifications without requiring full page refresh
    try {
        setInterval(loadNotificationBadge, 30000); // every 30s
    } catch (e) {
        console.warn('Polling setup failed for notifications:', e);
    }
});
