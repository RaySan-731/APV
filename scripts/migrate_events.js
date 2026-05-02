/*
 * Script to migrate existing Event records to the new schema
 * Run with: node scripts/migrate_events.js
 */
const mongoose = require('mongoose');
const Event = require('../models/Event');
require('dotenv').config();

async function migrateEvents() {
  try {
    console.log('Starting Event migration...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const events = await Event.find({});
    console.log(`Found ${events.length} events to migrate`);

    let migratedCount = 0;
    for (const event of events) {
      let needsUpdate = false;

      // If old 'date' field exists, copy to startDate and endDate
      if (event.date && !event.startDate) {
        event.startDate = event.date;
        event.endDate = event.date;
        needsUpdate = true;
      } else {
        // Ensure startDate exists
        if (!event.startDate) {
          event.startDate = new Date();
          event.endDate = new Date();
          needsUpdate = true;
        }
      }

      // Ensure location is an object with name
      if (!event.location || typeof event.location !== 'object' || !event.location.name) {
        event.location = {
          name: event.location?.name || (typeof event.location === 'string' ? event.location : 'TBD'),
          address: event.location?.address || '',
          city: event.location?.city || '',
          region: event.location?.region || '',
          country: event.location?.country || 'Kenya'
        };
        needsUpdate = true;
      }

      // Set maxParticipants if missing (required)
      if (!event.maxParticipants) {
        event.maxParticipants = 100; // default for old events
        needsUpdate = true;
      }

      // Set eventType if missing
      if (!event.eventType) {
        event.eventType = 'other';
        needsUpdate = true;
      }

      // Ensure trainers array exists
      if (!event.trainers) {
        event.trainers = [];
        needsUpdate = true;
      }

      // Ensure targetSchools array exists
      if (!event.targetSchools) {
        event.targetSchools = [];
        needsUpdate = true;
      }

      // Ensure requiredEquipment array exists
      if (!event.requiredEquipment) {
        event.requiredEquipment = [];
        needsUpdate = true;
      }

      // Set status enum mapping
      if (event.status && !['draft', 'published', 'cancelled', 'completed', 'archived'].includes(event.status)) {
        const statusMap = {
          'Planning': 'draft',
          'Confirmed': 'published',
          'Completed': 'completed',
          'Cancelled': 'cancelled'
        };
        event.status = statusMap[event.status] || 'draft';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await event.save();
        migratedCount++;
        console.log(`Migrated event: ${event.name} (${event._id})`);
      }
    }

    console.log(`\nMigration complete. Migrated ${migratedCount} events.`);

    // Verification
    const postCount = await Event.countDocuments();
    console.log(`Total events in database: ${postCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateEvents();
