require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff');

async function checkTrainers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...\n');
    
    // Find all trainers
    const trainers = await Staff.find({ role: 'trainer' });
    
    if (trainers.length === 0) {
      console.log('❌ NO TRAINERS FOUND IN DATABASE');
      console.log('\nTo add trainers, the founder can:');
      console.log('1. Login to the founder dashboard (founder@apv.com / Founder123!)');
      console.log('2. Navigate to the "Trainers" section');
      console.log('3. Use the "Add New Trainer" form');
      console.log('\nTrainers will need:');
      console.log('  • Name');
      console.log('  • Email (for login)');
      console.log('  • Password (you set during creation)');
      console.log('  • Status (Active, On Leave, or Inactive)');
      console.log('\n✓ Trainers can then login and:');
      console.log('  • View student records');
      console.log('  • Edit student information');
      console.log('  • View allocated schools');
    } else {
      console.log('✓ FOUND ' + trainers.length + ' TRAINER(S) IN DATABASE\n');
      console.log('═══════════════════════════════════════════════════════════');
      trainers.forEach((trainer, idx) => {
        console.log('\n' + (idx + 1) + '. ' + trainer.name);
        console.log('   Email: ' + trainer.email);
        console.log('   Status: ' + trainer.status);
        console.log('   ID Number: ' + (trainer.idNumber || 'Not set'));
        console.log('   ℹ️  Password: Default trainer password is 0000 until they change it');
      });
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('\nTrainers can use their email and password to login at:');
      console.log('http://127.0.0.1:3000/login');
    }
    
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTrainers();
