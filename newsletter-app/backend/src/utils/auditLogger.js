const { auditLogs } = require('../store');

let counter = 0;

/**
 * Extracts a normalized actor object from an Express request.
 * Works for both authenticated (user/service) and public (anonymous) requests.
 */
function extractActorFromRequest(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!req.user) {
    return {
      type: 'anonymous',
      userId: null,
      username: null,
      ip,
      clientApp: null,
      roles: [],
    };
  }

  const isService = req.user.azp === 'blog-backend-service';
  const realmRoles = req.user.realm_access?.roles || [];
  const clientRoles = Object.values(req.user.resource_access || {}).flatMap(
    (c) => c.roles || []
  );

  return {
    type: isService ? 'service' : 'user',
    userId: req.user.sub || null,
    username:
      req.user.preferred_username || req.user.email || req.user.sub || null,
    ip,
    clientApp: req.user.azp || null,
    roles: [...new Set([...realmRoles, ...clientRoles])],
  };
}

/**
 * Records an audit log entry in the in-memory store.
 *
 * @param {object} opts
 * @param {string}  opts.action   - Unique event identifier (e.g. SUBSCRIBER_ADDED)
 * @param {string}  opts.severity - INFO | WARNING | ERROR | CRITICAL
 * @param {object}  opts.actor    - Result of extractActorFromRequest()
 * @param {string}  opts.resource - What was affected (e.g. "subscriber:user@x.com")
 * @param {string}  opts.outcome  - SUCCESS | FAILURE | DENIED
 * @param {object}  opts.details  - Arbitrary extra context
 */
function recordAudit({ action, severity = 'INFO', actor, resource, outcome, details = {} }) {
  const entry = {
    logId: ++counter,
    timestamp: new Date().toISOString(),
    action,
    severity,
    actor,
    resource,
    outcome,
    details,
  };
  auditLogs.unshift(entry);
  // Cap at 1000 entries to prevent unbounded memory growth
  if (auditLogs.length > 1000) auditLogs.pop();
  return entry;
}

module.exports = { extractActorFromRequest, recordAudit };
