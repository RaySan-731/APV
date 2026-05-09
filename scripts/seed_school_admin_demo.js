/**
 * School Admin Dashboard Seed Script
 * Seeds demo data for a school admin user and associated records
 *
 * Usage: node scripts/seed_school_admin_demo.js
 */

const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

// Models
const User = require(path.join(__dirname, '..', 'models', 'User'));
const Staff = require(path.join(__dirname, '..', 'models', 'Staff'));
const School = require(path.join(__dirname, '..', 'models', 'School'));
const Permission = require(path.join(__dirname, '..', 'models', 'Permission'));
const ScoutGroup = require(path.join(__dirname, '..', 'models', 'ScoutGroup'));
const Student = require(path.join(__dirname, '..', 'models', 'Student'));
const Event = require(path.join(__dirname, '..', 'models', 'Event'));
const Invoice = require(path.join(__dirname, '..', 'models', 'Invoice'));
const SchoolDocument = require(path.join(__dirname, '..', 'models', 'SchoolDocument'));
const Message = require(path.join(__dirname, '..', 'models', 'Message'));
const Notification = require(path.join(__dirname, '..', 'models', 'Notification'));

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // 1. Ensure Permission for school_admin exists
  await ensureSchoolAdminPermission();

  // 2. Create Founder user (if not exists)
  const founder = await getOrCreateFounder();

  // 3. Create Demo School
  const school = await getOrCreateSchool();

  // 4. Create School Admin User & Staff
  const schoolAdmin = await getOrCreateSchoolAdmin(school);

  // 5. Create Scout Groups for the school
  await createScoutGroups(school);

  // 6. Create Demo Students linked to school
  await createStudents(school);

  // 7. Create Demo Events and send invitations to school
  await createEventsWithInvitations(school, founder);

  // 8. Create Invoices for school
  await createInvoices(school);

  // 9. Create Documents for school
  await createDocuments(school);

  // 10. Create Sample Message between Founder and School Admin
  await createFounderMessage(founder, schoolAdmin);

  // 11. Assign trainer to school (primary)
  await assignTrainerToSchool(school);

  console.log('\n✅ School admin demo data seeded successfully!');
  console.log('\n📋 Demo Login:');
  console.log('   Email: admin@greenacademy.sc.ke');
  console.log('   Password: password123');
  console.log('\n🌐 Access at: http://localhost:3001/school/dashboard\n');

  process.exit(0);
}

async function ensureSchoolAdminPermission() {
  const existing = await Permission.findOne({ role: 'school_admin' });
  if (existing) {
    console.log('✅ Permission for school_admin already exists');
    return;
  }

  const permission = new Permission({
    role: 'school_admin',
    description: 'School admin - manages own school data, scouts, events, payments, documents',
    permissions: {
      canViewSchools: true,
      canManageOwnSchool: true,
      canManageScouts: true,
      canViewOwnScouts: true,
      canViewEvents: true,
      canViewOwnPayments: true,
      canManageDocuments: true,
      canSendMessages: true,
      canViewMessages: true,
      canViewOwnNotifications: true,
      canGenerateReports: false,
      canViewAnalytics: false
    }
  });
  await permission.save();
  console.log('✅ Created permission for school_admin');
}

