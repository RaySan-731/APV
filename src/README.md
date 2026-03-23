# Src Directory

React/TypeScript source files from the original Vite-based frontend build. Currently **not in use** but retained for reference.

## Subdirectories

- **components/** - React components for various pages and layouts.
  - `landing/` - CTA, Footer, Hero, Navbar, Programs components for the landing page.
  - `layout/` - AppSidebar, DashboardLayout components for dashboard structure.
  - `ui/` - Reusable UI components (buttons, inputs, modals, etc.) from shadcn/ui.

- **pages/** - Page-level components (Dashboard, Index, Login, NotFound).

- **hooks/** - Custom React hooks (use-mobile, use-toast).

- **lib/** - Utility functions (utils.ts).

- **types/** - TypeScript type definitions.

## Status

The application now uses **Express + EJS templates** instead of React. The `src/` folder is kept for:
1. Reference and future reuse.
2. Potential future React refactoring.
3. Historical continuity.

**Server routes render EJS templates from `views/` and serve static assets from `public/`.**
The React build output (if any) is in `dist/` and not actively served by the Node.js backend.
