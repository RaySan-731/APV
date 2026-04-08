// Dashboard JavaScript file for Arrow-Park Ventures (APV)

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

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (sidebar && !sidebar.contains(e.target) && !mobileSidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
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
function editStaff(staffId, idNumber, name, email, role, status) {
    document.getElementById('editStaffId').value = staffId;
    document.getElementById('editIdNumber').value = idNumber;
    document.getElementById('editName').value = name;
    document.getElementById('editEmail').value = email;
    document.getElementById('editRole').value = role;
    document.getElementById('editStatus').value = status;
    
    // Clear any previous messages
    const messageEl = document.getElementById('editMessage');
    messageEl.style.display = 'none';
    messageEl.textContent = '';
    
    // Show the modal
    const modal = document.getElementById('editStaffModal');
    modal.style.display = 'flex';
    modal.classList.add('active');
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
    const role = document.getElementById('editRole').value;
    const status = document.getElementById('editStatus').value;
    
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
                role,
                status
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
    if (confirm('Are you sure you want to delete this staff member?')) {
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
                alert('Staff member deleted successfully');
                window.location.reload();
            } else {
                alert('Error: ' + (data.error || 'Failed to delete staff member'));
            }
        } catch (error) {
            console.error('Error deleting staff:', error);
            alert('Network error while deleting staff member');
        }
    }
}

// ============ TRAINER MANAGEMENT FUNCTIONS ============

// Edit trainer
function editTrainer(trainerId, idNumber, name, email, phone, status) {
    document.getElementById('editTrainerId').value = trainerId;
    document.getElementById('editTrainerIdNumber').value = idNumber;
    document.getElementById('editTrainerName').value = name;
    document.getElementById('editTrainerEmail').value = email;
    document.getElementById('editTrainerPhone').value = phone;
    document.getElementById('editTrainerStatus').value = status;

    // Clear previous messages
    const messageEl = document.getElementById('editTrainerMessage');
    messageEl.style.display = 'none';
    messageEl.textContent = '';

    // Show modal
    const modal = document.getElementById('editTrainerModal');
    modal.style.display = 'block';
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
    if (confirm('Are you sure you want to delete this trainer?')) {
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
                alert('Trainer deleted successfully');
                window.location.reload();
            } else {
                alert('Error: ' + (data.error || 'Failed to delete trainer'));
            }
        } catch (error) {
            console.error('Error deleting trainer:', error);
            alert('Network error while deleting trainer');
        }
    }
}

// ============ SCHOOL ALLOCATION FUNCTIONS ============

// Open allocate schools modal
async function openAllocateSchoolsModal(trainerId, trainerName) {
    document.getElementById('allocateTrainerName').textContent = trainerName;
    document.getElementById('allocateTrainerId').value = trainerId;

    const messageEl = document.getElementById('allocateMessage');
    messageEl.style.display = 'none';

    // Load schools
    try {
        const response = await fetch(`/dashboard/trainer/${trainerId}/schools`);
        const data = await response.json();

        if (data.success) {
            renderSchoolsList(data.schools, data.allocatedSchools || []);
            const modal = document.getElementById('allocateSchoolsModal');
            modal.style.display = 'block';
        } else {
            messageEl.textContent = '✗ Error loading schools: ' + (data.error || 'Unknown error');
            messageEl.style.backgroundColor = '#f8d7da';
            messageEl.style.color = '#721c24';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading schools:', error);
        messageEl.textContent = '✗ Network error: ' + error.message;
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
            messageEl.textContent = '✓ Schools allocated successfully!';
            messageEl.style.backgroundColor = '#d4edda';
            messageEl.style.color = '#155724';
            messageEl.style.borderLeft = '4px solid #c3e6cb';
            messageEl.style.display = 'block';

            setTimeout(() => {
                window.location.reload();
            }, 1000);
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

// Export functions for potential use in other scripts
window.DashboardUtils = {
    loadDashboardData,
    updateStats,
    updateActivities,
    initializeCharts
};