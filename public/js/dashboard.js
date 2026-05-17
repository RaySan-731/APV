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
     const schoolStatusFilter = document.getElementById('statusFilter');
     const serviceStatusFilter = document.getElementById('serviceStatusFilter');
     const zoneFilter = document.getElementById('zoneFilter');
     const schoolSortOrder = document.getElementById('schoolSortOrder');

    const updateSchoolFilters = () => {
        const params = new URLSearchParams();
        if (schoolSearch?.value.trim()) params.set('search', schoolSearch.value.trim());
         if (schoolStatusFilter?.value) params.set('status', schoolStatusFilter.value);
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
     [schoolStatusFilter, serviceStatusFilter, zoneFilter, schoolSortOrder].forEach(el => el?.addEventListener('change', updateSchoolFilters));

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
     const staffSearch = document.getElementById('staffSearch');
     const roleFilter = document.getElementById('roleFilter');
     const staffStatusElement = document.getElementById('statusFilter');

     if (staffSelect && staffTable) {
        staffSelect.addEventListener('change', function() {
            const [sortBy, order] = this.value.split('-');
            sortStaffTable(sortBy, order);
        });
    }

    function sortStaffTable(sortBy = 'name', order = 'asc') {
        if (!staffTable) return;
        const rows = Array.from(staffTable.querySelectorAll('tr'));
        const hasPagination = document.getElementById('staffPagination') !== null;

        rows.forEach(row => {
            const cellIndex = sortBy === 'name' ? 1 : 0;
            const cellText = row.cells[cellIndex]?.textContent.trim().toLowerCase() || '';
            row.dataset.sortValue = cellText;
        });

        rows.sort((a, b) => {
            const valA = a.dataset.sortValue || '';
            const valB = b.dataset.sortValue || '';
            return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });

        // Clear and re-append sorted rows
        while (staffTable.firstChild) {
            staffTable.removeChild(staffTable.firstChild);
        }
        rows.forEach(row => staffTable.appendChild(row));

        // Update pagination if exists
        if (hasPagination) {
            updatePagination();
            filterStaffTable(); // Re-apply current filters
        }
    }

    function filterStaffTable() {
        if (!staffTable) return;
        const allRows = Array.from(staffTable.querySelectorAll('tr'));
        const placeholderRow = allRows.find(r => r.classList.contains('placeholder-row'));
        const staffRows = allRows.filter(r => !r.classList.contains('placeholder-row'));
        const hasStaffRows = staffRows.length > 0;

        // Case: No staff entries at all (empty DB)
        if (!hasStaffRows) {
            if (placeholderRow) placeholderRow.style.display = '';
            if (resultsContainer) resultsContainer.textContent = 'No staff members in the system. Add your first staff member below.';
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        // Normal filtering
        const searchTerm = staffSearch?.value.trim().toLowerCase() || '';
        const roleValue = roleFilter?.value || '';
         const statusValue = staffStatusElement?.value || '';

        let visibleCount = 0;
        staffRows.forEach(row => {
            const name = row.dataset.name || '';
            const email = row.dataset.email || '';
            const id = row.dataset.id || '';
            const role = row.dataset.role || '';
            const status = row.dataset.status || '';

            const matchesSearch = !searchTerm || 
                name.includes(searchTerm) || 
                email.includes(searchTerm) || 
                id.includes(searchTerm);
            const matchesRole = !roleValue || role.toLowerCase() === roleValue.toLowerCase();
            const matchesStatus = !statusValue || status.toLowerCase() === statusValue.toLowerCase();

            if (matchesSearch && matchesRole && matchesStatus) {
                row.classList.remove('hidden');
                row.style.display = '';
                visibleCount++;
            } else {
                row.classList.add('hidden');
                row.style.display = 'none';
            }
        });

        // Always hide placeholder when staff exist
        if (placeholderRow) placeholderRow.style.display = 'none';

        // Update results and pagination
        updatePagination();
    }

    // Setup event listeners for staff filters
    if (staffSearch) {
        staffSearch.addEventListener('input', debounce(filterStaffTable, 300));
        staffSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') this.value = '';
            filterStaffTable();
        });
    }
    if (roleFilter) roleFilter.addEventListener('change', filterStaffTable);
     if (staffStatusElement) staffStatusElement.addEventListener('change', filterStaffTable);

    // Action Dropdown Toggle
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('action-toggle')) {
            e.stopPropagation();
            const menu = e.target.nextElementSibling;
            const allMenus = document.querySelectorAll('.action-menu');
            allMenus.forEach(m => {
                if (m !== menu) m.style.display = 'none';
            });
            menu.style.display = menu.style.display === 'none' || menu.style.display === '' ? 'block' : 'none';
        } else if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.action-menu').forEach(m => m.style.display = 'none');
        }
    });

    // Debounce utility
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }



    // ============ STAFF PAGINATION ============
    const staffTableBody = document.getElementById('staffTable')?.querySelector('tbody');
    const paginationContainer = document.getElementById('staffPagination');
    const resultsContainer = document.getElementById('staffResults');
    const rowsPerPage = 10;

    function updatePagination() {
        if (!staffTable || !paginationContainer) return;

        const allRows = Array.from(staffTable.querySelectorAll('tr'));
        const visibleRows = [];
        
        // Filter visible rows and assign page numbers
        allRows.forEach(row => {
            if (!row.classList.contains('hidden') && !row.classList.contains('placeholder-row')) {
                visibleRows.push(row);
            }
        });

        const totalRows = visibleRows.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        const currentPage = parseInt(paginationContainer.dataset.currentPage) || 1;

        // Assign page number to each visible row
        visibleRows.forEach((row, idx) => {
            row.dataset.page = Math.floor(idx / rowsPerPage) + 1;
        });

        // Show/hide rows based on current page
        allRows.forEach(row => {
            const pageNum = parseInt(row.dataset.page);
            const isVisible = !row.classList.contains('hidden') && !row.classList.contains('placeholder-row');
            row.style.display = (isVisible && pageNum === currentPage) ? '' : 'none';
        });

        // Update results text
        if (resultsContainer) {
            if (totalRows === 0) {
                resultsContainer.textContent = 'No staff members match your criteria.';
            } else {
                const startIdx = (currentPage - 1) * rowsPerPage + 1;
                const endIdx = Math.min(currentPage * rowsPerPage, totalRows);
                resultsContainer.textContent = `Showing ${startIdx}–${endIdx} of ${totalRows} staff member${totalRows !== 1 ? 's' : ''}`;
            }
        }

        // Build pagination controls
        let html = '';
        if (totalPages > 1) {
            html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" aria-label="Previous page">‹</button>`;
            
            for (let i = 1; i <= totalPages; i++) {
                if (totalPages <= 7 || i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                    html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === currentPage - 3 || i === currentPage + 3) {
                    html += `<span style="padding: 0.5rem; color: var(--muted-foreground);">…</span>`;
                }
            }
            
            html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" aria-label="Next page">›</button>`;
        }
        
        paginationContainer.innerHTML = html || `<span style="color: var(--muted-foreground); font-size: 0.875rem;">${totalRows} result${totalRows !== 1 ? 's' : ''}</span>`;

        // Add click handlers
        paginationContainer.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                paginationContainer.dataset.currentPage = page;
                updatePagination();
            });
        });
    }



    // Initial pagination setup
    if (paginationContainer) {
        paginationContainer.dataset.currentPage = '1';
        // Force full re-render to ensure pagination is calculated correctly
        setTimeout(() => {
            if (staffSearch) filterStaffTable();
        }, 0);
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
            activeSchools: 23,
            newSchoolsThisMonth: 2,
            totalStudents: 1200,
            activeServiceSchools: 20,
            eventsThisMonth: 15,
            revenueCollected: 150000,
            outstandingPayments: 25000,
            avgEngagementScore: 78,
            recentActivities: [
                {
                    title: 'New school onboarded',
                    description: 'Greenwood Elementary joined our program',
                    time: '2 hours ago'
                },
                {
                    title: 'School service activated',
                    description: 'St. Mary\'s School upgraded to premium package',
                    time: '1 day ago'
                },
                {
                    title: 'New school partnership',
                    description: 'Kenyatta High School registered on the platform',
                    time: '3 days ago'
                }
            ]
        };

        updateStats(fallbackData);
        updateActivities(fallbackData.recentActivities);
    }
}

