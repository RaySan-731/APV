require('dotenv').config();
const mongoose = require('mongoose');
const School = require('./models/School');
const Staff = require('./models/Staff');

async function checkAllocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...\n');

    // Find all schools
    const schools = await School.find().sort({ name: 1 });

    if (schools.length === 0) {
      console.log('❌ NO SCHOOLS FOUND IN DATABASE');
      return;
    }

    console.log('✓ FOUND ' + schools.length + ' SCHOOL(S) IN DATABASE\n');
    console.log('═══════════════════════════════════════════════════════════');

    // Get all assigned trainer IDs
    const assignedIds = [...new Set(schools.flatMap(school => school.assignedStaff || []).map(id => id.toString()))];
    const trainers = assignedIds.length > 0
      ? await Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber').lean()
      : [];
    const trainerMap = new Map(trainers.map(trainer => [trainer._id.toString(), trainer]));

    let totalAllocations = 0;

    schools.forEach((school, idx) => {
      const assignedTrainers = (school.assignedStaff || []).map(id => trainerMap.get(id.toString())).filter(Boolean);
      totalAllocations += assignedTrainers.length;

      console.log('\n' + (idx + 1) + '. ' + school.name);
      console.log('   Location: ' + (school.address ? `${school.address.city}, ${school.address.country}` : 'Not set'));
      console.log('   Status: ' + school.status);
      console.log('   Student Count: ' + (school.studentCount || 0));

      if (assignedTrainers.length > 0) {
        console.log('   ✓ Allocated Trainers (' + assignedTrainers.length + '):');
        assignedTrainers.forEach(trainer => {
          console.log('     • ' + trainer.name + ' (' + trainer.email + ') - ID: ' + (trainer.idNumber || 'N/A'));
        });
      } else {
        console.log('   ❌ No trainers allocated');
      }
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:');
    console.log('   • Total Schools: ' + schools.length);
    console.log('   • Total Allocations: ' + totalAllocations);
    console.log('   • Schools with Trainers: ' + schools.filter(s => (s.assignedStaff || []).length > 0).length);
    console.log('   • Schools without Trainers: ' + schools.filter(s => !(s.assignedStaff || []).length).length);

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAllocations();