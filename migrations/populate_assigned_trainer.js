/*
 * Migration script: Populate assignedTrainer field from addedBy.trainerId
 * This ensures existing students have the trainer who added them set as the assigned trainer.
 * Run: node migrations/populate_assigned_trainer.js
 */

const mongoose = require('mongoose');
const Student = require('../models/Student');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scoutmate-hub';

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database');

    console.log('Finding students without assignedTrainer...');
    const studentsWithoutTrainer = await Student.find({
      assignedTrainer: { $exists: false }
    });

    console.log(`Found ${studentsWithoutTrainer.length} students to update`);

    let updatedCount = 0;
    for (const student of studentsWithoutTrainer) {
      if (student.addedBy?.trainerId) {
        student.assignedTrainer = student.addedBy.trainerId;
        await student.save({ validateBeforeSave: false });
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} students...`);
        }
      }
    }

    console.log(`\nMigration complete! Updated ${updatedCount} students.`);
    console.log('All students now have assignedTrainer populated from addedBy.trainerId');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