function updateStats(data) {
    // School-focused metrics
    const totalSchoolsEl = document.getElementById('totalSchools');
    const activeSchoolsEl = document.getElementById('activeSchools');
    const newSchoolsThisMonthEl = document.getElementById('newSchoolsThisMonth');
    const totalStudentsEl = document.getElementById('totalStudents');
    const activeServiceSchoolsEl = document.getElementById('activeServiceSchools');
    const eventsThisMonthEl = document.getElementById('eventsThisMonth');
    const revenueCollectedEl = document.getElementById('revenueCollected');
    const outstandingPaymentsEl = document.getElementById('outstandingPayments');

    if (totalSchoolsEl) totalSchoolsEl.textContent = data.totalSchools || 0;
    if (activeSchoolsEl) activeSchoolsEl.textContent = data.activeSchools || 0;
    if (newSchoolsThisMonthEl) newSchoolsThisMonthEl.textContent = data.newSchoolsThisMonth || 0;
    if (totalStudentsEl) totalStudentsEl.textContent = data.totalStudents || 0;
    if (activeServiceSchoolsEl) activeServiceSchoolsEl.textContent = data.activeServiceSchools || 0;
    if (eventsThisMonthEl) eventsThisMonthEl.textContent = data.eventsThisMonth || 0;
    if (revenueCollectedEl) revenueCollectedEl.textContent = `KES ${(data.revenueCollected || 0).toLocaleString()}`;
    if (outstandingPaymentsEl) outstandingPaymentsEl.textContent = `KES ${(data.outstandingPayments || 0).toLocaleString()}`;
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
            const isAdmin = ['admin', 'founder', 'supervisor', 'coordinator'].includes(window.currentUser?.role);
            const isOwnProfile = window.currentUser?.id === staff._id || window.currentUser?.id === staff.id;
            
            leaveContainer.innerHTML = staff.leaveHistory.map((leave) => {
                const statusClass = leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : leave.status === 'postponed' ? 'warning' : 'warning';
                const statusText = leave.status.charAt(0).toUpperCase() + leave.status.slice(1);
                
                let actionButtons = '';
                if (isAdmin && leave.status === 'pending' && !isOwnProfile) {
                    actionButtons = `
                        <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-sm btn-success" onclick="processLeaveRequest('${staff._id}', '${leave._id}', 'approved')">Approve</button>
                            <button class="btn btn-sm btn-warning" onclick="processLeaveRequest('${staff._id}', '${leave._id}', 'postponed')">Postpone</button>
                            <button class="btn btn-sm btn-danger" onclick="processLeaveRequest('${staff._id}', '${leave._id}', 'rejected')">Decline</button>
                        </div>
                    `;
                }
                
                return `
                    <div class="leave-item" style="padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.5rem; background: var(--muted);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <strong>${leave.type ? leave.type.charAt(0).toUpperCase() + leave.type.slice(1) : 'Leave'}</strong> —
                                ${leave.startDate ? new Date(leave.startDate).toLocaleDateString() : 'N/A'} to ${leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'N/A'}
                            </div>
                            <span class="badge badge-${statusClass}">${statusText}</span>
                        </div>
                        ${leave.notes ? `<p style="margin: 0.5rem 0; color: var(--muted-foreground); font-size: 0.875rem;">Notes: ${leave.notes}</p>` : ''}
                        ${leave.approvedBy ? `<p style="margin: 0; color: var(--muted-foreground); font-size: 0.75rem;">Reviewed by: ${leave.approvedBy} on ${leave.approvedDate ? new Date(leave.approvedDate).toLocaleDateString() : 'N/A'}</p>` : ''}
                        ${actionButtons}
                    </div>
                `;
            }).join('');
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

 // Process leave request (approve/reject/postpone)
 async function processLeaveRequest(staffId, leaveId, action) {
     if (!confirm(`Are you sure you want to ${action} this leave request?`)) return;
     
     const notes = prompt(`Optional: Add a note for the staff member (leave blank for none):`);
     
     try {
         const response = await fetch(`/api/staff/leave/${staffId}/action`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ leaveId, action, notes })
         });
         const result = await response.json();
         
         if (response.ok && result.success) {
             showToast(`Leave request ${action} successfully`, 'success');
             // Reload the staff profile to reflect changes
             viewStaffProfile(staffId);
         } else {
             showToast('Error: ' + (result.error || 'Action failed'), 'error');
         }
     } catch (err) {
         console.error('Error processing leave:', err);
         showToast('Network error', 'error');
     }
 }

 // Staff editing functions
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

// ============ EVENTS MANAGEMENT ============

// Event management state
let currentEvents = [];
let currentEventView = 'table'; // 'table' or 'calendar'
let calendarCurrentDate = new Date();
let calendarViewType = 'month';

// Initialize events page when loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('eventsTableBody') || document.getElementById('calendarContainer')) {
        applyURLToControls();  // Restore filters from URL
        loadEvents();
        populateTrainerDropdown();
        populateSchoolDropdown();
        initEventFilters();
        initTableViewToggle();
        initCalendarView();
        initEventFormHandler();
        initEventModalFeatures(); // Enhanced modal features
    }
});

