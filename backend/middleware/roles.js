function normalizeRole(user) {
  if (!user) return null;
  if (typeof user.normalizedRole === 'function') return user.normalizedRole();
  const role = user.role;
  if (role === 'sales' || role === 'agent' || role === 'owner') return 'publisher';
  return role;
}

/** Expand role aliases so legacy agent/owner checks accept publisher */
function expandAllowed(roles) {
  const allowed = new Set(
    roles.map((r) => (r === 'sales' ? 'publisher' : r === 'agent' || r === 'owner' ? 'publisher' : r))
  );
  // Also accept legacy JWT/roles still stored as agent/owner during transition
  if (allowed.has('publisher')) {
    allowed.add('agent');
    allowed.add('owner');
    allowed.add('sales');
  }
  return allowed;
}

function requireRole(...roles) {
  const allowed = expandAllowed(roles);
  return (req, res, next) => {
    const role = normalizeRole(req.user);
    const raw = req.user?.role;
    if (!role || (!allowed.has(role) && !allowed.has(raw))) {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }
    next();
  };
}

function isPublisher(user) {
  const role = normalizeRole(user);
  return role === 'publisher';
}

module.exports = { requireRole, normalizeRole, isPublisher };
