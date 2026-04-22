const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { auditLogs } = require('../store');
const { extractActorFromRequest, recordAudit } = require('../utils/auditLogger');
const kcEvents = require('../services/keycloakEvents');

const router = express.Router();

/**
 * GET /api/audit/logs — admin only
 *
 * Returns a merged timeline of:
 *  - Local audit events (subscriber actions, notifications, access-denied, …)
 *  - Keycloak user-events (login, logout, register, token refresh, …)
 *  - Keycloak admin-events (create/delete user, role changes, …)
 *
 * Response shape:
 * {
 *   count:              number,
 *   logs:               AuditLog[],       // sorted newest-first
 *   keycloakConfigured: boolean,          // false if KEYCLOAK_ADMIN_CLIENT_ID/SECRET not set
 *   keycloakError:      string|undefined  // present only if fetch failed
 * }
 */
router.get('/logs', verifyToken, requireRole('admin'), async (req, res) => {
  const actor = extractActorFromRequest(req);

  recordAudit({
    action:   'AUDIT_LOGS_VIEWED',
    severity: 'INFO',
    actor,
    resource: 'audit-logs',
    outcome:  'SUCCESS',
    details:  {},
  });

  // ── Local audit logs (already newest-first) ───────────────────────────────
  const localLogs = auditLogs.map((l) => ({ ...l, source: 'local' }));

  // ── Keycloak events ────────────────────────────────────────────────────────
  const keycloakConfigured = kcEvents.isConfigured();
  let kcLogs       = [];
  let keycloakError;

  if (keycloakConfigured) {
    try {
      const token = await kcEvents.getAdminToken();
      const [userEvts, adminEvts] = await Promise.all([
        kcEvents.fetchUserEvents(token),
        kcEvents.fetchAdminEvents(token),
      ]);
      kcLogs = [
        ...userEvts.map(kcEvents.normalizeUserEvent),
        ...adminEvts.map(kcEvents.normalizeAdminEvent),
      ];
    } catch (err) {
      console.error('[audit] Keycloak events fetch failed:', err.message);
      keycloakError = err.message;
    }
  }

  // ── Merge & sort newest-first ─────────────────────────────────────────────
  const merged = [...localLogs, ...kcLogs].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  res.json({
    count: merged.length,
    logs:  merged,
    keycloakConfigured,
    ...(keycloakError && { keycloakError }),
  });
});

module.exports = router;

