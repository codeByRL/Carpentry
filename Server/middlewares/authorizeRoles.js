export const authorizeRoles = (...roles) => {
  const normalizedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
        currentRole: req.user?.role || null,
        allowedRoles: normalizedRoles,
      });
    }
    next();
  };
};