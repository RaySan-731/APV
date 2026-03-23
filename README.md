Arrow-Park Ventures (Pure HTML, CSS, and Node.js)
==================================================

This is a fully functional web application built with **pure HTML, CSS, and Node.js** - no React, no TypeScript, no build tools required. The application uses:

- **Backend**: Express.js server
- **Frontend**: HTML/CSS/JavaScript (plain vanilla)
- **Templating**: EJS for dynamic page rendering
- **Database**: MongoDB (optional, with JSON fallback)
- **Package Manager**: npm/yarn

The application has been completely migrated away from React/TypeScript to pure HTML/CSS and vanilla JavaScript, maintaining all functionality and appearance.

## Quick Start

1. Install dependencies:

```powershell
npm install
```

2. Start the server:

```powershell
npm start
```

3. Open in browser: http://127.0.0.1:3000 (or http://127.0.0.1:3001)

## Project Structure

```
.
├── public/              # Static assets
│   ├── css/            # Stylesheets
│   │   └── styles.css  # Main stylesheet with design system
│   └── js/             # JavaScript files
│       └── main.js     # Client-side interactivity
├── views/              # EJS templates
│   ├── index.ejs       # Landing page with all sections
│   ├── login.ejs       # Login page
│   ├── dashboard.ejs   # User dashboard
│   ├── book_program.ejs# Booking form
│   └── ...
├── models/             # MongoDB models
├── scripts/            # Utility scripts
├── server.js           # Express server
├── package.json        # Dependencies
└── .env               # Environment variables
```

## Features

✅ **Landing Page** - Complete landing page with hero, programs, stats, about, FAQ, contact sections
✅ **User Authentication** - Login/logout with session management
✅ **Dashboard** - User dashboard for logged-in members
✅ **Program Booking** - Guests and members can book programs
✅ **Admin Panel** - Manage users and bookings (founder role)
✅ **Responsive Design** - Mobile-friendly using pure CSS
✅ **No Build Step** - Run directly with Node.js, no compilation needed
✅ **Modern CSS** - Uses CSS custom properties (variables) and flexbox/grid
✅ **Vanilla JavaScript** - Pure client-side JS for interactivity
✅ **MongoDB Integration** - Optional database with JSON fallback

## Development

The project is production-ready and requires no build step. Simply edit the files in `public/`, `views/`, or `server.js` and refresh your browser.

### File Organization

- **public/css/styles.css** - Complete design system with variables, responsive layouts, and component styles
- **public/js/main.js** - Client-side features like mobile menu toggle, form validation, smooth scrolling
- **views/\*.ejs** - Server-side templated HTML pages
- **server.js** - Express routes and application logic

## Routes

- `GET /` - Landing page
- `GET /programs` - Programs page
- `GET /about` - About page
- `GET /events` - Events page
- `GET /faq` - FAQ page
- `GET /contact` - Contact page (displays contact form)
- `POST /contact` - Submit contact form
- `GET /login` - Login page
- `POST /login` - Submit login
- `GET /logout` - Logout
- `GET /book` - Booking form
- `POST /book/submit` - Submit booking
- `GET /dashboard` - User dashboard (requires auth)
- `GET /dashboard/:page` - Dashboard pages (staff, schools, events, etc.)
- `GET /admin/users` - Manage users (founder only)
- `GET /admin/bookings` - Manage bookings (founder only)

## Environment Setup

Create a `.env` file:

```env
PORT=3000
SESSION_SECRET=your-secret-key
MONGODB_URI=mongodb://localhost:27017/apv-ventures
NODE_ENV=development
```

## Database (Optional)

If MongoDB is configured, the app uses Mongoose models. Otherwise, it can work with JSON storage in the `data/` folder.

## Arrow-Park Ventures Management System

A Node.js web application for managing leadership and development programs, built with Express.js, MongoDB, and plain HTML/CSS/JavaScript.

## Features

- **Landing Page**: Professional landing page for Arrow-Park Ventures
- **User Authentication**: Login system with session management
- **Dashboard**: Comprehensive dashboard with statistics and navigation
- **MongoDB Integration**: Database connectivity for data persistence
- **Responsive Design**: Mobile-friendly interface
- **Offline Capable**: Runs completely offline once set up

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or cloud service like MongoDB Atlas)
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scoutmate-hub-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update the connection string in `.env` file

4. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```
   PORT=3000
   SESSION_SECRET=your-secret-key-change-this-in-production
   MONGODB_URI=mongodb://localhost:27017/apv-ventures
   ```

5. **Start the application**
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## Usage

### Landing Page
- Visit the home page to see the Arrow-Park Ventures landing page
- Click "Member Login" to access the dashboard

### Login
- Use demo credentials: `founder@scoutacademy.com` / `admin`
- After login, you'll be redirected to the dashboard

### Dashboard
- View statistics and recent activities
- Navigate between different sections using the sidebar
- Access various management features

## Project Structure

```
scoutmate-hub-main/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── views/                 # EJS templates
│   ├── index.ejs         # Landing page
│   ├── login.ejs         # Login page
│   ├── dashboard.ejs     # Dashboard page
│   └── 404.ejs           # 404 error page
├── public/               # Static assets
│   ├── css/
│   │   └── styles.css    # Main stylesheet
│   ├── js/
│   │   ├── main.js       # General JavaScript
│   │   └── dashboard.js  # Dashboard-specific JS
│   └── favicon.ico       # Favicon
├── models/               # MongoDB models (to be created)
├── routes/               # Route handlers (to be created)
└── middleware/           # Custom middleware (to be created)
```

## Database Models

The application uses MongoDB with Mongoose. Planned models include:

- **User**: User accounts and authentication
- **School**: Partner schools information
- **Program**: Scouting programs and activities
- **Event**: Scheduled events and camps
- **Student**: Student registrations and progress

## API Endpoints

- `GET /` - Landing page
- `GET /login` - Login page
- `POST /login` - Process login
- `GET /logout` - Logout
- `GET /dashboard` - Main dashboard
- `GET /dashboard/:page` - Dashboard sections
- `GET /api/dashboard-data` - Dashboard statistics (JSON)

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Templating**: EJS
- **Session Management**: express-session
- **Styling**: Custom CSS with CSS Variables
- **Icons**: Inline SVG icons

## Development

### Adding New Pages

1. Create a new EJS template in the `views/` directory
2. Add the route in `server.js`
3. Add navigation links if needed
4. Style the page in `public/css/styles.css`

### Database Operations

1. Create Mongoose models in the `models/` directory
2. Implement CRUD operations in route handlers
3. Update the API endpoints accordingly

### Styling Guidelines

- Use CSS custom properties (variables) for colors and common values
- Follow the existing design system
- Ensure responsive design for mobile devices
- Use semantic HTML and accessible markup

## Deployment

### Production Setup

1. Set `NODE_ENV=production` in environment variables
2. Use a production MongoDB instance
3. Set a strong `SESSION_SECRET`
4. Configure proper CORS settings if needed
5. Use a process manager like PM2

### Environment Variables for Production

```
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-very-secure-secret-key
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/scoutmate
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team or create an issue in the repository.