// Load events from API
async function loadEvents() {
    try {
        const params = new URLSearchParams();
        const typeFilter = document.getElementById('typeFilter')?.value;
        const statusFilter = document.getElementById('statusFilter')?.value;
        const startDate = document.getElementById('startDateFilter')?.value;
        const endDate = document.getElementById('endDateFilter')?.value;
        const search = document.getElementById('eventSearch')?.value;

        if (typeFilter) params.set('eventType', typeFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (search) params.set('search', search);

        const response = await fetch(`/api/events?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            const searchTerm = document.getElementById('eventSearch')?.value?.toLowerCase().trim();
            let filteredEvents = data.events;

            // Apply client-side text search filter (API ignores 'search' param on purpose)
            if (searchTerm) {
                filteredEvents = filteredEvents.filter(event =>
                    (event.name && event.name.toLowerCase().includes(searchTerm)) ||
                    (event.location && (event.location.name || event.location).toLowerCase().includes(searchTerm)) ||
                    (event.status && event.status.toLowerCase().includes(searchTerm)) ||
                    (event.eventType && event.eventType.toLowerCase().includes(searchTerm))
                );
            }

            currentEvents = filteredEvents;
            updateEventStats(filteredEvents);
            if (currentEventView === 'table') {
                renderEventsTable(filteredEvents);
            } else {
                renderCalendar(filteredEvents);
            }
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showToast('Failed to load events', 'error');
    }
    // Sync URL after loading
    syncURLFromControls();
}

// Sync URL from current filter controls and view state
function syncURLFromControls() {
  const params = new URLSearchParams();
  const typeFilter = document.getElementById('typeFilter')?.value;
  const statusFilter = document.getElementById('statusFilter')?.value;
  const startDate = document.getElementById('startDateFilter')?.value;
  const endDate = document.getElementById('endDateFilter')?.value;
  const search = document.getElementById('eventSearch')?.value;
  if (typeFilter) params.set('eventType', typeFilter);
  if (statusFilter) params.set('status', statusFilter);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (search) params.set('search', search);
  params.set('view', currentEventView);
  const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState(null, '', newURL);
}

// Apply URL query parameters to filter controls and view
function applyURLToControls() {
  const params = new URLSearchParams(window.location.search);
  const getEl = (id) => document.getElementById(id);
  if (params.get('eventType')) getEl('typeFilter').value = params.get('eventType');
  if (params.get('status')) getEl('statusFilter').value = params.get('status');
  if (params.get('startDate')) getEl('startDateFilter').value = params.get('startDate');
  if (params.get('endDate')) getEl('endDateFilter').value = params.get('endDate');
  if (params.get('search')) getEl('eventSearch').value = params.get('search');
  const view = params.get('view');
  if (view === 'table' || view === 'calendar') {
    currentEventView = view;
    const tableBtn = document.getElementById('tableViewBtn');
    const calendarBtn = document.getElementById('calendarViewBtn');
    if (view === 'table') {
      tableBtn?.classList.add('btn-primary'); tableBtn?.classList.remove('btn-secondary');
      calendarBtn?.classList.add('btn-secondary'); calendarBtn?.classList.remove('btn-primary');
    } else {
      calendarBtn?.classList.add('btn-primary'); calendarBtn?.classList.remove('btn-secondary');
      tableBtn?.classList.add('btn-secondary'); tableBtn?.classList.remove('btn-primary');
    }
  }
}

// Update top stats
function updateEventStats(events) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisWeekStart = new Date(now);
    thisWeekStart.setHours(0,0,0,0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

    const upcoming = events.filter(e => new Date(e.startDate) >= now).length;
    const pending = events.reduce((acc, e) => {
        return acc + (e.targetSchools?.filter(s => s.rsvpStatus === 'invited' || s.rsvpStatus === 'pending' || s.rsvpStatus === 'no_response').length || 0);
    }, 0);
    const confirmed = events.reduce((acc, e) => {
        return acc + (e.targetSchools?.filter(s => s.rsvpStatus === 'confirmed').length || 0);
    }, 0);
    // Total students confirmed across all events (sum of numberOfParticipants/attendance.registered from confirmed RSVPs)
    const studentsConfirmed = events.reduce((acc, e) => {
        return acc + (e.targetSchools?.reduce((sum, s) => {
            return sum + (s.rsvpStatus === 'confirmed' ? (Number(s.numberOfParticipants || Number(s.attendance?.registered || 0))) : 0);
        }, 0) || 0);
    }, 0);
    const thisWeek = events.filter(e => {
        const d = new Date(e.startDate);
        return d >= thisWeekStart && d < thisWeekEnd;
    }).length;

    const upcomingEl = document.getElementById('upcomingEventsCount');
    const pendingEl = document.getElementById('pendingInvitationsCount');
    const confirmedEl = document.getElementById('confirmedSchoolsCount');
    const studentsEl = document.getElementById('confirmedStudentsCount');
    const thisWeekEl = document.getElementById('eventsThisWeekCount');

    if (upcomingEl) upcomingEl.textContent = upcoming;
    if (pendingEl) pendingEl.textContent = pending;
    if (confirmedEl) confirmedEl.textContent = confirmed;
    if (studentsEl) studentsEl.textContent = studentsConfirmed;
    if (thisWeekEl) thisWeekEl.textContent = thisWeek;
}

// Render events table
function renderEventsTable(events) {
    const tbody = document.getElementById('eventsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!events || events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="placeholder-text">No events match your criteria.</td></tr>';
        return;
    }


    events.forEach(event => {
        const row = document.createElement('tr');

        // Trainer count
        const trainerCount = event.trainers?.length || 0;
        // RSVP summary
        const confirmedCount = event.targetSchools?.filter(s => s.rsvpStatus === 'confirmed').length || 0;
        const invitedCount = event.targetSchools?.length || 0;
        // Confirmed participants (total students from confirmed schools)
        const totalParticipants = event.targetSchools?.reduce((sum, s) => {
            return sum + (s.rsvpStatus === 'confirmed' ? (Number(s.numberOfParticipants || Number(s.attendance?.registered || 0))) : 0);
        }, 0) || 0;

        // Format dates
        const start = event.startDate ? new Date(event.startDate) : null;
        const end = event.endDate ? new Date(event.endDate) : null;
        const dateStr = start && end
            ? `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
            : start ? start.toLocaleDateString() : 'TBD';

        // Badge color based on status
        const statusClass = getStatusBadgeClass(event.status);

        row.innerHTML = `
            <td><strong>${escapeHtml(event.name)}</strong></td>
            <td>${formatEventType(event.eventType)}</td>
            <td>${dateStr}</td>
            <td>${escapeHtml(event.location?.name || event.location || 'TBD')}</td>
            <td><span class="badge ${statusClass}">${event.status.replace('_', ' ')}</span></td>
            <td>${trainerCount} assigned</td>
            <td>${confirmedCount}/${invitedCount} confirmed</td>
            <td>${totalParticipants} student${totalParticipants !== 1 ? 's' : ''}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="openManageEventModal('${event._id}')">Manage</button>
                <button class="btn btn-sm btn-outline" onclick="openEditEventModal('${event._id}')">Edit</button>
                <button class="btn btn-sm btn-outline" onclick="deleteEvent('${event._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Get badge class for status
function getStatusBadgeClass(status) {
    switch (status) {
        case 'draft': return 'badge-warning';
        case 'scheduled': return 'badge-primary';
        case 'confirmed': return 'badge-success';
        case 'in_progress': return 'badge-primary';
        case 'completed': return 'badge-secondary';
        case 'reviewed': return 'badge-success';
        case 'cancelled': return 'badge-danger';
        case 'archived': return 'badge-muted';
        case 'published': return 'badge-info'; // legacy
        default: return 'badge-info';
    }
}

// Format event type display
function formatEventType(type) {
    const types = {
        'camp': '🏕️ Camp',
        'hike': '🥾 Hike',
        'team_building': '🤝 Team Building',
        'training_session': '📚 Training',
        'inter_school_competition': '🏆 Competition',
        'other': '📌 Other'
    };
    return types[type] || type;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize filter event listeners
function initEventFilters() {
    const filterInputs = ['eventSearch', 'typeFilter', 'statusFilter', 'startDateFilter', 'endDateFilter'];
    filterInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Use change for selects, keydown+Enter for search, change for dates
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.addEventListener('keydown', e => e.key === 'Enter' && loadEvents());
            } else {
                el.addEventListener('change', loadEvents);
            }
        }
    });
}

// Table/Calendar view toggle
function initTableViewToggle() {
    const tableBtn = document.getElementById('tableViewBtn');
    const calendarBtn = document.getElementById('calendarViewBtn');

    if (tableBtn) {
        tableBtn.addEventListener('click', () => {
            currentEventView = 'table';
            document.getElementById('tableView').style.display = 'block';
            document.getElementById('calendarView').style.display = 'none';
            tableBtn.classList.add('btn-primary');
            tableBtn.classList.remove('btn-secondary');
            calendarBtn.classList.add('btn-secondary');
            calendarBtn.classList.remove('btn-primary');
            renderEventsTable(currentEvents);
        });
    }



     if (calendarBtn) {
         calendarBtn.addEventListener('click', () => {
             currentEventView = 'calendar';
             document.getElementById('tableView').style.display = 'none';
             document.getElementById('calendarView').style.display = 'block';
             calendarBtn.classList.add('btn-primary');
             calendarBtn.classList.remove('btn-secondary');
             tableBtn.classList.add('btn-secondary');
             tableBtn.classList.remove('btn-primary');
             renderCalendar(currentEvents);
             syncURLFromControls();
         });
     }
}

// ============ MODAL FUNCTIONS ============

// Clear datetime input
function clearDateTime(fieldId) {
    document.getElementById(fieldId).value = '';
}

// Character counter functionality
function initCharacterCounters() {
    const textareas = [
        { id: 'eventDescription', countId: 'eventDescriptionCount', max: 500 },
        { id: 'eventAgenda', countId: 'eventAgendaCount', max: 1000 }
    ];

    textareas.forEach(({ id, countId, max }) => {
        const textarea = document.getElementById(id);
        const counter = document.getElementById(countId);

        if (textarea && counter) {
            // Initialize count
            counter.textContent = `${textarea.value.length}/${max}`;

            // Update on input
            textarea.addEventListener('input', function() {
                const len = this.value.length;
                counter.textContent = `${len}/${max}`;

                // Visual warning when approaching limit
                if (len >= max) {
                    counter.style.color = 'var(--destructive)';
                    counter.style.fontWeight = 'bold';
                } else if (len >= max * 0.9) {
                    counter.style.color = 'var(--accent)';
                } else {
                    counter.style.color = 'var(--muted-foreground)';
                    counter.style.fontWeight = 'normal';
                }
            });
        }
    });
}

// Real-time form validation feedback
function initFormValidation() {
    const requiredFields = document.querySelectorAll('#eventForm [required]');

    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            validateField(this);
        });

        field.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
}

function validateField(field) {
    const label = field.closest('label');
    const errorEl = label ? label.querySelector('.field-error') : null;

    // Remove existing error
    if (errorEl) {
        errorEl.remove();
    }
    field.classList.remove('error');

    // Check required
    if (field.hasAttribute('required') && !String(field.value || '').trim()) {
        showFieldError(field, 'This field is required');
        return false;
    }

    // Custom validation for specific fields
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            showFieldError(field, 'Please enter a valid email address');
            return false;
        }
    }

    // Number validation
    if (field.type === 'number' && field.value) {
        const min = field.min ? parseInt(field.min) : null;
        const max = field.max ? parseInt(field.max) : null;
        const val = parseInt(field.value);

        if (min !== null && val < min) {
            showFieldError(field, `Value must be at least ${min}`);
            return false;
        }
        if (max !== null && val > max) {
            showFieldError(field, `Value must be at most ${max}`);
            return false;
        }
    }

    // Valid
    field.classList.add('valid');
    return true;
}

function showFieldError(field, message) {
    const label = field.closest('label');
    if (!label) return;
    const errorEl = document.createElement('small');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    label.appendChild(errorEl);
    field.classList.add('error');
}

// Collect missing required inputs and return user-friendly labels.
// Used on BOTH create + edit submission for the events modal.
function getMissingRequiredEventFields() {
    const form = document.getElementById('eventForm');
    if (!form) return [];

    const requiredFields = form.querySelectorAll('[required]');
    const missing = [];

    requiredFields.forEach(field => {
        const val = String(field.value || '').trim();
        const isMissing = !val;

        if (!isMissing) return;

        const labelEl = field.closest('label');
        let labelText = '';

        // Most fields are wrapped like: <label><span>Event Name</span><input .../></label>
        // or: <label class="required-field"><span>...</span><input .../></label>
        const span = labelEl ? labelEl.querySelector('span') : null;
        if (span && span.textContent) {
            labelText = span.textContent.trim();
        }

        // Fallbacks for dynamic equipment/prerequisite inputs
        if (!labelText) {
            if (field.getAttribute('placeholder')) labelText = field.getAttribute('placeholder').trim();
            else if (field.name) labelText = field.name;
            else labelText = field.id || 'Required field';
        }

        // Avoid duplicates (e.g., if multiple inputs fail but represent same label)
        missing.push(labelText);
    });

    // Unique while preserving order
    return missing.filter((x, i, arr) => arr.indexOf(x) === i);
}

function showEventFormMissingFieldsError(missingFields) {
    const errorBox = document.getElementById('eventFormError');
    if (!errorBox) return;

    if (!missingFields || missingFields.length === 0) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
        return;
    }

    const list = missingFields.map(f => `• ${f}`).join('<br>');
    errorBox.innerHTML = `Missing required input(s):<br>${list}`;
    errorBox.style.display = 'block';
    errorBox.classList.add('alert-error');
}

function focusFirstMissingEventField() {
    const form = document.getElementById('eventForm');
    if (!form) return;

    const requiredFields = form.querySelectorAll('[required]');
    for (const field of requiredFields) {
        const val = String(field.value || '').trim();
        if (!val) {
            // remove stale errors
            form.querySelectorAll('.field-error').forEach(el => el.remove());
            requiredFields.forEach(f => f.classList.remove('error'));

            // show per-field message for better UX
            validateField(field);

            // Ensure the exact missing field is visible to the user
            try {
                field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            } catch (e) {
                // ignore
            }

            field.focus();
            return;
        }
    }
}

// Remove equipment row with animation
function removeEquipmentRow(btn) {
    const row = btn.closest('.equipment-row');
    if (row) {
        row.style.transform = 'scale(0.95)';
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 150);
    }
}

// Remove prerequisite row with animation
function removePrerequisiteRow(btn) {
    const row = btn.closest('.prerequisite-row');
    if (row) {
        row.style.transform = 'scale(0.95)';
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 150);
    }
}

// Enhanced equipment row
function addEquipmentItem(item = '', quantity = 1, providedBy = 'APV', notes = '') {
    const container = document.getElementById('equipmentList');
    const row = document.createElement('div');
    row.className = 'equipment-row';
    row.innerHTML = `
        <input type="text" placeholder="Item name" value="${escapeHtml(item)}" class="form-control equipment-input" required autocomplete="off">
        <input type="number" placeholder="Qty" value="${quantity}" min="1" class="form-control qty-input">
        <select class="form-control provider-select">
            <option value="APV" ${providedBy === 'APV' ? 'selected' : ''}>APV</option>
            <option value="School" ${providedBy === 'School' ? 'selected' : ''}>School</option>
            <option value="Participant" ${providedBy === 'Participant' ? 'selected' : ''}>Participant</option>
        </select>
        <input type="text" placeholder="Notes" value="${escapeHtml(notes)}" class="form-control" autocomplete="off">
        <button type="button" class="btn btn-sm btn-outline btn-remove" onclick="removeEquipmentRow(this)" aria-label="Remove equipment item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    container.appendChild(row);
}

// Enhanced prerequisite row
function addPrerequisiteItem(description = '', mandatory = true) {
    const container = document.getElementById('prerequisitesList');
    const row = document.createElement('div');
    row.className = 'prerequisite-row';
    row.innerHTML = `
        <input type="text" placeholder="Prerequisite description" value="${escapeHtml(description)}" class="form-control" required autocomplete="off">
        <label class="checkbox-label-inline">
            <input type="checkbox" ${mandatory ? 'checked' : ''}> Mandatory
        </label>
        <button type="button" class="btn btn-sm btn-outline btn-remove" onclick="removePrerequisiteRow(this)" aria-label="Remove prerequisite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    container.appendChild(row);
}

// Initialize event modal features
function initEventModalFeatures() {
    initCharacterCounters();
    initFormValidation();
}

// Open Create Event Modal
function openCreateEventModal() {
    const modal = document.getElementById('eventModal');
    modal.style.display = 'flex';
    document.getElementById('eventModalTitle').textContent = 'Create New Event';
    const form = document.getElementById('eventForm');
    form.reset();
    document.getElementById('eventId').value = '';

    // Clear dynamic lists
    document.getElementById('equipmentList').innerHTML = '';
    document.getElementById('prerequisitesList').innerHTML = '';

    // Add one empty row
    addEquipmentItem();
    addPrerequisiteItem();

    // Reset char counters
    initCharacterCounters();

    // Clear any validation errors
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.valid').forEach(el => el.classList.remove('valid'));

    document.getElementById('eventFormError').style.display = 'none';
}

// Open Edit Event Modal
async function openEditEventModal(eventId) {
    try {
        const response = await fetch(`/api/events/${eventId}`);
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        const event = data.event;

        document.getElementById('eventModal').style.display = 'flex';
        document.getElementById('eventModalTitle').textContent = 'Edit Event';
        document.getElementById('eventId').value = event._id;

        // Clear previous validation errors and states
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.valid').forEach(el => el.classList.remove('valid'));

        // Basic
        document.getElementById('eventName').value = event.name || '';
        document.getElementById('eventType').value = event.eventType || 'other';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventAgenda').value = event.agenda || '';

        // Schedule
        const formatDT = (date) => date ? new Date(date).toISOString().slice(0,16) : '';
        document.getElementById('eventStartDate').value = formatDT(event.startDate);
        document.getElementById('eventEndDate').value = formatDT(event.endDate);
        document.getElementById('eventRegistrationDeadline').value = formatDT(event.registrationDeadline);
        document.getElementById('eventDefaultRsvpDeadline').value = formatDT(event.defaultInvitationDeadline);

        // Location
        document.getElementById('locationName').value = event.location?.name || '';
        document.getElementById('locationAddress').value = event.location?.address || '';
        document.getElementById('locationCity').value = event.location?.city || '';
        document.getElementById('locationRegion').value = event.location?.region || '';
        document.getElementById('locationCountry').value = event.location?.country || 'Kenya';
        if (event.location?.coordinates) {
            document.getElementById('coordinates').value = `${event.location.coordinates.latitude}, ${event.location.coordinates.longitude}`;
        }

        // Capacity
        document.getElementById('maxParticipants').value = event.maxParticipants || '';
        document.getElementById('estimatedScoutCount').value = event.estimatedScoutCount || '';
        document.getElementById('waitlistEnabled').checked = event.waitlistEnabled || false;

        // Equipment
        const equipmentList = document.getElementById('equipmentList');
        equipmentList.innerHTML = '';
        (event.requiredEquipment || []).forEach(eq => {
            addEquipmentItem(eq.item, eq.quantity, eq.providedBy, eq.notes);
        });
        if ((event.requiredEquipment || []).length === 0) addEquipmentItem();

        // Prerequisites
        const prereqList = document.getElementById('prerequisitesList');
        prereqList.innerHTML = '';
        (event.prerequisites || []).forEach(pr => {
            addPrerequisiteItem(pr.description, pr.mandatory);
        });
        if ((event.prerequisites || []).length === 0) addPrerequisiteItem();

        // Budget
        document.getElementById('budgetTotal').value = event.budget?.total || '';
        document.getElementById('costPerParticipant').value = event.costPerParticipant || '';

        // Publishing
        document.getElementById('eventStatus').value = event.status || 'draft';
        document.getElementById('eventVisibility').value = event.visibility || 'private';

        // Initialize character counters after values are set
        initCharacterCounters();

    } catch (error) {
        console.error('Error loading event:', error);
        showToast('Failed to load event details', 'error');
    }
}

// Close event modal
function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
}

// Close manage event modal
function closeManageEventModal() {
    document.getElementById('manageEventModal').style.display = 'none';
}

// ============ EVENT FORM HANDLING ============

// (Enhanced addEquipmentItem, addPrerequisiteItem, and their remove functions
// are defined earlier in the modal features section)

// Collect equipment data from DOM
function collectEquipmentData() {
    const rows = document.querySelectorAll('#equipmentList > div');
    return Array.from(rows).map(row => {
        const inputs = row.querySelectorAll('input, select');
        return {
            item: inputs[0]?.value || '',
            quantity: parseInt(inputs[1]?.value) || 1,
            providedBy: inputs[2]?.value || 'APV',
            notes: inputs[3]?.value || ''
        };
    }).filter(eq => eq.item);
}

// Collect prerequisites data from DOM
function collectPrerequisitesData() {
    const rows = document.querySelectorAll('#prerequisitesList > div');
    return Array.from(rows).map(row => {
        const inputs = row.querySelectorAll('input, select');
        return {
            description: inputs[0]?.value || '',
            mandatory: inputs[1]?.checked || false
        };
    }).filter(pr => pr.description);
}

// Submit event form
function initEventFormHandler() {
    const form = document.getElementById('eventForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const eventId = document.getElementById('eventId').value;
        const isEdit = !!eventId;

        const formData = {
            name: document.getElementById('eventName').value,
            description: document.getElementById('eventDescription').value,
            eventType: document.getElementById('eventType').value,
            agenda: document.getElementById('eventAgenda').value,
            startDate: document.getElementById('eventStartDate').value,
            endDate: document.getElementById('eventEndDate').value,
            registrationDeadline: document.getElementById('eventRegistrationDeadline').value,
            defaultInvitationDeadline: document.getElementById('eventDefaultRsvpDeadline').value,
            locationName: document.getElementById('locationName').value,
            locationAddress: document.getElementById('locationAddress').value,
            locationCity: document.getElementById('locationCity').value,
            locationRegion: document.getElementById('locationRegion').value,
            locationCountry: document.getElementById('locationCountry').value,
            region: document.getElementById('locationRegion').value,
            maxParticipants: document.getElementById('maxParticipants').value,
            estimatedScoutCount: document.getElementById('estimatedScoutCount').value,
            waitlistEnabled: document.getElementById('waitlistEnabled').checked,
            requiredEquipment: JSON.stringify(collectEquipmentData()),
            prerequisites: JSON.stringify(collectPrerequisitesData()),
            budgetTotal: document.getElementById('budgetTotal').value,
            costPerParticipant: document.getElementById('costPerParticipant').value,
            status: document.getElementById('eventStatus').value,
            visibility: document.getElementById('eventVisibility').value
        };

        // Handle coordinates
        const coordsEl = document.getElementById('coordinates');
        const coords = coordsEl ? coordsEl.value : '';
        if (coords && coords.includes(',')) {
            const [lat, lng] = coords.split(',').map(s => parseFloat(s.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
                formData.locationLatitude = lat;
                formData.locationLongitude = lng;
            }
        }

        // Specific client-side validation for missing required fields (Create + Edit)
        const missingFields = getMissingRequiredEventFields();
        if (missingFields.length > 0) {
            showEventFormMissingFieldsError(missingFields);
            focusFirstMissingEventField();
            return;
        }

        // Clear any previous modal error
        const errorBox = document.getElementById('eventFormError');
        if (errorBox) {
            errorBox.style.display = 'none';
            errorBox.textContent = '';
        }

        try {
            const url = isEdit ? `/dashboard/events/update/${eventId}` : '/dashboard/events/create';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                showToast(`Server error: ${response.status} ${response.statusText}`, 'error');
                return;
            }

            if (result.success) {
                showToast(isEdit ? 'Event updated successfully' : 'Event created successfully', 'success');
                closeEventModal();
                loadEvents();
            } else {
                showToast('Error: ' + (result.error || 'Failed to save event'), 'error');
                if (result.error && /missing required/i.test(result.error)) {
                    showEventFormMissingFieldsError(getMissingRequiredEventFields());
                    focusFirstMissingEventField();
                }
            }
        } catch (error) {
            console.error('Error saving event:', error);
            showToast('Network error while saving event', 'error');
        }
    });
}

// Delete event
async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/dashboard/events/delete/${eventId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Event deleted successfully', 'success');
            loadEvents();
        } else {
            showToast('Error: ' + (result.error || 'Failed to delete event'), 'error');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('Network error while deleting event', 'error');
    }
}

// ============ TRAINER ASSIGNMENT ============

// Populate trainer dropdown
async function populateTrainerDropdown() {
    try {
        const response = await fetch('/api/trainers/list');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('trainerSelect');
            select.innerHTML = '<option value="">Select a trainer...</option>';
            data.trainers.forEach(trainer => {
                const option = document.createElement('option');
                option.value = trainer._id;
                option.textContent = `${trainer.name} (${trainer.role})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching trainers:', error);
    }
}

// Assign trainer to event
async function assignTrainer() {
    const eventId = document.getElementById('manageEventId').value;
    const trainerId = document.getElementById('trainerSelect').value;
    const role = document.getElementById('trainerRoleSelect').value;

    if (!trainerId) {
        showToast('Please select a trainer', 'warning');
        return;
    }

    // Check for conflicts
    const conflictResponse = await fetch(`/api/trainers/${trainerId}/availability?startDate=${encodeURIComponent(document.getElementById('eventStartDate').value)}&endDate=${encodeURIComponent(document.getElementById('eventEndDate').value)}&excludeEventId=${eventId}`);
    const conflictData = await conflictResponse.json();

    if (!conflictData.available) {
        const conflictEl = document.getElementById('trainerConflictError');
        conflictEl.style.display = 'block';
        conflictEl.className = 'message error';
        conflictEl.innerHTML = `<strong>Conflict detected:</strong><br>${conflictData.conflicts.map(c => `${c.name}: ${c.dates}`).join('<br>')}`;
        return;
    } else {
        document.getElementById('trainerConflictError').style.display = 'none';
    }

    try {
        const response = await fetch(`/api/events/${eventId}/assign-trainer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainerId, role })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Trainer assigned successfully', 'success');
            openManageEventModal(eventId); // Refresh modal
            loadEvents();
        } else {
            showToast('Error: ' + (result.error || 'Assignment failed'), 'error');
        }
    } catch (error) {
        console.error('Error assigning trainer:', error);
        showToast('Network error', 'error');
    }
}

// Populate school dropdown / search picker
let _allSchools = [];
let _schoolPickerReady = false;

async function populateSchoolDropdown() {
    try {
        const response = await fetch('/api/schools/list');
        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.error || 'Failed to load schools', 'error');
            _closeSchoolPopup();
            return;
        }

        _allSchools = data.schools || [];
        _schoolPickerReady = true;
        _renderSchoolSearchResults(_allSchools);

        // Show the full list in the popup so user sees schools immediately
        const popup = document.getElementById('schoolSearchPopup');
        const input = document.getElementById('schoolSearchInput');
        if (popup && input) {
            popup.style.display = 'block';
            popup.setAttribute('aria-hidden', 'false');
            input.setAttribute('aria-expanded', 'true');
        }
    } catch (error) {
        console.error('Error fetching schools:', error);
        showToast('Failed to load schools list', 'error');
        _closeSchoolPopup();
    }
}

function _renderSchoolSearchResults(schools) {
    const list = document.getElementById('schoolSearchList');
    if (!list) return;

    if (!schools.length) {
        list.innerHTML = '<div style="padding:0.5rem 0.75rem;color:var(--muted-foreground);font-size:0.85rem;">No schools found</div>';
        return;
    }

    list.innerHTML = schools.map((school, i) => {
        const name = escapeHtml(school.name || 'Unnamed School');
        const city = school.address?.city ? `<span style="color:var(--muted-foreground);font-size:0.8rem;"> · ${escapeHtml(school.address.city)}</span>` : '';
        const contact = school.contactPerson?.email
            ? `<br><small style="color:var(--muted-foreground);font-size:0.75rem;">${escapeHtml(school.contactPerson.email)}</small>`
            : '';
        return `<div role="option" data-index="${i}" data-id="${school._id}" data-name="${name}"
                      style="padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:2px;"
                      onmouseenter="this.style.background='var(--muted)'" onmouseleave="this.style.background=''"
                      onclick="_onSchoolPick(this)">
                    <span>${name}${city}</span>${contact}
                </div>`;
    }).join('');
}

function _filterSchools(query) {
    const q = query.toLowerCase().trim();
    if (!q) return _allSchools;
    return _allSchools.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.address?.city || '').toLowerCase().includes(q)
    );
}

function _onSchoolPick(el) {
    if (!el) return;
    const input = document.getElementById('schoolSearchInput');
    const select = document.getElementById('schoolSelect');
    const btn = document.getElementById('inviteSchoolBtn');
    if (input) {
        input.value = el.dataset.name || '';
        input.setAttribute('aria-expanded', 'false');
    }
    if (select) select.value = el.dataset.id || '';
    if (btn) btn.disabled = !el.dataset.id;
    _closeSchoolPopup();
}

function _closeSchoolPopup() {
    const popup = document.getElementById('schoolSearchPopup');
    const input = document.getElementById('schoolSearchInput');
    if (popup) {
        popup.style.display = 'none';
        popup.setAttribute('aria-hidden', 'true');
    }
    if (input) input.setAttribute('aria-expanded', 'false');
}

function _onSchoolSearchInput() {
    const input = document.getElementById('schoolSearchInput');
    const popup = document.getElementById('schoolSearchPopup');
    if (!input || !popup) return;

    const matches = _filterSchools(input.value);
    _renderSchoolSearchResults(matches);
    if (matches.length > 0) {
        popup.style.display = 'block';
        popup.setAttribute('aria-hidden', 'false');
        input.setAttribute('aria-expanded', 'true');
    } else {
        popup.style.display = 'none';
        input.setAttribute('aria-expanded', 'false');
    }
}

function _onSchoolSearchKeydown(e) {
    const popup = document.getElementById('schoolSearchPopup');
    if (e.key === 'Escape') { _closeSchoolPopup(); e.stopPropagation(); }
    if (e.key === 'Enter' && popup && popup.style.display !== 'none') {
        const first = popup.querySelector('[role="option"]');
        if (first) { first.click(); e.preventDefault(); }
    }
    if (e.key === 'ArrowDown') {
        if (popup && popup.style.display === 'block') {
            const first = popup.querySelector('[role="option"]');
            if (first) { first.focus(); e.preventDefault(); }
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Wire up school search picker
    const si = document.getElementById('schoolSearchInput');
    const toggleBtn = document.getElementById('schoolPickerToggle');
    if (si) {
        si.addEventListener('input', _onSchoolSearchInput);
        si.addEventListener('keydown', _onSchoolSearchKeydown);
        si.parentElement.addEventListener('click', function (e) {
            if (e.target === si || e.target.id === 'schoolPickerWrapper') si.focus();
        });
        // Also open/close on arrow button click
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                si.focus();
                if (!_schoolPickerReady || _allSchools.length === 0) return;
                const popup = document.getElementById('schoolSearchPopup');
                const willShow = popup.style.display === 'none' || popup.getAttribute('aria-hidden') === 'true';
                if (willShow) {
                    _renderSchoolSearchResults(_allSchools);
                    popup.style.display = 'block';
                    popup.setAttribute('aria-hidden', 'false');
                    si.setAttribute('aria-expanded', 'true');
                } else {
                    _closeSchoolPopup();
                }
            });
        }
        document.addEventListener('click', function (e) {
            if (!si.closest('#schoolPickerWrapper')) _closeSchoolPopup();
        });
    }
});

// Invite school to event
async function inviteSchool() {
    const eventId = document.getElementById('manageEventId').value;
    const schoolId = document.getElementById('schoolSelect').value;
    const rsvpDeadline = document.getElementById('inviteRsvpDeadline').value;

    if (!schoolId) {
        showToast('Please select a school', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/events/${eventId}/invite-school`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolId, rsvpDeadline })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Invitation sent successfully', 'success');
            openManageEventModal(eventId);
            loadEvents();
        } else {
            showToast('Error: ' + (result.error || 'Invitation failed'), 'error');
        }
    } catch (error) {
        console.error('Error inviting school:', error);
        showToast('Network error', 'error');
    }
}

