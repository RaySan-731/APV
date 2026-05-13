/*
 * Migration: Convert Program.assignedTrainer (single) to assignedTrainers (array)
 *
 * This script:
 * 1. Finds all programs that have an assignedTrainer field set (old format)
 * 2. For each such program, identifies all schools that are enrolled in this program
 * 3. For each school, checks if that trainer is assigned to that school
 * 4. Creates corresponding assignedTrainers entries (trainerId, schoolId, assignmentType)
 *
 * Note: If a trainer is not assigned to a school that enrolls in the program,
 * no assignment is created (the business rule: trainer must be school-assigned
 * to be responsible for its programs).
 *
 * Run: node migrations/migrate_program_assigned_trainer.js
 */

const mongoose = require('mongoose');
const Program = require('../models/Program');
const School = require('../models/School');
const Staff = require('../models/Staff');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scoutmate-hub';

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database\n');

    // Find all programs with old assignedTrainer field
    const programsWithTrainer = await Program.find({
      assignedTrainer: { $exists: true, $ne: null }
    }).lean();

    console.log(`Found ${programsWithTrainer.length} programs with assignedTrainer field\n`);

    let totalConverted = 0;
    let skippedNoSchool = 0;
    let skippedTrainerNotInSchool = 0;

    for (const prog of programsWithTrainer) {
      const programId = prog._id;
      const trainerId = prog.assignedTrainer;

      if (!trainerId) continue;

      // Find all schools that have this program in programsEnrolled
      const schools = await School.find({
        programsEnrolled: { $in: [programId] }
      }).lean();

      if (schools.length === 0) {
        console.log(`  Program ${prog.name} (${prog._id}) - no schools enrolled, skipping`);
        skippedNoSchool++;
        continue;
      }

      // For each school, verify trainer is assigned to that school
      const validAssignments = [];
      for (const school of schools) {
        const isTrainerAssigned = school.assignedStaff?.some(
          a => a.staffId && a.staffId.toString() === trainerId.toString()
        );
        if (isTrainerAssigned) {
          validAssignments.push({
            schoolId: school._id,
            // Get assignment type from school's assignedStaff if available
            assignmentType: school.assignedStaff?.find(
              a => a.staffId && a.staffId.toString() === trainerId.toString()
            )?.assignmentType || 'primary'
          });
        }
      }

      if (validAssignments.length === 0) {
        console.log(`  Program ${prog.name} (${prog._id}) - trainer not assigned to any enrolled schools, skipping`);
        skippedTrainerNotInSchool++;
        continue;
      }

      // Build assignedTrainers array
      const assignedTrainers = validAssignments.map(a => ({
        trainerId: trainerId,
        schoolId: a.schoolId,
        assignmentType: a.assignmentType,
        assignedDate: new Date(), // We don't have original date, use now
        status: 'active'
      }));

      // Update the program
      await Program.findByIdAndUpdate(programId, {
        $set: { assignedTrainers },
        $unset: { assignedTrainer: '' } // Remove old field
      });

      totalConverted++;
      console.log(`✓ Converted program "${prog.name}" - added ${assignedTrainers.length} trainer-school assignments`);
    }

    console.log('\n=== MIGRATION COMPLETE ===');
    console.log(`Total programs converted: ${totalConverted}`);
    console.log(`Skipped (no schools enrolled): ${skippedNoSchool}`);
    console.log(`Skipped (trainer not in school): ${skippedTrainerNotInSchool}`);
    console.log('\nNow run programSyncService.syncSchoolToPrograms() for all schools to ensure consistency.');
    console.log('Or simply rely on automatic sync for future changes.\n');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
