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
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
// Note: express.json() is applied per-route below to avoid breaking
// GET requests (e.g. /api/schools/active) that receive
// Content-Type: application/json from Angular HttpClient but carry no body.
const parseJson = express.json();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'messages');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Multer for logo image uploads
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'logos');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for logos
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Multer for document uploads
const docStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'documents');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'doc-' + uniqueSuffix + ext);
  }
});

const uploadDocument = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'apv-ventures-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in prod with HTTPS
    httpOnly: true,
    sameSite: 'strict',
    maxAge: process.env.SESSION_MAX_AGE ? parseInt(process.env.SESSION_MAX_AGE) : 7 * 24 * 60 * 60 * 1000 // 7 days default
  }
};

// Use MongoDB session store in production, default MemoryStore for dev
if (process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
  const MongoStore = require('connect-mongo');
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days (matches cookie maxAge)
    autoRemove: 'native' // Let MongoDB handle expiration
  });
  console.log('Using MongoDB session store');
} else {
  console.log('Using in-memory session store (development only)');
}

app.use(session(sessionConfig));

// Security headers
app.use(helmet());

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Generate CSP nonce for production (for inline scripts/styles)
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Content Security Policy
app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || 3001;
  const origin = `http://127.0.0.1:${port}`;
  const localhost = `http://localhost:${port}`;
  let csp;
  if (isProduction) {
    const nonce = res.locals.cspNonce || '';
    csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; img-src 'self' data:; connect-src 'self'; font-src 'self';`;
   } else {
      csp = `default-src 'self' 'unsafe-inline' 'unsafe-eval' ${origin} ${localhost}; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${origin} ${localhost}; font-src 'self';`;
    }
  res.setHeader('Content-Security-Policy', csp);
  next();
});

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
const Payment = require('./models/Payment');
const SchoolDocument = require('./models/SchoolDocument');
const ReportTemplate = require('./models/ReportTemplate');
const ScheduledReport = require('./models/ScheduledReport');
const Student = require('./models/Student');
const SystemSettings = require('./models/SystemSettings');

// Communication models
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const NotificationPreference = require('./models/NotificationPreference');
const Announcement = require('./models/Announcement');
const EmailLog = require('./models/EmailLog');

// Finance models
const Invoice = require('./models/Invoice');
const invoiceService = require('./backend/services/invoiceService');
const Expense = require('./models/Expense');
const Budget = require('./models/Budget');
const Payroll = require('./models/Payroll');
const ServicePackage = require('./models/ServicePackage');

// Email service (enhanced)
const emailService = require('./backend/services/emailService');

// Import controllers
const analyticsController = require('./backend/controllers/analyticsController');
const reportsController = require('./backend/controllers/reportsController');
const exportController = require('./backend/controllers/exportController');
const settingsController = require('./backend/controllers/settingsController');

// Import and start report scheduler
const reportScheduler = require('./backend/services/reportScheduler');

// Import the new notification scheduler
const notificationScheduler = require('./backend/services/notificationScheduler');

// MongoDB connection
if (process.env.MONGODB_URI) {
  // Connect without deprecated options; mongoose v6+ uses sensible defaults
  mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Start schedulers
    reportScheduler.start();
    notificationScheduler.start();
    // Initialize default system settings and holidays
    initializeSystemSettings();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.log('Make sure MongoDB is running on localhost:27017');
  });
} else {
  console.log('No MONGODB_URI provided in .env file');
}

// Import portable auth middleware
const { requireAuth, requirePermission } = require('./backend/middleware/auth');

// Middleware functions
// School Admin authentication & authorization middleware
const requireSchoolAdmin = async (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }

  try {
    // Check if user has school_admin role
    if (req.session.user.role !== 'school_admin') {
      return res.status(403).render('404', {
        user: req.session.user,
        error: 'Access denied. School admin privileges required.'
      });
    }

    // Fetch Staff record with school linkage
    const staff = await Staff.findOne({ email: req.session.user.email.toLowerCase() })
      .select('_id name email role schoolId')
      .lean();

    if (!staff || staff.role !== 'school_admin') {
      return res.status(403).render('404', {
        user: req.session.user,
        error: 'School admin profile not found or inactive.'
      });
    }

    if (!staff.schoolId) {
      return res.status(403).render('404', {
        user: req.session.user,
        error: 'School admin not assigned to a school. Please contact founder.'
      });
    }

    // Validate schoolId format before querying
    if (!mongoose.Types.ObjectId.isValid(staff.schoolId)) {
      return res.status(403).render('404', {
        user: req.session.user,
        error: 'Invalid school identifier assigned. Please contact founder.'
      });
    }

    // Attach staff info to request
    req.staff = staff;
    req.schoolId = staff.schoolId;

    // Fetch full school document (all fields needed by views)
    const school = await School.findById(staff.schoolId).lean();
    if (!school) {
      return res.status(403).render('404', {
        user: req.session.user,
        error: 'Associated school not found. Please contact founder.'
      });
    }

    if (school.status !== 'active') {
      return res.status(403).render('404', {
        user: req.session.user,
        error: 'School account is inactive. Please contact founder.'
      });
    }

    req.school = school;
    next();
  } catch (err) {
    console.error('School admin auth error:', err);
    res.status(500).render('404', {
      user: req.session.user,
      error: 'Authentication error. Please try again.'
    });
  }
};

// School data isolation filter (for queries)
const schoolFilter = (req, res, next) => {
  if (req.query && req.query.schoolId) {
    // Ensure school admin can only access their own school
    if (req.session.user.role === 'school_admin') {
      if (req.query.schoolId.toString() !== req.schoolId.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied to this school data' });
      }
    }
  }
  next();
};

// School Edit Access middleware: allows school_admin (own school) OR users with canEditSchools permission
const requireSchoolEditAccess = async (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }

  try {
    const { schoolId } = req.params;

    // Validate schoolId format
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).json({ success: false, error: 'Invalid school identifier' });
    }

    // Case 1: User is school_admin - can only edit their own school
    if (req.session.user.role === 'school_admin') {
      const staff = await Staff.findOne({ email: req.session.user.email.toLowerCase() })
        .select('_id name email role schoolId')
        .lean();

      if (!staff || staff.role !== 'school_admin' || !staff.schoolId) {
        return res.status(403).json({ success: false, error: 'School admin profile not found or not assigned to a school.' });
      }

      if (staff.schoolId.toString() !== schoolId) {
        return res.status(403).json({ success: false, error: 'Access denied. School admins can only edit their own school.' });
      }

      const school = await School.findById(schoolId).select('name status serviceStatus').lean();
      if (!school || school.status !== 'active') {
        return res.status(403).json({ success: false, error: 'School not found or inactive.' });
      }

      req.staff = staff;
      req.schoolId = staff.schoolId;
      req.school = school;
      return next();
    }

    // Case 2: User has canEditSchools permission (admin/founder/etc)
    const permissions = await Permission.findOne({ role: req.session.user.role });
    if (!permissions || !permissions.permissions?.canEditSchools) {
      return res.status(403).json({ success: false, error: 'Access denied. Insufficient permissions.' });
    }

    // Load staff record for audit logging (create if missing for admin/founder)
    let staff = await Staff.findOne({ email: req.session.user.email.toLowerCase() });
    if (!staff) {
      const user = await User.findOne({ email: req.session.user.email.toLowerCase() });
      if (user) {
        staff = new Staff({
          name: user.name,
          email: user.email,
          role: user.role === 'founder' ? 'admin' : user.role,
          status: 'Active',
          department: 'Administration',
          employmentStartDate: new Date(),
          permissions: {
            canViewFinancials: true,
            canApproveReports: true,
            canScheduleEvents: true,
            canManageStaff: true,
            canViewAnalytics: true,
            canManageSchools: true,
            canSendInvitations: true
          }
        });
        await staff.save();
      }
    }

    if (staff) {
      req.staff = staff.toObject ? staff.toObject() : staff;
    } else {
      // Fallback staff object for audit
      req.staff = {
        _id: null,
        name: req.session.user.name,
        email: req.session.user.email,
        role: req.session.user.role
      };
    }

    // Verify school exists
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }
    req.schoolId = schoolId;
    req.school = school.toObject ? school.toObject() : school;
    next();
  } catch (err) {
    console.error('School edit access error:', err);
    res.status(500).json({ success: false, error: 'Authentication error. Please try again.' });
  }
};

// Helper: Get Staff document from session (converts User session to Staff)
async function getCurrentStaff(req) {
  if (!req.session.user) return null;
  
  let staff = await Staff.findOne({ email: req.session.user.email.toLowerCase() });
  
  // Auto-create Staff profile for admin/founder roles if missing
  if (!staff && ['admin', 'founder', 'commissioner', 'supervisor', 'training_officer', 'medical', 'coordinator'].includes(req.session.user.role)) {
    const user = await User.findOne({ email: req.session.user.email.toLowerCase() });
    if (user) {
      const staffRole = user.role === 'founder' ? 'admin' : user.role;
      const isAdminRole = ['admin', 'founder'].includes(user.role);
      
      staff = new Staff({
        name: user.name,
        email: user.email,
        role: staffRole,
        status: 'Active',
        department: 'Administration',
        employmentStartDate: new Date(),
        permissions: isAdminRole ? {
          canViewFinancials: true,
          canApproveReports: true,
          canScheduleEvents: true,
          canManageStaff: true,
          canViewAnalytics: true,
          canManageSchools: true,
          canSendInvitations: true
        } : {}
      });
      await staff.save();
      console.log(`[getCurrentStaff] Created Staff profile for ${user.email} (role: ${staff.role})`);
    }
  }
  
  return staff;
}

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

// Event status lifecycle validation
const validStatusTransitions = {
  'draft': ['scheduled', 'confirmed', 'cancelled', 'archived'],
  'scheduled': ['confirmed', 'in_progress', 'cancelled', 'archived'],
  'confirmed': ['in_progress', 'cancelled', 'archived'],
  'in_progress': ['completed', 'cancelled', 'archived'],
  'completed': ['reviewed', 'archived'],
  'reviewed': ['archived'],
  'cancelled': ['draft', 'scheduled'], // allow recovery
  'archived': [] // terminal state
};

function validateEventStatusTransition(oldStatus, newStatus) {
  if (!oldStatus || !newStatus) return null; // Skip validation if we don't have both
  const allowed = validStatusTransitions[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    return `Invalid status transition: ${oldStatus} → ${newStatus}. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}

// Initialize default SystemSettings and Kenya public holidays
async function initializeSystemSettings() {
  try {
    let settings = await SystemSettings.findOne({ _id: 'global-settings' });
    if (!settings) {
      settings = new SystemSettings({
        _id: 'global-settings',
        type: 'combined',
        organization: {
          organizationName: 'Arrow-Park Ventures',
          tagline: 'Empowering Youth Through Scouting',
          logoUrl: '/images/logo.png',
          primaryColor: '#0066cc',
          country: 'Kenya'
        },
        system: {
          reportSubmissionDeadlineDays: 3,
          paymentTermsDays: 30,
          overdueThresholdDays: 7,
          eventReminderDays: 2,
          autoArchiveMonths: 12,
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          workingHours: { start: '08:00', end: '17:00' }
        },
        backup: {
          enabled: true,
          frequency: 'daily',
          time: '02:00',
          retentionDays: 30,
          cloudProvider: 'local',
          status: 'active'
        },
        publicHolidays: getDefaultKenyaHolidays()
      });
      await settings.save();
      console.log('Default system settings created with Kenya holidays');
    } else {
      // Ensure holidays are populated if missing
      if (!settings.publicHolidays || settings.publicHolidays.length === 0) {
        settings.publicHolidays = getDefaultKenyaHolidays();
        await settings.save();
        console.log('Kenya holidays added to settings');
      }
    }
  } catch (err) {
    console.error('Error initializing system settings:', err);
  }
}

// Default Kenya public holidays (non-exhaustive, can be customized)
function getDefaultKenyaHolidays() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1]; // current and next year
  const holidays = [];

  const kenyaHolidays = [
    { name: 'New Year\'s Day', month: 0, day: 1 }, // Jan 1
    { name: 'Good Friday', month: null, day: null, easter: true, offset: -2 }, // Easter calculation
    { name: 'Easter Monday', month: null, day: null, easter: true, offset: 1 },
    { name: 'Labour Day', month: 4, day: 1 }, // May 1
    { name: 'Madaraka Day', month: 5, day: 1 }, // Jun 1 (actually June 1)
    { name: 'Madaraka Day (Observed)', month: 5, day: 2 }, // sometimes moved
    { name: 'Huduma Day', month: 9, day: 20 }, // Oct 20 (formerly Moi Day)
    { name: 'Mashujaa Day', month: 10, day: 20 }, // Oct 20? Actually Mashujaa Day is Oct 20
    { name: 'Jamhuri Day', month: 11, day: 12 }, // Dec 12
    { name: 'Christmas Day', month: 11, day: 25 },
    { name: 'Boxing Day', month: 11, day: 26 }
  ];

  // Actually better to use proper known dates
  // Let's define a clearer set for Kenya:
  const fixedHolidays = [
    { name: "New Year's Day", month: 0, day: 1 },
    { name: 'Labour Day', month: 4, day: 1 },
    { name: 'Madaraka Day', month: 5, day: 1 },
    { name: 'Huduma Day', month: 9, day: 20 },
    { name: 'Mashujaa Day', month: 10, day: 20 },
    { name: 'Jamhuri Day', month: 11, day: 12 },
    { name: 'Christmas Day', month: 11, day: 25 },
    { name: 'Boxing Day', month: 11, day: 26 }
  ];

  // Easter-based: compute for each year
  function getEasterSunday(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  }

  years.forEach(year => {
    // Fixed holidays
    fixedHolidays.forEach(h => {
      const d = new Date(year, h.month, h.day);
      holidays.push({
        date: d,
        name: h.name,
        year: year,
        isRecurring: true
      });
    });
    // Good Friday and Easter Monday
    const easter = getEasterSunday(year);
    holidays.push({
      date: new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2),
      name: 'Good Friday',
      year: year,
      isRecurring: true
    });
    holidays.push({
      date: new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1),
      name: 'Easter Monday',
      year: year,
      isRecurring: true
    });
  });

  return holidays;
}

// Rate limiting for critical authentication and staff management routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

const staffAddLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per hour
  message: 'Too many staff additions, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

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
  res.render('login', {
    user: req.session.user,
    next: req.query.next || '',
    portal: req.query.portal || '',
    showDemo: process.env.NODE_ENV !== 'production'
  });
});

async function loginUserByCredentials(email, password) {
  const normalizedEmail = email?.toLowerCase?.() || '';
  const user = await User.findOne({ email: normalizedEmail });
  const bcrypt = require('bcryptjs');
  const isUserValid = user && await bcrypt.compare(password, user.password);

  // Trainer fallback using default password 0000
  const trainerFallback = await Staff.findOne({ email: normalizedEmail, role: 'trainer' });
  if (trainerFallback && password === '0000' && !isUserValid) {
    return {
      type: 'trainer',
      profile: trainerFallback,
      session: {
        id: trainerFallback._id.toString(),
        email: trainerFallback.email,
        role: 'trainer',
        name: trainerFallback.name || 'Trainer'
      },
      redirect: '/trainer/dashboard'
    };
  }

  // School admin fallback using default password 0000
  let schoolFallback = await Staff.findOne({ email: normalizedEmail, role: 'school_admin' });
  if (!schoolFallback && password === '0000') {
    const school = await School.findOne({ 'contactPerson.email': normalizedEmail, status: 'active' });
    if (school) {
      schoolFallback = await Staff.findOneAndUpdate(
        { email: normalizedEmail },
        {
          $set: {
            name: school.contactPerson?.name || school.name || 'School Admin',
            email: normalizedEmail,
            role: 'school_admin',
            status: 'Active',
            department: 'Administration',
            phone: school.contactPerson?.phone || '',
            schoolId: school._id,
            permissions: {
              canManageOwnSchool: true,
              canManageScouts: true,
              canViewEvents: true,
              canOwnViewPayments: true,
              canManageDocuments: true,
              canSendMessages: true,
              canViewMessages: true
            }
          }
        },
        { new: true, upsert: true }
      );
    }
  }

  if (schoolFallback && password === '0000' && !isUserValid) {
    return {
      type: 'school_admin',
      profile: schoolFallback,
      session: {
        id: schoolFallback._id.toString(),
        email: schoolFallback.email,
        role: 'school_admin',
        name: schoolFallback.name || 'School Admin'
      },
      redirect: '/school/dashboard'
    };
  }

  if (!isUserValid) {
    return { type: 'invalid' };
  }

  // Update last login for standard users
  user.lastLogin = new Date();
  await user.save();

  // Ensure Staff record exists for admin/founder roles
  if (['admin', 'founder', 'commissioner', 'supervisor', 'training_officer', 'medical', 'coordinator'].includes(user.role)) {
    let staff = await Staff.findOne({ email: user.email.toLowerCase() });
    if (!staff) {
      const staffRole = user.role === 'founder' ? 'admin' : user.role;
      const isAdminRole = ['admin', 'founder'].includes(user.role);
      staff = new Staff({
        name: user.name,
        email: user.email,
        role: staffRole,
        status: 'Active',
        department: 'Administration',
        employmentStartDate: new Date(),
        permissions: isAdminRole ? {
          canViewFinancials: true,
          canApproveReports: true,
          canScheduleEvents: true,
          canManageStaff: true,
          canViewAnalytics: true,
          canManageSchools: true,
          canSendInvitations: true
        } : {}
      });
      await staff.save();
      console.log(`[Login] Created Staff profile for ${user.email} (role: ${staff.role})`);
    } else if (user.role === 'founder' && staff.role !== 'admin') {
      staff.role = 'admin';
      await staff.save();
      console.log(`[Login] Updated founder Staff role to admin: ${user.email}`);
    }
  }

  return {
    type: 'user',
    profile: user,
    session: {
      id: user._id.toString(),
      email: user.email,
      role: user.role || 'rover',
      name: user.name || 'Member'
    },
    redirect: (user.role === 'trainer' ? '/trainer/dashboard' : '/dashboard')
  };
}

app.post('/login', authLimiter, parseJson, async (req, res) => {
  const { email, password } = req.body;

  try {
    const loginResult = await loginUserByCredentials(email, password);
    if (loginResult.type === 'invalid') {
      return res.render('login', { error: 'Invalid credentials', user: req.session.user, next: req.body.next || req.query.next || '', portal: '' });
    }

    req.session.regenerate(err => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.render('login', { error: 'Login failed', user: null, next: req.body.next || req.query.next || '', portal: '' });
      }
      req.session.user = loginResult.session;
      const nextUrl = req.body.next || req.query.next || loginResult.redirect;
      return res.redirect(nextUrl);
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.render('login', { error: 'Internal error', user: null, next: req.body.next || req.query.next || '', portal: '' });
  }
});

app.get('/school', (req, res) => {
  if (req.session.user && req.session.user.role === 'school_admin') {
    return res.redirect('/school/dashboard');
  }
  res.render('login', {
    user: req.session.user,
    next: '/school/dashboard',
    portal: 'school'
  });
});

app.post('/school', parseJson, async (req, res) => {
  const { email, password } = req.body;

  try {
    const loginResult = await loginUserByCredentials(email, password);
    if (loginResult.type === 'invalid') {
      return res.render('login', { error: 'Invalid credentials', user: req.session.user, portal: 'school' });
    }

    if (loginResult.type !== 'school_admin') {
      return res.render('login', { error: 'Please use a school admin account for the school portal', user: req.session.user, portal: 'school' });
    }

    req.session.regenerate(err => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.render('login', { error: 'Login failed', user: null, portal: 'school' });
      }
      req.session.user = loginResult.session;
      return res.redirect('/school/dashboard');
    });
  } catch (err) {
    console.error('School portal login error:', err);
    return res.render('login', { error: 'Internal error', user: null, portal: 'school' });
  }
});

app.get('/logout', (req, res) => {
  // Destroy session completely
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
    }
    // Clear cookie on client
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.redirect('/');
  });
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

app.post('/contact', parseJson, (req, res) => {
  // In a production app, you would save this to a database or send an email
  const { name, email, subject, message } = req.body;
  console.log(`Contact form submission: ${name} (${email}) - ${subject}`);
  // For now, redirect to index with a success message in the session
  req.session.contactMessage = `Thank you ${name}, we received your message and will get back to you soon!`;
  res.redirect('/#contact');
});