// Open Manage Event Modal
async function openManageEventModal(eventId) {
    try {
        const response = await fetch(`/api/events/${eventId}`);
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        const event = data.event;
        document.getElementById('manageEventModal').style.display = 'flex';
        document.getElementById('manageEventTitle').textContent = `Manage: ${event.name}`;

        // Store eventId in hidden field
        document.getElementById('manageEventId').value = eventId;
        // Also store dates in the hidden fields used by conflict checking (located in create/edit modal)
        const formatDT = (date) => date ? new Date(date).toISOString().slice(0,16) : '';
        document.getElementById('eventStartDate').value = formatDT(event.startDate);
        document.getElementById('eventEndDate').value = formatDT(event.endDate);

        // Render assigned trainers
        const trainersList = document.getElementById('assignedTrainersList');
        trainersList.innerHTML = '';
        if (event.trainers && event.trainers.length > 0) {
            event.trainers.forEach(assignment => {
                const trainer = assignment.trainerId;
                const badgeClass = assignment.status === 'confirmed' ? 'badge-success' : assignment.status === 'declined' ? 'badge-danger' : 'badge-info';
                const item = document.createElement('div');
                item.style.cssText = 'padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;';
                item.innerHTML = `
                    <div>
                        <strong>${trainer?.name || 'Unknown'}</strong> (${trainer?.role || 'N/A'}) — <span class="badge ${badgeClass}">${assignment.status.replace('_', ' ')}</span>
                        <br><small>Role: ${assignment.role.replace('_', ' ')}</small>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="removeTrainer('${eventId}', '${trainer._id}')">Remove</button>
                `;
                trainersList.appendChild(item);
            });
        } else {
            trainersList.innerHTML = '<p class="placeholder-text">No trainers assigned yet.</p>';
        }

        // Render invited schools with RSVP status and confirmed attendance
        const schoolsList = document.getElementById('invitedSchoolsList');
        schoolsList.innerHTML = '';
        if (event.targetSchools && event.targetSchools.length > 0) {
            event.targetSchools.forEach(inv => {
                const school = inv.schoolId;
                let badgeClass = 'badge-info';
                let badgeLabel = 'Invited';
                if (inv.rsvpStatus === 'confirmed') {
                    badgeClass = 'badge-success';
                    badgeLabel = 'Confirmed';
                } else if (inv.rsvpStatus === 'declined') {
                    badgeClass = 'badge-danger';
                    badgeLabel = 'Declined';
                } else if (inv.rsvpStatus === 'pending') {
                    badgeClass = 'badge-warning';
                    badgeLabel = 'Pending';
                } else if (inv.rsvpStatus === 'no_response') {
                    badgeClass = 'badge-secondary';
                    badgeLabel = 'No Response';
                }

                // Confirmed student attendance count
                const attendingCount = inv.rsvpStatus === 'confirmed'
                    ? (inv.numberOfParticipants || inv.attendance?.recorded || inv.attendance?.registered || 0)
                    : (inv.rsvpStatus === 'pending' || inv.rsvpStatus === 'invited')
                        ? (inv.numberOfParticipants || 0)
                        : 0;

                const deadlineStr = inv.rsvpDeadline ? new Date(inv.rsvpDeadline).toLocaleDateString() : 'Not set';
                const respondedDate = inv.rsvpResponseDate ? new Date(inv.rsvpResponseDate).toLocaleDateString() : null;

                const item = document.createElement('div');
                item.style.cssText = 'padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.5rem;';
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                                <strong>${school?.name || 'Unknown School'}</strong>
                                <span class="badge ${badgeClass}">${badgeLabel}</span>
                            </div>
                            <small style="color: var(--muted-foreground);">
                                ${school?.address?.city || 'City unknown'} |
                                RSVP Deadline: ${deadlineStr}
                                ${respondedDate ? `| Responded: ${respondedDate}` : ''}
                            </small>
                            ${inv.numberOfParticipants !== undefined && inv.numberOfParticipants !== null
                                ? `<br><small><strong>Students confirmed:</strong> ${attendingCount}</small>`
                                : `<br><small class="muted-text">No attendance count submitted yet</small>`
                            }
                            ${inv.attendance?.notes ? `<br><small style="color: var(--muted-foreground);"><em>Notes:</em> ${escapeHtml(String(inv.attendance.notes))}</small>` : ''}
                        </div>
                        ${event.costPerParticipant && attendingCount > 0
                            ? `<small style="color: var(--muted-foreground); text-align: right; white-space: nowrap;"><strong>Billable:</strong><br>KES ${(attendingCount * event.costPerParticipant).toLocaleString()}</small>`
                            : ''
                        }
                    </div>
                `;
                schoolsList.appendChild(item);
            });
        } else {
            schoolsList.innerHTML = '<p class="placeholder-text">No schools invited yet. Use the section below to invite schools.</p>';
        }

        // ===== POST-EVENT REVIEW HANDLING =====
        // Handle review section in manage modal
        (function populateReviewSection() {
            const reviewSection = document.getElementById('reviewSection');
            const reviewContent = document.getElementById('reviewContent');
            const trainerReportForm = document.getElementById('trainerReportForm');
            const adminReviewActions = document.getElementById('adminReviewActions');

            // Hide all first
            reviewSection.style.display = 'none';
            reviewContent.innerHTML = '';
            trainerReportForm.style.display = 'none';
            adminReviewActions.style.display = 'none';

            const eventStatus = event.status;
            if (!['completed', 'reviewed'].includes(eventStatus)) {
                return; // Hide if not yet completed
            }

            reviewSection.style.display = 'block';
            const isAssignedTrainer = event.trainers && event.trainers.some(t => t.trainerId && t.trainerId._id.toString() === window.currentUser.id);
            const canApprove = ['admin', 'supervisor', 'coordinator'].includes(window.currentUser.role);
            const review = event.review || {};

            if (!review.trainerReport) {
                // No report submitted yet
                if (isAssignedTrainer) {
                    trainerReportForm.style.display = 'block';
                    reviewContent.innerHTML = '<p>Please submit your post-event report below.</p>';
                } else {
                    reviewContent.innerHTML = '<p>No report submitted yet.</p>';
                }
            } else {
                // Report exists
                trainerReportForm.style.display = 'none';
                let html = '<div style="background: var(--muted); padding: 1rem; border-radius: var(--radius);">';
                html += `<p><strong>Trainer Report:</strong><br>${review.trainerReport.replace(/\n/g, '<br>')}</p>`;
                if (review.actualAttendeeCount !== undefined) {
                    html += `<p><strong>Actual Attendee Count:</strong> ${review.actualAttendeeCount}</p>`;
                }
                if (review.reportSubmittedAt) {
                    html += `<p><small>Submitted: ${new Date(review.reportSubmittedAt).toLocaleString()}</small></p>`;
                }
                html += '</div>';

                const status = review.reviewStatus || 'pending';
                if (status === 'pending') {
                    if (canApprove) {
                        adminReviewActions.style.display = 'block';
                        document.getElementById('adminReviewStatus').textContent = 'Report is pending review.';
                    }
                } else if (status === 'approved') {
                    html += `<p><strong>Review Status:</strong> <span class="badge badge-success">Approved</span></p>`;
                    if (review.reviewNotes) {
                        html += `<p><strong>Reviewer Notes:</strong> ${review.reviewNotes}</p>`;
                    }
                    if (review.closedAt) {
                        html += `<p><small>Closed: ${new Date(review.closedAt).toLocaleString()}</small></p>`;
                    }
                } else if (status === 'needs_revision') {
                    if (isAssignedTrainer) {
                        trainerReportForm.style.display = 'block';
                        html += `<p><strong>Review Status:</strong> <span class="badge badge-warning">Needs Revision</span></p>`;
                        if (review.reviewNotes) {
                            html += `<p><strong>Reviewer Notes:</strong> ${review.reviewNotes}</p>`;
                        }
                    } else {
                        html += `<p><strong>Review Status:</strong> <span class="badge badge-warning">Needs Revision</span></p>`;
                        if (review.reviewNotes) {
                            html += `<p><strong>Reviewer Notes:</strong> ${review.reviewNotes}</p>`;
                        }
                    }
                }

                reviewContent.innerHTML = html;
            }
        })();

    } catch (error) {
        console.error('Error loading event for management:', error);
        showToast('Failed to load event details', 'error');
    }
}

// Remove trainer from event
async function removeTrainer(eventId, trainerId) {
    try {
        const response = await fetch(`/api/events/${eventId}/remove-trainer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainerId })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Trainer removed', 'success');
            openManageEventModal(eventId);
            loadEvents();
        } else {
            showToast('Error: ' + (result.error || 'Failed to remove'), 'error');
        }
    } catch (err) {
        console.error('Error removing trainer:', err);
        showToast('Network error', 'error');
    }
}

