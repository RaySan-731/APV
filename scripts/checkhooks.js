// Directly call the Invoice model constructor to check for any 'create' pre-validate hook
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const rootDir = path.resolve(__dirname, '..');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures').then(async () => {
  const InvoiceModel = require(path.join(rootDir, 'models', 'Invoice'));
  const schema = InvoiceModel.schema;
  console.log('Invoice schema pre-hooks:', schema.pre('validate')?.length || 0);
  console.log('Invoice schema pre-save hooks:', schema.pre('save')?.length || 0);
  schema.pre('save').forEach(h => console.log('  pre-save fn:', h.toString().split('\n')[0]));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