app.get('/dashboard', requireAuth, async (req, res) => {
  // Redirect trainers to their dedicated dashboard
  if (req.session.user && req.session.user.role === 'trainer') {
    return res.redirect('/trainer/dashboard');
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Fetch all dashboard metrics in parallel
    const [
      totalSchools,
      activeSchools,
      newSchoolsThisMonth,
      activeServiceSchools,
      totalStudents,
      eventsThisMonth,
      revenueCollected,
      outstandingPayments,
      staffList,
      allPrograms,
      staffStatsResult
    ] = await Promise.all([
      // Total schools
      School.countDocuments(),
      // Active schools (serviceStatus = active; fallback to status for legacy schools without serviceStatus)
      School.countDocuments({ $or: [{ serviceStatus: 'active' }, { serviceStatus: { $exists: false }, status: 'active' }] }),
      // New schools this month
      School.countDocuments({
        createdAt: { $gte: startOfMonth }
      }),
      // Schools with active service status
      School.countDocuments({ serviceStatus: 'active' }),
      // Total active students
      Student.countDocuments({ status: 'active' }),
      // Events this month
      Event.countDocuments({
        startDate: { $gte: startOfMonth, $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0) }
      }),
      // Revenue collected this year (sum of paid invoices)
      Invoice.aggregate([
        {
          $match: {
            status: 'paid',
            paidDate: { $gte: startOfYear }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]),
      // Outstanding payments (issued, sent, partial, overdue)
      Invoice.aggregate([
        {
          $match: {
            status: { $in: ['issued', 'sent', 'partial', 'overdue'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$balance' }
          }
        }
      ]),
      // Staff list for compose dropdown (active staff only)
      Staff.find({ status: 'Active' })
        .select('_id name email role')
        .sort({ name: 1 })
        .lean(),
      // All active programs for onboarding
      Program.find({ status: 'active' })
        .select('_id name price duration')
        .sort({ name: 1 })
        .lean(),
      // Staff stats for dashboard widgets
      Staff.aggregate([
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
            avgAttendance: { $avg: '$performanceMetrics.averageAttendanceRate' }
          }
        }
      ])
    ]);

    // Extract values from aggregations
    const totalRevenue = revenueCollected[0]?.total || 0;
    const totalOutstanding = outstandingPayments[0]?.total || 0;
    const staffStats = staffStatsResult[0] || { totalStaff: 0, activeStaff: 0, onLeaveStaff: 0, avgAttendance: 0 };

     res.render('dashboard', {
       user: req.session.user,
       page: 'dashboard',
       stats: {
         totalSchools,
         activeSchools,
         newSchoolsThisMonth,
         totalStudents,
         eventsThisMonth,
         revenueCollected: totalRevenue,
         outstandingPayments: totalOutstanding,
         activeServiceSchools,
         totalStaff: staffStats.totalStaff,
         activeStaff: staffStats.activeStaff,
         onLeaveStaff: staffStats.onLeaveStaff,
         avgAttendance: Math.round(staffStats.avgAttendance || 0)
       },
       staffList,
       allPrograms
     });

   } catch (err) {
     console.error('Dashboard error:', err);
     // Render with empty data on error
     res.render('dashboard', {
       user: req.session.user,
       page: 'dashboard',
       stats: {
         totalSchools: 0,
         activeSchools: 0,
         newSchoolsThisMonth: 0,
         totalStudents: 0,
         eventsThisMonth: 0,
         revenueCollected: 0,
         outstandingPayments: 0,
         activeServiceSchools: 0,
         totalStaff: 0,
         activeStaff: 0,
         onLeaveStaff: 0,
         avgAttendance: 0
       },
       staffList: [],
       allPrograms: []
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

// === TRAINER SPECIFIC ROUTES ===

 // Trainer Profile Page
 app.get('/trainer/profile', requireAuth, async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'trainer') {
      return res.redirect('/dashboard');
    }
    const currentStaff = await Staff.findOne({ email: req.session.user.email })
      .populate('assignedSchools.schoolId', 'name')
      .lean();
    res.render('trainer_profile', {
      user: req.session.user,
      trainer: currentStaff
    });
  });

 // Trainer Schools Page (assigned schools only)
 app.get('/trainer/schools', requireAuth, async (req, res) => {
   if (!req.session.user || req.session.user.role !== 'trainer') {
     return res.redirect('/dashboard');
   }
   try {
     const currentStaff = await Staff.findOne({ email: req.session.user.email });
     if (!currentStaff) {
       return res.status(404).render('404', { user: req.session.user, error: 'Trainer profile not found' });
     }

     // Get schools assigned to this trainer via Staff.assignedSchools
     const trainerAssignments = currentStaff.assignedSchools || [];
     const schoolIds = trainerAssignments
       .filter(assignment => assignment.schoolId && assignment.status === 'active')
       .map(assignment => assignment.schoolId);

     let schoolList = [];
     if (schoolIds.length > 0) {
       schoolList = await School.find({ _id: { $in: schoolIds } })
         .sort({ name: 1 })
         .lean();

       // Enrich with participation metrics
       const schoolIdsForAgg = schoolList.map(s => s._id);
       const eventAggregates = await Event.aggregate([
         { $match: { 'targetSchools.schoolId': { $in: schoolIdsForAgg } } },
         {
           $group: {
             _id: '$targetSchools.schoolId',
             eventCount: { $sum: 1 },
             avgAttendance: { $avg: '$participationMetrics.averageAttendanceRate' }
           }
         }
       ]);
       const eventMap = new Map(eventAggregates.map(a => [a._id.toString(), a]));

       schoolList = schoolList.map(school => ({
         ...school,
         participationMetrics: {
           ...(school.participationMetrics || {}),
           totalEventsAttended: eventMap.get(school._id.toString())?.eventCount || 0,
           averageAttendanceRate: Math.round(eventMap.get(school._id.toString())?.avgAttendance || 0),
           engagementScore: Math.min(100, Math.round(((eventMap.get(school._id.toString())?.eventCount || 0) * 10) + (eventMap.get(school._id.toString())?.avgAttendance || 0)))
         }
       }));
     }

     res.render('trainer_schools', {
       user: req.session.user,
       trainer: currentStaff,
       schoolList,
       page: 'trainer_schools'
     });
   } catch (err) {
     console.error('Error loading trainer schools:', err);
     res.status(500).render('404', { user: req.session.user, error: 'Failed to load schools' });
   }
 });

// Trainer Notification Center Page
// API: Consolidated Trainer Dashboard (single call for all dashboard data)
app.get('/api/trainer/dashboard', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24*60*60*1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7*24*60*60*1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel fetch all data
    const [
      todayEvents,
      upcomingEvents,
      pendingReports,
      unreadMessagesCount,
      unreadNotificationsCount,
      eventsCompletedThisMonth,
      scoutsPipeline,
      reportsSubmitted,
      distinctSchoolsFromEvents,
      distinctSchoolsFromVisits,
      studentsManaged,
      announcements
    ] = await Promise.all([
      // Today's schedule
      Event.find({
        'trainers.trainerId': trainerId,
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay },
        status: { $in: ['published', 'scheduled', 'confirmed', 'in_progress'] }
      }).lean(),
      // Upcoming events (next 7 days)
      Event.find({
        'trainers.trainerId': trainerId,
        startDate: { $gte: startOfDay, $lte: sevenDaysFromNow },
        status: { $in: ['published', 'scheduled', 'confirmed', 'in_progress'] }
      }).sort({ startDate: 1 }).lean(),
      // Pending reports
      Event.find({
        'trainers.trainerId': trainerId,
        status: 'completed',
        $or: [
          { 'review.reportSubmittedAt': { $exists: false } },
          { 'review.reportSubmittedAt': null }
        ]
      }).lean(),
      // Unread messages count
      Message.countDocuments({
        'recipients.staffId': trainerId,
        'recipients.status': 'sent',
        'recipients.deleted': { $ne: true }
      }),
      // Unread notifications count
      Notification.countDocuments({
        recipientId: trainerId,
        isRead: false,
        dismissed: false
      }),
      // Events completed this month
      Event.countDocuments({
        'trainers.trainerId': trainerId,
        status: 'completed',
        startDate: { $gte: thisMonthStart }
      }),
      // Total scouts reached
      Event.aggregate([
        { $match: { 'trainers.trainerId': trainerId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$review.actualAttendeeCount', 0] } } } }
      ]),
      // Reports submitted
      Event.countDocuments({
        'trainers.trainerId': trainerId,
        'review.reportSubmittedAt': { $ne: null }
      }),
      // Distinct schools from events
      Event.distinct('targetSchools.schoolId', {
        'trainers.trainerId': trainerId,
        status: 'completed'
      }),
      // Distinct schools from visit logs
      VisitLog.distinct('schoolId', { trainerId }),
      // Students managed
      Student.countDocuments({
        'addedBy.trainerId': trainerId,
        status: 'active'
      }),
      // Recent announcements
      Announcement.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    const totalScoutsReached = scoutsPipeline[0]?.total || 0;
    const allSchoolIds = new Set([
      ...distinctSchoolsFromEvents.map(id => id.toString()),
      ...distinctSchoolsFromVisits.map(id => id.toString())
    ]);
    const schoolsVisited = allSchoolIds.size;
    const performanceRating = currentStaff.performanceMetrics?.averageFeedbackRating || 0;

    // Build pending actions summary
    const pendingActions = [];
    if (pendingReports.length > 0) {
      pendingActions.push({
        type: 'report',
        count: pendingReports.length,
        message: `${pendingReports.length} pending report${pendingReports.length > 1 ? 's' : ''} require${pendingReports.length > 1 ? 's' : ''} submission`
      });
    }
    if (unreadMessagesCount > 0) {
      pendingActions.push({
        type: 'message',
        count: unreadMessagesCount,
        message: `${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}`
      });
    }
    if (unreadNotificationsCount > 0) {
      pendingActions.push({
        type: 'notification',
        count: unreadNotificationsCount,
        message: `${unreadNotificationsCount} notification${unreadNotificationsCount > 1 ? 's' : ''} require${unreadNotificationsCount > 1 ? '' : 's'} attention`
      });
    }

    res.json({
      success: true,
      // Stats
      stats: {
        eventsCompletedThisMonth,
        totalScoutsReached,
        reportsSubmitted,
        schoolsVisited,
        studentsManaged,
        performanceRating,
        ratingCount: 0
      },
      // Schedule
      todaySchedule: todayEvents,
      upcomingEvents: upcomingEvents,
      pendingReports,
      // Alerts
      unreadMessagesCount,
      unreadNotificationsCount,
      pendingActions,
      // Announcements
      announcements,
      // Performance rating
      performanceRating
    });
  } catch (err) {
    console.error('Error fetching trainer dashboard:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// API: Trainer Personal Stats
app.get('/api/trainer/stats', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Events completed this month
    const eventsCompletedThisMonth = await Event.countDocuments({
      'trainers.trainerId': trainerId,
      status: 'completed',
      startDate: { $gte: thisMonthStart }
    });

    // Total scouts reached
    const scoutsPipeline = await Event.aggregate([
      { $match: { 'trainers.trainerId': trainerId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$review.actualAttendeeCount', 0] } } } }
    ]);
    const totalScoutsReached = scoutsPipeline[0]?.total || 0;

    // Reports submitted
    const reportsSubmitted = await Event.countDocuments({
      'trainers.trainerId': trainerId,
      'review.reportSubmittedAt': { $ne: null }
    });

    // Schools visited (distinct from events + visit logs)
    const distinctSchoolsFromEvents = await Event.distinct('targetSchools.schoolId', {
      'trainers.trainerId': trainerId,
      status: 'completed'
    });
    const distinctSchoolsFromVisits = await VisitLog.distinct('schoolId', { trainerId });
    const allSchoolIds = new Set([
      ...distinctSchoolsFromEvents.map(id => id.toString()),
      ...distinctSchoolsFromVisits.map(id => id.toString())
    ]);
    const schoolsVisited = allSchoolIds.size;

    // Students managed (students added by this trainer)
    const studentsManaged = await Student.countDocuments({
      'addedBy.trainerId': trainerId,
      status: 'active'
    });

    // Performance rating from admin (stored in Staff.performanceMetrics.averageFeedbackRating)
    const performanceRating = currentStaff.performanceMetrics?.averageFeedbackRating || 0;

    res.json({
      success: true,
      stats: {
        eventsCompletedThisMonth,
        totalScoutsReached,
        reportsSubmitted,
        schoolsVisited,
        studentsManaged,
        performanceRating,
        ratingCount: 0
      }
    });
  } catch (err) {
    console.error('Error fetching trainer stats:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// API: Get trainer's zones/regions
app.get('/api/trainer/zones', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    
    const zones = currentStaff.zones || [];
    res.json({ success: true, zones });
  } catch (err) {
    console.error('Error fetching zones:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch zones' });
  }
});

// API: Get trainer's assigned schools (for team chat)
app.get('/api/trainer/schools', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }

    const assignments = currentStaff.assignedSchools || [];
    const schoolIds = assignments
      .filter(a => a.schoolId && a.status === 'active')
      .map(a => a.schoolId);

    let schools = [];
    if (schoolIds.length > 0) {
      schools = await School.find({ _id: { $in: schoolIds } })
        .select('name address city')
        .sort({ name: 1 })
        .lean();
    }

    res.json({ success: true, schools });
  } catch (err) {
    console.error('Error fetching schools:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch schools' });
  }
});

// API: Trainer Profile Update
app.post('/api/trainer/profile', requireAuth, parseJson, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const {
      phone,
      street, city, state, zipCode, country,
      emergencyContactName, emergencyContactRelationship, emergencyContactPhone, emergencyContactEmail
    } = req.body;

    const updateData = {};

    if (phone !== undefined && phone !== '') updateData.phone = phone.trim();

    // Address fields - use dot notation for partial updates
    if (street !== undefined && street !== '') updateData['address.street'] = street.trim();
    if (city !== undefined && city !== '') updateData['address.city'] = city.trim();
    if (state !== undefined && state !== '') updateData['address.state'] = state.trim();
    if (zipCode !== undefined && zipCode !== '') updateData['address.zipCode'] = zipCode.trim();
    if (country !== undefined && country !== '') updateData['address.country'] = country.trim();

    // Emergency contact - dot notation
    if (emergencyContactName !== undefined && emergencyContactName !== '') updateData['emergencyContact.name'] = emergencyContactName.trim();
    if (emergencyContactRelationship !== undefined && emergencyContactRelationship !== '') updateData['emergencyContact.relationship'] = emergencyContactRelationship.trim();
    if (emergencyContactPhone !== undefined && emergencyContactPhone !== '') updateData['emergencyContact.phone'] = emergencyContactPhone.trim();
    if (emergencyContactEmail !== undefined && emergencyContactEmail !== '') updateData['emergencyContact.email'] = emergencyContactEmail.trim().toLowerCase();

    if (Object.keys(updateData).length === 0) {
      return res.json({ success: true, staff: currentStaff, message: 'No changes to update' });
    }

    const updatedStaff = await Staff.findByIdAndUpdate(
      staffId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({ success: true, staff: updatedStaff });
  } catch (err) {
    console.error('Error updating trainer profile:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// API: Add Certification
app.post('/api/trainer/certifications', requireAuth, parseJson, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const { name, issuer, issueDate, expiryDate, status = 'active' } = req.body;

    if (!name || !issuer || !issueDate) {
      return res.status(400).json({ success: false, error: 'Name, issuer, and issue date are required' });
    }

    const staff = await Staff.findById(currentStaff._id);
    staff.certifications.push({
      name: name.trim(),
      issuer: issuer.trim(),
      issueDate: new Date(issueDate),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: status
    });
    await staff.save();

    res.json({ success: true, certifications: staff.certifications });
  } catch (err) {
    console.error('Error adding certification:', err);
    res.status(500).json({ success: false, error: 'Failed to add certification' });
  }
});

// API: Delete Certification
app.delete('/api/trainer/certifications/:index', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const index = parseInt(req.params.index);
    const staff = await Staff.findById(currentStaff._id);
    if (index < 0 || index >= staff.certifications.length) {
      return res.status(400).json({ success: false, error: 'Invalid certification index' });
    }
    staff.certifications.splice(index, 1);
    await staff.save();
    res.json({ success: true, certifications: staff.certifications });
  } catch (err) {
    console.error('Error deleting certification:', err);
    res.status(500).json({ success: false, error: 'Failed to delete certification' });
  }
});

// === TRAINER EVENT MANAGEMENT ===

// GET trainer events page with calendar
app.get('/trainer/events', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
  res.render('trainer_events', {
    user: req.session.user,
    page: 'trainer_events'
  });
});

// GET single event detail for trainer
app.get('/trainer/events/:eventId', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
   try {
     const event = await Event.findById(req.params.eventId)
       .populate('trainers.trainerId', 'name email idNumber role')
       .populate('targetSchools.schoolId', 'name address city contactPerson')
       .lean();

     if (!event) {
       return res.status(404).render('404', { user: req.session.user, error: 'Event not found' });
     }

     // Verify trainer is assigned to this event
     const currentStaff = await getCurrentStaff(req);
     if (!currentStaff) {
       return res.status(403).render('404', { user: req.session.user, error: 'Staff profile not found' });
     }
     const isAssigned = event.trainers.some(t => t.trainerId.toString() === currentStaff._id.toString());
     if (!isAssigned) {
       return res.status(403).render('404', { user: req.session.user, error: 'Access denied. You are not assigned to this event.' });
     }

     res.render('trainer_event_detail', {
       user: req.session.user,
       event,
       page: 'trainer_event_detail',
       staffId: currentStaff._id.toString()
     });
  } catch (err) {
    console.error('Error loading event detail:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load event' });
  }
});

// POST: Trainer accepts event assignment
app.post('/trainer/events/:eventId/accept', requireAuth, parseJson, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const eventId = req.params.eventId;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const trainerAssignment = event.trainers.find(t => t.trainerId.toString() === trainerId.toString());
    if (!trainerAssignment) {
      return res.status(404).json({ success: false, error: 'Not assigned to this event' });
    }

    trainerAssignment.status = 'confirmed';
    await event.save();

    res.json({ success: true, message: 'Event accepted' });
  } catch (err) {
    console.error('Error accepting event:', err);
    res.status(500).json({ success: false, error: 'Failed to accept event' });
  }
});

// POST: Trainer declines event assignment
app.post('/trainer/events/:eventId/decline', requireAuth, parseJson, async (req, res) => {
  try {
    const { reason } = req.body;
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const eventId = req.params.eventId;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const trainerAssignment = event.trainers.find(t => t.trainerId.toString() === trainerId.toString());
    if (!trainerAssignment) {
      return res.status(404).json({ success: false, error: 'Not assigned to this event' });
    }

    trainerAssignment.status = 'declined';
    trainerAssignment.notes = reason || 'Declined';
    await event.save();

    // Notify admins about the decline
    const admins = await Staff.find({ role: { $in: ['admin', 'founder', 'supervisor'] } }).select('_id');
    for (const admin of admins) {
      await Notification.create({
        recipientId: admin._id,
        type: 'assignment',
        title: 'Trainer declined event',
        message: `${currentStaff.name} declined assignment to ${event.name}. Reason: ${reason || 'Not provided'}`,
        actionUrl: `/trainer/events/${eventId}`,
        entityType: 'event',
        entityId: eventId,
        priority: 'high'
      });
    }

    res.json({ success: true, message: 'Event declined' });
  } catch (err) {
    console.error('Error declining event:', err);
    res.status(500).json({ success: false, error: 'Failed to decline event' });
  }
});

