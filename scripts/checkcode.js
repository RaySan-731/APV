// Inject a log line AT the start of the real createInvoice handler to confirm server is running updated code
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures').then(async () => {
  const School  = require(path.join(rootDir, 'models', 'School'));
  const Event   = require(path.join(rootDir, 'models', 'Event'))

  // Check what code path the ACTUAL server's invoiceController.js uses
  const fs = require('fs');
  const code = fs.readFileSync(path.join(rootDir, 'backend', 'controllers', 'invoiceController.js'), 'utf8');

  // Find the rate assignment line
  const rateLine = code.match(/const rate = .*/g);
  console.log('Rate assignment lines in current invoiceController.js:');
  rateLine?.forEach(l => console.log('  ', l.trim()));

  // Check for the exact error phrase from the user
  if (code.includes('paymentTerms.ratePerStudent or event.costPerParticipant')) {
    console.log('\n✗ OLD error-message text still present in file!');
  } else if (code.includes('event.costPerParticipant or paymentTerms.ratePerStudent')) {
    console.log('\n✓ NEW error-message text is present');
  }

  const hasPriorityFix = code.includes('event.costPerParticipant > 0 ? event.costPerParticipant');
  console.log(`${hasPriorityFix ? '✓' : '✗'} costPerParticipant-first logic present: ${hasPriorityFix}`);

  const hasExpandedStatus = code.includes("$in: ['published', 'scheduled', 'confirmed', 'in_progress', 'completed']");
  console.log(`${hasExpandedStatus ? '✓' : '✗'} Expanded status filter present: ${hasExpandedStatus}`);

  const hasSkippedReasons = code.includes('skippedReasons');
  console.log(`${hasSkippedReasons ? '✓' : '✗'} skippedReasons logging present: ${hasSkippedReasons}`);

  // Check if express is serving a COMPILED/CACHED version?
  const stats = fs.statSync(path.join(rootDir, 'backend', 'controllers', 'invoiceController.js'));
  console.log('\nLast modified (invoiceController.js):', stats.mtime);

  // Also check what the finance route reads
  const routeStats = fs.statSync(path.join(rootDir, 'backend', 'routes', 'finance.js'));
  console.log('Last modified (finance.js):', routeStats.mtime);

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
