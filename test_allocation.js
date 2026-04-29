const mongoose = require('mongoose');
const School = require('./models/School');
const Staff = require('./models/Staff');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function testAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Use a real trainer from Staff
    const trainer = await Staff.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found in Staff collection');
      process.exit(1);
    }
    console.log('Using trainer:', trainer.name, trainer._id);

    // Pick a school with no assigned trainers
    const school = await School.findOne({ assignedStaff: { $exists: true, $size: 0 } });
    if (!school) {
      console.log('No school with empty assignedStaff, picking any school');
      const any = await School.findOne();
      school = any;
    }
    console.log('Target school:', school.name, school._id);
    console.log('Current assignedStaff:', school.assignedStaff);

    // Simulate allocation: add trainer and save
    school.assignedStaff = school.assignedStaff || [];
    school.assignedStaff.push(trainer._id);
    await school.save();
    console.log('✓ Saved school with assignedStaff:', school.assignedStaff.map(String));

    // Now simulate what the schools page does: fetch staff for these IDs
    const assignedIds = school.assignedStaff.map(String);
    const trainers = await Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber').lean();
    console.log('\nFound trainers from mapping:', trainers);

    const trainerMap = new Map(trainers.map(t => [t._id.toString(), t]));
    const mapped = school.assignedStaff.map(id => trainerMap.get(id.toString())).filter(Boolean);
    console.log('Mapped trainer objects:', mapped);
    console.log('Trainer count after mapping:', mapped.length);

    // Clean up: revert the change to not pollute DB
    school.assignedStaff = school.assignedStaff.filter(id => !id.equals(trainer._id));
    await school.save();
    console.log('\n✓ Reverted allocation for test');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testAllocation();
