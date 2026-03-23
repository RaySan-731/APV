const fetch = global.fetch || require('node-fetch');

async function testBooking() {
  const form = new URLSearchParams();
  form.append('program', 'Leadership Training');
  form.append('type', 'school');
  form.append('date', '2026-02-15');
  form.append('participants', '30');
  form.append('notes', 'Test booking');

  const res = await fetch('http://127.0.0.1:3001/book/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    redirect: 'manual'
  });
  console.log('Booking POST status:', res.status);
}

testBooking().catch(err => console.error(err));
