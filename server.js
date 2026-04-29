/*
 * server.js
 * Entry point for the Arrow-Park Ventures (APV) Express server.
 * - Configures middleware, session handling, and view engine (EJS).
 * - Connects to MongoDB via Mongoose when `MONGODB_URI` is provided.
 * - Defines routes for public pages, booking submission, admin pages, and API endpoints.
 * - Includes authentication and role-based middleware helpers.
 */

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
// const bodyParser = require('body-parser');
// const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// app.use(cors());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware (needed for form POSTs)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'apv-ventures-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import models
const User = require('./models/User');
const Booking = require('./models/Booking');
const Program = require('./models/Program');
const School = require('./models/School');
const Staff = require('./models/Staff');
const Event = require('./models/Event');
const VisitLog = require('./models/VisitLog');
const Feedback = require('./models/Feedback');
const AuditLog = require('./models/AuditLog');
const Permission = require('./models/Permission');
const ScoutGroup = require('./models/ScoutGroup');
const SchoolEvent = require('./models/SchoolEvent');
const Payment = require('./models/Payment');
const SchoolDocument = require('./models/SchoolDocument');

// MongoDB connection
if (process.env.MONGODB_URI) {
  // Connect without deprecated options; mongoose v6+ uses sensible defaults
  mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.log('Make sure MongoDB is running on localhost:27017');
  });
} else {
  console.log('No MONGODB_URI provided in .env file');
}

// Middleware functions
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    const isApiRequest = req.xhr || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['content-type']?.includes('application/json') ||
                         req.path.startsWith('/api/');
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
};

const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.session.user) {
      const isApiRequest = req.xhr || 
                           req.headers.accept?.includes('application/json') ||
                           req.headers['content-type']?.includes('application/json') ||
                           req.path.startsWith('/api/') ||
                           (req.path.startsWith('/dashboard/') && (
                             req.method === 'POST' || 
                             req.headers['content-type']?.includes('application/json')
                           ));
      if (isApiRequest) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }

    try {
      const staffPermissions = await Permission.findOne({ role: req.session.user.role });
      if (!staffPermissions || !staffPermissions.permissions[permission]) {
        const isApiRequest = req.xhr || 
                             req.headers.accept?.includes('application/json') ||
                             req.headers['content-type']?.includes('application/json') ||
                             req.path.startsWith('/api/') ||
                             (req.path.startsWith('/dashboard/') && (
                               req.method === 'POST' || 
                               req.headers['content-type']?.includes('application/json')
                             ));
        if (isApiRequest) {
          return res.status(403).json({ success: false, error: 'Access denied. Insufficient permissions.' });
        }
        return res.status(403).render('404', {
          user: req.session.user,
          error: 'Access denied. Insufficient permissions.'
        });
      }
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      const isApiRequest = req.xhr || 
                           req.headers.accept?.includes('application/json') ||
                           req.headers['content-type']?.includes('application/json') ||
                           req.path.startsWith('/api/') ||
                           (req.path.startsWith('/dashboard/') && (
                             req.method === 'POST' || 
                             req.headers['content-type']?.includes('application/json')
                           ));
      if (isApiRequest) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
      }
      res.status(500).render('404', { user: req.session.user });
    }
  };
};

