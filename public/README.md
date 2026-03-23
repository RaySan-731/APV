# Public Directory

Static assets (CSS, JavaScript, images, favicon) served directly to browsers without processing.

## Subdirectories

- **css/** - Stylesheets for the website.
  - `styles.css` - Main stylesheet with responsive design, color scheme, component styles.

- **js/** - Client-side JavaScript files.
  - `main.js` - General utilities: mobile nav toggle, smooth scrolling, form validation, sidebar handling.
  - `dashboard.js` - Dashboard-specific interactions (if applicable).

## Usage

Files in this directory are served by Express static middleware and are accessed via root-relative paths:
```html
<link rel="stylesheet" href="/css/styles.css">
<script src="/js/main.js"></script>
```

No server processing occurs; browsers cache these files. Always minify and optimize before production.
