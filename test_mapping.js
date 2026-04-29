const mongoose = require('mongoose');
const School = require('./models/School');
const Staff = require('./models/Staff');
const User = require('./models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function testMapping() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  // Fetch one school that has assignedStaff (including ones with User IDs)
  const school = await School.findOne({ assignedStaff: { $exists: true, $ne: [] } });
  if (!school) {
    console.log('No school with assignedStaff found');
    process.exit(0);
  }
  console.log('School:', school.name);
  console.log('AssignedStaff IDs:', school.assignedStaff.map(String));

  const assignedIds = school.assignedStaff.map(String);
  const [staffList, userList] = await Promise.all([
    Staff.find({ _id: { $in: assignedIds } }).select('name email idNumber status').lean(),
    User.find({ _id: { $in: assignedIds } }).select('name email role').lean()
  ]);

  console.log('\nStaff found:', staffList.length);
  staffList.forEach(s => console.log(`  Staff: ${s.name} (${s._id})`));
  console.log('Users found:', userList.length);
  userList.forEach(u => console.log(`  User: ${u.name} (${u._id})`));

  const trainerMap = new Map();
  staffList.forEach(t => trainerMap.set(t._id.toString(), { ...t, __entity: 'staff' }));
  userList.forEach(u => trainerMap.set(u._id.toString(), { ...u, __entity: 'user' }));

  const mapped = school.assignedStaff.map(id => trainerMap.get(id.toString())).filter(Boolean);
  console.log('\nMapped trainer objects:', mapped.length);
  mapped.forEach(m => console.log(`  ${m.name} (${m.__entity})`));

  process.exit(0);
}

testMapping();
