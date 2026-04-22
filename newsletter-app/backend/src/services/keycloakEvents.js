/**
 * Keycloak Events Service
 *
 * Fetches user-events (login, logout, register, token-refresh, …) and
 * admin-events (create/update/delete user/role/client, …) from the
 * Keycloak Admin REST API and normalises them into the same shape used
 * by the local audit-log store so the frontend can display everything
 * in one unified timeline.
 *
 * Prerequisites (Keycloak side):
 *  1. Create (or reuse) a confidential client with "Service accounts enabled".
 *  2. In the service account's roles, assign the "view-events" client role
 *     from the "realm-management" client.
 *  3. In Realm Settings → Events → User Events → enable "Save Events".
 *     Optionally enable "Save admin events" too.
 *  4. Set KEYCLOAK_ADMIN_CLIENT_ID and KEYCLOAK_ADMIN_CLIENT_SECRET in .env.
 */

const KEYCLOAK_URL    = process.env.KEYCLOAK_URL    || 'http://localhost:8080';
const KEYCLOAK_REALM  = process.env.KEYCLOAK_REALM  || 'CloudTech';
const ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID;
const ADMIN_CLIENT_SECRET = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;

/** Returns true only when admin credentials are present in env. */
function isConfigured() {
  return !!(ADMIN_CLIENT_ID && ADMIN_CLIENT_SECRET);
}

/** Obtains a short-lived access token via client_credentials. */
async function getAdminToken() {
  const url = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     ADMIN_CLIENT_ID,
      client_secret: ADMIN_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Admin token request failed (${res.status}): ${body}`);
  }

  const { access_token } = await res.json();
  return access_token;
}

/**
 * Fetches Keycloak user-events (login, logout, register, etc.)
 * @param {string} token - Admin access token
 * @param {number} max   - Maximum events to return (default 500)
 */
async function fetchUserEvents(token, max = 500) {
  const url = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/events?max=${max}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`User-events fetch failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Fetches Keycloak admin-events (user/role/client management, realm config, …)
 * @param {string} token - Admin access token
 * @param {number} max   - Maximum events to return (default 200)
 */
async function fetchAdminEvents(token, max = 200) {
  const url = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/admin-events?max=${max}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Admin-events fetch failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Severity helpers ──────────────────────────────────────────────────────────

/** Maps a Keycloak event type string to our Severity enum. */
function severityForUserEvent(type) {
  if (!type) return 'INFO';
  const t = type.toUpperCase();
  if (t === 'LOGIN_ERROR') return 'WARNING';
  if (t.endsWith('_ERROR')) return 'WARNING';
  if (t === 'LOGOUT') return 'INFO';
  if (t === 'LOGIN') return 'INFO';
  return 'INFO';
}

function severityForAdminEvent(operationType, hasError) {
  if (hasError) return 'ERROR';
  if (operationType === 'DELETE') return 'WARNING';
  return 'INFO';
}

// ── Normalisers ───────────────────────────────────────────────────────────────

/**
 * Normalises a Keycloak user-event into our unified audit-log format.
 *
 * Keycloak user-event shape:
 * { id, time (ms), type, realmId, clientId, userId, sessionId,
 *   ipAddress, error, details: { username, redirect_uri, … } }
 */
function normalizeUserEvent(ev) {
  const isError = ev.error != null || (ev.type || '').endsWith('_ERROR');
  return {
    logId:     `kc-${ev.id}`,
    timestamp: new Date(ev.time).toISOString(),
    action:    ev.type || 'UNKNOWN',
    severity:  severityForUserEvent(ev.type),
    actor: {
      type:      'user',
      userId:    ev.userId    || null,
      username:  ev.details?.username || null,
      ip:        ev.ipAddress || 'unknown',
      clientApp: ev.clientId  || null,
      roles:     [],
    },
    resource:  `session:${ev.sessionId ?? 'none'}`,
    outcome:   isError ? 'FAILURE' : 'SUCCESS',
    details: {
      clientId:    ev.clientId,
      sessionId:   ev.sessionId,
      redirectUri: ev.details?.redirect_uri,
      error:       ev.error  || null,
      realmId:     ev.realmId,
      ...ev.details,
    },
    source: 'keycloak',
  };
}

/**
 * Normalises a Keycloak admin-event into our unified audit-log format.
 *
 * Keycloak admin-event shape:
 * { id, time (ms), realmId, operationType, resourceType, resourcePath,
 *   error, representation,
 *   authDetails: { realmId, clientId, userId, ipAddress } }
 */
function normalizeAdminEvent(ev) {
  const isError = ev.error != null;
  // e.g. "CREATE_USER", "DELETE_CLIENT", "UPDATE_ROLE"
  const action = `ADMIN_${(ev.operationType || 'ACTION')}_${(ev.resourceType || 'RESOURCE')}`
    .replace(/-/g, '_')
    .toUpperCase();

  return {
    logId:     `kc-admin-${ev.id}`,
    timestamp: new Date(ev.time).toISOString(),
    action,
    severity:  severityForAdminEvent(ev.operationType, isError),
    actor: {
      type:      ev.authDetails?.clientId === 'admin-cli' ? 'service' : 'user',
      userId:    ev.authDetails?.userId     || null,
      username:  null,
      ip:        ev.authDetails?.ipAddress  || 'unknown',
      clientApp: ev.authDetails?.clientId   || null,
      roles:     [],
    },
    resource:  ev.resourcePath || ev.resourceType || 'unknown',
    outcome:   isError ? 'FAILURE' : 'SUCCESS',
    details: {
      operationType: ev.operationType,
      resourceType:  ev.resourceType,
      resourcePath:  ev.resourcePath,
      error:         ev.error || null,
    },
    source: 'keycloak',
  };
}

module.exports = {
  isConfigured,
  getAdminToken,
  fetchUserEvents,
  fetchAdminEvents,
  normalizeUserEvent,
  normalizeAdminEvent,
};
