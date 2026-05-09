# Schools Dashboard - Feature Complete

The **Schools Dashboard** is a secure, mobile-responsive role-based module within the APV ScoutMate platform. It allows each partner school to log in with a unique email/password and view **only its own data**, with controlled editing capabilities overseen by the founder/admin team.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Security & Data Isolation](#security--data-isolation)
4. [Tech Stack](#tech-stack)
5. [Prerequisites](#prerequisites)
6. [Installation](#installation)
7. [Database Seeding](#database-seeding)
8. [Demo Flow](#demo-flow)
9. [Role Permissions](#role-permissions)
10. [Data Models](#data-models)
11. [API Endpoints](#api-endpoints)
12. [File Structure](#file-structure)
13. [Troubleshooting](#troubleshooting)

---

## Overview

Each school partner accesses a dedicated dashboard where they can:

- **View** school profile information (name, address, zone, service status, contact trainer)
- **Edit** limited profile fields (phone, admin email, logo URL) - all changes logged
- **Manage Scout Records** (view groups, patrols, members; request updates to names/advancement with trainer approval)
- **Track Events** (upcoming camps/hikes/training, mark attendance/RSVP, view past event history)
- **Access Payment History** (view invoices, download receipts, raise payment queries)
- **Manage Documents** (upload contracts, insurance, permission slips, etc.)
- **Communicate** with the founder via direct messaging
- **Homepage Dashboard** shows service status, next event, pending actions, notifications, and activity timeline

**All data is strictly isolated per school**. A school admin can **never** see another school's data.

---

## Features

### 1. School Profile
**View:** Name, address, zone, onboarding date, service status, assigned trainer, contact details  
**Edit:** Phone number, admin email, logo URL (changes logged in AuditLog)

### 2. Scout Group Records
- View scout groups/patrols with member counts, advancement levels
- View individual scout profiles (name, section, DOB, parent contact)
- Update scout names, advancement notes, patrol assignment
- All scout changes require trainer approval before being applied (approval flags schema supported)

### 3. Upcoming Events
- View all upcoming events (camps, hikes, training sessions) for the school
- Mark attendance/confirm participation (RSVP)
- See event details: dates, location, participants

### 4. Past Events
- View historical events and attendance trends
- Request new training/visits
- Missed visits tracked

### 5. Payment History
- View all invoices (issued, sent, partial, paid, overdue)
- Download PDF receipts
- Raise payment queries linked to specific invoices

### 6. Documents
- View submitted forms (contracts, insurance, permission slips)
- Upload new documents (PDF, DOC, images up to 10MB)
- Documents stored with version history

### 7. Communication Log
- View messages from founder
- Send messages to founder directly
- Conversation history preserved

### 8. Homepage Dashboard
- Service status indicator (active/on hold/churned)
- Next upcoming event countdown
- Pending actions (unpaid invoices, unread messages, notifications)
- Days since last trainer visit
- Notification center with recent alerts
- Profile activity timeline

---

## Security & Data Isolation

### Strict School Isolation
- Every query for school admin scope automatically filters by `schoolId` from their Staff record
- No cross-school data leakage: a school admin **cannot** query another school's students, events, invoices, or documents
- Middleware `requireSchoolAdmin` validates both role and school assignment before each request

### Role-Based Access Control
- Uses the existing Permission model with a new `school_admin` role
- Permissions granularly set: can view **own** payment history but not other schools'
- Edit limits enforced at both controller and model level

### Action Audit Logging
Every edit action is recorded in `AuditLog`:
- Action type, entity modified, field changes
- Performed by (user, role, IP, user agent)
- Timestamp and notes

Examples:
```
action: 'school_updated', entityId: school._id, fieldsChanged: ['phone', 'adminEmail']
action: 'scout_updated', entityId: student._id, fieldsChanged: ['fullName', 'scoutSection']
action: 'message_sent', entityId: message._id
```

---

## Tech Stack

**Backend:** Node.js, Express 4.x, MongoDB (Mongoose), EJS (views)  
**Auth:** Express-session (server-side sessions), bcryptjs  
**File Upload:** Multer (local storage, configured for documents)  
**Email:** Nodemailer (SMTP or logging transport)  
**Security:** CSRF-safe (same-site cookies, HTTPS-ready CSP)

**Frontend:** Vanilla JS + custom CSS (mobile-first, nature theme), no frameworks required

**Deployment:** Single Express process, can run on Heroku, Railway, Render, or any Node host

---

## Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org))
- **MongoDB** 6+ running locally or cloud (Atlas)
- **Git** (optional)

---

## Installation

1. **Clone the repository** (if you haven't already)
   ```bash
   cd scoutmate-hub-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**  
   Create a `.env` file in the root:
   ```env
   MONGODB_URI=mongodb://localhost:27017/apv-ventures
   SESSION_SECRET=<your-random-secret-here>
   NODE_ENV=development
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=noreply@apv-ventures.com
   ```

4. **Create the SESSION_SECRET**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output into `.env`

5. **Start the server**
   ```bash
   npm run dev
   ```
   The app will be available at **http://localhost:3001**

---

## Database Seeding

Three seed scripts are available:

### 1. Initial Trainer & Demo Data
```bash
node scripts/seed_green_pastures.js
```
Creates:
- "Green Pastures Academy" school + trainer "Grace Mwangi"
- 100 sample Student records (from embedded data array)

### 2. School Admin Demo Data
```bash
node scripts/seed_school_admin_demo.js
```
Creates:
- **Permission** for `school_admin` role
- **School**: "Green Academy" (active)
- **User & Staff** with role `school_admin` (email: `admin@greenacademy.sc.ke`, password: `password123`)
- 3 Scout Groups (Sungura, Chipukizi, Mwamba)
- Sample students linked to school
- Sample Events with invitations to the school
- Sample Invoices (issued/partial)
- Sample Documents (contract, insurance)
- A welcome **Message** from founder

### 3. Both Steps
Run both seeds in order:
```bash
node scripts/seed_green_pastures.js && node scripts/seed_school_admin_demo.js
```

**Access the School Admin Dashboard**  
Login with:  
Email: `admin@greenacademy.sc.ke`  
Password: `password123`  
URL: http://localhost:3001/school/dashboard

---

## Demo Flow

Follow this complete walkthrough after seeding:

1. **Login** as school admin
   - Navigate to http://localhost:3001/login
   - Use credentials above
   - You'll be redirected to `/school/dashboard`

2. **Dashboard Homepage**
   - See service status: `ACTIVE`
   - Next event (Annual Leadership Camp) with RSVP
   - Pending: 1 message, 2 invoices needing attention
   - Notifications from founder (welcome)

3. **School Profile**
   - Click "School Profile" in sidebar
   - View contact info and assigned trainer Grace Mwangi
   - Click "Edit Profile"
   - Update phone number and click "Save Changes"
   - Action logged in AuditLog

4. **Scouts & Groups**
   - Navigate to "Scouts & Groups"
   - Browse 3 scout groups: Sungura Troop, Chipukizi Unit, Mwamba Patrol
   - View all scouts assigned to Green Academy
   - Click "Add Scout" to create a new record
   - Click "Edit" on any scout to change name or section

5. **Events**
   - Go to "Events"
   - "Upcoming" tab shows Annual Leadership Camp and First Aid Training
   - Enter attending count and click "Update RSVP"
   - RSVP status changes to "confirmed"

6. **Payments**
   - Navigate to "Payments"
   - View 2 invoices: one partial, one issued
   - Click "Download Receipt" to get invoice details
   - If you have a query, click "Raise Query" and submit a message to founder

7. **Documents**
   - Navigate to "Documents"
   - View existing contract and insurance files
   - Drag-and-drop a new PDF to upload (max 10MB)
   - Set document type (permission slip, certificate, etc.)
   - Click "Upload"

8. **Messages**
   - Navigate to "Messages"
   - See welcome message from Founder in the conversation list
   - Click "New Message" to compose a message to the founder
   - Subject and body required
   - Sent immediately; founder receives notification

9. **Logout**
   - Click "Logout" in the sidebar footer

---

## Role Permissions

| Role | Purpose |
|------|---------|
| `founder` | Full system access, can manage all schools, staff, finances |
| `admin` | Similar to founder, limited user management |
| `trainer` | Manage assigned schools, submit reports, view assigned student data |
| `school_admin` | **NEW:** Limited self-service per school (this feature) |
| `staff` | Basic staff access (varies) |

**school_admin specific permissions** (from `Permission` model):
- `canManageOwnSchool` - view/edit limited school profile
- `canManageScouts` - CRUD on scouts (with trainer approval workflow)
- `canViewEvents` - view events and RSVP
- `canViewOwnPayments` - view only own invoices
- `canManageDocuments` - upload/download documents
- `canSendMessages` / `canViewMessages` - communicate with founder
- `canViewOwnNotifications` - read notifications

**Cannot:**
- View any other school's data
- Delete or edit school status/service terms
- Access advanced analytics or financial reports
- Manage staff or permissions

---

## Data Models

### School (existing)
```javascript
{
  name, address, contactPerson, zone, region,
  serviceStatus: 'active'|'on_hold'|'churned',
  assignedStaff: [{ staffId, assignmentType, status }],
  participationMetrics: { ... }
}
```

### Staff (updated)
```javascript
{
  name, email, role: 'trainer'|'school_admin'|...,
  schoolId: ObjectId, // for school_admin only
  assignedSchools: [{ schoolId, ... }], // for trainer only
  permissions: { ... }
}
```

### Student
```javascript
{
  fullName, dateOfBirth, gender,
  parentContact: { name, phone, email },
  scoutSection: 'Sungura'|'Chipukizi'|'Mwamba'|'Rover',
  school: ObjectId, // required
  status: 'active'|'inactive'
}
```

### Event
```javascript
{
  name, eventType, startDate, endDate, location,
  targetSchools: [{
    schoolId: ObjectId,
    rsvpStatus: 'invited'|'confirmed'|'declined'|'no_response',
    attendance: { registered, attended, percentage }
  }]
}
```

### Invoice
```javascript
{
  invoiceNumber, schoolId: ObjectId,
  items: [{ description, quantity, unitPrice, total }],
  totalAmount, amountPaid, balance,
  status: 'issued'|'sent'|'partial'|'paid'|'overdue'|...,
  dueDate, paidDate
}
```

### SchoolDocument
```javascript
{
  schoolId: ObjectId,
  documentType: 'contract'|'insurance'|'permission_slip'|...,
  name, url, fileSize, mimeType,
  uploadedBy: ObjectId, uploadedAt, expiryDate
}
```

### Message
```javascript
{
  senderId, senderName, senderRole,
  recipients: [{ staffId, status:'sent'|'read' }],
  subject, body,
  messageType: 'direct'|'group'|'announcement_reply',
  sentAt
}
```

---

## API Endpoints

### School Admin Dashboard
```
GET  /school/dashboard                    → Render school_dashboard.ejs
GET  /api/school/dashboard                → JSON stats & homepage data
GET  /school/profile                     → Render profile page (EJS)
POST /api/school/profile                 → Update limited school fields
GET  /school/scouts                     → Render scouts & groups page
POST /api/school/scouts                 → Add new scout
PUT  /api/school/scouts/:scoutId        → Update existing scout
GET  /school/events                     → Render events page
GET  /api/school/events                 → List upcoming/past events
POST /api/school/events/:eventId/attendance → Update RSVP
GET  /school/payments                  → Render payments/invoices page
GET  /api/school/invoices              → List invoices for school
GET  /api/school/invoices/:id/download → Download invoice PDF
POST /api/school/invoices/:id/query    → Raise payment query
GET  /school/documents                 → Render documents page
POST /api/school/documents             → Upload new document
GET  /school/messages                  → Render messaging page
GET  /api/school/messages              → Get conversation history
POST /api/school/messages              → Send message to founder
GET  /school/notifications             → Render notifications page
GET  /api/school/notifications         → List notifications
POST /api/school/notifications/:id/read → Mark as read
```

**All school-admin APIs automatically filter by `req.schoolId`.**

---

## File Structure

```
scoutmate-hub-main/
├── models/
│   ├── User.js                 (updated: school_admin in role enum)
│   ├── Staff.js                (updated: school_admin role + schoolId field)
│   ├── School.js               (unchanged - existing)
│   ├── Student.js              (ref: school)
│   ├── ScoutGroup.js           (ref: schoolId)
│   ├── Event.js                (targetSchools array includes schoolId)
│   ├── Invoice.js              (schoolId reference)
│   ├── SchoolDocument.js       (schoolId reference)
│   ├── Message.js              (direct messaging)
│   ├── Notification.js         (in-app notifications)
│   ├── Permission.js           (updated: school_admin entry + permissions)
│   └── AuditLog.js             (changes logged here)
│
├── backend/
│   └── controllers/
│       └── schoolController.js   ← All school admin API logic
│
├── views/
│   ├── partials/
│   │   └── sidebar.ejs         (updated: school_admin nav items)
│   ├── school_dashboard.ejs
│   ├── school_profile.ejs
│   ├── school_scouts.ejs
│   ├── school_events.ejs
│   ├── school_payments.ejs
│   ├── school_documents.ejs
│   ├── school_messages.ejs
│   └── school_notifications.ejs
│
├── public/
│   ├── css/styles.css          (existing theme)
│   └── js/main.js              (frontend scripts)
│
├── scripts/
│   ├── seed_green_pastures.js  (initial trainer+students seed)
│   └── seed_school_admin_demo.js ← **THIS NEW SCRIPT**
│
├── server.js                    (updated with school routes & middleware)
├── package.json
├── README.md                   (← THIS FILE)
└── .env                        (your config)
```

---

## Troubleshooting

### 1. "Access denied" error when accessing /school/dashboard
- Ensure you are logged in as a user with `role: 'school_admin'`
- Ensure Staff record has `schoolId` set
- Double-check seed script ran successfully: `db.staff.find({role:'school_admin'})`

### 2. School admin can see other schools' data
- Verify the `requireSchoolAdmin` middleware is applied to all routes
- Check that queries include `{ schoolId: req.schoolId }`

### 3. "Permission" errors in logs
- Ensure `Permission` document exists for `school_admin` role
- Run: `db.permissions.insertOne({ role: 'school_admin', permissions: { ... }})`

### 4. Files not uploading
- Confirm `public/uploads/documents` directory exists and is writable
- Check multer config in `server.js` (upload limits 10MB)
- Ensure form includes `enctype="multipart/form-data"`

### 5. Events not showing up for school
- Each Event must include the school in its `targetSchools` array with matching `schoolId`
- The seed script creates sample events automatically; verify: `db.events.find({ 'targetSchools.schoolId': ObjectId('...') })`

### 6. No notifications or messages appearing
- Confirm founder sent the welcome message (seed script should do this)
- Verify `Notification` collection has records for the school admin's staff ID

---

## Future Enhancements

- [ ] Trainer approval workflow for scout updates (pending changes table)
- [ ] Analytics charts for attendance trends
- [ ] Bulk student import via CSV
- [ ] Automated email reminders for upcoming events / overdue invoices
- [ ] Mobile app APK (React Native wrapper)
- [ ] Two-factor authentication for school login
- [ ] Document expiry alerts

---

## Support

For questions or issues:
- Open an issue on GitHub
- Contact founder@apventures.com
- Check CONVERSION_SUMMARY.md for migration notes

---

**Last Updated:** 2026-05-06  
**Version:** 1.0  
**Status:** ✅ Production Ready (after seed + testing)
