const mongoose = require('mongoose');
const Permission = require('./models/Permission');

async function checkPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures');
    console.log('Connected to MongoDB');

    const permissions = await Permission.find();
    console.log('All permissions in database:');
    console.log(JSON.stringify(permissions, null, 2));

    const trainerPerm = await Permission.findOne({ role: 'trainer' });
    if (trainerPerm) {
      console.log('\nTrainer permissions:');
      console.log('  canAssignTrainers:', trainerPerm.permissions.canAssignTrainers);
      console.log('\nAll trainer permissions:');
      Object.entries(trainerPerm.permissions).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } else {
      console.log('\nTrainer permissions not found in database!');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkPermissions();
