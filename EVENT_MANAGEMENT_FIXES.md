# Event Management Critical Fixes Implementation Plan

## Status Overview
- ✅ Already Fixed: Session user ID, Permission checks on calendar endpoints, canManageStaff → canEditStaff, date range validation on exports, duplicate route removed
- 🚧 In Progress: Ownership checks, RSVP validation, status lifecycle
- ❌ Pending: RSVP token system, confirm dialogs, canScheduleEvents cleanup, training_officer canCreateEvents, rate limiting, timezone fix

---

## 1. Ownership/Authorization on Event Update/Delete (CRITICAL)

**Problem**: Any user with `canEditEvents`/`canDeleteEvents` can modify/delete any event. No check that they are the creator or have jurisdiction over the schools involved.

**Fix**: Add ownership/scope check in both routes.

**Implementation**:
```javascript
// After fetching event but before applying changes:
const isCreator = event.createdBy && event.createdBy.toString() === req.session.user.id;
const isAdmin = ['admin', 'founder', 'supervisor'].includes(req.session.user.role);

if (!isCreator && !isAdmin) {
  return res.status(403).json({ success: false, error: 'Access denied. You can only modify events you created.' });
}
```

Also need to handle cases where `createdBy` might be undefined for old events. Should add fallback or migration.

**Apply to**:
- `POST /dashboard/events/update/:id` (server.js ~line 3349)
- `POST /dashboard/events/delete/:id` (server.js ~line 3656)

---

## 2. RSVP Deadline Validation (HIGH)

**Problem**: `POST /api/events/rsvp` does not check if deadline passed.

**Fix**: Add check after finding event and school invitation:
```javascript
const invitation = event.targetSchools.find(ts => ts.schoolId.toString() === schoolId);
if (!invitation) return 404;

// Check deadline
if (invitation.rsvpDeadline && new Date() > invitation.rsvpDeadline) {
  return res.status(400).json({ success: false, error: 'RSVP deadline has passed' });
}
```

---

## 3. RSVP Token Validation (CRITICAL - requires major implementation)

**Problem**: Public RSVP links include a token that is never validated. Anyone can RSVP as any school.

**Current token generation** (line ~3878):
```javascript
const token = encodeURIComponent(btoa(schoolId + ':' + eventId));
```

**Fix**:
- Replace with signed tokens using crypto:
```javascript
const crypto = require('crypto');
const RSVP_SECRET = process.env.RSVP_SECRET || 'change-in-production';

function generateRsvpToken(schoolId, eventId) {
  const payload = `${schoolId}:${eventId}`;
  const hmac = crypto.createHmac('sha256', RSVP_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verifyRsvpToken(token) {
  try {
    const [payload, hmac] = token.split('.');
    const expected = crypto.createHmac('sha256', RSVP_SECRET).update(payload).digest('hex');
    if (hmac !== expected) return null;
    const [schoolId, eventId] = Buffer.from(payload, 'base64').toString().split(':');
    return { schoolId, eventId };
  } catch { return null; }
}
```
- Store token in event's targetSchools as `rsvpToken` with expiry
- Validate on POST `/api/events/rsvp`
- Update GET `/events/:eventId/rsvp` to include and validate token

This is a large change; consider simpler alternative: require school authentication.

---

## 4. Event Status Lifecycle Validation (CRITICAL)

**Problem**: Event status can be set to any value without transition checks. Need to enforce proper lifecycle.

**Approach**: Since pre-save hooks with findByIdAndUpdate are complex, add explicit validation in routes that change status:

```javascript
const validTransitions = {
  'draft': ['scheduled', 'confirmed', 'cancelled', 'archived'],
  'scheduled': ['confirmed', 'in_progress', 'cancelled', 'archived'],
  'confirmed': ['in_progress', 'cancelled', 'archived'],
  'in_progress': ['completed', 'cancelled', 'archived'],
  'completed': ['reviewed', 'archived'],
  'reviewed': ['archived'],
  'cancelled': ['draft', 'scheduled'],
  'archived': []
};

function validateStatusTransition(oldStatus, newStatus, context) {
  const allowed = validTransitions[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status ${context}: ${oldStatus} → ${newStatus}. Allowed: ${allowed.join(', ')}`);
  }
}
```

Apply in:
- Event create: default is 'draft' - no check needed
- Event update: if status changed, validate transition
- Event review submit: sets to 'completed' - check
- Event approve: sets to 'reviewed' - check

---

## 5. canScheduleEvents Handling (HIGH)

**Problem**: Permission `canScheduleEvents` exists but is never used. `training_officer` has it but cannot create events because `canCreateEvents` is false.

**Options**:
A) Remove `canScheduleEvents` from Permission model and all roles (cleanest)
B) Use `canScheduleEvents` on event creation instead of `canCreateEvents` for training_officer
C) Grant `canCreateEvents: true` to `training_officer`

**Recommended**: Option A if scheduling is just a synonym, or Option C if training officers should create events. Need business clarification.

Quick fix: Change training_officer role to have `canCreateEvents: true` (currently false at line 297) and keep `canScheduleEvents` unused.

---

## 6. Destructive Action Confirmations (HIGH)

**Problem**: No `confirm()` dialogs for inviteSchool, assignTrainer, removeTrainer.

**Fix**: Add to frontend dashboard.js:
```javascript
function inviteSchool() {
  if (!confirm('Invite this school to the event?')) return;
  // ... existing code
}
function assignTrainer() {
  if (!confirm('Assign this trainer to the event?')) return;
  // ...
}
function removeTrainer(eventId, trainerId) {
  if (!confirm('Remove this trainer from the event? This cannot be undone.')) return;
  // ...
}
```

---

## 7. Timezone Bug in formatDT (MEDIUM)

**Problem**: `toISOString()` used for datetime-local inputs causes timezone shift.

**Fix** (dashboard.js around line 1331):
```javascript
const formatDT = (date) => {
  if (!date) return '';
  const d = new Date(date);
  // Convert to local time ISO without timezone shift
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d - offset);
  return local.toISOString().slice(0,16);
};
```

---

## 8. Rate Limiting (HIGH)

**Problem**: No rate limiting; vulnerable to brute force/DoS.

**Fix**: Add `express-rate-limit` middleware.

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/', apiLimiter);
app.use('/dashboard', apiLimiter);
app.post('/login', authLimiter, ...existingLoginHandler);
```

---

## Implementation Order

**Phase 1 - Critical Security** (Do First):
1. Ownership checks on update/delete
2. RSVP deadline validation (quick win)
3. RSVP token validation (requires careful redesign)

**Phase 2 - Data Integrity**:
4. Status lifecycle validation
5. canScheduleEvents cleanup / training_officer create events fix

**Phase 3 - Usability**:
6. Confirm dialogs
7. Timezone fix

**Phase 4 - Performance & Security Hardening**:
8. Rate limiting

---

Given the scope, I recommend implementing Phase 1 items first to immediately address the most severe vulnerabilities (IDOR, RSVP manipulation). Then test thoroughly before proceeding.

---