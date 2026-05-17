// Minimal express-based test server to isolate the invoice creation path
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apv-ventures').then(async () => {

  const Invoice = require(path.join(process.cwd(), 'models', 'Invoice'));
  const invoiceController = require(path.join(process.cwd(), 'backend', 'controllers', 'invoiceController'));
  const simulateController = async (overrides = {}) => {
    const School = require(path.join(process.cwd(), 'models', 'School'));
    const school = await School.findById('69ca12f2b41b762312ef9185').lean();

    const req = {
      body: {
        schoolId: '69ca12f2b41b762312ef9185',
        invoiceType: 'event',
        relatedEvents: ['69f1ff430189efca99371c24'],
        ...overrides
      },
      session: { user: { id: 'test-admin' } }
    };

    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = JSON.stringify(data, null, 2); return this; },
      render() { throw new Error('render should not be called'); }
    };

    // Call the handler directly
    await invoiceController.createInvoice(req, res);
    return res.body;
  };

  console.log('── Test 1: standard event POST ──');
  const t1 = await simulateController();
  console.log(t1);

  console.log('\n── Test 2: empty relatedEvents ──');
  const t2 = await simulateController({ relatedEvents: [] });
  console.log(t2);

  console.log('\n── Test 3: empty schoolId ──');
  const t3 = await simulateController({ schoolId: '' });
  console.log(t3);

  console.log('\n── Test 4: missing schoolId ──');
  const t4 = await simulateController({ schoolId: undefined });
  console.log(t4);

  console.log('\n── Test 5: invoiceType "event", empty relatedEvents ──');
  const t5 = await simulateController({ relatedEvents: '' });
  console.log(t5);

  console.log('\n── Test 6: check what school the event targets ──');
  const Event = require(path.join(process.cwd(), 'models', 'Event'));
  const ev = await Event.findById('69f1ff430189efca99371c24').lean();
  const schoolIds = ev.targetSchools.map(t => t.schoolId?.toString());
  console.log('Event targets schools:', schoolIds);
  console.log('Selected school  :', '69ca12f2b41b762312ef9185');
  console.log('Match:', schoolIds.some(id => id === '69ca12f2b41b762312ef9185'));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