// POST: Trainer submits event report
app.post('/trainer/events/:eventId/submit-report', requireAuth, parseJson, async (req, res) => {
  try {
    const { trainerReport, actualAttendeeCount } = req.body;
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const eventId = req.params.eventId;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Verify trainer assignment
    const trainerAssignment = event.trainers.find(t => t.trainerId.toString() === trainerId.toString());
    if (!trainerAssignment) {
      return res.status(403).json({ success: false, error: 'Not assigned to this event' });
    }

    // Update review fields
    event.review.trainerReport = trainerReport;
    event.review.reportSubmittedAt = new Date();
    event.review.reportSubmittedBy = trainerId;
    if (actualAttendeeCount) {
      event.review.actualAttendeeCount = parseInt(actualAttendeeCount);
    }
    await event.save();

    // Notify admins
    const admins = await Staff.find({ role: { $in: ['admin', 'founder', 'supervisor'] } }).select('_id');
    for (const admin of admins) {
      await Notification.create({
        recipientId: admin._id,
        type: 'report_reminder',
        title: 'Report submitted',
        message: `${currentStaff.name} submitted a report for ${event.name}`,
        actionUrl: `/dashboard/events/${eventId}`,
        entityType: 'event',
        entityId: eventId,
        priority: 'normal'
      });
    }

    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    console.error('Error submitting report:', err);
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

// GET trainer's past events history
app.get('/api/trainer/past-events', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      'trainers.trainerId': trainerId,
      status: 'completed'
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const events = await Event.find(query)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      events,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching past events:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch past events' });
  }
});

// API: Trainer Events data (for calendar)
app.get('/api/trainer/events', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const trainerId = currentStaff._id;
    const { start, end, view = 'month' } = req.query;

    let query = { 'trainers.trainerId': trainerId };
    if (start && end) {
      query.startDate = { $lte: new Date(end) };
      query.endDate = { $gte: new Date(start) };
    }

     const events = await Event.find(query)
       .select('name startDate endDate eventType status location trainers.trainerId trainers.status trainers.role')
       .sort({ startDate: 1 })
       .lean();

    // Transform for calendar
    const calendarEvents = events.map(ev => {
      const trainerAssignment = ev.trainers.find(t => t.trainerId.toString() === trainerId.toString());
      return {
        id: ev._id,
        title: ev.name,
        start: ev.startDate,
        end: ev.endDate,
        type: ev.eventType,
        status: ev.status,
        location: ev.location?.name || '',
        trainerRoles: ev.trainers.filter(t => t.trainerId.toString() === trainerId.toString()).map(t => t.role),
        trainerAssignmentStatus: trainerAssignment ? trainerAssignment.status : 'not_assigned'
      };
    });

    res.json({ success: true, events: calendarEvents });
  } catch (err) {
    console.error('Error fetching trainer events:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// Booking routes
// Allow guests to view and submit bookings; when logged-in, form will pre-fill
app.get('/book', async (req, res) => {
  try {
    // Fetch active programs from database
    const programs = await Program.find({ status: 'active' }).sort({ name: 1 });
    res.render('book_program', { 
      user: req.session.user,
      programs: programs
    });
  } catch (err) {
    console.error('Error fetching programs:', err);
    // Fallback to default programs if database fetch fails
    const defaultPrograms = [
      { name: 'Leadership Training', description: 'Develop essential leadership skills through hands-on activities and team challenges.', duration: 'full-day', maxParticipants: 30, price: { amount: 45 }, ageGroup: { min: 14, max: 18 } },
      { name: 'Outdoor Education', description: 'Explore nature while learning about environmental stewardship and outdoor skills.', duration: 'half-day', maxParticipants: 25, price: { amount: 25 }, ageGroup: { min: 10, max: 18 } },
      { name: 'Team Building', description: 'Build collaboration and communication through interactive group activities.', duration: 'half-day', maxParticipants: 40, price: { amount: 20 }, ageGroup: { min: 8, max: 18 } },
      { name: 'Scout Training Sessions', description: 'Complete badge requirements and advance through scouting ranks.', duration: 'weekend', maxParticipants: 20, price: { amount: 35 }, ageGroup: { min: 11, max: 18 } }
    ];
    res.render('book_program', { 
      user: req.session.user,
      programs: defaultPrograms
    });
  }
});

app.post('/book/submit', parseJson, async (req, res) => {
  const { program, type, date, participants, notes, userEmail, name, email } = req.body;

  try {
    // Look up program price if available
    let programPrice = 0;
    try {
      const programDoc = await Program.findOne({ name: program, status: 'active' });
      if (programDoc && programDoc.price && programDoc.price.amount) {
        programPrice = programDoc.price.amount;
      }
    } catch (err) {
      console.warn('Could not fetch program price:', err.message);
      // Continue without price - will show $0 on success page
    }

    const booking = new Booking({
      program: program || 'Unknown',
      type: type || 'school',
      date: new Date(date) || new Date(),
      participants: parseInt(participants) || 0,
      notes: notes || '',
      // prefer session user email, then hidden userEmail, then posted email (guest), else 'guest'
      userEmail: (req.session.user && req.session.user.email) || userEmail || email || 'guest',
      requesterName: (req.session.user && req.session.user.name) || name || '',
      status: 'pending',
      // Store price snapshot for reference
      programPrice: programPrice
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

app.post('/admin/users/create', requireAuth, requireFounder, parseJson, async (req, res) => {
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

app.post('/admin/users/delete', requireAuth, requireFounder, parseJson, async (req, res) => {
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

app.post('/admin/bookings/delete', requireAuth, requireFounder, parseJson, async (req, res) => {
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
app.post('/dashboard/staff/add', requireAuth, requirePermission('canCreateStaff'), staffAddLimiter, parseJson, async (req, res) => {
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
      createdBy: req.session.user.id
    };

    console.log('Staff data to save:', JSON.stringify(staffData, null, 2));
    const staff = new Staff(staffData);

    await staff.save();
    console.log('✓ Staff saved successfully:', staff._id, staff.idNumber, staff.name);

    // Send invitation email (using centralized email service)
    const invitationUrl = `${req.protocol}://${req.get('host')}/activate/${invitationToken}`;
    await emailService.sendEmail({
      to: staff.email,
      subject: 'APV Staff Portal Invitation',
      templateId: 'staff_invitation',
      templateData: { name: staff.name, activationUrl: invitationUrl },
      triggeredBy: req.session.user.id,
      entityType: 'staff',
      entityId: staff._id,
      triggerReason: 'staff_invitation',
      priority: 'high'
    });

    // Get current staff for use in notifications and messages
    const currentStaff = await getCurrentStaff(req);

    // Send welcome message in inbox
    const welcomeMessage = new Message({
      senderId: currentStaff ? currentStaff._id : req.session.user.id, // Fallback to User ID if no Staff record
      senderName: req.session.user.name,
      senderRole: req.session.user.role,
      recipients: [{ staffId: staff._id, status: 'sent' }],
      subject: 'Welcome to APV Staff Portal',
      body: `Welcome ${staff.name}! We are excited to have you join our team as a ${staff.role}. Please activate your account using the link sent to your email. If you have any questions, don't hesitate to reach out.`,
      messageType: 'direct',
      priority: 'normal'
    });
    await welcomeMessage.save();

    // Send notification to current user confirming invitation sent
    if (currentStaff) {
      await Notification.create({
        recipientId: currentStaff._id,
        type: 'system',
        title: 'Staff Invitation Sent',
        message: `Invitation sent to ${staff.name} (${staff.email})`,
        entityType: 'staff',
        entityId: staff._id,
        priority: 'normal',
        channels: ['in-app']
      });
    }

    // Notify all admins about new staff member
    const admins = await Staff.find({ role: { $in: ['admin', 'supervisor', 'founder'] } });
    for (const admin of admins) {
      if (admin._id.toString() !== currentStaff?._id.toString()) {
        await Notification.create({
          recipientId: admin._id,
          type: 'system',
          title: 'New Staff Member Added',
          message: `${staff.name} has been added as a ${staff.role}`,
          actionUrl: '/dashboard/staff',
          entityType: 'staff',
          entityId: staff._id,
          priority: 'normal'
        });
      }
    }

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

    res.json({ success: true, staffId: staff._id, name: staff.name, email: staff.email });

  } catch (err) {
    console.error('✗ Error saving staff:', err.message);
    console.error('Stack:', err.stack);

    // Handle MongoDB duplicate key error (E11000)
    if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
      const dupKeyMatch = err.message.match(/dup key:\s*\{\s*(\w+):\s*"([^"]+)"\s*\}/);
      if (dupKeyMatch) {
        const field = dupKeyMatch[1];
        const value = dupKeyMatch[2];
        if (field === 'idNumber') {
          return res.status(409).send(`Staff ID number "${value}" already exists. Please use a unique ID number.`);
        } else if (field === 'email') {
          return res.status(409).send(`Email "${value}" is already registered to another staff member.`);
        }
      }
      return res.status(409).send('Duplicate value detected. This staff member already exists (same ID number, email, or other unique field).');
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = [];
      for (const [key, val] of Object.entries(err.errors)) {
        messages.push(`${key}: ${val.message}`);
      }
      return res.status(400).send('Invalid data: ' + messages.join(', '));
    }

    console.log('=== END STAFF ADD REQUEST ===\n');
    res.status(500).send('Error saving staff: ' + err.message);
  }
});

// Update staff member
app.post('/dashboard/staff/update', requireAuth, requirePermission('canEditStaff'), parseJson, async (req, res) => {
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

    // Handle MongoDB duplicate key error (E11000)
    if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
      const fieldMatch = err.message.match(/index:\s*(\w+)_1/);
      const dupKeyMatch = err.message.match(/dup key:\s*\{\s*(\w+):\s*"([^"]+)"\s*\}/);

      if (dupKeyMatch) {
        const field = dupKeyMatch[1];
        const value = dupKeyMatch[2];

        if (field === 'idNumber') {
          return res.status(409).json({
            success: false,
            error: `Staff ID number "${value}" already exists. Please use a unique ID number.`,
            field: 'idNumber',
            suggestion: 'Check existing staff list or use a different ID number (e.g., TRN007)'
          });
        } else if (field === 'email') {
          return res.status(409).json({
            success: false,
            error: `Email "${value}" is already registered to another staff member.`,
            field: 'email',
            suggestion: 'Use a different email address or check if the staff already exists'
          });
        }
      }

      return res.status(409).json({
        success: false,
        error: 'Duplicate value detected. This record already exists (same ID number, email, or other unique field).',
        suggestion: 'Please check the staff ID number and email are unique'
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = [];
      for (const [key, val] of Object.entries(err.errors)) {
        messages.push `${key}: ${val.message}`;
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid data: ' + messages.join(', ')
      });
    }

    console.log('=== END STAFF UPDATE REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error updating staff: ' + err.message });
  }
});

// Delete staff member
app.post('/dashboard/staff/delete', requireAuth, requirePermission('canDeleteStaff'), parseJson, async (req, res) => {
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
    console.error('✗ Error saving staff:', err.message);
    console.error('Stack:', err.stack);

    // Handle MongoDB duplicate key error (E11000)
    if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
      const dupKeyMatch = err.message.match(/dup key:\s*\{\s*(\w+):\s*"([^"]+)"\s*\}/);
      if (dupKeyMatch) {
        const field = dupKeyMatch[1];
        const value = dupKeyMatch[2];
        if (field === 'idNumber') {
          return res.status(409).send(`Staff ID number "${value}" already exists. Please use a unique ID number.`);
        } else if (field === 'email') {
          return res.status(409).send(`Email "${value}" is already registered to another staff member.`);
        }
      }
      return res.status(409).send('Duplicate value detected. This staff member already exists (same ID number, email, or other unique field).');
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = [];
      for (const [key, val] of Object.entries(err.errors)) {
        messages.push(`${key}: ${val.message}`);
      }
      return res.status(400).send('Invalid data: ' + messages.join(', '));
    }

    console.log('=== END STAFF ADD REQUEST ===\n');
    res.status(500).send('Error saving staff: ' + err.message);
  }
});

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

 // ============ LEAVE MANAGEMENT ROUTES ============

 // Trainer submits leave request
  app.post('/api/trainer/leave/request', requireAuth, parseJson, async (req, res) => {
   try {
     if (req.session.user.role !== 'trainer') {
       return res.status(403).json({ success: false, error: 'Only trainers can request leave' });
     }

     const { startDate, endDate, type, notes } = req.body;
     
     if (!startDate || !endDate || !type) {
       return res.status(400).json({ success: false, error: 'Start date, end date, and leave type are required' });
     }

     const start = new Date(startDate);
     const end = new Date(endDate);
     if (start > end) {
       return res.status(400).json({ success: false, error: 'End date cannot be before start date' });
     }

     const currentStaff = await Staff.findOne({ email: req.session.user.email });
     if (!currentStaff) {
       return res.status(404).json({ success: false, error: 'Staff profile not found' });
     }

     // Add leave request to leaveHistory with pending status
     const newLeave = {
       startDate: start,
       endDate: end,
       type: type.trim().toLowerCase(),
       status: 'pending',
       notes: notes?.trim() || ''
     };

     currentStaff.leaveHistory.unshift(newLeave);
     await currentStaff.save();

     // Notify admins about the leave request
     const admins = await Staff.find({ role: { $in: ['admin', 'founder', 'supervisor'] } }).select('_id');
     for (const admin of admins) {
       await Notification.create({
         recipientId: admin._id,
         type: 'leave_request',
         title: 'Leave Request Submitted',
         message: `${currentStaff.name} requested ${type} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
         actionUrl: `/dashboard/staff`,
         entityType: 'staff',
         entityId: currentStaff._id,
         priority: 'medium'
       });
     }

     res.json({ success: true, message: 'Leave request submitted successfully', leave: newLeave });
   } catch (err) {
     console.error('Error submitting leave request:', err);
     res.status(500).json({ success: false, error: 'Failed to submit leave request' });
   }
 });

 // Founder/Admin approves/declines/postpones leave request
  app.post('/api/staff/leave/:staffId/action', requireAuth, parseJson, async (req, res) => {
   try {
     // Check permissions - only admin/founder/supervisor/coordinator can approve leaves
     if (!['admin', 'founder', 'supervisor', 'coordinator'].includes(req.session.user.role)) {
       return res.status(403).json({ success: false, error: 'Insufficient permissions' });
     }

     const { staffId } = req.params;
     const { leaveId, action, notes } = req.body; // leaveId: _id of leave subdocument; action: 'approved', 'rejected', 'postponed'

     if (!leaveId || !['approved', 'rejected', 'postponed'].includes(action)) {
       return res.status(400).json({ success: false, error: 'Invalid request. leaveId and valid action required' });
     }

     const staff = await Staff.findById(staffId);
     if (!staff) {
       return res.status(404).json({ success: false, error: 'Staff not found' });
     }

     // Find leave by _id
     const leaveIndex = staff.leaveHistory.findIndex(l => l._id.toString() === leaveId);
     if (leaveIndex === -1) {
       return res.status(404).json({ success: false, error: 'Leave request not found' });
     }

     const leave = staff.leaveHistory[leaveIndex];
     // Only allow action on pending leaves
     if (leave.status !== 'pending') {
       return res.status(400).json({ success: false, error: `Leave request is already ${leave.status} and cannot be modified` });
     }

      leave.status = action;
      if (notes) leave.notes = (leave.notes || '') + `\n\nAdmin note: ${notes}`;
      leave.approvedBy = req.session.user.id;
      leave.approvedDate = new Date();

      await staff.save();

     // Notify staff member about the decision
     await Notification.create({
       recipientId: staff._id,
       type: 'leave_status',
       title: `Leave Request ${action.charAt(0).toUpperCase() + action.slice(1)}`,
       message: `Your ${leave.type} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been ${action} ${notes ? `with note: ${notes}` : ''}`,
       actionUrl: '/trainer/profile',
       entityType: 'leave',
       entityId: staff._id,
       priority: 'high'
     });

     // Log audit
     await logAudit('leave_' + action, 'leave', staff._id, `${staff.name}'s leave`, { 
       leaveType: leave.type,
       startDate: leave.startDate,
       endDate: leave.endDate,
       action,
       approvedBy: req.session.user.name
     }, {
       userId: req.session.user.id,
       userName: req.session.user.name,
       userEmail: req.session.user.email,
       userRole: req.session.user.role
     });

     res.json({ success: true, message: `Leave request ${action}`, leave });
   } catch (err) {
     console.error('Error processing leave request:', err);
     res.status(500).json({ success: false, error: 'Failed to process leave request' });
   }
 });

 // Get trainer's own leave requests
 app.get('/api/trainer/leave/requests', requireAuth, async (req, res) => {
   try {
     if (req.session.user.role !== 'trainer') {
       return res.status(403).json({ success: false, error: 'Only trainers can access this endpoint' });
     }

     const currentStaff = await Staff.findOne({ email: req.session.user.email });
     if (!currentStaff) {
       return res.status(404).json({ success: false, error: 'Staff profile not found' });
     }

     const leaveRequests = currentStaff.leaveHistory || [];
     res.json({ success: true, leaveRequests });
   } catch (err) {
     console.error('Error fetching leave requests:', err);
     res.status(500).json({ success: false, error: 'Failed to fetch leave requests' });
   }
 });

  // ============ SCHOOL ADMIN ROUTES ============

  // (Duplicate /school/dashboard route removed - using the more complete version below)

  // API: School Dashboard Data (JSON)
  app.get('/api/school/dashboard', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getDashboardData(req, res);
  });

   // API: Get school profile
   app.get('/api/school/profile', requireAuth, requireSchoolAdmin, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.getSchoolProfile(req, res);
   });

   // API: Update school profile
    app.post('/api/school/profile', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.updateSchoolProfile(req, res);
   });

   // API: Get students data
    app.get('/api/school/students', requireAuth, requireSchoolAdmin, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.getStudentsData(req, res);
   });

    app.post('/api/school/students', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
      const schoolController = require('./backend/controllers/schoolController');
      schoolController.addStudent(req, res);
    });

     // API: Update student
     app.put('/api/school/students/:studentId', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
       const schoolController = require('./backend/controllers/schoolController');
       schoolController.updateStudent(req, res);
     });

     // API: Delete student
     app.delete('/api/school/students/:studentId', requireAuth, requireSchoolAdmin, async (req, res) => {
       const schoolController = require('./backend/controllers/schoolController');
       schoolController.deleteStudent(req, res);
     });

     // API: Get events
  app.get('/api/school/events', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getEvents(req, res);
  });

  // API: Get single event details
  app.get('/api/school/events/:eventId', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getEventDetails(req, res);
  });

  // API: Update event attendance/RSVP
  app.post('/api/school/events/:eventId/attendance', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.updateEventAttendance(req, res);
  });

  // API: Get invoices
  app.get('/api/school/invoices', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getInvoices(req, res);
  });

  // API: Download invoice
  app.get('/api/school/invoices/:invoiceId/download', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.downloadInvoice(req, res);
  });

  // API: Raise payment query
  app.post('/api/school/invoices/:invoiceId/query', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.raisePaymentQuery(req, res);
  });

  // API: Get documents
  app.get('/api/school/documents', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getDocuments(req, res);
  });

  // API: Upload document
    app.post('/api/school/documents', requireAuth, requireSchoolAdmin, uploadDocument.single('document'), parseJson, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.uploadDocument(req, res);
  });

  // API: Get messages (conversation with founder)
  app.get('/api/school/messages', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getMessages(req, res);
  });

  // API: Send message to founder
  app.post('/api/school/messages', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.sendMessage(req, res);
  });

  // API: Get notifications
  app.get('/api/school/notifications', requireAuth, requireSchoolAdmin, async (req, res) => {
    const schoolController = require('./backend/controllers/schoolController');
    schoolController.getNotifications(req, res);
  });

   // API: Mark notification as read
    app.post('/api/school/notifications/:notificationId/read', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.markNotificationRead(req, res);
   });

   // API: Get available programs
   app.get('/api/school/programs', requireAuth, requireSchoolAdmin, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.getAvailablePrograms(req, res);
   });

   // API: Enroll in a program
    app.post('/api/school/programs/enroll', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.enrollProgram(req, res);
   });

   // API: Remove program enrollment
    app.post('/api/school/programs/remove', requireAuth, requireSchoolAdmin, parseJson, async (req, res) => {
     const schoolController = require('./backend/controllers/schoolController');
     schoolController.removeProgram(req, res);
   });

   // School Admin Dashboard Page
    app.get('/school/dashboard', requireAuth, requireSchoolAdmin, async (req, res) => {
      try {
        const schoolId = req.schoolId;
        const school = req.school;

        const [
          totalScouts,
          activeGroupsCount,
          upcomingEvents,
          pendingInvoices,
          unreadNotificationsCount,
          unreadMessagesCount,
          recentStudents,
          totalPaidThisYear,
          enrolledPrograms
        ] = await Promise.all([
          Student.countDocuments({ school: schoolId, status: 'active' }),
          ScoutGroup.countDocuments({ schoolId, status: 'active' }),
          Event.find({
            'targetSchools.schoolId': schoolId,
            startDate: { $gte: new Date(), $lte: new Date(Date.now() + 30*24*60*60*1000) },
            status: { $in: ['confirmed', 'in_progress', 'scheduled'] }
          }).sort({ startDate: 1 }).limit(1).lean(),
          Invoice.countDocuments({
            schoolId,
            status: { $in: ['issued', 'sent', 'partial', 'overdue'] }
          }),
          Notification.countDocuments({
            recipientId: req.staff._id,
            isRead: false,
            dismissed: false
          }),
          Message.countDocuments({
            'recipients.staffId': req.staff._id,
            'recipients.status': 'sent',
            'recipients.deleted': { $ne: true }
          }),
          // Recent students with trainer info
          Student.find({ school: schoolId, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('assignedTrainer', 'name')
            .lean(),
          // Total paid this year
          Invoice.aggregate([
            {
              $match: {
                schoolId: new mongoose.Types.ObjectId(schoolId),
                status: 'paid',
                paidDate: { $gte: new Date(new Date().getFullYear(), 0, 1) }
              }
            },
            {
              $group: {
                _id: null,
                totalPaid: { $sum: '$totalAmount' }
              }
            }
          ]),
          // Enrolled programs
          School.findById(schoolId)
            .populate('programsEnrolled', 'name description category duration price')
            .select('programsEnrolled')
            .lean()
        ]);

        const totalPaid = totalPaidThisYear[0]?.totalPaid || 0;
        const programs = enrolledPrograms?.programsEnrolled || [];

        // Transform recent students to include readable names
        const transformedRecentStudents = recentStudents.map(s => ({
          _id: s._id,
          fullName: s.fullName,
          scoutSection: s.scoutSection,
          assignedTrainerName: s.assignedTrainer?.name || 'Unassigned',
          createdAt: s.createdAt
        }));

        const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

        res.render('school_dashboard', {
          user: req.session.user,
          school,
          stats: {
            totalScouts,
            activeGroupsCount,
            upcomingEventsCount: upcomingEvents.length,
            pastEventsCount: null, // not needed on dashboard
            pendingInvoices,
            totalPaidThisYear: totalPaid,
            daysSinceLastVisit: await calculateDaysSinceLastVisit(schoolId),
            unreadNotifications: unreadNotificationsCount,
            unreadMessages: unreadMessagesCount
          },
          programs,
          nextEvent,
          pendingActions: await buildPendingActions(schoolId, req.staff._id),
          notifications: {
            unreadCount: unreadNotificationsCount,
            recent: await Notification.find({ recipientId: req.staff._id, isRead: false, dismissed: false })
              .sort({ createdAt: -1 }).limit(5).lean()
          },
          recentStudents: transformedRecentStudents,
          page: 'school_dashboard'
        });
  } catch (err) {
    console.error('School dashboard error:', err);
    // Log more details for debugging
    console.error('Error details:', {
      schoolId: req.schoolId,
      staffId: req.staff?._id,
      errorMessage: err.message,
      errorStack: err.stack
    });
    res.status(500).render('404', {
      user: req.session.user,
      error: `Failed to load dashboard: ${err.message}`
    });
  }
  });

  // School Profile Page
  app.get('/school/profile', requireAuth, requireSchoolAdmin, async (req, res) => {
    try {
      const school = await School.findById(req.schoolId).lean();
      const primaryStaff = school?.assignedStaff?.find(a => a.assignmentType === 'primary');
      let trainer = null;
      if (primaryStaff?.staffId) {
        trainer = await Staff.findById(primaryStaff.staffId).select('name email').lean();
      }
      res.render('school_profile', {
        user: req.session.user,
        school,
        trainer,
        page: 'school_profile'
      });
    } catch (err) {
      console.error('School profile error:', err);
      res.status(500).render('404', { user: req.session.user, error: err.message });
    }
  });

   // Students & Groups Page
    app.get('/school/students', requireAuth, requireSchoolAdmin, async (req, res) => {
      try {
       const schoolId = req.schoolId;
        const [groups, students, schoolWithStaff] = await Promise.all([
          ScoutGroup.find({ schoolId, status: 'active' }).sort({ name: 1 }).lean(),
          Student.find({ school: schoolId, status: 'active' })
            .sort({ fullName: 1 })
            .populate('assignedTrainer', 'name')
            .populate('addedBy.trainerId', 'name')
            .lean(),
          School.findById(schoolId)
            .populate('assignedStaff.staffId', 'name')
            .lean()
        ]);

        // Transform students to include readable trainer names
        const transformedStudents = (students || []).map(student => {
          const p = student.parentContact || {};
          return {
            _id: student._id,
            fullName: student.fullName || 'Unnamed Student',
            gender: student.gender || 'N/A',
            dateOfBirth: student.dateOfBirth || null,
            scoutSection: student.scoutSection || 'Unassigned',
            status: student.status || 'active',
            assignedTrainer: student.assignedTrainer || null,
            assignedTrainerName: student.assignedTrainer?.name || 'Unassigned',
            addedBy: student.addedBy || null,
            addedByName: student.addedBy?.trainerId?.name || 'Unknown',
            parentContact: {
              name: p.name || 'Unknown',
              phone: p.phone || 'N/A',
              email: p.email || ''
            }
          };
        });

        // Extract trainers array from assignedStaff
        const trainers = (schoolWithStaff?.assignedStaff || [])
          .filter(assignment => assignment.status === 'active')
          .map(assignment => ({
            _id: assignment.staffId?._id?.toString() || assignment.staffId?.toString() || '',
            name: assignment.staffId?.name || assignment.staffId || ''
          }));

         res.render('school_students', {
           user: req.session.user,
           school: req.school,
           groups,
           students: transformedStudents,
           trainers,
           schoolId,
           page: 'school_students'
         });
      } catch (err) {
        console.error('School students error:', err);
        res.status(500).render('404', { user: req.session.user, error: err.message });
      }
    });

   // Events Page
  app.get('/school/events', requireAuth, requireSchoolAdmin, async (req, res) => {
    try {
      const events = await Event.find({
        'targetSchools.schoolId': req.schoolId
      }).sort({ startDate: -1 }).lean();
      res.render('school_events', {
        user: req.session.user,
        school: req.school,
        events,
        schoolId: req.schoolId,
        page: 'school_events'
      });
    } catch (err) {
      console.error('School events error:', err);
      res.status(500).render('404', { user: req.session.user, error: err.message });
    }
  });

  // Payments Page
  app.get('/school/payments', requireAuth, requireSchoolAdmin, async (req, res) => {
    try {
      const invoices = await Invoice.find({ schoolId: req.schoolId })
        .sort({ issueDate: -1 })
        .lean();
      const stats = await Invoice.aggregate([
        { $match: { schoolId: new mongoose.Types.ObjectId(req.schoolId) } },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$totalAmount' },
            totalPaid: { $sum: '$amountPaid' },
            overdueCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'issued'] }, { $lt: ['$dueDate', new Date()] }] },
                  1, 0
                ]
              }
            }
          }
        }
      ]);
      res.render('school_payments', {
        user: req.session.user,
        school: req.school,
        invoices,
        stats: stats[0] || { totalInvoiced: 0, totalPaid: 0, overdueCount: 0 },
        page: 'school_payments'
      });
    } catch (err) {
      console.error('School payments error:', err);
      res.status(500).render('404', { user: req.session.user, error: err.message });
    }
  });

  // Documents Page
  app.get('/school/documents', requireAuth, requireSchoolAdmin, async (req, res) => {
    try {
      const documents = await SchoolDocument.find({ schoolId: req.schoolId })
        .populate('uploadedBy', 'name email')
        .sort({ uploadedAt: -1 })
        .lean();
      res.render('school_documents', {
        user: req.session.user,
        school: req.school,
        documents,
        page: 'school_documents'
      });
    } catch (err) {
      console.error('School documents error:', err);
      res.status(500).render('404', { user: req.session.user, error: err.message });
    }
  });

  // Messages Page
  app.get('/school/messages', requireAuth, requireSchoolAdmin, async (req, res) => {
    try {
      const founders = await Staff.find({ role: { $in: ['admin', 'founder'] } }).select('_id').lean();
      const founderIds = founders.map(f => f._id);
      const messages = await Message.find({
        $or: [
          { senderId: req.staff._id, 'recipients.staffId': { $in: founderIds } },
          { senderId: { $in: founderIds }, 'recipients.staffId': req.staff._id }
        ]
      }).sort({ sentAt: -1 }).limit(20).lean();

      res.render('school_messages', {
        user: req.session.user,
        school: req.school,
        messages,
        page: 'school_messages'
      });
    } catch (err) {
      console.error('School messages error:', err);
      res.status(500).render('404', { user: req.session.user, error: err.message });
    }
  });

  // Notifications Page
  app.get('/school/notifications', requireAuth, requireSchoolAdmin, async (req, res) => {
    try {
      const notifications = await Notification.find({ recipientId: req.staff._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      res.render('school_notifications', {
        user: req.session.user,
        school: req.school,
        notifications,
        page: 'school_notifications'
      });
    } catch (err) {
      console.error('School notifications error:', err);
      res.status(500).render('404', { user: req.session.user, error: err.message });
    }
  });

  // Placeholder for calculateDaysSinceLastVisit used in dashboard
  async function calculateDaysSinceLastVisit(schoolId) {
    const lastVisit = await VisitLog.findOne({ schoolId }).sort({ date: -1 }).select('date').lean();
    if (!lastVisit) return null;
    const diffTime = Math.abs(new Date() - new Date(lastVisit.date));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async function buildPendingActions(schoolId, staffId) {
    const actions = [];
    const pendingInvoices = await Invoice.countDocuments({
      schoolId,
      status: { $in: ['issued', 'sent', 'overdue'] }
    });
    if (pendingInvoices > 0) {
      actions.push({ type: 'payment', count: pendingInvoices, message: `${pendingInvoices} invoice${pendingInvoices > 1 ? 's' : ''} need attention`, actionUrl: '/school/payments' });
    }
    const unreadMessages = await Message.countDocuments({
      'recipients.staffId': staffId,
      'recipients.status': 'sent',
      'recipients.deleted': { $ne: true }
    });
    if (unreadMessages > 0) {
      actions.push({ type: 'message', count: unreadMessages, message: `${unreadMessages} unread message${unreadMessages > 1 ? 's' : ''}`, actionUrl: '/school/messages' });
    }
    const unreadNotifications = await Notification.countDocuments({
      recipientId: staffId,
      isRead: false,
      dismissed: false
    });
    if (unreadNotifications > 0) {
      actions.push({ type: 'notification', count: unreadNotifications, message: `${unreadNotifications} notification${unreadNotifications > 1 ? 's' : ''}`, actionUrl: '/school/notifications' });
    }
    return actions;
  }

  // Get school details
  app.get('/api/school/:schoolId', requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(schoolId)) {
        return res.status(404).json({ error: 'Invalid school identifier' });
      }

      const school = await School.findById(schoolId).lean();
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
app.post('/api/permissions/update', requireAuth, requirePermission('canManagePermissions'), parseJson, async (req, res) => {
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

app.post('/activate/:token', parseJson, async (req, res) => {
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
app.post('/forgot-password', authLimiter, parseJson, async (req, res) => {
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

    // Send reset email using centralized service
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    await emailService.sendEmail({
      to: staff.email,
      subject: 'APV Password Reset',
      templateId: 'password_reset',
      templateData: { name: staff.name, resetUrl: resetUrl },
      triggeredBy: null, // System-generated
      entityType: 'staff',
      entityId: staff._id,
      triggerReason: 'password_reset_request',
      priority: 'high'
    });

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

app.post('/reset-password/:token', parseJson, async (req, res) => {
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
app.post('/api/leave/request', requireAuth, parseJson, async (req, res) => {
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
app.post('/api/leave/approve', requireAuth, requirePermission('canEditStaff'), parseJson, async (req, res) => {
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

    // Notify staff member about leave decision
    await Notification.create({
      recipientId: staffId,
      type: action === 'approved' ? 'system' : 'approval_required',
      title: `Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your leave request from ${new Date(staff.leaveHistory[leaveIndex].startDate).toLocaleDateString()} to ${new Date(staff.leaveHistory[leaveIndex].endDate).toLocaleDateString()} has been ${action}. ${notes ? 'Notes: ' + notes : ''}`,
      entityType: 'staff',
      entityId: staffId,
      priority: action === 'approved' ? 'normal' : 'high'
    });

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
app.post('/api/availability/update', requireAuth, parseJson, async (req, res) => {
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

     // Fetch staff list for compose dropdown
     const staffList = await Staff.find({ status: { $ne: 'Inactive' } })
       .select('_id name email role')
       .sort({ name: 1 })
       .lean();

     // Fetch all active programs for onboarding modal
     const allPrograms = await Program.find({ status: 'active' })
       .select('_id name price duration')
       .sort({ name: 1 })
       .lean();

     res.render('dashboard', {
       user: req.session.user,
       page: 'audit-logs',
       staffList,
       allPrograms,
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
app.post('/api/performance/update', requireAuth, requirePermission('canEditStaff'), parseJson, async (req, res) => {
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
app.post('/api/permissions/init', requireAuth, requirePermission('canManagePermissions'), parseJson, async (req, res) => {
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
          canExportData: false,
          canScheduleReports: false,
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
app.post('/dashboard/trainer/add', requireAuth, requirePermission('canCreateStaff'), parseJson, async (req, res) => {
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
app.post('/dashboard/trainer/update', requireAuth, requirePermission('canEditStaff'), parseJson, async (req, res) => {
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

     // Handle MongoDB duplicate key error (E11000)
     if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
       const fieldMatch = err.message.match(/index:\s*(\w+)_1/);
       const dupKeyMatch = err.message.match(/dup key:\s*\{\s*(\w+):\s*"([^"]+)"\s*\}/);

       if (dupKeyMatch) {
         const field = dupKeyMatch[1];
         const value = dupKeyMatch[2];

         if (field === 'idNumber') {
           return res.status(409).json({
             success: false,
             error: `Trainer ID number "${value}" already exists. Please use a unique ID number.`,
             field: 'idNumber',
             suggestion: 'Check existing trainers or use a different ID number (e.g., TRN007)'
           });
         } else if (field === 'email') {
           return res.status(409).json({
             success: false,
             error: `Email "${value}" is already registered to another trainer.`,
             field: 'email',
             suggestion: 'Use a different email address or check if the trainer already exists'
           });
         }
       }

       return res.status(409).json({
         success: false,
         error: 'Duplicate value detected. This trainer already exists (same ID number or email).',
         suggestion: 'Please check the trainer ID number and email are unique'
       });
     }

     // Handle validation errors
     if (err.name === 'ValidationError') {
       const messages = [];
       for (const [key, val] of Object.entries(err.errors)) {
         messages.push(`${key}: ${val.message}`);
       }
       return res.status(400).json({
         success: false,
         error: 'Invalid data: ' + messages.join(', ')
       });
     }

     console.log('=== END UPDATE TRAINER REQUEST ===\n');
     res.status(500).json({ success: false, error: 'Error updating trainer: ' + err.message });
   }
});

// Delete trainer
app.post('/dashboard/trainer/delete', requireAuth, requirePermission('canDeleteStaff'), parseJson, async (req, res) => {
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

// ============ TRAINER STUDENT MANAGEMENT ROUTES ============

// GET trainer students page with filters
app.get('/trainer/students', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).render('404', { user: req.session.user, error: 'Trainer profile not found' });
    }

    // Get query params for filtering
    const { schoolId, section, status, search, sortBy = 'createdAt', order = 'desc' } = req.query;

    // Build query - students added by this trainer or from their assigned schools
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active')
      .map(a => a.schoolId);

    let query = {
      $or: [
        { addedBy: { trainerId: currentStaff._id } }, // Students added by this trainer
        ...(trainerSchoolIds.length > 0 ? [{ school: { $in: trainerSchoolIds } }] : [])
      ]
    };

    // Apply filters
    if (schoolId) {
      query.school = new mongoose.Types.ObjectId(schoolId);
    }
    if (section) {
      query.scoutSection = section;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        ...(query.$or || []),
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    const sortObj = {};
    const sortFields = ['createdAt', 'fullName', 'dateOfBirth', 'scoutSection', 'school'];
    if (sortFields.includes(sortBy)) {
      sortObj[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sortObj.createdAt = -1;
    }

    const students = await Student.find(query)
      .populate('school', 'name address.city contactPerson')
      .populate('addedBy.trainerId', 'name email')
      .sort(sortObj)
      .lean();

    // Get schools for filter dropdown
    const schools = await School.find({
      _id: { $in: trainerSchoolIds }
    }).select('_id name').sort({ name: 1 }).lean();

    // Calculate stats
    const stats = {
      total: students.length,
      bySection: {
        Sungura: students.filter(s => s.scoutSection === 'Sungura').length,
        Chipukizi: students.filter(s => s.scoutSection === 'Chipukizi').length,
        Mwamba: students.filter(s => s.scoutSection === 'Mwamba').length,
        Rover: students.filter(s => s.scoutSection === 'Rover').length
      }
    };

    res.render('trainer_students', {
      user: req.session.user,
      page: 'trainer_students',
      students,
      schools,
      stats,
      filters: { schoolId, section, status, search, sortBy, order }
    });
  } catch (err) {
    console.error('Error loading trainer students:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load students' });
  }
});

// GET student registration form
app.get('/trainer/students/new', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).render('404', { user: req.session.user, error: 'Trainer profile not found' });
    }

    // Get schools assigned to this trainer
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active')
      .map(a => a.schoolId);

    const schools = await School.find({
      _id: { $in: trainerSchoolIds }
    }).select('_id name').sort({ name: 1 }).lean();

    res.render('trainer_student_form', {
      user: req.session.user,
      page: 'trainer_student_form',
      schools,
      student: null,
      formTitle: 'Add New Student',
      submitUrl: '/api/trainer/students'
    });
  } catch (err) {
    console.error('Error loading student form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
});

// GET student edit form
app.get('/trainer/students/:studentId/edit', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).render('404', { user: req.session.user, error: 'Trainer profile not found' });
    }

    const student = await Student.findById(req.params.studentId)
      .populate('school', '_id name')
      .lean();

    if (!student) {
      return res.status(404).render('404', { user: req.session.user, error: 'Student not found' });
    }

    // Check if trainer has permission to edit this student
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active')
      .map(a => a.schoolId);

    const canEdit = student.addedBy?.trainerId?.toString() === currentStaff._id.toString() ||
                    trainerSchoolIds.includes(student.school?._id);

    if (!canEdit) {
      return res.status(403).render('404', { user: req.session.user, error: 'Access denied. You can only edit students you added or from your assigned schools.' });
    }

    // Get schools for dropdown
    const schools = await School.find({
      _id: { $in: trainerSchoolIds }
    }).select('_id name').sort({ name: 1 }).lean();

    res.render('trainer_student_form', {
      user: req.session.user,
      page: 'trainer_student_form',
      schools,
      student,
      formTitle: 'Edit Student',
      submitUrl: `/api/trainer/students/${student._id}`
    });
  } catch (err) {
    console.error('Error loading student edit form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
});

// POST create student
app.post('/api/trainer/students', requireAuth, parseJson, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Trainer profile not found' });
    }

    const {
      fullName,
      dateOfBirth,
      gender,
      parentPhone,
      parentEmail,
      parentName,
      schoolId,
      scoutSection,
      notes,
      medicalNotes,
      specialNeeds
    } = req.body;

    // Validation
    if (!fullName || !dateOfBirth || !gender || !parentPhone || !parentEmail || !schoolId || !scoutSection) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Validate school belongs to trainer's assigned schools
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active' && a.schoolId)
      .map(a => a.schoolId.toString());

    if (!trainerSchoolIds.includes(schoolId)) {
      return res.status(403).json({ success: false, error: 'You can only add students to your assigned schools' });
    }

    // Validate age range based on scout section
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    const ageRanges = {
      Sungura: { min: 6, max: 11 },
      Chipukizi: { min: 12, max: 15 },
      Mwamba: { min: 16, max: 18 },
      Rover: { min: 18, max: 99 }
    };

    const range = ageRanges[scoutSection];
    if (age < range.min || age > range.max) {
      return res.status(400).json({
        success: false,
        error: `Age mismatch`,
        message: `${scoutSection} section requires age between ${range.min}-${range.max} years. Student is ${age} years old.`
      });
    }

    // Create student
    const student = new Student({
      fullName: fullName.trim(),
      dateOfBirth: new Date(dateOfBirth),
      gender,
      parentContact: {
        phone: parentPhone.trim(),
        email: parentEmail.trim().toLowerCase(),
        name: parentName?.trim(),
        relationship: 'Parent'
      },
      school: schoolId,
      scoutSection,
      notes: notes?.trim(),
      medicalNotes: medicalNotes?.trim(),
      specialNeeds: specialNeeds?.trim(),
      addedBy: {
        trainerId: currentStaff._id,
        addedDate: new Date()
      }
    });

    await student.save();
    await student.populate('school', 'name address.city');
    await student.populate('addedBy.trainerId', 'name email');

    // Log audit
    await logAudit('student_created', 'student', student._id, student.fullName, { student }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, student, message: 'Student added successfully' });
  } catch (err) {
    console.error('Error creating student:', err);
    res.status(500).json({ success: false, error: 'Failed to create student: ' + err.message });
  }
});

// POST update student (using POST instead of PUT to avoid method override)
app.post('/api/trainer/students/:studentId', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Trainer profile not found' });
    }

    const studentId = req.params.studentId;
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Check permissions
    const canEdit = student.addedBy?.trainerId?.toString() === currentStaff._id.toString();
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active' && a.schoolId)
      .map(a => a.schoolId.toString());
    const isSchoolMember = trainerSchoolIds.includes(student.school?._id.toString());

    if (!canEdit && !isSchoolMember) {
      return res.status(403).json({ success: false, error: 'Access denied. You can only edit students you added or from your assigned schools.' });
    }

    const {
      fullName,
      dateOfBirth,
      gender,
      parentPhone,
      parentEmail,
      parentName,
      schoolId,
      scoutSection,
      notes,
      medicalNotes,
      specialNeeds,
      status
    } = req.body;

    // Validation for school
    if (schoolId && !trainerSchoolIds.includes(schoolId)) {
      return res.status(403).json({ success: false, error: 'You can only assign students to your assigned schools' });
    }

    // Age validation if DOB or section is being updated
    if (dateOfBirth || scoutSection) {
      const dob = dateOfBirth ? new Date(dateOfBirth) : student.dateOfBirth;
      const targetSection = scoutSection || student.scoutSection;

      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      const ageRanges = {
        Sungura: { min: 6, max: 11 },
        Chipukizi: { min: 12, max: 15 },
        Mwamba: { min: 16, max: 18 },
        Rover: { min: 18, max: 99 }
      };

      const range = ageRanges[targetSection];
      if (age < range.min || age > range.max) {
        return res.status(400).json({
          success: false,
          error: `Age mismatch`,
          message: `${targetSection} section requires age between ${range.min}-${range.max} years. Student is ${age} years old.`
        });
      }
    }

    // Update fields
    if (fullName !== undefined) student.fullName = fullName.trim();
    if (dateOfBirth) student.dateOfBirth = new Date(dateOfBirth);
    if (gender) student.gender = gender;
    if (parentPhone) student.parentContact.phone = parentPhone.trim();
    if (parentEmail) student.parentContact.email = parentEmail.trim().toLowerCase();
    if (parentName !== undefined) student.parentContact.name = parentName?.trim();
    if (schoolId) student.school = schoolId;
    if (scoutSection) student.scoutSection = scoutSection;
    if (notes !== undefined) student.notes = notes?.trim();
    if (medicalNotes !== undefined) student.medicalNotes = medicalNotes?.trim();
    if (specialNeeds !== undefined) student.specialNeeds = specialNeeds?.trim();
    if (status) student.status = status;

    await student.save();
    await student.populate('school', 'name address.city');
    await student.populate('addedBy.trainerId', 'name email');

    res.json({ success: true, student, message: 'Student updated successfully' });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

// POST delete student
app.post('/api/trainer/students/:studentId/delete', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Trainer profile not found' });
    }

    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Only the trainer who added the student can delete
    if (student.addedBy?.trainerId?.toString() !== currentStaff._id.toString()) {
      return res.status(403).json({ success: false, error: 'You can only delete students you added' });
    }

    await Student.findByIdAndDelete(req.params.studentId);

    // Log audit
    await logAudit('student_deleted', 'student', student._id, student.fullName, {}, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});


// GET student profile
app.get('/trainer/students/:studentId', requireAuth, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'trainer') {
    return res.redirect('/dashboard');
  }
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).render('404', { user: req.session.user, error: 'Trainer profile not found' });
    }

    const student = await Student.findById(req.params.studentId)
      .populate('school', 'name address.city contactPerson contactPerson.name contactPerson.email')
      .populate('addedBy.trainerId', 'name email idNumber')
      .lean();

    if (!student) {
      return res.status(404).render('404', { user: req.session.user, error: 'Student not found' });
    }

    // Check permissions
    const canView = student.addedBy?.trainerId?.toString() === currentStaff._id.toString();
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active' && a.schoolId)
      .map(a => a.schoolId.toString());
    const isSchoolMember = trainerSchoolIds.includes(student.school?._id.toString());

    if (!canView && !isSchoolMember) {
      return res.status(403).render('404', { user: req.session.user, error: 'Access denied' });
    }

    // Get participation records (events student attended via school)
    const participationRecords = await Event.aggregate([
      { $match: { 'targetSchools.schoolId': student.school._id, status: { $in: ['completed', 'in_progress'] } } },
      { $sort: { startDate: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 1,
          name: 1,
          startDate: 1,
          endDate: 1,
          eventType: 1,
          status: 1,
          schoolAttendance: {
            $filter: {
              input: '$targetSchools',
              as: 'ts',
              cond: { $eq: ['$$ts.schoolId', student.school._id] }
            }
          }
        }
      }
    ]);

    res.render('trainer_student_profile', {
      user: req.session.user,
      page: 'trainer_student_profile',
      student,
      participationRecords,
      canEdit: canView || isSchoolMember
    });
  } catch (err) {
    console.error('Error loading student profile:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load student profile' });
  }
});

// API: Get students for dropdown/autocomplete
app.get('/api/trainer/students', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Trainer profile not found' });
    }

    const { schoolId, section, limit = 50 } = req.query;

    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active')
      .map(a => a.schoolId);

    let query = {
      $or: [
        { addedBy: { trainerId: currentStaff._id } },
        ...(trainerSchoolIds.length > 0 ? [{ school: { $in: trainerSchoolIds } }] : [])
      ]
    };

    if (schoolId) query.school = new mongoose.Types.ObjectId(schoolId);
    if (section) query.scoutSection = section;

    const students = await Student.find(query)
      .populate('school', 'name')
      .select('fullName dateOfBirth scoutSection school')
      .sort({ fullName: 1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, students });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// API: Export students (CSV/PDF)
app.get('/api/trainer/students/export', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Trainer profile not found' });
    }

    const { format = 'csv', schoolId, section, status } = req.query;

    // Build same query as list
    const trainerSchoolIds = (currentStaff.assignedSchools || [])
      .filter(a => a.status === 'active')
      .map(a => a.schoolId);

    let query = {
      $or: [
        { addedBy: { trainerId: currentStaff._id } },
        ...(trainerSchoolIds.length > 0 ? [{ school: { $in: trainerSchoolIds } }] : [])
      ]
    };

    if (schoolId) query.school = new mongoose.Types.ObjectId(schoolId);
    if (section) query.scoutSection = section;
    if (status) query.status = status;

    const students = await Student.find(query)
      .populate('school', 'name')
      .populate('addedBy.trainerId', 'name')
      .sort({ fullName: 1 })
      .lean();

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      const fields = [
        'fullName',
        'dateOfBirth',
        'age',
        'gender',
        'scoutSection',
        'school.name',
        { label: 'parentName', value: 'parentContact.name' },
        { label: 'parentPhone', value: 'parentContact.phone' },
        { label: 'parentEmail', value: 'parentContact.email' },
        { label: 'addedBy', value: row => row.addedBy?.trainerId?.name || 'System' },
        'status',
        'createdAt'
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(students);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="students-${new Date().toISOString().split('T')[0]}.csv"`);

      return res.send(csv);
    } else if (format === 'pdf') {
      // PDF generation
      const PDFDocument = require('pdfkit');
      const path = require('path');
      const fs = require('fs');
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="students-${new Date().toISOString().split('T')[0]}.pdf"`);

      doc.pipe(res);

      // Fetch organization settings for branding
      const systemSettings = await SystemSettings.findOne({ _id: 'global-settings' });
      const org = systemSettings?.organization || {};

      let currentY = 50;
      const pageWidth = doc.page.width;

      // Add logo if available
      const logoWidth = org.logoWidth || 40;
      if (org.logoUrl) {
        let imagePath = org.logoUrl;
        let imageLoaded = false;

        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          try {
            const x = (pageWidth - logoWidth) / 2;
            doc.image(imagePath, x, currentY, { width: logoWidth });
            imageLoaded = true;
          } catch (err) {
            console.warn('Failed to load external logo:', err);
          }
        } else {
          // Local file within public directory
          const relativePath = imagePath.replace(/^\//, '');
          const absolutePath = path.join(__dirname, '..', 'public', relativePath);
          if (fs.existsSync(absolutePath)) {
            try {
              const x = (pageWidth - logoWidth) / 2;
              doc.image(absolutePath, x, currentY, { width: logoWidth });
              imageLoaded = true;
            } catch (err) {
              console.warn('Failed to load local logo:', err);
            }
          } else {
            console.warn('Logo file not found:', absolutePath);
          }
        }

        if (imageLoaded) {
          currentY += logoWidth + 15;
          doc.y = currentY;
        }
      }

      // Organization name as heading
      doc.fontSize(20).text(org.organizationName || 'Student List', { align: 'center' });
      if (org.tagline) {
        doc.fontSize(10).text(org.tagline, { align: 'center' });
      }
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Filter info
      doc.fontSize(10);
      if (schoolId) {
        const school = await School.findById(schoolId);
        if (school) doc.text(`School: ${school.name}`);
      }
      if (section) doc.text(`Section: ${section}`);
      doc.moveDown();

      // Table headers
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 150;
      const col3 = 250;
      const col4 = 350;
      const col5 = 450;

      doc.font('Helvetica-Bold');
      doc.text('Name', col1, tableTop);
      doc.text('Age', col2, tableTop);
      doc.text('Section', col3, tableTop);
      doc.text('School', col4, tableTop);
      doc.text('Status', col5, tableTop);

      doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

      // Table rows
      doc.font('Helvetica');
      let y = tableTop + 30;
      for (const s of students) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(s.fullName, col1, y);
        doc.text(s.age.toString(), col2, y);
        doc.text(s.scoutSection, col3, y);
        doc.text(s.school?.name || '-', col4, y);
        doc.text(s.status, col5, y);
        y += 20;
      }

      doc.end();
    } else {
      return res.status(400).json({ success: false, error: 'Invalid export format' });
    }
  } catch (err) {
    console.error('Error exporting students:', err);
    res.status(500).json({ success: false, error: 'Failed to export students' });
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
app.post('/dashboard/trainer/allocate-schools', requireAuth, requirePermission('canAssignTrainers'), parseJson, async (req, res) => {
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

    let schoolList = await School.find(query)
      .populate('programsEnrolled', 'name category price duration')
      .sort(sortObj)
      .lean();

    // For trainers, filter to assigned schools
    if (req.session.user.role === 'trainer') {
      schoolList = schoolList.filter(s => s.assignedStaff && s.assignedStaff.some(a => a.staffId && a.staffId.toString() === req.session.user.id));
    }

    // Enrich with participation metrics
    const schoolIds = schoolList.map(s => s._id);
    const schoolEventAggregates = await Event.aggregate([
      { $match: { 'targetSchools.schoolId': { $in: schoolIds } } },
      {
        $group: {
          _id: '$targetSchools.schoolId',
          eventCount: { $sum: 1 },
          avgAttendance: { $avg: '$participationMetrics.averageAttendanceRate' }
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

     // Fetch all active programs for onboarding modal
     const allPrograms = await Program.find({ status: 'active' })
       .select('_id name price duration')
       .sort({ name: 1 })
       .lean();

     res.render('dashboard', {
       user: req.session.user,
       page: 'schools',
       schoolList,
       staffList,
       allPrograms,
       filters: { status, serviceStatus, zone, region, search },
       sortBy, order
     });
  } catch (err) {
    console.error('Error loading schools page:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// School onboarding wizard submission
app.post('/dashboard/schools/onboard', requireAuth, requirePermission('canCreateSchools'), parseJson, async (req, res) => {
  try {
    const {
      name, street, city, state, zipCode, country, zone, region,
      contactName, contactEmail, contactPhone, contactPosition,
      studentCount, programId, paymentMethod, billingCycle,
      primaryTrainerId, notes
    } = req.body;

    // Validate required program selection
    if (!programId) {
      return res.status(400).json({ success: false, error: 'Please select a program' });
    }

    let ratePerStudent = null;
    const validLegacyPackages = ['basic', 'standard', 'premium', 'custom'];
    const packagePrices = { basic: 500, standard: 750, premium: 1000, custom: 0 };

    // Check if programId is a valid ObjectId (new program-based flow)
    const isObjectId = mongoose.Types.ObjectId.isValid(programId);
    
    if (isObjectId) {
      // New flow: programId references a Program document
      const program = await Program.findById(programId);
      if (!program) {
        return res.status(404).json({ success: false, error: 'Selected program not found' });
      }
      ratePerStudent = program.price.amount || 0;
    } else if (validLegacyPackages.includes(programId)) {
      // Legacy fallback: programId is actually a servicePackage name
      ratePerStudent = packagePrices[programId] || 0;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid program selection' });
    }

    const trainerObjectId = primaryTrainerId ? new mongoose.Types.ObjectId(primaryTrainerId) : null;

    // Build school object
    const schoolData = {
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
      paymentTerms: {
        method: paymentMethod || 'bank_transfer',
        billingCycle: billingCycle || 'weekly',
        ratePerStudent: ratePerStudent > 0 ? ratePerStudent : null
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
    };

    // Handle program vs legacy servicePackage
    if (isObjectId) {
      schoolData.programsEnrolled = [new mongoose.Types.ObjectId(programId)];
      schoolData.servicePackage = 'standard'; // default
    } else {
      // Legacy: store in servicePackage field
      schoolData.servicePackage = programId;
      schoolData.programsEnrolled = [];
    }

    const school = new School(schoolData);
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

    // Validate schoolId format
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).render('404', { user: req.session.user, error: 'Invalid school identifier' });
    }

    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).render('404', { user: req.session.user, error: 'School not found' });
    }

    // Populate assigned staff with validation of staff IDs
    if (school.assignedStaff && Array.isArray(school.assignedStaff)) {
      const staffIds = school.assignedStaff
        .map(a => a?.staffId?.toString())
        .filter(id => id && mongoose.Types.ObjectId.isValid(id));
      let staffMap = new Map();
      if (staffIds.length > 0) {
        const staffList = await Staff.find({ _id: { $in: staffIds } })
          .select('name email idNumber role')
          .lean();
        staffMap = new Map(staffList.map(s => [s._id.toString(), s]));
      }
      school.assignedStaff = school.assignedStaff
        .map(a => {
          const staffId = a?.staffId?.toString();
          if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) return null;
          const staff = staffMap.get(staffId);
          return staff ? { ...staff, assignmentType: a.assignmentType, assignedDate: a.assignedDate } : null;
        })
        .filter(Boolean);
    }

    // Scout groups
    const scoutGroups = await ScoutGroup.find({ schoolId: new mongoose.Types.ObjectId(schoolId) })
      .sort({ name: 1 }).lean();

    // Event participation history
    const schoolEvents = await Event.find(
      { 'targetSchools.schoolId': new mongoose.Types.ObjectId(schoolId) },
      { name: 1, startDate: 1, location: 1, eventType: 1, 'targetSchools.$': 1 }
    )
      .sort({ startDate: -1 })
      .lean();

    // Payment history
    const payments = await Payment.find({ schoolId: new mongoose.Types.ObjectId(schoolId) })
      .sort({ paymentDate: -1 }).limit(10).lean();

    // Documents
    const documents = await SchoolDocument.find({ schoolId: new mongoose.Types.ObjectId(schoolId), isActive: true })
      .sort({ uploadedAt: -1 }).lean();

    // Visit logs
    const visitLogs = await VisitLog.find({ schoolId: new mongoose.Types.ObjectId(schoolId) })
      .sort({ date: -1 }).limit(20).lean();

    // Program enrollments - validate IDs before query
    const programIds = (school.programsEnrolled || [])
      .filter(id => mongoose.Types.ObjectId.isValid(id));
    const programs = programIds.length > 0
      ? await Program.find({ _id: { $in: programIds } }).lean()
      : [];

    // Calculate participation analytics
    const totalEvents = schoolEvents.length;
    const totalAttended = schoolEvents.filter(se => se.targetSchools?.[0]?.status === 'attended').length;
    const avgAttendance = schoolEvents.length
      ? Math.round(schoolEvents.reduce((sum, se) => sum + (se.targetSchools?.[0]?.attendancePercentage || 0), 0) / schoolEvents.length)
      : 0;

     // Fetch staff list for compose dropdown
     const staffList = await Staff.find({ status: { $ne: 'Inactive' } })
       .select('_id name email role')
       .sort({ name: 1 })
       .lean();

     // Fetch all active programs for onboarding modal
     const allPrograms = await Program.find({ status: 'active' })
       .select('_id name price duration')
       .sort({ name: 1 })
       .lean();

     res.render('dashboard', {
       user: req.session.user,
       page: 'school-profile',
       school,
       scoutGroups,
       schoolEvents: schoolEvents.map(event => ({
         ...event,
         eventName: event.name,
         eventDate: event.startDate,
         location: event.location,
         status: event.targetSchools?.[0]?.status || 'invited'
       })),
       payments,
       documents,
       visitLogs,
       programs,
       allPrograms,
       staffList,
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

// GET: School edit form page (for admins/founders)
app.get('/dashboard/schools/:schoolId/edit', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).render('404', { user: req.session.user, error: 'Invalid school identifier' });
    }

     const school = await School.findById(schoolId).lean();
     if (!school) {
       return res.status(404).render('404', { user: req.session.user, error: 'School not found' });
     }

     // Fetch all active programs for onboarding modal
     const allPrograms = await Program.find({ status: 'active' })
       .select('_id name price duration')
       .sort({ name: 1 })
       .lean();

     res.render('dashboard', {
       user: req.session.user,
       page: 'school-edit',
       school,
       allPrograms
     });
  } catch (err) {
    console.error('Error loading school edit form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load edit form' });
   }
 });

// GET schools list for dropdowns  -- MUST be before /api/schools/:schoolId so Express matches first
app.get('/api/schools/list', requireAuth, requirePermission('canViewSchools'), async (req, res) => {
  try {
    const schools = await School.find({ status: { $ne: 'inactive' } })
      .select('name address city contactPerson')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, schools });
  } catch (err) {
    console.error('Error fetching schools list:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch schools' });
  }
});

// Get all active schools with full details (for reports, modals)
app.get('/api/schools/active', requireAuth, requirePermission('canViewSchools'), async (req, res) => {
  console.log('[/api/schools/active] req.user:', req.session.user?.role, '| canViewSchools permission check...');
  try {
    const schools = await School.find({ $or: [{ serviceStatus: 'active' }, { serviceStatus: { $exists: false }, status: 'active' }] })
      .populate('programsEnrolled', 'name category price duration')
      .select('name address city zone region contactPerson studentCount serviceStatus servicePackage programsEnrolled participationMetrics createdAt')
      .sort({ name: 1 })
      .lean();

    // Enrich with participation metrics
    const schoolIds = schools.map(s => s._id);
    const eventAggregates = await Event.aggregate([
      { $match: { 'targetSchools.schoolId': { $in: schoolIds } } },
      {
        $group: {
          _id: '$targetSchools.schoolId',
          eventCount: { $sum: 1 },
          avgAttendance: { $avg: '$participationMetrics.averageAttendanceRate' }
        }
      }
    ]);
    const eventMap = new Map(eventAggregates.map(a => [a._id.toString(), a]));

    const enrichedSchools = schools.map(school => ({
      ...school,
      participationMetrics: {
        ...(school.participationMetrics || {}),
        totalEventsAttended: eventMap.get(school._id.toString())?.eventCount || 0,
        averageAttendanceRate: Math.round(eventMap.get(school._id.toString())?.avgAttendance || 0),
        engagementScore: Math.min(100, Math.round(((eventMap.get(school._id.toString())?.eventCount || 0) * 10) + (eventMap.get(school._id.toString())?.avgAttendance || 0)))
      }
    }));

    res.json({ success: true, schools: enrichedSchools });
  } catch (err) {
    console.error('Error fetching active schools:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch active schools' });
  }
});


// GET: Fetch single school details
app.get('/api/schools/:schoolId', requireAuth, requirePermission('canViewSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    res.json({ success: true, school });
  } catch (err) {
    console.error('Error fetching school:', err);
    res.status(500).json({ success: false, error: 'Failed to load school' });
  }
});

// POST: Update school details (full edit for admins/founders) - supports onboarding-style data
app.post('/api/schools/:schoolId/update', requireAuth, requirePermission('canEditSchools'), parseJson, async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

    // Fetch the existing school
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    let {
      name,
      street, city, state, zipCode, country,
      zone, region,
      contactName, contactEmail, contactPhone, contactPosition,
      programId,
      servicePackage, // legacy field, still supported for backwards compatibility
      notes,
      studentCount,
      paymentMethod,
      billingCycle,
      ratePerStudent,
      primaryTrainerId
    } = req.body;

    // Basic info
    if (name !== undefined && name.trim() !== '') {
      school.name = name.trim();
    }

    // Address - ensure address object exists
    if (!school.address) school.address = {};
    if (street !== undefined) school.address.street = street.trim();
    if (city !== undefined) school.address.city = city.trim();
    if (state !== undefined) school.address.state = state.trim();
    if (zipCode !== undefined) school.address.zipCode = zipCode.trim();
    if (country !== undefined) school.address.country = country.trim();

    // Geographic
    if (zone !== undefined) school.zone = zone.trim();
    if (region !== undefined) school.region = region.trim();

      // Program enrollment - if programId provided, fetch program price and update enrollment
      if (programId) {
        const validLegacyPackages = ['basic', 'standard', 'premium', 'custom'];
        const packagePrices = { basic: 500, standard: 750, premium: 1000, custom: 0 };
        const isObjectId = mongoose.Types.ObjectId.isValid(programId);
        
        if (isObjectId) {
          // New flow: programId references a Program document
          const program = await Program.findById(programId);
          if (!program) {
            return res.status(404).json({ success: false, error: 'Program not found' });
          }
          // Set rate from program price if not explicitly provided
          if (ratePerStudent === undefined || ratePerStudent === '' || ratePerStudent === null) {
            ratePerStudent = program.price.amount;
          }
          // Replace programsEnrolled with this single program
          school.programsEnrolled = [new mongoose.Types.ObjectId(programId)];
          // Set servicePackage to default or keep existing
          school.servicePackage = school.servicePackage || 'standard';
        } else if (validLegacyPackages.includes(programId)) {
          // Legacy fallback: use servicePackage field
          if (ratePerStudent === undefined || ratePerStudent === '' || ratePerStudent === null) {
            ratePerStudent = packagePrices[programId] || 0;
          }
          school.servicePackage = programId;
          school.programsEnrolled = [];
        } else {
          return res.status(400).json({ success: false, error: 'Invalid program selection' });
        }
      }

      // Service package - only update if explicitly provided (legacy support)
      if (servicePackage !== undefined) {
        const validPackages = ['basic', 'standard', 'premium', 'custom'];
        if (validPackages.includes(servicePackage)) {
          school.servicePackage = servicePackage;
        }
      }
      // If not provided, leave existing value unchanged (do not reset to default)

     // Notes
     if (notes !== undefined) {
       school.notes = notes.trim();
     }


     // Student count
     if (studentCount !== undefined) {
       school.studentCount = parseInt(studentCount) || 0;
     }

     // Payment terms - ensure object exists
     if (!school.paymentTerms) school.paymentTerms = {};
     if (paymentMethod !== undefined) {
       school.paymentTerms.method = paymentMethod;
     }
     if (billingCycle !== undefined) {
       school.paymentTerms.billingCycle = billingCycle;
     }
     if (ratePerStudent !== undefined) {
       school.paymentTerms.ratePerStudent = ratePerStudent ? parseFloat(ratePerStudent) : null;
     }

    // Primary trainer assignment - preserve other assignments
    if (primaryTrainerId) {
      if (!mongoose.Types.ObjectId.isValid(primaryTrainerId)) {
        return res.status(400).json({ success: false, error: 'Invalid trainer ID' });
      }
      const trainerObjectId = new mongoose.Types.ObjectId(primaryTrainerId);
      // Ensure assignedStaff is an array
      if (!Array.isArray(school.assignedStaff)) {
        school.assignedStaff = [];
      }
      const primaryIndex = school.assignedStaff.findIndex(a => a.assignmentType === 'primary');
      const newAssignment = {
        staffId: trainerObjectId,
        assignmentType: 'primary',
        assignedDate: primaryIndex >= 0 ? school.assignedStaff[primaryIndex].assignedDate : new Date(),
        status: 'active'
      };
      if (primaryIndex >= 0) {
        school.assignedStaff[primaryIndex] = newAssignment;
      } else {
        school.assignedStaff.push(newAssignment);
      }
    }

    // Save the updated school
    await school.save();

    // Return updated school as plain object
    res.json({ success: true, school: school.toObject(), message: 'School updated successfully' });
   } catch (err) {
    console.error('Update school error:', err);
    res.status(500).json({ success: false, error: 'Failed to update school: ' + err.message });
  }
});

// POST: Quick update school status (status + serviceStatus)
app.post('/api/schools/:schoolId/status', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { status, serviceStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const allowedStatuses = ['active', 'inactive', 'pending'];
    const allowedServiceStatuses = ['active', 'on_hold', 'churned'];

    if (status && allowedStatuses.includes(status)) {
      school.status = status;
    }
    if (serviceStatus && allowedServiceStatuses.includes(serviceStatus)) {
      school.serviceStatus = serviceStatus;
    }

    await school.save();

    res.json({ success: true, school: { status: school.status, serviceStatus: school.serviceStatus } });
  } catch (err) {
    console.error('Error updating school status:', err);
    res.status(500).json({ success: false, error: 'Failed to update school status: ' + err.message });
  }
});

