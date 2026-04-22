import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity  = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
type Outcome   = 'SUCCESS' | 'FAILURE' | 'DENIED';
type ActorType = 'user' | 'service' | 'anonymous';
type Source    = 'local' | 'keycloak';

interface AuditActor {
  type:      ActorType;
  userId:    string | null;
  username:  string | null;
  ip:        string;
  clientApp: string | null;
  roles:     string[];
}

interface AuditLog {
  logId:     number | string;
  timestamp: string;
  action:    string;
  severity:  Severity;
  actor:     AuditActor;
  resource:  string;
  outcome:   Outcome;
  details:   Record<string, unknown>;
  source?:   Source;
}

interface AuditResponse {
  count:              number;
  logs:               AuditLog[];
  keycloakConfigured: boolean;
  keycloakError?:     string;
}

interface Props { keycloak: Keycloak; }

// ─── Action metadata ──────────────────────────────────────────────────────────

interface ActionMeta {
  label: string;
  icon: string;
  category: string;
  description: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  // ── App: Subscriber ──────────────────────────────────────────────────────
  SUBSCRIBER_ADDED:         { icon: '👤', label: 'Subscriber Added',        category: 'Subscriber',        description: 'A new email address joined the subscriber list.' },
  SUBSCRIBER_DUPLICATE:     { icon: '⚠️', label: 'Duplicate Subscribe',     category: 'Subscriber',        description: 'A subscribe attempt was made with an already-registered email.' },
  SUBSCRIBER_LIST_VIEWED:   { icon: '👁',  label: 'Subscriber List Viewed',  category: 'Subscriber',        description: 'The full subscriber list was retrieved via the API.' },
  SUBSCRIBER_DELETED:       { icon: '🗑',  label: 'Subscriber Removed',      category: 'Subscriber',        description: 'An email address was removed from the subscriber list.' },
  SUBSCRIBER_NOT_FOUND:     { icon: '🔍', label: 'Subscriber Not Found',    category: 'Subscriber',        description: 'A delete was attempted for an email that does not exist.' },
  // ── App: Notifications ───────────────────────────────────────────────────
  NOTIFICATION_SENT:        { icon: '📧', label: 'Notification Dispatched', category: 'Notification',      description: 'A newsletter notification was dispatched to all subscribers.' },
  NOTIFICATION_LOGS_VIEWED: { icon: '📋', label: 'Notification Logs Viewed',category: 'Notification',      description: 'An admin reviewed the notification delivery history.' },
  // ── App: Security / Audit ────────────────────────────────────────────────
  AUDIT_LOGS_VIEWED:        { icon: '🔎', label: 'Audit Logs Viewed',       category: 'Audit',             description: 'An admin retrieved the audit log trail.' },
  UNAUTHORIZED_ACCESS:      { icon: '🚫', label: 'Unauthorized Access',     category: 'Security',          description: 'A request was blocked — caller lacked the required role(s).' },
  VALIDATION_ERROR:         { icon: '⚠️', label: 'Validation Error',        category: 'Validation',        description: 'Invalid or missing input data was submitted to the API.' },
  // ── Keycloak: Authentication ─────────────────────────────────────────────
  LOGIN:                    { icon: '🔑', label: 'Login',                   category: 'Auth',              description: 'A user successfully authenticated via Keycloak.' },
  LOGIN_ERROR:              { icon: '🔒', label: 'Login Failed',            category: 'Auth',              description: 'Authentication attempt failed — bad credentials, blocked account, or MFA failure.' },
  LOGOUT:                   { icon: '🚪', label: 'Logout',                  category: 'Auth',              description: 'A user ended their session.' },
  LOGOUT_ERROR:             { icon: '⚠️', label: 'Logout Error',            category: 'Auth',              description: 'An error occurred while ending a session.' },
  REGISTER:                 { icon: '📝', label: 'Registration',            category: 'Auth',              description: 'A new user account was created via the self-registration flow.' },
  REGISTER_ERROR:           { icon: '⚠️', label: 'Registration Failed',    category: 'Auth',              description: 'A self-registration attempt failed.' },
  // ── Keycloak: Tokens ─────────────────────────────────────────────────────
  REFRESH_TOKEN:            { icon: '🔄', label: 'Token Refreshed',         category: 'Token',             description: 'An access token was renewed using a refresh token.' },
  REFRESH_TOKEN_ERROR:      { icon: '⚠️', label: 'Token Refresh Failed',   category: 'Token',             description: 'Refresh-token renewal failed — token may be expired or revoked.' },
  CODE_TO_TOKEN:            { icon: '🎟', label: 'Code → Token Exchange',   category: 'Token',             description: 'Authorization code was exchanged for an access token (OIDC code flow).' },
  CODE_TO_TOKEN_ERROR:      { icon: '⚠️', label: 'Code Exchange Failed',   category: 'Token',             description: 'Authorization code exchange failed.' },
  CLIENT_LOGIN:             { icon: '⚙', label: 'Service Account Login',   category: 'Token',             description: 'A service account obtained a token via client_credentials grant.' },
  CLIENT_LOGIN_ERROR:       { icon: '⚠️', label: 'Service Login Failed',   category: 'Token',             description: 'A client_credentials grant request failed.' },
  TOKEN_EXCHANGE:           { icon: '🔁', label: 'Token Exchange',          category: 'Token',             description: 'A token was exchanged (impersonation / delegation).' },
  TOKEN_EXCHANGE_ERROR:     { icon: '⚠️', label: 'Token Exchange Failed',  category: 'Token',             description: 'Token exchange request failed.' },
  INTROSPECT_TOKEN:         { icon: '🔍', label: 'Token Introspection',     category: 'Token',             description: 'A client introspected a token to check its validity.' },
  INTROSPECT_TOKEN_ERROR:   { icon: '⚠️', label: 'Introspection Failed',   category: 'Token',             description: 'Token introspection request failed.' },
  // ── Keycloak: Passwords ───────────────────────────────────────────────────
  RESET_PASSWORD:           { icon: '🔓', label: 'Password Reset',          category: 'Password',          description: 'A user reset their password (via email link).' },
  RESET_PASSWORD_ERROR:     { icon: '⚠️', label: 'Password Reset Failed',  category: 'Password',          description: 'Password reset attempt failed.' },
  UPDATE_PASSWORD:          { icon: '🔐', label: 'Password Updated',        category: 'Password',          description: 'A user changed their account password.' },
  UPDATE_PASSWORD_ERROR:    { icon: '⚠️', label: 'Password Update Failed', category: 'Password',          description: 'Password change failed.' },
  SEND_RESET_PASSWORD:      { icon: '📨', label: 'Reset Email Sent',        category: 'Password',          description: 'A password-reset email was dispatched to the user.' },
  // ── Keycloak: Profile / Email ─────────────────────────────────────────────
  UPDATE_EMAIL:             { icon: '✉️', label: 'Email Updated',           category: 'Profile',           description: 'A user changed their email address.' },
  UPDATE_PROFILE:           { icon: '👤', label: 'Profile Updated',         category: 'Profile',           description: 'A user updated their profile information.' },
  VERIFY_EMAIL:             { icon: '✅', label: 'Email Verified',          category: 'Profile',           description: 'A user verified their email address.' },
  VERIFY_EMAIL_ERROR:       { icon: '⚠️', label: 'Email Verify Failed',    category: 'Profile',           description: 'Email verification attempt failed.' },
  SEND_VERIFY_EMAIL:        { icon: '📨', label: 'Verify Email Sent',       category: 'Profile',           description: 'A verification email was dispatched to the user.' },
  DELETE_ACCOUNT:           { icon: '🗑',  label: 'Account Deleted',         category: 'Profile',           description: 'A user deleted their own account.' },
  // ── Keycloak: MFA / TOTP ─────────────────────────────────────────────────
  UPDATE_TOTP:              { icon: '📱', label: 'TOTP Configured',         category: 'MFA',               description: 'A user configured TOTP (authenticator app) on their account.' },
  UPDATE_TOTP_ERROR:        { icon: '⚠️', label: 'TOTP Config Failed',     category: 'MFA',               description: 'TOTP configuration attempt failed.' },
  REMOVE_TOTP:              { icon: '📱', label: 'TOTP Removed',            category: 'MFA',               description: 'TOTP second-factor was removed from the account.' },
  // ── Keycloak: Identity Providers ─────────────────────────────────────────
  IDENTITY_PROVIDER_LOGIN:            { icon: '🔗', label: 'IdP Login',                    category: 'Identity Provider', description: 'User authenticated via an external identity provider (e.g. Google, GitHub).' },
  IDENTITY_PROVIDER_FIRST_LOGIN:      { icon: '🔗', label: 'IdP First Login',               category: 'Identity Provider', description: 'First login via external IdP — new account may have been created.' },
  IDENTITY_PROVIDER_LINK_ACCOUNT:     { icon: '🔗', label: 'IdP Account Linked',            category: 'Identity Provider', description: 'An external identity provider was linked to an existing account.' },
  FEDERATED_IDENTITY_LINK:            { icon: '🔗', label: 'Federated Identity Linked',     category: 'Identity Provider', description: 'A federated identity was associated with a user account.' },
  REMOVE_FEDERATED_IDENTITY:          { icon: '✂️', label: 'Federated Identity Removed',    category: 'Identity Provider', description: 'A linked federated identity was removed from an account.' },
  REMOVE_FEDERATED_IDENTITY_ERROR:    { icon: '⚠️', label: 'Federated Remove Failed',       category: 'Identity Provider', description: 'Attempt to remove federated identity failed.' },
  // ── Keycloak: User-info / Actions ─────────────────────────────────────────
  USER_INFO_REQUEST:         { icon: '📄', label: 'User Info Request',       category: 'Token',             description: 'The UserInfo endpoint was called to retrieve the user profile.' },
  USER_INFO_REQUEST_ERROR:   { icon: '⚠️', label: 'User Info Failed',       category: 'Token',             description: 'UserInfo endpoint request failed.' },
  PERMISSION_TOKEN:          { icon: '🛡',  label: 'Permission Token',        category: 'Token',             description: 'A permission/RPT token was requested.' },
  EXECUTE_ACTION_TOKEN:      { icon: '⚡', label: 'Action Token Executed',   category: 'Auth',              description: 'A short-lived action token (e.g. verify email, password reset) was consumed.' },
  EXECUTE_ACTION_TOKEN_ERROR:{ icon: '⚠️', label: 'Action Token Failed',    category: 'Auth',              description: 'Action token execution failed.' },
  EXECUTE_ACTIONS:           { icon: '⚡', label: 'Required Actions Run',    category: 'Auth',              description: 'Required login actions (verify email, update profile, …) were executed.' },
  EXECUTE_ACTIONS_ERROR:     { icon: '⚠️', label: 'Required Actions Failed', category: 'Auth',              description: 'Required login actions failed.' },
  // ── Keycloak: Admin — User management ────────────────────────────────────
  ADMIN_CREATE_USER:         { icon: '➕', label: 'Admin: User Created',     category: 'User Mgmt',         description: 'An admin created a new user account.' },
  ADMIN_UPDATE_USER:         { icon: '✏️', label: 'Admin: User Updated',     category: 'User Mgmt',         description: 'An admin modified a user account (attributes, status, credentials).' },
  ADMIN_DELETE_USER:         { icon: '🗑',  label: 'Admin: User Deleted',     category: 'User Mgmt',         description: 'An admin permanently deleted a user account.' },
  ADMIN_UPDATE_PASSWORD:     { icon: '🔐', label: 'Admin: Password Set',     category: 'User Mgmt',         description: "An admin set or reset a user's password." },
  ADMIN_ACTION_TOKEN:        { icon: '⚡', label: 'Admin: Action Token',     category: 'User Mgmt',         description: 'An admin triggered a required-action flow for a user.' },
  // ── Keycloak: Admin — Roles ───────────────────────────────────────────────
  ADMIN_CREATE_ROLE:         { icon: '➕', label: 'Admin: Role Created',     category: 'Role Mgmt',         description: 'An admin created a new realm or client role.' },
  ADMIN_UPDATE_ROLE:         { icon: '✏️', label: 'Admin: Role Updated',     category: 'Role Mgmt',         description: 'An admin modified a role.' },
  ADMIN_DELETE_ROLE:         { icon: '🗑',  label: 'Admin: Role Deleted',     category: 'Role Mgmt',         description: 'An admin removed a role.' },
  ADMIN_CREATE_ROLE_MAPPING: { icon: '🔗', label: 'Admin: Role Assigned',    category: 'Role Mgmt',         description: 'An admin assigned one or more roles to a user or group.' },
  ADMIN_DELETE_ROLE_MAPPING: { icon: '✂️', label: 'Admin: Role Revoked',     category: 'Role Mgmt',         description: 'An admin removed role assignments from a user or group.' },
  // ── Keycloak: Admin — Groups ──────────────────────────────────────────────
  ADMIN_CREATE_GROUP:        { icon: '➕', label: 'Admin: Group Created',    category: 'Group Mgmt',        description: 'An admin created a new group.' },
  ADMIN_UPDATE_GROUP:        { icon: '✏️', label: 'Admin: Group Updated',    category: 'Group Mgmt',        description: 'An admin modified a group.' },
  ADMIN_DELETE_GROUP:        { icon: '🗑',  label: 'Admin: Group Deleted',    category: 'Group Mgmt',        description: 'An admin deleted a group.' },
  ADMIN_CREATE_GROUP_MEMBERSHIP: { icon: '🔗', label: 'Admin: User Added to Group',    category: 'Group Mgmt', description: 'An admin added a user to a group.' },
  ADMIN_DELETE_GROUP_MEMBERSHIP: { icon: '✂️', label: 'Admin: User Removed from Group',category: 'Group Mgmt', description: 'An admin removed a user from a group.' },
  // ── Keycloak: Admin — Clients & Realm ────────────────────────────────────
  ADMIN_CREATE_CLIENT:       { icon: '➕', label: 'Admin: Client Created',   category: 'Client Mgmt',       description: 'An admin created a new Keycloak client.' },
  ADMIN_UPDATE_CLIENT:       { icon: '✏️', label: 'Admin: Client Updated',   category: 'Client Mgmt',       description: 'An admin modified a Keycloak client configuration.' },
  ADMIN_DELETE_CLIENT:       { icon: '🗑',  label: 'Admin: Client Deleted',   category: 'Client Mgmt',       description: 'An admin removed a Keycloak client.' },
  ADMIN_UPDATE_REALM:        { icon: '⚙',  label: 'Admin: Realm Updated',    category: 'Realm Mgmt',        description: 'An admin changed realm settings (token lifetimes, brute-force, email, …).' },
};

