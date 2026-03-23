# Arrow-Park Ventures (APV) - Complete Setup & Documentation Summary

## Current Status ✅

Your Arrow-Park Ventures application is **fully configured and running**. Here's what was completed:

---

## 1. **Rebranding Complete** ✅

All references to "Scout Academy"/"ScoutMate Hub" have been replaced with "Arrow-Park Ventures (APV)" across:
- ✅ Frontend templates (`views/*.ejs`)
- ✅ React components (`src/`)
- ✅ Configuration files (`.env`, `package.json`)
- ✅ Public assets and CSS
- ✅ Documentation files
- ✅ Database name: `apv-ventures`
- ✅ Sample email: `founder@apventures.com`

**Files Updated**: README.md, MONGODB_SETUP.md, MONGODB_MIGRATION_COMPLETE.md, views/index.ejs, and many more.

---

## 2. **Code Documentation Added** ✅

Comprehensive comments added to explain code blocks:
- ✅ `server.js` - Entry point explaining middleware, MongoDB connection, routes
- ✅ `models/User.js` - User schema explanation
- ✅ `models/Program.js` - Program schema explanation
- ✅ `models/School.js` - School schema explanation
- ✅ `models/Booking.js` - Booking schema explanation
- ✅ `scripts/migrate_to_mongodb.js` - Migration script purpose
- ✅ `public/js/main.js` - Client-side utility descriptions (nav toggle, smooth scroll, form validation, etc.)

**New README.md files created in:**
- `models/README.md` - Mongoose schemas overview
- `views/README.md` - EJS templates guide
- `scripts/README.md` - Utility scripts documentation
- `public/README.md` - Static assets explanation
- `data/README.md` - JSON legacy data info
- `src/README.md` - React/TypeScript status (not actively used)

---

## 3. **MongoDB Setup Instructions**

To enable persistent data storage, install MongoDB on your Windows machine:

### **Quick Install (Recommended)**
1. Download: https://www.mongodb.com/try/download/community
2. Run the `.msi` installer
3. ✅ Check **"Install MongoDB as a Service"** during setup
4. Restart your computer (or manually start the service)
5. Verify: Open PowerShell and run `mongosh` - you should see a `>` prompt

### **Verify MongoDB is Running**
```powershell
# Option 1: Check service status
Get-Service MongoDB | Start-Service

# Option 2: Connect to MongoDB
mongosh
# Type exit() to quit
```

---

## 4. **Data Migration (After MongoDB is Running)**

Once MongoDB is installed and running:

```powershell
# Navigate to project root
cd "c:\Users\PC\Desktop\APV PROJECT\scoutmate-hub-main"

# Run migration script (directly with node to bypass PowerShell policy)
node scripts/migrate_to_mongodb.js
```

This will:
- ✅ Read existing users and bookings from JSON files
- ✅ Write them to MongoDB database `apv-ventures`
- ✅ Display progress for each record migrated

**Current Data to be Migrated:**
- 2 users: `founder@apventures.com`, `member@example.com`
- 3 bookings with program requests and participant info

---

## 5. **Server Running** ✅

Your server is **currently running** on:

```
http://127.0.0.1:3001
```

**Terminal Command Used:**
```powershell
node server.js
```

**What's Working:**
- ✅ Landing page rendering
- ✅ Login form (works with JSON data until MongoDB migration runs)
- ✅ Booking form
- ✅ Admin dashboard (founder role required)
- ✅ Static assets (CSS, JS, images)

---

## 6. **Next Steps**

### **Immediate (MongoDB Setup)**
1. **Install MongoDB** from: https://www.mongodb.com/try/download/community
2. **Start MongoDB Service** after installation
3. **Run Migration**:
   ```powershell
   cd "c:\Users\PC\Desktop\APV PROJECT\scoutmate-hub-main"
   node scripts/migrate_to_mongodb.js
   ```

### **After Migration**
- All bookings and users will persist in MongoDB
- Application automatically uses MongoDB for new data
- You can archive JSON files in `data/` folder (optional)

### **Future Development**
- Add more programs via admin interface
- Add schools and manage partnerships
- Implement analytics dashboard
- Set up email notifications for bookings

---

## 7. **Important Files & Folders**

| Folder | Purpose |
|--------|---------|
| `server.js` | Express server (entry point) |
| `models/` | Mongoose schemas (User, Booking, Program, School) |
| `views/` | EJS HTML templates for pages |
| `public/` | Static CSS, JS, images served to browsers |
| `scripts/` | Migration and testing utilities |
| `data/` | Legacy JSON files (deprecated, use MongoDB instead) |
| `src/` | React/TypeScript source (not actively used) |

---

## 8. **Troubleshooting**

### **"Address already in use" error**
- Another process is using port 3001
- Solution: Kill the process or use a different port in `.env`

### **MongoDB not connecting**
- Check `.env` file has `MONGODB_URI=mongodb://localhost:27017/apv-ventures`
- Ensure MongoDB service is running: `Get-Service MongoDB | Start-Service`

### **PowerShell won't run npm commands**
- Use: `node scripts/migrate_to_mongodb.js` instead of `npm run migrate`
- Alternative: Open Terminal as Administrator and bypass policy:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### **Port 3001 conflicts**
- Change in `.env`: `PORT=3002` (or any available port)
- Then restart server

---

## 9. **Demo Credentials**

Use these to test login (after migration, verify they exist in MongoDB):

| Email | Password | Role |
|-------|----------|------|
| `founder@apventures.com` | `admin` | Founder |
| `member@example.com` | `password` | Member (Rover) |

---

## 10. **Architecture Overview**

```
┌─────────────────────────────────────┐
│   Browser (User)                    │
└──────────────┬──────────────────────┘
               │ HTTP Requests
               ▼
┌─────────────────────────────────────┐
│   Express Server (server.js)        │
│   - Routes & request handling       │
│   - Session management              │
│   - EJS template rendering          │
└──────────────┬──────────────────────┘
               │ Mongoose ODM
               ▼
┌─────────────────────────────────────┐
│   MongoDB Database                  │
│   - Users collection                │
│   - Bookings collection             │
│   - Programs collection             │
│   - Schools collection              │
└─────────────────────────────────────┘
```

---

## 11. **Environment Configuration (.env)**

```env
# Server
PORT=3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/apv-ventures
MONGODB_DBNAME=apv-ventures

# Session
SESSION_SECRET=apv-ventures-secret-key-change-in-production
```

---

## Summary

✅ **Completed:**
- Full rebranding to Arrow-Park Ventures (APV)
- Code documentation and comments added throughout
- Server running on http://127.0.0.1:3001
- All templates and pages updated

⏳ **Waiting on You:**
1. Install MongoDB (follow instructions above)
2. Run the migration script
3. Test login and booking functionality

**You're all set!** The application is running and ready to accept connections. Just install MongoDB to enable persistent data storage.

---

*Last updated: February 6, 2026*