// POST: Delete a school (admin/founder only)
app.post('/api/schools/:schoolId/delete', requireAuth, requirePermission('canDeleteSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const schoolName = school.name;

    // Remove school from all programs' enrolled lists
    const programIds = (school.programsEnrolled || []).map(id => id.toString());
    if (programIds.length > 0) {
      await Program.updateMany(
        { _id: { $in: programIds } },
        { $pull: { schools: new mongoose.Types.ObjectId(schoolId) } }
      );
    }

    await School.findByIdAndDelete(schoolId);

    await logAudit('school_deleted', 'school', schoolId, schoolName, {}, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email
    });

    res.json({ success: true, message: `School "${schoolName}" deleted successfully` });
  } catch (err) {
    console.error('Error deleting school:', err);
    res.status(500).json({ success: false, error: 'Failed to delete school: ' + err.message });
  }
});

// POST: Bulk update school program enrollments
app.post('/api/schools/:schoolId/update-programs', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { programIds } = req.body; // array of program ObjectId strings

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    // Validate programIds array: filter valid ObjectIds and verify programs exist
    let validProgramIds = [];
    if (Array.isArray(programIds)) {
      const objectIdPrograms = programIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      const validPrograms = await Program.find({ _id: { $in: objectIdPrograms } }).select('_id').lean();
      validProgramIds = validPrograms.map(p => p._id);
    }

    // Get old program IDs before update (as strings)
    const oldProgramIds = (school.programsEnrolled || []).map(id => id.toString());

    // Update school programsEnrolled
    school.programsEnrolled = validProgramIds;
    await school.save();

    // Sync Program.schools arrays: for each affected program (old or new), update its schools list
    const allAffectedProgramIds = [...new Set([...oldProgramIds, ...validProgramIds.map(id => id.toString())])];
    const programsToUpdate = await Program.find({ _id: { $in: allAffectedProgramIds } });

    for (const program of programsToUpdate) {
      const progIdStr = program._id.toString();
      const isInNewList = validProgramIds.some(id => id.toString() === progIdStr);
      if (isInNewList) {
        if (!program.schools) program.schools = [];
        if (!program.schools.includes(schoolId)) {
          program.schools.push(schoolId);
        }
      } else {
        // Remove school from program
        if (program.schools) {
          program.schools = program.schools.filter(id => id.toString() !== schoolId);
        }
      }
      await program.save();
    }

    // Return updated school with populated programs
    const updatedSchool = await School.findById(schoolId)
      .populate('programsEnrolled', 'name category price duration')
      .lean();

    res.json({ success: true, school: updatedSchool, message: 'Program allocations updated successfully' });
  } catch (err) {
    console.error('Error updating school programs:', err);
    res.status(500).json({ success: false, error: 'Failed to update school programs' });
  }
});

// GET: Fetch school data for onboarding edit mode
app.get('/api/schools/:schoolId/onboard-data', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).json({ success: false, error: 'Invalid school identifier' });
    }

    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    // Transform school data to match onboarding form field names
    const primaryTrainer = school.assignedStaff && school.assignedStaff.find(a => a.assignmentType === 'primary');
    // Get first enrolled program (if any); fallback to servicePackage for legacy schools
    let programId = '';
    if (school.programsEnrolled && school.programsEnrolled.length > 0) {
        programId = school.programsEnrolled[0].toString();
    } else if (school.servicePackage) {
        // Legacy: use servicePackage as the program identifier for backwards compatibility
        programId = school.servicePackage;
    }
    const onboardData = {
      name: school.name,
      street: school.address?.street || '',
      city: school.address?.city || '',
      state: school.address?.state || '',
      zipCode: school.address?.zipCode || '',
      country: school.address?.country || 'Kenya',
      zone: school.zone || '',
      region: school.region || '',
      contactName: school.contactPerson?.name || '',
      contactEmail: school.contactPerson?.email || '',
      contactPhone: school.contactPerson?.phone || '',
      contactPosition: school.contactPerson?.position || '',
      studentCount: school.studentCount || 0,
      programId: programId,
      paymentMethod: school.paymentTerms?.method || 'bank_transfer',
      billingCycle: school.paymentTerms?.billingCycle || 'weekly',
      ratePerStudent: school.paymentTerms?.ratePerStudent || '',
      primaryTrainerId: primaryTrainer?.staffId?.toString() || '',
      notes: school.notes || ''
    };

    res.json({ success: true, data: onboardData });
  } catch (err) {
    console.error('Error fetching school onboard data:', err);
    res.status(500).json({ success: false, error: 'Failed to load school data' });
  }
});

// API: Record school event participation
app.post('/api/school-events', requireAuth, requirePermission('canCreateEvents'), async (req, res) => {
  try {
    const { schoolId, eventId, participantsCount, primaryContact, assignedStaff, notes } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    // Update Event document's targetSchools array for this school
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Find or create school entry in targetSchools
    let schoolTarget = event.targetSchools.find(s => s.schoolId.toString() === schoolId);
    if (schoolTarget) {
      // Update existing
      schoolTarget.participantsCount = participantsCount;
      schoolTarget.primaryContact = primaryContact;
      schoolTarget.assignedStaff = assignedStaff || [];
      schoolTarget.notes = notes;
    } else {
      // Add new
      event.targetSchools.push({
        schoolId,
        participantsCount,
        primaryContact,
        assignedStaff: assignedStaff || [],
        notes,
        status: 'registered',
        attendancePercentage: 0
      });
    }
    await event.save();

    // Update school metrics
    await School.findByIdAndUpdate(schoolId, {
      $inc: { 'participationMetrics.totalEventsAttended': 1 },
      $set: { 'participationMetrics.lastEventDate': new Date() }
    });

    res.json({ success: true, event });
  } catch (err) {
    console.error('Error recording school event:', err);
    res.status(500).json({ success: false, error: 'Failed to record participation' });
  }
});

