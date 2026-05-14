# Quick Fix Guide - ScoutMate Hub Issues

**Current Status**: Server Exit Code 1 - MongoDB Not Running  
**Estimated Fix Time**: 2-4 hours for all critical issues

---

## 🔴 CRITICAL FIXES (Do These First)

### Fix #1: Start MongoDB [15 minutes]

**Problem**: Exit code 1, MongoDB connection fails
```
MongoDB connection error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution - Option A: Windows Native (5 min)**
```powershell
# 1. Download MongoDB Community Edition
# Go to: https://www.mongodb.com/try/download/community
# Choose: Windows, MSI Installer

# 2. Run installer, choose "Install as Service"
# 3. Verify installation
mongosh

# If you see ">" prompt, MongoDB is running!
exit()
```

**Solution - Option B: Docker (5 min)**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Solution - Option C: MongoDB Atlas Cloud (5 min)**
```bash
# 1. Go to: https://www.mongodb.com/cloud/atlas
# 2. Create free account and cluster
# 3. Get connection string: mongodb+srv://user:pass@cluster.mongodb.net/
# 4. Update .env:
#    MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/apv-ventures
```

**Verify**:
```bash
npm start
# Should see: "✓ Connected to MongoDB"
```

---

### Fix #2: Define emailHtml Variable [30 minutes]

**Problem**: Undefined variable `emailHtml` crashes when sending staff invitations

**Location**: `server.js` around lines 2181 and 3537

**Current Code (BROKEN)**:
```javascript
// Line ~2181 in /dashboard/staff/add route
await emailService.sendEmail({
  to: staff.email,
  subject: 'APV Staff Portal Invitation',
  html: emailHtml,  // ❌ UNDEFINED!
  templateId: 'staff_invitation',
  // ...
});
```

**Fix**: Replace with actual HTML templates

Create file: `backend/services/emailTemplates.js`
```javascript
module.exports = {
  staffInvitation: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        .button { background-color: #0066cc; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to APV, ${data.name}!</h1>
        <p>You've been invited to join the Arrow-Park Ventures staff portal.</p>
        <p>
          <a href="${data.activationUrl}" class="button">Activate Your Account</a>
        </p>
        <p>This link expires in 7 days.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    </body>
    </html>
  `,
  
  passwordReset: (data) => `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Password Reset Request</h1>
      <p>Click below to reset your password (link expires in 1 hour):</p>
      <p>
        <a href="${data.resetUrl}">Reset Password</a>
      </p>
    </body>
    </html>
  `
};
```

Then update `server.js` line ~2181:
```javascript
const emailTemplates = require('./backend/services/emailTemplates');

app.post('/dashboard/staff/add', requireAuth, async (req, res) => {
  try {
    // ... existing code ...
    
    const emailHtml = emailTemplates.staffInvitation({
      name: staff.name,
      activationUrl: invitationUrl
    });
    
    await emailService.sendEmail({
      to: staff.email,
      subject: 'APV Staff Portal Invitation',
      html: emailHtml,  // ✅ NOW DEFINED!
      templateId: 'staff_invitation',
      templateData: { name: staff.name, activationUrl: invitationUrl },
      triggeredBy: req.session.user.id,
      entityType: 'staff',
      entityId: staff._id,
      triggerReason: 'staff_invitation',
      priority: 'high'
    });
  } catch (err) {
    // error handling
  }
});
```

---

### Fix #3: Add Global Error Handler [20 minutes]

**Problem**: Unhandled errors crash app or hang requests silently

**Solution**: Add this at the END of `server.js`, AFTER all route definitions, BEFORE `app.listen()`:

Find line at end of file and add:
```javascript
// ============ GLOBAL ERROR HANDLER ============
// This MUST be the last middleware!

// Catch 404s
app.use((req, res) => {
  res.status(404).render('404', {
    user: req.session.user,
    error: 'Page not found'
  });
});

// Global error handler (catch-all for errors)
app.use((err, req, res, next) => {
  console.error('=== UNHANDLED ERROR ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('Request:', req.method, req.originalUrl);
  console.error('User:', req.session?.user?.email || 'Anonymous');
  console.error('======================');

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Don't expose stack traces in production
  const isDev = process.env.NODE_ENV !== 'production';
  const errorDetails = isDev ? err.stack : message;

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    // JSON response for API requests
    return res.status(statusCode).json({
      success: false,
      error: message,
      ...(isDev && { details: errorDetails })
    });
  }

  // HTML response for page requests
  res.status(statusCode).render('404', {
    user: req.session?.user,
    error: message
  });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✓ ScoutMate Hub running on http://127.0.0.1:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Database: ${process.env.MONGODB_URI ? 'MongoDB' : 'Not configured'}\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
```

---

## 🟡 HIGH-PRIORITY FIXES (Do These Next)

### Fix #4: Configure Email or Disable [30 minutes]

**Problem**: No email will be sent without SMTP configuration

**Option A: Use Gmail SMTP (Recommended for testing)**
```bash
# 1. Enable 2-factor auth on Gmail
# 2. Create app password: https://myaccount.google.com/apppasswords
# 3. Update .env:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
FROM_EMAIL=noreply@apv-ventures.com
NODE_ENV=development
```

**Option B: Use SendGrid (Production)**
```bash
# 1. Sign up: https://sendgrid.com
# 2. Create API key
# 3. Update .env:

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxx
FROM_EMAIL=noreply@apv-ventures.com
```

**Option C: Disable email for now**
```javascript
// In server.js, comment out email sending in /dashboard/staff/add:
// await emailService.sendEmail({ ... });
```

---

### Fix #5: Fix Port Mismatch [5 minutes]

**Current Problem**: .env says 3000 but README mentions 3001

**Solution**: Choose one and be consistent

**Option 1: Use port 3000 (default)**
```bash
# .env
PORT=3000
```

**Option 2: Use port 3001 (safer)**
```bash
# .env
PORT=3001
```

Then update any hardcoded references:
- `README.md` line 15: Change to your chosen port
- Any localhost links: http://localhost:3000 or http://localhost:3001

---

### Fix #6: Change Session Secret [10 minutes]

**Current Problem**: Default secret exposed in code

**Solution**:
```bash
# 1. Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# a7f4c2e8b9d1e5f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9

# 2. Add to .env:
SESSION_SECRET=a7f4c2e8b9d1e5f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9
```

---

## 🟠 MEDIUM-PRIORITY FIXES (After Critical)

### Fix #7: Remove Duplicate Routes [1 hour]

**Problem**: Some routes defined twice

**Solution**: Find duplicates:
```bash
grep -n "app.get\|app.post\|app.put\|app.delete" server.js | grep -E "'/api|'/dashboard" | sort
```

Look for routes appearing twice and keep only one.

**Example Fix**:
```javascript
// DELETE THIS (duplicate at line 3001-3003):
app.put('/api/school/students/:studentId', requireAuth, requireSchoolAdmin, async (req, res) => {
  const schoolController = require('./backend/controllers/schoolController');
  schoolController.updateStudent(req, res);
});

// KEEP THIS (line 2998-3000):
app.put('/api/school/students/:studentId', requireAuth, requireSchoolAdmin, async (req, res) => {
  const schoolController = require('./backend/controllers/schoolController');
  schoolController.updateStudent(req, res);
});
```

---

### Fix #8: Wrap Async Routes in Try-Catch [2 hours]

**Problem**: Many routes missing error handling

**Example - BEFORE (BROKEN)**:
```javascript
app.get('/trainer/dashboard', requireAuth, (req, res) => {
  // If this throws, request hangs!
  res.render('trainer_dashboard', { user: req.session.user });
});
```

**AFTER (FIXED)**:
```javascript
app.get('/trainer/dashboard', requireAuth, async (req, res, next) => {
  try {
    res.render('trainer_dashboard', { user: req.session.user });
  } catch (err) {
    console.error('Error rendering trainer dashboard:', err);
    next(err);  // Pass to global error handler
  }
});
```

**Routes needing fixes**:
- All trainer/* routes
- All school/* routes  
- All dashboard/* routes
- All API routes

---

## ✅ TESTING CHECKLIST

After fixes, test in this order:

```bash
# 1. Start server
npm start

# Should see:
# ✓ Connected to MongoDB
# ✓ ScoutMate Hub running on http://127.0.0.1:3001

# 2. Test home page
curl http://127.0.0.1:3001/
# Should return HTML (status 200)

# 3. Test login page
curl http://127.0.0.1:3001/login
# Should return login form

# 4. Test that routes don't crash
curl http://127.0.0.1:3001/nonexistent
# Should return 404 page (not crash)

# 5. Verify MongoDB is accessible
mongosh
use apv-ventures
db.users.countDocuments()
# Should return number of users
```

---

## 📋 VERIFICATION SCRIPT

Create `verify-setup.js`:
```javascript
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

async function verify() {
  console.log('\n=== SCOUTMATE HUB SETUP VERIFICATION ===\n');

  // Check environment
  console.log('📋 Environment:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  PORT: ${process.env.PORT || 3000}`);
  console.log(`  MONGODB_URI: ${process.env.MONGODB_URI ? '✓ Set' : '❌ Missing'}`);
  console.log(`  SESSION_SECRET: ${process.env.SESSION_SECRET ? '✓ Set' : '❌ Missing'}`);

  // Check email config
  console.log('\n📧 Email Configuration:');
  const emailConfigured = process.env.SMTP_HOST && process.env.SMTP_USER;
  console.log(`  SMTP Configured: ${emailConfigured ? '✓ Yes' : '❌ No'}`);

  // Try MongoDB
  console.log('\n🗄️  MongoDB Connection:');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('  ✓ Connected');

    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`  ✓ Collections: ${collections.length} found`);

    await mongoose.disconnect();
  } catch (err) {
    console.log(`  ❌ Failed: ${err.message}`);
  }

  // Check files
  console.log('\n📁 Required Files:');
  const requiredFiles = [
    'server.js',
    '.env',
    'package.json',
    'views/index.ejs',
    'public/css/styles.css'
  ];

  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✓' : '❌'} ${file}`);
  });

  console.log('\n=== END VERIFICATION ===\n');
}

verify();
```

Run with:
```bash
node verify-setup.js
```

---

## 🚀 QUICK START COMMANDS

```bash
# Step 1: Install MongoDB
# See Fix #1 above

# Step 2: Start MongoDB
mongosh  # or "net start MongoDB" on Windows

# Step 3: Install dependencies
npm install

# Step 4: Verify setup
node verify-setup.js

# Step 5: Start development server
npm start

# Step 6: Open browser
# http://localhost:3001
```

---

## ⏰ TIMELINE

| Task | Time | Priority |
|------|------|----------|
| Fix #1: Start MongoDB | 15 min | 🔴 CRITICAL |
| Fix #2: Define emailHtml | 30 min | 🔴 CRITICAL |
| Fix #3: Add error handler | 20 min | 🔴 CRITICAL |
| Fix #4: Configure email | 30 min | 🟡 HIGH |
| Fix #5: Port mismatch | 5 min | 🟡 HIGH |
| Fix #6: Session secret | 10 min | 🟡 HIGH |
| **Total Critical/High** | **1.5 hours** | - |
| Fix #7: Remove duplicates | 1 hour | 🟠 MEDIUM |
| Fix #8: Error wrapping | 2 hours | 🟠 MEDIUM |
| **Total with Medium** | **4.5 hours** | - |

---

## 🆘 TROUBLESHOOTING

### "Port 3000 already in use"
```bash
# Find what's using it
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill it
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### "MongoDB connection timeout"
```bash
# Verify MongoDB is running
mongosh

# If not installed, download and install MongoDB Community
# https://www.mongodb.com/try/download/community
```

### "Cannot find module 'express'"
```bash
npm install
```

### Email not sending
1. Check SMTP credentials in .env
2. Check that email features aren't disabled in code
3. Check logs for error message
4. Try a different SMTP provider

### Routes causing 500 errors
1. Check console for error messages
2. Ensure MongoDB is connected
3. Check that all required environment variables are set
4. Verify request body contains required fields

---

**Questions?** Check the full analysis in `COMPREHENSIVE_PROJECT_ANALYSIS.md`