const logAudit = async (action, entityType, entityId, entityName, changes = {}, metadata = {}) => {
  try {
    const auditEntry = new AuditLog({
      action,
      entityType,
      entityId,
      entityName,
      performedBy: {
        userId: metadata.userId,
        userName: metadata.userName,
        userEmail: metadata.userEmail,
        userRole: metadata.userRole
      },
      changes,
      metadata: {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        sessionId: metadata.sessionId
      }
    });
    await auditEntry.save();
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

// Email utility function
const sendEmail = async (to, subject, html) => {
  try {
    const nodemailer = require('nodemailer');

    // Create transporter (configure with your email service or fallback to logging transport)
    const transporter = (process.env.SMTP_USER && process.env.SMTP_PASS)
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT, 10) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        })
      : nodemailer.createTransport({ jsonTransport: true });

    // Send email
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@apv-ventures.com',
      to: to,
      subject: subject,
      html: html
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Initialize default permissions
const initializePermissions = async () => {
  try {
    const defaultPermissions = [
      // Legacy user roles (from User model)
      {
        role: 'founder',
        permissions: {
          canViewStaff: true,
          canCreateStaff: true,
          canEditStaff: true,
          canDeleteStaff: true,
          canInviteStaff: true,
          canResetPasswords: true,
          canViewSchools: true,
          canCreateSchools: true,
          canEditSchools: true,
          canDeleteSchools: true,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: true,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: true,
          canEditPrograms: true,
          canDeletePrograms: true,
          canViewBookings: true,
          canCreateBookings: true,
          canEditBookings: true,
          canDeleteBookings: true,
          canApproveBookings: true,
          canViewFinancials: true,
          canManageBudgets: true,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: true,
          canManageSystem: true,
          canViewAuditLogs: true,
          canManagePermissions: true
        },
        description: 'Organization founder with full access'
      },
      {
        role: 'commissioner',
        permissions: {
          canViewStaff: true,
          canCreateStaff: true,
          canEditStaff: true,
          canDeleteStaff: false,
          canInviteStaff: true,
          canResetPasswords: true,
          canViewSchools: true,
          canCreateSchools: true,
          canEditSchools: true,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: false,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: true,
          canEditPrograms: true,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: true,
          canEditBookings: true,
          canDeleteBookings: false,
          canApproveBookings: true,
          canViewFinancials: true,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: true,
          canManagePermissions: false
        },
        description: 'Commissioner with broad management access'
      },
      {
        role: 'training_officer',
        permissions: {
          canViewStaff: true,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: false,
          canEditEvents: false,
          canDeleteEvents: false,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: true,
          canManagePermissions: false
        },
        description: 'Training officer with scheduling and oversight'
      },
      {
        role: 'medical',
        permissions: {
          canViewStaff: true,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: false,
          canViewEvents: true,
          canCreateEvents: false,
          canEditEvents: false,
          canDeleteEvents: false,
          canScheduleEvents: false,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: false,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Medical staff with limited viewing access'
      },
      {
        role: 'rover',
        permissions: {
          canViewStaff: false,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: false,
          canViewEvents: true,
          canCreateEvents: false,
          canEditEvents: false,
          canDeleteEvents: false,
          canScheduleEvents: false,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: false,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: false,
          canGenerateReports: false,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Basic member with minimal access'
      },
      {
        role: 'staff',
        permissions: {
          canViewStaff: false,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: false,
          canViewEvents: true,
          canCreateEvents: false,
          canEditEvents: false,
          canDeleteEvents: false,
          canScheduleEvents: false,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: false,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: false,
          canGenerateReports: false,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Staff with basic viewing permissions'
      },
      // Staff roles (from Staff model)
      {
        role: 'trainer',
        permissions: {
          canViewStaff: false,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: false,
          canViewEvents: true,
          canCreateEvents: false,
          canEditEvents: false,
          canDeleteEvents: false,
          canScheduleEvents: false,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: false,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: false,
          canGenerateReports: false,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Basic trainer permissions'
      },
      {
        role: 'senior trainer',
        permissions: {
          canViewStaff: true,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: true,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: false,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Senior trainer with additional responsibilities'
      },
      {
        role: 'supervisor',
        permissions: {
          canViewStaff: true,
          canCreateStaff: true,
          canEditStaff: true,
          canDeleteStaff: false,
          canInviteStaff: true,
          canResetPasswords: true,
          canViewSchools: true,
          canCreateSchools: true,
          canEditSchools: true,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: true,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: true,
          canEditPrograms: true,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: true,
          canEditBookings: true,
          canDeleteBookings: true,
          canApproveBookings: true,
          canViewFinancials: true,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: true,
          canManageSystem: false,
          canViewAuditLogs: true,
          canManagePermissions: false
        },
        description: 'Supervisor with management capabilities'
      },
      {
        role: 'admin',
        permissions: {
          canViewStaff: true,
          canCreateStaff: true,
          canEditStaff: true,
          canDeleteStaff: true,
          canInviteStaff: true,
          canResetPasswords: true,
          canViewSchools: true,
          canCreateSchools: true,
          canEditSchools: true,
          canDeleteSchools: true,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: true,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: true,
          canEditPrograms: true,
          canDeletePrograms: true,
          canViewBookings: true,
          canCreateBookings: true,
          canEditBookings: true,
          canDeleteBookings: true,
          canApproveBookings: true,
          canViewFinancials: true,
          canManageBudgets: true,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: true,
          canManageSystem: true,
          canViewAuditLogs: true,
          canManagePermissions: true
        },
        description: 'Full administrative access'
      },
      {
        role: 'coordinator',
        permissions: {
          canViewStaff: true,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: false,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: true,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Coordinator for scheduling and assignments'
      }
    ];

    for (const perm of defaultPermissions) {
      await Permission.findOneAndUpdate(
        { role: perm.role },
        perm,
        { upsert: true, new: true }
      );
    }

    console.log('✓ Default permissions initialized');
  } catch (err) {
    console.error('✗ Error initializing permissions:', err);
  }
};

// Routes
app.get('/', (req, res) => {
  try {
    // Render the main index page (uses public CSS/JS assets)
    res.render('index', { user: req.session.user });
  } catch (error) {
    console.error('Error in root route:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user, next: req.query.next || '' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Try to authenticate against MongoDB user store
    const user = await User.findOne({ email: email.toLowerCase() });

    // Trainer fallback from Staff collection using default trainer password 0000
    const trainerFallback = await Staff.findOne({ email: email.toLowerCase(), role: 'trainer' });
    if ((!user || !await require('bcryptjs').compare(password, user.password)) && trainerFallback && password === '0000') {
      req.session.user = {
        id: trainerFallback._id.toString(),
        email: trainerFallback.email,
        role: 'trainer',
        name: trainerFallback.name || 'Trainer'
      };
      return res.redirect('/trainer/dashboard');
    }

    if (!user) {
      return res.render('login', { error: 'Invalid credentials', user: req.session.user });
    }

    const match = await require('bcryptjs').compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Invalid credentials', user: req.session.user });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    req.session.user = {
      email: user.email,
      role: user.role || 'rover',
      name: user.name || 'Member'
    };

    // redirect to requested page if present
    const nextUrl = req.body.next || req.query.next || (req.session.user.role === 'trainer' ? '/trainer/dashboard' : '/dashboard');
    return res.redirect(nextUrl);
  } catch (err) {
    console.error('Login error:', err);
    return res.render('login', { error: 'Internal error', user: req.session.user });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Static landing pages
app.get('/programs', (req, res) => {
  res.render('index', { user: req.session.user, section: 'programs' });
});

app.get('/about', (req, res) => {
  res.render('index', { user: req.session.user, section: 'about' });
});

app.get('/events', (req, res) => {
  res.render('index', { user: req.session.user, section: 'events' });
});

app.get('/faq', (req, res) => {
  res.render('index', { user: req.session.user, section: 'faq' });
});

app.get('/contact', (req, res) => {
  res.render('index', { user: req.session.user, section: 'contact' });
});

app.post('/contact', (req, res) => {
  // In a production app, you would save this to a database or send an email
  const { name, email, subject, message } = req.body;
  console.log(`Contact form submission: ${name} (${email}) - ${subject}`);
  // For now, redirect to index with a success message in the session
  req.session.contactMessage = `Thank you ${name}, we received your message and will get back to you soon!`;
  res.redirect('/#contact');
});

app.get('/dashboard', requireAuth, async (req, res) => {
  if (req.session.user && req.session.user.role === 'trainer') {
    return res.redirect('/trainer/dashboard');
  }

  try {
    // Fetch real statistics
    const totalStaff = await Staff.countDocuments();
    const activeStaff = await Staff.countDocuments({ status: 'Active' });
    const onLeaveStaff = await Staff.countDocuments({ status: 'On Leave' });

    // Calculate average performance metrics
    const performanceStats = await Staff.aggregate([
      {
        $group: {
          _id: null,
          avgAttendance: { $avg: '$performanceMetrics.averageAttendanceRate' },
          avgFeedback: { $avg: '$performanceMetrics.averageFeedbackRating' },
          totalEvents: { $sum: '$performanceMetrics.eventsCompleted' },
          totalReports: { $sum: '$performanceMetrics.reportsSubmitted' }
        }
      }
    ]);

    const stats = performanceStats[0] || {
      avgAttendance: 0,
      avgFeedback: 0,
      totalEvents: 0,
      totalReports: 0
    };

    res.render('dashboard', {
      user: req.session.user,
      page: 'dashboard',
      stats: {
        totalStaff,
        activeStaff,
        onLeaveStaff,
        avgAttendance: Math.round(stats.avgAttendance || 0),
        avgFeedback: Math.round(stats.avgFeedback || 0),
        totalEvents: stats.totalEvents || 0,
        totalReports: stats.totalReports || 0
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.render('dashboard', {
      user: req.session.user,
      page: 'dashboard',
      stats: {
        totalStaff: 0,
        activeStaff: 0,
        onLeaveStaff: 0,
        avgAttendance: 0,
        avgFeedback: 0,
        totalEvents: 0,
        totalReports: 0
      }
    });
  }
});

app.get('/trainer/dashboard', requireAuth, (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
  res.render('trainer_dashboard', {
    user: req.session.user,
    page: 'trainer_dashboard'
  });
});

// Booking routes
// Allow guests to view and submit bookings; when logged-in, form will pre-fill
app.get('/book', (req, res) => {
  res.render('book_program', { user: req.session.user });
});

app.post('/book/submit', async (req, res) => {
  const { program, type, date, participants, notes, userEmail, name, email } = req.body;

  try {
    const booking = new Booking({
      program: program || 'Unknown',
      type: type || 'school',
      date: new Date(date) || new Date(),
      participants: parseInt(participants) || 0,
      notes: notes || '',
      // prefer session user email, then hidden userEmail, then posted email (guest), else 'guest'
      userEmail: (req.session.user && req.session.user.email) || userEmail || email || 'guest',
      requesterName: (req.session.user && req.session.user.name) || name || '',
      status: 'pending'
    });

    await booking.save();
    res.render('book_success', { booking });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to create booking' });
  }
});

// Admin user management
app.get('/admin/users', requireAuth, requireFounder, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.render('admin_users', { users, user: req.session.user });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

app.post('/admin/users/create', requireAuth, requireFounder, async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.redirect('/admin/users');

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.redirect('/admin/users');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      email: email.toLowerCase(),
      password: hash,
      name: name || 'Member',
      role: role || 'rover',
      isActive: true
    });
    
    await newUser.save();
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error creating user:', err);
    res.redirect('/admin/users');
  }
});

app.post('/admin/users/delete', requireAuth, requireFounder, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.redirect('/admin/users');
  
  try {
    await User.deleteOne({ email: email.toLowerCase() });
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error deleting user:', err);
    res.redirect('/admin/users');
  }
});

// Admin bookings management
app.get('/admin/bookings', requireAuth, requireFounder, async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 });
    res.render('admin_bookings', { bookings, user: req.session.user });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

app.post('/admin/bookings/delete', requireAuth, requireFounder, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.redirect('/admin/bookings');
  
  try {
    await Booking.deleteOne({ _id: id });
    res.redirect('/admin/bookings');
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.redirect('/admin/bookings');
  }
});

// Add staff from dashboard page
app.post('/dashboard/staff/add', requireAuth, requirePermission('canCreateStaff'), async (req, res) => {
  try {
    const {
      idNumber, name, email, phone, role, status, department,
      street, city, state, zipCode, country,
      emergencyContactName, emergencyContactRelationship, emergencyContactPhone, emergencyContactEmail
    } = req.body;

    console.log('=== STAFF ADD REQUEST ===');
    console.log('Full req.body:', JSON.stringify(req.body, null, 2));

    if (!name || !email || !role) {
      console.error('Missing required fields:', { name, email, role });
      return res.status(400).send('Missing required fields: name, email, role');
    }

    // Generate invitation token
    const crypto = require('crypto');
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const staffData = {
      idNumber: idNumber && idNumber.trim() ? idNumber.trim() : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      role: role.trim(),
      status: status || 'Active',
      department: department || 'Training',
      address: {
        street: street ? street.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        zipCode: zipCode ? zipCode.trim() : null,
        country: country || 'Kenya'
      },
      emergencyContact: {
        name: emergencyContactName ? emergencyContactName.trim() : null,
        relationship: emergencyContactRelationship ? emergencyContactRelationship.trim() : null,
        phone: emergencyContactPhone ? emergencyContactPhone.trim() : null,
        email: emergencyContactEmail ? emergencyContactEmail.trim().toLowerCase() : null
      },
      invitationToken,
      invitationExpires,
      createdBy: req.session.user.id || req.session.user._id
    };

    console.log('Staff data to save:', JSON.stringify(staffData, null, 2));
    const staff = new Staff(staffData);

    await staff.save();
    console.log('✓ Staff saved successfully:', staff._id, staff.idNumber, staff.name);

    // Send invitation email
    const invitationUrl = `${req.protocol}://${req.get('host')}/activate/${invitationToken}`;
    const emailHtml = `
      <h2>Welcome to APV Staff Portal</h2>
      <p>Dear ${staff.name},</p>
      <p>You have been invited to join the APV Staff Portal as a ${staff.role}.</p>
      <p>Please click the link below to activate your account and set your password:</p>
      <p><a href="${invitationUrl}">Activate Account</a></p>
      <p>This invitation will expire in 7 days.</p>
      <p>If you have any questions, please contact your administrator.</p>
      <p>Best regards,<br>APV Administration Team</p>
    `;

    await sendEmail(staff.email, 'APV Staff Portal Invitation', emailHtml);

    // Log audit
    await logAudit('staff_created', 'staff', staff._id, staff.name, {
      newValues: staffData
    }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    console.log('=== END STAFF ADD REQUEST ===\n');

    res.redirect('/dashboard/staff');
  } catch (err) {
    console.error('✗ Error saving staff:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END STAFF ADD REQUEST ===\n');
    res.status(500).send('Error saving staff: ' + err.message);
  }
});

// Update staff member
app.post('/dashboard/staff/update', requireAuth, requirePermission('canEditStaff'), async (req, res) => {
  try {
    const {
      staffId, idNumber, name, email, phone, role, status, department,
      street, city, state, zipCode, country,
      emergencyContactName, emergencyContactRelationship, emergencyContactPhone, emergencyContactEmail,
      canViewFinancials, canApproveReports, canScheduleEvents, canManageStaff, canViewAnalytics, canManageSchools, canSendInvitations,
      eventsCompleted, reportsSubmitted, schoolsVisited, averageAttendanceRate, averageFeedbackRating, lastPerformanceReview
    } = req.body;

    console.log('=== STAFF UPDATE REQUEST ===');
    console.log('Staff ID:', staffId);

    if (!staffId || !name || !email || !role) {
      console.error('Missing required fields');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Get old staff data for audit logging
    const oldStaff = await Staff.findById(staffId);
    if (!oldStaff) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const toBoolean = (value) => value === true || value === 'true' || value === 'on' || value === '1';
    const toInteger = (value) => {
      const val = parseInt(value, 10);
      return Number.isNaN(val) ? 0 : val;
    };
    const toFloat = (value) => {
      const val = parseFloat(value);
      return Number.isNaN(val) ? 0 : val;
    };

    const updateData = {
      idNumber: idNumber && idNumber.trim() ? idNumber.trim() : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      role: role.trim(),
      status: status || 'Active',
      department: department || 'Training',
      address: {
        street: street ? street.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        zipCode: zipCode ? zipCode.trim() : null,
        country: country || 'Kenya'
      },
      emergencyContact: {
        name: emergencyContactName ? emergencyContactName.trim() : null,
        relationship: emergencyContactRelationship ? emergencyContactRelationship.trim() : null,
        phone: emergencyContactPhone ? emergencyContactPhone.trim() : null,
        email: emergencyContactEmail ? emergencyContactEmail.trim().toLowerCase() : null
      },
      permissions: {
        canViewFinancials: toBoolean(canViewFinancials),
        canApproveReports: toBoolean(canApproveReports),
        canScheduleEvents: toBoolean(canScheduleEvents),
        canManageStaff: toBoolean(canManageStaff),
        canViewAnalytics: toBoolean(canViewAnalytics),
        canManageSchools: toBoolean(canManageSchools),
        canSendInvitations: toBoolean(canSendInvitations)
      },
      performanceMetrics: {
        eventsCompleted: toInteger(eventsCompleted),
        reportsSubmitted: toInteger(reportsSubmitted),
        schoolsVisited: toInteger(schoolsVisited),
        averageAttendanceRate: toFloat(averageAttendanceRate),
        averageFeedbackRating: toFloat(averageFeedbackRating),
        lastPerformanceReview: lastPerformanceReview ? new Date(lastPerformanceReview) : oldStaff.performanceMetrics?.lastPerformanceReview
      }
    };

    const staff = await Staff.findByIdAndUpdate(
      staffId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✓ Staff updated successfully:', staff._id, staff.name);

    // Log audit
    await logAudit('staff_updated', 'staff', staff._id, staff.name, {
      oldValues: oldStaff,
      newValues: updateData,
      fieldsChanged: Object.keys(updateData)
    }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    console.log('=== END STAFF UPDATE REQUEST ===\n');

    res.json({ success: true, message: 'Staff member updated successfully', staff });
  } catch (err) {
    console.error('✗ Error updating staff:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END STAFF UPDATE REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error updating staff: ' + err.message });
  }
});

// Delete staff member
app.post('/dashboard/staff/delete', requireAuth, requirePermission('canDeleteStaff'), async (req, res) => {
  try {
    const { staffId } = req.body;
    console.log('=== STAFF DELETE REQUEST ===');
    console.log('Staff ID:', staffId);

    if (!staffId) {
      return res.status(400).json({ success: false, error: 'Staff ID is required' });
    }

    const staff = await Staff.findByIdAndDelete(staffId);

    if (!staff) {
      console.error('Staff member not found:', staffId);
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    console.log('✓ Staff deleted successfully:', staff._id, staff.name);

    // Log audit
    await logAudit('staff_deleted', 'staff', staff._id, staff.name, {
      oldValues: staff
    }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    console.log('=== END STAFF DELETE REQUEST ===\n');

    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (err) {
    console.error('✗ Error deleting staff:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END STAFF DELETE REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error deleting staff: ' + err.message });
  }
});

// ============ STAFF MANAGEMENT ROUTES ============

// Get staff details
app.get('/api/staff/:staffId', requireAuth, async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.staffId).lean();
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    // Check permissions - users can view their own details, admins can view all
    if (req.session.user.id !== staff._id.toString() && req.session.user.role !== 'admin') {
      const permissions = await Permission.findOne({ role: req.session.user.role });
      if (!permissions?.permissions.canViewStaff) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(staff);
  } catch (err) {
    console.error('Error fetching staff details:', err);
    res.status(500).json({ error: 'Failed to fetch staff details' });
  }
});

// Get school details
app.get('/api/school/:schoolId', requireAuth, async (req, res) => {
  try {
    const school = await School.findById(req.params.schoolId).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(school);
  } catch (err) {
    console.error('Error fetching school details:', err);
    res.status(500).json({ error: 'Failed to fetch school details' });
  }
});

// Get permissions for a role
app.get('/api/permissions/:role', requireAuth, requirePermission('canManagePermissions'), async (req, res) => {
  try {
    const perm = await Permission.findOne({ role: req.params.role }).lean();
    if (!perm) {
      return res.status(404).json({ error: 'Permissions not found' });
    }

    res.json(perm);
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Update permissions for a role
app.post('/api/permissions/update', requireAuth, requirePermission('canManagePermissions'), async (req, res) => {
  try {
    const { role, permissions } = req.body;

    await Permission.findOneAndUpdate(
      { role },
      { permissions },
      { upsert: true, new: true }
    );

    // Log the permission change
    await logAudit('permission_changed', 'permission', null, role, { permissions }, req);

    res.json({ success: true, message: 'Permissions updated successfully' });
  } catch (err) {
    console.error('Error updating permissions:', err);
    res.status(500).json({ success: false, error: 'Failed to update permissions' });
  }
});

// ============ ACCOUNT MANAGEMENT ROUTES ============

// Account activation route
app.get('/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const staff = await Staff.findOne({
      invitationToken: token,
      invitationExpires: { $gt: Date.now() }
    });

    if (!staff) {
      return res.render('login', { error: 'Invalid or expired activation link', user: null });
    }

    res.render('activate_account', { token, email: staff.email, user: null });
  } catch (err) {
    console.error('Activation token error:', err);
    res.render('login', { error: 'Activation failed', user: null });
  }
});

app.post('/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render('activate_account', {
        token,
        email: req.body.email,
        error: 'Passwords do not match',
        user: null
      });
    }

    const staff = await Staff.findOne({
      invitationToken: token,
      invitationExpires: { $gt: Date.now() }
    });

    if (!staff) {
      return res.render('login', { error: 'Invalid or expired activation link', user: null });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update staff record
    staff.password = hashedPassword;
    staff.accountActivated = true;
    staff.activationDate = new Date();
    staff.invitationToken = undefined;
    staff.invitationExpires = undefined;

    await staff.save();

    // Log audit
    await logAudit('account_activated', 'staff', staff._id, staff.name, {}, {
      userId: staff._id,
      userName: staff.name,
      userEmail: staff.email,
      userRole: staff.role
    });

    res.render('login', { success: 'Account activated successfully! You can now log in.', user: null });
  } catch (err) {
    console.error('Account activation error:', err);
    res.render('login', { error: 'Account activation failed', user: null });
  }
});

// Password reset request
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const staff = await Staff.findOne({ email: email.toLowerCase() });

    if (!staff) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    staff.passwordResetToken = resetToken;
    staff.passwordResetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
    await staff.save();

    // Send reset email
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    const emailHtml = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your APV Staff account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    await sendEmail(staff.email, 'APV Password Reset', emailHtml);

    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

// Password reset form
app.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const staff = await Staff.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!staff) {
      return res.render('login', { error: 'Invalid or expired reset link', user: null });
    }

    res.render('reset_password', { token, user: null });
  } catch (err) {
    console.error('Reset token error:', err);
    res.render('login', { error: 'Reset failed', user: null });
  }
});

app.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render('reset_password', { token, error: 'Passwords do not match', user: null });
    }

    const staff = await Staff.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!staff) {
      return res.render('login', { error: 'Invalid or expired reset link', user: null });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    staff.password = hashedPassword;
    staff.passwordResetToken = undefined;
    staff.passwordResetExpires = undefined;
    await staff.save();

    // Log audit
    await logAudit('password_reset', 'staff', staff._id, staff.name, {}, {
      userId: staff._id,
      userName: staff.name,
      userEmail: staff.email,
      userRole: staff.role
    });

    res.render('login', { success: 'Password reset successfully! You can now log in.', user: null });
  } catch (err) {
    console.error('Password reset error:', err);
    res.render('login', { error: 'Password reset failed', user: null });
  }
});

