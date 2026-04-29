// Dashboard JavaScript file for Arrow-Park Ventures (APV)

// Toast notification system
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: var(--radius);
        color: white;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
    `;

    if (type === 'success') toast.style.backgroundColor = 'var(--primary)';
    else if (type === 'error') toast.style.backgroundColor = 'var(--destructive)';
    else if (type === 'warning') toast.style.backgroundColor = 'var(--accent)';
    else toast.style.backgroundColor = 'var(--muted-foreground)';

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    // Animate out
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, duration);
}

document.addEventListener('DOMContentLoaded', function() {
    // Load dashboard data
    loadDashboardData();

    // Sidebar toggle functionality
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }

    if (mobileSidebarToggle && sidebar) {
        mobileSidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }

    // Audit log filtering and search
    const auditSearch = document.getElementById('auditSearch');
    const auditActionFilter = document.getElementById('auditActionFilter');
    const auditEntityFilter = document.getElementById('auditEntityFilter');

    const updateAuditFilters = () => {
        if (!auditSearch && !auditActionFilter && !auditEntityFilter) return;
        const params = new URLSearchParams();
        if (auditSearch?.value.trim()) params.set('search', auditSearch.value.trim());
        if (auditActionFilter?.value) params.set('action', auditActionFilter.value);
        if (auditEntityFilter?.value) params.set('entityType', auditEntityFilter.value);
        location.href = `/dashboard/audit-logs?${params.toString()}`;
    };

    auditSearch?.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            updateAuditFilters();
        }
    });

    auditActionFilter?.addEventListener('change', updateAuditFilters);
    auditEntityFilter?.addEventListener('change', updateAuditFilters);

    // ============ SCHOOLS PAGE FILTERS ============
    const schoolSearch = document.getElementById('schoolSearch');
    const statusFilter = document.getElementById('statusFilter');
    const serviceStatusFilter = document.getElementById('serviceStatusFilter');
    const zoneFilter = document.getElementById('zoneFilter');
    const schoolSortOrder = document.getElementById('schoolSortOrder');

    const updateSchoolFilters = () => {
        const params = new URLSearchParams();
        if (schoolSearch?.value.trim()) params.set('search', schoolSearch.value.trim());
        if (statusFilter?.value) params.set('status', statusFilter.value);
        if (serviceStatusFilter?.value) params.set('serviceStatus', serviceStatusFilter.value);
        if (zoneFilter?.value) params.set('zone', zoneFilter.value);
        if (schoolSortOrder?.value) {
            const [sortBy, order] = schoolSortOrder.value.split('-');
            params.set('sortBy', sortBy || 'name');
            params.set('order', order || 'asc');
        }
        location.href = `/dashboard/schools?${params.toString()}`;
    };

    schoolSearch?.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), updateSchoolFilters()));
    [statusFilter, serviceStatusFilter, zoneFilter, schoolSortOrder].forEach(el => el?.addEventListener('change', updateSchoolFilters));

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (sidebar && !sidebar.contains(e.target) && (!mobileSidebarToggle || !mobileSidebarToggle.contains(e.target))) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Sorting tables
    const schoolSelect = document.getElementById('schoolSortOrder');
    const schoolTable = document.getElementById('schoolsTable')?.querySelector('tbody');

    if (schoolSelect && schoolTable) {
        schoolSelect.addEventListener('change', function() {
            const rows = Array.from(schoolTable.querySelectorAll('tr'));
            const order = this.value;

            rows.sort((a, b) => {
                const textA = a.cells[0].textContent.trim().toLowerCase();
                const textB = b.cells[0].textContent.trim().toLowerCase();
                return order === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA);
            });

            rows.forEach(row => schoolTable.appendChild(row));
        });
    }

    const eventSelect = document.getElementById('eventSortOrder');
    const eventTable = document.getElementById('eventTable')?.querySelector('tbody');

    if (eventSelect && eventTable) {
        eventSelect.addEventListener('change', function() {
            const rows = Array.from(eventTable.querySelectorAll('tr'));
            const order = this.value;

            rows.sort((a, b) => {
                const textA = a.cells[0].textContent.trim().toLowerCase();
                const textB = b.cells[0].textContent.trim().toLowerCase();
                return order === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA);
            });

            rows.forEach(row => eventTable.appendChild(row));
        });
    }

    const staffSelect = document.getElementById('staffSortOrder');
    const staffTable = document.getElementById('staffTable')?.querySelector('tbody');

    if (staffSelect && staffTable) {
        staffSelect.addEventListener('change', function() {
            const rows = Array.from(staffTable.querySelectorAll('tr'));
            const order = this.value;

            rows.sort((a, b) => {
                const textA = a.cells[1]?.textContent.trim().toLowerCase() || '';
                const textB = b.cells[1]?.textContent.trim().toLowerCase() || '';
                return order === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA);
            });

            rows.forEach(row => staffTable.appendChild(row));
        });
    }
});

async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard-data');
        const data = await response.json();

        // Update stats
        updateStats(data);

        // Update recent activities
        updateActivities(data.recentActivities);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Use fallback data
        const fallbackData = {
            totalSchools: 25,
            activeStudents: 523,
            upcomingEvents: 8,
            growthRate: 24,
            recentActivities: [
                {
                    title: 'New trainer onboarded',
                    description: 'John Smith joined as Rover Scout',
                    time: '2 hours ago'
                },
                {
                    title: 'Summer Camp registration opened',
                    description: '15 students already registered',
                    time: '1 day ago'
                },
                {
                    title: 'New school partnership',
                    description: 'Greenwood Elementary joined our program',
                    time: '3 days ago'
                }
            ]
        };

        updateStats(fallbackData);
        updateActivities(fallbackData.recentActivities);
    }
}

function updateStats(data) {
    const totalSchoolsEl = document.getElementById('totalSchools');
    const activeStudentsEl = document.getElementById('activeStudents');
    const upcomingEventsEl = document.getElementById('upcomingEvents');
    const growthRateEl = document.getElementById('growthRate');

    if (totalSchoolsEl) totalSchoolsEl.textContent = data.totalSchools;
    if (activeStudentsEl) activeStudentsEl.textContent = data.activeStudents;
    if (upcomingEventsEl) upcomingEventsEl.textContent = data.upcomingEvents;
    if (growthRateEl) growthRateEl.textContent = `+${data.growthRate}%`;
}

function updateActivities(activities) {
    const activitiesContainer = document.getElementById('recentActivities');

    if (!activitiesContainer || !activities) return;

    activitiesContainer.innerHTML = '';

    activities.forEach(activity => {
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-item';

        activityElement.innerHTML = `
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
            </div>
            <div class="activity-time">${activity.time}</div>
        `;

        activitiesContainer.appendChild(activityElement);
    });
}

// ============= STAFF MANAGEMENT FUNCTIONS =============

// Open edit staff modal
// Edit staff
async function editStaff(staffId) {
    try {
        // Fetch full staff details
        const response = await fetch(`/api/staff/${staffId}`);
        const staff = await response.json();

        if (!response.ok) {
            alert('Error loading staff details');
            return;
        }

        // Populate form fields
        document.getElementById('editStaffId').value = staff._id;
        document.getElementById('editIdNumber').value = staff.idNumber || '';
        document.getElementById('editName').value = staff.name;
        document.getElementById('editEmail').value = staff.email;
        document.getElementById('editPhone').value = staff.phone || '';
        document.getElementById('editRole').value = staff.role;
        document.getElementById('editDepartment').value = staff.department || '';
        document.getElementById('editStatus').value = staff.status;

        // Address fields
        document.getElementById('editStreet').value = staff.address?.street || '';
        document.getElementById('editCity').value = staff.address?.city || '';
        document.getElementById('editState').value = staff.address?.state || '';
        document.getElementById('editZipCode').value = staff.address?.zipCode || '';
        document.getElementById('editCountry').value = staff.address?.country || 'Kenya';

        // Emergency contact fields
        document.getElementById('editEmergencyContactName').value = staff.emergencyContact?.name || '';
        document.getElementById('editEmergencyContactRelationship').value = staff.emergencyContact?.relationship || '';
        document.getElementById('editEmergencyContactPhone').value = staff.emergencyContact?.phone || '';
        document.getElementById('editEmergencyContactEmail').value = staff.emergencyContact?.email || '';

        // Permission checkboxes
        document.getElementById('editCanViewFinancials').checked = staff.permissions?.canViewFinancials || false;
        document.getElementById('editCanApproveReports').checked = staff.permissions?.canApproveReports || false;
        document.getElementById('editCanScheduleEvents').checked = staff.permissions?.canScheduleEvents || false;
        document.getElementById('editCanManageStaff').checked = staff.permissions?.canManageStaff || false;
        document.getElementById('editCanViewAnalytics').checked = staff.permissions?.canViewAnalytics || false;
        document.getElementById('editCanManageSchools').checked = staff.permissions?.canManageSchools || false;
        document.getElementById('editCanSendInvitations').checked = staff.permissions?.canSendInvitations || false;

        // Performance metric inputs
        document.getElementById('editEventsCompleted').value = staff.performanceMetrics?.eventsCompleted || 0;
        document.getElementById('editReportsSubmitted').value = staff.performanceMetrics?.reportsSubmitted || 0;
        document.getElementById('editSchoolsVisited').value = staff.performanceMetrics?.schoolsVisited || 0;
        document.getElementById('editAverageAttendanceRate').value = staff.performanceMetrics?.averageAttendanceRate || 0;
        document.getElementById('editAverageFeedbackRating').value = staff.performanceMetrics?.averageFeedbackRating || 0;
        document.getElementById('editLastPerformanceReview').value = staff.performanceMetrics?.lastPerformanceReview ? new Date(staff.performanceMetrics.lastPerformanceReview).toISOString().slice(0, 10) : '';

        // Clear any previous messages
        const messageEl = document.getElementById('editMessage');
        messageEl.style.display = 'none';
        messageEl.textContent = '';

        // Show the modal
        const modal = document.getElementById('editStaffModal');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading staff details:', error);
        alert('Error loading staff details');
    }
}

// Close edit staff modal
function closeEditStaffModal() {
    const modal = document.getElementById('editStaffModal');
    modal.style.display = 'none';
    modal.classList.remove('active');
}

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const modal = document.getElementById('editStaffModal');
    if (event.target === modal) {
        closeEditStaffModal();
    }
});

// Save edited staff
async function saveEditStaff() {
    const staffId = document.getElementById('editStaffId').value;
    const idNumber = document.getElementById('editIdNumber').value;
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const phone = document.getElementById('editPhone').value;
    const role = document.getElementById('editRole').value;
    const department = document.getElementById('editDepartment').value;
    const status = document.getElementById('editStatus').value;

    // Address fields
    const street = document.getElementById('editStreet').value;
    const city = document.getElementById('editCity').value;
    const state = document.getElementById('editState').value;
    const zipCode = document.getElementById('editZipCode').value;
    const country = document.getElementById('editCountry').value;

    // Emergency contact fields
    const emergencyContactName = document.getElementById('editEmergencyContactName').value;
    const emergencyContactRelationship = document.getElementById('editEmergencyContactRelationship').value;
    const emergencyContactPhone = document.getElementById('editEmergencyContactPhone').value;
    const emergencyContactEmail = document.getElementById('editEmergencyContactEmail').value;

    // Permission checkboxes
    const canViewFinancials = document.getElementById('editCanViewFinancials').checked;
    const canApproveReports = document.getElementById('editCanApproveReports').checked;
    const canScheduleEvents = document.getElementById('editCanScheduleEvents').checked;
    const canManageStaff = document.getElementById('editCanManageStaff').checked;
    const canViewAnalytics = document.getElementById('editCanViewAnalytics').checked;
    const canManageSchools = document.getElementById('editCanManageSchools').checked;
    const canSendInvitations = document.getElementById('editCanSendInvitations').checked;

    const messageEl = document.getElementById('editMessage');

    // Validate required fields
    if (!name || !email || !role) {
        messageEl.textContent = '✗ Please fill in all required fields';
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/dashboard/staff/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                staffId,
                idNumber: idNumber || null,
                name,
                email,
                phone: phone || null,
                role,
                department: department || 'Training',
                status,
                street: street || null,
                city: city || null,
                state: state || null,
                zipCode: zipCode || null,
                country: country || 'Kenya',
                emergencyContactName: emergencyContactName || null,
                emergencyContactRelationship: emergencyContactRelationship || null,
                emergencyContactPhone: emergencyContactPhone || null,
                emergencyContactEmail: emergencyContactEmail || null,
                canViewFinancials,
                canApproveReports,
                canScheduleEvents,
                canManageStaff,
                canViewAnalytics,
                canManageSchools,
                canSendInvitations,
                eventsCompleted: document.getElementById('editEventsCompleted').value,
                reportsSubmitted: document.getElementById('editReportsSubmitted').value,
                schoolsVisited: document.getElementById('editSchoolsVisited').value,
                averageAttendanceRate: document.getElementById('editAverageAttendanceRate').value,
                averageFeedbackRating: document.getElementById('editAverageFeedbackRating').value,
                lastPerformanceReview: document.getElementById('editLastPerformanceReview').value
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            messageEl.textContent = '✓ Staff member updated successfully';
            messageEl.style.backgroundColor = '#d4edda';
            messageEl.style.color = '#155724';
            messageEl.style.borderLeft = '4px solid #28a745';
            messageEl.style.display = 'block';

            // Reload page after 1.5 seconds
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            messageEl.textContent = '✗ ' + (data.error || 'Error updating staff member');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.borderLeft = '4px solid #f5c6cb';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error updating staff:', error);
        messageEl.textContent = '✗ Network error: ' + error.message;
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
    }
}

// Delete staff
async function deleteStaff(staffId) {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/dashboard/staff/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ staffId })
        });

        const data = await response.json();
        if (data.success) {
            showToast('Staff member deleted successfully', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast('Error: ' + (data.error || 'Failed to delete staff member'), 'error');
        }
    } catch (error) {
        console.error('Error deleting staff:', error);
        showToast('Network error while deleting staff member', 'error');
    }
}

// View staff profile
async function viewStaffProfile(staffId) {
    try {
        // Fetch full staff details
        const response = await fetch(`/api/staff/${staffId}`);
        const staff = await response.json();

        if (!response.ok) {
            alert('Error loading staff profile');
            return;
        }

        // Populate profile fields
        document.getElementById('profileStaffName').textContent = staff.name;
        document.getElementById('profileIdNumber').textContent = staff.idNumber || '—';
        document.getElementById('profileName').textContent = staff.name;
        document.getElementById('profileEmail').textContent = staff.email;
        document.getElementById('profilePhone').textContent = staff.phone || '—';
        document.getElementById('profileRole').textContent = staff.role;
        document.getElementById('profileStatus').textContent = staff.status;
        document.getElementById('profileDepartment').textContent = staff.department || '—';
        document.getElementById('profileStartDate').textContent = staff.employmentStartDate ? new Date(staff.employmentStartDate).toLocaleDateString() : '—';

        // Address
        document.getElementById('profileStreet').textContent = staff.address?.street || '—';
        document.getElementById('profileCity').textContent = staff.address?.city || '—';
        document.getElementById('profileState').textContent = staff.address?.state || '—';
        document.getElementById('profileZipCode').textContent = staff.address?.zipCode || '—';
        document.getElementById('profileCountry').textContent = staff.address?.country || '—';

        // Emergency contact
        document.getElementById('profileEmergencyName').textContent = staff.emergencyContact?.name || '—';
        document.getElementById('profileEmergencyRelationship').textContent = staff.emergencyContact?.relationship || '—';
        document.getElementById('profileEmergencyPhone').textContent = staff.emergencyContact?.phone || '—';
        document.getElementById('profileEmergencyEmail').textContent = staff.emergencyContact?.email || '—';

        // Certifications
        const certContainer = document.getElementById('profileCertifications');
        if (staff.certifications && staff.certifications.length > 0) {
            certContainer.innerHTML = staff.certifications.map(cert => `
                <div class="certification-item">
                    <strong>${cert.name}</strong> (${cert.issuer})<br>
                    Issued: ${cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : '—'} |
                    Expires: ${cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : '—'} |
                    Status: <span class="badge badge-${cert.status === 'active' ? 'success' : cert.status === 'expired' ? 'danger' : 'warning'}">${cert.status}</span>
                </div>
            `).join('');
        } else {
            certContainer.innerHTML = '<p class="placeholder-text">No certifications found.</p>';
        }

        // Assigned schools
        const schoolContainer = document.getElementById('profileAssignedSchools');
        if (staff.assignedSchools && staff.assignedSchools.length > 0) {
            // We need to fetch school names
            const schoolPromises = staff.assignedSchools.map(async (assignment) => {
                try {
                    const schoolResponse = await fetch(`/api/school/${assignment.schoolId}`);
                    const school = await schoolResponse.json();
                    return {
                        ...assignment,
                        schoolName: school.name || 'Unknown School'
                    };
                } catch (error) {
                    return {
                        ...assignment,
                        schoolName: 'Unknown School'
                    };
                }
            });

            const assignmentsWithNames = await Promise.all(schoolPromises);
            schoolContainer.innerHTML = assignmentsWithNames.map(assignment => `
                <div class="assignment-item">
                    <strong>${assignment.schoolName}</strong><br>
                    Type: ${assignment.assignmentType} |
                    Assigned: ${assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleDateString() : 'Unknown'} |
                    Status: <span class="badge badge-${assignment.status === 'active' ? 'success' : 'warning'}">${assignment.status}</span>
                </div>
            `).join('');
        } else {
            schoolContainer.innerHTML = '<p class="placeholder-text">No school assignments found.</p>';
        }

        // Availability
        const availabilityContainer = document.getElementById('profileAvailability');
        if (staff.availability && staff.availability.length > 0) {
            availabilityContainer.innerHTML = staff.availability.map(slot => `
                <div class="availability-item">
                    <strong>${slot.date ? new Date(slot.date).toLocaleDateString() : 'Unknown Date'}</strong> — ${slot.status || 'available'}${slot.notes ? ` | ${slot.notes}` : ''}
                </div>
            `).join('');
        } else {
            availabilityContainer.innerHTML = '<p class="placeholder-text">No availability data available.</p>';
        }

        // Leave history
        const leaveContainer = document.getElementById('profileLeaveHistory');
        if (staff.leaveHistory && staff.leaveHistory.length > 0) {
            leaveContainer.innerHTML = staff.leaveHistory.map(leave => `
                <div class="leave-item">
                    <strong>${leave.type ? leave.type.charAt(0).toUpperCase() + leave.type.slice(1) : 'Leave'}</strong> —
                    ${leave.startDate ? new Date(leave.startDate).toLocaleDateString() : 'N/A'} to ${leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'N/A'}
                    <br>Status: <span class="badge badge-${leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}">${leave.status}</span>
                    ${leave.notes ? `<br>Notes: ${leave.notes}` : ''}
                </div>
            `).join('');
        } else {
            leaveContainer.innerHTML = '<p class="placeholder-text">No leave history found.</p>';
        }

        // Performance metrics
        document.getElementById('profileEventsCompleted').textContent = staff.performanceMetrics?.eventsCompleted || 0;
        document.getElementById('profileReportsSubmitted').textContent = staff.performanceMetrics?.reportsSubmitted || 0;
        document.getElementById('profileSchoolsVisited').textContent = staff.performanceMetrics?.schoolsVisited || 0;
        document.getElementById('profileAttendanceRate').textContent = `${staff.performanceMetrics?.averageAttendanceRate || 0}%`;
        document.getElementById('profileFeedbackRating').textContent = staff.performanceMetrics?.averageFeedbackRating || 0;
        document.getElementById('profileLastReview').textContent = staff.performanceMetrics?.lastPerformanceReview ? new Date(staff.performanceMetrics.lastPerformanceReview).toLocaleDateString() : '—';

        // Show the modal
        const modal = document.getElementById('staffProfileModal');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading staff profile:', error);
        alert('Error loading staff profile');
    }
}

// Close staff profile modal
function closeStaffProfileModal() {
    const modal = document.getElementById('staffProfileModal');
    modal.style.display = 'none';
}

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const modal = document.getElementById('staffProfileModal');
    if (event.target === modal) {
        closeStaffProfileModal();
    }
});

// Edit permissions
async function editPermissions(role) {
    try {
        // Fetch current permissions
        const response = await fetch(`/api/permissions/${role}`);
        const perm = await response.json();

        if (!response.ok) {
            alert('Error loading permissions');
            return;
        }

        // Populate form
        document.getElementById('editPermRole').textContent = role;
        document.getElementById('editPermRoleHidden').value = role;

        // Set checkboxes
        document.getElementById('permCanViewStaff').checked = perm.permissions.canViewStaff || false;
        document.getElementById('permCanCreateStaff').checked = perm.permissions.canCreateStaff || false;
        document.getElementById('permCanEditStaff').checked = perm.permissions.canEditStaff || false;
        document.getElementById('permCanDeleteStaff').checked = perm.permissions.canDeleteStaff || false;
        document.getElementById('permCanInviteStaff').checked = perm.permissions.canInviteStaff || false;
        document.getElementById('permCanResetPasswords').checked = perm.permissions.canResetPasswords || false;
        document.getElementById('permCanViewSchools').checked = perm.permissions.canViewSchools || false;
        document.getElementById('permCanEditSchools').checked = perm.permissions.canEditSchools || false;
        document.getElementById('permCanAssignTrainers').checked = perm.permissions.canAssignTrainers || false;
        document.getElementById('permCanViewEvents').checked = perm.permissions.canViewEvents || false;
        document.getElementById('permCanCreateEvents').checked = perm.permissions.canCreateEvents || false;
        document.getElementById('permCanViewPrograms').checked = perm.permissions.canViewPrograms || false;
        document.getElementById('permCanViewBookings').checked = perm.permissions.canViewBookings || false;
        document.getElementById('permCanGenerateReports').checked = perm.permissions.canGenerateReports || false;
        document.getElementById('permCanManageSystem').checked = perm.permissions.canManageSystem || false;
        document.getElementById('permCanViewAnalytics').checked = perm.permissions.canViewAnalytics || false;
        document.getElementById('permCanViewAuditLogs').checked = perm.permissions.canViewAuditLogs || false;
        document.getElementById('permCanManagePermissions').checked = perm.permissions.canManagePermissions || false;

        // Clear messages
        const messageEl = document.getElementById('editPermMessage');
        messageEl.style.display = 'none';
        messageEl.textContent = '';

        // Show modal
        const modal = document.getElementById('editPermissionsModal');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading permissions:', error);
        alert('Error loading permissions');
    }
}

// Close edit permissions modal
function closeEditPermissionsModal() {
    const modal = document.getElementById('editPermissionsModal');
    modal.style.display = 'none';
}

// Save permissions
async function savePermissions() {
    const role = document.getElementById('editPermRoleHidden').value;
    const permissions = {
        canViewStaff: document.getElementById('permCanViewStaff').checked,
        canCreateStaff: document.getElementById('permCanCreateStaff').checked,
        canEditStaff: document.getElementById('permCanEditStaff').checked,
        canDeleteStaff: document.getElementById('permCanDeleteStaff').checked,
        canInviteStaff: document.getElementById('permCanInviteStaff').checked,
        canResetPasswords: document.getElementById('permCanResetPasswords').checked,
        canViewSchools: document.getElementById('permCanViewSchools').checked,
        canEditSchools: document.getElementById('permCanEditSchools').checked,
        canAssignTrainers: document.getElementById('permCanAssignTrainers').checked,
        canViewEvents: document.getElementById('permCanViewEvents').checked,
        canCreateEvents: document.getElementById('permCanCreateEvents').checked,
        canViewPrograms: document.getElementById('permCanViewPrograms').checked,
        canViewBookings: document.getElementById('permCanViewBookings').checked,
        canGenerateReports: document.getElementById('permCanGenerateReports').checked,
        canManageSystem: document.getElementById('permCanManageSystem').checked,
        canViewAnalytics: document.getElementById('permCanViewAnalytics').checked,
        canViewAuditLogs: document.getElementById('permCanViewAuditLogs').checked,
        canManagePermissions: document.getElementById('permCanManagePermissions').checked
    };

    try {
        const response = await fetch('/api/permissions/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role, permissions })
        });

        const data = await response.json();
        const messageEl = document.getElementById('editPermMessage');

        if (data.success) {
            messageEl.className = 'message success';
            messageEl.textContent = 'Permissions updated successfully';
            messageEl.style.display = 'block';
            setTimeout(() => {
                closeEditPermissionsModal();
                window.location.reload();
            }, 1500);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = data.error || 'Failed to update permissions';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error saving permissions:', error);
        const messageEl = document.getElementById('editPermMessage');
        messageEl.className = 'message error';
        messageEl.textContent = 'Network error while saving permissions';
        messageEl.style.display = 'block';
    }
}

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const modal = document.getElementById('editPermissionsModal');
    if (event.target === modal) {
        closeEditPermissionsModal();
    }
});

// ============ TRAINER MANAGEMENT FUNCTIONS ============

// Edit trainer
async function editTrainer(trainerId) {
    const messageEl = document.getElementById('editTrainerMessage');
    messageEl.style.display = 'none';
    messageEl.textContent = '';

    try {
        const response = await fetch(`/dashboard/trainer/${trainerId}/details`);
        const data = await response.json();

        if (!response.ok || !data.success || !data.trainer) {
            throw new Error(data.error || 'Unable to load trainer details');
        }

        const trainer = data.trainer;
        document.getElementById('editTrainerId').value = trainerId;
        document.getElementById('editTrainerIdNumber').value = trainer.idNumber || '';
        document.getElementById('editTrainerName').value = trainer.name || '';
        document.getElementById('editTrainerEmail').value = trainer.email || '';
        document.getElementById('editTrainerPhone').value = trainer.phone || '';
        document.getElementById('editTrainerStatus').value = trainer.status || '';

        const modal = document.getElementById('editTrainerModal');
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading trainer details:', error);
        messageEl.textContent = '✗ Error loading trainer details: ' + error.message;
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
    }
}

// Close trainer edit modal
function closeEditTrainerModal() {
    const modal = document.getElementById('editTrainerModal');
    modal.style.display = 'none';
}

// Click outside modal to close
document.addEventListener('click', function(event) {
    const modal = document.getElementById('editTrainerModal');
    if (modal && event.target === modal) {
        closeEditTrainerModal();
    }
});

// Save edited trainer
async function saveEditTrainer() {
    const trainerId = document.getElementById('editTrainerId').value;
    const idNumber = document.getElementById('editTrainerIdNumber').value;
    const name = document.getElementById('editTrainerName').value;
    const email = document.getElementById('editTrainerEmail').value;
    const phone = document.getElementById('editTrainerPhone').value;
    const status = document.getElementById('editTrainerStatus').value;
    const messageEl = document.getElementById('editTrainerMessage');

    // Validation
    if (!name || !email || !status) {
        messageEl.textContent = 'Please fill in all required fields (Name, Email, Status)';
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/dashboard/trainer/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trainerId,
                idNumber,
                name,
                email,
                phone,
                status
            })
        });

        const data = await response.json();
        if (data.success) {
            messageEl.textContent = '✓ Trainer updated successfully!';
            messageEl.style.backgroundColor = '#d4edda';
            messageEl.style.color = '#155724';
            messageEl.style.borderLeft = '4px solid #c3e6cb';
            messageEl.style.display = 'block';
            
            // Reload after 1 second
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            messageEl.textContent = '✗ ' + (data.error || 'Error updating trainer');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.borderLeft = '4px solid #f5c6cb';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error updating trainer:', error);
        messageEl.textContent = '✗ Network error: ' + error.message;
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
    }
}

// Delete trainer
async function deleteTrainer(trainerId) {
    if (!confirm('Are you sure you want to delete this trainer? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/dashboard/trainer/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trainerId })
        });

        const data = await response.json();
        if (data.success) {
            showToast('Trainer deleted successfully', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast('Error: ' + (data.error || 'Failed to delete trainer'), 'error');
        }
    } catch (error) {
        console.error('Error deleting trainer:', error);
        showToast('Network error while deleting trainer', 'error');
    }
}

// ============ SCHOOL ALLOCATION FUNCTIONS ============

// Open allocate schools modal
async function openAllocateSchoolsModal(trainerId) {
    const messageEl = document.getElementById('allocateMessage');
    messageEl.style.display = 'none';

    try {
        const response = await fetch(`/dashboard/trainer/${trainerId}/details`);
        const data = await response.json();

        if (!response.ok || !data.success || !data.trainer) {
            throw new Error(data.error || 'Unable to load trainer details');
        }

        const trainerName = data.trainer.name || 'Trainer';
        document.getElementById('allocateTrainerName').textContent = trainerName;
        document.getElementById('allocateTrainerId').value = trainerId;

        const schoolsResponse = await fetch(`/dashboard/trainer/${trainerId}/schools`);
        const schoolsData = await schoolsResponse.json();

        if (!schoolsResponse.ok || !schoolsData.success) {
            throw new Error(schoolsData.error || 'Unable to load schools');
        }

        renderSchoolsList(schoolsData.schools, schoolsData.allocatedSchools || []);
        const modal = document.getElementById('allocateSchoolsModal');
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading schools:', error);
        messageEl.textContent = '✗ Error loading allocation data: ' + error.message;
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.display = 'block';
    }
}

// Render schools list with checkboxes
function renderSchoolsList(schools, allocatedSchools) {
    const listContainer = document.getElementById('allocateSchoolsList');
    
    if (!schools || schools.length === 0) {
        listContainer.innerHTML = '<p class="placeholder-text">No schools available.</p>';
        return;
    }

    let html = '<div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem;">';
    
    schools.forEach(school => {
        const isAllocated = allocatedSchools.some(s => s._id === school._id || s === school._id);
        html += `
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.75rem; border: 1px solid #e0e0e0; border-radius: 0.5rem; transition: background-color 0.2s;">
                <input type="checkbox" name="school" value="${school._id}" ${isAllocated ? 'checked' : ''} 
                    style="cursor: pointer; width: 18px; height: 18px;">
                <div>
                    <strong>${school.name}</strong>
                    <br>
                    <small style="color: #666;">${school.address?.city || 'Location not specified'}</small>
                </div>
            </label>
        `;
    });
    
    html += '</div>';
    listContainer.innerHTML = html;
}

// Close allocate schools modal
function closeAllocateSchoolsModal() {
    const modal = document.getElementById('allocateSchoolsModal');
    modal.style.display = 'none';
}

// Click outside modal to close
document.addEventListener('click', function(event) {
    const modal = document.getElementById('allocateSchoolsModal');
    if (modal && event.target === modal) {
        closeAllocateSchoolsModal();
    }
});

// Save school allocation
async function saveSchoolAllocation() {
    const trainerId = document.getElementById('allocateTrainerId').value;
    const checkboxes = document.querySelectorAll('input[name="school"]:checked');
    const selectedSchools = Array.from(checkboxes).map(cb => cb.value);
    const messageEl = document.getElementById('allocateMessage');

    try {
        const response = await fetch('/dashboard/trainer/allocate-schools', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trainerId,
                schoolIds: selectedSchools
            })
        });

        const data = await response.json();
        if (data.success) {
            messageEl.textContent = '✓ Schools allocated successfully! Redirecting to schools page...';
            messageEl.style.backgroundColor = '#d4edda';
            messageEl.style.color = '#155724';
            messageEl.style.borderLeft = '4px solid #c3e6cb';
            messageEl.style.display = 'block';

            setTimeout(() => {
                window.location.href = '/dashboard/schools';
            }, 800);
        } else {
            messageEl.textContent = '✗ ' + (data.error || 'Error allocating schools');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.borderLeft = '4px solid #f5c6cb';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error allocating schools:', error);
        messageEl.textContent = '✗ Network error: ' + error.message;
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
    }
}

// Chart functionality (placeholder for future implementation)
function initializeCharts() {
    // This would initialize charts using a library like Chart.js
    console.log('Charts initialization placeholder');
}

// School sorting functionality is now handled inside the main DOMContentLoaded listener above.

// ============ SCHOOL ONBOARDING WIZARD ============

let currentOnboardingStep = 0;
let schoolFormData = {};

function openOnboardingModal() {
    currentOnboardingStep = 0;
    schoolFormData = {};
    document.getElementById('onboardingModal').style.display = 'flex';
    showOnboardingStep(0);
    updateOnboardingUI();

    // Attach event listener to next button (ensure it's attached after modal is in DOM)
    const nextBtn = document.getElementById('nextStepBtn');
    if (nextBtn) {
        nextBtn.onclick = function(e) {
            if (currentOnboardingStep === 3) {
                e.preventDefault();
                submitOnboarding();
            } else {
                changeOnboardingStep(1);
            }
        };
    }
}

function closeOnboardingModal() {
    document.getElementById('onboardingModal').style.display = 'none';
    document.getElementById('onboardingForm').reset();
    currentOnboardingStep = 0;
    schoolFormData = {};
}

function changeOnboardingStep(delta) {
    const totalSteps = 4;
    const newStep = currentOnboardingStep + delta;
    if (newStep < 0 || newStep >= totalSteps) {
        console.log('Step change out of bounds:', currentOnboardingStep, '->', newStep);
        return;
    }
    
    // Validate current step before moving forward
    if (delta > 0 && !validateOnboardingStep(currentOnboardingStep)) {
        console.log('Validation failed for step', currentOnboardingStep);
        return;
    }

    console.log('Changing step from', currentOnboardingStep, 'to', newStep);
    currentOnboardingStep = newStep;
    showOnboardingStep(currentOnboardingStep);
    updateOnboardingUI();
}

function showOnboardingStep(stepIndex) {
    document.querySelectorAll('.onboarding-step').forEach((el, idx) => {
        el.style.display = idx === stepIndex ? 'grid' : 'none';
    });
}

function updateOnboardingUI() {
    // Update step indicators
    for (let i = 0; i < 4; i++) {
        const indicator = document.getElementById(`step-indicator-${i}`);
        if (indicator) {
            indicator.style.fontWeight = i === currentOnboardingStep ? 'bold' : 'normal';
            indicator.style.color = i <= currentOnboardingStep ? 'var(--primary)' : 'var(--muted-foreground)';
        }
    }

    // Update buttons
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    if (prevBtn) prevBtn.style.display = currentOnboardingStep === 0 ? 'none' : 'inline-block';
    if (nextBtn) {
        nextBtn.textContent = currentOnboardingStep === 3 ? 'Complete Onboarding' : 'Next Step';
    }

    // Update summary on last step
    if (currentOnboardingStep === 3) {
        updateOnboardingSummary();
    }
}

function validateOnboardingStep(step) {
    const stepElement = document.querySelector(`#step-${step}`);
    if (!stepElement) {
        console.error('Step element not found for step', step);
        return false;
    }
    const requiredInputs = stepElement.querySelectorAll('[required]');
    
    for (let input of requiredInputs) {
        if (!input.value.trim()) {
            showToast(`Please fill in all required fields`, 'error');
            input.focus();
            return false;
        }
    }
    return true;
}

