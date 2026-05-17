const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures').then(async () => {
  const School = require(path.join(rootDir, 'models', 'School'));
  const Event  = require(path.join(rootDir, 'models', 'Event'));

  const schoolId = '69ca12f2b41b762312ef9185'; // Green Pastures Academy
  const eventId  = '69f1ff430189efca99371c24';  // Team building Parents

  const [school, events] = await Promise.all([
    School.findById(schoolId).lean(),
    Event.find({
      _id: eventId,
      'targetSchools.schoolId': schoolId,
      status: { $in: ['published','scheduled','confirmed','in_progress','completed'] }
    }).lean()
  ]);

  console.log('=== School ===');
  console.log('name:', school.name);
  console.log('studentCount:', school.studentCount, typeof school.studentCount);
  console.log('paymentTerms:', JSON.stringify(school.paymentTerms));

  console.log('\n=== Events ===');
  console.log('Returned:', events.length);
  events.forEach(e => {
    console.log(`"${e.name}"`);
    console.log(`  status: "${e.status}"`);
    console.log(`  costPerParticipant: ${e.costPerParticipant}`);
    console.log(`  estimatedScoutCount: ${e.estimatedScoutCount}`);
    console.log(`  targetSchools:`, JSON.stringify(e.targetSchools.map(t => t.schoolId?.toString())));
  });

  // Simulate exact form POST data as Express parses it
  const relatedEvents = ['69f1ff430189efca99371c24'];
  const ratePerStudent = school.paymentTerms?.ratePerStudent || 0;
  const schoolStudentCount = school.studentCount || 0;

  console.log('\n=== POST simulation ===');
  console.log('invoiceType: "event"');
  console.log('relatedEvents:', JSON.stringify(relatedEvents));
  console.log('ratePerStudent =', ratePerStudent);
  console.log('schoolStudentCount =', schoolStudentCount);

  for (const event of events) {
    const eventQuantity =
      (event.review?.actualAttendeeCount || event.review?.actualParticipantCount || event.review?.actualScoutCount)
      || event.estimatedScoutCount
      || schoolStudentCount
      || 0;

    const rate = (event.costPerParticipant > 0 ? event.costPerParticipant : (ratePerStudent > 0 ? ratePerStudent : 0));

    console.log(`\n"${event.name}":`);
    console.log(`  eventQuantity = ${eventQuantity}  (est=${event.estimatedScoutCount}, schCount=${schoolStudentCount})`);
    console.log(`  rate = ${rate}  (costPP=${event.costPerParticipant}, rPS=${ratePerStudent})`);

    if (eventQuantity > 0 && rate > 0) {
      console.log(`  ✓ BILLABLE: ${rate} × ${eventQuantity} = ${rate * eventQuantity}`);
    } else {
      const reasons = [];
      if (eventQuantity <= 0) reasons.push('quantity=0');
      if (rate <= 0) reasons.push('rate=0');
      console.log(`  ✗ FAILS: ${reasons.join(', ')}`);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
