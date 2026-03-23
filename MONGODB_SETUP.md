# MongoDB Setup Guide for Arrow-Park Ventures (APV)

## Overview
This guide will help you install and set up MongoDB to replace the JSON file-based data storage with a proper MongoDB database.

## Prerequisites
- Windows OS
- Administrator access
- Node.js and npm already installed (which you have)

## Installation Methods

### Method 1: MongoDB Community Server (Recommended)

#### Step 1: Download MongoDB Community Edition
1. Go to https://www.mongodb.com/try/download/community
2. Select:
   - Version: Latest (7.0 or higher)
   - OS: Windows
   - Package: MSI
3. Click "Download"

#### Step 2: Install MongoDB
1. Run the installer (.msi file)
2. Follow the installation wizard
3. **Important**: Choose "Install MongoDB as a Service" during installation
4. This will:
   - Install MongoDB to `C:\Program Files\MongoDB\Server\X.X\`
   - Automatically start the MongoDB service
   - Set up MongoDB to run on `localhost:27017`

#### Step 3: Verify Installation
After installation, run:
```powershell
mongosh
```

If you see `>` prompt, MongoDB is running correctly.
Type `exit()` to quit.

### Method 2: Using MongoDB Atlas (Cloud)

If you prefer cloud-based MongoDB:
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a cluster
4. Get your connection string
5. Update `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/apv-ventures
   ```

### Method 3: Using Docker (if Docker is installed)

```powershell
docker run -d -p 27017:27017 --name apv-mongodb mongo:latest
```

Then update `.env`:
```
MONGODB_URI=mongodb://localhost:27017/apv-ventures
```

## After Installation

Once MongoDB is installed and running:

### Step 1: Verify Connection
```powershell
npm run migrate
```

### Step 2: Run the Migration Script
```powershell
node scripts/migrate_to_mongodb.js
```

This will:
- Transfer all users from `data/users.json` to MongoDB
- Transfer all bookings from `data/bookings.json` to MongoDB
- Display progress for each record migrated

### Step 3: Start the Server
```powershell
npm run dev
```

## Troubleshooting

### MongoDB Connection Error
If you see "Failed to connect to MongoDB":
1. Ensure MongoDB service is running:
   ```powershell
   Get-Service MongoDB | Start-Service
   ```
2. Check that port 27017 is not blocked
3. Verify `.env` file has correct `MONGODB_URI`

### Migration Script Fails
- Ensure MongoDB is running
- Check that `data/users.json` and `data/bookings.json` exist
- Check console output for specific error messages

### Data Verification
After migration, you can verify data was transferred:
```powershell
mongosh
use apv-ventures
db.users.countDocuments()
db.bookings.countDocuments()
```

## Next Steps

Once MongoDB is set up:
1. Your application data will persist in MongoDB instead of JSON files
2. Users and bookings will be stored in the `apv-ventures` database
3. You can safely archive the JSON files in the `data/` folder
4. All new data will automatically use MongoDB

## Additional Resources

- MongoDB Documentation: https://docs.mongodb.com/manual/
- Mongoose Documentation: https://mongoosejs.com/
- MongoDB Community Support: https://www.mongodb.com/community/forums/

---

**Note**: The application is already configured to use MongoDB. You just need to install it and run the migration script.
