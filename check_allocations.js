const mongoose = require('mongoose');
const School = require('./models/School');
const Staff = require('./models/Staff');

async function checkAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures');
    console.log('Connected to MongoDB\n');

    // Check all schools with assignedStaff
    const schools = await School.find({ assignedStaff: { $exists: true, $ne: [] } })
      .select('name assignedStaff')
      .lean();

    console.log('=== SCHOOLS WITH ASSIGNED STAFF ===');
    if (schools.length === 0) {
      console.log('No schools have assignedStaff set');
    } else {
      schools.forEach(school => {
        console.log(`\nSchool: ${school.name}`);
        console.log(`  assignedStaff IDs: ${school.assignedStaff.map(id => id.toString()).join(', ')}`);
      });
    }

    // Check if any trainers exist
    const trainers = await Staff.find({ role: 'trainer' }).select('name email _id').lean();
    console.log('\n=== TRAINERS IN DATABASE ===');
    trainers.forEach(t => {
      console.log(`  ${t.name} (${t.email}) ID: ${t._id}`);
    });

    // Cross-check: do the assigned IDs correspond to actual trainers?
    if (schools.length > 0) {
      const allAssignedIds = [...new Set(schools.flatMap(s => s.assignedStaff.map(id => id.toString())))];
      const foundTrainers = await Staff.find({ _id: { $in: allAssignedIds } }).select('name email _id').lean();
      const foundIds = new Set(foundTrainers.map(t => t._id.toString()));
      console.log('\n=== ASSIGNED IDS THAT WERE FOUND ===');
      allAssignedIds.forEach(id => {
        console.log(`  ${id}: ${foundIds.has(id) ? '✓ FOUND' : '✗ NOT FOUND'}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

checkAllocation();
