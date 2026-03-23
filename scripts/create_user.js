const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usersPath = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  if (!fs.existsSync(usersPath)) return [];
  try {
    const raw = fs.readFileSync(usersPath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Failed to read users.json:', err.message);
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

async function createUser(email, password, name = 'Member', role = 'rover') {
  if (!email || !password) {
    console.error('Usage: node create_user.js <email> <password> [name] [role]');
    process.exit(1);
  }

  const users = loadUsers();
  const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    console.error('User already exists:', email);
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  const user = {
    email: email.toLowerCase(),
    password: hash,
    name,
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);
  console.log('User created:', email);
}

const [,, email, password, name, role] = process.argv;
createUser(email, password, name, role).catch(err => {
  console.error(err);
  process.exit(1);
});
