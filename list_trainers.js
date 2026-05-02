require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff');

async function listTrainers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const trainers = await Staff.find({ role: 'trainer' })
      .select('name email idNumber role status')
      .lean();

    console.log('=== TRAINER ACCOUNTS ===\n');
    if (trainers.length === 0) {
      console.log('No trainers found in database.');
    } else {
      trainers.forEach((t, i) => {
        console.log(`[${i + 1}] ${t.name}`);
        console.log(`    Email: ${t.email}`);
        console.log(`    ID Number: ${t.idNumber || 'Not set'}`);
        console.log(`    Role: ${t.role}`);
        console.log(`    Status: ${t.status}`);
        console.log('');
      });
      console.log(`Total: ${trainers.length} trainer(s)`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

listTrainers();
