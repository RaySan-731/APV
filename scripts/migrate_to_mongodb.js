#!/usr/bin/env node
/*
 * scripts/migrate_to_mongodb.js
 * One-time migration script to transfer data from JSON files to MongoDB.
 * Reads users and bookings from data/users.json and data/bookings.json,
 * then writes them as documents into MongoDB collections via Mongoose.
 * Run with: node scripts/migrate_to_mongodb.js
 */

/**
 * Migration script to transfer data from JSON files to MongoDB
 * Run this script once to migrate existing data
 * Usage: node scripts/migrate_to_mongodb.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const User = require('../models/User');
const Booking = require('../models/Booking');
const bcryptjs = require('bcryptjs');

const usersJsonPath = path.join(__dirname, '../data/users.json');
const bookingsJsonPath = path.join(__dirname, '../data/bookings.json');

async function migrateData() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('ERROR: MONGODB_URI not set in .env file');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    // Use default options for mongoose (v6+); avoid deprecated warnings
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Migrate Users
    console.log('\nMigrating users...');
    if (fs.existsSync(usersJsonPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
      console.log(`Found ${usersData.length} users to migrate`);

      for (const userData of usersData) {
        try {
          const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
          if (existingUser) {
            console.log(`  - User ${userData.email} already exists, skipping...`);
            continue;
          }

          const user = new User({
            email: userData.email.toLowerCase(),
            password: userData.password, // Already hashed in JSON
            name: userData.name,
            role: userData.role || 'rover',
            isActive: userData.isActive !== false,
            createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
            updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : new Date()
          });

          await user.save();
          console.log(`  ✓ Migrated user: ${userData.email}`);
        } catch (err) {
          console.error(`  ✗ Error migrating user ${userData.email}:`, err.message);
        }
      }
    } else {
      console.log('No users.json file found, skipping users migration');
    }

    // Migrate Bookings
    console.log('\nMigrating bookings...');
    if (fs.existsSync(bookingsJsonPath)) {
      const bookingsData = JSON.parse(fs.readFileSync(bookingsJsonPath, 'utf8'));
      console.log(`Found ${bookingsData.length} bookings to migrate`);

      for (const bookingData of bookingsData) {
        try {
          // Avoid casting legacy IDs that are not valid MongoDB ObjectIds.
          // First try to detect an existing booking by a valid ObjectId id,
          // otherwise fall back to a heuristic match (program + date + userEmail).
          let existingBooking = null;
          if (bookingData.id) {
            try {
              if (mongoose.Types.ObjectId.isValid(bookingData.id)) {
                existingBooking = await Booking.findById(bookingData.id);
              }
            } catch (e) {
              // ignore and fall through to heuristic check
            }
          }

          if (!existingBooking) {
            // Heuristic duplicate check: same program, same date, same requester (best-effort)
            const dateVal = bookingData.date ? new Date(bookingData.date) : null;
            const query = {
              program: bookingData.program
            };
            if (dateVal) query.date = dateVal;
            if (bookingData.userEmail) query.userEmail = bookingData.userEmail;

            existingBooking = await Booking.findOne(query);
          }

          if (existingBooking) {
            console.log(`  - Booking ${bookingData.id || bookingData.program} already exists, skipping...`);
            continue;
          }

          const booking = new Booking({
            program: bookingData.program,
            type: bookingData.type || 'school',
            date: bookingData.date ? new Date(bookingData.date) : new Date(),
            participants: parseInt(bookingData.participants) || 0,
            notes: bookingData.notes || '',
            userEmail: bookingData.userEmail || 'guest',
            requesterName: bookingData.requesterName || '',
            legacyId: bookingData.id || undefined,
            status: bookingData.status || 'confirmed', // Preserve status if present
            createdAt: bookingData.createdAt ? new Date(bookingData.createdAt) : new Date()
          });

          await booking.save();
          console.log(`  ✓ Migrated booking: ${bookingData.program} on ${booking.date}`);
        } catch (err) {
          console.error(`  ✗ Error migrating booking:`, err.message);
        }
      }
    } else {
      console.log('No bookings.json file found, skipping bookings migration');
    }

    console.log('\n✓ Migration completed successfully!');

    // Archive JSON files to a timestamped folder to avoid accidental re-runs
    try {
      const archiveDir = path.join(__dirname, '../data/archive-' + new Date().toISOString().replace(/[:.]/g,'-'));
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

      if (fs.existsSync(usersJsonPath)) {
        fs.renameSync(usersJsonPath, path.join(archiveDir, 'users.json'));
        console.log(`Archived users.json -> ${archiveDir}`);
      }
      if (fs.existsSync(bookingsJsonPath)) {
        fs.renameSync(bookingsJsonPath, path.join(archiveDir, 'bookings.json'));
        console.log(`Archived bookings.json -> ${archiveDir}`);
      }
    } catch (archErr) {
      console.error('Failed to archive JSON files:', archErr.message);
    }

    console.log('You can now safely remove or inspect the archived files in data/archive-...');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateData();
