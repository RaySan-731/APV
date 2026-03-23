# Views Directory

This folder contains EJS template files that render HTML responses for Arrow-Park Ventures (APV).

## Files

- **index.ejs** - Landing page; showcases APV mission, programs, stats, and CTA.
- **login.ejs** - Login form for user authentication; includes error display and next-page redirect.
- **dashboard.ejs** - Main user dashboard with sidebar navigation; displays stats and page content.
- **book_program.ejs** - Program booking form for users (logged in or guest).
- **book_success.ejs** - Confirmation page after successful booking submission.
- **admin_users.ejs** - Admin interface to manage user accounts (founder role required).
- **admin_bookings.ejs** - Admin interface to view and delete bookings (founder role required).
- **404.ejs** - Error page for 404 Not Found and other HTTP errors.
- **layout.ejs** - (Shared) Common layout template included by other views.

## Usage

Views are rendered by `server.js` route handlers using:
```javascript
res.render('index', { user: req.session.user });
```

EJS allows embedding JavaScript with `<% %>` tags for dynamic content.
