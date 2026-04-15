#!/usr/bin/env node
/*
 * scripts/normalize_db_records.js
 * One-time normalization script to clean MongoDB records for User and Staff collections.
 * Ensures User role values conform to allowed enums and Staff role/status values are normalized.
 * Run with: node scripts/normalize_db_records.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Staff = require('../models/Staff');

const validUserRoles = [
  'founder',
  'commissioner',
  'training_officer',
  'medical',
  'rover',
  'trainer',
  'staff'
];

const validStaffStatuses = ['Active', 'On Leave', 'Inactive'];

function normalizeRole(role) {
  if (!role || typeof role !== 'string') return 'rover';

  const normalized = role.trim().toLowerCase();

  const mapping = {
    founder: 'founder',
    commissioner: 'commissioner',
    'training_officer': 'training_officer',
    'training-officer': 'training_officer',
    'training officer': 'training_officer',
    trainingofficer: 'training_officer',
    medical: 'medical',
    rover: 'rover',
    staff: 'staff',
    trainer: 'trainer'
  };

  return mapping[normalized] || 'rover';
}

function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return 'Active';
  const normalized = status.trim().toLowerCase();
  const mapping = {
    active: 'Active',
    'on leave': 'On Leave',
    'on_leave': 'On Leave',
    'on-leave': 'On Leave',
    inactive: 'Inactive'
  };
  return mapping[normalized] || 'Active';
}

async function normalizeUserRecords() {
  const users = await User.find({}).lean();
  let normalizedCount = 0;

  for (const user of users) {
    const currentRole = user.role;
    const newRole = normalizeRole(currentRole);

    if (newRole !== currentRole) {
      await User.updateOne({ _id: user._id }, { role: newRole });
      normalizedCount += 1;
      console.log(`Normalized User ${user.email}: role ${currentRole} -> ${newRole}`);
    }
  }

  console.log(`\nUser normalization complete: ${normalizedCount} record(s) updated.`);
  return normalizedCount;
}

async function normalizeStaffRecords() {
  const staff = await Staff.find({}).lean();
  let normalizedCount = 0;

  for (const member of staff) {
    const normalizedRole = member.role && typeof member.role === 'string' ? member.role.trim().toLowerCase() : 'staff';
    const normalizedRoleValue = normalizedRole === 'trainer' ? 'trainer' : 'staff';
    const normalizedStatusValue = normalizeStatus(member.status);

    const updates = {};
    if (member.role !== normalizedRoleValue) {
      updates.role = normalizedRoleValue;
    }
    if (member.status !== normalizedStatusValue) {
      updates.status = normalizedStatusValue;
    }

    if (Object.keys(updates).length > 0) {
      await Staff.updateOne({ _id: member._id }, updates);
      normalizedCount += 1;
      console.log(`Normalized Staff ${member.email}:`, updates);
    }
  }

  console.log(`\nStaff normalization complete: ${normalizedCount} record(s) updated.`);
  return normalizedCount;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not set in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for normalization');

    await normalizeUserRecords();
    await normalizeStaffRecords();

    console.log('\nNormalization complete. Records are now persisted with normalized values.');
    process.exit(0);
  } catch (err) {
    console.error('Normalization failed:', err);
    process.exit(1);
  }
}

run();