// Send reminders
async function sendReminders(type) {
    const eventId = document.getElementById('manageEventId').value;
    // In a real implementation, you'd call an endpoint that queues emails.
    showToast(`Reminder scheduled for ${type}`, 'success');
}

// ===== POST-EVENT REVIEW HANDLERS =====

// Submit trainer report
async function submitTrainerReport() {
  const eventId = document.getElementById('manageEventId').value;
  const report = document.getElementById('trainerReport').value.trim();
  const actualAttendeeCount = document.getElementById('actualAttendeeCount').value;

  if (!report) {
    showToast('Please enter a report', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/events/${eventId}/submit-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainerReport: report, actualAttendeeCount })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Report submitted successfully', 'success');
      openManageEventModal(eventId); // refresh modal
      loadEvents();
    } else {
      showToast('Error: ' + (data.error || 'Failed to submit report'), 'error');
    }
  } catch (err) {
    console.error('Error submitting report:', err);
    showToast('Network error', 'error');
  }
}

// Admin approve event review
async function approveEventReview() {
  const eventId = document.getElementById('manageEventId').value;
  const notes = prompt('Enter review notes (optional):') || '';
  try {
    const res = await fetch(`/api/events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', reviewNotes: notes })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Event approved successfully', 'success');
      openManageEventModal(eventId);
      loadEvents();
    } else {
      showToast('Error: ' + (data.error || 'Failed to approve'), 'error');
    }
  } catch (err) {
    console.error('Error approving event:', err);
    showToast('Network error', 'error');
  }
}

// Admin request revision
async function requestRevision() {
  const eventId = document.getElementById('manageEventId').value;
  const notes = prompt('Enter revision notes (required):');
  if (!notes) {
    showToast('Revision notes are required', 'error');
    return;
  }
  try {
    const res = await fetch(`/api/events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request_revision', reviewNotes: notes })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Revision requested', 'success');
      openManageEventModal(eventId);
      loadEvents();
    } else {
      showToast('Error: ' + (data.error || 'Failed to request revision'), 'error');
    }
  } catch (err) {
    console.error('Error requesting revision:', err);
    showToast('Network error', 'error');
  }
}

