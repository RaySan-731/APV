// Check existing school admin accounts
require('dotenv').config();
const mongoose = require('mongoose');

async function checkSchoolAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures');
    console.log('Connected to MongoDB\n');

    const Staff = require('./models/Staff');
    const School = require('./models/School');

    // Find all school admin staff records
    const schoolAdmins = await Staff.find({ role: 'school_admin' }).lean();

    if (schoolAdmins.length === 0) {
      console.log('No school admin accounts found.');
    } else {
      console.log(`Found ${schoolAdmins.length} school admin(s):\n`);
      schoolAdmins.forEach(admin => {
        console.log('---');
        console.log('Email:', admin.email);
        console.log('Name:', admin.name);
        console.log('School ID:', admin.schoolId);
        console.log('Status:', admin.status);
      });
    }

    // Find all active schools with contact person emails
    console.log('\n\nActive Schools with contact emails:\n');
    const schools = await School.find({ status: 'active' }).select('name contactPerson email').lean();

    if (schools.length === 0) {
      console.log('No active schools found.');
    } else {
      schools.forEach(school => {
        console.log('---');
        console.log('School:', school.name);
        console.log('Contact:', school.contactPerson?.name || 'N/A');
        console.log('Contact Email:', school.contactPerson?.email || 'N/A');
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkSchoolAdmins();
