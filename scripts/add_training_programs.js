// Add Training Sessions and Leadership Training programs
require('dotenv').config();
const mongoose = require('mongoose');

async function addPrograms() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures');
    console.log('Connected to MongoDB\n');

    const Program = require('../models/Program');

    // Program 1: Training Sessions
    const trainingSessions = await Program.findOne({ name: 'Training Sessions', status: { $ne: 'inactive' } });
    if (!trainingSessions) {
      const program1 = new Program({
        name: 'Training Sessions',
        description: 'Comprehensive training sessions focused on developing essential skills for scouts through hands-on activities and practical learning.',
        category: 'leadership',
        ageGroup: { min: 10, max: 18 },
        duration: 'half-day',
        maxParticipants: 30,
        price: { amount: 1500, currency: 'Ksh' },
        learningObjectives: [
          'Develop teamwork and collaboration skills',
          'Improve communication and public speaking',
          'Build confidence and self-esteem',
          'Learn practical problem-solving techniques'
        ],
        materials: [
          'Training manuals and workbooks',
          'Activity-specific equipment',
          'Certificates of completion'
        ],
        status: 'active'
      });
      await program1.save();
      console.log('✓ "Training Sessions" program created');
    } else {
      console.log('✓ "Training Sessions" program already exists');
    }

    // Program 2: Leadership Training
    const leadershipTraining = await Program.findOne({ name: 'Leadership Training', status: { $ne: 'inactive' } });
    if (!leadershipTraining) {
      const program2 = new Program({
        name: 'Leadership Training',
        description: 'Advanced leadership development program designed for senior scouts and youth leaders to master leadership principles and mentoring skills.',
        category: 'leadership',
        ageGroup: { min: 12, max: 40 },
        duration: 'full-day',
        maxParticipants: 100,
        price: { amount: 1000, currency: 'ksh' },
        learningObjectives: [
          'Understand core leadership principles and styles',
          'Develop decision-making and critical thinking skills',
          'Learn mentoring and coaching techniques',
          'Master conflict resolution and team dynamics'
        ],
        materials: [
          'Leadership handbook and reference guides',
          'Interactive workshop materials',
          'Personal development journal',
          'Leadership assessment tools'
        ],
        status: 'active'
      });
      await program2.save();
      console.log('✓ "Leadership Training" program created');
    } else {
      console.log('✓ "Leadership Training" program already exists');
    }

    console.log('\n=== Programs added successfully ===');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

addPrograms();