// ============ LEAVE MANAGEMENT ROUTES ============

// Submit leave request
app.post('/api/leave/request', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, type, notes } = req.body;
    const staffId = req.session.user.id;

    const leaveRequest = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
      notes,
      status: 'pending'
    };

    await Staff.findByIdAndUpdate(staffId, {
      $push: { leaveHistory: leaveRequest }
    });

    // Log audit
    await logAudit('leave_requested', 'staff', staffId, req.session.user.name, {
      newValues: leaveRequest
    }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, message: 'Leave request submitted' });
  } catch (err) {
    console.error('Leave request error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit leave request' });
  }
});

// Approve/Reject leave
app.post('/api/leave/approve', requireAuth, requirePermission('canManageStaff'), async (req, res) => {
  try {
    const { staffId, leaveId, action, notes } = req.body;

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff not found' });
    }

    const leaveIndex = staff.leaveHistory.findIndex(l => l._id.toString() === leaveId);
    if (leaveIndex === -1) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }

    staff.leaveHistory[leaveIndex].status = action;
    staff.leaveHistory[leaveIndex].approvedBy = req.session.user.id;
    staff.leaveHistory[leaveIndex].approvedDate = new Date();

    await staff.save();

    // Log audit
    await logAudit(action === 'approved' ? 'leave_approved' : 'leave_rejected', 'staff', staffId, staff.name, {
      leaveId,
      action,
      notes
    }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, message: `Leave ${action}` });
  } catch (err) {
    console.error('Leave approval error:', err);
    res.status(500).json({ success: false, error: 'Failed to process leave request' });
  }
});

