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