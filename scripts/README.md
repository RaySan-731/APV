# Scripts Directory

This folder contains utility and testing scripts for Arrow-Park Ventures (APV).

## Files

- **migrate_to_mongodb.js** - One-time migration script: reads JSON files (`data/users.json`, `data/bookings.json`) and writes documents to MongoDB collections via Mongoose. Run once to transfer legacy data.
- **create_user.js** - Utility to manually create a user in the JSON store (legacy; now use MongoDB via admin interface).
- **test_booking.js** - Test script that simulates a booking form POST request to the server.
- **test_login.js** - Test script for login authentication.
- **check_book_http.js** - Utility to inspect booking endpoints.
- **test_booking_out.txt** - Output log from a previous test run.

## Usage

Run the migration script once after installing MongoDB:
```bash
npm run migrate
```

Or manually:
```bash
node scripts/migrate_to_mongodb.js
```

Other scripts are for local testing and debugging.
