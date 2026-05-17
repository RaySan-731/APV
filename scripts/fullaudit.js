// Full audit script - clean version
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const rootDir = path.resolve(__dirname, '..');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures').then(async () => {
  const db = mongoose.connection.db;
  const Event = require(path.join(rootDir, 'models', 'Event'));

  const schoolId = '69ca12f2b41b762312ef9185';
  const eventId  = '69f1ff430189efca99371c24';

  // ---- Count of 'Team building Parents' ----
  const tbCount = await db.collection('events').countDocuments({ name: 'Team building Parents' });
  console.log('=== "Team building Parents" events in DBX:', tbCount);

  // ---- Type inspection ----
  const doc = await db.collection('events').findOne({ _id: new mongoose.Types.ObjectId(eventId) });
  console.log('Date id type:', doc?._id?.constructor?.name);
  console.log('targetSchools[0].schoolId type:', doc?.targetSchools?.[0]?.schoolId?.constructor?.name);

  // ---- Mongoose find result (POST handler simulation) ----
  const mongooseEvQuery = await Event.find({
    _id: eventId,
    'targetSchools.schoolId': schoolId,
    status: { $in: ['published','scheduled','confirmed','in_progress','completed'] }
  }).lean();
  console.log('\n=== Mongoose Event.find result:', mongooseEvQuery.length === 1
    ? `FOUND: "${mongooseEvQuery[0].name}" (status=${mongooseEvQuery[0].status})`
    : 'NOT FOUND');

  if (mongooseEvQuery.length === 1) {
    const e = mongooseEvQuery[0];
    const ratePerStudent = 0;
    const schoolStudentCount = 2;
    const eventQuantity =
      (e.review?.actualAttendeeCount || e.review?.actualParticipantCount || e.review?.actualScoutCount)
      || e.estimatedScoutCount
      || schoolStudentCount
      || 0;
    const rate = (e.costPerParticipant > 0 ? e.costPerParticipant : (ratePerStudent > 0 ? ratePerStudent : 0));

    console.log(`\n  eventQuantity=${eventQuantity} (from estimatedScoutCount=${e.estimatedScoutCount})`);
    console.log(`  rate=${rate} (from costPerParticipant=${e.costPerParticipant})`);
    console.log(eventQuantity > 0 && rate > 0
      ? `\n  PASS: ${rate} x ${eventQuantity} = ${rate * eventQuantity}`
      : '\n  FAIL');
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
