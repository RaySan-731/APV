const mongoose = require('mongoose');
const Permission = require('./models/Permission');
const Staff = require('./models/Staff');
const User = require('./models/User');

async function debugPermissions() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB:', uri);

    console.log('\n=== ALL PERMISSIONS IN DATABASE ===');
    const allPerms = await Permission.find();
    console.log(JSON.stringify(allPerms, null, 2));

    console.log('\n=== STAFF WITH ROLE ===');
    const staff = await Staff.find({}, 'name email role').lean();
    console.log(JSON.stringify(staff, null, 2));

    console.log('\n=== USERS IN DATABASE ===');
    const users = await User.find({}, 'name email role').lean();
    console.log(JSON.stringify(users, null, 2));

    const trainerPerm = await Permission.findOne({ role: 'trainer' });
    console.log('\n=== TRAINER PERMISSION DETAILS ===');
    console.log(JSON.stringify(trainerPerm, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

debugPermissions();
