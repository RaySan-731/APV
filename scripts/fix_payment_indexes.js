#!/usr/bin/env node
/*
 * scripts/fix_payment_indexes.js
 *
 * One-time fix for the payments collection:
 * - Drops any leftover *unique* index on `invoiceNumber` (which incorrectly prevented
 *   multiple payments per invoice for partial payments).
 * - Ensures the correct non-unique indexes (including the new invoiceId index).
 *
 * Run this once after pulling the code fix:
 *   node scripts/fix_payment_indexes.js
 *
 * It is safe to run multiple times.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Payment = require('../models/Payment');

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: No MONGODB_URI found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const db = mongoose.connection.db;
  const coll = db.collection('payments');

  console.log('Checking current indexes on payments collection...');
  const indexes = await coll.indexes();
  console.log('Current indexes:', indexes.map(i => ({ name: i.name, key: i.key, unique: !!i.unique })));

  // Drop the problematic unique index on invoiceNumber if it exists
  const badIndexName = 'invoiceNumber_1';
  const hasBadIndex = indexes.some(i => i.name === badIndexName && i.unique);

  if (hasBadIndex) {
    try {
      console.log(`Dropping unique index ${badIndexName}...`);
      await coll.dropIndex(badIndexName);
      console.log('✅ Successfully dropped the unique invoiceNumber_1 index.');
    } catch (err) {
      console.warn('Could not drop index (may not exist or already dropped):', err.message);
    }
  } else {
    console.log('No unique invoiceNumber_1 index found (good).');
  }

  // Now let Mongoose ensure all indexes defined in the model (non-unique versions)
  console.log('Syncing model indexes (this will create any missing non-unique indexes)...');
  await Payment.syncIndexes();

  const finalIndexes = await coll.indexes();
  console.log('\nFinal indexes on payments:');
  console.log(finalIndexes.map(i => ({ name: i.name, key: i.key, unique: !!i.unique })));

  console.log('\n✅ Payment indexes fixed. Multiple payments per invoice (for partial payments) are now allowed.');
  console.log('You can now record additional payments against invoices that previously had one payment.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error fixing indexes:', err);
  process.exit(1);
});
