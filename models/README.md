# Models Directory

This folder contains Mongoose schemas (database models) for Arrow-Park Ventures (APV).

## Files

- **User.js** - Schema for user accounts; fields: email, password, name, role, lastLogin, timestamps.
- **Booking.js** - Schema for program booking requests; tracks program, date, participants, requester info, status.
- **Program.js** - Schema for training programs; includes category, age group, duration, pricing, instructors.
- **School.js** - Schema for partner schools; stores contact info, enrolled programs, partnership dates.

## Usage

Each model is exported as a Mongoose model and can be imported in `server.js`:

```javascript
const User = require('./models/User');
const booking = await Booking.findById(id);
```

All models include automatic `createdAt` and `updatedAt` timestamps via Mongoose pre-save hooks.
Database indexes are defined for commonly-queried fields to optimize query performance.