// API: Update school event attendance (replaces broken SchoolEvent reference)
app.post('/api/events/:eventId/attendance', requireAuth, requirePermission('canEditEvents'), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { schoolId, attended } = req.body;

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'schoolId is required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Find the school in targetSchools
    const schoolIndex = event.targetSchools.findIndex(s => s.schoolId.toString() === schoolId);
    if (schoolIndex === -1) {
      return res.status(404).json({ success: false, error: 'School not invited to this event' });
    }

    // Update attendance
    event.targetSchools[schoolIndex].attendance = event.targetSchools[schoolIndex].attendance || {};
    event.targetSchools[schoolIndex].attendance.attended = attended;
    event.targetSchools[schoolIndex].attendance.recordedAt = new Date();
    event.targetSchools[schoolIndex].attendance.recordedBy = req.session.user.id;

    // Calculate percentage if we have registered count
    const registered = event.targetSchools[schoolIndex].numberOfParticipants || 0;
    if (registered > 0) {
      event.targetSchools[schoolIndex].attendance.percentage = Math.round((attended / registered) * 100);
      event.targetSchools[schoolIndex].attendance.registered = registered;
    } else {
      event.targetSchools[schoolIndex].attendance.percentage = 0;
      event.targetSchools[schoolIndex].attendance.registered = 0;
    }

    await event.save();

    // Log audit
    await logAudit('attendance_updated', 'event', eventId, event.name, {
      schoolId,
      attended,
      registered
    }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, event });
  } catch (err) {
    console.error('Error updating attendance:', err);
    res.status(500).json({ success: false, error: 'Failed to update attendance' });
  }
});

// API: Get school payment history
app.get('/api/schools/:schoolId/payments', requireAuth, async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).json({ error: 'Invalid school identifier' });
    }

    const { status, startDate, endDate } = req.query;

    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
    let query = { schoolId: schoolObjectId };
    if (status) query.status = status;
    if (startDate) query.paymentDate = { ...query.paymentDate, $gte: new Date(startDate) };
    if (endDate) query.paymentDate = { ...query.paymentDate, $lte: new Date(endDate) };

    const payments = await Payment.find(query).sort({ paymentDate: -1 }).lean();

    // Compute summary: total amount of payments, overdue pending payments count
    const rawSummary = await Payment.aggregate([
      { $match: { schoolId: schoolObjectId } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          overdueCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'pending'] }, { $lt: ['$dueDate', new Date()] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const summary = {
      totalAmount: rawSummary[0]?.totalAmount || 0,
      totalPaid: rawSummary[0]?.totalAmount || 0, // all recorded payments are considered paid (status completed)
      totalOutstanding: 0, // payments don't have outstanding balance; derived from invoices
      overdueCount: rawSummary[0]?.overdueCount || 0
    };

    res.json({
      payments,
      summary
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

    // Validate required IDs
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }
    if (eventBooked && !mongoose.Types.ObjectId.isValid(eventBooked)) {
      return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

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

    // Send payment received notification to relevant users (school contact, admins)
    try {
      const school = await School.findById(schoolId);
      const event = eventBooked ? await Event.findById(eventBooked) : null;

      // Get current staff for notifications
      const currentStaff = await getCurrentStaff(req);

      // Notify school contact
      if (school?.contactPerson?.email) {
        await emailService.sendEmail({
          to: school.contactPerson.email,
          subject: 'Payment Confirmation',
          html: `
            <h2>Payment Received</h2>
            <p>Dear ${school.contactPerson.name || 'School Representative'},</p>
            <p>We have received your payment:</p>
            <ul>
              <li><strong>Amount:</strong> KES ${amount.toLocaleString()}</li>
              <li><strong>Invoice:</strong> ${invoiceNumber || 'N/A'}</li>
              <li><strong>Date:</strong> ${new Date(paymentDate).toLocaleDateString()}</li>
              ${programBooked ? `<li><strong>Program:</strong> ${programBooked}</li>` : ''}
              ${event ? `<li><strong>Event:</strong> ${event.name}</li>` : ''}
            </ul>
            <p>Thank you for your payment.</p>
          `,
          templateId: 'payment_received',
          templateData: {
            recipientName: school.contactPerson.name,
            amount: amount,
            reference: reference || invoiceNumber,
            description: programBooked || event?.name || 'Payment'
          },
          entityType: 'payment',
          entityId: payment._id,
          triggerReason: 'payment_received',
          priority: 'normal'
        });
      }

      // Also send notification to the user who recorded the payment (confirmation)
      if (currentStaff) {
        await Notification.create({
          recipientId: currentStaff._id,
          type: 'payment_received',
          title: 'Payment Recorded',
          message: `Payment of KES ${amount.toLocaleString()} recorded for ${school?.name || 'school'}`,
          entityType: 'payment',
          entityId: payment._id,
          priority: 'normal'
        });
      }

    } catch (notifErr) {
      console.error('Notification error for payment:', notifErr);
    }

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

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).json({ error: 'Invalid school identifier' });
    }

    const { documentType } = req.query;

    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
    const query = { schoolId: schoolObjectId, isActive: true };
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

    // Top schools by engagement (most events) - aggregate from Event.targetSchools
    const topEngaged = await Event.aggregate([
      { $unwind: '$targetSchools' },
      { $group: { _id: '$targetSchools.schoolId', eventCount: { $sum: 1 } } },
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

// Note: Old event creation route removed. Use POST /dashboard/events/create instead.

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

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

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

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid school ID' });
    }

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
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).json({ error: 'Invalid school identifier' });
    }

    const school = await School.findById(schoolId).select('scoutGroups').lean();
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
    const { schoolId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(404).json({ error: 'Invalid school identifier' });
    }

    const logs = await VisitLog.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      trainerId: req.session.user.id
    }).sort({ date: -1 }).lean();
    res.json({ logs });
  } catch (err) {
    console.error('Error fetching visit logs:', err);
    res.status(500).json({ error: 'Failed to fetch visit logs' });
  }
});

// ============ REPORTS DASHBOARD ROUTES ============

// Trainer Performance Report page now redirects into analytics
app.get('/dashboard/reports/trainers', requireAuth, async (req, res) => {
  try {
    if (req.session.user && req.session.user.role === 'trainer') {
      return res.redirect('/trainer/dashboard');
    }
    const perm = await Permission.findOne({ role: req.session.user.role });
    if (!perm || !perm.permissions.canViewAnalytics) {
      return res.status(403).render('404', { user: req.session.user, error: 'Access denied. Insufficient permissions.' });
    }
    return res.redirect('/dashboard/analytics#trainer-performance');
  } catch (err) {
    console.error('Trainer performance redirect error:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// Event Effectiveness Report page now redirects into analytics
app.get('/dashboard/reports/events', requireAuth, async (req, res) => {
  try {
    if (req.session.user && req.session.user.role === 'trainer') {
      return res.redirect('/trainer/dashboard');
    }
    const perm = await Permission.findOne({ role: req.session.user.role });
    if (!perm || !perm.permissions.canViewAnalytics) {
      return res.status(403).render('404', { user: req.session.user, error: 'Access denied. Insufficient permissions.' });
    }
    return res.redirect('/dashboard/analytics#event-engagement');
  } catch (err) {
    console.error('Event effectiveness redirect error:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// School Engagement Report page now redirects into analytics
app.get('/dashboard/reports/schools', requireAuth, async (req, res) => {
  try {
    if (req.session.user && req.session.user.role === 'trainer') {
      return res.redirect('/trainer/dashboard');
    }
    const perm = await Permission.findOne({ role: req.session.user.role });
    if (!perm || !perm.permissions.canViewAnalytics) {
      return res.status(403).render('404', { user: req.session.user, error: 'Access denied. Insufficient permissions.' });
    }
    return res.redirect('/dashboard/analytics#school-participation');
  } catch (err) {
    console.error('School engagement redirect error:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// Custom Report Builder page
app.get('/dashboard/reports/builder', requireAuth, async (req, res) => {
  try {
    if (req.session.user && req.session.user.role === 'trainer') {
      return res.redirect('/trainer/dashboard');
    }
    const perm = await Permission.findOne({ role: req.session.user.role });
    if (!perm || !perm.permissions.canGenerateReports) {
      return res.status(403).render('404', { user: req.session.user, error: 'Access denied. Insufficient permissions.' });
    }
    const schools = await School.find({}).select('name _id').sort({ name: 1 }).lean();
    const trainers = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor'] } }).select('name _id').sort({ name: 1 }).lean();
    const events = await Event.distinct('eventType');
    return res.render('reports/custom_builder', { user: req.session.user, schools, trainers, eventTypes: events, page: 'reports-builder' });
   } catch (err) {
     console.error('Custom report builder error:', err);
     res.status(500).render('404', { user: req.session.user });
   }
 });

// ============ COMMUNICATION PAGE ROUTES ============
// Redirect old routes to dashboard - notifications are now in dropdown
app.get('/dashboard/messages', requireAuth, (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard/announcements', requireAuth, (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard/settings', requireAuth, async (req, res) => {
  try {
    const permission = await Permission.findOne({ role: req.session.user.role });
    res.render('settings', {
      user: req.session.user,
      page: 'settings',
      permission: permission ? permission.permissions : {}
    });
  } catch (err) {
    console.error('Settings page error:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

// ============ END COMMUNICATION PAGE ROUTES ============

app.get('/dashboard/:page', requireAuth, async (req, res) => {
  try {
    const page = req.params.page;

    // If trainer role, redirect
    if (req.session.user && req.session.user.role === 'trainer') {
      return res.redirect('/trainer/dashboard');
    }

    // Handle analytics and report pages with permission checks
    if (page === 'analytics' || page === 'reports-trainers' || page === 'reports-events' || page === 'reports-schools') {
      const perm = await Permission.findOne({ role: req.session.user.role });
      if (!perm || !perm.permissions.canViewAnalytics) {
        return res.status(403).render('404', { user: req.session.user, error: 'Access denied. Insufficient permissions.' });
      }
    }
    if (page === 'reports-builder') {
      const perm = await Permission.findOne({ role: req.session.user.role });
      if (!perm || !perm.permissions.canGenerateReports) {
        return res.status(403).render('404', { user: req.session.user, error: 'Access denied. Insufficient permissions.' });
      }
    }

    if (page === 'reports-trainers') {
      const trainers = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor'] } })
        .select('name email idNumber role status')
        .sort({ name: 1 })
        .lean();
      return res.render('reports/trainer_performance', { user: req.session.user, trainers, page });
    }
    if (page === 'reports-events') {
      const Event = require('./models/Event');
      const eventTypes = await Event.distinct('eventType');
      return res.render('reports/event_effectiveness', { user: req.session.user, eventTypes, page });
    }
    if (page === 'reports-schools') {
      const schools = await School.find({}).select('name').sort({ name: 1 }).lean();
      return res.render('reports/school_engagement', { user: req.session.user, schools, page });
    }
    if (page === 'reports-builder') {
      const schools = await School.find({}).select('name _id').sort({ name: 1 }).lean();
      const trainers = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor'] } }).select('name _id').sort({ name: 1 }).lean();
      const events = await Event.distinct('eventType');
      return res.render('reports/custom_builder', { user: req.session.user, schools, trainers, eventTypes: events, page });
    }

     // Existing allowed pages for standard dashboard
     const allowedPages = ['staff', 'schools', 'events', 'programs', 'analytics', 'settings', 'trainers', 'schedule', 'health', 'audit-logs', 'permissions'];

     if (!allowedPages.includes(page)) {
       return res.status(404).render('404', { user: req.session.user });
     }

    // Fetch staff list for compose dropdown (active staff only)
    const composeStaffList = await Staff.find({ status: { $ne: 'Inactive' } })
      .select('_id name email role')
      .sort({ name: 1 })
      .lean();

    const modelData = {
      staffList: composeStaffList,
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
      // Fetch all staff members with trainer roles
      modelData.trainersList = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor'] } }).sort({ createdAt: -1 }).lean();
      console.log('=== TRAINERS PAGE FETCH ===');
      console.log('Found trainers:', modelData.trainersList.length);
      // Provide default values for audit logs and pagination to prevent template errors
      modelData.auditLogs = [];
      modelData.totalPages = 0;
      modelData.currentPage = 1;
      modelData.auditActionFilter = '';
      modelData.auditEntityFilter = '';
      modelData.auditSearch = '';
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
      }

    if (page === 'events') {
      modelData.eventList = await Event.find().sort({ startDate: 1 }).lean();
    }

      if (page === 'programs') {
        modelData.programList = await Program.find()
          .populate('schools', 'name address.city')
          .sort({ updatedAt: -1 })
          .lean();
        // Fetch all active schools for allocation modal
        modelData.allSchools = await School.find({ status: 'active' })
          .select('_id name address.city studentCount')
          .sort({ name: 1 })
          .lean();
      }

    // Fetch available active programs for onboarding modal (all pages)
    modelData.allPrograms = await Program.find({ status: 'active' })
      .select('_id name price duration')
      .sort({ name: 1 })
      .lean();

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

app.get('/api/dashboard-data', requireAuth, analyticsController.getDashboardData);

app.get('/api/analytics/trainers', requireAuth, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const trainers = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor'] }, status: 'Active' })
      .select('name email role status')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, trainers });
  } catch (err) {
    console.error('Error fetching analytics trainers:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch trainers' });
  }
});

app.get('/api/analytics/programs', requireAuth, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const programs = await Program.find({}).populate('assignedTrainer', 'name role').sort({ name: 1 }).lean();
    res.json({ success: true, programs });
  } catch (err) {
    console.error('Error fetching analytics programs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch programs' });
  }
});

app.post('/api/analytics/programs/:programId/assign-trainer', requireAuth, requirePermission('canAssignTrainers'), async (req, res) => {
  try {
    const { programId } = req.params;
    const { trainerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(programId) || !mongoose.Types.ObjectId.isValid(trainerId)) {
      return res.status(400).json({ success: false, error: 'Invalid program or trainer identifier' });
    }

    const trainer = await Staff.findOne({
      _id: trainerId,
      role: { $in: ['trainer', 'senior trainer', 'supervisor'] },
      status: 'Active'
    }).lean();

    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found or inactive' });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    program.assignedTrainer = trainer._id;
    await program.save();

    const populatedProgram = await Program.findById(programId).populate('assignedTrainer', 'name role').lean();
    res.json({ success: true, program: populatedProgram });
  } catch (err) {
    console.error('Error assigning trainer to program:', err);
    res.status(500).json({ success: false, error: 'Failed to assign trainer to program' });
  }
});

// ============ SCHOOL-PROGRAM ALLOCATION ROUTES ============

// Allocate a school to a program (adds program to school and school to program)
app.post('/api/programs/:programId/allocate-school', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { programId } = req.params;
    const { schoolId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(programId) || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid program or school ID' });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    // Add school to program (if not already there)
    if (!program.schools) program.schools = [];
    if (!program.schools.includes(schoolId)) {
      program.schools.push(schoolId);
      await program.save();
    }

    // Add program to school (if not already there)
    if (!school.programsEnrolled) school.programsEnrolled = [];
    if (!school.programsEnrolled.includes(programId)) {
      school.programsEnrolled.push(programId);
      // Also set rate from program price if not already set
      if (program.price && program.price.amount) {
        if (!school.paymentTerms) school.paymentTerms = {};
        if (!school.paymentTerms.ratePerStudent) {
          school.paymentTerms.ratePerStudent = program.price.amount;
        }
      }
      await school.save();
    }

    // Return updated program with populated school reference
    const updatedProgram = await Program.findById(programId)
      .populate('schools', 'name address.city contactPerson')
      .lean();

    res.json({ success: true, program: updatedProgram, message: 'School allocated to program successfully' });
  } catch (err) {
    console.error('Error allocating school to program:', err);
    res.status(500).json({ success: false, error: 'Failed to allocate school to program' });
  }
});

// Deallocate a school from a program
app.post('/api/programs/:programId/deallocate-school', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { programId } = req.params;
    const { schoolId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(programId) || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ success: false, error: 'Invalid program or school ID' });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    // Remove school from program
    if (program.schools) {
      program.schools = program.schools.filter(id => id.toString() !== schoolId);
      await program.save();
    }

    // Remove program from school
    if (school.programsEnrolled) {
      school.programsEnrolled = school.programsEnrolled.filter(id => id.toString() !== programId);
      await school.save();
    }

    const updatedProgram = await Program.findById(programId)
      .populate('schools', 'name address.city contactPerson')
      .lean();

    res.json({ success: true, program: updatedProgram, message: 'School deallocated from program successfully' });
  } catch (err) {
    console.error('Error deallocating school from program:', err);
    res.status(500).json({ success: false, error: 'Failed to deallocate school from program' });
  }
});

// Allocate a program to a school (alternative endpoint from school side)
app.post('/api/schools/:schoolId/allocate-program', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { programId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid school or program ID' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    // Add program to school (if not already there)
    if (!school.programsEnrolled) school.programsEnrolled = [];
    if (!school.programsEnrolled.includes(programId)) {
      school.programsEnrolled.push(programId);
      // Set rate from program price if not already set
      if (program.price && program.price.amount) {
        if (!school.paymentTerms) school.paymentTerms = {};
        if (!school.paymentTerms.ratePerStudent) {
          school.paymentTerms.ratePerStudent = program.price.amount;
        }
      }
      await school.save();
    }

    // Add school to program (if not already there)
    if (!program.schools) program.schools = [];
    if (!program.schools.includes(schoolId)) {
      program.schools.push(schoolId);
      await program.save();
    }

    const updatedSchool = await School.findById(schoolId)
      .populate('programsEnrolled', 'name category price duration')
      .lean();

    res.json({ success: true, school: updatedSchool, message: 'Program allocated to school successfully' });
  } catch (err) {
    console.error('Error allocating program to school:', err);
    res.status(500).json({ success: false, error: 'Failed to allocate program to school' });
  }
});

// Deallocate a program from a school
app.post('/api/schools/:schoolId/deallocate-program', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { programId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid school or program ID' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    // Remove program from school
    if (school.programsEnrolled) {
      school.programsEnrolled = school.programsEnrolled.filter(id => id.toString() !== programId);
      await school.save();
    }

    // Remove school from program
    if (program.schools) {
      program.schools = program.schools.filter(id => id.toString() !== schoolId);
      await program.save();
    }

    const updatedSchool = await School.findById(schoolId)
      .populate('programsEnrolled', 'name category price duration')
      .lean();

    res.json({ success: true, school: updatedSchool, message: 'Program deallocated from school successfully' });
  } catch (err) {
    console.error('Error deallocating program from school:', err);
    res.status(500).json({ success: false, error: 'Failed to deallocate program from school' });
  }
});

// POST: Bulk update program school allocations
app.post('/api/programs/:programId/update-schools', requireAuth, requirePermission('canEditSchools'), async (req, res) => {
  try {
    const { programId } = req.params;
    const { schoolIds } = req.body; // array of school ObjectId strings

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid program ID' });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    // Validate schoolIds array
    let validSchoolIds = [];
    if (Array.isArray(schoolIds)) {
      const objectIdSchools = schoolIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      const validSchools = await School.find({ _id: { $in: objectIdSchools } }).select('_id').lean();
      validSchoolIds = validSchools.map(s => s._id);
    }

    // Get old school IDs before update
    const oldSchoolIds = (program.schools || []).map(id => id.toString());

    // Update program schools array
    program.schools = validSchoolIds;
    await program.save();

    // Sync School.programsEnrolled arrays
    const allAffectedSchoolIds = [...new Set([...oldSchoolIds, ...validSchoolIds.map(id => id.toString())])];
    const schoolsToUpdate = await School.find({ _id: { $in: allAffectedSchoolIds } });

    for (const school of schoolsToUpdate) {
      const schoolIdStr = school._id.toString();
      const isInNewList = validSchoolIds.some(id => id.toString() === schoolIdStr);
      if (isInNewList) {
        if (!school.programsEnrolled) school.programsEnrolled = [];
        if (!school.programsEnrolled.includes(programId)) {
          school.programsEnrolled.push(programId);
        }
      } else {
        // Remove program from school
        if (school.programsEnrolled) {
          school.programsEnrolled = school.programsEnrolled.filter(id => id.toString() !== programId);
        }
      }
      await school.save();
    }

    // Return updated program with populated schools
    const updatedProgram = await Program.findById(programId)
      .populate('schools', 'name address.city contactPerson')
      .lean();

    res.json({ success: true, program: updatedProgram, message: 'School allocations updated successfully' });
  } catch (err) {
    console.error('Error updating program schools:', err);
    res.status(500).json({ success: false, error: 'Failed to update program schools' });
  }
});

// GET single program by ID
app.get('/api/programs/:programId', requireAuth, async (req, res) => {
  try {
    const { programId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid program ID' });
    }

    const program = await Program.findById(programId).lean();

    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    res.json({ success: true, program });
  } catch (err) {
    console.error('Error fetching program:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch program' });
  }
});

// PUT update program details
app.put('/api/programs/:programId', requireAuth, requirePermission('canEditPrograms'), parseJson, async (req, res) => {
  try {
    const { programId } = req.params;
    const {
      name,
      description,
      category,
      ageMin,
      ageMax,
      duration,
      maxParticipants,
      priceAmount,
      priceCurrency,
      status
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid program ID' });
    }

    const program = await Program.findById(programId);

    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    // Update fields if provided
    if (name !== undefined) program.name = name;
    if (description !== undefined) program.description = description;
    if (category !== undefined) program.category = category;
    if (ageMin !== undefined || ageMax !== undefined) {
      program.ageGroup = {
        min: ageMin !== undefined ? parseInt(ageMin) : program.ageGroup.min,
        max: ageMax !== undefined ? parseInt(ageMax) : program.ageGroup.max
      };
    }
    if (duration !== undefined) program.duration = duration;
    if (maxParticipants !== undefined) program.maxParticipants = parseInt(maxParticipants);
    if (priceAmount !== undefined || priceCurrency !== undefined) {
      program.price = {
        amount: priceAmount !== undefined ? parseFloat(priceAmount) : program.price.amount,
        currency: priceCurrency !== undefined ? priceCurrency : program.price.currency
      };
    }
    if (status !== undefined) program.status = status;

    await program.save();

    const updatedProgram = await Program.findById(programId).lean();

    res.json({ success: true, program: updatedProgram, message: 'Program updated successfully' });
  } catch (err) {
    console.error('Error updating program:', err);
    res.status(500).json({ success: false, error: 'Failed to update program' });
  }
});

// GET events list with filters
app.get('/api/events', requireAuth, requirePermission('canViewEvents'), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      status,
      trainerId,
      schoolId,
      region,
      // pagination
      page = 1,
      limit = 50,
      // sorting
      sortBy = 'startDate',
      sortOrder = 'asc'
    } = req.query;

    const filter = {};

    // Date range filter
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    if (eventType) filter.eventType = eventType;
    if (status) filter.status = status;
    if (region) filter.region = region;

    // Trainer filter - find events where trainer is assigned
    if (trainerId) {
      filter['trainers.trainerId'] = trainerId;
    }

    // School filter - find events where school is invited
    if (schoolId) {
      filter['targetSchools.schoolId'] = schoolId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Event.countDocuments(filter);

    res.json({
      success: true,
      events,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// GET single event with populated references
app.get('/api/events/:eventId', requireAuth, requirePermission('canViewEvents'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('trainers.trainerId', 'name email idNumber role status')
      .populate('targetSchools.schoolId', 'name address city contactPerson')
      .lean();

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, event });
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
});

// CREATE event
app.post('/dashboard/events/create', requireAuth, requirePermission('canCreateEvents'), parseJson, async (req, res) => {
  try {
    const {
      name,
      description,
      eventType,
      agenda,
      startDate,
      endDate,
      defaultInvitationDeadline,
      // location
      locationName,
      locationAddress,
      locationCity,
      locationRegion,
      locationCountry,
      locationLatitude,
      locationLongitude,
      region,
      // target & capacity
      maxParticipants,
      estimatedScoutCount,
      registrationDeadline,
      waitlistEnabled,
      // requirements
      requiredEquipment,
      prerequisites,
      // financial
      budgetTotal,
      costPerParticipant,
      // publishing
      status,
      visibility,
      publishedAt,
      publishedBy,
      // trainer modifications
      trainersToAdd,
      trainersToRemove,
      trainerRoles,
      // school invitations
      schoolsToInvite
    } = req.body;

     // Validate required fields
     if (!name || !eventType || !startDate || !endDate || !locationName || !maxParticipants) {
       return res.status(400).json({ success: false, error: 'Missing required fields' });
     }

     // Validate user session
     if (!req.session.user.id || !mongoose.Types.ObjectId.isValid(req.session.user.id)) {
       return res.status(401).json({ success: false, error: 'Invalid user session' });
     }

     // Normalize and validate trainersToAdd and schoolsToInvite
     const trainersList = Array.isArray(trainersToAdd) ? trainersToAdd : [];
     const schoolsList = Array.isArray(schoolsToInvite) ? schoolsToInvite : [];

     // Validate each trainer ID
     for (let i = 0; i < trainersList.length; i++) {
       const tid = trainersList[i];
       if (!tid || !mongoose.Types.ObjectId.isValid(tid)) {
         return res.status(400).json({ success: false, error: `Invalid trainer ID at index ${i}` });
       }
     }

     // Validate each school ID
     for (let i = 0; i < schoolsList.length; i++) {
       const sid = schoolsList[i];
       if (!sid || !mongoose.Types.ObjectId.isValid(sid)) {
         return res.status(400).json({ success: false, error: `Invalid school ID at index ${i}` });
       }
     }

     // Parse dates for conflict checking
    const start = new Date(startDate);
    const end = new Date(endDate);

     // Check for school scheduling conflicts if schools are being invited
     if (schoolsList.length) {
       for (const schoolId of schoolsList) {
        // Build conflict query (exclude current event on updates, include all for creates)
        const conflictQuery = {
          'targetSchools.schoolId': new mongoose.Types.ObjectId(schoolId),
          status: { $nin: ['cancelled', 'archived'] },
          $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } }
          ]
        };

        // For CREATE: no exclusion; for UPDATE: handled separately
        const conflictingEvents = await Event.find(conflictQuery)
          .select('name startDate endDate')
          .lean();

        if (conflictingEvents.length > 0) {
          const conflictDetails = conflictingEvents.map(e => ({
            name: e.name,
            dates: `${new Date(e.startDate).toLocaleDateString()} - ${new Date(e.endDate).toLocaleDateString()}`
          }));
          return res.status(409).json({
            success: false,
            error: 'Scheduling conflict detected',
            conflicts: conflictDetails,
            message: `School is already assigned to overlapping event(s): ${conflictDetails.map(c => c.name).join(', ')}`
          });
        }
      }
    }

     // Check for trainer scheduling conflicts if trainers are being assigned
     if (trainersList.length) {
       for (const trainerId of trainersList) {
        const trainerConflictQuery = {
          'trainers.trainerId': new mongoose.Types.ObjectId(trainerId),
          status: { $nin: ['cancelled', 'archived'] },
          $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } }
          ]
        };

        if (typeof eventId !== 'undefined' && eventId) {
          trainerConflictQuery._id = { $ne: eventId };
        }

        const trainerConflicts = await Event.find(trainerConflictQuery)
          .select('name startDate endDate')
          .lean();

        if (trainerConflicts.length > 0) {
          const conflictDetails = trainerConflicts.map(e => ({
            name: e.name,
            dates: `${new Date(e.startDate).toLocaleDateString()} - ${new Date(e.endDate).toLocaleDateString()}`
          }));
          return res.status(409).json({
            success: false,
            error: 'Trainer scheduling conflict detected',
            conflicts: conflictDetails,
            message: `Trainer is already assigned to overlapping event(s): ${conflictDetails.map(c => c.name).join(', ')}`
          });
        }
      }
    }

    // Resource constraint validation
    const maxPart = parseInt(maxParticipants);
    const estScout = parseInt(estimatedScoutCount) || 0;

    if (estScout > maxPart) {
      return res.status(400).json({
        success: false,
        error: 'Resource constraint violation',
        message: `Estimated scout count (${estScout}) cannot exceed maximum participants (${maxPart})`
      });
    }

    // Validate dates: registration deadline should be before start date
    if (registrationDeadline && new Date(registrationDeadline) >= new Date(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dates',
        message: 'Registration deadline must be before event start date'
      });
    }

    // Validate defaultInvitationDeadline is before start date
    if (defaultInvitationDeadline && new Date(defaultInvitationDeadline) >= new Date(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dates',
        message: 'Default invitation deadline must be before event start date'
      });
    }

      // Build trainers array
      const trainers = [];
      for (let i = 0; i < trainersList.length; i++) {
        trainers.push({
          trainerId: trainersList[i],
          role: trainerRoles ? trainerRoles[i] || 'assistant_trainer' : 'assistant_trainer',
          assignedAt: new Date(),
          status: 'assigned'
        });
      }

    // Validate date order: start must be before end
    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dates',
        message: 'Start date must be before end date'
      });
    }

    // Build location object
    const location = {
      name: locationName,
      address: locationAddress || '',
      city: locationCity || '',
      region: locationRegion || '',
      country: locationCountry || 'Kenya'
    };
    if (locationLatitude && locationLongitude) {
      location.coordinates = {
        latitude: parseFloat(locationLatitude),
        longitude: parseFloat(locationLongitude)
      };
    }

    // Parse equipment and prerequisites JSON
    const equipmentArray = requiredEquipment && typeof requiredEquipment === 'string' && requiredEquipment.trim() !== '' ? JSON.parse(requiredEquipment) : [];
    const prerequisitesArray = prerequisites && typeof prerequisites === 'string' && prerequisites.trim() !== '' ? JSON.parse(prerequisites) : [];

     // Build targetSchools array from schoolsList if provided
     const targetSchools = [];
     if (schoolsList.length) {
       for (const schoolId of schoolsList) {
        targetSchools.push({
          schoolId,
          invitedAt: new Date(),
          invitedBy: req.session.user.id,
          rsvpStatus: 'invited',
          rsvpDeadline: defaultInvitationDeadline ? new Date(defaultInvitationDeadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        });
      }
    }

    // Create the Event document
    const event = new Event({
      name,
      description: description || '',
      eventType,
      agenda: agenda || '',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      defaultInvitationDeadline: defaultInvitationDeadline ? new Date(defaultInvitationDeadline) : undefined,
      location,
      region: region || '',
      targetSchools,
      estimatedScoutCount: parseInt(estimatedScoutCount) || 0,
      requiredEquipment: equipmentArray,
      prerequisites: prerequisitesArray,
      trainers,
      maxParticipants: parseInt(maxParticipants),
      currentParticipants: 0,
      waitlistEnabled: waitlistEnabled === 'true' || waitlistEnabled === true,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
      budget: {
        total: parseFloat(budgetTotal) || 0,
        breakdown: {}
      },
      costPerParticipant: parseFloat(costPerParticipant) || 0,
      status: status || 'draft',
      visibility: visibility || 'private',
      createdBy: req.session.user.id,
      lastModifiedBy: req.session.user.id
    });

    await event.save();

    // Populate for response
    const populatedEvent = await Event.findById(event._id)
      .populate('trainers.trainerId', 'name email idNumber role')
      .populate('targetSchools.schoolId', 'name address city')
      .lean();

    // Log audit
    await logAudit('event_created', 'event', event._id, event.name, {}, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, event: populatedEvent, message: 'Event created successfully' });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ success: false, error: 'Failed to create event: ' + err.message });
  }
});