async function getOrCreateFounder() {
  let founder = await User.findOne({ email: 'founder@apventures.com' });
  if (!founder) {
    const hash = await bcrypt.hash('admin', 10);
    founder = new User({
      email: 'founder@apventures.com',
      password: hash,
      name: 'System Founder',
      role: 'founder',
      isActive: true
    });
    await founder.save();
    console.log('✅ Created founder user');
  }

  // Ensure Staff record exists for founder
  let founderStaff = await Staff.findOne({ email: founder.email });
  if (!founderStaff) {
    founderStaff = new Staff({
      name: founder.name,
      email: founder.email,
      role: 'admin',
      status: 'Active',
      department: 'Administration',
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
    await founderStaff.save();
    console.log('✅ Created founder Staff record');
  }
  return founder;
}

async function getOrCreateSchool() {
  let school = await School.findOne({ name: 'Green Academy' });
  if (!school) {
    school = new School({
      name: 'Green Academy',
      address: { street: '123 Sunshine Avenue', city: 'Nairobi', country: 'Kenya' },
      contactPerson: { name: 'Grace Mwangi', email: 'grace.mwangi@greenacademy.sc.ke', phone: '+254 712 345 678', position: 'School Admin' },
      zone: 'Nairobi Central',
      region: 'Nairobi',
      status: 'active',
      serviceStatus: 'active',
      servicePackage: 'standard',
      onboardingDate: new Date('2024-01-15'),
      partnershipDate: new Date('2024-01-10'),
      paymentTerms: { method: 'bank_transfer', billingCycle: 'monthly', currency: 'KES' },
      participationMetrics: { totalEventsAttended: 0, averageAttendanceRate: 0, engagementScore: 0 }
    });
    await school.save();
    console.log('✅ Created school: Green Academy');
  }
  return school;
}

async function getOrCreateSchoolAdmin(school) {
  let user = await User.findOne({ email: 'admin@greenacademy.sc.ke' });
  if (!user) {
    const hash = await bcrypt.hash('password123', 10);
    user = new User({
      email: 'admin@greenacademy.sc.ke',
      password: hash,
      name: 'Grace Mwangi',
      role: 'school_admin',
      isActive: true
    });
    await user.save();
    console.log('✅ Created school admin User');
  }

  let staff = await Staff.findOne({ email: user.email });
  if (!staff) {
    staff = new Staff({
      name: user.name,
      email: user.email,
      role: 'school_admin',
      status: 'Active',
      department: 'Administration',
      phone: '+254 712 345 678',
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
    });
    await staff.save();
    console.log('✅ Created school admin Staff linked to', school.name);
  } else if (!staff.schoolId) {
    staff.schoolId = school._id;
    await staff.save();
  }
  return staff;
}

async function createScoutGroups(school) {
  const groups = [
    { name: 'Sungura Troop', advancementLevel: 'cubs', leaderName: 'Jane Kimani', leaderContact: { email: 'jane@greenacademy.sc.ke', phone: '+254 700 111 111' } },
    { name: 'Chipukizi Unit', advancementLevel: 'scouts', leaderName: 'Peter Ochieng', leaderContact: { email: 'peter@greenacademy.sc.ke', phone: '+254 700 222 222' } },
    { name: 'Mwamba Patrol', advancementLevel: 'seniors', leaderName: 'Sarah Wafula', leaderContact: { email: 'sarah@greenacademy.sc.ke', phone: '+254 700 333 333' } }
  ];

  for (const g of groups) {
    const exists = await ScoutGroup.findOne({ name: g.name, schoolId: school._id });
    if (!exists) {
      const group = new ScoutGroup({
        schoolId: school._id,
        name: g.name,
        patrol: 'Alpha',
        leaderName: g.leaderName,
        leaderContact: g.leaderContact,
        memberCount: 0,
        advancementLevel: g.advancementLevel,
        status: 'active'
      });
      await group.save();
    }
  }
  console.log('✅ Created scout groups');
}

async function createStudents(school) {
  const students = [
    { fullName: 'Kevin Robinson', dateOfBirth: '2011-03-10', gender: 'Male', parentName: 'Linda Williams', parentPhone: '+254 700 111 111', parentEmail: 'linda@example.com', section: 'Chipukizi' },
    { fullName: 'Tina Smith', dateOfBirth: '2011-01-31', gender: 'Female', parentName: 'Barbara Moore', parentPhone: '+254 700 222 222', parentEmail: 'barbara@example.com', section: 'Mwamba' },
    { fullName: 'Charlie Davis', dateOfBirth: '2011-04-12', gender: 'Male', parentName: 'Robert Smith', parentPhone: '+254 700 333 333', parentEmail: 'robert@example.com', section: 'Sungura' },
    { fullName: 'Julia White', dateOfBirth: '2017-02-06', gender: 'Female', parentName: 'Richard Wilson', parentPhone: '+254 700 444 444', parentEmail: 'richard@example.com', section: 'Chipukizi' },
    { fullName: 'Michael Williams', dateOfBirth: '2019-12-13', gender: 'Male', parentName: 'Charles Wilson', parentPhone: '+254 700 555 555', parentEmail: 'charles@example.com', section: 'Sungura' },
    { fullName: 'Laura Anderson', dateOfBirth: '2011-01-08', gender: 'Female', parentName: 'Jane Jones', parentPhone: '+254 700 666 666', parentEmail: 'jane@example.com', section: 'Mwamba' }
  ];

  let count = 0;
  for (const s of students) {
    const exists = await Student.findOne({ fullName: s.fullName, school: school._id });
    if (!exists) {
      const student = new Student({
        fullName: s.fullName,
        dateOfBirth: new Date(s.dateOfBirth),
        gender: s.gender,
        parentContact: { name: s.parentName, phone: s.parentPhone, email: s.parentEmail, relationship: 'Parent' },
        scoutSection: s.section,
        school: school._id,
        status: 'active'
      });
      await student.save();
      count++;
    }
  }
  console.log(`✅ Created ${count} student records (may be 0 if already seeded)`);
}

async function createEventsWithInvitations(school, founder) {
  const events = [
    {
      name: 'Annual Leadership Camp',
      eventType: 'camp',
      description: '3-day leadership development camp at Nyeri',
      startDate: new Date(Date.now() + 15*24*60*60*1000),
      endDate: new Date(Date.now() + 18*24*60*60*1000),
      location: { name: 'Nyeri Training Centre', city: 'Nyeri', country: 'Kenya' },
      estimatedScoutCount: 50,
      maxParticipants: 60,
      status: 'confirmed'
    },
    {
      name: 'First Aid Training',
      eventType: 'training_session',
      description: 'Basic first aid certification for scouts',
      startDate: new Date(Date.now() + 30*24*60*60*1000),
      endDate: new Date(Date.now() + 30*24*60*60*1000),
      location: { name: 'Green Academy Hall', city: 'Nairobi', country: 'Kenya' },
      estimatedScoutCount: 25,
      maxParticipants: 30,
      status: 'confirmed'
    }
  ];

  // Create founder staff record for trainer assignment
  const founderStaff = await Staff.findOne({ email: founder.email });

  for (const e of events) {
    const exists = await Event.findOne({ name: e.name });
    if (!exists) {
      const event = new Event({
        ...e,
        targetSchools: [{
          schoolId: school._id,
          invitedAt: new Date(),
          invitedBy: founderStaff?._id || null,
          rsvpStatus: 'invited',
          rsvpDeadline: e.startDate,
          attendance: { registered: 0, attended: 0, percentage: 0 }
        }],
        trainers: [{ 
          trainerId: founderStaff?._id || null, 
          role: 'lead_trainer', 
          status: 'confirmed' 
        }]
      });
      await event.save();
    }
  }
  console.log('✅ Created demo events with invitations');
}

async function createInvoices(school) {
  const invoices = [
    {
      invoiceNumber: 'INV-2024-001',
      issueDate: new Date('2024-02-01'),
      dueDate: new Date('2024-02-15'),
      items: [{ description: 'Monthly Service Fee - February', quantity: 1, unitPrice: 15000, total: 15000, taxAmount: 0 }],
      subtotal: 15000,
      totalAmount: 15000,
      balance: 5000,
      amountPaid: 10000,
      status: 'partial',
      currency: 'KES',
      invoiceType: 'monthly_retainer',
      issuedBy: null
    },
    {
      invoiceNumber: 'INV-2024-002',
      issueDate: new Date('2024-03-01'),
      dueDate: new Date('2024-03-15'),
      items: [{ description: 'Monthly Service Fee - March', quantity: 1, unitPrice: 15000, total: 15000, taxAmount: 0 }],
      subtotal: 15000,
      totalAmount: 15000,
      balance: 15000,
      amountPaid: 0,
      status: 'issued',
      currency: 'KES',
      invoiceType: 'monthly_retainer',
      issuedBy: null
    }
  ];

  for (const inv of invoices) {
    const exists = await Invoice.findOne({ invoiceNumber: inv.invoiceNumber, schoolId: school._id });
    if (!exists) {
      const invoice = new Invoice({
        ...inv,
        schoolId: school._id
      });
      await invoice.save();
    }
  }
  console.log('✅ Created sample invoices');
}

async function createDocuments(school) {
  // Get founder staff to use as uploadedBy
  const founderStaff = await Staff.findOne({ role: { $in: ['admin', 'founder'] } }).sort({ createdAt: 1 }).limit(1);
  const uploadedBy = founderStaff?._id || null;

  const docs = [
    {
      documentType: 'contract',
      name: 'Service Agreement 2024',
      description: 'Annual service contract',
      url: '/uploads/documents/sample-contract.pdf',
      mimeType: 'application/pdf',
      fileSize: 102400,
      expiryDate: new Date('2025-01-01'),
      uploadedBy
    },
    {
      documentType: 'insurance',
      name: 'Comprehensive Insurance Policy',
      description: 'Covers all scouts during activities',
      url: '/uploads/documents/insurance.pdf',
      mimeType: 'application/pdf',
      fileSize: 204800,
      expiryDate: new Date('2025-06-01'),
      uploadedBy
    }
  ];

  for (const d of docs) {
    const exists = await SchoolDocument.findOne({ name: d.name, schoolId: school._id });
    if (!exists) {
      const doc = new SchoolDocument({
        ...d,
        schoolId: school._id
      });
      await doc.save();
    }
  }
  console.log('✅ Created sample documents');
}

async function createFounderMessage(founder, schoolAdmin) {
  const founderStaff = await Staff.findOne({ email: founder.email });
  if (!founderStaff) return;

  const message = new Message({
    senderId: founderStaff._id,
    senderName: founderStaff.name,
    senderRole: 'founder',
    recipients: [{ staffId: schoolAdmin._id, status: 'sent' }],
    subject: 'Welcome to APV ScoutMate!',
    body: `Hi ${schoolAdmin.name},\n\nWelcome to the APV ScoutMate platform! We are excited to have ${schoolAdmin.name || school.name} join our community.\n\nHere are a few things to get you started:\n1. Update your school profile\n2. Add your scout members\n3. Mark attendance for upcoming events\n4. Keep your payment records up to date\n\nIf you have any questions, feel free to message us anytime.\n\nBest regards,\nAPV Team`,
    messageType: 'direct',
    priority: 'normal'
  });
  await message.save();

  // Create notification for school admin
  await Notification.create({
    recipientId: schoolAdmin._id,
    type: 'system',
    title: 'Welcome to APV',
    message: 'Please check your messages from the founder.',
    actionUrl: '/school/messages',
    entityType: 'message',
    entityId: message._id,
    priority: 'normal'
  });

  console.log('✅ Created welcome message from founder');
}

async function assignTrainerToSchool(school) {
  // Assign Grace Mwangi (existing trainer from seed script)
  const trainer = await Staff.findOne({ role: 'trainer' }).sort({ createdAt: 1 }).limit(1);
  if (!trainer) {
    console.log('⚠️ No trainer found to assign to school');
    return;
  }

  const assignmentExists = school.assignedStaff?.some(a => a.staffId?.toString() === trainer._id.toString());
  if (!assignmentExists) {
    school.assignedStaff = school.assignedStaff || [];
    school.assignedStaff.push({
      staffId: trainer._id,
      assignmentType: 'primary',
      assignedDate: new Date(),
      status: 'active'
    });
    await school.save();
    console.log(`✅ Assigned trainer ${trainer.name} to ${school.name}`);
  }
}

seed().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
