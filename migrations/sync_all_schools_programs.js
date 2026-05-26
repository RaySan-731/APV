/*
 * One-time sync: Populate Program.assignedTrainers based on current School.assignedStaff.
 *
 * For each school, for each active trainer assigned to that school, ensure that
 * for every program the school is enrolled in, there is an entry in Program.assignedTrainers
 * linking trainer, school, and program.
 *
 * Run: node migrations/sync_all_schools_programs.js
 */

const mongoose = require('mongoose');
const School = require('../models/School');
const Program = require('../models/Program');
const programSyncService = require('../backend/services/programSyncService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures';

async function runSync() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database\n');

    // Get all schools with at least one assigned active staff
    const schools = await School.find({
      'assignedStaff.status': 'active'
    }).lean();

    console.log(`Found ${schools.length} schools with active trainers\n`);

    let totalProgramsUpdated = 0;
    let totalAssignmentsAdded = 0;
    let totalAssignmentsTransferred = 0;

    for (const school of schools) {
      console.log(`Syncing school: ${school.name} (${school._id})`);
      const result = await programSyncService.syncSchoolToPrograms(school._id.toString());
      console.log(`  Programs updated: ${result.programsUpdated}, Assignments added: ${result.assignmentsAdded}, Transferred: ${result.assignmentsTransferred}`);
      totalProgramsUpdated += result.programsUpdated;
      totalAssignmentsAdded += result.assignmentsAdded;
      totalAssignmentsTransferred += result.assignmentsTransferred;
    }

    console.log('\n=== SYNC COMPLETE ===');
    console.log(`Total schools processed: ${schools.length}`);
    console.log(`Total programs updated: ${totalProgramsUpdated}`);
    console.log(`Total assignments added: ${totalAssignmentsAdded}`);
    console.log(`Total assignments transferred: ${totalAssignmentsTransferred}`);
    console.log('\nDone.\n');

    process.exit(0);
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

runSync();
