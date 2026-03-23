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
    const nextUrl = req.body.next || req.query.next || '/dashboard';
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

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', {
    user: req.session.user,
    page: 'dashboard'
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

app.get('/dashboard/:page', requireAuth, (req, res) => {
  const page = req.params.page;
  const allowedPages = ['staff', 'schools', 'events', 'programs', 'analytics', 'settings', 'trainers', 'schedule', 'health'];

  if (allowedPages.includes(page)) {
    res.render('dashboard', {
      user: req.session.user,
      page: page
    });
  } else {
    res.status(404).render('404', { user: req.session.user });
  }
});

app.get('/api/dashboard-data', requireAuth, (req, res) => {
  // Mock data - in production, fetch from database
  const data = {
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
  res.json(data);
});

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    const nextUrl = encodeURIComponent(req.originalUrl || '/');
    return res.redirect('/login?next=' + nextUrl);
  }
}

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
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.on('listening', () => {
  console.log('Server is now listening on port', PORT);
});