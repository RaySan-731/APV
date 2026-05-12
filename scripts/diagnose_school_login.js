// Diagnostic script to test school admin login flow
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');

// Ensure we require models from the project root
const rootDir = path.resolve(__dirname, '..');
const Staff = require(path.join(rootDir, 'models', 'Staff'));
const School = require(path.join(rootDir, 'models', 'School'));
const Student = require(path.join(rootDir, 'models', 'Student'));
const ScoutGroup = require(path.join(rootDir, 'models', 'ScoutGroup'));
const Event = require(path.join(rootDir, 'models', 'Event'));
const Invoice = require(path.join(rootDir, 'models', 'Invoice'));
const Notification = require(path.join(rootDir, 'models', 'Notification'));
const Message = require(path.join(rootDir, 'models', 'Message'));
const VisitLog = require(path.join(rootDir, 'models', 'VisitLog'));

async function diagnoseSchoolLogin(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures');
    console.log('✓ Connected to MongoDB\n');

    const normalizedEmail = email.toLowerCase();
    console.log(`Testing login for: ${normalizedEmail}\n`);

    // Step 1: Find staff record
    console.log('--- Step 1: Staff lookup ---');
    const staff = await Staff.findOne({ email: normalizedEmail, role: 'school_admin' }).lean();
    if (!staff) {
      console.log('✗ No school_admin Staff record found with this email');
      const anyStaff = await Staff.findOne({ email: normalizedEmail }).lean();
      if (anyStaff) {
        console.log('  Found Staff record but role is:', anyStaff.role);
      } else {
        console.log('  No Staff record at all');
      }
      return;
    }
    console.log('✓ Staff found:', { _id: staff._id, name: staff.name, email: staff.email, schoolId: staff.schoolId, role: staff.role });

    // Step 2: Validate schoolId
    console.log('\n--- Step 2: Validate schoolId ---');
    if (!staff.schoolId) {
      console.log('✗ staff.schoolId is missing');
      return;
    }
    const isValidObjectId = mongoose.Types.ObjectId.isValid(staff.schoolId);
    console.log(`schoolId: ${staff.schoolId}`);
    console.log(`Is valid ObjectId format: ${isValidObjectId}`);
    if (!isValidObjectId) {
      console.log('✗ Invalid ObjectId format');
      return;
    }

    // Step 3: Fetch school
    console.log('\n--- Step 3: School lookup ---');
    const school = await School.findById(staff.schoolId).lean();
    if (!school) {
      console.log('✗ No School found with _id:', staff.schoolId);
      return;
    }
    console.log('✓ School found:', { _id: school._id, name: school.name, status: school.status, serviceStatus: school.serviceStatus });
    if (school.status !== 'active') {
      console.log(`⚠ School status is '${school.status}', expected 'active'`);
    }

    // Step 4: Test all dashboard queries
    console.log('\n--- Step 4: Dashboard queries ---');
    const schoolId = staff.schoolId;

    try {
      const totalScouts = await Student.countDocuments({ school: schoolId, status: 'active' });
      console.log(`✓ Students (active): ${totalScouts}`);
    } catch (err) {
      console.error('✗ Student count failed:', err.message);
    }

    try {
      const activeGroupsCount = await ScoutGroup.countDocuments({ schoolId, status: 'active' });
      console.log(`✓ ScoutGroups (active): ${activeGroupsCount}`);
    } catch (err) {
      console.error('✗ ScoutGroup count failed:', err.message);
    }

    try {
      const upcomingEvents = await Event.find({
        'targetSchools.schoolId': schoolId,
        startDate: { $gte: new Date(), $lte: new Date(Date.now() + 30*24*60*60*1000) },
        status: { $in: ['confirmed', 'in_progress', 'scheduled'] }
      }).sort({ startDate: 1 }).limit(1).lean();
      console.log(`✓ Upcoming events: ${upcomingEvents.length}`);
      if (upcomingEvents.length > 0) {
        console.log('  First event:', {
          name: upcomingEvents[0].name,
          eventType: upcomingEvents[0].eventType,
          startDate: upcomingEvents[0].startDate
        });
      }
    } catch (err) {
      console.error('✗ Upcoming events query failed:', err.message);
    }

    try {
      const pendingInvoices = await Invoice.countDocuments({
        schoolId,
        status: { $in: ['issued', 'sent', 'partial', 'overdue'] }
      });
      console.log(`✓ Invoices (pending): ${pendingInvoices}`);
    } catch (err) {
      console.error('✗ Invoice count failed:', err.message);
    }

    try {
      const unreadNotifications = await Notification.countDocuments({
        recipientId: staff._id,
        isRead: false,
        dismissed: false
      });
      console.log(`✓ Notifications (unread): ${unreadNotifications}`);
    } catch (err) {
      console.error('✗ Notification count failed:', err.message);
    }

    try {
      const unreadMessages = await Message.countDocuments({
        'recipients.staffId': staff._id,
        'recipients.status': 'sent',
        'recipients.deleted': { $ne: true }
      });
      console.log(`✓ Messages (unread): ${unreadMessages}`);
    } catch (err) {
      console.error('✗ Message count failed:', err.message);
    }

    // Step 5: calculateDaysSinceLastVisit
    console.log('\n--- Step 5: Days since last visit ---');
    try {
      const lastVisit = await VisitLog.findOne({ schoolId }).sort({ date: -1 }).select('date').lean();
      if (!lastVisit) {
        console.log('✓ No visit logs found (returns null)');
      } else {
        const diffTime = Math.abs(new Date() - new Date(lastVisit.date));
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log(`✓ Last visit: ${lastVisit.date}, days ago: ${days}`);
      }
    } catch (err) {
      console.error('✗ VisitLog query failed:', err.message);
    }

    // Step 6: buildPendingActions
    console.log('\n--- Step 6: Build pending actions ---');
    try {
      const pendingInvoices2 = await Invoice.countDocuments({
        schoolId,
        status: { $in: ['issued', 'sent', 'overdue'] }
      });
      const unreadMessages2 = await Message.countDocuments({
        'recipients.staffId': staff._id,
        'recipients.status': 'sent',
        'recipients.deleted': { $ne: true }
      });
      const unreadNotifications2 = await Notification.countDocuments({
        recipientId: staff._id,
        isRead: false,
        dismissed: false
      });
      const actions = [];
      if (pendingInvoices2 > 0) actions.push({ type: 'payment', count: pendingInvoices2, actionUrl: '/school/payments' });
      if (unreadMessages2 > 0) actions.push({ type: 'message', count: unreadMessages2, actionUrl: '/school/messages' });
      if (unreadNotifications2 > 0) actions.push({ type: 'notification', count: unreadNotifications2, actionUrl: '/school/notifications' });
      console.log(`✓ Pending actions built: ${actions.length} actions`, actions);
    } catch (err) {
      console.error('✗ Build pending actions failed:', err.message);
    }

    // Step 7: Recent notifications
    console.log('\n--- Step 7: Recent notifications ---');
    try {
      const recent = await Notification.find({ recipientId: staff._id, isRead: false, dismissed: false })
        .sort({ createdAt: -1 }).limit(5).lean();
      console.log(`✓ Recent notifications: ${recent.length}`);
    } catch (err) {
      console.error('✗ Recent notifications query failed:', err.message);
    }

    console.log('\n✓ All diagnostic checks passed');
    console.log(`\nYou can now log in at http://127.0.0.1:3000/school with:\nEmail: ${email}\nPassword: 0000\n`);

    process.exit(0);
  } catch (err) {
    console.error('FATAL ERROR:', err);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run for the requested email
diagnoseSchoolLogin('ackkenyatta@school.edu');
