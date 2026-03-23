const fetch = global.fetch || require('node-fetch');

async function testLogin(email, password) {
  const res = await fetch('http://127.0.0.1:3001/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  });

  const ok = res.status === 302 || res.status === 303 || res.status === 200;
  console.log(`${email}: status=${res.status} -> ${ok ? 'OK' : 'FAIL'}`);
}

async function run() {
  console.log('Testing logins...');
  await testLogin('founder@scoutacademy.com', 'admin');
  await testLogin('member@example.com', 'password123');
  await testLogin('noone@example.com', 'x');
}

run().catch(err => console.error(err));
