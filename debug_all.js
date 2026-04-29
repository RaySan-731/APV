const mongoose = require('mongoose');
const School = require('./models/School');
const Staff = require('./models/Staff');
const User = require('./models/User');

async function fullDebug() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scoutmate-hub');
    console.log('Connected to MongoDB\n');

    console.log('=== SCHOOLS (all) ===');
    const schools = await School.find().lean();
    console.log(JSON.stringify(schools, null, 2));

    console.log('\n=== STAFF (all) ===');
    const staff = await Staff.find().lean();
    console.log(JSON.stringify(staff, null, 2));

    console.log('\n=== USERS (all) ===');
    const users = await User.find().lean();
    console.log(JSON.stringify(users, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fullDebug();