// UPDATE event
app.post('/dashboard/events/update/:id', requireAuth, requirePermission('canCreateEvents'), parseJson, async (req, res) => {
  try {
    const eventId = req.params.id;
    const {
      name,
      description,
      eventType,
      agenda,
      startDate,
      endDate,
      defaultInvitationDeadline,
      locationName,
      locationAddress,
      locationCity,
      locationRegion,
      locationCountry,
      locationLatitude,
      locationLongitude,
      region,
      maxParticipants,
      estimatedScoutCount,
      registrationDeadline,
      waitlistEnabled,
      requiredEquipment,
      prerequisites,
      budgetTotal,
      costPerParticipant,
      status,
      visibility,
      publishedAt,
      publishedBy,
      trainersToAdd,
      trainersToRemove,
      trainerRoles,
      schoolsToInvite
    } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Track which fields actually changed
    const updatedFields = [];

    // Update basic fields
    if (name !== undefined && name !== event.name) { event.name = name; updatedFields.push('name'); }
    if (description !== undefined && description !== event.description) { event.description = description; updatedFields.push('description'); }
    if (eventType !== undefined && eventType !== event.eventType) { event.eventType = eventType; updatedFields.push('eventType'); }
    if (agenda !== undefined && agenda !== event.agenda) { event.agenda = agenda; updatedFields.push('agenda'); }
    if (startDate !== undefined) {
      const newStart = new Date(startDate);
      if (newStart.getTime() !== event.startDate.getTime()) {
        event.startDate = newStart;
        updatedFields.push('startDate');
      }
    }
    if (endDate !== undefined) {
      const newEnd = new Date(endDate);
      if (newEnd.getTime() !== event.endDate.getTime()) {
        event.endDate = newEnd;
        updatedFields.push('endDate');
      }
    }
    if (defaultInvitationDeadline !== undefined) {
      const newDeadline = defaultInvitationDeadline ? new Date(defaultInvitationDeadline) : undefined;
      if (newDeadline !== event.defaultInvitationDeadline) {
        event.defaultInvitationDeadline = newDeadline;
        updatedFields.push('defaultInvitationDeadline');
      }
    }
    if (region !== undefined && region !== event.region) { event.region = region; updatedFields.push('region'); }
    if (maxParticipants !== undefined && parseInt(maxParticipants) !== event.maxParticipants) {
      event.maxParticipants = parseInt(maxParticipants);
      updatedFields.push('maxParticipants');
    }
    if (estimatedScoutCount !== undefined && parseInt(estimatedScoutCount) !== event.estimatedScoutCount) {
      event.estimatedScoutCount = parseInt(estimatedScoutCount);
      updatedFields.push('estimatedScoutCount');
    }
    if (registrationDeadline !== undefined) {
      const newReg = registrationDeadline ? new Date(registrationDeadline) : undefined;
      if (newReg !== event.registrationDeadline) {
        event.registrationDeadline = newReg;
        updatedFields.push('registrationDeadline');
      }
    }
    if (waitlistEnabled !== undefined && waitlistEnabled !== event.waitlistEnabled) {
      event.waitlistEnabled = (waitlistEnabled === 'true' || waitlistEnabled === true);
      updatedFields.push('waitlistEnabled');
    }
    if (budgetTotal !== undefined && parseFloat(budgetTotal) !== event.budget.total) {
      event.budget.total = parseFloat(budgetTotal);
      updatedFields.push('budget.total');
    }
    if (costPerParticipant !== undefined && parseFloat(costPerParticipant) !== event.costPerParticipant) {
      event.costPerParticipant = parseFloat(costPerParticipant);
      updatedFields.push('costPerParticipant');
    }
    if (status !== undefined && status !== event.status) { event.status = status; updatedFields.push('status'); }
    if (visibility !== undefined && visibility !== event.visibility) { event.visibility = visibility; updatedFields.push('visibility'); }

    // Handle publishing
    if (publishedAt !== undefined && status === 'published') {
      event.publishedAt = new Date(publishedAt);
      event.publishedBy = publishedBy || req.session.user.id;
      updatedFields.push('publishedAt', 'publishedBy');
    }

    // Update location if provided
    if (locationName !== undefined) {
      event.location = {
        name: locationName,
        address: locationAddress || event.location?.address || '',
        city: locationCity || event.location?.city || '',
        region: locationRegion || event.location?.region || '',
        country: locationCountry || event.location?.country || 'Kenya'
      };
      if (locationLatitude && locationLongitude) {
        event.location.coordinates = {
          latitude: parseFloat(locationLatitude),
          longitude: parseFloat(locationLongitude)
        };
      }
      updatedFields.push('location');
    }

     // Update required equipment if provided
     if (requiredEquipment !== undefined) {
       event.requiredEquipment = requiredEquipment && typeof requiredEquipment === 'string' && requiredEquipment.trim() !== '' ? JSON.parse(requiredEquipment) : [];
       updatedFields.push('requiredEquipment');
     }

     // Update prerequisites if provided
     if (prerequisites !== undefined) {
       event.prerequisites = prerequisites && typeof prerequisites === 'string' && prerequisites.trim() !== '' ? JSON.parse(prerequisites) : [];
       updatedFields.push('prerequisites');
     }

    // ===== RESOURCE CONSTRAINT VALIDATION =====
    if (event.estimatedScoutCount > event.maxParticipants) {
      return res.status(400).json({
        success: false,
        error: 'Resource constraint violation',
        message: `Estimated scout count (${event.estimatedScoutCount}) cannot exceed maximum participants (${event.maxParticipants})`
      });
    }

    // Validate date order
    if (event.startDate >= event.endDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dates',
        message: 'Start date must be before end date'
      });
    }

    // ===== CONFLICT DETECTION =====
    const start = event.startDate;
    const end = event.endDate;

    // Check school conflicts for all target schools (existing + new)
    const allSchoolIds = [...new Set([
      ...event.targetSchools.map(ts => ts.schoolId.toString()),
      ...(schoolsToInvite || [])
    ])];
    for (const schoolId of allSchoolIds) {
      const schoolConflicts = await Event.find({
        _id: { $ne: eventId },
        'targetSchools.schoolId': new mongoose.Types.ObjectId(schoolId),
        status: { $nin: ['cancelled', 'archived'] },
        $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
      }).select('name startDate endDate').lean();

      if (schoolConflicts.length > 0) {
        const conflictDetails = schoolConflicts.map(e => ({
          name: e.name,
          dates: `${new Date(e.startDate).toLocaleDateString()} - ${new Date(e.endDate).toLocaleDateString()}`
        }));
        return res.status(409).json({
          success: false,
          error: 'School scheduling conflict detected',
          conflicts: conflictDetails,
          message: `School is already assigned to overlapping event(s): ${conflictDetails.map(c => c.name).join(', ')}`
        });
      }
    }

    // Check trainer conflicts for all assigned trainers (existing + new)
    const allTrainerIds = [...new Set([
      ...event.trainers.map(t => t.trainerId.toString()),
      ...(trainersToAdd || [])
    ])];
    for (const trainerId of allTrainerIds) {
      const trainerConflicts = await Event.find({
        _id: { $ne: eventId },
        'trainers.trainerId': new mongoose.Types.ObjectId(trainerId),
        status: { $nin: ['cancelled', 'archived'] },
        $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
      }).select('name startDate endDate').lean();

      if (trainerConflicts.length > 0) {
        const conflictDetails = trainerConflicts.map(e => ({
          name: e.name,
          dates: `${new Date(e.startDate).toLocaleDateString()} - ${new Date(e.endDate).toLocaleDateString()}`
        }));
        return res.status(409).json({
          success: false,
          error: 'Trainer scheduling conflict detected',
          conflicts: conflictDetails,
          message: `Trainer is already assigned to overlapping event(s): ${conflictDetails.map(c => c.name).join(', ')}`
        });
      }
    }

    // Add new trainers
    if (trainersToAdd && Array.isArray(trainersToAdd)) {
      for (let i = 0; i < trainersToAdd.length; i++) {
        const existing = event.trainers.find(t => t.trainerId.toString() === trainersToAdd[i]);
        if (!existing) {
          event.trainers.push({
            trainerId: trainersToAdd[i],
            role: trainerRoles ? trainerRoles[i] || 'assistant_trainer' : 'assistant_trainer',
            assignedAt: new Date(),
            status: 'assigned'
          });
          updatedFields.push('trainers');
        }
      }
    }

    // Remove trainers
    if (trainersToRemove && Array.isArray(trainersToRemove)) {
      const beforeCount = event.trainers.length;
      event.trainers = event.trainers.filter(t =>
        !trainersToRemove.includes(t.trainerId.toString())
      );
      if (event.trainers.length < beforeCount) {
        updatedFields.push('trainers');
      }
    }

    // Update trainer roles
    if (trainerRoles && typeof trainerRoles === 'object') {
      let rolesChanged = false;
      for (const trainer of event.trainers) {
        if (trainerRoles[trainer.trainerId.toString()]) {
          trainer.role = trainerRoles[trainer.trainerId.toString()];
          rolesChanged = true;
        }
      }
      if (rolesChanged) updatedFields.push('trainerRoles');
    }

    // Invite new schools
    if (schoolsToInvite && Array.isArray(schoolsToInvite)) {
      for (const schoolId of schoolsToInvite) {
        const existing = event.targetSchools.find(s => s.schoolId.toString() === schoolId);
        if (!existing) {
          event.targetSchools.push({
            schoolId,
            invitedAt: new Date(),
            invitedBy: req.session.user.id,
            rsvpStatus: 'invited',
            rsvpDeadline: event.defaultInvitationDeadline ? new Date(event.defaultInvitationDeadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          });
          updatedFields.push('targetSchools');
        }
      }
    }

    event.lastModifiedBy = req.session.user.id;
    await event.save();

    // Populate for response
    const populatedEvent = await Event.findById(eventId)
      .populate('trainers.trainerId', 'name email idNumber role')
      .populate('targetSchools.schoolId', 'name address city')
      .lean();

    // Log audit
    await logAudit('event_updated', 'event', eventId, event.name, { updatedFields }, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, event: populatedEvent, message: 'Event updated successfully' });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ success: false, error: 'Failed to update event: ' + err.message });
  }
});

// DELETE event
app.post('/dashboard/events/delete/:id', requireAuth, requirePermission('canDeleteEvents'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const eventName = event.name;
    await Event.findByIdAndDelete(req.params.id);

    // Log audit
    await logAudit('event_deleted', 'event', req.params.id, eventName, {}, {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userRole: req.session.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
});

// Check trainer availability for an event
app.get('/api/trainers/:trainerId/availability', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, excludeEventId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate are required' });
    }

    const filter = {
      trainers: {
        $elemMatch: {
          trainerId: req.params.trainerId,
          status: { $in: ['assigned', 'confirmed'] }
        }
      },
      status: { $nin: ['cancelled', 'archived'] }
    };

    // Exclude current event when checking for conflicts
    if (excludeEventId) {
      filter._id = { $ne: excludeEventId };
    }

    // Check for date conflicts: any event where the trainer is assigned that overlaps with the given date range
    const conflictingEvents = await Event.find({
      ...filter,
      $or: [
        // Event starts during the requested period
        { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        // Event ends during the requested period
        { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        // Event spans the entire requested period
        {
          startDate: { $lte: new Date(startDate) },
          endDate: { $gte: new Date(endDate) }
        }
      ]
    }).select('name startDate endDate');

    const isAvailable = conflictingEvents.length === 0;

    res.json({
      success: true,
      available: isAvailable,
      conflicts: conflictingEvents.map(e => ({
        id: e._id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate
      }))
    });
  } catch (err) {
    console.error('Error checking availability:', err);
    res.status(500).json({ success: false, error: 'Failed to check availability' });
  }
});

// Assign trainer to event
app.post('/api/events/:eventId/assign-trainer', requireAuth, requirePermission('canAssignTrainers'), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { trainerId, role } = req.body;

    if (!trainerId) {
      return res.status(400).json({ success: false, error: 'trainerId is required' });
    }

    // Get current admin staff (the one performing the assignment)
    const currentAdmin = await getCurrentStaff(req);
    if (!currentAdmin) {
      return res.status(403).json({ success: false, error: 'Admin staff record not found' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Check if trainer is already assigned
    const existing = event.trainers.find(t => t.trainerId.toString() === trainerId);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Trainer already assigned to this event' });
    }

    // Check for scheduling conflicts
    const conflictCheck = await Event.find({
      _id: { $ne: eventId },
      trainers: { $elemMatch: { trainerId, status: { $in: ['assigned', 'confirmed'] } } },
      status: { $nin: ['cancelled', 'archived'] },
      $or: [
        { startDate: { $lte: event.endDate, $gte: event.startDate } },
        { endDate: { $lte: event.endDate, $gte: event.startDate } }
      ]
    }).select('name startDate endDate');

    if (conflictCheck.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Trainer has scheduling conflict',
        conflicts: conflictCheck.map(e => ({
          name: e.name,
          dates: `${new Date(e.startDate).toLocaleDateString()} - ${new Date(e.endDate).toLocaleDateString()}`
        }))
      });
    }

     // Assign trainer
     event.trainers.push({
       trainerId,
       role: role || 'assistant_trainer',
       assignedAt: new Date(),
       status: 'assigned'
     });

    await event.save();

    // If school confirmed attendance, create a draft invoice now so it is stored in the DB
    // and visible in the invoices list immediately. The RFC-legal participant count (numberOfParticipants)
    // drives the invoice quantity. A founder can update / finalise the invoice at any time.
    if (status === 'confirmed' && schoolId) {
      try {
        const participantCount = schoolRsvpEntry?.numberOfParticipants || 0;
        const ratePerStudent = (await School.findById(schoolId))?.paymentTerms?.ratePerStudent || 0;
        const eventRate = event.costPerParticipant || 0;
        const unitRate = eventRate > 0 ? eventRate : ratePerStudent;

        if (unitRate > 0) {
          const rsvpCount = participantCount > 0
            ? participantCount
            : (event.review?.actualAttendeeCount || event.estimatedScoutCount || 0 || 1);

          const draftInvoice = new Invoice({
            schoolId: new mongoose.Types.ObjectId(schoolId),
            invoiceNumber:
              invoiceService.generateInvoiceNumber('INV'),
            invoiceType: 'event',
            relatedEvents: [new mongoose.Types.ObjectId(eventId)],
            status: 'draft',
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            currency: 'KES',
            items: [{
              description: `Event: ${event.name} - ${rsvpCount} participants @ KES ${unitRate.toFixed(2)}/student`,
              quantity: rsvpCount,
              unitPrice: unitRate,
              total: rsvpCount * unitRate,
              eventId: event._id
            }],
            subtotal: rsvpCount * unitRate,
            totalAmount: rsvpCount * unitRate,
            balance: rsvpCount * unitRate,
            bankDetails: {
              bankName: process.env.BANK_NAME || 'APV Ventures Ltd',
              accountName: process.env.BANK_ACCOUNT_NAME || 'Arrow-Park Ventures',
              accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
              branch: process.env.BANK_BRANCH || 'Nairobi',
              swiftCode: process.env.BANK_SWIFT || 'AFRIKENXXX',
              mpesaTillNumber: process.env.MPESA_TILL || '123456'
            }
          });

          await draftInvoice.save();
          req.eventDraftInvoiceId = draftInvoice._id;
        }
      } catch (invoiceErr) {
        console.error('Error creating draft invoice on RSVP confirm:', invoiceErr.message);
        // Do not fail the RSVP if invoice creation fails
      }
    }

     // Get the assigned trainer object for the response
     const assignedTrainer = event.trainers.find(t => t.trainerId.toString() === trainerId);

     // Notify trainer via email and in-app message
     try {
       const trainer = await Staff.findById(trainerId);
       if (trainer && trainer.email && currentAdmin) {
         // Build event details for email/message
         const eventDetails = `
           <strong>Event:</strong> ${event.name}<br>
           <strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}<br>
           <strong>Location:</strong> ${event.location?.name || 'TBD'}<br>
           <strong>Type:</strong> ${event.eventType.replace('_', ' ')}<br>
           <strong>Your Role:</strong> ${role || 'assistant_trainer'}
         `;

          // Get list of other trainers assigned (for message only)
          const otherTrainers = await Promise.all(
            event.trainers
              .filter(t => t.trainerId.toString() !== trainerId)
              .map(async t => {
                const staff = await Staff.findById(t.trainerId).select('name role');
                return staff ? `${staff.name} (${staff.role.replace('_', ' ')})` : null;
              })
          );
          const otherTrainersList = otherTrainers.filter(Boolean);
          const otherTrainersText = otherTrainersList.length > 0
            ? `<br><strong>Other Trainers:</strong><br>${otherTrainersList.map(t => `• ${t}`).join('<br>')}`
            : '';

          // Accept/Decline action buttons (links to event page where they can take action)
          const acceptUrl = `${req.protocol}://${req.get('host')}/trainer/events/${eventId}`;
          const declineUrl = `${req.protocol}://${req.get('host')}/trainer/events/${eventId}`;

          const emailHtml = `
            <h2>New Event Assignment</h2>
            <p>Hello ${trainer.name},</p>
            <p>You have been assigned to the following event. Please <strong>accept or decline</strong> this assignment:</p>
            <div style="background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin: 1rem 0;">
              ${eventDetails}
              ${otherTrainersText}
            </div>
            <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem;">
              <a href="${acceptUrl}" style="background: #22c55e; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; font-weight: bold;">✅ Accept Assignment</a>
              <a href="${declineUrl}" style="background: #ef4444; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; font-weight: bold;">❌ Decline Assignment</a>
            </div>
            <p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
              Or log into your trainer portal: <a href="${req.protocol}://${req.get('host')}/trainer/events">${req.protocol}://${req.get('host')}/trainer/events</a>
            </p>
          `;

          await emailService.sendEmail({
            to: trainer.email,
            subject: `Action Required: Event Assignment - ${event.name}`,
            html: emailHtml,
            templateId: 'event_assignment',
            templateData: {
              trainerName: trainer.name,
              eventName: event.name,
              eventDate: `${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`,
              location: event.location?.name,
              role: role || 'assistant_trainer',
              otherTrainers: otherTrainersList.join(', '),
              acceptUrl: acceptUrl,
              declineUrl: declineUrl,
              eventUrl: `${req.protocol}://${req.get('host')}/trainer/events/${eventId}`
            },
            triggeredBy: currentAdmin._id,
            entityType: 'event',
            entityId: eventId,
            triggerReason: 'trainer_assigned',
            priority: 'high'
          });

          // Send IN-APP MESSAGE with action buttons
          const message = new Message({
            senderId: currentAdmin._id,
            senderName: currentAdmin.name,
            senderRole: currentAdmin.role,
            recipients: [{
              staffId: trainer._id,
              status: 'sent'
            }],
            subject: `Event Assignment: ${event.name} - Action Required`,
            body: `You have been assigned to <strong>${event.name}</strong> as a <strong>${role || 'assistant_trainer'}</strong>.<br><br>
                   <strong>Event Details:</strong><br>
                   📅 ${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}<br>
                   📍 ${event.location?.name || 'TBD'}<br>
                   🏷️ ${event.eventType.replace('_', ' ')}<br>
                   ${otherTrainersList.length ? `<br><strong>Other Trainers:</strong><br>${otherTrainersList.map(t => `• ${t}`).join('<br>')}<br><br>` : ''}
                   <strong>Please respond to this assignment:</strong><br>
                   <a href="/trainer/events/${eventId}" style="background: #22c55e; color: white; padding: 0.5rem 1rem; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 0.5rem;">✅ Accept Assignment</a>
                   <a href="/trainer/events/${eventId}?action=decline" style="background: #ef4444; color: white; padding: 0.5rem 1rem; text-decoration: none; border-radius: 4px; display: inline-block;">❌ Decline Assignment</a>`,
            messageType: 'direct',
            priority: 'high',
            createdBy: currentAdmin._id
          });
          await message.save();
       }
     } catch (emailErr) {
       console.error('Error sending assignment email/message:', emailErr);
     }

    const populatedEvent = await Event.findById(eventId)
      .populate('trainers.trainerId', 'name email idNumber role')
      .lean();

    res.json({ success: true, event: populatedEvent, message: 'Trainer assigned successfully' });
  } catch (err) {
    console.error('Error assigning trainer:', err);
    res.status(500).json({ success: false, error: 'Failed to assign trainer' });
  }
});

// Remove trainer from event
app.post('/api/events/:eventId/remove-trainer', requireAuth, requirePermission('canAssignTrainers'), async (req, res) => {
  try {
    const { trainerId } = req.body;
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    event.trainers = event.trainers.filter(t => t.trainerId.toString() !== trainerId);
    await event.save();

    res.json({ success: true, message: 'Trainer removed from event' });
  } catch (err) {
    console.error('Error removing trainer:', err);
    res.status(500).json({ success: false, error: 'Failed to remove trainer' });
  }
});

// Invite school to event
app.post('/api/events/:eventId/invite-school', requireAuth, requirePermission('canAssignTrainers'), parseJson, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { schoolId, rsvpDeadline, customMessage } = req.body;

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Check if already invited
    const existing = event.targetSchools.find(s => s.schoolId.toString() === schoolId);
    if (existing) {
      return res.status(400).json({ success: false, error: 'School already invited' });
    }

    // Add invitation with deadline handling
    let deadline;
    if (rsvpDeadline) {
        deadline = new Date(rsvpDeadline);
    } else if (event.defaultInvitationDeadline) {
        deadline = new Date(event.defaultInvitationDeadline);
    } else {
        deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks default
    }

    event.targetSchools.push({
      schoolId,
      invitedAt: new Date(),
      rsvpStatus: 'invited',
      rsvpDeadline: deadline
    });

    // No need to increment currentParticipants here; it will be updated upon RSVP

    await event.save();

    // Fetch school for both email and in-app notifications
    const School = require('./models/School');
    const school = await School.findById(schoolId);

    // Send invitation email to school contact using centralized service
    try {
      if (school && school.contactPerson?.email) {
        const protocol = req.protocol;
        const host = req.get('host');
        const rsvpLink = `${protocol}://${host}/events/${eventId}/rsvp?school=${schoolId}&token=${encodeURIComponent(btoa(schoolId + ':' + eventId))}`;

        const emailHtml = `
          <h2>You are Invited to ${event.name}</h2>
          <p>Dear ${school.contactPerson.name || 'School Representative'},</p>
          <p>You are invited to participate in this event:

          <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
            <h3>${event.name}</h3>
            <p><strong>Type:</strong> ${event.eventType.replace('_', ' ')}</p>
            <p><strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}</p>
            <p><strong>Location:</strong> ${event.location?.name}, ${event.location?.city}</p>
            ${event.agenda ? `<p><strong>Agenda:</strong> ${event.agenda}</p>` : ''}
          </div>
          <p>Please confirm your participation by clicking the link below:</p>
          <p><a href="${rsvpLink}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">RSVP Now</a></p>
          ${customMessage ? `<p><em>${customMessage}</em></p>` : ''}
          <p><strong>RSVP Deadline:</strong> ${rsvpDeadline ? new Date(rsvpDeadline).toLocaleDateString() : (event.defaultInvitationDeadline ? new Date(event.defaultInvitationDeadline).toLocaleDateString() : 'TBD')}</p>
          <p>When responding, please indicate the total number of students from your school who will be attending.</p>
        `;

        await emailService.sendEmail({
          to: school.contactPerson.email,
          subject: `Invitation: ${event.name}`,
          html: emailHtml,
          templateId: 'event_invitation',
          templateData: {
            contactName: school.contactPerson.name,
            schoolName: school.name,
            eventName: event.name,
            eventDate: `${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`,
            location: `${event.location?.name}, ${event.location?.city}`,
            rsvpUrl: rsvpLink,
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline).toLocaleDateString() : undefined,
            customMessage: customMessage
          },
          triggeredBy: req.session.user.id,
          entityType: 'event',
          entityId: eventId,
          triggerReason: 'school_invited',
          priority: 'normal'
        });
      }
    } catch (emailErr) {
      console.error('Error sending invitation email:', emailErr);
    }

    // Send in-app notification to school staff (assigned staff)
    try {
      const Staff = require('./models/Staff');
      const schoolStaff = await Staff.find({
        _id: { $in: (school.assignedStaff || []).map(a => a.staffId) },
        status: 'Active'
      }).lean();

      const inviterName = req.session.user?.name || 'Admin';

      await Promise.all(schoolStaff.map(staff =>
        Notification.create({
          recipientId: staff._id,
          type: 'event_invitation',
          title: `You are invited to ${event.name}`,
          message: `${inviterName} has invited ${school.name} to participate in the event "${event.name}" on ${new Date(event.startDate).toLocaleDateString()}. Please RSVP by ${rsvpDeadline ? new Date(rsvpDeadline).toLocaleDateString() : 'the deadline'} and confirm the total number of students attending.`,
          icon: 'calendar',
          color: 'blue',
          actionUrl: `/events/${eventId}/rsvp?school=${schoolId}`,
          actionLabel: 'RSVP & Confirm Attendance',
          entityType: 'event',
          entityId: eventId,
          priority: 'high',
          expiresAt: rsvpDeadline ? new Date(rsvpDeadline) : undefined,
          metadata: {
            relatedNames: [event.name, school.name],
            extra: { schoolId: schoolId.toString(), eventId: eventId.toString(), rsvpDeadline: rsvpDeadline || null }
          }
        })
      ));
    } catch (notifErr) {
      console.error('Error sending school invitation notifications:', notifErr);
    }

    // Notify the admin who created the event (if different from inviter) that a new school was invited
    try {
      if (event.createdBy && event.createdBy.toString() !== req.session.user.id.toString()) {
        const invitedSchool = await School.findById(schoolId);
        await Notification.create({
          recipientId: event.createdBy,
          type: 'event_reminder',
          title: 'New School Invited to Event',
          message: `${req.session.user.name} has invited ${invitedSchool?.name || schoolId} to "${event.name}".`,
          icon: 'calendar',
          color: 'blue',
          actionUrl: `/dashboard/events/${eventId}`,
          actionLabel: 'View Event',
          entityType: 'event',
          entityId: eventId,
          priority: 'normal'
        });
      }
    } catch (notifErr2) {
      console.error('Error notifying event creator:', notifErr2);
    }

    const populatedEvent = await Event.findById(eventId)
      .populate('targetSchools.schoolId', 'name contactPerson email')
      .lean();

    res.json({ success: true, event: populatedEvent, message: 'School invited successfully' });
  } catch (err) {
    console.error('Error inviting school:', err);
    res.status(500).json({ success: false, error: 'Failed to invite school' });
  }
});

