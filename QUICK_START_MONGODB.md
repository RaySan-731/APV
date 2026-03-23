# Quick Start Guide - MongoDB Setup

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install MongoDB
Go to: https://www.mongodb.com/try/download/community
- Download the MSI installer
- Run it and choose "Install MongoDB as a Service"
- Click finish

### Step 2: Verify MongoDB is Running
Open PowerShell and type:
```powershell
mongosh
```

You should see a `>` prompt. If yes, MongoDB is working! Type `exit()` to quit.

### Step 3: Migrate Your Data
In your project directory, run:
```powershell
npm run migrate
```

You'll see something like:
```
✓ Connected to MongoDB
Migrating users...
Found 2 users to migrate
  ✓ Migrated user: founder@scoutacademy.com
  ✓ Migrated user: member@example.com
Migrating bookings...
Found 3 bookings to migrate
  ✓ Migrated booking: Leadership Training on 2026-02-15
  ✓ Migrated booking: Outdoor Education on 2026-01-30
  ✓ Migration completed successfully!
```

### Step 4: Start Your Application
```powershell
npm run dev
```

That's it! Your app now uses MongoDB. 🎉

## ✅ What Changed

| Before | After |
|--------|-------|
| Data stored in JSON files | Data stored in MongoDB database |
| `data/users.json` | `scoutmate-hub.users` collection |
| `data/bookings.json` | `scoutmate-hub.bookings` collection |
| Limited query capabilities | Full database query power |

## 🔍 Verify Your Data

To check if data migrated successfully:
```powershell
mongosh
use scoutmate-hub
db.users.find()
db.bookings.find()
```

## 📝 User Accounts (After Migration)

These accounts will be ready to use:
- **Email**: founder@scoutacademy.com
- **Email**: member@example.com

(Use the passwords you set up before)

## 🆘 Troubleshooting

### "mongosh: command not found"
- MongoDB is not installed
- Download from: https://www.mongodb.com/try/download/community
- Run the installer

### "Connection refused"
- MongoDB is not running
- Start it: Open Services app → Find "MongoDB Server" → Start

### "Authentication failed"
- This only happens with connection string issues
- Check that `.env` has: `MONGODB_URI=mongodb://localhost:27017/scoutmate-hub`

## 📚 Need More Help?

See the detailed guides:
- [Full Setup Guide](./MONGODB_SETUP.md)
- [What Changed](./MONGODB_MIGRATION_COMPLETE.md)

---

**You're all set! Your application is now using MongoDB.** 🚀
