// main.js - Arrow-Park Ventures (APV) client-side utilities.
// Handles: mobile nav toggle, smooth scrolling, form validation, sidebar mobile toggle, resize events.

document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle - toggles .open class for responsive nav visibility
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('open');
            navToggle.classList.toggle('open');
        });
    }

    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Form validation
    const forms = document.querySelectorAll('form');
    // Form validation and submit loading state
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.classList.add('error');
                } else {
                    field.classList.remove('error');
                }
            });

            if (!isValid) {
                e.preventDefault();
                alert('Please fill in all required fields.');
                return;
            }

            // Show loading on the button that submitted the form (supports Enter via e.submitter)
            try {
                const submitter = e.submitter || form.querySelector('[type="submit"]');
                if (submitter) {
                    submitter.dataset.__orig = submitter.textContent;
                    submitter.textContent = 'Loading...';
                    submitter.disabled = true;
                }
            } catch (err) {
                // ignore - don't block form submission if e.submitter not supported
            }
        });

        // Additional client-side validation for booking form
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('submit', function(e) {
                // clear previous errors
                const errForm = document.getElementById('err-form');
                const errDate = document.getElementById('err-date');
                const errParticipants = document.getElementById('err-participants');
                const errName = document.getElementById('err-name');
                const errEmail = document.getElementById('err-email');
                if (errForm) errForm.textContent = '';
                if (errDate) errDate.textContent = '';
                if (errParticipants) errParticipants.textContent = '';
                if (errName) errName.textContent = '';
                if (errEmail) errEmail.textContent = '';

                let invalid = false;

                const dateInput = bookingForm.querySelector('#date');
                const participantsInput = bookingForm.querySelector('#participants');
                const nameInput = bookingForm.querySelector('#name');
                const emailInput = bookingForm.querySelector('#email');

                if (dateInput && dateInput.value) {
                    const chosen = new Date(dateInput.value);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (chosen < today) {
                        invalid = true;
                        if (errDate) errDate.textContent = 'Please choose a future date.';
                    }
                } else if (dateInput) {
                    invalid = true;
                    if (errDate) errDate.textContent = 'Please choose a date.';
                }

                if (participantsInput) {
                    const n = parseInt(participantsInput.value, 10);
                    if (isNaN(n) || n < 1) {
                        invalid = true;
                        if (errParticipants) errParticipants.textContent = 'Participants must be at least 1.';
                    }
                }

                if (nameInput) {
                    if (!nameInput.value.trim()) {
                        invalid = true;
                        if (errName) errName.textContent = 'Please enter your name.';
                    }
                }

                if (emailInput) {
                    const v = (emailInput.value || '').trim();
                    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRe.test(v)) {
                        invalid = true;
                        if (errEmail) errEmail.textContent = 'Please enter a valid email.';
                    }
                }

                if (invalid) {
                    e.preventDefault();
                    if (errForm) errForm.textContent = 'Please fix the errors above and try again.';
                    return false;
                }
            });
        }
    });

    // Handle mobile sidebar toggle
    const mobileSidebarToggle = document.querySelector('.mobile-sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (mobileSidebarToggle && sidebar) {
        mobileSidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileSidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            if (sidebar) sidebar.classList.remove('open');
            if (navMenu) navMenu.classList.remove('open');
            if (navToggle) navToggle.classList.remove('open');
        }
    });
});