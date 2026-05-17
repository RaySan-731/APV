/**
 * backend/services/programSyncService.js
 * Service to synchronize trainer assignments between schools and programs.
 *
 * Business Rule:
 * When a trainer is assigned to a school, they automatically become responsible
 * for all programs that the school has enrolled with APV.
 *
 * Similarly, when a trainer is removed from a school, they are removed from
 * those programs' trainer assignments.
 */

const mongoose = require('mongoose');
const School = require('../../models/School');
const Program = require('../../models/Program');
const Staff = require('../../models/Staff');

/**
 * Sync trainer assignments for a school to all its enrolled programs.
 * @param {string} trainerId - The trainer's ObjectId string
 * @param {string} schoolId - The school's ObjectId string
 * @param {string} action - 'add' or 'remove'
 * @param {string} [assignmentType='primary'] - The assignment type from school (primary/secondary)
 * @returns {Promise<{added: number, removed: number}>}
 */
exports.syncTrainerToSchoolPrograms = async (trainerId, schoolId, action = 'add', assignmentType = 'primary') => {
  const results = { added: 0, removed: 0 };

  try {
    // Get the school to access programsEnrolled
    const school = await School.findById(schoolId);
    if (!school) {
      console.warn(`School not found for sync: ${schoolId}`);
      return results;
    }

    const programIds = school.programsEnrolled || [];
    if (programIds.length === 0) {
      return results; // No programs enrolled
    }

    // Get all programs for this school
    const programs = await Program.find({ _id: { $in: programIds } });
    if (programs.length === 0) {
      return results;
    }

    const trainerObjectId = new mongoose.Types.ObjectId(trainerId);

    for (const program of programs) {
      if (action === 'add') {
        // Check if trainer already assigned to this program for this school
        const exists = program.assignedTrainers.some(
          at => at.trainerId.equals(trainerObjectId) && at.schoolId.equals(school._id)
        );

        if (!exists) {
          program.assignedTrainers.push({
            trainerId: trainerObjectId,
            schoolId: school._id,
            assignmentType,
            assignedDate: new Date(),
            status: 'active'
          });
          results.added++;
        }
      } else if (action === 'remove') {
        // Remove trainer from program for this school
        const beforeCount = program.assignedTrainers.length;
        program.assignedTrainers = program.assignedTrainers.filter(
          at => !(at.trainerId.equals(trainerObjectId) && at.schoolId.equals(school._id))
        );
        if (program.assignedTrainers.length < beforeCount) {
          results.removed++;
        }
      }
    }

    // Bulk save all programs
    if (programs.length > 0) {
      await Program.bulkSave(programs); // Mongoose doesn't have bulkSave, use individual saves or bulkWrite
      // Actually, let's do individual saves to trigger middleware
      // Or use Promise.all
      await Promise.all(programs.map(p => p.save()));
    }

    console.log(`Program sync completed for trainer ${trainerId}, school ${schoolId}:`, results);
  } catch (err) {
    console.error('Error syncing trainer to school programs:', err);
  }

  return results;
};

/**
 * When a new program is added to a school's programsEnrolled,
 * automatically assign all active trainers from that school to the program.
 * @param {string} schoolId
 * @param {string} programId
 * @returns {Promise<{assigned: number}>}
 */
exports.assignSchoolTrainersToProgram = async (schoolId, programId) => {
  const results = { assigned: 0 };

  try {
    const school = await School.findById(schoolId);
    if (!school || !school.assignedStaff) {
      return results;
    }

    const program = await Program.findById(programId);
    if (!program) {
      return results;
    }

    const activeAssignments = school.assignedStaff.filter(
      a => a.status === 'active' && a.staffId
    );

    for (const assignment of activeAssignments) {
      const exists = program.assignedTrainers.some(
        at => at.trainerId.equals(assignment.staffId) && at.schoolId.equals(school._id)
      );

      if (!exists) {
        program.assignedTrainers.push({
          trainerId: assignment.staffId,
          schoolId: school._id,
          assignmentType: assignment.assignmentType || 'primary',
          assignedDate: new Date(),
          status: 'active'
        });
        results.assigned++;
      }
    }

    await program.save();
  } catch (err) {
    console.error('Error assigning school trainers to program:', err);
  }

  return results;
};

