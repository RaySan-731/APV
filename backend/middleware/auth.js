/**
 * backend/middleware/auth.js
 * Shared authentication & authorization middleware.
 */

/**
 * Require an authenticated session. Redirects to login or returns 401.
 */
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    const isApiRequest =
      req.xhr ||
      req.headers.accept?.includes('application/json') ||
      req.headers['content-type']?.includes('application/json') ||
      req.path.startsWith('/api/');
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
};

/**
 * Require the 'founder' role.
 */
const requireFounder = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'founder') return next();
  return res.status(403).send('Forbidden: founder role required');
};

/**
 * Require a specific permission.
 * Superuser roles (admin, founder) bypass all permission checks.
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.session.user) {
      const isApiRequest =
        req.xhr ||
        req.headers.accept?.includes('application/json') ||
        req.headers['content-type']?.includes('application/json') ||
        req.path.startsWith('/api/') ||
        (req.path.startsWith('/dashboard/') && (
          req.method === 'POST' ||
          req.headers['content-type']?.includes('application/json')
        ));
      if (isApiRequest) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }

    try {
      // Admin / founder bypass
      if (['admin', 'founder'].includes(req.session.user.role)) {
        return next();
      }

      // At this point the caller (server.js) already requires Permission model
      // if it is needed beyond the role check. Import here to keep this file
      // free of Mongoose UMD coupling.
      const Permission = require('../../models/Permission');
      const staffPermissions = await Permission.findOne({ role: req.session.user.role });

      if (!staffPermissions || !staffPermissions.permissions || !staffPermissions.permissions[permission]) {
        const isApiRequest =
          req.xhr ||
          req.headers.accept?.includes('application/json') ||
          req.headers['content-type']?.includes('application/json') ||
          req.path.startsWith('/api/') ||
          req.path.startsWith('/dashboard/') ||
          (req.method === 'POST' && req.headers['content-type']?.includes('application/json'));
        if (isApiRequest) {
          return res.status(403).json({ success: false, error: 'Access denied. Insufficient permissions.' });
        }
        return res.status(403).render('404', {
          user: req.session.user,
          error: 'Access denied. Insufficient permissions.'
        });
      }
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ success: false, error: 'Permission check failed' });
    }
  };
};

/**
 * Students-per-classroom isolation filter.
 */
const schoolFilter = (req, res, next) => {
  if (req.query && req.query.schoolId) {
    if (req.session.user && req.session.user.role === 'school_admin') {
      // req.schoolId must be set by requireSchoolAdmin before this runs
      if (req.query.schoolId.toString() !== (req.schoolId || '').toString()) {
        return res.status(403).json({ success: false, error: 'Access denied to this school data' });
      }
    }
  }
  next();
};

module.exports = {
  requireAuth,
  requireFounder,
  requirePermission,
  schoolFilter,
};
