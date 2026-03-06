// backend/middleware/requireRole.js
module.exports = function requireRole(role) {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (String(user.role) !== String(role)) {
      return res.status(403).json({ success: false, message: "Owner only" });
    }

    next();
  };
};
