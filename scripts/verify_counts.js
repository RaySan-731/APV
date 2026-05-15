const mongoose = require('mongoose');
const path = require('path');
const School = require(path.resolve(__dirname, '..', 'models', 'School'));

mongoose.connect('mongodb://localhost:27017/apv-ventures')
  .then(async () => {
    const db = mongoose.connection.db;
    const q = { $or: [ { serviceStatus: 'active' }, { serviceStatus: { $exists: false }, status: 'active' } ] };
    const statCardOr  = await db.collection('schools').countDocuments(q);
    const svcActive   = await db.collection('schools').countDocuments({ serviceStatus: 'active' });
    const legacy      = await db.collection('schools').countDocuments({ serviceStatus: { $exists: false }, status: 'active' });
    const mismatch    = await School.countDocuments({ status: 'active', serviceStatus: { $ne: 'active' } });

    const all = await School.find({}).select('status serviceStatus').lean();
    const tableActive = all.filter(s => (s.serviceStatus || s.status || 'active') === 'active').length;

    console.log('\n=== stat-card vs table alignment ===');
    console.log('  OR-query result (stat-card):', statCardOr);
    console.log('  serviceStatus=active:',       svcActive);
    console.log('  legacy (svc missing + stat):', legacy);
    console.log('  stat_card == table_active:',  statCardOr === tableActive);
    console.log('  mismatch:',                  mismatch, '(status=act, serviceStatus!=act)');

    return statCardOr;
  })
  .then(() => mongoose.disconnect())
  .catch(err => { console.error(err); process.exit(1); });
