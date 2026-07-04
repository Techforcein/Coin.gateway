// middleware/admin.js
// Must run AFTER the `authenticate` middleware (relies on req.user being
// set). Blocks any request whose JWT role claim isn't 'admin'.

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }
  next();
}

module.exports = requireAdmin;
