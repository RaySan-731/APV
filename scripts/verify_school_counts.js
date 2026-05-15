const mongoose = require('mongoose');
const path = require('path');
const School = require(path.resolve(__dirname, '..', 'models', 'School'));

mongoose.connect('mongodb://localhost:27017/apv-ventures')
  .then(async () => {
    const db = mongoose.connection.db;

    // 1. Raw counts
    const total        = await db.collection('schools').countDocuments();
    const svcActive    = await db.collection('schools').countDocuments({ serviceStatus: 'active' });
    const stat         = await db.collection('schools').countDocuments({ status: 'active' });
    const both         = await db.collection('schools').countDocuments({ status: 'active', serviceStatus: 'active' });
    const mismatch     = await db.collection('schools').countDocuments({ status: 'active', serviceStatus: { $ne: 'active' } });
    const noSvcAtActive= await db.collection('schools').countDocuments({ serviceStatus: { $exists: false }, status: 'active' });

    // 2. Stat-card $or query
    const qOr = { $or: [
      { serviceStatus: 'active' },
      { serviceStatus: { $exists: false }, status: 'active' }
    ]};
    const statCardOr   = await db.collection('schools').countDocuments(qOr);

    // 3. What the table JS does per-row
    const all = await db.collection('schools').find({}).project({ status: 1, serviceStatus: 1 }).toArray();
    const tableActive  = all.filter(s => (s.serviceStatus || s.status || 'active') === 'active').length;
    const tableOnHold  = all.filter(s => (s.serviceStatus || s.status) === 'on_hold').length;
    const tableChurned = all.filter(s => (s.serviceStatus) === 'churned').length;

    console.log('\nDB: apv-ventures');
    console.log(`  total schools:                 ${total}`);
    console.log(`  status='active':               ${stat}`);
    console.log(`  serviceStatus='active':        ${svcActive}`);
    console.log(`  both active:                   ${both}`);
    console.log(`  mismatch (stat=act,svc!=act):  ${mismatch}`);
    console.log(`  legacy only (no svc + stat=act):${noSvcAtActive}`);
    console.log('\nStat-card alignment');
    console.log(`  OR-query (stat-card):          ${statCardOr}`);
    console.log(`  table "active" rows:            ${tableActive}`);
    console.log(`  table "on_hold" rows:           ${tableOnHold}`);
    console.log(`  table "churned" rows:           ${tableChurned}`);
    console.log(`\n  stat-card == table "active":   ${statCardOr === tableActive}`);

    return { statCardOr, tableActive, mismatch };
  })
  .then(() => mongoose.disconnect())
  .catch(err => { console.error(err); process.exit(1); });