// ============ CALENDAR VIEW ============

function initCalendarView() {
    document.getElementById('calendarViewType')?.addEventListener('change', (e) => {
        calendarViewType = e.target.value;
        renderCalendar(currentEvents);
    });

    document.getElementById('prevPeriodBtn')?.addEventListener('click', () => {
        changeCalendarPeriod(-1);
    });

    document.getElementById('nextPeriodBtn')?.addEventListener('click', () => {
        changeCalendarPeriod(1);
    });
}

function changeCalendarPeriod(delta) {
    if (calendarViewType === 'month') {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + delta);
    } else if (calendarViewType === 'week') {
        calendarCurrentDate.setDate(calendarCurrentDate.getDate() + (delta * 7));
    } else {
        // list view - change by month anyway
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + delta);
    }
    renderCalendar(currentEvents);
}

function renderCalendar(events) {
    const container = document.getElementById('calendarContainer');
    if (!container) return;

    if (calendarViewType === 'list') {
        renderCalendarList(events);
    } else if (calendarViewType === 'week') {
        renderCalendarWeek(events);
    } else {
        renderCalendarMonth(events);
    }
}

function renderCalendarMonth(events) {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const title = calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('calendarTitle').textContent = title;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // Sunday = 0
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
            const colorClass = getEventColorClass(ev.eventType);
            html += `
                <div class="event-marker ${colorClass}" style="font-size: 0.75rem; padding: 0.25rem; margin-top: 0.25rem; border-radius: 4px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(ev.name)}">
                    ${escapeHtml(ev.name)}
                </div>
            `;
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
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
            const colorClass = getEventColorClass(ev.eventType);
            html += `
                <div class="event-marker ${colorClass}" style="font-size: 0.75rem; padding: 0.25rem; margin-top: 0.25rem; border-radius: 4px; cursor: pointer;" title="${escapeHtml(ev.name)}">
                    ${escapeHtml(ev.name)}
                </div>
            `;
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
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
            const colorClass = getEventColorClass(ev.eventType);
            html += `
                <div style="padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.75rem; border-left: 4px solid var(--${colorClass === 'badge-success' ? 'primary' : colorClass === 'badge-warning' ? 'accent' : 'secondary'});">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0;">${escapeHtml(ev.name)}</h4>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--muted-foreground);">
                                <span>📅 ${new Date(ev.startDate).toLocaleDateString()} - ${new Date(ev.endDate).toLocaleDateString()}</span>
                                <span>📍 ${ev.location?.name || ev.location}</span>
                                <span>🏷️ ${formatEventType(ev.eventType)}</span>
                            </div>
                        </div>
                        <span class="badge ${getStatusBadgeClass(ev.status)}">${ev.status.replace('_',' ')}</span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                        Trainers: ${ev.trainers?.map(t => t.trainerId?.name || 'Unassigned').join(', ') || 'None assigned'} |
                        RSVP: ${ev.targetSchools?.filter(s => s.rsvpStatus === 'confirmed').length || 0} confirmed
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

function getEventColorClass(eventType) {
    // Returns color for event type for calendar markers
    const colors = {
        'camp': 'primary',
        'hike': 'success',
        'team_building': 'accent',
        'training_session': 'warning',
        'inter_school_competition': 'danger',
        'other': 'secondary'
    };
    return colors[eventType] || 'secondary';
}

// ============ API ENDPOINTS FOR DROPDOWNS ============

// Add a catch-all route for fetching trainers list (assuming we add an endpoint)
// We'll add this endpoint in server.js: get('/api/trainers/list')

// And for schools list: get('/api/schools/list')

// ============ FORM HELPERS ============

// For create/edit modal equipment and prerequisites are dynamic
// Already handled above.

// ============ FILTERing ============


// Initialize filters
function initFilters() {
    const filterElements = ['eventSearch', 'typeFilter', 'statusFilter', 'startDateFilter', 'endDateFilter'];
    filterElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.addEventListener('keydown', e => e.key === 'Enter' && loadEvents());
            } else {
                el.addEventListener('change', loadEvents);
            }
        }
    });
}

// ============ SCHOOL ONBOARDING WIZARD ============

let currentOnboardingStep = 0;
let schoolFormData = {};
let isEditingMode = false;
let editingSchoolId = null;

async function openOnboardingModal(schoolId = null) {
    currentOnboardingStep = 0;
    schoolFormData = {};

    // Reset modal to creation mode by default
    isEditingMode = false;
    editingSchoolId = null;
    document.getElementById('onboardingModalTitle').textContent = 'Onboard New School';

    // Clear any previous messages and reset form
    const messageEl = document.getElementById('onboardingMessage');
    messageEl.style.display = 'none';
    messageEl.textContent = '';
    document.getElementById('onboardingForm').reset();
    // Clear program price display
    document.getElementById('selectedProgramPrice').textContent = '';

    // Reset program price display
    updateProgramPriceDisplay();

    if (schoolId) {
        // Edit mode: load school data
        isEditingMode = true;
        editingSchoolId = schoolId;
        document.getElementById('onboardingModalTitle').textContent = 'Edit School';

        try {
            const response = await fetch(`/api/schools/${schoolId}/onboard-data`);
            const result = await response.json();

            if (result.success) {
                const data = result.data;
                // Populate form fields
                document.getElementById('onboardingForm').name.value = data.name || '';
                document.getElementById('onboardingForm').street.value = data.street || '';
                document.getElementById('onboardingForm').city.value = data.city || '';
                document.getElementById('onboardingForm').state.value = data.state || '';
                document.getElementById('onboardingForm').zipCode.value = data.zipCode || '';
                document.getElementById('onboardingForm').country.value = data.country || 'Kenya';
                document.getElementById('onboardingForm').zone.value = data.zone || '';
                document.getElementById('onboardingForm').region.value = data.region || '';
                document.getElementById('onboardingForm').contactName.value = data.contactName || '';
                document.getElementById('onboardingForm').contactEmail.value = data.contactEmail || '';
                document.getElementById('onboardingForm').contactPhone.value = data.contactPhone || '';
                document.getElementById('onboardingForm').contactPosition.value = data.contactPosition || '';
                document.getElementById('onboardingForm').studentCount.value = data.studentCount || 0;
                // Program selection
                if (data.programId) {
                    document.getElementById('onboardingForm').programId.value = data.programId;
                    // Update rate field from saved data; also update price label
                    const rateValue = data.ratePerStudent || '';
                    document.getElementById('ratePerStudent').value = rateValue;
                    const priceDisplay = document.getElementById('selectedProgramPrice');
                    if (priceDisplay) {
                        priceDisplay.textContent = rateValue ? `Rate: KES ${Number(rateValue).toFixed(2)} per student` : '';
                    }
                } else {
                    document.getElementById('onboardingForm').programId.value = '';
                    document.getElementById('onboardingForm').ratePerStudent.value = '';
                    document.getElementById('selectedProgramPrice').textContent = '';
                }
                document.getElementById('onboardingForm').paymentMethod.value = data.paymentMethod || 'bank_transfer';
                document.getElementById('onboardingForm').billingCycle.value = data.billingCycle || 'weekly';
                document.getElementById('onboardingForm').ratePerStudent.value = data.ratePerStudent || '';
                document.getElementById('onboardingForm').primaryTrainerId.value = data.primaryTrainerId || '';
                document.getElementById('onboardingForm').notes.value = data.notes || '';
            } else {
                showToast('Failed to load school data: ' + (result.error || 'Unknown error'), 'error');
                return;
            }
        } catch (error) {
            console.error('Error fetching school data:', error);
            showToast('Network error loading school data', 'error');
            return;
        }
    }

    document.getElementById('onboardingModal').style.display = 'flex';
    showOnboardingStep(0);
    updateOnboardingUI();
}

function closeOnboardingModal() {
    document.getElementById('onboardingModal').style.display = 'none';
    document.getElementById('onboardingForm').reset();
    currentOnboardingStep = 0;
    schoolFormData = {};
    isEditingMode = false;
    editingSchoolId = null;
    document.getElementById('onboardingModalTitle').textContent = 'Onboard New School';
    // Clear price display
    document.getElementById('selectedProgramPrice').textContent = '';
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
        nextBtn.textContent = currentOnboardingStep === 3 ? (isEditingMode ? 'Save Changes' : 'Complete Onboarding') : 'Next Step';
    }

    // Update summary on last step
    if (currentOnboardingStep === 3) {
        updateOnboardingSummary();
    }
}

// Update program price when selection changes
function updateProgramPriceDisplay(programId = null) {
    const programSelect = document.getElementById('programSelect');
    if (!programSelect) return;
    
    // If a specific programId is passed (e.g., on edit load), set the select value
    if (programId) {
        programSelect.value = programId;
    }
    
    const selectedOption = programSelect.options[programSelect.selectedIndex];
    const priceDisplay = document.getElementById('selectedProgramPrice');
    const rateField = document.getElementById('ratePerStudent');
    
    if (selectedOption && selectedOption.value) {
        const price = selectedOption.dataset.price;
        if (priceDisplay) priceDisplay.textContent = `Rate: KES ${Number(price).toFixed(2)} per student`;
        if (rateField) rateField.value = price;
    } else {
        if (priceDisplay) priceDisplay.textContent = '';
        if (rateField) rateField.value = '';
    }
}

// Attach program change listener on document ready
document.addEventListener('DOMContentLoaded', function() {
    const programSelect = document.getElementById('programSelect');
    if (programSelect) {
        programSelect.addEventListener('change', function() {
            updateProgramPriceDisplay();
        });
    }
});

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
    const programSelect = form.programId;
    const programName = programSelect.options[programSelect.selectedIndex]?.text.split(' - ')[0] || 'No program selected';
    const rate = form.ratePerStudent.value ? `KES ${Number(form.ratePerStudent.value).toFixed(2)}/student` : 'Not set';
    
    summary.innerHTML = `
        <strong>${name}</strong><br>
        📍 ${city}<br>
        👤 ${contact}<br>
        🎓 Program: ${programName}<br>
        💰 Rate: ${rate}<br>
        📞 Trainer: ${trainerName}<br>
        📅 Billing: ${form.billingCycle.value.replace('_', ' ')}
    `;
}

async function submitOnboarding() {
    const messageEl = document.getElementById('onboardingMessage');
    const form = document.getElementById('onboardingForm');
    // Pre-submit validation: guard against empty required fields
    if (form) {
        const programSelect = form.querySelector('#programSelect');
        const nameInput = form.querySelector('[name="name"]');
        const contactNameInput = form.querySelector('[name="contactName"]');
        const contactEmailInput = form.querySelector('[name="contactEmail"]');
        const contactPhoneInput = form.querySelector('[name="contactPhone"]');
        const missing = [];
        if (nameInput && !nameInput.value.trim()) missing.push('School Name');
        if (contactNameInput && !contactNameInput.value.trim()) missing.push('Contact Name');
        if (contactEmailInput && !contactEmailInput.value.trim()) missing.push('Contact Email');
        if (contactPhoneInput && !contactPhoneInput.value.trim()) missing.push('Contact Phone');
        if (programSelect && !programSelect.value) missing.push('Program');
        if (missing.length) {
            messageEl.textContent = '✗ Please complete all required fields: ' + missing.join(', ');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.borderLeft = '4px solid #f5c6cb';
            messageEl.style.display = 'block';
            return;
        }
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        let endpoint, method;
        let successMessage, redirectUrl;

        if (isEditingMode && editingSchoolId) {
            // Edit mode: update existing school
            endpoint = `/api/schools/${editingSchoolId}/update`;
            method = 'POST';
            successMessage = '✓ School updated successfully! Redirecting...';
            redirectUrl = `/dashboard/schools/${editingSchoolId}`;
        } else {
            // Create mode: onboard new school
            endpoint = '/dashboard/schools/onboard';
            method = 'POST';
            successMessage = '✓ School onboarded successfully! Redirecting...';
            redirectUrl = '/dashboard/schools';
        }

        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            if (result.duplicate && result.schoolId) {
                // School already exists — skip redirect, show a clear warning
                messageEl.textContent = `⚠ School "${result.schoolName}" already exists. Opening existing record...`;
                messageEl.style.backgroundColor = '#fff3cd';
                messageEl.style.color = '#856404';
                messageEl.style.borderLeft = '4px solid #ffc107';
                messageEl.style.display = 'block';
                setTimeout(() => {
                    window.location.href = `/dashboard/schools/${result.schoolId}`;
                }, 1500);
            } else {
                messageEl.textContent = successMessage;
                messageEl.style.backgroundColor = '#d4edda';
                messageEl.style.color = '#155724';
                messageEl.style.borderLeft = '4px solid #28a745';
                messageEl.style.display = 'block';

                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1500);
            }
        } else {
            messageEl.textContent = '✗ ' + (result.error || 'Failed to save school');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.borderLeft = '4px solid #f5c6cb';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error saving school:', error);
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

// ============ STAFF ONBOARDING ============

let currentStaffOnboardingStep = 0;
let staffFormCache = {};

function openAddStaffModal() {
    currentStaffOnboardingStep = 0;
    staffFormCache = {};

    // Reset modal
    document.getElementById('addStaffModalTitle').textContent = 'Add New Staff Member';
    const messageEl = document.getElementById('staffOnboardingMessage');
    if (messageEl) {
        messageEl.style.display = 'none';
        messageEl.textContent = '';
    }
    const form = document.getElementById('addStaffForm');
    if (form) form.reset();

    // Show modal and first step
    document.getElementById('addStaffModal').style.display = 'flex';
    showStaffOnboardingStep(0);
    updateStaffOnboardingUI();

    // Attach event listener to next button
    const nextBtn = document.getElementById('staffNextStepBtn');
    if (nextBtn) {
        nextBtn.onclick = function(e) {
            if (currentStaffOnboardingStep === 3) {
                e.preventDefault();
                submitStaffOnboarding();
            } else {
                changeStaffOnboardingStep(1);
            }
        };
    }
}

function closeAddStaffModal() {
    document.getElementById('addStaffModal').style.display = 'none';
    const form = document.getElementById('addStaffForm');
    if (form) form.reset();
    currentStaffOnboardingStep = 0;
    staffFormCache = {};
    document.getElementById('addStaffModalTitle').textContent = 'Add New Staff Member';
}

function changeStaffOnboardingStep(delta) {
    const totalSteps = 4;
    const newStep = currentStaffOnboardingStep + delta;
    if (newStep < 0 || newStep >= totalSteps) {
        console.log('Staff step change out of bounds:', currentStaffOnboardingStep, '->', newStep);
        return;
    }

    // Validate current step before moving forward
    if (delta > 0 && !validateStaffOnboardingStep(currentStaffOnboardingStep)) {
        console.log('Validation failed for step', currentStaffOnboardingStep);
        return;
    }

    console.log('Changing staff step from', currentStaffOnboardingStep, 'to', newStep);
    currentStaffOnboardingStep = newStep;
    showStaffOnboardingStep(currentStaffOnboardingStep);
    updateStaffOnboardingUI();
}

function showStaffOnboardingStep(stepIndex) {
    document.querySelectorAll('#addStaffForm .onboarding-step').forEach((el, idx) => {
        el.style.display = idx === stepIndex ? 'grid' : 'none';
    });
}

function updateStaffOnboardingUI() {
    // Update step indicators
    for (let i = 0; i < 4; i++) {
        const indicator = document.getElementById(`staff-step-indicator-${i}`);
        if (indicator) {
            indicator.style.fontWeight = i === currentStaffOnboardingStep ? 'bold' : 'normal';
            indicator.style.color = i <= currentStaffOnboardingStep ? 'var(--primary)' : 'var(--muted-foreground)';
        }
    }

    // Update buttons
    const prevBtn = document.getElementById('staffPrevStepBtn');
    const nextBtn = document.getElementById('staffNextStepBtn');
    const submitBtn = document.getElementById('staffSubmitBtn');

    if (prevBtn) prevBtn.style.display = currentStaffOnboardingStep === 0 ? 'none' : 'inline-block';
    if (nextBtn) {
        nextBtn.style.display = currentStaffOnboardingStep === 3 ? 'none' : 'inline-block';
        nextBtn.textContent = 'Next Step';
    }
    if (submitBtn) submitBtn.style.display = currentStaffOnboardingStep === 3 ? 'inline-block' : 'none';

    // Update summary on last step
    if (currentStaffOnboardingStep === 3) {
        updateStaffOnboardingSummary();
    }
}

function validateStaffOnboardingStep(step) {
    const stepElement = document.querySelector(`#staff-step-${step}`);
    if (!stepElement) {
        console.error('Staff step element not found for step', step);
        return false;
    }
    const requiredInputs = stepElement.querySelectorAll('[required]');
    for (let input of requiredInputs) {
        if (!input.value.trim()) {
            showToast('Please fill in all required fields', 'error');
            input.focus();
            return false;
        }
    }
    return true;
}

