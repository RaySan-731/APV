# Quick Start Guide - Pure HTML/CSS/Node.js

## Start the Server

```bash
npm install
npm start
```

Visit: **http://127.0.0.1:3000** or **http://127.0.0.1:3001**

---

## Project Pages

| Page | URL | Type |
|------|-----|------|
| Landing Page | `/` | Public |
| Programs | `/programs` | Public |
| About | `/about` | Public |
| Events | `/events` | Public |
| FAQ | `/faq` | Public |
| Contact | `/contact` | Public |
| Booking Form | `/book` | Public |
| Login | `/login` | Public |
| Dashboard | `/dashboard` | Protected |
| Admin Users | `/admin/users` | Protected (Founder) |
| Admin Bookings | `/admin/bookings` | Protected (Founder) |

---

## Key Files

### Backend
- **server.js** - Express server with all routes
- **.env** - Configuration (PORT, SESSION_SECRET, MONGODB_URI)

### Frontend
- **public/css/styles.css** - All styling with design system
- **public/js/main.js** - Client-side interactivity
- **views/*.ejs** - Server-side HTML templates

### Database
- **models/*.js** - MongoDB schemas
- **data/** - JSON backup storage

---

## Features

✅ Landing page with hero, programs, stats, about, FAQ, contact
✅ User authentication with login/logout
✅ Booking system for programs
✅ User dashboard
✅ Admin panel for user & booking management
✅ Responsive mobile design
✅ Form validation
✅ MongoDB integration (optional)

---

## Customization

### Change Colors
Edit CSS variables in `public/css/styles.css` lines 50-90:
```css
--primary: hsl(140, 45%, 28%);      /* Forest green */
--accent: hsl(25, 85%, 55%);        /* Sunset orange */
```

### Add New Pages
1. Create view in `views/newpage.ejs`
2. Add route in `server.js`:
```javascript
app.get('/newpage', (req, res) => {
  res.render('newpage', { user: req.session.user });
});
```

### Modify Content
Edit the `.ejs` files in `views/` directory directly

---

## Environment Setup

Create `.env` file:
```env
PORT=3000
SESSION_SECRET=your-secret-key
MONGODB_URI=mongodb://localhost:27017/apv-ventures
NODE_ENV=development
```

---

## No Build Required!

Just edit files and refresh your browser. Changes are instant.

---

**This project uses:**
- Express.js (server)
- EJS (templating)
- MongoDB (optional database)
- Vanilla JavaScript
- Pure CSS (no frameworks)

**That's it!** Simple, fast, and easy to maintain.
