// middleware/tenancy.js — Multi-tenancy client_id injection
function requireTenancy(req, res, next) {
  if (!req.user || !req.user.clientId) {
    // Platform admin: clientId = null means cross-client access
    req.clientId = null;
  } else {
    req.clientId = req.user.clientId;
  }
  next();
}

module.exports = { requireTenancy };
