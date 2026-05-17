const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Event = require('./models/Event');
const ServicePackage = require('./models/ServicePackage');
const School = require('./models/School');

const uri = 'mongodb://localhost:27017/apv-ventures';

mongoose.connect(uri).then(async () => {
  // Use the exact same schoolId URL param from the error
  const schoolId = '6a058bb93ca2dbd72a59032f';

  console.log('schoolId.length:', schoolId.length);
  console.log('is Valid ObjectId:', mongoose.Types.ObjectId.isValid(schoolId));

  try {
    // Step 1: Invoice.find
    console.log('\nStep 1: Invoice.find...');
    const billedInvoices = await Invoice.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      status: { $ne: 'cancelled' }
    }).select('relatedEvents servicePackageId').lean();
    console.log('  billedInvoices count:', billedInvoices.length);

    // Step 2: Event.find
    console.log('\nStep 2: Event.find...');
    const invoicedEventIds = billedInvoices.flatMap(i => (i.relatedEvents || []).map(id => id.toString()));
    console.log('  invoicedEventIds:', invoicedEventIds);

    const statusList = ['draft','published','scheduled','confirmed','in_progress','completed','reviewed'];
    const events = await Event.find({
      _id: { $nin: invoicedEventIds },
      'targetSchools.schoolId': new mongoose.Types.ObjectId(schoolId),
      'targetSchools.rsvpStatus': { $ne: 'declined' },
      status: { $in: statusList }
    }).select('_id name startDate status costPerParticipant estimatedScoutCount targetSchools').lean();
    console.log('  events:', events.length);

    // Step 3: ServicePackage.find
    console.log('\nStep 3: ServicePackage.find...');
    const packages = await ServicePackage.find({ isActive: true }).select('_id displayName pricingModel').lean();
    console.log('  packages:', packages.length);

    console.log('\nWould return 200');
  } catch (err) {
    console.error('\nERROR at step:', err.message);
    console.error(err.stack);
  }

  mongoose.disconnect();
}).catch(err => console.error(err));
