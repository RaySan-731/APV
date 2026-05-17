const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures').then(async () => {
  const School = require(path.join(rootDir, 'models', 'School'));
  const Invoice = require(path.join(rootDir, 'models', 'Invoice')).lean();

  // Check if there are already invoices for these schools/events
  console.log('=== All invoices ===');
  const allInvoices = await Invoice.find({}).lean();
  console.log('Total invoices:', allInvoices.length);
  allInvoices.forEach(inv => {
    console.log(`  inv ${inv.invoiceNumber}: type=${inv.invoiceType}, schoolId=${inv.schoolId?.toString()}, status=${inv.status}`);
    if (inv.relatedEvents?.length) inv.relatedEvents.forEach(e => {
      console.log(`    relatedEvent: ${e.toString()}`);
    });
    if (inv.items?.length) inv.items.forEach(item => console.log(`    item: ${item.description}, qty=${item.quantity}, rate=${item.unitPrice}`));
  });

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
