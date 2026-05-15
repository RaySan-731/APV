const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/apv-ventures')
  .then(async () => {
    const db = mongoose.connection.db;
    const total        = await db.collection('schools').countDocuments();
    const activeSvc    = await db.collection('schools').countDocuments({ serviceStatus: 'active' });
    const activeStat   = await db.collection('schools').countDocuments({ status: 'active' });
    const mismatch     = await db.collection('schools').countDocuments({ status: 'active', serviceStatus: { $ne: 'active' } });
    const bothActive   = await db.collection('schools').countDocuments({ status: 'active', serviceStatus: 'active' });
    const legacy       = await db.collection('schools').countDocuments({ serviceStatus: { $exists: false }, status: 'active' });

    console.log(`\n=== School counts (DB: apv-ventures) ===`);
    console.log(`  total schools:              ${total}`);
    console.log(`  serviceStatus === 'active':  ${activeSvc}`);
    console.log(`  status === 'active':         ${activeStat}`);
    console.log(`  BOTH active (status + svc):  ${bothActive}`);
    console.log(`  legacy (no serviceStatus):   ${legacy}`);
    console.log(`  mismatch (stat=act,svc!=act): ${mismatch}`);
    console.log(`\n  $or count from stat-card:    ${activeSvc + legacy}`);

    // Show schools that are 'active' by status but NOT 'active' by serviceStatus
    const rows = await db.collection('schools').find(
      { status: 'active', serviceStatus: { $ne: 'active' } },
      { projection: { _id: 1, name: 1, status: 1, serviceStatus: 1 } }
    ).toArray();
    if (rows.length) {
      console.log('\n  Schools counted by status but NOT serviceStatus:');
      rows.forEach(r => console.log(`    ${r.name}: status=${r.status}, serviceStatus=${r.serviceStatus}`));
    }

    await mongoose.disconnect();
  })
  .catch(console.error);
