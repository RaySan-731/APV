/*
 * backend/config/transporter.js
 * Nodemailer transporter configuration
 */

const nodemailer = require('nodemailer');

let transporter;

if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  // Development: ethereal test account or console
  transporter = nodemailer.createTransport({
    jsonTransport: true
  });
}

module.exports = transporter;
