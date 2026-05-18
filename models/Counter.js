/*
 * models/Counter.js
 * Atomic counter document used to generate sequential staff TRN numbers.
 * The `_id` field IS the counter name (e.g. "staff-id-counter").
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },   // e.g. "staff-id-counter"
  seq:  { type: Number, default: 0, required: true }  // latest issued value
});

module.exports = mongoose.model('Counter', counterSchema);
