const mongoose = require('mongoose');
const path = require('path');

// Models - seed script is in scripts folder, models are in parent
const Staff = require(path.join(__dirname, '..', 'models', 'Staff'));
const School = require(path.join(__dirname, '..', 'models', 'School'));
const Student = require(path.join(__dirname, '..', 'models', 'Student'));

async function seedData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apv_ventures';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // 1. Find or create school "Green Pastures Academy"
    let school = await School.findOne({ name: 'Green Pastures Academy' });
    if (!school) {
      school = new School({
        name: 'Green Pastures Academy',
        address: { street: '123 Pasture Lane', city: 'Nairobi', country: 'Kenya' },
        contactPerson: 'Grace Mwangi',
        contactEmail: 'grace.mwangi@greenpastures.ac.ke',
        contactPhone: '+254 700 000 000',
        status: 'active',
        region: 'Nairobi'
      });
      await school.save();
      console.log('✅ Created school: Green Pastures Academy');
    } else {
      console.log('✅ Found school: Green Pastures Academy');
    }

    // 2. Find or create trainer "Grace Mwangi"
    let trainer = await Staff.findOne({ name: 'Grace Mwangi', role: 'trainer' });
    if (!trainer) {
      trainer = new Staff({
        name: 'Grace Mwangi',
        email: 'grace.mwangi@apv.scoutmate.com',
        role: 'trainer',
        status: 'Active',
        department: 'Training',
        phone: '+254 712 345 678',
        zones: ['Nairobi'],
        assignedSchools: [{
          schoolId: school._id,
          assignmentType: 'primary',
          assignedDate: new Date(),
          status: 'active'
        }],
        performanceMetrics: {
          eventsCompleted: 0,
          reportsSubmitted: 0,
          schoolsVisited: 1,
          averageAttendanceRate: 0,
          averageFeedbackRating: 0
        }
      });
      await trainer.save();
      console.log('✅ Created trainer: Grace Mwangi');
    } else {
      // Ensure school is assigned
      const alreadyAssigned = trainer.assignedSchools?.some(a => a.schoolId?.toString() === school._id.toString());
      if (!alreadyAssigned) {
        trainer.assignedSchools = trainer.assignedSchools || [];
        trainer.assignedSchools.push({
          schoolId: school._id,
          assignmentType: 'primary',
          assignedDate: new Date(),
          status: 'active'
        });
        await trainer.save();
        console.log('✅ Assigned Green Pastures Academy to Grace Mwangi');
      } else {
        console.log('✅ Trainer already assigned to this school');
      }
      console.log('✅ Found trainer: Grace Mwangi');
    }

    // 3. Parse and add students
    const fs = require('fs');
    const rawData = fs.readFileSync(__filename, 'utf8');
    const match = rawData.match(/const studentsData = (\[[\s\S]*?\]);/);
    if (!match) {
      console.error('❌ Could not find studentsData in script');
      process.exit(1);
    }
    const studentsData = eval(match[1]);

    let addedCount = 0;
    for (const s of studentsData) {
      // Parse date mm/dd/yyyy
      const [month, day, year] = s.date_of_birth.split('/');
      const dob = new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`);

      const existing = await Student.findOne({ fullName: s.full_name, school: school._id });
      if (existing) {
        console.log(`  ↳ ${s.full_name} already exists, skipping`);
        continue;
      }

      const student = new Student({
        fullName: s.full_name,
        dateOfBirth: dob,
        gender: s.gender,
        parentContact: {
          name: s.parent_guardian_name,
          phone: s.phone_number,
          email: s.email_address,
          relationship: 'Parent'
        },
        scoutSection: s.scout_section,
        school: school._id,
        addedBy: {
          trainerId: trainer._id
        },
        status: 'active'
      });

      await student.save();
      addedCount++;
      console.log(`  ✅ ${s.full_name} (${s.scout_section})`);
    }

    console.log(`\n✅ Completed! Added ${addedCount} new students to ${school.name} under trainer ${trainer.name}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Students data (100 entries)
const studentsData = [
  {"full_name":"Kevin Robinson","date_of_birth":"03/10/2020","gender":"Male","parent_guardian_name":"Linda Williams","phone_number":"(992) 131-1789","email_address":"kevin.robinson71@example.com","scout_section":"Chipukizi"},
  {"full_name":"Tina Smith","date_of_birth":"01/31/2011","gender":"Female","parent_guardian_name":"Barbara Moore","phone_number":"(335) 232-5077","email_address":"tina.smith72@service.org","scout_section":"Mwamba"},
  {"full_name":"Michael Williams","date_of_birth":"12/13/2019","gender":"Other","parent_guardian_name":"Charles Wilson","phone_number":"(852) 652-3980","email_address":"michael.williams14@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Charlie Davis","date_of_birth":"04/12/2011","gender":"Male","parent_guardian_name":"Robert Smith","phone_number":"(258) 295-5475","email_address":"charlie.davis15@service.org","scout_section":"Mwamba"},
  {"full_name":"Julia White","date_of_birth":"02/06/2017","gender":"Other","parent_guardian_name":"Richard Wilson","phone_number":"(770) 348-6939","email_address":"julia.white31@service.org","scout_section":"Sungura"},
  {"full_name":"Penelope Smith","date_of_birth":"11/08/2015","gender":"Female","parent_guardian_name":"Richard Moore","phone_number":"(261) 995-5685","email_address":"penelope.smith56@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Ivan Wilson","date_of_birth":"07/28/2007","gender":"Female","parent_guardian_name":"Robert Smith","phone_number":"(132) 691-7958","email_address":"ivan.wilson34@mail.com","scout_section":"Mwamba"},
  {"full_name":"Laura Robinson","date_of_birth":"04/03/2016","gender":"Female","parent_guardian_name":"William Davis","phone_number":"(931) 418-8131","email_address":"laura.robinson62@mail.com","scout_section":"Mwamba"},
  {"full_name":"Sam Thompson","date_of_birth":"09/17/2018","gender":"Female","parent_guardian_name":"Robert Smith","phone_number":"(839) 419-7510","email_address":"sam.thompson56@mail.com","scout_section":"Mwamba"},
  {"full_name":"Sam Thompson","date_of_birth":"02/06/2011","gender":"Male","parent_guardian_name":"Richard Smith","phone_number":"(609) 725-2318","email_address":"sam.thompson68@mail.com","scout_section":"Mwamba"},
  {"full_name":"Ethan Wilson","date_of_birth":"04/30/2009","gender":"Female","parent_guardian_name":"Mary Jones","phone_number":"(959) 993-5102","email_address":"ethan.wilson22@domain.net","scout_section":"Mwamba"},
  {"full_name":"Alice Thomas","date_of_birth":"07/14/2013","gender":"Male","parent_guardian_name":"Patricia Wilson","phone_number":"(500) 679-6246","email_address":"alice.thomas68@example.com","scout_section":"Mwamba"},
  {"full_name":"Alice Clark","date_of_birth":"11/06/2015","gender":"Male","parent_guardian_name":"William Davis","phone_number":"(414) 265-7024","email_address":"alice.clark8@domain.net","scout_section":"Sungura"},
  {"full_name":"Rachel Thompson","date_of_birth":"05/16/2008","gender":"Female","parent_guardian_name":"Barbara Williams","phone_number":"(861) 564-2092","email_address":"rachel.thompson61@mail.com","scout_section":"Mwamba"},
  {"full_name":"Ethan Moore","date_of_birth":"07/23/2018","gender":"Female","parent_guardian_name":"Robert Wilson","phone_number":"(963) 789-8309","email_address":"ethan.moore13@domain.net","scout_section":"Sungura"},
  {"full_name":"Diana Miller","date_of_birth":"11/02/2014","gender":"Male","parent_guardian_name":"Charles Davis","phone_number":"(471) 592-3341","email_address":"diana.miller13@service.org","scout_section":"Chipukizi"},
  {"full_name":"Charlie Thomas","date_of_birth":"09/19/2013","gender":"Male","parent_guardian_name":"Charles Jones","phone_number":"(493) 918-1413","email_address":"charlie.thomas42@mail.com","scout_section":"Sungura"},
  {"full_name":"Kevin Taylor","date_of_birth":"11/25/2015","gender":"Female","parent_guardian_name":"Richard Jones","phone_number":"(157) 450-7719","email_address":"kevin.taylor76@domain.net","scout_section":"Mwamba"},
  {"full_name":"Diana Taylor","date_of_birth":"11/22/2012","gender":"Female","parent_guardian_name":"Charles Williams","phone_number":"(354) 815-1590","email_address":"diana.taylor8@mail.com","scout_section":"Sungura"},
  {"full_name":"Quinn White","date_of_birth":"05/19/2015","gender":"Male","parent_guardian_name":"Patricia Smith","phone_number":"(601) 119-7642","email_address":"quinn.white44@mail.com","scout_section":"Sungura"},
  {"full_name":"Ivan Anderson","date_of_birth":"06/03/2011","gender":"Male","parent_guardian_name":"Jane Taylor","phone_number":"(619) 146-3998","email_address":"ivan.anderson95@service.org","scout_section":"Chipukizi"},
  {"full_name":"Hannah Clark","date_of_birth":"06/28/2009","gender":"Other","parent_guardian_name":"Jane Williams","phone_number":"(942) 282-5727","email_address":"hannah.clark36@domain.net","scout_section":"Sungura"},
  {"full_name":"Oliver White","date_of_birth":"09/23/2015","gender":"Male","parent_guardian_name":"Robert Anderson","phone_number":"(107) 715-6961","email_address":"oliver.white14@mail.com","scout_section":"Chipukizi"},
  {"full_name":"Alice Taylor","date_of_birth":"11/18/2019","gender":"Female","parent_guardian_name":"Charles Brown","phone_number":"(991) 204-3751","email_address":"alice.taylor11@example.com","scout_section":"Mwamba"},
  {"full_name":"Julia White","date_of_birth":"09/03/2019","gender":"Other","parent_guardian_name":"Barbara Jones","phone_number":"(102) 806-6329","email_address":"julia.white21@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Laura Anderson","date_of_birth":"01/08/2011","gender":"Male","parent_guardian_name":"Jane Jones","phone_number":"(635) 552-7335","email_address":"laura.anderson95@mail.com","scout_section":"Chipukizi"},
  {"full_name":"Diana Taylor","date_of_birth":"01/26/2011","gender":"Female","parent_guardian_name":"Richard Williams","phone_number":"(100) 249-2251","email_address":"diana.taylor51@example.com","scout_section":"Mwamba"},
  {"full_name":"Quinn Jones","date_of_birth":"07/13/2010","gender":"Female","parent_guardian_name":"William Anderson","phone_number":"(706) 264-9694","email_address":"quinn.jones24@example.com","scout_section":"Chipukizi"},
  {"full_name":"Nora Wilson","date_of_birth":"06/13/2010","gender":"Other","parent_guardian_name":"Linda Anderson","phone_number":"(914) 327-6697","email_address":"nora.wilson52@mail.com","scout_section":"Mwamba"},
  {"full_name":"Quinn Martin","date_of_birth":"10/21/2010","gender":"Male","parent_guardian_name":"Patricia Williams","phone_number":"(225) 699-9584","email_address":"quinn.martin11@mail.com","scout_section":"Sungura"},
  {"full_name":"Penelope Moore","date_of_birth":"09/17/2016","gender":"Male","parent_guardian_name":"William Brown","phone_number":"(295) 662-4532","email_address":"penelope.moore66@example.com","scout_section":"Sungura"},
  {"full_name":"Michael Martinez","date_of_birth":"12/05/2007","gender":"Other","parent_guardian_name":"John Davis","phone_number":"(404) 781-5021","email_address":"michael.martinez4@mail.com","scout_section":"Sungura"},
  {"full_name":"Penelope Garcia","date_of_birth":"05/14/2011","gender":"Male","parent_guardian_name":"Mary Smith","phone_number":"(995) 575-5948","email_address":"penelope.garcia36@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Laura Jackson","date_of_birth":"12/21/2015","gender":"Female","parent_guardian_name":"Mary Taylor","phone_number":"(718) 560-1992","email_address":"laura.jackson90@domain.net","scout_section":"Sungura"},
  {"full_name":"Diana Thomas","date_of_birth":"07/19/2011","gender":"Female","parent_guardian_name":"John Taylor","phone_number":"(543) 696-3184","email_address":"diana.thomas72@example.com","scout_section":"Mwamba"},
  {"full_name":"Sam Harris","date_of_birth":"03/16/2018","gender":"Male","parent_guardian_name":"John Miller","phone_number":"(870) 388-9411","email_address":"sam.harris68@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Rachel Brown","date_of_birth":"05/01/2017","gender":"Female","parent_guardian_name":"Jane Williams","phone_number":"(250) 232-4209","email_address":"rachel.brown26@example.com","scout_section":"Mwamba"},
  {"full_name":"Charlie Moore","date_of_birth":"11/05/2013","gender":"Male","parent_guardian_name":"Jane Wilson","phone_number":"(831) 116-9643","email_address":"charlie.moore26@mail.com","scout_section":"Chipukizi"},
  {"full_name":"Alice Thompson","date_of_birth":"10/08/2009","gender":"Female","parent_guardian_name":"Mary Miller","phone_number":"(193) 973-6499","email_address":"alice.thompson62@domain.net","scout_section":"Sungura"},
  {"full_name":"Sam Davis","date_of_birth":"12/26/2019","gender":"Female","parent_guardian_name":"Mary Brown","phone_number":"(995) 299-9748","email_address":"sam.davis78@example.com","scout_section":"Chipukizi"},
  {"full_name":"Quinn Robinson","date_of_birth":"12/08/2012","gender":"Female","parent_guardian_name":"William Williams","phone_number":"(499) 376-9593","email_address":"quinn.robinson56@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Quinn Jackson","date_of_birth":"08/07/2009","gender":"Male","parent_guardian_name":"Linda Jones","phone_number":"(911) 122-1729","email_address":"quinn.jackson36@mail.com","scout_section":"Sungura"},
  {"full_name":"Rachel Wilson","date_of_birth":"08/11/2017","gender":"Male","parent_guardian_name":"Richard Taylor","phone_number":"(376) 626-5289","email_address":"rachel.wilson24@domain.net","scout_section":"Sungura"},
  {"full_name":"Ivan Miller","date_of_birth":"04/05/2008","gender":"Male","parent_guardian_name":"Linda Jones","phone_number":"(114) 258-9694","email_address":"ivan.miller10@service.org","scout_section":"Mwamba"},
  {"full_name":"Julia Thomas","date_of_birth":"04/18/2016","gender":"Female","parent_guardian_name":"Mary Jones","phone_number":"(193) 324-6000","email_address":"julia.thomas43@mail.com","scout_section":"Chipukizi"},
  {"full_name":"Penelope Anderson","date_of_birth":"01/25/2019","gender":"Male","parent_guardian_name":"Barbara Anderson","phone_number":"(133) 958-2695","email_address":"penelope.anderson86@example.com","scout_section":"Chipukizi"},
  {"full_name":"Nora Wilson","date_of_birth":"05/16/2018","gender":"Female","parent_guardian_name":"Richard Jones","phone_number":"(804) 675-3149","email_address":"nora.wilson99@example.com","scout_section":"Mwamba"},
  {"full_name":"Bob Robinson","date_of_birth":"05/05/2017","gender":"Female","parent_guardian_name":"Barbara Miller","phone_number":"(987) 756-5614","email_address":"bob.robinson73@domain.net","scout_section":"Mwamba"},
  {"full_name":"Michael Martin","date_of_birth":"03/25/2017","gender":"Female","parent_guardian_name":"John Williams","phone_number":"(925) 722-7501","email_address":"michael.martin32@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Charlie Brown","date_of_birth":"05/28/2014","gender":"Male","parent_guardian_name":"Mary Miller","phone_number":"(991) 698-6563","email_address":"charlie.brown7@mail.com","scout_section":"Mwamba"},
  {"full_name":"Ethan Smith","date_of_birth":"02/28/2009","gender":"Female","parent_guardian_name":"William Jones","phone_number":"(705) 611-9327","email_address":"ethan.smith30@domain.net","scout_section":"Sungura"},
  {"full_name":"Rachel White","date_of_birth":"05/09/2017","gender":"Male","parent_guardian_name":"Jane Davis","phone_number":"(384) 553-2614","email_address":"rachel.white28@domain.net","scout_section":"Sungura"},
  {"full_name":"Michael Thomas","date_of_birth":"03/12/2014","gender":"Male","parent_guardian_name":"Mary Wilson","phone_number":"(184) 943-1187","email_address":"michael.thomas56@service.org","scout_section":"Mwamba"},
  {"full_name":"Tina Miller","date_of_birth":"08/22/2017","gender":"Male","parent_guardian_name":"John Moore","phone_number":"(249) 444-6683","email_address":"tina.miller55@mail.com","scout_section":"Sungura"},
  {"full_name":"Laura Taylor","date_of_birth":"06/21/2007","gender":"Other","parent_guardian_name":"Mary Brown","phone_number":"(499) 658-3609","email_address":"laura.taylor29@mail.com","scout_section":"Chipukizi"},
  {"full_name":"Alice Martin","date_of_birth":"09/22/2017","gender":"Female","parent_guardian_name":"John Smith","phone_number":"(516) 381-5704","email_address":"alice.martin5@service.org","scout_section":"Sungura"},
  {"full_name":"Charlie Martin","date_of_birth":"03/02/2013","gender":"Male","parent_guardian_name":"Patricia Wilson","phone_number":"(854) 971-1300","email_address":"charlie.martin77@service.org","scout_section":"Chipukizi"},
  {"full_name":"Ivan Davis","date_of_birth":"10/15/2011","gender":"Female","parent_guardian_name":"John Wilson","phone_number":"(119) 927-4749","email_address":"ivan.davis65@example.com","scout_section":"Sungura"},
  {"full_name":"Rachel Anderson","date_of_birth":"10/11/2013","gender":"Male","parent_guardian_name":"Richard Williams","phone_number":"(976) 814-4590","email_address":"rachel.anderson5@service.org","scout_section":"Sungura"},
  {"full_name":"Ethan Garcia","date_of_birth":"01/07/2008","gender":"Other","parent_guardian_name":"Linda Jones","phone_number":"(198) 742-2811","email_address":"ethan.garcia35@service.org","scout_section":"Sungura"},
  {"full_name":"Diana Thomas","date_of_birth":"01/18/2016","gender":"Male","parent_guardian_name":"Richard Smith","phone_number":"(163) 431-9671","email_address":"diana.thomas33@service.org","scout_section":"Sungura"},
  {"full_name":"Ivan Taylor","date_of_birth":"11/08/2012","gender":"Other","parent_guardian_name":"Barbara Miller","phone_number":"(252) 614-5885","email_address":"ivan.taylor25@example.com","scout_section":"Chipukizi"},
  {"full_name":"Hannah Williams","date_of_birth":"05/26/2017","gender":"Male","parent_guardian_name":"John Anderson","phone_number":"(448) 883-5525","email_address":"hannah.williams17@example.com","scout_section":"Mwamba"},
  {"full_name":"Nora Garcia","date_of_birth":"06/25/2017","gender":"Male","parent_guardian_name":"Robert Williams","phone_number":"(492) 669-8509","email_address":"nora.garcia41@service.org","scout_section":"Sungura"},
  {"full_name":"Bob Moore","date_of_birth":"07/23/2010","gender":"Male","parent_guardian_name":"John Taylor","phone_number":"(212) 416-4372","email_address":"bob.moore23@mail.com","scout_section":"Sungura"},
  {"full_name":"Fiona Garcia","date_of_birth":"01/22/2011","gender":"Male","parent_guardian_name":"Charles Williams","phone_number":"(705) 624-5924","email_address":"fiona.garcia54@domain.net","scout_section":"Sungura"},
  {"full_name":"Penelope Thompson","date_of_birth":"07/04/2010","gender":"Male","parent_guardian_name":"Linda Anderson","phone_number":"(900) 684-2244","email_address":"penelope.thompson67@example.com","scout_section":"Sungura"},
  {"full_name":"George Williams","date_of_birth":"10/20/2018","gender":"Male","parent_guardian_name":"Mary Davis","phone_number":"(550) 929-5911","email_address":"george.williams52@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Ivan Jones","date_of_birth":"06/26/2011","gender":"Male","parent_guardian_name":"John Smith","phone_number":"(817) 504-4544","email_address":"ivan.jones41@service.org","scout_section":"Mwamba"},
  {"full_name":"Hannah Williams","date_of_birth":"07/03/2013","gender":"Male","parent_guardian_name":"Linda Smith","phone_number":"(589) 251-9093","email_address":"hannah.williams98@mail.com","scout_section":"Sungura"},
  {"full_name":"Ethan White","date_of_birth":"06/26/2008","gender":"Female","parent_guardian_name":"Mary Moore","phone_number":"(224) 454-5180","email_address":"ethan.white85@domain.net","scout_section":"Mwamba"},
  {"full_name":"Nora Harris","date_of_birth":"02/24/2011","gender":"Female","parent_guardian_name":"Jane Brown","phone_number":"(874) 627-4349","email_address":"nora.harris12@domain.net","scout_section":"Sungura"},
  {"full_name":"Penelope Taylor","date_of_birth":"04/11/2019","gender":"Male","parent_guardian_name":"Richard Anderson","phone_number":"(598) 478-4971","email_address":"penelope.taylor71@example.com","scout_section":"Chipukizi"},
  {"full_name":"Hannah Jackson","date_of_birth":"05/10/2015","gender":"Other","parent_guardian_name":"Richard Moore","phone_number":"(757) 635-4595","email_address":"hannah.jackson32@mail.com","scout_section":"Sungura"},
  {"full_name":"Bob Jones","date_of_birth":"07/24/2016","gender":"Female","parent_guardian_name":"John Jones","phone_number":"(421) 510-2869","email_address":"bob.jones40@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Laura Harris","date_of_birth":"02/04/2010","gender":"Female","parent_guardian_name":"Charles Brown","phone_number":"(719) 518-4072","email_address":"laura.harris45@service.org","scout_section":"Chipukizi"},
  {"full_name":"Alice Jones","date_of_birth":"06/03/2009","gender":"Female","parent_guardian_name":"Jane Wilson","phone_number":"(601) 360-4943","email_address":"alice.jones58@service.org","scout_section":"Mwamba"},
  {"full_name":"Tina White","date_of_birth":"01/17/2008","gender":"Female","parent_guardian_name":"Richard Davis","phone_number":"(390) 174-5454","email_address":"tina.white21@service.org","scout_section":"Sungura"},
  {"full_name":"Michael White","date_of_birth":"06/10/2011","gender":"Other","parent_guardian_name":"Richard Smith","phone_number":"(832) 944-4025","email_address":"michael.white87@mail.com","scout_section":"Sungura"},
  {"full_name":"Tina Clark","date_of_birth":"05/19/2011","gender":"Male","parent_guardian_name":"William Williams","phone_number":"(627) 883-9669","email_address":"tina.clark90@domain.net","scout_section":"Mwamba"},
  {"full_name":"Diana Wilson","date_of_birth":"10/02/2013","gender":"Female","parent_guardian_name":"Mary Wilson","phone_number":"(371) 768-9947","email_address":"diana.wilson44@domain.net","scout_section":"Mwamba"},
  {"full_name":"Ivan Moore","date_of_birth":"01/22/2008","gender":"Male","parent_guardian_name":"Jane Jones","phone_number":"(752) 411-4193","email_address":"ivan.moore95@mail.com","scout_section":"Mwamba"},
  {"full_name":"Ivan Taylor","date_of_birth":"08/14/2010","gender":"Female","parent_guardian_name":"Barbara Williams","phone_number":"(265) 638-6885","email_address":"ivan.taylor40@mail.com","scout_section":"Sungura"},
  {"full_name":"Oliver Garcia","date_of_birth":"12/23/2018","gender":"Male","parent_guardian_name":"Linda Davis","phone_number":"(742) 794-7702","email_address":"oliver.garcia42@example.com","scout_section":"Sungura"},
  {"full_name":"Sam Taylor","date_of_birth":"05/01/2019","gender":"Female","parent_guardian_name":"Jane Jones","phone_number":"(321) 951-5541","email_address":"sam.taylor85@domain.net","scout_section":"Sungura"},
  {"full_name":"Kevin Moore","date_of_birth":"05/21/2012","gender":"Other","parent_guardian_name":"Barbara Taylor","phone_number":"(709) 603-3247","email_address":"kevin.moore41@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Oliver Garcia","date_of_birth":"05/01/2009","gender":"Male","parent_guardian_name":"Richard Wilson","phone_number":"(505) 802-9751","email_address":"oliver.garcia99@domain.net","scout_section":"Mwamba"},
  {"full_name":"Charlie Martinez","date_of_birth":"11/18/2015","gender":"Male","parent_guardian_name":"William Anderson","phone_number":"(998) 478-3267","email_address":"charlie.martinez56@mail.com","scout_section":"Sungura"},
  {"full_name":"Oliver Williams","date_of_birth":"08/26/2008","gender":"Female","parent_guardian_name":"William Anderson","phone_number":"(586) 729-2683","email_address":"oliver.williams26@mail.com","scout_section":"Sungura"},
  {"full_name":"Nora Anderson","date_of_birth":"12/26/2015","gender":"Female","parent_guardian_name":"Barbara Davis","phone_number":"(503) 574-4449","email_address":"nora.anderson25@service.org","scout_section":"Chipukizi"},
  {"full_name":"Nora Smith","date_of_birth":"03/09/2018","gender":"Female","parent_guardian_name":"Mary Davis","phone_number":"(698) 136-7661","email_address":"nora.smith21@service.org","scout_section":"Mwamba"},
  {"full_name":"Nora Martin","date_of_birth":"11/01/2011","gender":"Male","parent_guardian_name":"John Taylor","phone_number":"(498) 427-1547","email_address":"nora.martin43@domain.net","scout_section":"Sungura"},
  {"full_name":"Penelope Martinez","date_of_birth":"08/09/2016","gender":"Other","parent_guardian_name":"William Jones","phone_number":"(158) 627-5269","email_address":"penelope.martinez47@example.com","scout_section":"Chipukizi"},
  {"full_name":"Tina Garcia","date_of_birth":"06/14/2015","gender":"Male","parent_guardian_name":"Charles Brown","phone_number":"(702) 504-7211","email_address":"tina.garcia67@mail.com","scout_section":"Sungura"},
  {"full_name":"Rachel Garcia","date_of_birth":"06/08/2014","gender":"Other","parent_guardian_name":"William Anderson","phone_number":"(510) 152-1939","email_address":"rachel.garcia97@example.com","scout_section":"Sungura"},
  {"full_name":"Sam Robinson","date_of_birth":"08/10/2015","gender":"Female","parent_guardian_name":"Barbara Smith","phone_number":"(379) 375-6890","email_address":"sam.robinson98@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Fiona Robinson","date_of_birth":"05/07/2011","gender":"Female","parent_guardian_name":"Linda Davis","phone_number":"(304) 505-3810","email_address":"fiona.robinson23@service.org","scout_section":"Sungura"},
  {"full_name":"Alice Thomas","date_of_birth":"11/04/2018","gender":"Male","parent_guardian_name":"Barbara Smith","phone_number":"(296) 657-8431","email_address":"alice.thomas78@example.com","scout_section":"Sungura"},
  {"full_name":"Sam Martin","date_of_birth":"08/11/2015","gender":"Female","parent_guardian_name":"Robert Wilson","phone_number":"(783) 104-9070","email_address":"sam.martin80@service.org","scout_section":"Mwamba"},
  {"full_name":"Quinn Anderson","date_of_birth":"12/10/2008","gender":"Female","parent_guardian_name":"Mary Davis","phone_number":"(372) 757-9938","email_address":"quinn.anderson73@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Michael Williams","date_of_birth":"09/28/2019","gender":"Male","parent_guardian_name":"John Anderson","phone_number":"(118) 215-7884","email_address":"michael.williams4@mail.com","scout_section":"Chipukizi"},
  {"full_name":"George Davis","date_of_birth":"12/30/2013","gender":"Male","parent_guardian_name":"Richard Brown","phone_number":"(567) 703-6885","email_address":"george.davis67@example.com","scout_section":"Sungura"},
  {"full_name":"Alice Williams","date_of_birth":"06/20/2007","gender":"Other","parent_guardian_name":"Robert Taylor","phone_number":"(895) 468-6446","email_address":"alice.williams71@domain.net","scout_section":"Mwamba"},
  {"full_name":"Diana White","date_of_birth":"03/04/2019","gender":"Male","parent_guardian_name":"Mary Brown","phone_number":"(320) 820-1128","email_address":"diana.white92@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Ethan Moore","date_of_birth":"10/04/2014","gender":"Female","parent_guardian_name":"Patricia Jones","phone_number":"(880) 653-4122","email_address":"ethan.moore34@example.com","scout_section":"Mwamba"},
  {"full_name":"Charlie White","date_of_birth":"04/03/2020","gender":"Male","parent_guardian_name":"William Anderson","phone_number":"(345) 655-1431","email_address":"charlie.white4@example.com","scout_section":"Chipukizi"},
  {"full_name":"Quinn Garcia","date_of_birth":"07/04/2012","gender":"Female","parent_guardian_name":"Barbara Moore","phone_number":"(375) 129-8817","email_address":"quinn.garcia48@domain.net","scout_section":"Sungura"},
  {"full_name":"Diana Smith","date_of_birth":"10/14/2011","gender":"Female","parent_guardian_name":"William Wilson","phone_number":"(554) 285-9642","email_address":"diana.smith43@example.com","scout_section":"Sungura"},
  {"full_name":"Bob Martinez","date_of_birth":"05/03/2020","gender":"Female","parent_guardian_name":"William Williams","phone_number":"(107) 432-7834","email_address":"bob.martinez38@mail.com","scout_section":"Chipukizi"},
  {"full_name":"Ivan Thompson","date_of_birth":"06/13/2007","gender":"Male","parent_guardian_name":"Jane Taylor","phone_number":"(297) 221-4899","email_address":"ivan.thompson24@service.org","scout_section":"Sungura"},
  {"full_name":"Rachel Martin","date_of_birth":"08/11/2017","gender":"Male","parent_guardian_name":"Robert Anderson","phone_number":"(561) 333-6174","email_address":"rachel.martin85@service.org","scout_section":"Mwamba"},
  {"full_name":"Sam Harris","date_of_birth":"06/23/2009","gender":"Male","parent_guardian_name":"William Anderson","phone_number":"(447) 431-7161","email_address":"sam.harris63@service.org","scout_section":"Sungura"},
  {"full_name":"Diana Miller","date_of_birth":"06/25/2009","gender":"Female","parent_guardian_name":"Linda Williams","phone_number":"(784) 697-8166","email_address":"diana.miller37@service.org","scout_section":"Chipukizi"},
  {"full_name":"Michael Martinez","date_of_birth":"04/20/2015","gender":"Female","parent_guardian_name":"Robert Williams","phone_number":"(377) 667-4438","email_address":"michael.martinez21@domain.net","scout_section":"Sungura"},
  {"full_name":"Hannah Smith","date_of_birth":"07/09/2015","gender":"Male","parent_guardian_name":"Mary Davis","phone_number":"(683) 736-6798","email_address":"hannah.smith37@domain.net","scout_section":"Chipukizi"},
  {"full_name":"Ivan Smith","date_of_birth":"06/21/2017","gender":"Female","parent_guardian_name":"Barbara Brown","phone_number":"(614) 912-5798","email_address":"ivan.smith60@service.org","scout_section":"Chipukizi"},
  {"full_name":"Michael Thompson","date_of_birth":"01/24/2018","gender":"Female","parent_guardian_name":"Linda Miller","phone_number":"(631) 321-1676","email_address":"michael.thompson4@example.com","scout_section":"Sungura"},
  {"full_name":"Tina Thompson","date_of_birth":"01/15/2017","gender":"Male","parent_guardian_name":"Patricia Brown","phone_number":"(113) 381-1309","email_address":"tina.thompson33@mail.com","scout_section":"Sungura"},
  {"full_name":"Julia Davis","date_of_birth":"06/09/2011","gender":"Female","parent_guardian_name":"William Brown","phone_number":"(334) 599-1965","email_address":"julia.davis38@example.com","scout_section":"Mwamba"},
  {"full_name":"Laura Jones","date_of_birth":"07/05/2011","gender":"Female","parent_guardian_name":"Mary Wilson","phone_number":"(679) 790-7163","email_address":"laura.jones39@mail.com","scout_section":"Mwamba"}
];

seedData();