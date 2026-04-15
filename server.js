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

    // Trainer fallback from Staff collection using default trainer password 0000
    const trainerFallback = await Staff.findOne({ email: email.toLowerCase(), role: 'trainer' });
    if ((!user || !await require('bcryptjs').compare(password, user.password)) && trainerFallback && password === '0000') {
      req.session.user = {
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

app.get('/dashboard', requireAuth, (req, res) => {
  if (req.session.user && req.session.user.role === 'trainer') {
    return res.redirect('/trainer/dashboard');
  }
  res.render('dashboard', {
    user: req.session.user,
    page: 'dashboard'
  });
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
app.post('/dashboard/staff/add', requireAuth, async (req, res) => {
  try {
    const { idNumber, name, email, role, status } = req.body;
    console.log('=== STAFF ADD REQUEST ===');
    console.log('Full req.body:', JSON.stringify(req.body, null, 2));
    console.log('Extracted values:', { idNumber, name, email, role, status });
    
    if (!name || !email || !role) {
      console.error('Missing required fields:', { name, email, role });
      return res.status(400).send('Missing required fields: name, email, role');
    }
    
    const staffData = {
      idNumber: idNumber && idNumber.trim() ? idNumber.trim() : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role.trim(),
      status: status || 'Active',
      lastActive: new Date()
    };
    
    console.log('Staff data to save:', JSON.stringify(staffData, null, 2));
    const staff = new Staff(staffData);
    
    await staff.save();
    console.log('✓ Staff saved successfully:', staff._id, staff.idNumber, staff.name);
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
app.post('/dashboard/staff/update', requireAuth, async (req, res) => {
  try {
    const { staffId, idNumber, name, email, role, status } = req.body;
    console.log('=== STAFF UPDATE REQUEST ===');
    console.log('Staff ID:', staffId);
    console.log('Update data:', { idNumber, name, email, role, status });
    
    if (!staffId || !name || !email || !role) {
      console.error('Missing required fields');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const updateData = {
      idNumber: idNumber && idNumber.trim() ? idNumber.trim() : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role.trim(),
      status: status || 'Active'
    };
    
    const staff = await Staff.findByIdAndUpdate(
      staffId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!staff) {
      console.error('Staff member not found:', staffId);
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }
    
    console.log('✓ Staff updated successfully:', staff._id, staff.name);
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
app.post('/dashboard/staff/delete', requireAuth, async (req, res) => {
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
    console.log('=== END STAFF DELETE REQUEST ===\n');
    
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (err) {
    console.error('✗ Error deleting staff:', err.message);
    console.error('Stack:', err.stack);
    console.log('=== END STAFF DELETE REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error deleting staff: ' + err.message });
  }
});

// ============ TRAINER MANAGEMENT ROUTES ============

// Add new trainer
app.post('/dashboard/trainer/add', requireAuth, async (req, res) => {
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
app.post('/dashboard/trainer/update', requireAuth, async (req, res) => {
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
app.post('/dashboard/trainer/delete', requireAuth, async (req, res) => {
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
    const allSchools = await School.find().select('_id name address status').lean();
    console.log('Total schools found:', allSchools.length);

    // Fetch schools allocated to this trainer
    const allocatedSchools = await School.find({ assignedStaff: trainerId }).select('_id').lean();
    const allocatedSchoolIds = allocatedSchools.map(s => s._id.toString());
    console.log('Schools allocated to trainer:', allocatedSchoolIds.length);

    console.log('=== END GET TRAINER SCHOOLS REQUEST ===\n');

    res.json({
      success: true,
      schools: allSchools,
      allocatedSchools: allocatedSchools.map(s => ({ _id: s._id.toString() }))
    });
  } catch (err) {
    console.error('✗ Error getting schools:', err.message);
    console.log('=== END GET TRAINER SCHOOLS REQUEST ===\n');
    res.status(500).json({ success: false, error: 'Error getting schools: ' + err.message });
  }
});

// Allocate schools to trainer
app.post('/dashboard/trainer/allocate-schools', requireAuth, async (req, res) => {
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

    // Validate requested schools against maximum capacity before mutating any data
    const blockedSchools = [];
    const selectedSchoolIds = Array.isArray(schoolIds) ? schoolIds : [];

    for (const schoolId of selectedSchoolIds) {
      const school = await School.findById(schoolId);
      if (!school) {
        continue;
      }

      const assignedStaffIds = Array.isArray(school.assignedStaff) ? school.assignedStaff.map((id) => id.toString()) : [];
      const hasTrainer = assignedStaffIds.includes(trainerId.toString());
      const trainerCount = assignedStaffIds.length;

      if (!hasTrainer && trainerCount >= 2) {
        const existingStaff = await Staff.find({ _id: { $in: assignedStaffIds } }).lean();
        blockedSchools.push({
          schoolId: school._id.toString(),
          schoolName: school.name,
          existingTrainers: existingStaff.map(t => ({ id: t._id.toString(), name: t.name || t.email || 'Unknown', email: t.email || 'unknown' }))
        });
      }
    }

    if (blockedSchools.length > 0) {
      console.log('⚠️ Trainer allocation blocked for', blockedSchools.length, 'school(s) due to maximum trainers reached');
      blockedSchools.forEach(s => {
        console.log(`  • ${s.schoolName} (${s.schoolId}) already has ${s.existingTrainers.length} trainers:`);
        s.existingTrainers.forEach(t => console.log(`      - ${t.name} (${t.id})`));
      });

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

    // Remove trainer from all schools first
    const schoolsWithTrainer = await School.find({ assignedStaff: trainerObjectId });
    for (const sch of schoolsWithTrainer) {
      sch.assignedStaff = sch.assignedStaff.filter(id => !id.equals(trainerObjectId));
      await sch.save();
    }
    console.log('✓ Removed trainer from all previously allocated schools');

    // Add trainer to selected schools where it is not already assigned
    const allocatedSchoolIds = [];

    for (const schoolId of selectedSchoolIds) {
      const school = await School.findById(schoolId);
      if (!school) {
        continue;
      }

      school.assignedStaff = school.assignedStaff || [];
      if (!school.assignedStaff.some(id => id.equals(trainerObjectId))) {
        school.assignedStaff.push(trainerObjectId);
        await school.save();
        allocatedSchoolIds.push(schoolId.toString());
        console.log('✓ Added trainer to school:', school.name);
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

app.post('/dashboard/schools/add', requireAuth, async (req, res) => {
  try {
    const { name, street, city, state, zipCode, country, contactName, contactEmail, contactPhone, studentCount, status } = req.body;
    const school = new School({
      name,
      address: { street, city, state, zipCode, country: country || 'Kenya' },
      contactPerson: { name: contactName, email: contactEmail, phone: contactPhone },
      studentCount: parseInt(studentCount, 10) || 0,
      status: status || 'active'
    });
    await school.save();
    res.redirect('/dashboard/schools');
  } catch (err) {
    console.error('Error saving school:', err);
    res.redirect('/dashboard/schools');
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

app.get('/dashboard/schools', requireAuth, async (req, res) => {
  if (req.session.user && req.session.user.role === 'trainer') {
    return res.redirect('/trainer/dashboard');
  }

  try {
    const schoolList = await School.find()
      .sort({ createdAt: -1 })
      .lean();

    const assignedIds = [...new Set((schoolList || []).flatMap(school => (school.assignedStaff || []).map(String)))];
    const trainers = assignedIds.length > 0
      ? await Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber status').lean()
      : [];
    const trainerMap = new Map(trainers.map(trainer => [trainer._id.toString(), trainer]));
    schoolList.forEach(school => {
      school.assignedStaff = (school.assignedStaff || []).map(id => trainerMap.get(id.toString())).filter(Boolean);
    });

    res.render('dashboard', {
      user: req.session.user,
      page: 'schools',
      schoolList
    });
  } catch (err) {
    console.error('Error loading schools page:', err);
    res.status(500).render('404', { user: req.session.user });
  }
});

app.get('/dashboard/:page', requireAuth, async (req, res) => {
  try {
    const page = req.params.page;
    const allowedPages = ['staff', 'schools', 'events', 'programs', 'analytics', 'settings', 'trainers', 'schedule', 'health'];

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
    }

    if (page === 'trainers') {
      // Fetch all staff members with role 'trainer'
      modelData.trainersList = await Staff.find({ role: 'trainer' }).sort({ createdAt: -1 }).lean();
      console.log('=== TRAINERS PAGE FETCH ===');
      console.log('Found trainers:', modelData.trainersList.length);
    }

    if (page === 'schools') {
      modelData.schoolList = await School.find().sort({ createdAt: -1 }).lean();
      const assignedIds = [...new Set((modelData.schoolList || []).flatMap(school => (school.assignedStaff || []).map(String)))];
      const trainers = assignedIds.length > 0
        ? await Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber status').lean()
        : [];
      const trainerMap = new Map(trainers.map(trainer => [trainer._id.toString(), trainer]));
      modelData.schoolList.forEach(school => {
        school.assignedStaff = (school.assignedStaff || []).map(id => trainerMap.get(id.toString())).filter(Boolean);
      });
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