// Quick test: render school_students.ejs with sample data
const path = require('path');
const ejs = require('ejs');

const data = {
  user: { name: 'Test Admin', role: 'school_admin' },
  school: { name: 'Test School', serviceStatus: 'active' },
  groups: [],
  students: [],
  trainers: [],
  schoolId: '507f1f77bcf86cd799439011',
  page: 'school_students',
  cspNonce: 'test-nonce'
};

ejs.renderFile(
  path.join(__dirname, 'views/school_students.ejs'),
  data,
  (err, html) => {
    if (err) {
      console.error('EJS Error:', err.message);
      console.error('Stack:', err.stack);
    } else {
      console.log('Render succeeded, output length:', html.length);
    }
  }
);
