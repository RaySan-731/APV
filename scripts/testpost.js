// Intercept the actual POST body to reproduce the exact issue
const http = require('http');

const postData = 'schoolId=69ca12f2b41b762312ef9185&invoiceType=event&relatedEvents=69f1ff430189efca99371c24&issueDate=2026-05-16&dueDate=2026-06-15&currency=KES&notes=&terms=';

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/finance/invoices/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'Cookie': 'connect.sid=s%3Adev-admin-session'  // dummy — will likely fail auth; just to see body parsing
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS:`, JSON.stringify(res.headers));
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(`BODY: ${body}`));
});

req.on('error', e => console.error('ERROR:', e.message));
req.write(postData);
req.end();