// ============ AVAILABILITY MANAGEMENT ROUTES ============

// Update availability
app.post('/api/availability/update', requireAuth, async (req, res) => {
  try {
    const { date, status, notes } = req.body;
    const staffId = req.session.user.id;

    const availabilityUpdate = {
      date: new Date(date),
      status,
      notes
    };

    // Remove existing entry for this date
    await Staff.findByIdAndUpdate(staffId, {
      $pull: { availability: { date: new Date(date) } }
    });

    // Add new entry
    await Staff.findByIdAndUpdate(staffId, {
      $push: { availability: availabilityUpdate }
    });

    res.json({ success: true, message: 'Availability updated' });
  } catch (err) {
    console.error('Availability update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update availability' });
  }
});

// Get availability for current user
app.get('/api/availability', requireAuth, async (req, res) => {
  try {
    const staff = await Staff.findById(req.session.user.id).select('availability').lean();
    res.json(staff?.availability || []);
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Get leave history for current user
app.get('/api/leave-history', requireAuth, async (req, res) => {
  try {
    const staff = await Staff.findById(req.session.user.id).select('leaveHistory').lean();
    res.json(staff?.leaveHistory || []);
  } catch (err) {
    console.error('Error fetching leave history:', err);
    res.status(500).json({ error: 'Failed to fetch leave history' });
  }
});

// ============ AUDIT LOG ROUTES ============

// View audit logs
app.get('/dashboard/audit-logs', requireAuth, requirePermission('canViewAuditLogs'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;
    const actionFilter = req.query.action || '';
    const entityFilter = req.query.entityType || '';
    const search = req.query.search || '';

    const query = {};
    if (actionFilter && actionFilter !== 'all') {
      if (['created', 'updated', 'deleted'].includes(actionFilter)) {
        query.action = { $regex: new RegExp(`${actionFilter}$`, 'i') };
      } else {
        query.action = actionFilter;
      }
    }
    if (entityFilter) {
      query.entityType = entityFilter;
    }
    if (search) {
      query.$or = [
        { entityName: { $regex: search, $options: 'i' } },
        { 'performedBy.userName': { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await AuditLog.find(query)
      .populate('performedBy.userId', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalLogs = await AuditLog.countDocuments(query);
    const totalPages = Math.ceil(totalLogs / limit);

    res.render('dashboard', {
      user: req.session.user,
      page: 'audit-logs',
      auditLogs: logs,
      currentPage: page,
      totalPages,
      auditActionFilter: actionFilter,
      auditEntityFilter: entityFilter,
      auditSearch: search
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// ============ PERFORMANCE MANAGEMENT ROUTES ============

// Update performance metrics
app.post('/api/performance/update', requireAuth, requirePermission('canManageStaff'), async (req, res) => {
  try {
    const { staffId, eventsCompleted, reportsSubmitted, schoolsVisited, averageAttendanceRate, averageFeedbackRating } = req.body;

    const performanceUpdate = {
      eventsCompleted: parseInt(eventsCompleted) || 0,
      reportsSubmitted: parseInt(reportsSubmitted) || 0,
      schoolsVisited: parseInt(schoolsVisited) || 0,
      averageAttendanceRate: parseFloat(averageAttendanceRate) || 0,
      averageFeedbackRating: parseFloat(averageFeedbackRating) || 0,
      lastPerformanceReview: new Date()
    };

    await Staff.findByIdAndUpdate(staffId, {
      performanceMetrics: performanceUpdate
    });

    res.json({ success: true, message: 'Performance metrics updated' });
  } catch (err) {
    console.error('Performance update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update performance metrics' });
  }
});

// ============ PERMISSIONS MANAGEMENT ROUTES ============

// Initialize default permissions
app.post('/api/permissions/init', requireAuth, requirePermission('canManagePermissions'), async (req, res) => {
  try {
    const defaultPermissions = [
      {
        role: 'trainer',
        permissions: {
          canViewStaff: false,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: false,
          canViewEvents: true,
          canCreateEvents: false,
          canEditEvents: false,
          canDeleteEvents: false,
          canScheduleEvents: false,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: false,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: false,
          canGenerateReports: false,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Basic trainer permissions'
      },
      {
        role: 'senior trainer',
        permissions: {
          canViewStaff: true,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: true,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: false,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Senior trainer with additional responsibilities'
      },
      {
        role: 'supervisor',
        permissions: {
          canViewStaff: true,
          canCreateStaff: true,
          canEditStaff: true,
          canDeleteStaff: false,
          canInviteStaff: true,
          canResetPasswords: true,
          canViewSchools: true,
          canCreateSchools: true,
          canEditSchools: true,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: true,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: true,
          canEditPrograms: true,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: true,
          canEditBookings: true,
          canDeleteBookings: true,
          canApproveBookings: true,
          canViewFinancials: true,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: true,
          canManageSystem: false,
          canViewAuditLogs: true,
          canManagePermissions: false
        },
        description: 'Supervisor with management capabilities'
      },
      {
        role: 'admin',
        permissions: {
          canViewStaff: true,
          canCreateStaff: true,
          canEditStaff: true,
          canDeleteStaff: true,
          canInviteStaff: true,
          canResetPasswords: true,
          canViewSchools: true,
          canCreateSchools: true,
          canEditSchools: true,
          canDeleteSchools: true,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: true,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: true,
          canEditPrograms: true,
          canDeletePrograms: true,
          canViewBookings: true,
          canCreateBookings: true,
          canEditBookings: true,
          canDeleteBookings: true,
          canApproveBookings: true,
          canViewFinancials: true,
          canManageBudgets: true,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: true,
          canManageSystem: true,
          canViewAuditLogs: true,
          canManagePermissions: true
        },
        description: 'Full administrative access'
      },
      {
        role: 'coordinator',
        permissions: {
          canViewStaff: true,
          canCreateStaff: false,
          canEditStaff: false,
          canDeleteStaff: false,
          canInviteStaff: false,
          canResetPasswords: false,
          canViewSchools: true,
          canCreateSchools: false,
          canEditSchools: false,
          canDeleteSchools: false,
          canAssignTrainers: true,
          canViewEvents: true,
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: false,
          canScheduleEvents: true,
          canViewPrograms: true,
          canCreatePrograms: false,
          canEditPrograms: false,
          canDeletePrograms: false,
          canViewBookings: true,
          canCreateBookings: false,
          canEditBookings: false,
          canDeleteBookings: false,
          canApproveBookings: true,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Coordinator for scheduling and assignments'
      }
    ];

    for (const perm of defaultPermissions) {
      await Permission.findOneAndUpdate(
        { role: perm.role },
        perm,
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: 'Default permissions initialized' });
  } catch (err) {
    console.error('Permissions init error:', err);
    res.status(500).json({ success: false, error: 'Failed to initialize permissions' });
  }
});

// ============ TRAINER MANAGEMENT ROUTES ============

// Add new trainer
app.post('/dashboard/trainer/add', requireAuth, requirePermission('canCreateStaff'), async (req, res) => {
  try {
    console.log('=== START ADD TRAINER REQUEST ===');
    const { idNumber, name, email, phone, status, password } = req.body;
    console.log('Received body:', { idNumber, name, email, phone, status });

    // Validation
    if (!name || !email || !status) {
      console.log('✗ Missing required fields');
      return res.status(400).json({ success: false, error: 'Name, email, and status are required' });
    }

    // Hash password if provided
    const bcrypt = require('bcryptjs');
    let passwordHash = '';
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
      console.log('Password hashed successfully');
    }

    const trainerData = {
      idNumber: idNumber ? idNumber.trim() : undefined,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      role: 'trainer', // Explicitly set role to 'trainer'
      status: status.trim()
    };

    if (passwordHash) {
      trainerData.password = passwordHash;
    }

    console.log('Creating trainer with data:', { ...trainerData, password: '***' });
    const trainer = new Staff(trainerData);
    await trainer.save();

    console.log('✓ Trainer created successfully:', trainer._id, trainer.name);
    console.log('=== END ADD TRAINER REQUEST ===\n');

    res.json({ 
      success: true, 
      message: 'Trainer added successfully',
      trainer: trainer 
    });
  } catch (err) {
    console.error('✗ Error adding trainer:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END ADD TRAINER REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error adding trainer: ' + err.message });
  }
});

// Update trainer
app.post('/dashboard/trainer/update', requireAuth, requirePermission('canEditStaff'), async (req, res) => {
  try {
    console.log('=== START UPDATE TRAINER REQUEST ===');
    const { trainerId, idNumber, name, email, phone, status } = req.body;
    console.log('Received body:', { trainerId, idNumber, name, email, phone, status });

    // Validation
    if (!trainerId || !name || !email || !status) {
      console.log('✗ Missing required fields (trainerId, name, email, status required)');
      return res.status(400).json({ success: false, error: 'Trainer ID, name, email, and status are required' });
    }

    const updateData = {
      idNumber: idNumber ? idNumber.trim() : undefined,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      status: status.trim()
    };

    console.log('Updating trainer', trainerId, 'with data:', updateData);
    const updatedTrainer = await Staff.findByIdAndUpdate(
      trainerId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTrainer) {
      console.log('✗ Trainer not found');
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    console.log('✓ Trainer updated successfully:', updatedTrainer._id, updatedTrainer.name);
    console.log('=== END UPDATE TRAINER REQUEST ===\n');

    res.json({ 
      success: true, 
      message: 'Trainer updated successfully',
      trainer: updatedTrainer 
    });
  } catch (err) {
    console.error('✗ Error updating trainer:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END UPDATE TRAINER REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error updating trainer: ' + err.message });
  }
});

// Delete trainer
app.post('/dashboard/trainer/delete', requireAuth, requirePermission('canDeleteStaff'), async (req, res) => {
  try {
    console.log('=== START DELETE TRAINER REQUEST ===');
    const { trainerId } = req.body;
    console.log('Trainer ID to delete:', trainerId);

    if (!trainerId) {
      console.log('✗ Trainer ID is required');
      return res.status(400).json({ success: false, error: 'Trainer ID is required' });
    }

    const trainer = await Staff.findByIdAndDelete(trainerId);

    if (!trainer) {
      console.log('✗ Trainer not found');
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    console.log('✓ Trainer deleted successfully:', trainer._id, trainer.name);
    console.log('=== END DELETE TRAINER REQUEST ===\n');

    res.json({ success: true, message: 'Trainer deleted successfully' });
  } catch (err) {
    console.error('✗ Error deleting trainer:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END DELETE TRAINER REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error deleting trainer: ' + err.message });
  }
});

// Get a trainer's details
app.get('/dashboard/trainer/:trainerId/details', requireAuth, async (req, res) => {
  try {
    const { trainerId } = req.params;
    const trainer = await Staff.findById(trainerId).select('idNumber name email phone status role').lean();

    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    res.json({ success: true, trainer });
  } catch (err) {
    console.error('Error fetching trainer details:', err);
    res.status(500).json({ success: false, error: 'Error fetching trainer details' });
  }
});

// Get schools for trainer allocation
app.get('/dashboard/trainer/:trainerId/schools', requireAuth, async (req, res) => {
  try {
    console.log('=== START GET TRAINER SCHOOLS REQUEST ===');
    const { trainerId } = req.params;
    console.log('Trainer ID:', trainerId);

    // Fetch trainer
    const trainer = await Staff.findById(trainerId);
    if (!trainer) {
      console.log('✗ Trainer not found');
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    // Fetch all schools
    const allSchools = await School.find().select('_id name address status assignedStaff').lean();
    console.log('Total schools found:', allSchools.length);

    // Filter schools where trainer is assigned (support both ObjectId and {staffId} formats)
    const trainerObjectId = trainerId.toString();
    const allocatedSchools = allSchools.filter(s => 
      s.assignedStaff && s.assignedStaff.some(a => 
        (typeof a === 'string' && a === trainerObjectId) || 
        (a.staffId && a.staffId.toString() === trainerObjectId)
      )
    );

    console.log('Schools allocated to trainer:', allocatedSchools.length);
    console.log('=== END GET TRAINER SCHOOLS REQUEST ===\n');

    res.json({
      success: true,
      schools: allSchools,
      allocatedSchools: allocatedSchools.map(s => s._id)
    });
  } catch (err) {
    console.error('✗ Error getting schools:', err.message);
    console.log('=== END GET TRAINER SCHOOLS REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error getting schools: ' + err.message });
  }
});

// Allocate schools to trainer
app.post('/dashboard/trainer/allocate-schools', requireAuth, requirePermission('canAssignTrainers'), async (req, res) => {
  try {
    console.log('=== START ALLOCATE SCHOOLS REQUEST ===');
    const { trainerId, schoolIds } = req.body;
    const trainerObjectId = new mongoose.Types.ObjectId(trainerId);
    console.log('Trainer ID:', trainerId);
    console.log('School IDs to allocate:', schoolIds);

    if (!trainerId) {
      console.log('✗ Trainer ID is required');
      return res.status(400).json({ success: false, error: 'Trainer ID is required' });
    }

    // Verify trainer exists
    const trainer = await Staff.findById(trainerId);
    if (!trainer) {
      console.log('✗ Trainer not found');
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    // Validate requested schools against maximum capacity
    const selectedSchoolIds = Array.isArray(schoolIds) ? schoolIds : [];
    const blockedSchools = [];

    for (const schoolId of selectedSchoolIds) {
      const school = await School.findById(schoolId);
      if (!school) continue;

      const assignedStaff = Array.isArray(school.assignedStaff) ? school.assignedStaff : [];
      const hasTrainer = assignedStaff.some(a => a?.staffId?.toString() === trainerId);
      const trainerCount = assignedStaff.length;

      if (!hasTrainer && trainerCount >= 2) {
        const validStaffIds = assignedStaff.map(a => a.staffId).filter(id => id);
        const existingStaff = await Staff.find({ _id: { $in: validStaffIds } }).lean();
        blockedSchools.push({
          schoolId: school._id.toString(),
          schoolName: school.name,
          existingTrainers: existingStaff.map(t => ({ id: t._id.toString(), name: t.name || t.email || 'Unknown' }))
        });
      }
    }

    if (blockedSchools.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'One or more schools already have the maximum of 2 trainers.',
        blockedSchools,
        founderNotification: {
          message: 'Allocation stopped for schools with 2 trainers already assigned.',
          details: blockedSchools
        }
      });
    }

    // Remove trainer from all schools first (both formats)
    const schoolsWithTrainer = await School.find({
      $or: [
        { assignedStaff: trainerObjectId },
        { assignedStaff: { $elemMatch: { staffId: trainerObjectId } } }
      ]
    });

    for (const sch of schoolsWithTrainer) {
      sch.assignedStaff = sch.assignedStaff.filter(a => 
        (typeof a === 'string' && a !== trainerObjectId.toString()) ||
        (a.staffId && !a.staffId.equals(trainerObjectId))
      );
      await sch.save();
    }
    console.log('✓ Removed trainer from all previously allocated schools');

    // Update trainer's assignedSchools: mark previous assignments as transferred
    await Staff.updateMany(
      { 'assignedSchools.schoolId': { $in: schoolsWithTrainer.map(s => s._id) }, _id: trainerObjectId },
      { $set: { 'assignedSchools.$.status': 'transferred' } }
    );
    console.log('✓ Marked previous school assignments as transferred');

    // Add trainer to selected schools
    const allocatedSchoolIds = [];
    for (const schoolId of selectedSchoolIds) {
      const school = await School.findById(schoolId);
      if (!school) continue;

      school.assignedStaff = school.assignedStaff || [];
      const alreadyExists = school.assignedStaff.some(a => 
        a.staffId && a.staffId.toString() === trainerId
      );
      if (!alreadyExists) {
        school.assignedStaff.push({
          staffId: trainerObjectId,
          assignmentType: 'primary',
          assignedDate: new Date(),
          status: 'active'
        });
        await school.save();
        allocatedSchoolIds.push(schoolId.toString());
        console.log('✓ Added trainer to school:', school.name);

        // Add to trainer's assignedSchools
        await Staff.findByIdAndUpdate(trainerObjectId, {
          $push: {
            assignedSchools: {
              schoolId: school._id,
              assignmentType: 'primary',
              assignedDate: new Date(),
              status: 'active'
            }
          }
        });
      }
    }

    console.log('✓ Schools allocated to trainer:', allocatedSchoolIds.length, 'saved.');
    console.log('✓ Schools allocated successfully to trainer:', trainerId, trainer.name);
    console.log('=== END ALLOCATE SCHOOLS REQUEST ===\n');

    res.json({ success: true, message: 'Schools allocated successfully', allocatedSchoolIds });
  } catch (err) {
    console.error('✗ Error allocating schools:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END ALLOCATE SCHOOLS REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error allocating schools: ' + err.message });
  }
});

// ============ ENHANCED SCHOOL MANAGEMENT ROUTES ============

// GET schools list with filters
app.get('/dashboard/schools', requireAuth, requirePermission('canViewSchools'), async (req, res) => {
  try {
    const { status, serviceStatus, zone, region, search, sortBy = 'name', order = 'asc' } = req.query;

    let query = {};
    if (status) query.status = status;
    if (serviceStatus) query.serviceStatus = serviceStatus;
    if (zone) query.zone = { $regex: zone, $options: 'i' };
    if (region) query.region = { $regex: region, $options: 'i' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'contactPerson.name': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }

    let sortObj = {};
    if (sortBy === 'name') sortObj.name = order === 'desc' ? -1 : 1;
    else if (sortBy === 'students') sortObj.studentCount = order === 'desc' ? -1 : 1;
    else if (sortBy === 'events') sortObj['participationMetrics.totalEventsAttended'] = order === 'desc' ? -1 : 1;
    else if (sortBy === 'lastVisit') sortObj.lastVisitDate = order === 'desc' ? -1 : 1;
    else sortObj.createdAt = order === 'desc' ? -1 : 1;

    let schoolList = await School.find(query).sort(sortObj).lean();

    // For trainers, filter to assigned schools
    if (req.session.user.role === 'trainer') {
      schoolList = schoolList.filter(s => s.assignedStaff && s.assignedStaff.some(a => a.staffId && a.staffId.toString() === req.session.user.id));
    }

    // Enrich with participation metrics
    const schoolIds = schoolList.map(s => s._id);
    const schoolEventAggregates = await SchoolEvent.aggregate([
      { $match: { schoolId: { $in: schoolIds } } },
      {
        $group: {
          _id: '$schoolId',
          eventCount: { $sum: 1 },
          totalAttended: { $sum: '$attendance.attended' },
          avgAttendance: { $avg: '$attendance.percentage' }
        }
      }
    ]);
    const eventMap = new Map(schoolEventAggregates.map(a => [a._id.toString(), a]));

    schoolList = schoolList.map(school => ({
      ...school,
      participationMetrics: {
        ...(school.participationMetrics || {}),
        totalEventsAttended: eventMap.get(school._id.toString())?.eventCount || 0,
        averageAttendanceRate: Math.round(eventMap.get(school._id.toString())?.avgAttendance || 0),
        engagementScore: Math.min(100, Math.round(((eventMap.get(school._id.toString())?.eventCount || 0) * 10) + (eventMap.get(school._id.toString())?.avgAttendance || 0)))
      }
    }));

    // Resolve assigned staff names
    const assignedIds = [...new Set(schoolList.flatMap(s => (s.assignedStaff || []).map(a => a?.staffId?.toString()).filter(Boolean)))];
    let trainerMap = new Map();
    if (assignedIds.length > 0) {
      const staffListData = await Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber').lean();
      staffListData.forEach(t => trainerMap.set(t._id.toString(), t));
    }
      schoolList.forEach(school => {
        school.assignedStaff = (school.assignedStaff || []).map(a => {
          const staffId = a?.staffId?.toString();
          return staffId ? trainerMap.get(staffId) : null;
        }).filter(Boolean);
      });

    // Fetch all trainers for onboarding modal
    const staffList = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor', 'coordinator'] } }).select('name email idNumber status role').sort({ name: 1 }).lean();

    res.render('dashboard', {
      user: req.session.user,
      page: 'schools',
      schoolList,
      staffList,
      filters: { status, serviceStatus, zone, region, search },
      sortBy, order
    });
  } catch (err) {
    console.error('Error loading schools page:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// School onboarding wizard submission
app.post('/dashboard/schools/onboard', requireAuth, requirePermission('canCreateSchools'), async (req, res) => {
  try {
    const {
      name, street, city, state, zipCode, country, zone, region,
      contactName, contactEmail, contactPhone, contactPosition,
      studentCount, servicePackage, paymentMethod, billingCycle,
      primaryTrainerId, notes
    } = req.body;

    const trainerObjectId = primaryTrainerId ? new mongoose.Types.ObjectId(primaryTrainerId) : null;

    // Create school with comprehensive onboarding data
    const school = new School({
      name: name.trim(),
      address: {
        street: street?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        zipCode: zipCode?.trim(),
        country: country || 'Kenya'
      },
      zone: zone?.trim(),
      region: region?.trim(),
      contactPerson: {
        name: contactName?.trim(),
        email: contactEmail?.trim().toLowerCase(),
        phone: contactPhone?.trim(),
        position: contactPosition?.trim()
      },
      studentCount: parseInt(studentCount) || 0,
      servicePackage: servicePackage || 'standard',
      paymentTerms: {
        method: paymentMethod || 'bank_transfer',
        billingCycle: billingCycle || 'per_event'
      },
      assignedStaff: trainerObjectId ? [{
        staffId: trainerObjectId,
        assignmentType: 'primary',
        assignedDate: new Date(),
        status: 'active'
      }] : [],
      notes: notes?.trim(),
      onboardingDate: new Date(),
      partnershipDate: new Date(),
      status: 'active',
      serviceStatus: 'active'
    });

    await school.save();

    // Create initial visit log for onboarding
    if (req.session.user.id) {
      const visitLog = new VisitLog({
        schoolId: school._id,
        trainerId: primaryTrainerId || req.session.user.id,
        date: new Date(),
        purpose: 'School onboarding - initial assessment',
        discussed: 'Onboarding completed',
        actionItems: 'Setup complete, first training scheduled'
      });
      await visitLog.save();
    }

    // Audit log
    await logAudit('school_created', 'school', school._id, school.name, { schoolData: school }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, schoolId: school._id, message: 'School onboarded successfully' });
  } catch (err) {
    console.error('Error onboarding school:', err);
    res.status(500).json({ success: false, error: 'Failed to onboard school: ' + err.message });
  }
});

// Individual school profile page
app.get('/dashboard/schools/:schoolId', requireAuth, requirePermission('canViewSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).render('404', { user: req.session.user, error: 'School not found' });
    }

    // Populate assigned staff
    if (school.assignedStaff) {
      const staffIds = school.assignedStaff.map(a => a?.staffId?.toString()).filter(Boolean);
      const staffList = await Staff.find({ _id: { $in: staffIds } }).select('name email idNumber role').lean();
      const staffMap = new Map(staffList.map(s => [s._id.toString(), s]));
      school.assignedStaff = school.assignedStaff.map(a => {
        const staffId = a?.staffId?.toString();
        if (!staffId) return null;
        const staff = staffMap.get(staffId);
        return staff ? { ...staff, assignmentType: a.assignmentType, assignedDate: a.assignedDate } : null;
      }).filter(Boolean);
    }

    // Scout groups
    const scoutGroups = await ScoutGroup.find({ schoolId: schoolId }).sort({ name: 1 }).lean();

    // Event participation history
    const schoolEvents = await SchoolEvent.find({ schoolId: schoolId })
      .populate('eventId', 'name date location status')
      .sort({ 'eventId.date': -1 })
      .lean();

    // Payment history
    const payments = await Payment.find({ schoolId: schoolId }).sort({ paymentDate: -1 }).limit(10).lean();

    // Documents
    const documents = await SchoolDocument.find({ schoolId: schoolId, isActive: true }).sort({ uploadedAt: -1 }).lean();

    // Visit logs
    const visitLogs = await VisitLog.find({ schoolId: schoolId }).sort({ date: -1 }).limit(20).lean();

    // Program enrollments
    const programs = await Program.find({ _id: { $in: school.programsEnrolled || [] } }).lean();

    // Calculate participation analytics
    const totalEvents = schoolEvents.length;
    const totalAttended = schoolEvents.filter(se => se.status === 'attended').length;
    const avgAttendance = schoolEvents.length ? Math.round(schoolEvents.reduce((sum, se) => sum + (se.attendance?.percentage || 0), 0) / schoolEvents.length) : 0;

    res.render('dashboard', {
      user: req.session.user,
      page: 'school-profile',
      school,
      scoutGroups,
      schoolEvents: schoolEvents.map(se => ({ ...se, event: se.eventId })),
      payments,
      documents,
      visitLogs,
      programs,
      participationAnalytics: {
        totalEvents,
        totalAttended,
        avgAttendance,
        lastEventDate: school.participationMetrics?.lastEventDate,
        nextScheduledVisit: school.nextScheduledVisit
      }
    });
  } catch (err) {
    console.error('Error loading school profile:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Error loading school profile' });
  }
});

// API: Record school event participation
app.post('/api/school-events', requireAuth, requirePermission('canCreateEvents'), async (req, res) => {
  try {
    const { schoolId, eventId, participantsCount, primaryContact, assignedStaff, notes } = req.body;

    // Check if already exists
    let schoolEvent = await SchoolEvent.findOne({ schoolId, eventId });
    if (schoolEvent) {
      // Update existing
      schoolEvent.participantsCount = participantsCount;
      schoolEvent.primaryContact = primaryContact;
      schoolEvent.assignedStaff = assignedStaff || [];
      schoolEvent.notes = notes;
      await schoolEvent.save();
    } else {
      schoolEvent = new SchoolEvent({
        schoolId,
        eventId,
        participantsCount,
        primaryContact,
        assignedStaff: assignedStaff || [],
        notes,
        status: 'registered',
        attendance: { registered: participantsCount, attended: 0, percentage: 0 }
      });
      await schoolEvent.save();
    }

    // Update school metrics
    await School.findByIdAndUpdate(schoolId, {
      $inc: { 'participationMetrics.totalEventsAttended': 1 },
      $set: { 'participationMetrics.lastEventDate': new Date() }
    });

    res.json({ success: true, schoolEvent });
  } catch (err) {
    console.error('Error recording school event:', err);
    res.status(500).json({ success: false, error: 'Failed to record participation' });
  }
});

// API: Update school event attendance
app.post('/api/school-events/:id/attendance', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { attended } = req.body;

    const schoolEvent = await SchoolEvent.findByIdAndUpdate(
      id,
      { $set: { 'attendance.attended': attended } },
      { new: true }
    );

    if (!schoolEvent) return res.status(404).json({ success: false, error: 'Record not found' });

    res.json({ success: true, schoolEvent });
  } catch (err) {
    console.error('Error updating attendance:', err);
    res.status(500).json({ success: false, error: 'Failed to update attendance' });
  }
});

// API: Get school payment history
app.get('/api/schools/:schoolId/payments', requireAuth, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { status, startDate, endDate } = req.query;

    let query = { schoolId };
    if (status) query.status = status;
    if (startDate) query.paymentDate = { ...query.paymentDate, $gte: new Date(startDate) };
    if (endDate) query.paymentDate = { ...query.paymentDate, $lte: new Date(endDate) };

    const payments = await Payment.find(query).sort({ paymentDate: -1 }).lean();
    const summary = await Payment.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$amountPaid' },
          totalOutstanding: { $sum: '$balance' },
          overdueCount: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'pending'] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      payments,
      summary: summary[0] || { totalAmount: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0 }
    });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
});

// API: Create/update payment record
app.post('/api/payments', requireAuth, requirePermission('canViewFinancials'), async (req, res) => {
  try {
    const {
      schoolId, invoiceNumber, amount, currency, paymentDate, dueDate,
      method, reference, programBooked, eventBooked, status, amountPaid, notes
    } = req.body;

    const payment = new Payment({
      schoolId,
      invoiceNumber,
      amount: parseFloat(amount),
      currency: currency || 'KES',
      paymentDate: new Date(paymentDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      method,
      reference,
      programBooked,
      eventBooked,
      status,
      amountPaid: parseFloat(amountPaid) || 0,
      recordedBy: req.session.user.id,
      notes
    });

    await payment.save();
    res.json({ success: true, payment });
  } catch (err) {
    console.error('Error saving payment:', err);
    res.status(500).json({ success: false, error: 'Failed to save payment' });
  }
});

// API: Upload document for school
app.post('/api/documents', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId, documentType, name, description, url, fileSize, mimeType, expiryDate } = req.body;

    const doc = new SchoolDocument({
      schoolId,
      documentType,
      name,
      description,
      url,
      fileSize,
      mimeType,
      expiryDate,
      uploadedBy: req.session.user.id
    });

    await doc.save();
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
});

// API: Get school documents
app.get('/api/schools/:schoolId/documents', requireAuth, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { documentType } = req.query;

    const query = { schoolId, isActive: true };
    if (documentType) query.documentType = documentType;

    const documents = await SchoolDocument.find(query).sort({ uploadedAt: -1 }).lean();
    res.json({ documents });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});

// API: School analytics dashboard data
app.get('/api/schools/analytics', requireAuth, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const { timeRange = '6m' } = req.query;
    let dateFilter = {};
    if (timeRange === '3m') dateFilter.createdAt = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
    else if (timeRange === '6m') dateFilter.createdAt = { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) };
    else if (timeRange === '1y') dateFilter.createdAt = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };

    // Total schools count
    const totalSchools = await School.countDocuments();

    // Schools by status
    const byStatus = await School.aggregate([
      { $match: dateFilter.createdAt ? {} : {} },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Schools by service status
    const byServiceStatus = await School.aggregate([
      { $group: { _id: '$serviceStatus', count: { $sum: 1 } } }
    ]);

    // Top schools by engagement (most events)
    const topEngaged = await SchoolEvent.aggregate([
      { $group: { _id: '$schoolId', eventCount: { $sum: 1 } } },
      { $sort: { eventCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'schools',
          localField: '_id',
          foreignField: '_id',
          as: 'schoolInfo'
        }
      },
      { $unwind: '$schoolInfo' },
      { $project: { schoolName: '$schoolInfo.name', eventCount: 1, _id: 0 } }
    ]);

    // Inactive schools (no visit in 90+ days)
    const inactiveThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const inactiveSchools = await School.find({
      $or: [
        { lastVisitDate: { $lt: inactiveThreshold } },
        { lastVisitDate: null }
      ]
    }).select('name lastVisitDate').lean();

    // Region breakdown
    const byRegion = await School.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } }
    ]);

    // Onboarding trends (last 6 months)
    const onboardingTrends = await School.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$onboardingDate' },
            month: { $month: '$onboardingDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json({
      totalSchools,
      byStatus,
      byServiceStatus,
      topEngaged,
      inactiveSchools: inactiveSchools.length,
      inactiveDetails: inactiveSchools.slice(0, 10),
      byRegion,
      onboardingTrends
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

app.post('/dashboard/events/add', requireAuth, async (req, res) => {
  try {
    const { name, date, location, team, registeredCount, status } = req.body;
    const event = new Event({
      name,
      date: date ? new Date(date) : new Date(),
      location,
      team,
      registeredCount: parseInt(registeredCount, 10) || 0,
      status: status || 'Planning'
    });
    await event.save();
    res.redirect('/dashboard/events');
  } catch (err) {
    console.error('Error saving event:', err);
    res.redirect('/dashboard/events');
  }
});

app.post('/dashboard/programs/add', requireAuth, async (req, res) => {
  try {
    const { name, description, category, ageMin, ageMax, duration, maxParticipants, priceAmount, priceCurrency, status } = req.body;
    const program = new Program({
      name,
      description,
      category,
      ageGroup: { min: parseInt(ageMin, 10) || 8, max: parseInt(ageMax, 10) || 16 },
      duration,
      maxParticipants: parseInt(maxParticipants, 10) || 10,
      price: { amount: parseFloat(priceAmount) || 0, currency: priceCurrency || 'USD' },
      status: status || 'active'
    });
    await program.save();
    res.redirect('/dashboard/programs');
  } catch (err) {
    console.error('Error saving program:', err);
    res.redirect('/dashboard/programs');
  }
});

// API routes for trainer actions
app.post('/api/visit-logs', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'trainer') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const { schoolId, date, purpose, metWith, discussed, actionItems } = req.body;
    const visitLog = new VisitLog({
      schoolId,
      trainerId: req.session.user.id,
      date: new Date(date),
      purpose,
      metWith,
      discussed,
      actionItems
    });
    await visitLog.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving visit log:', err);
    res.status(500).json({ error: 'Failed to save visit log' });
  }
});

