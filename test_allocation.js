require('dotenv').config();
const mongoose = require('mongoose');
const School = require('./models/School');
const Staff = require('./models/Staff');

async function testAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...\n');

    // Get first trainer and first school
    const trainer = await Staff.findOne({ role: 'trainer' });
    const school = await School.findOne();

    if (!trainer || !school) {
      console.log('❌ No trainer or school found for testing');
      return;
    }

    console.log('Testing allocation of trainer:', trainer.name, 'to school:', school.name);
    console.log('Trainer ID:', trainer._id);
    console.log('School ID:', school._id);

    // Check initial state
    const initialAssigned = school.assignedStaff || [];
    console.log('Initial assignedStaff length:', initialAssigned.length);

    // Allocate
    school.assignedStaff = school.assignedStaff || [];
    school.assignedStaff.push(trainer._id);
    try {
      await school.save();
      console.log('✓ Allocation performed using push and save');
    } catch (saveErr) {
      console.log('❌ Save failed:', saveErr.message);
    }

    // Check after allocation
    const updatedSchool = await School.findById(school._id);
    const finalAssigned = updatedSchool.assignedStaff || [];
    console.log('Final assignedStaff length:', finalAssigned.length);

    if (finalAssigned.length > initialAssigned.length) {
      console.log('✅ Allocation persisted successfully!');
    } else {
      console.log('❌ Allocation did not persist');
    }

    // Clean up - remove the allocation
    await School.findByIdAndUpdate(school._id, { $pull: { assignedStaff: trainer._id } });
    console.log('✓ Test allocation cleaned up');

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testAllocation();