// School RSVP to event (public endpoint - no auth required)
app.post('/api/events/rsvp', async (req, res) => {
  try {
    const { eventId, schoolId, status, participantCount, notes } = req.body;

    if (!eventId || !schoolId || !status) {
      return res.status(400).json({ success: false, error: 'eventId, schoolId, and status are required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const schoolIndex = event.targetSchools.findIndex(s => s.schoolId.toString() === schoolId);
    if (schoolIndex === -1) {
      return res.status(404).json({ success: false, error: 'School not invited to this event' });
    }

    // Update RSVP
    event.targetSchools[schoolIndex].rsvpStatus = status;
    event.targetSchools[schoolIndex].rsvpResponseDate = new Date();
    if (participantCount !== undefined) {
      event.targetSchools[schoolIndex].numberOfParticipants = parseInt(participantCount);
    }
    if (notes) {
      event.targetSchools[schoolIndex].notes = notes;
    }

    // Recalculate total participants from confirmed RSVPs
    event.currentParticipants = event.targetSchools.reduce((sum, s) => {
      return sum + (s.rsvpStatus === 'confirmed' ? (s.numberOfParticipants || 0) : 0);
    }, 0);

    await event.save();

    // Send confirmation email
    try {
      const school = await School.findById(schoolId);
      if (school && school.contactPerson?.email) {
        const confirmationMsg = status === 'confirmed'
          ? 'Your participation has been confirmed!'
          : status === 'declined'
            ? 'We are sorry you cannot make it.'
            : 'Thank you for your response.';

        const emailHtml = `
          <h2>RSVP Confirmation</h2>
          <p>Dear ${school.contactPerson.name || 'School Representative'},</p>
          <p>Your RSVP for <strong>${event.name}</strong> has been recorded as: <strong>${status.replace('_', ' ')}</strong>.</p>
          <p>${confirmationMsg}</p>
          ${participantCount && status === 'confirmed' ? `<p><strong>Students attending:</strong> ${participantCount}</p>` : ''}
        `;

        await emailService.sendEmail({
          to: school.contactPerson.email,
          subject: 'RSVP Confirmation',
          html: emailHtml,
          templateId: 'rsvp_confirmation',
          templateData: {
            contactName: school.contactPerson.name,
            eventName: event.name,
            rsvpStatus: status,
            eventDate: `${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`,
            location: event.location?.name,
            participantCount: participantCount || undefined
          },
          triggeredBy: req.session.user.id,
          entityType: 'event',
          entityId: eventId,
          triggerReason: 'rsvp_submitted',
          priority: 'normal'
        });

        // Notify admin of attendance count update when a school confirms their participation
        if (status === 'confirmed' && event.createdBy && participantCount) {
          await Notification.create({
            recipientId: event.createdBy,
            type: 'event_reminder',
            title: 'Attendance Confirmed',
            message: `${school.name} has confirmed their attendance at "${event.name}" with ${participantCount} student${participantCount !== 1 ? 's' : ''}.`,
            icon: 'users',
            color: 'green',
            actionUrl: `/dashboard/events/${eventId}`,
            actionLabel: 'View Event',
            entityType: 'event',
            entityId: eventId,
            priority: 'normal'
          });
        }
      }

      // Notify event creator about RSVP update (if not the same user)
      if (event.createdBy && event.createdBy.toString() !== req.session.user.id.toString()) {
        await Notification.create({
          recipientId: event.createdBy,
          type: 'event_reminder',
          title: 'RSVP Update',
          message: `${school.name} has ${status} the invitation to ${event.name}`,
          actionUrl: '/dashboard/events/' + eventId,
          entityType: 'event',
          entityId: eventId,
          priority: 'normal'
        });
      }
    } catch (emailErr) {
      console.error('Error sending RSVP confirmation:', emailErr);
    }

    res.json({ success: true, message: 'RSVP submitted successfully' });
  } catch (err) {
    console.error('Error submitting RSVP:', err);
    res.status(500).json({ success: false, error: 'Failed to submit RSVP' });
  }
});

// RSVP form page (public)
app.get('/events/:eventId/rsvp', async (req, res) => {
  try {
    const { school } = req.query;
    const eventId = req.params.eventId;

    const event = await Event.findById(eventId)
      .populate('targetSchools.schoolId', 'name')
      .lean();

    if (!event) {
      return res.status(404).send('Event not found');
    }

    // Verify school is invited
    const invitation = event.targetSchools.find(ts => ts.schoolId.toString() === school);
    if (!invitation) {
      return res.status(403).send('School not invited to this event');
    }

    res.render('event_rsvp', {
      user: null,
      event: {
        _id: event._id,
        name: event.name,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        agenda: event.agenda
      },
      schoolId: school,
      currentStatus: invitation.rsvpStatus,
      rsvpDeadline: invitation.rsvpDeadline
    });
  } catch (err) {
    console.error('Error loading RSVP page:', err);
    res.status(500).send('Error loading RSVP page');
  }
});

// ===== POST-EVENT REVIEW & SIGN-OFF =====

// Submit trainer post-event report
app.post('/api/events/:id/submit-report', requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { trainerReport, actualAttendeeCount } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Check if user is assigned trainer OR admin/supervisor
    const isAssignedTrainer = event.trainers.some(t => t.trainerId.toString() === userId);
    const canEdit = ['admin', 'supervisor', 'coordinator'].includes(userRole);
    if (!isAssignedTrainer && !canEdit) {
      return res.status(403).json({ success: false, error: 'Only assigned trainers or admins can submit reports' });
    }

    // Update review fields
    event.review = event.review || {};
    event.review.trainerReport = trainerReport;
    event.review.reportSubmittedAt = new Date();
    event.review.reportSubmittedBy = userId;
    event.review.reviewStatus = 'pending';
    event.status = 'completed'; // Event finished, report submitted
    event.lastModifiedBy = userId;

    // If actual attendee count provided, update attendance aggregates
    if (actualAttendeeCount !== undefined) {
      event.review.actualAttendeeCount = parseInt(actualAttendeeCount);
      // Also update attendance for each school if needed? Not required.
    }

    await event.save();

    // Notify admins of report submission
    try {
      const admins = await Staff.find({ role: { $in: ['admin', 'supervisor', 'coordinator'] } }).select('email name _id').lean();
      const eventUrl = `${req.protocol}://${req.get('host')}/dashboard/events/${eventId}/review`;

      for (const admin of admins) {
        if (admin.email) {
          const emailHtml = `
            <h2>Trainer Report Submitted</h2>
            <p>Hello ${admin.name},</p>
            <p>A post-event report has been submitted for <strong>${event.name}</strong>.</p>
            <p><strong>Event:</strong> ${event.name}<br>
               <strong>Dates:</strong> ${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}</p>
            <p>Please review the report in the admin dashboard.</p>
          `;

          await emailService.sendEmail({
            to: admin.email,
            subject: 'Event Report Ready for Review',
            html: emailHtml,
            templateId: 'report_submitted',
            templateData: {
              eventName: event.name,
              trainerName: req.session.user.name,
              reviewUrl: eventUrl
            },
            triggeredBy: req.session.user.id,
            entityType: 'event',
            entityId: eventId,
            triggerReason: 'report_submitted',
            priority: 'high'
          });

          // Send in-app notification
          await Notification.create({
            recipientId: admin._id,
            type: 'approval_required',
            title: 'Report Ready for Review',
            message: `A report for "${event.name}" has been submitted and requires your review`,
            actionUrl: '/dashboard/events/' + eventId + '/review',
            entityType: 'event',
            entityId: eventId,
            priority: 'high',
            metadata: { relatedNames: [event.name, req.session.user.name] }
          });
        }
      }
    } catch (emailErr) {
      console.error('Error sending admin notification:', emailErr);
    }

    // Log audit
    await logAudit('report_submitted', 'event', eventId, event.name, {}, {
      userId, userRole,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    });

    res.json({ success: true, message: 'Report submitted successfully', event });
  } catch (err) {
    console.error('Error submitting report:', err);
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

// Review/approve event (admin) - supports approve or request revision
app.post('/api/events/:id/review', requireAuth, requirePermission('canApproveReports'), async (req, res) => {
  try {
    const eventId = req.params.id;
    const { action, reviewNotes, closureStatus = 'closed' } = req.body; // action: 'approve' | 'request_revision'
    const userId = req.session.user.id;

    if (!['approve', 'request_revision'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Use "approve" or "request_revision".' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    if (!event.review?.trainerReport) {
      return res.status(400).json({ success: false, error: 'Cannot review: no trainer report submitted yet' });
    }

    // Update review fields
    event.review.reviewStatus = action === 'approve' ? 'approved' : 'needs_revision';
    event.review.reviewedBy = userId;
    event.review.reviewedAt = new Date();
    if (reviewNotes) event.review.reviewNotes = reviewNotes;

    if (action === 'approve') {
      event.status = 'reviewed';
      event.review.closureStatus = closureStatus;
      event.closedAt = new Date();
      event.closedBy = userId;
    } else {
      // Request revision: event stays completed but reviewStatus indicates needs revision
      event.status = 'completed';
      event.review.closureStatus = 'reopened';
    }

    event.lastModifiedBy = userId;
    await event.save();

    // Notify trainer of review decision
    try {
      const trainerIds = event.trainers.map(t => t.trainerId);
      const trainers = await Staff.find({ _id: { $in: trainerIds } }).select('email name _id').lean();
      const eventUrl = `${req.protocol}://${req.get('host')}/dashboard/events/${eventId}`;

      for (const trainer of trainers) {
        if (trainer.email) {
          const message = action === 'approve'
            ? 'Your event report has been approved and the event is now closed.'
            : 'Your event report requires revisions. Please update and resubmit.';

          const emailHtml = `
            <h2>Event Review Update</h2>
            <p>Hello ${trainer.name},</p>
            <p>Regarding event <strong>${event.name}</strong>: ${message}</p>
            ${reviewNotes ? `<p><strong>Reviewer notes:</strong> ${reviewNotes}</p>` : ''}
          `;

          await emailService.sendEmail({
            to: trainer.email,
            subject: 'Event Review Update',
            html: emailHtml,
            templateId: 'report_reviewed',
            templateData: {
              trainerName: trainer.name,
              eventName: event.name,
              reviewStatus: action === 'approve' ? 'approved' : 'needs revision',
              reviewNotes: reviewNotes,
              eventUrl: eventUrl
            },
            triggeredBy: req.session.user.id,
            entityType: 'event',
            entityId: eventId,
            triggerReason: 'report_' + action,
            priority: action === 'approve' ? 'normal' : 'high'
          });

          // Send in-app notification
          await Notification.create({
            recipientId: trainer._id,
            type: action === 'approve' ? 'system' : 'approval_required',
            title: 'Event Report Reviewed',
            message: `Your report for "${event.name}" has been ${action === 'approve' ? 'approved' : 'marked as needs revision'}`,
            actionUrl: '/dashboard/events/' + eventId,
            entityType: 'event',
            entityId: eventId,
            priority: action === 'approve' ? 'normal' : 'high',
            metadata: { reviewNotes: reviewNotes ? [reviewNotes.substring(0, 100)] : [] }
          });
        }
      }
    } catch (emailErr) {
      console.error('Error notifying trainer:', emailErr);
    }

    // Log audit
    await logAudit(action === 'approve' ? 'event_approved' : 'event_revision_requested', 'event', eventId, event.name, { reviewNotes }, {
      userId, userRole: req.session.user.role,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), sessionId: req.sessionID
    });

    res.json({ success: true, message: `Event ${action === 'approve' ? 'approved' : 'revision requested'}`, event });
  } catch (err) {
    console.error('Error reviewing event:', err);
    res.status(500).json({ success: false, error: 'Failed to review event' });
  }
});

// Get calendar data for month/week view
app.get('/api/calendar', requireAuth, requirePermission('canViewEvents'), async (req, res) => {
  try {
    const { startDate, endDate, view, eventType, trainerId, schoolId, region } = req.query;

    const filter = { status: { $nin: ['cancelled', 'archived'] } };

    // Date range filter (required)
    if (startDate && endDate) {
      filter.startDate = { $lte: new Date(endDate) };
      filter.endDate = { $gte: new Date(startDate) };
    }

    // Optional filters
    if (eventType) filter.eventType = eventType;
    if (region) filter.region = region;
    if (trainerId) filter['trainers.trainerId'] = trainerId;
    if (schoolId) filter['targetSchools.schoolId'] = schoolId;

    const events = await Event.find(filter)
      .populate('trainers.trainerId', 'name email')
      .populate('targetSchools.schoolId', 'name')
      .lean();

    // Transform data for calendar display
    const calendarEvents = events.map(event => ({
      id: event._id,
      title: event.name,
      start: event.startDate,
      end: event.endDate,
      type: event.eventType,
      status: event.status,
      location: event.location?.name || '',
      region: event.region || '',
      trainers: event.trainers.map(t => ({
        name: t.trainerId?.name || 'Unassigned',
        role: t.role
      })),
      schools: event.targetSchools.map(s => ({
        name: s.schoolId?.name || 'Unknown',
        rsvp: s.rsvpStatus
      })),
      participants: event.currentParticipants,
      maxParticipants: event.maxParticipants
    }));

    res.json({ success: true, events: calendarEvents });
  } catch (err) {
    console.error('Error fetching calendar:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar' });
  }
});

// Export calendar to CSV
app.get('/api/calendar/export', requireAuth, requirePermission('canViewEvents'), async (req, res) => {
  try {
    const { startDate, endDate, eventType } = req.query;

    // Validate date range (max 1 year)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return res.status(400).json({ success: false, error: 'Date range cannot exceed 1 year' });
      }
    }

    const filter = { status: { $nin: ['cancelled', 'archived'] } };
    if (startDate && endDate) {
      filter.startDate = { $lte: new Date(endDate) };
      filter.endDate = { $gte: new Date(startDate) };
    }
    if (eventType) filter.eventType = eventType;

    const events = await Event.find(filter)
      .sort({ startDate: 1 })
      .lean();

    const headers = ['Event Name', 'Type', 'Start Date', 'End Date', 'Location', 'Region', 'Status', 'Current Participants', 'Max Participants'];
    const rows = events.map(e => [
      e.name,
      e.eventType.replace('_', ' '),
      e.startDate ? new Date(e.startDate).toLocaleDateString() : '',
      e.endDate ? new Date(e.endDate).toLocaleDateString() : '',
      e.location?.name || '',
      e.region || '',
      e.status,
      e.currentParticipants,
      e.maxParticipants
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="events-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting calendar:', err);
    res.status(500).json({ success: false, error: 'Failed to export calendar' });
  }
});

// Export calendar to PDF
app.get('/api/calendar/export/pdf', requireAuth, requirePermission('canViewEvents'), async (req, res) => {
  try {
    const { startDate, endDate, eventType, trainerId, schoolId, region } = req.query;

    // Validate date range (max 1 year)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return res.status(400).json({ success: false, error: 'Date range cannot exceed 1 year' });
      }
    }

    const filter = { status: { $nin: ['cancelled', 'archived'] } };
    if (startDate && endDate) {
      filter.startDate = { $lte: new Date(endDate) };
      filter.endDate = { $gte: new Date(startDate) };
    }
    if (eventType) filter.eventType = eventType;
    if (region) filter.region = region;
    if (trainerId) filter['trainers.trainerId'] = trainerId;
    if (schoolId) filter['targetSchools.schoolId'] = schoolId;

    const events = await Event.find(filter)
      .sort({ startDate: 1 })
      .lean();

    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="events-export-${new Date().toISOString().split('T')[0]}.pdf"`);

    doc.pipe(res);

    // Fetch organization settings for branding
    const systemSettings = await SystemSettings.findOne({ _id: 'global-settings' });
    const org = systemSettings?.organization || {};

    let currentY = 50;
    const pageWidth = doc.page.width;

    // Add logo if available (portrait orientation may need wider logo)
    const logoWidth = org.logoWidth || 50;
    if (org.logoUrl) {
      let imagePath = org.logoUrl;
      let imageLoaded = false;

      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        try {
          const x = (pageWidth - logoWidth) / 2;
          doc.image(imagePath, x, currentY, { width: logoWidth });
          imageLoaded = true;
        } catch (err) {
          console.warn('Failed to load external logo:', err);
        }
      } else {
        const relativePath = imagePath.replace(/^\//, '');
        const absolutePath = path.join(__dirname, '..', 'public', relativePath);
        if (fs.existsSync(absolutePath)) {
          try {
            const x = (pageWidth - logoWidth) / 2;
            doc.image(absolutePath, x, currentY, { width: logoWidth });
            imageLoaded = true;
          } catch (err) {
            console.warn('Failed to load local logo:', err);
          }
        } else {
          console.warn('Logo file not found:', absolutePath);
        }
      }

      if (imageLoaded) {
        currentY += logoWidth + 15;
        doc.y = currentY;
      }
    }

    // Title
    doc.fontSize(20).text(org.organizationName ? `Event Calendar - ${org.organizationName}` : 'Event Calendar Export', { align: 'center' });
    if (org.tagline) {
      doc.fontSize(10).text(org.tagline, { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Table column definitions
    const columns = [
      { label: 'Event Name', key: 'name', width: 180 },
      { label: 'Type', key: 'eventType', width: 80 },
      { label: 'Start', key: 'startDate', width: 70 },
      { label: 'End', key: 'endDate', width: 70 },
      { label: 'Location', key: 'location', width: 100 },
      { label: 'Region', key: 'region', width: 70 },
      { label: 'Status', key: 'status', width: 70 },
      { label: 'Part', key: 'currentParticipants', width: 30 },
      { label: 'Max', key: 'maxParticipants', width: 30 }
    ];

    // Table header
    let x = 50;
    let y = doc.y;
    doc.font('Helvetica-Bold');
    columns.forEach(col => {
      doc.text(col.label, x, y, { width: col.width, align: 'left' });
      x += col.width;
    });
    doc.moveTo(50, y + 20).lineTo(550, y + 20).stroke();
    y += 25;

    // Table rows
    doc.font('Helvetica');
    for (const ev of events) {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      x = 50;
      const row = [
        ev.name,
        ev.eventType.replace('_', ' '),
        ev.startDate ? new Date(ev.startDate).toLocaleDateString() : '',
        ev.endDate ? new Date(ev.endDate).toLocaleDateString() : '',
        ev.location?.name || '',
        ev.region || '',
        ev.status,
        ev.currentParticipants.toString(),
        ev.maxParticipants.toString()
      ];
      row.forEach((text, i) => {
        doc.text(text, x, y, { width: columns[i].width, align: 'left', valign: 'top' });
        x += columns[i].width;
      });
      y += 15;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 5;
    }

    doc.end();
  } catch (err) {
    console.error('Error exporting PDF:', err);
    res.status(500).json({ success: false, error: 'Failed to export PDF' });
  }
});

// Duplicate route removed - use GET /api/events/:eventId instead

// GET trainers list for dropdowns
app.get('/api/trainers/list', requireAuth, requirePermission('canViewStaff'), async (req, res) => {
  try {
    const trainers = await Staff.find({ role: { $in: ['trainer', 'senior trainer', 'supervisor', 'coordinator'] } })
      .select('name email idNumber role status')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, trainers });
  } catch (err) {
    console.error('Error fetching trainers list:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch trainers' });
  }
});

// Dashboard KPI data (enhanced)
app.get('/api/dashboard/kpi', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const result = await analyticsController.getDashboardData(req, res);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    res.status(500).json({ error: 'Failed to fetch KPI data' });
  }
});

// Reports endpoints
app.get('/api/reports/trainer-performance', requireAuth, requirePermission('canViewAnalytics'), reportsController.getTrainerPerformanceReport);
app.get('/api/reports/event-effectiveness', requireAuth, requirePermission('canViewAnalytics'), reportsController.getEventEffectivenessReport);
app.get('/api/reports/school-engagement', requireAuth, requirePermission('canViewAnalytics'), reportsController.getSchoolEngagementReport);

// Export endpoints
app.get('/api/export/:reportType', requireAuth, requirePermission('canExportData'), exportController.exportReport);
app.post('/api/reports/templates/save', requireAuth, requirePermission('canGenerateReports'), exportController.saveTemplate);
app.get('/api/reports/templates', requireAuth, requirePermission('canGenerateReports'), exportController.getReportTemplates);
app.get('/api/reports/scheduled', requireAuth, requirePermission('canGenerateReports'), exportController.getScheduledReports);
app.post('/api/reports/scheduled', requireAuth, requirePermission('canGenerateReports'), exportController.createScheduledReport);

// ============ SETTINGS & CONFIGURATION API ROUTES ============

// Settings - Get all or by section
app.get('/api/settings', requireAuth, requirePermission('canManageSystem'), settingsController.getSettings);
app.get('/api/settings/organization', requireAuth, requirePermission('canManageSystem'), (req, res) => {
  req.query.section = 'organization';
  settingsController.getSettings(req, res);
});
app.get('/api/settings/system', requireAuth, requirePermission('canManageSystem'), (req, res) => {
  req.query.section = 'system';
  settingsController.getSettings(req, res);
});
app.get('/api/settings/backup', requireAuth, requirePermission('canManageSystem'), (req, res) => {
  req.query.section = 'backup';
  settingsController.getSettings(req, res);
});

// Update organization profile
app.post('/api/settings/organization', requireAuth, requirePermission('canManageSystem'), uploadLogo.single('logoFile'), settingsController.updateOrganizationProfile);

// Update system defaults
app.post('/api/settings/system', requireAuth, requirePermission('canManageSystem'), settingsController.updateSystemDefaults);

// Update backup configuration
app.post('/api/settings/backup', requireAuth, requirePermission('canManageSystem'), settingsController.updateBackupConfig);

// Manual backup trigger
app.post('/api/backup/trigger', requireAuth, requirePermission('canManageSystem'), settingsController.triggerBackup);

// Backup history
app.get('/api/backup/history', requireAuth, requirePermission('canManageSystem'), settingsController.getBackupHistory);
app.get('/api/backup/download/:filename', requireAuth, requirePermission('canManageSystem'), settingsController.downloadBackup);
app.post('/api/backup/delete/:filename', requireAuth, requirePermission('canManageSystem'), settingsController.deleteBackup);

// Public Holidays
app.get('/api/settings/holidays', requireAuth, settingsController.getPublicHolidays);
app.post('/api/settings/holidays', requireAuth, requirePermission('canManageSystem'), settingsController.savePublicHoliday);
app.delete('/api/settings/holidays/:date', requireAuth, requirePermission('canManageSystem'), settingsController.deletePublicHoliday);

// Organization Profile (for email templates, invoices, reports)
app.get('/api/organization/profile', settingsController.getOrganizationProfile);

// ============ COMMUNICATION API ROUTES ============

// ============ COMMUNICATION ROUTES ============

// --- Messaging Routes ---

// Send direct message to staff
app.post('/api/messages/send', requireAuth, async (req, res) => {
  try {
    const { recipientIds, subject, body, parentMessageId, priority = 'normal', labels, messageType } = req.body;
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one recipient is required' });
    }
    if (!body) {
      return res.status(400).json({ success: false, error: 'Message body is required' });
    }

     // Get sender's Staff record (auto-creates for admin/founder if missing)
     const sender = await getCurrentStaff(req);
     if (!sender) {
       return res.status(404).json({ success: false, error: 'Sender staff profile not found. Please contact admin.' });
     }

     const msgType = messageType || (recipientIds.length > 1 ? 'group' : 'direct');

    const message = new Message({
      senderId: sender._id,
      senderName: sender.name,
      senderRole: sender.role,
      recipients: recipientIds.map(rid => ({
        staffId: rid,
        status: 'sent'
      })),
      subject,
      body,
      parentMessageId,
      messageType: msgType,
      priority,
      labels
    });

    await message.save();

     // Create in-app notifications for recipients
     for (const recipientId of recipientIds) {
       await Notification.create({
         recipientId,
         type: 'new_message',
         title: subject || 'New Message',
         message: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
         actionUrl: '/dashboard/messages?thread=' + message._id,
         entityType: 'message',
         entityId: message._id,
         priority: priority === 'urgent' ? 'high' : 'normal'
       });
     }

    res.json({ success: true, messageId: message._id, message });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Get messages for current user (inbox/sent)
app.get('/api/messages', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, folder = 'inbox' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get current user's Staff ID (auto-creates for admin/founder if missing)
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    let query;
    if (folder === 'inbox') {
      query = {
        'recipients.staffId': staffId,
        'recipients.deleted': { $ne: true }
      };
    } else if (folder === 'sent') {
      query = { senderId: staffId };
    } else if (folder === 'important') {
      query = {
        $or: [
          { senderId: staffId, isImportant: true },
          { 'recipients.staffId': staffId, 'recipients.deleted': { $ne: true }, isImportant: true }
        ]
      };
    } else {
      return res.status(400).json({ success: false, error: 'Invalid folder' });
    }

    const messages = await Message.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('senderId', 'name email role')
      .populate('recipients.staffId', 'name email')
      .lean();

    const unreadCount = await Message.countDocuments({
      'recipients.staffId': staffId,
      'recipients.status': 'sent',
      'recipients.deleted': { $ne: true }
    });

    res.json({ messages, unreadCount, page: parseInt(page) });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// Get single message
app.get('/api/messages/:messageId', requireAuth, async (req, res) => {
  try {
    // Get current user's Staff ID
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const message = await Message.findOne({
      _id: req.params.messageId,
      $or: [
        { senderId: staffId },
        { 'recipients.staffId': staffId }
      ]
    }).populate('senderId', 'name email role')
      .populate('recipients.staffId', 'name email role');

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Mark as read for current user if they are a recipient
    if (message.senderId.toString() !== staffId.toString()) {
      const recipient = message.recipients.find(r => r.staffId.toString() === staffId.toString());
      if (recipient && recipient.status !== 'read') {
        recipient.status = 'read';
        recipient.readAt = new Date();
        await message.save();
      }
    }

    res.json({ message });
  } catch (err) {
    console.error('Error fetching message:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch message' });
  }
});

// Mark message as read
app.post('/api/messages/:messageId/read', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    await Message.findOneAndUpdate(
      { _id: req.params.messageId, 'recipients.staffId': staffId },
      { $set: { 'recipients.$.status': 'read', 'recipients.$.readAt': new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking message as read:', err);
    res.status(500).json({ success: false, error: 'Failed to mark message as read' });
  }
});

// Mark message as deleted (soft delete for recipient)
app.post('/api/messages/:messageId/delete', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    await Message.findOneAndUpdate(
      { _id: req.params.messageId, 'recipients.staffId': staffId },
      { $set: { 'recipients.$.deleted': true, 'recipients.$.deletedAt': new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// Search messages
app.get('/api/messages/search', requireAuth, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    // Search in messages where user is sender or recipient
    const messages = await Message.find({
      $or: [
        { senderId: staffId, $text: { $search: q } },
        { 'recipients.staffId': staffId, $text: { $search: q } }
      ],
      'recipients.deleted': { $ne: true }
    })
      .sort({ score: { $meta: 'textScore' }, sentAt: -1 })
      .limit(parseInt(limit))
      .populate('senderId', 'name email role')
      .lean();

    res.json({ messages });
  } catch (err) {
    console.error('Error searching messages:', err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// Get unread message count
app.get('/api/messages/unread-count', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const count = await Message.countDocuments({
      'recipients.staffId': staffId,
      'recipients.status': 'sent',
      'recipients.deleted': { $ne: true }
    });
    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Error getting unread count:', err);
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

// Mark all messages as read
app.post('/api/messages/mark-all-read', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    await Message.updateMany(
      { 'recipients.staffId': staffId, 'recipients.status': 'sent' },
      { $set: { 'recipients.$.status': 'read', 'recipients.$.readAt': new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all messages as read:', err);
    res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
  }
});

// Upload attachment for message
app.post('/api/messages/:messageId/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Verify user is sender or recipient
    const isSender = message.senderId.toString() === currentStaff._id.toString();
    const isRecipient = message.recipients.some(r => r.staffId.toString() === currentStaff._id.toString());
    if (!isSender && !isRecipient) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const attachment = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date()
    };

    message.attachments.push(attachment);
    await message.save();

    res.json({ success: true, attachment });
  } catch (err) {
    console.error('Error uploading attachment:', err);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// Download attachment
app.get('/api/messages/:messageId/attachment/:filename', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Verify user is sender or recipient
    const isSender = message.senderId.toString() === currentStaff._id.toString();
    const isRecipient = message.recipients.some(r => r.staffId.toString() === currentStaff._id.toString());
    if (!isSender && !isRecipient) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const attachment = message.attachments.find(a => a.fileName === req.params.filename);
    if (!attachment) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    res.download(attachment.path, attachment.originalName);
  } catch (err) {
    console.error('Error downloading attachment:', err);
    res.status(500).json({ success: false, error: 'Failed to download file' });
  }
});

// Get conversation thread (replies)
app.get('/api/messages/thread/:parentMessageId', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const parentMessage = await Message.findById(req.params.parentMessageId);
    if (!parentMessage) {
      return res.status(404).json({ success: false, error: 'Parent message not found' });
    }

    // Verify access to parent message
    const hasAccess = parentMessage.senderId.toString() === staffId.toString() ||
      parentMessage.recipients.some(r => r.staffId.toString() === staffId.toString());
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const replies = await Message.find({
      parentMessageId: req.params.parentMessageId,
      $or: [
        { senderId: staffId },
        { 'recipients.staffId': staffId }
      ]
    })
      .sort({ sentAt: 1 })
      .populate('senderId', 'name email role')
      .populate('recipients.staffId', 'name email role')
      .lean();

    res.json({ success: true, parent: parentMessage, replies });
  } catch (err) {
    console.error('Error fetching thread:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch thread' });
  }
});

// --- Team Chat Routes ---

// Get team chats for current user (by event, region, school)
app.get('/api/team-chats', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const { type, eventId, region } = req.query;

    // Fetch staff's assignments
    const staff = await Staff.findById(staffId)
      .populate('assignedSchools.schoolId')
      .lean();

    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff not found' });
    }

    let teamChats = [];

    if (type === 'event' && eventId) {
      // Get messages for specific event
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      // Verify trainer is assigned to this event
      const isAssigned = event.trainers.some(t => t.trainerId.toString() === staffId.toString());
      if (!isAssigned && !['admin', 'founder', 'commissioner', 'supervisor'].includes(currentStaff.role)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      // Get event-specific messages where all recipients are event trainers
      const eventTrainerIds = event.trainers.map(t => t.trainerId);
      const eventMessages = await Message.find({
        'context.eventId': eventId,
        messageType: { $in: ['group', 'direct'] }
      })
        .sort({ sentAt: -1 })
        .limit(50)
        .populate('senderId', 'name role')
        .lean();

      teamChats = eventMessages.map(msg => ({
        ...msg,
        context: { type: 'event', eventId, eventName: event.name }
      }));
    } else if (type === 'region' && region) {
      // Get messages for region/zone
      const regionStaff = await Staff.find({ zones: region }).select('_id');
      const regionStaffIds = regionStaff.map(s => s._id);

      const regionMessages = await Message.find({
        'context.region': region,
        'recipients.staffId': { $in: regionStaffIds },
        messageType: 'group'
      })
        .sort({ sentAt: -1 })
        .limit(50)
        .populate('senderId', 'name role')
        .lean();

      teamChats = regionMessages;
    } else {
      // Get all team chats for this staff member
      // Messages with messageType='group' and context.type in ['event', 'region', 'school']
      const assignedSchoolIds = staff.assignedSchools.map(a => a.schoolId._id.toString());

      const personalMessages = await Message.find({
        $or: [
          { 'recipients.staffId': staffId, messageType: 'group', 'context.type': { $exists: true } },
          { 'context.schoolId': { $in: assignedSchoolIds } }
        ]
      })
        .sort({ sentAt: -1 })
        .limit(50)
        .populate('senderId', 'name role')
        .lean();

      teamChats = personalMessages;
    }

    res.json({ success: true, teamChats });
  } catch (err) {
    console.error('Error fetching team chats:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch team chats' });
  }
});

// Get group chat by event ID
app.get('/api/events/:eventId/chat', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;
    const eventId = req.params.eventId;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Verify trainer is assigned to this event
    const isAssigned = event.trainers.some(t => t.trainerId.toString() === staffId.toString());
    if (!isAssigned && !['admin', 'founder', 'commissioner', 'supervisor'].includes(currentStaff.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Find or create event team chat
    let eventChat = await Message.findOne({
      'context.eventId': eventId,
      messageType: 'group',
      'recipients.staffId': { $exists: true }
    }).sort({ createdAt: 1 });

    if (!eventChat) {
      // First message - create the group chat
      const eventTrainers = event.trainers.filter(t => t.status === 'confirmed').map(t => t.trainerId);
      eventChat = new Message({
        senderId: event.trainers[0]?.trainerId || staffId,
        senderName: 'Event Chat',
        senderRole: 'system',
        recipients: eventTrainers.map(tid => ({ staffId: tid, status: 'sent' })),
        subject: `Event Chat: ${event.name}`,
        body: 'Welcome to the event team chat! Use this thread to coordinate logistics, share updates, and discuss event-related matters.',
        messageType: 'group',
        priority: 'normal',
        context: {
          type: 'event',
          eventId: eventId,
          eventName: event.name,
          region: event.region
        }
      });
      await eventChat.save();

      // Mark as system message so it doesn't clutter inbox
      eventChat.status = 'sent';
      await eventChat.save();
    }

    // Get all messages for this event chat
    const eventMessages = await Message.find({
      $or: [
        { _id: eventChat._id },
        { parentMessageId: eventChat._id }
      ]
    })
      .sort({ sentAt: 1 })
      .populate('senderId', 'name role')
      .populate('recipients.staffId', 'name role')
      .lean();

    res.json({ success: true, messages: eventMessages, event: { id: event._id, name: event.name, region: event.region } });
  } catch (err) {
    console.error('Error fetching event chat:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch event chat' });
  }
});

// Get region/zone team chat
app.get('/api/region-chat/:zone', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;
    const zone = req.params.zone;

    // Verify staff belongs to this zone
    const staff = await Staff.findById(staffId);
    if (!staff.zones.includes(zone) && !['admin', 'founder', 'commissioner', 'supervisor'].includes(staff.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get all staff in this zone
    const zoneStaff = await Staff.find({ zones: zone }).select('_id');
    const zoneStaffIds = zoneStaff.map(s => s._id);

    // Get region chat messages
    const messages = await Message.find({
      'context.zone': zone,
      'recipients.staffId': { $in: zoneStaffIds },
      messageType: 'group'
    })
      .sort({ sentAt: 1 })
      .limit(100)
      .populate('senderId', 'name role')
      .lean();

    res.json({ success: true, messages, zone });
  } catch (err) {
    console.error('Error fetching region chat:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch region chat' });
  }
});

// Send team message (to event, region, or school group)
app.post('/api/team-messages/send', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }

    const { contextType, eventId, zone, schoolId, body, priority = 'normal', subject } = req.body;
    if (!body) {
      return res.status(400).json({ success: false, error: 'Message body is required' });
    }

    let recipientIds = [];
    let context = {};

    if (contextType === 'event' && eventId) {
      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

      const isAssigned = event.trainers.some(t => t.trainerId.toString() === currentStaff._id.toString());
      if (!isAssigned && !['admin', 'founder', 'commissioner', 'supervisor'].includes(currentStaff.role)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      recipientIds = event.trainers.map(t => t.trainerId);
      context = { type: 'event', eventId, eventName: event.name, region: event.region };
    } else if (contextType === 'region' && zone) {
      const zoneStaff = await Staff.find({ zones: zone }).select('_id');
      recipientIds = zoneStaff.map(s => s._id);
      context = { type: 'region', zone };

      if (!recipientIds.includes(currentStaff._id)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (contextType === 'school' && schoolId) {
      const schoolAssignments = await Staff.find({
        'assignedSchools.schoolId': schoolId
      }).select('_id');
      recipientIds = schoolAssignments.map(s => s._id);
      context = { type: 'school', schoolId };

      if (!recipientIds.includes(currentStaff._id)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Invalid context type or missing ID' });
    }

    // Remove duplicates and exclude sender
    recipientIds = [...new Set(recipientIds.filter(id => id.toString() !== currentStaff._id.toString()))];

    const message = new Message({
      senderId: currentStaff._id,
      senderName: currentStaff.name,
      senderRole: currentStaff.role,
      recipients: recipientIds.map(rid => ({ staffId: rid, status: 'sent' })),
      subject: subject || `[${contextType.toUpperCase()}] ${context.eventName || context.zone || 'Group Message'}`,
      body,
      messageType: 'group',
      priority,
      context
    });

    await message.save();

    // Create notifications for recipients
    for (const recipientId of recipientIds) {
      await Notification.create({
        recipientId,
        type: 'new_message',
        title: subject || `New ${contextType} message`,
        message: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        actionUrl: `/api/team-chats?type=${contextType}&${contextType}Id=${eventId || zone || schoolId}`,
        entityType: 'message',
        entityId: message._id,
        priority: priority === 'urgent' ? 'high' : 'normal'
      });
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error('Error sending team message:', err);
    res.status(500).json({ success: false, error: 'Failed to send team message' });
  }
});

// --- Notification Routes ---

// Get user notifications
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, unreadOnly = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get current user's Staff ID
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const query = { recipientId: staffId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipientId: staffId,
      isRead: false,
      dismissed: false
    });

    res.json({ success: true, notifications, unreadCount, page: parseInt(page) });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.post('/api/notifications/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipientId: staffId },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    await Notification.updateMany(
      { recipientId: staffId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all as read:', err);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

// Dismiss notification (soft delete)
app.post('/api/notifications/:notificationId/dismiss', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipientId: staffId },
      { $set: { dismissed: true, dismissedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error dismissing notification:', err);
    res.status(500).json({ success: false, error: 'Failed to dismiss notification' });
  }
});

// Get notification preferences
app.get('/api/notification-preferences', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      // Return defaults if no staff record
      const defaultPrefs = new NotificationPreference({
        staffId: req.session.user.id, // fallback
        notificationsEnabled: true
      });
      return res.json(defaultPrefs);
    }
    const staffId = currentStaff._id;

    let prefs = await NotificationPreference.findOne({ staffId });

    if (!prefs) {
      // Create default preferences
      prefs = new NotificationPreference({ staffId });
      await prefs.save();
    }

    res.json(prefs);
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

// Update notification preferences
app.post('/api/notification-preferences', requireAuth, async (req, res) => {
  try {
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(404).json({ success: false, error: 'Staff profile not found' });
    }
    const staffId = currentStaff._id;

    const prefs = await NotificationPreference.findOneAndUpdate(
      { staffId },
      req.body,
      { upsert: true, new: true }
    );
    res.json({ success: true, prefs });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

// Get all active staff (for messaging)
app.get('/api/staff/all', requireAuth, async (req, res) => {
  try {
    const staff = await Staff.find({ status: { $ne: 'Inactive' } })
      .select('_id name email role')
      .sort({ name: 1 })
      .lean();
    res.json(staff);
  } catch (err) {
    console.error('Error fetching staff list:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch staff' });
  }
});

// --- Announcement Routes ---

// Create announcement (admin only)
app.post('/api/announcements', requireAuth, async (req, res) => {
  try {
    // Check permission - only admins/supervisors can create announcements
    if (!['admin', 'founder', 'commissioner', 'supervisor'].includes(req.session.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Get current staff record (auto-creates for admin/founder if missing)
    const currentStaff = await getCurrentStaff(req);
    if (!currentStaff) {
      return res.status(403).json({ success: false, error: 'Staff profile not found. Cannot create announcement.' });
    }

    const {     
      title,
      content,
      format = 'plain',
      attachments,
      targetType,
      targetDetails,
      deliveryType = 'immediate',
      scheduledAt,
      recurrence,
      priority = 'normal',
      requiresAcknowledgment = false,
      acknowledgmentDeadline,
      sendAsNotification = true,
      sendEmail = true,
      emailSubject,
      emailTemplate = 'default'
    } = req.body;

    if (!title || !content || !targetType) {
      return res.status(400).json({ success: false, error: 'Title, content, and targetType are required' });
    }

    const announcement = new Announcement({
      createdBy: currentStaff._id,
      createdByRole: req.session.user.role,
      title,
      content,
      format,
      attachments,
      targetType,
      targetDetails: targetDetails || {},
      deliveryType,
      scheduledAt,
      recurrence,
      priority,
      requiresAcknowledgment,
      acknowledgmentDeadline,
      sendAsNotification,
      sendEmail,
      emailSubject: emailSubject || title,
      emailTemplate,
      status: deliveryType === 'scheduled' && scheduledAt ? 'scheduled' : 'draft'
    });

    await announcement.save();

    // Immediate delivery - send email and create notifications
    if (deliveryType === 'immediate') {
      await deliverAnnouncement(announcement);
    }

    res.json({ success: true, announcementId: announcement._id, announcement });
  } catch (err) {
    console.error('Error creating announcement:', err);
    res.status(500).json({ success: false, error: 'Failed to create announcement' });
  }
});

// Get announcements (visible to current user based on targeting)
app.get('/api/announcements', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'sent' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Get user's staff record for targeting (zone, school, etc.)
    const currentStaff = await Staff.findById(userId).select('zones assignedSchools role');
    const userZones = currentStaff?.zones || [];
    const userSchoolIds = currentStaff?.assignedSchools?.map(a => a.schoolId.toString()) || [];

    // Build query for announcements visible to this user
    let query = { status: 'sent' };

    // Admins see everything; others see only targeted to them
    if (!['admin', 'founder', 'commissioner', 'supervisor'].includes(userRole)) {
      const targetingMatch = {
        $or: [
          { targetType: 'all_trainers', targetDetails: { roles: userRole === 'trainer' ? ['trainer'] : [] } },
          { targetType: 'all_staff' },
          { targetType: 'specific_roles', targetDetails: { roles: { $in: [userRole] } } }
        ]
      };

      // Add zone targeting
      if (userZones.length > 0) {
        targetingMatch.$or.push({
          targetType: 'specific_zones',
          'targetDetails.zones': { $in: userZones }
        });
      }

      // Add school targeting
      if (userSchoolIds.length > 0) {
        targetingMatch.$or.push({
          targetType: 'specific_schools',
          'targetDetails.ids': { $in: userSchoolIds }
        });
      }

      query.$or = targetingMatch.$or;
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email role')
      .lean();

    const total = await Announcement.countDocuments(query);

    res.json({
      announcements,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
  }
});

// Acknowledge announcement
app.post('/api/announcements/:announcementId/acknowledge', requireAuth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.announcementId);
    if (!announcement) {
      return res.status(404).json({ success: false, error: 'Announcement not found' });
    }

    // Check if user is targeted by this announcement (optional: enforce)
    // For now, allow any logged-in user to acknowledge

    // Prevent duplicate acknowledgment
    const alreadyAcknowledged = announcement.acknowledgments?.some(
      a => a.staffId.toString() === req.session.user.id
    );

    if (!alreadyAcknowledged) {
      announcement.acknowledgments = announcement.acknowledgments || [];
      announcement.acknowledgments.push({
        staffId: req.session.user.id,
        acknowledgedAt: new Date(),
        notes: req.body.notes || ''
      });

      announcement.metrics = announcement.metrics || {};
      announcement.metrics.acknowledgedCount = (announcement.metrics.acknowledgedCount || 0) + 1;

      await announcement.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error acknowledging announcement:', err);
    res.status(500).json({ success: false, error: 'Failed to acknowledge announcement' });
   }
 });

 // Get single announcement
app.get('/api/announcements/:announcementId', requireAuth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.announcementId)
      .populate('createdBy', 'name email role')
      .lean();
    if (!announcement) {
      return res.status(404).json({ success: false, error: 'Announcement not found' });
    }
    res.json({ announcement });
  } catch (err) {
    console.error('Error fetching announcement:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch announcement' });
  }
});

 // Bulk send announcement (for future scheduled delivery)
 async function deliverAnnouncement(announcement) {
  try {
    const { targetType, targetDetails, sendEmail, emailSubject, emailTemplate } = announcement;

    // Resolve all recipients based on targetType
    let recipients = [];
    switch (targetType) {
      case 'all_trainers':
        recipients = await Staff.find({ role: 'trainer' }).select('email name _id').lean();
        break;
      case 'all_staff':
        recipients = await Staff.find({}).select('email name _id').lean();
        break;
      case 'specific_zones':
        recipients = await Staff.find({ zones: { $in: targetDetails.zones || [] } }).select('email name _id').lean();
        break;
      case 'specific_roles':
        recipients = await Staff.find({ role: { $in: targetDetails.roles || [] } }).select('email name _id').lean();
        break;
      case 'specific_schools':
        // Get staff assigned to these schools
        const schools = await School.find({ _id: { $in: targetDetails.ids || [] } });
        const staffIds = new Set();
        for (const school of schools) {
          // Could also email school contacts directly
          // For now, notify assigned staff
        }
        recipients = await Staff.find({ _id: { $in: Array.from(staffIds) } }).select('email name _id').lean();
        break;
      default:
        console.warn('Unknown targetType:', targetType);
    }

    // Deliver to each recipient
    for (const recipient of recipients) {
      // Create in-app notification
      await Notification.create({
        recipientId: recipient._id,
        type: 'announcement',
        title: announcement.title,
        message: announcement.content.substring(0, 150) + (announcement.content.length > 150 ? '...' : ''),
        actionUrl: '/announcements/' + announcement._id,
        entityType: 'announcement',
        entityId: announcement._id,
        priority: announcement.priority,
        channels: ['in-app']
      });

      // Send email if requested
      if (sendEmail) {
        await emailService.sendEmail({
          to: recipient.email,
          subject: emailSubject || announcement.title,
          html: announcement.content,
          templateId: emailTemplate === 'default' ? 'announcement' : emailTemplate,
          templateData: {
            title: announcement.title,
            content: announcement.content,
            actionUrl: `${req.protocol}://${req.get('host')}${announcement.actionUrl || '/dashboard'}`,
            priority: announcement.priority
          },
          triggeredBy: announcement.createdBy,
          entityType: 'announcement',
          entityId: announcement._id,
          triggerReason: 'bulk_announcement',
          priority: announcement.priority
        });
      }
    }

    // Update announcement status
    announcement.status = 'sent';
    announcement.sentAt = new Date();
    announcement.metrics = announcement.metrics || {};
    announcement.metrics.totalRecipients = recipients.length;
    await announcement.save();

    console.log(`[Announcement] Delivered to ${recipients.length} recipients`);

  } catch (err) {
    console.error('Error delivering announcement:', err);
    // Mark as failed if all fail
    announcement.status = 'failed';
    await announcement.save();
  }
}