app.post('/api/feedback', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'trainer') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const { schoolId, engagementLevel, concerns, suggestions } = req.body;
    const feedback = new Feedback({
      schoolId,
      trainerId: req.session.user.id,
      engagementLevel,
      concerns,
      suggestions
    });
    await feedback.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving feedback:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

app.get('/api/schools/:schoolId/scout-groups', requireAuth, async (req, res) => {
  try {
    const school = await School.findById(req.params.schoolId).select('scoutGroups').lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json({ groups: school.scoutGroups || [] });
  } catch (err) {
    console.error('Error fetching scout groups:', err);
    res.status(500).json({ error: 'Failed to fetch scout groups' });
  }
});

app.get('/api/schools/:schoolId/visit-logs', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'trainer') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const logs = await VisitLog.find({
      schoolId: req.params.schoolId,
      trainerId: req.session.user.id
    }).sort({ date: -1 }).lean();
    res.json({ logs });
  } catch (err) {
    console.error('Error fetching visit logs:', err);
    res.status(500).json({ error: 'Failed to fetch visit logs' });
  }
});

app.get('/dashboard/:page', requireAuth, async (req, res) => {
  try {
    const page = req.params.page;
    const allowedPages = ['staff', 'schools', 'events', 'programs', 'analytics', 'settings', 'trainers', 'schedule', 'health', 'audit-logs', 'permissions'];

    if (req.session.user && req.session.user.role === 'trainer') {
      return res.redirect('/trainer/dashboard');
    }

    if (!allowedPages.includes(page)) {
      return res.status(404).render('404', { user: req.session.user });
    }

    const modelData = {
      staffList: [],
      trainersList: [],
      schoolList: [],
      eventList: [],
      programList: []
    };

    if (page === 'staff') {
      modelData.staffList = await Staff.find().sort({ createdAt: -1 }).lean();

      // Calculate stats for staff dashboard
      const statsAggregation = await Staff.aggregate([
        {
          $group: {
            _id: null,
            totalStaff: { $sum: 1 },
            activeStaff: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Active'] }, 1, 0]
              }
            },
            onLeaveStaff: {
              $sum: {
                $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0]
              }
            },
            avgAttendance: {
              $avg: '$performanceMetrics.averageAttendanceRate'
            }
          }
        }
      ]);

      modelData.stats = statsAggregation[0] || {
        totalStaff: 0,
        activeStaff: 0,
        onLeaveStaff: 0,
        avgAttendance: 0
      };
    }

    if (page === 'trainers') {
      // Fetch all staff members with role 'trainer'
      modelData.trainersList = await Staff.find({ role: 'trainer' }).sort({ createdAt: -1 }).lean();
      console.log('=== TRAINERS PAGE FETCH ===');
      console.log('Found trainers:', modelData.trainersList.length);
    }

    if (page === 'permissions') {
      modelData.permissionsList = await Permission.find().sort({ role: 1 }).lean();
    }

     if (page === 'schools') {
       modelData.schoolList = await School.find().sort({ createdAt: -1 }).lean();
       const assignedIds = [...new Set((modelData.schoolList || []).flatMap(school => (school.assignedStaff || []).map(a => a?.staffId?.toString()).filter(Boolean)))];
       let trainerMap = new Map();
       if (assignedIds.length > 0) {
         const [staffList, userList] = await Promise.all([
           Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber status').lean(),
           User.find({ _id: { $in: assignedIds } }).select('name email role').lean()
         ]);
         staffList.forEach(t => trainerMap.set(t._id.toString(), { ...t, __entity: 'staff' }));
         userList.forEach(u => trainerMap.set(u._id.toString(), { ...u, __entity: 'user' }));
       }
       modelData.schoolList.forEach(school => {
         school.assignedStaff = (school.assignedStaff || []).map(a => {
           const staffId = a?.staffId?.toString();
           return staffId ? trainerMap.get(staffId) : null;
         }).filter(Boolean);
       });
       // Also fetch all active trainers for onboarding
       modelData.staffList = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor', 'coordinator'] } }).select('name email idNumber status role').sort({ name: 1 }).lean();
     }

    if (page === 'events') {
      modelData.eventList = await Event.find().sort({ date: 1 }).lean();
    }

    if (page === 'programs') {
      modelData.programList = await Program.find().sort({ updatedAt: -1 }).lean();
    }

    res.render('dashboard', {
      user: req.session.user,
      page: page,
      ...modelData
    });
  } catch (err) {
    console.error('Error loading dashboard page data:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

app.get('/api/dashboard-data', requireAuth, async (req, res) => {
  try {
    const totalSchools = await School.countDocuments();
    const activeStudentsData = await School.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$studentCount', 0] } } } }
    ]);
    const activeStudents = activeStudentsData[0]?.total || 0;
    const upcomingEvents = await Event.countDocuments({ date: { $gte: new Date() } });
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newSchoolsLast30Days = await School.countDocuments({ createdAt: { $gte: last30Days } });
    const growthRate = totalSchools > 0 ? Math.round((newSchoolsLast30Days / totalSchools) * 100) : 0;

    const recentAuditLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(3).lean();
    const recentActivities = recentAuditLogs.map(log => ({
      title: log.entityName ? `${log.entityName} ${log.action.replace(/_/g, ' ')}` : log.action.replace(/_/g, ' '),
      description: `Performed by ${log.performedBy?.userName || log.performedBy?.userEmail || 'System'}`,
      time: new Date(log.timestamp).toLocaleString()
    }));

    res.json({
      totalSchools,
      activeStudents,
      upcomingEvents,
      growthRate,
      recentActivities: recentActivities.length ? recentActivities : [
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
    });
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    res.json({
      totalSchools: 0,
      activeStudents: 0,
      upcomingEvents: 0,
      growthRate: 0,
      recentActivities: []
    });
  }
});

// Middleware to check for founder role
function requireFounder(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'founder') return next();
  return res.status(403).send('Forbidden: founder role required');
}

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user });
});

// Start server
const startServer = async () => {
  try {
    await initializePermissions();

    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${PORT}`);
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
    });

    server.on('listening', () => {
      console.log('Server is now listening on port', PORT);
      console.log('Connected to MongoDB');
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

startServer();