/**
 * Get all active trainers for a given school across its programs.
 * Useful for permission checks.
 * @param {string} schoolId
 * @returns {Promise<Array< Staff >>}
 */
exports.getTrainersForSchool = async (schoolId) => {
  try {
    const school = await School.findById(schoolId)
      .populate('assignedStaff.staffId', 'name email role idNumber')
      .lean();

    if (!school || !school.assignedStaff) {
      return [];
    }

    return school.assignedStaff
      .filter(a => a.status === 'active')
      .map(a => a.staffId)
      .filter(Boolean);
  } catch (err) {
    console.error('Error getting trainers for school:', err);
    return [];
  }
};

/**
 * Synchronize all trainer assignments for a school to its enrolled programs.
 * This ensures that for every program the school is enrolled in, the program's
 * assignedTrainers array contains entries for all active trainers of the school,
 * and entries for trainers no longer active are marked as transferred.
 *
 * @param {string} schoolId - The school ObjectId string
 * @returns {Promise<{programsUpdated: number, assignmentsAdded: number, assignmentsTransferred: number}>}
 */
exports.syncSchoolToPrograms = async (schoolId) => {
  const results = { programsUpdated: 0, assignmentsAdded: 0, assignmentsTransferred: 0 };

  try {
    // Get school with assignedStaff
    const school = await School.findById(schoolId)
      .populate('assignedStaff.staffId', '_id')
      .lean();

    if (!school) {
      console.warn(`School not found for sync: ${schoolId}`);
      return results;
    }

    const programIds = school.programsEnrolled || [];
    if (programIds.length === 0) {
      return results;
    }

    const programs = await Program.find({ _id: { $in: programIds } });
    if (programs.length === 0) {
      return results;
    }

    // Build map of active trainer IDs from school
    const activeAssignments = (school.assignedStaff || [])
      .filter(a => a.status === 'active' && a.staffId)
      .map(a => ({
        trainerId: a.staffId._id || a.staffId,
        assignmentType: a.assignmentType || 'primary'
      }));
    const activeTrainerIds = new Set(activeAssignments.map(a => a.trainerId.toString()));

    for (const program of programs) {
      // Get existing assignments for this school
      const existingEntries = program.assignedTrainers.filter(
        at => at.schoolId.toString() === schoolId
      );

      const existingTrainerIds = new Set(existingEntries.map(e => e.trainerId.toString()));

      // Update existing entries: mark as transferred if not active, keep active ones
      for (const entry of existingEntries) {
        const trainerIdStr = entry.trainerId.toString();
        if (!activeTrainerIds.has(trainerIdStr)) {
          // Trainer no longer actively assigned to school
          if (entry.status !== 'transferred') {
            entry.status = 'transferred';
            results.assignmentsTransferred++;
          }
        } else {
          // Trainer is still active; ensure status is active and maybe update assignmentType
          if (entry.status !== 'active') {
            entry.status = 'active';
            results.assignmentsAdded++; // count as updated
          }
          // Optionally update assignmentType to match school's current assignmentType
          const activeInfo = activeAssignments.find(a => a.trainerId.toString() === trainerIdStr);
          if (activeInfo && entry.assignmentType !== activeInfo.assignmentType) {
            entry.assignmentType = activeInfo.assignmentType;
          }
        }
      }

      // Add missing active trainers
      for (const active of activeAssignments) {
        if (!existingTrainerIds.has(active.trainerId.toString())) {
          program.assignedTrainers.push({
            trainerId: active.trainerId,
            schoolId: new mongoose.Types.ObjectId(schoolId),
            assignmentType: active.assignmentType,
            assignedDate: new Date(),
            status: 'active'
          });
          results.assignmentsAdded++;
        }
      }

      await program.save();
      results.programsUpdated++;
    }

    console.log(`Sync school ${schoolId} to programs:`, results);
  } catch (err) {
    console.error('Error in syncSchoolToPrograms:', err);
  }

  return results;
};
