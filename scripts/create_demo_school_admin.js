// Create a demo school admin account for testing
require('dotenv').config();
const mongoose = require('mongoose');

async function createDemoSchoolAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures');
    console.log('Connected to MongoDB\n');

    const School = require('./models/School');
    const Staff = require('./models/Staff');
    const bcrypt = require('bcryptjs');

    // Check if demo school already exists
    let school = await School.findOne({ name: 'Demo School' });
    
    if (!school) {
      console.log('Creating demo school...');
      school = new School({
        name: 'Demo School',
        address: {
          street: '123 Education Way',
          city: 'Nairobi',
          country: 'Kenya'
        },
        contactPerson: {
          name: 'John Admin',
          email: 'admin@demo.apventures.com',
          phone: '+254 700 123 456',
          position: 'School Administrator'
        },
        status: 'active',
        serviceStatus: 'active',
        onboardingDate: new Date()
      });
      await school.save();
      console.log('✓ Demo school created');
    } else {
      console.log('✓ Demo school already exists');
    }

    // Check if school admin staff already exists
    let staff = await Staff.findOne({ 
      email: 'admin@demo.apventures.com', 
      role: 'school_admin' 
    });

    if (!staff) {
      console.log('Creating demo school admin...');
      staff = new Staff({
        name: 'John Admin',
        email: 'admin@demo.apventures.com',
        role: 'school_admin',
        status: 'Active',
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
      console.log('✓ Demo school admin created');
    } else {
      // Update schoolId if needed
      if (!staff.schoolId) {
        staff.schoolId = school._id;
        await staff.save();
        console.log('✓ Updated school admin with schoolId');
      } else {
        console.log('✓ Demo school admin already exists');
      }
    }

    console.log('\n=== DEMO SCHOOL ADMIN LOGIN CREDENTIALS ===');
    console.log('URL: http://127.0.0.1:3000/school');
    console.log('Email: admin@demo.apventures.com');
    console.log('Password: 0000');
    console.log('==========================================\n');

    // Verify by querying
    const verifyStaff = await Staff.findOne({ email: 'admin@demo.apventures.com' }).lean();
    const verifySchool = await School.findById(verifyStaff?.schoolId).lean();
    console.log('Verification:', { staff: verifyStaff, school: verifySchool });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createDemoSchoolAdmin();
