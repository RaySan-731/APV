require('dotenv').config();
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const Staff = require('./models/Staff');
const School = require('./models/School');

async function setupTrainers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Sample trainers to create
    const trainersData = [
      { 
        idNumber: 'TRN001',
        name: 'Samuel Kipchoge', 
        email: 'samuel.kipchoge@apv.com', 
        password: 'Trainer@123',
        status: 'Active'
      },
      { 
        idNumber: 'TRN002',
        name: 'Mary Kariuki', 
        email: 'mary.kariuki@apv.com', 
        password: 'Trainer@123',
        status: 'Active'
      },
      { 
        idNumber: 'TRN003',
        name: 'David Omondi', 
        email: 'david.omondi@apv.com', 
        password: 'Trainer@123',
        status: 'Active'
      },
      { 
        idNumber: 'TRN004',
        name: 'Grace Mwangi', 
        email: 'grace.mwangi@apv.com', 
        password: 'Trainer@123',
        status: 'Active'
      }
    ];

    console.log('📝 Creating Sample Trainers...\n');

    const createdTrainers = [];

    for (const trainerData of trainersData) {
      // Hash the password
      const hashedPassword = await bcryptjs.hash(trainerData.password, 10);

      const trainer = new Staff({
        idNumber: trainerData.idNumber,
        name: trainerData.name,
        email: trainerData.email,
        password: hashedPassword,
        role: 'trainer',
        status: trainerData.status
      });

      const savedTrainer = await trainer.save();
      createdTrainers.push({
        ...trainerData,
        _id: savedTrainer._id
      });

      console.log(`✓ Created: ${trainerData.name}`);
      console.log(`  Email: ${trainerData.email}`);
      console.log(`  Password: ${trainerData.password}`);
      console.log(`  Status: ${trainerData.status}\n`);
    }

    // Get schools for allocation
    const schools = await School.find().limit(4);
    console.log(`\n📚 Found ${schools.length} schools - allocating to trainers...\n`);

    // Allocate schools to trainers
    for (let i = 0; i < createdTrainers.length && i < schools.length; i++) {
      const trainer = createdTrainers[i];
      const school = schools[i];

      if (!school.assignedStaff) {
        school.assignedStaff = [];
      }

      school.assignedStaff.push(trainer._id);
      await school.save();

      console.log(`✓ Allocated "${school.name}" to ${trainer.name}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎓 TRAINER CREDENTIALS FOR LOGIN');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Login URL: http://127.0.0.1:3000/login\n');

    trainersData.forEach((trainer, idx) => {
      console.log(`${idx + 1}. ${trainer.name}`);
      console.log(`   Email: ${trainer.email}`);
      console.log(`   Password: ${trainer.password}`);
      console.log(`   Status: ${trainer.status}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✓ TRAINERS SETUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Trainers can now:');
    console.log('  • Login to the dashboard');
    console.log('  • View their allocated schools');
    console.log('  • View and edit student records');
    console.log('  • Manage student information\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

setupTrainers();
