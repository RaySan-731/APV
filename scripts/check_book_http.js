const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/book',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  console.log('STATUS', res.statusCode);
  res.on('data', () => {});
  res.on('end', () => process.exit(0));
});

req.on('error', (e) => {
  console.error('ERR', e.message);
  process.exit(1);
});

req.end();
