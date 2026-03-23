# Data Directory

Legacy JSON file storage for user accounts and bookings. **Deprecated** in favor of MongoDB.

## Files

- **users.json** - Array of user objects (email, hashed password, name, role, isActive).
- **bookings.json** - Array of booking objects (program, date, participants, requester info, status).

## Migration

These JSON files are used by the migration script (`scripts/migrate_to_mongodb.js`) to transfer data to MongoDB.

After running the migration, you can safely archive or delete these files—all new data will be stored in MongoDB.

## Example

**users.json:**
```json
[
  {
    "email": "founder@apventures.com",
    "password": "$2a$10$hashed...",
    "name": "Admin User",
    "role": "founder",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

**bookings.json:**
```json
[
  {
    "program": "Leadership Training",
    "type": "school",
    "date": "2024-02-15",
    "participants": 30,
    "userEmail": "school@example.com",
    "requesterName": "Jane Doe",
    "status": "pending"
  }
]
```