// --- System Notification Triggers (internal) ---

// Create notification (internal endpoint)
app.post('/api/notifications/create', requireAuth, async (req, res) => {
  try {
    const { recipientId, type, title, message, actionUrl, entityType, entityId, priority = 'normal', channels = ['in-app'], metadata, isSticky = false } = req.body;

    if (!recipientId || !type || !title || !message) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check recipient preferences before sending
    const prefs = await NotificationPreference.findOne({ staffId: recipientId });
    if (prefs && prefs.notificationsEnabled === false) {
      return res.json({ success: false, skipped: true, reason: 'User disabled notifications' });
    }

    if (prefs && prefs.types && prefs.types[type] && prefs.types[type].enabled === false) {
      return res.json({ success: false, skipped: true, reason: 'Notification type disabled by user' });
    }

    const notification = new Notification({
      recipientId,
      type,
      title,
      message,
      actionUrl,
      entityType,
      entityId,
      priority,
      channels,
      isSticky,
      metadata
    });

    await notification.save();

    // Send email if channel includes email and user prefers it
    if (channels.includes('email') && prefs && prefs.channels?.email?.enabled) {
      // Email would be sent via a background job in production
      // For now, just log
      await emailService.sendEmail({
        to: (await Staff.findById(recipientId))?.email || 'unknown',
        subject: `[${type.toUpperCase()}] ${title}`,
        html: `<p>${message}</p>${actionUrl ? `<p><a href="${actionUrl}">Take action</a></p>` : ''}`,
        triggeredBy: req.session.user.id,
        entityType: entityType,
        entityId: entityId,
        triggerReason: type
      });
      notification.emailSent = true;
      notification.emailSentAt = new Date();
      await notification.save();
    }

    res.json({ success: true, notificationId: notification._id, notification });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
});




// Middleware to check for founder role
function requireFounder(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'founder') return next();
  return res.status(403).send('Forbidden: founder role required');
}

// ============ TABLE EXPORT ROUTES ============
const tableExportRoutes = require('./backend/routes/tableExport');
app.use('/api', tableExportRoutes);

// ============ FINANCE ROUTES ============
const financeRoutes = require('./backend/routes/finance');
app.use('/finance', financeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user });
});

// Start server
const initializePermissions = async () => {
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
          canExportData: false,
          canScheduleReports: false,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Basic trainer role with limited access'
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
          canApproveBookings: false,
          canViewFinancials: false,
          canManageBudgets: false,
          canViewAnalytics: true,
          canGenerateReports: true,
          canExportData: false,
          canScheduleReports: false,
          canApproveReports: false,
          canManageSystem: false,
          canViewAuditLogs: false,
          canManagePermissions: false
        },
        description: 'Senior trainer with event creation and trainer assignment capabilities'
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
           canDeleteEvents: true,
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
           canViewFinancials: false,
           canManageBudgets: false,
           canViewAnalytics: true,
           canGenerateReports: true,
           canExportData: false,
           canScheduleReports: false,
           canApproveReports: false,
           canManageSystem: false,
           canViewAuditLogs: false,
           canManagePermissions: false
         },
         description: 'Coordinator for scheduling and assignments'
       },
       {
         role: 'supervisor',
         permissions: {
           canViewStaff: true,
           canCreateStaff: false,
           canEditStaff: true,
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
           canApproveBookings: false,
           canViewFinancials: false,
           canManageBudgets: false,
           canViewAnalytics: true,
           canGenerateReports: true,
           canExportData: false,
           canScheduleReports: false,
           canApproveReports: false,
           canManageSystem: false,
           canViewAuditLogs: false,
           canManagePermissions: false
         },
         description: 'Supervisor with oversight of trainers and events'
       },
       {
         role: 'school_admin',
         permissions: {
           canViewStaff: false,
           canCreateStaff: false,
           canEditStaff: false,
           canDeleteStaff: false,
           canInviteStaff: false,
           canResetPasswords: false,
           canViewSchools: true,
           canCreateSchools: false,
           canEditSchools: true,
           canDeleteSchools: false,
           canAssignTrainers: false,
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
           canCreateBookings: true,
           canEditBookings: true,
           canDeleteBookings: false,
           canApproveBookings: false,
           canViewFinancials: false,
           canManageBudgets: false,
           canViewAnalytics: true,
           canGenerateReports: true,
           canExportData: false,
           canScheduleReports: false,
           canApproveReports: false,
           canManageSystem: false,
           canViewAuditLogs: false,
           canManagePermissions: false
         },
         description: 'School administrator with management privileges for own school'
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
           canExportData: true,
           canScheduleReports: true,
           canApproveReports: true,
           canManageSystem: true,
           canViewAuditLogs: true,
           canManagePermissions: true
         },
         description: 'Full administrative access to all system features'
       },
       {
         role: 'commissioner',
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
           canApproveBookings: false,
           canViewFinancials: false,
           canManageBudgets: false,
           canViewAnalytics: true,
           canGenerateReports: true,
           canExportData: false,
           canScheduleReports: false,
           canApproveReports: false,
           canManageSystem: false,
           canViewAuditLogs: false,
           canManagePermissions: false
         },
         description: 'Commissioner with regional oversight and event management'
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
           canCreateEvents: true,
           canEditEvents: true,
           canDeleteEvents: false,
           canScheduleEvents: true,
           canViewPrograms: true,
           canCreatePrograms: true,
           canEditPrograms: true,
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
           canExportData: false,
           canScheduleReports: false,
           canApproveReports: false,
           canManageSystem: false,
           canViewAuditLogs: false,
           canManagePermissions: false
         },
         description: 'Training officer responsible for program development and trainer coordination'
       },
       {
         role: 'medical',
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
           canExportData: false,
           canScheduleReports: false,
           canApproveReports: false,
           canManageSystem: false,
           canViewAuditLogs: false,
           canManagePermissions: false
         },
         description: 'Medical staff with limited access to event and program information'
       }
     ];

    for (const perm of defaultPermissions) {
      await Permission.findOneAndUpdate(
        { role: perm.role },
        perm,
        { upsert: true, new: true }
      );
    }

    console.log('Γ£ô Default permissions initialized');
  } catch (err) {
    console.error('Permissions init error:', err);
    throw err;
  }
};

const ensureFounderPermissionsAndStaff = async () => {
  try {
    const founders = await User.find({ role: 'founder' });
    if (founders.length === 0) {
      console.log('No founder users found.');
      return;
    }

    for (const founder of founders) {
      let staff = await Staff.findOne({ email: founder.email.toLowerCase() });
      if (!staff) {
        staff = new Staff({
          name: founder.name,
          email: founder.email,
          role: 'admin',
          status: 'Active',
          department: 'Administration',
          employmentStartDate: new Date(),
          permissions: {
            canViewFinancials: true,
            canApproveReports: true,
            canScheduleEvents: true,
            canManageStaff: true,
            canViewAnalytics: true,
            canManageSchools: true,
            canSendInvitations: true
          }
        });
        await staff.save();
        console.log(`[Setup] Created Staff profile for founder: ${founder.email}`);
      } else {
        const update = {};
        if (staff.role !== 'admin') {
          update.role = 'admin';
        }
        const permFlags = {
          canViewFinancials: true,
          canApproveReports: true,
          canScheduleEvents: true,
          canManageStaff: true,
          canViewAnalytics: true,
          canManageSchools: true,
          canSendInvitations: true
        };
        let changed = false;
        for (const [key, value] of Object.entries(permFlags)) {
          if (staff.permissions[key] !== value) {
            update[`permissions.${key}`] = value;
            changed = true;
          }
        }
        if (Object.keys(update).length > 0) {
          await Staff.findByIdAndUpdate(staff._id, { $set: update });
          console.log(`[Setup] Updated Staff profile for founder: ${founder.email}`);
        }
      }

      const allPermissionKeys = [
        'canViewStaff','canCreateStaff','canEditStaff','canDeleteStaff','canInviteStaff','canResetPasswords',
        'canViewSchools','canCreateSchools','canEditSchools','canDeleteSchools','canAssignTrainers',
        'canViewEvents','canCreateEvents','canEditEvents','canDeleteEvents','canScheduleEvents',
        'canViewPrograms','canCreatePrograms','canEditPrograms','canDeletePrograms',
        'canViewBookings','canCreateBookings','canEditBookings','canDeleteBookings','canApproveBookings',
        'canViewFinancials','canManageBudgets',
        'canViewAnalytics','canGenerateReports','canExportData','canScheduleReports','canApproveReports',
        'canSendMessages','canViewMessages','canCreateAnnouncements','canManageAnnouncements','canViewAllNotifications',
        'canManageSystem','canViewAuditLogs','canManagePermissions'
      ];
      const allTrue = {};
      allPermissionKeys.forEach(k => allTrue[k] = true);

      let perm = await Permission.findOne({ role: 'founder' });
      if (!perm) {
        perm = new Permission({
          role: 'founder',
          permissions: allTrue,
          description: 'Full permissions for founder role'
        });
        await perm.save();
        console.log('[Setup] Created Permission for founder with full permissions');
      } else {
        const updateFields = {};
        let permChanged = false;
        for (const key of allPermissionKeys) {
          if (perm.permissions[key] !== true) {
            updateFields[`permissions.${key}`] = true;
            permChanged = true;
          }
        }
        if (permChanged) {
          await Permission.updateOne({ role: 'founder' }, { $set: updateFields });
          console.log('[Setup] Updated Permission for founder to ensure all permissions are true');
        }
      }
    }
  } catch (err) {
    console.error('Error in ensureFounderPermissionsAndStaff:', err);
  }
};

const startServer = async () => {
  try {
    await initializePermissions();
    await ensureFounderPermissionsAndStaff();

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

// Export logAudit for use in other modules (e.g., schoolController)
module.exports.logAudit = logAudit;

startServer();












