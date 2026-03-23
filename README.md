Arrow-Park Ventures (Node + EJS + Static CSS/JS)
===========================================

This repository has been migrated to a plain Node.js server using Express and EJS templates, serving static HTML/CSS/JS from the `public/` directory. The original React/Vite/Tailwind build files were removed or neutralized so the app runs directly with Node.

Quick start
-----------

1. Install dependencies:

```powershell
npm install
```

2. Start the server:

```powershell
npm start
```

3. Open in browser: http://127.0.0.1:3001

Notes
-----
- Views are in `views/` (EJS). Static assets are in `public/`.
- User/booking data is stored as JSON in `data/` for the simplified demo.
- Admin pages exist at `/admin/users` and `/admin/bookings` (founder role required).

If you want me to archive or remove the leftover `src/` React sources, I can move them into a backup folder or delete them — tell me which you prefer.
# Arrow-Park Ventures Management System

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