function updateOnboardingSummary() {
    const form = document.getElementById('onboardingForm');
    const summary = document.getElementById('onboardingSummary');
    const name = form.name.value || 'School name';
    const city = form.city.value || 'City';
    const contact = form.contactName.value || 'Contact';
    const trainerSelect = form.primaryTrainerId;
    const trainerName = trainerSelect.options[trainerSelect.selectedIndex]?.text || 'Not assigned';
    
    summary.innerHTML = `
        <strong>${name}</strong><br>
        📍 ${city}<br>
        👤 ${contact}<br>
        📞 Trainer: ${trainerName}<br>
        📦 Package: ${form.servicePackage.value}
    `;
}

async function submitOnboarding() {
    const form = document.getElementById('onboardingForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const messageEl = document.getElementById('onboardingMessage');

    try {
        const response = await fetch('/dashboard/schools/onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            messageEl.textContent = '✓ School onboarded successfully! Redirecting...';
            messageEl.style.backgroundColor = '#d4edda';
            messageEl.style.color = '#155724';
            messageEl.style.borderLeft = '4px solid #28a745';
            messageEl.style.display = 'block';

            setTimeout(() => {
                window.location.href = '/dashboard/schools';
            }, 1500);
        } else {
            messageEl.textContent = '✗ ' + (result.error || 'Failed to onboard school');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.borderLeft = '4px solid #f5c6cb';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error onboarding school:', error);
        messageEl.textContent = '✗ Network error: ' + error.message;
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeft = '4px solid #f5c6cb';
        messageEl.style.display = 'block';
    }
}

// ============ SCOUT GROUP MANAGEMENT ============

function openAddScoutGroupModal(schoolId) {
    document.getElementById('scoutGroupSchoolId').value = schoolId;
    document.getElementById('addScoutGroupForm').reset();
    document.getElementById('scoutGroupMessage').style.display = 'none';
    document.getElementById('addScoutGroupModal').style.display = 'flex';
}

function closeAddScoutGroupModal() {
    document.getElementById('addScoutGroupModal').style.display = 'none';
}

async function saveScoutGroup() {
    const form = document.getElementById('addScoutGroupForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const messageEl = document.getElementById('scoutGroupMessage');

    // Validate required fields
    if (!data.name || !data.memberCount) {
        messageEl.textContent = 'Please fill in group name and member count';
        messageEl.className = 'message error';
        messageEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/scout-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            messageEl.textContent = '✓ Scout group added successfully';
            messageEl.className = 'message success';
            messageEl.style.display = 'block';
            
            setTimeout(() => {
                closeAddScoutGroupModal();
                window.location.reload();
            }, 1000);
        } else {
            messageEl.textContent = '✗ ' + (result.error || 'Failed to add scout group');
            messageEl.className = 'message error';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error adding scout group:', error);
        messageEl.textContent = '✗ Network error';
        messageEl.className = 'message error';
        messageEl.style.display = 'block';
    }
}

async function deleteScoutGroup(groupId) {
    if (!confirm('Delete this scout group? This cannot be undone.')) return;

    try {
        const response = await fetch(`/api/scout-groups/${groupId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            showToast('Scout group deleted successfully', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast('Error: ' + (result.error || 'Failed to delete group'), 'error');
        }
    } catch (error) {
        console.error('Error deleting scout group:', error);
        showToast('Network error while deleting group', 'error');
    }
}

// ============ UTILITY: CLOSE MODALS ON CLICK OUTSIDE ============

document.addEventListener('click', function(event) {
    const onboardingModal = document.getElementById('onboardingModal');
    if (event.target === onboardingModal) {
        closeOnboardingModal();
    }
    const scoutGroupModal = document.getElementById('addScoutGroupModal');
    if (event.target === scoutGroupModal) {
        closeAddScoutGroupModal();
    }
});

// Export functions for inline handlers and other scripts
window.DashboardUtils = {
    ...(window.DashboardUtils || {}),
    loadDashboardData,
    updateStats,
    updateActivities,
    initializeCharts,
    openOnboardingModal,
    closeOnboardingModal,
    changeOnboardingStep,
    openAddScoutGroupModal,
    closeAddScoutGroupModal,
    saveScoutGroup,
    deleteScoutGroup
};