function updateStaffOnboardingSummary() {
    const form = document.getElementById('addStaffForm');
    const summary = document.getElementById('staffOnboardingSummary');
    if (!form || !summary) return;

    const name = form.name.value || 'Not provided';
    const email = form.email.value || 'Not provided';
    const role = form.role.value || 'Not selected';
    const department = form.department.value || 'Training';
    const status = form.status.value || 'Active';
    const phone = form.phone.value || 'N/A';
    const city = form.city.value || 'N/A';
    const emergencyName = form.emergencyContactName.value || 'None';

    summary.innerHTML = `
        <strong style="font-size: 1.05rem; color: var(--primary);">${name}</strong><br>
        📧 ${email}<br>
        📞 ${phone}<br>
        👤 Role: ${role}<br>
        🏢 Department: ${department}<br>
        ✅ Status: ${status}<br>
        📍 City: ${city}<br>
        🆘 Emergency: ${emergencyName}<br>
        <em style="color: var(--muted-foreground); margin-top: 0.5rem; display: block;">Please confirm all details are correct before submitting.</em>
    `;
}

async function submitStaffOnboarding() {
    const form = document.getElementById('addStaffForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const messageEl = document.getElementById('staffOnboardingMessage');
    if (messageEl) {
        messageEl.style.display = 'none';
        messageEl.textContent = '';
    }

    try {
        const response = await fetch('/dashboard/staff/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.redirected) {
            if (messageEl) {
                messageEl.textContent = '✓ Staff added successfully! Redirecting...';
                messageEl.style.backgroundColor = '#d4edda';
                messageEl.style.color = '#155724';
                messageEl.style.borderLeft = '4px solid #28a745';
                messageEl.style.display = 'block';
            }
            setTimeout(() => { window.location.href = response.url; }, 1000);
            return;
        }

        let result;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            // Handle plain text or HTML error messages
            const text = await response.text();
            result = { success: false, error: text };
        }

        if (result.success || response.ok) {
            if (messageEl) {
                messageEl.textContent = '✓ Staff added successfully! Redirecting...';
                messageEl.style.backgroundColor = '#d4edda';
                messageEl.style.color = '#155724';
                messageEl.style.borderLeft = '4px solid #28a745';
                messageEl.style.display = 'block';
            }
            setTimeout(() => { window.location.href = '/dashboard/staff'; }, 1500);
        } else {
            if (messageEl) {
                const errorMsg = (result.error || 'Failed to add staff member').replace(/<[^>]*>/g, ''); // Strip HTML tags if any
                messageEl.textContent = '✗ ' + errorMsg;
                messageEl.style.backgroundColor = '#f8d7da';
                messageEl.style.color = '#721c24';
                messageEl.style.borderLeft = '4px solid #f5c6cb';
                messageEl.style.display = 'block';
            }
        }
     } catch (error) {
         console.error('Error adding staff:', error);
         if (messageEl) {
             messageEl.textContent = '✗ Network error: ' + error.message;
             messageEl.style.backgroundColor = '#f8d7da';
             messageEl.style.color = '#721c24';
             messageEl.style.borderLeft = '4px solid #f5c6cb';
             messageEl.style.display = 'block';
         }
     }
 }

 // Close modal when clicking outside
 document.addEventListener('click', function(event) {
     const staffModal = document.getElementById('addStaffModal');
     if (staffModal && event.target === staffModal) {
         closeAddStaffModal();
     }
 });

// Attach step indicator click handlers for navigation
document.addEventListener('DOMContentLoaded', function() {
    for (let i = 0; i < 4; i++) {
        const indicator = document.getElementById(`staff-step-indicator-${i}`);
        if (indicator) {
            indicator.addEventListener('click', () => {
                // Only allow navigating to previous steps or current+1 if validated
                if (i <= currentStaffOnboardingStep + 1) {
                    if (i < currentStaffOnboardingStep || validateStaffOnboardingStep(currentStaffOnboardingStep)) {
                        currentStaffOnboardingStep = i;
                        showStaffOnboardingStep(i);
                        updateStaffOnboardingUI();
                    }
                }
            });
        }
    }
});

// ============ END STAFF ONBOARDING ============

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
    openAddStaffModal,
    closeAddStaffModal,
    changeStaffOnboardingStep,
    openAddScoutGroupModal,
    closeAddScoutGroupModal,
    saveScoutGroup,
    deleteScoutGroup
};