const getActionMeta = (action: string): ActionMeta =>
  ACTION_META[action] ?? {
    label:       action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    icon:        '📌',
    category:    action.startsWith('ADMIN_') ? 'Keycloak Admin' : 'Other',
    description: 'An unclassified system event was recorded.',
  };

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'];

const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  ERROR:    'Error',
  WARNING:  'Warning',
  INFO:     'Info',
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  SUCCESS: '✓ Success',
  FAILURE: '✗ Failure',
  DENIED:  '⛔ Denied',
};

const NEWSLETTER_API = (import.meta as any).env?.VITE_NEWSLETTER_API_URL ?? 'http://localhost:4002';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

// ─── Component ────────────────────────────────────────────────────────────────

const AuditLogs: React.FC<Props> = ({ keycloak }) => {
  const [logs,               setLogs]               = useState<AuditLog[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [expanded,           setExpanded]           = useState<number | string | null>(null);
  const [keycloakConfigured, setKeycloakConfigured] = useState<boolean | null>(null);
  const [keycloakError,      setKeycloakError]      = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [outcomeFilter,  setOutcomeFilter]  = useState<Outcome  | 'ALL'>('ALL');
  const [sourceFilter,   setSourceFilter]   = useState<Source   | 'ALL'>('ALL');
  const [search,         setSearch]         = useState('');

  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? [];
  const isAdmin = roles.includes('admin');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await keycloak.updateToken(30);
      const { data } = await axios.get<AuditResponse>(
        `${NEWSLETTER_API}/api/audit/logs`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setLogs(data.logs);
      setKeycloakConfigured(data.keycloakConfigured);
      setKeycloakError(data.keycloakError ?? null);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Access denied — Admin role required to view audit logs.');
      } else {
        setError(err.response?.data?.error || 'Failed to load audit logs.');
      }
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (keycloak.authenticated) fetchLogs();
  }, [keycloak.authenticated, fetchLogs]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    logs.length,
    critical: logs.filter((l) => l.severity === 'CRITICAL').length,
    warning:  logs.filter((l) => l.severity === 'WARNING').length,
    today:    logs.filter((l) => isToday(l.timestamp)).length,
    denied:   logs.filter((l) => l.outcome === 'DENIED').length,
    logins:   logs.filter((l) => l.action === 'LOGIN').length,
    fromKc:   logs.filter((l) => l.source === 'keycloak').length,
  }), [logs]);

  const criticalAlerts = useMemo(
    () => logs.filter((l) => l.severity === 'CRITICAL').slice(0, 5),
    [logs]
  );

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (severityFilter !== 'ALL' && l.severity !== severityFilter) return false;
      if (outcomeFilter  !== 'ALL' && l.outcome  !== outcomeFilter)  return false;
      if (sourceFilter   !== 'ALL' && l.source   !== sourceFilter)   return false;
      if (q) {
        const hay = [
          l.action, l.resource, l.actor.username ?? '',
          l.actor.ip, l.actor.clientApp ?? '',
          getActionMeta(l.action).label, getActionMeta(l.action).category,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, severityFilter, outcomeFilter, sourceFilter, search]);

  const toggleExpand = (id: number | string) =>
    setExpanded((prev) => (prev === id ? null : id));

  const clearFilters = () => { setSearch(''); setSeverityFilter('ALL'); setOutcomeFilter('ALL'); setSourceFilter('ALL'); };
  const filtersActive = !!(search || severityFilter !== 'ALL' || outcomeFilter !== 'ALL' || sourceFilter !== 'ALL');

  // ── Guard: non-admin ──────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="access-denied">
        <div className="access-denied-icon">🚫</div>
        <h2>Access Denied</h2>
        <p>
          Your account does not have the <strong>admin</strong> role required to
          view audit logs.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="audit-container">

      {/* ── Page header ── */}
      <div className="audit-header">
        <div>
          <h2 className="audit-title">System Audit Logs</h2>
          <p className="audit-subtitle">
            Complete trail of every action performed across the newsletter system —
            who did it, when, from where, and whether it succeeded.
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchLogs} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="logs-state">Loading audit logs…</div>
      ) : error ? (
        <div className="logs-state error">{error}</div>
      ) : (
        <>
          {/* ── Keycloak setup banner ── */}
          {keycloakConfigured === false && (
            <div className="kc-setup-banner">
              <div className="kc-setup-icon">🔌</div>
              <div className="kc-setup-body">
                <p className="kc-setup-title">Keycloak Events not connected</p>
                <p className="kc-setup-desc">
                  Login, logout, registration, token refresh, and admin events live inside Keycloak.
                  Connect the backend with admin credentials to see them here:
                </p>
                <ol className="kc-setup-steps">
                  <li>In Keycloak Admin → create a <strong>confidential client</strong> with <em>"Service accounts enabled"</em>.</li>
                  <li>Give its service account the <code>view-events</code> role from the <code>realm-management</code> client.</li>
                  <li>In <strong>Realm Settings → Events</strong> enable <strong>"Save Events"</strong> (and optionally "Save admin events").</li>
                  <li>Add <code>KEYCLOAK_ADMIN_CLIENT_ID</code> + <code>KEYCLOAK_ADMIN_CLIENT_SECRET</code> to the newsletter backend <code>.env</code> and restart.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── Keycloak fetch-error notice ── */}
          {keycloakConfigured && keycloakError && (
            <div className="kc-error-banner">
              ⚠️ Keycloak events could not be fetched: <code>{keycloakError}</code>
            </div>
          )}
          {/* ── Stats strip ── */}
          <div className="audit-stats">
            <div className="audit-stat-card stat-total">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total Events</span>
            </div>
            <div className="audit-stat-card stat-today">
              <span className="stat-value">{stats.today}</span>
              <span className="stat-label">Today</span>
            </div>
            <div className="audit-stat-card stat-logins">
              <span className="stat-value">{stats.logins}</span>
              <span className="stat-label">🔑 Logins</span>
            </div>
            <div className="audit-stat-card stat-critical">
              <span className="stat-value">{stats.critical}</span>
              <span className="stat-label">🔴 Critical</span>
            </div>
            <div className="audit-stat-card stat-denied">
              <span className="stat-value">{stats.denied}</span>
              <span className="stat-label">⛔ Denied</span>
            </div>
            <div className="audit-stat-card stat-warning">
              <span className="stat-value">{stats.warning}</span>
              <span className="stat-label">⚠️ Warnings</span>
            </div>
            {stats.fromKc > 0 && (
              <div className="audit-stat-card stat-kc">
                <span className="stat-value">{stats.fromKc}</span>
                <span className="stat-label">🔐 from KC</span>
              </div>
            )}
          </div>

          {/* ── Security alert banner ── */}
          {criticalAlerts.length > 0 && (
            <div className="audit-alert-banner">
              <div className="audit-alert-title">
                🚨 Security Alert — {stats.critical} critical event{stats.critical !== 1 ? 's' : ''} recorded
              </div>
              <div className="audit-alert-list">
                {criticalAlerts.map((a) => (
                  <div key={a.logId} className="audit-alert-item">
                    <span className="audit-alert-action">{getActionMeta(a.action).label}</span>
                    <span className="audit-alert-who">
                      {a.actor.username ?? a.actor.ip}
                    </span>
                    <span className="audit-alert-ts">{formatTs(a.timestamp)}</span>
                    <span className={`audit-outcome-pill denied`}>⛔ Denied</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Filter bar ── */}
          <div className="audit-filter-bar">
            <input
              type="text"
              className="audit-search"
              placeholder="Search action, user, IP, resource, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="audit-filter-group">
              <span className="audit-filter-label">Source:</span>
              {(['ALL', 'local', 'keycloak'] as const).map((s) => (
                <button
                  key={s}
                  className={`audit-chip source-chip-${s} ${sourceFilter === s ? 'active' : ''}`}
                  onClick={() => setSourceFilter(s)}
                >
                  {s === 'ALL' ? 'All' : s === 'local' ? '⚡ App' : '🔐 Keycloak'}
                </button>
              ))}
            </div>

            <div className="audit-filter-group">
              <span className="audit-filter-label">Severity:</span>
              {(['ALL', ...SEVERITY_ORDER] as const).map((s) => (
                <button
                  key={s}
                  className={`audit-chip severity-chip-${s.toLowerCase()} ${severityFilter === s ? 'active' : ''}`}
                  onClick={() => setSeverityFilter(s)}
                >
                  {s === 'ALL' ? 'All' : SEVERITY_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="audit-filter-group">
              <span className="audit-filter-label">Outcome:</span>
              {(['ALL', 'SUCCESS', 'FAILURE', 'DENIED'] as const).map((o) => (
                <button
                  key={o}
                  className={`audit-chip outcome-chip-${o.toLowerCase()} ${outcomeFilter === o ? 'active' : ''}`}
                  onClick={() => setOutcomeFilter(o)}
                >
                  {o === 'ALL' ? 'All' : OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>

            {filtersActive && (
              <button className="audit-chip audit-chip-clear" onClick={clearFilters}>✕ Clear</button>
            )}
          </div>

          {/* ── Results summary ── */}
          <div className="audit-results-bar">
            Showing <strong>{filtered.length}</strong> of <strong>{stats.total}</strong> event{stats.total !== 1 ? 's' : ''}
            {filtered.length !== stats.total && ' (filtered)'}
          </div>

          {/* ── Log list ── */}
          {filtered.length === 0 ? (
            <div className="logs-empty">
              <div className="logs-empty-icon">🔎</div>
              <p>No events match your filters.</p>
              <p className="logs-empty-hint">Try adjusting the severity or outcome filter, or clear the search.</p>
            </div>
          ) : (
            <div className="audit-list">
              {filtered.map((log) => {
                const meta = getActionMeta(log.action);
                const isOpen = expanded === log.logId;
                return (
                  <div key={log.logId} className={`audit-entry severity-border-${log.severity.toLowerCase()}`}>

                    {/* ── Row header ── */}
                    <div
                      className="audit-entry-row"
                      onClick={() => toggleExpand(log.logId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && toggleExpand(log.logId)}
                    >
                      {/* Severity dot */}
                      <span className={`audit-sev-dot sev-${log.severity.toLowerCase()}`} title={log.severity} />

                      {/* Action info */}
                      <div className="audit-entry-action">
                        <span className="audit-action-icon">{meta.icon}</span>
                        <div className="audit-action-text">
                          <span className="audit-action-label">{meta.label}</span>
                          <span className="audit-action-resource">{log.resource}</span>
                        </div>
                      </div>

                      {/* Actor */}
                      <div className="audit-entry-actor">
                        <span className={`audit-actor-type-badge actor-${log.actor.type}`}>
                          {log.actor.type === 'service' ? '⚙ svc' : log.actor.type === 'user' ? '👤 user' : '🌐 anon'}
                        </span>
                        <span className="audit-actor-name">
                          {log.actor.username ?? log.actor.ip}
                        </span>
                      </div>

                      {/* Right side: source badge + timestamp + outcome + expand */}
                      <div className="audit-entry-right">
                        {log.source === 'keycloak' && (
                          <span className="audit-source-badge source-kc">🔐 KC</span>
                        )}
                        <span className="audit-entry-ts">{formatTs(log.timestamp)}</span>
                        <span className={`audit-outcome-pill ${log.outcome.toLowerCase()}`}>
                          {OUTCOME_LABELS[log.outcome]}
                        </span>
                        <span className={`audit-sev-badge sev-badge-${log.severity.toLowerCase()}`}>
                          {log.severity}
                        </span>
                        <span className="log-expand-arrow">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* ── Expanded detail panel ── */}
                    {isOpen && (
                      <div className="audit-detail-panel">
                        {/* Description */}
                        <p className="audit-detail-desc">{meta.description}</p>

                        <div className="audit-detail-grid">

                          {/* Actor card */}
                          <div className="audit-detail-card">
                            <div className="audit-detail-card-title">🧑‍💻 Actor</div>
                            <table className="audit-kv-table">
                              <tbody>
                                <tr><td>Type</td><td>
                                  <span className={`audit-actor-type-badge actor-${log.actor.type}`}>
                                    {log.actor.type}
                                  </span>
                                </td></tr>
                                {log.actor.username && (
                                  <tr><td>Username</td><td className="kv-mono">{log.actor.username}</td></tr>
                                )}
                                {log.actor.userId && (
                                  <tr><td>User ID</td><td className="kv-mono kv-dim">{log.actor.userId}</td></tr>
                                )}
                                <tr><td>IP Address</td><td className="kv-mono">{log.actor.ip}</td></tr>
                                {log.actor.clientApp && (
                                  <tr><td>Client App</td><td className="kv-mono">{log.actor.clientApp}</td></tr>
                                )}
                                {log.actor.roles.length > 0 && (
                                  <tr>
                                    <td>Roles</td>
                                    <td>
                                      <div className="audit-roles-wrap">
                                        {log.actor.roles.map((r) => (
                                          <span key={r} className="audit-role-tag">{r}</span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Event card */}
                          <div className="audit-detail-card">
                            <div className="audit-detail-card-title">📌 Event</div>
                            <table className="audit-kv-table">
                              <tbody>
                                <tr><td>Log ID</td><td className="kv-mono kv-dim">#{log.logId}</td></tr>
                                <tr><td>Action</td><td className="kv-mono">{log.action}</td></tr>
                                <tr><td>Category</td><td>{meta.category}</td></tr>
                                <tr><td>Source</td><td>
                                  {log.source === 'keycloak'
                                    ? <span className="audit-source-badge source-kc">🔐 Keycloak</span>
                                    : <span className="audit-source-badge source-local">⚡ App</span>}
                                </td></tr>
                                <tr><td>Resource</td><td className="kv-mono">{log.resource}</td></tr>
                                <tr><td>Outcome</td>
                                  <td>
                                    <span className={`audit-outcome-pill ${log.outcome.toLowerCase()}`}>
                                      {OUTCOME_LABELS[log.outcome]}
                                    </span>
                                  </td>
                                </tr>
                                <tr><td>Severity</td>
                                  <td>
                                    <span className={`audit-sev-badge sev-badge-${log.severity.toLowerCase()}`}>
                                      {log.severity}
                                    </span>
                                  </td>
                                </tr>
                                <tr><td>Timestamp</td><td className="kv-mono">{formatTs(log.timestamp)}</td></tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Details card */}
                          {Object.keys(log.details).length > 0 && (
                            <div className="audit-detail-card audit-detail-card--full">
                              <div className="audit-detail-card-title">🔎 Details</div>
                              <table className="audit-kv-table">
                                <tbody>
                                  {Object.entries(log.details).map(([k, v]) => (
                                    <tr key={k}>
                                      <td>{k.replace(/([A-Z])/g, ' $1').trim()}</td>
                                      <td className="kv-mono">
                                        {Array.isArray(v)
                                          ? v.join(', ') || '—'
                                          : v === null || v === undefined
                                            ? '—'
                                            : String(v)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogs;
