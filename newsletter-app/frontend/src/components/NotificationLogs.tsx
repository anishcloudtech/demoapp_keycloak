import React, { useEffect, useState, useCallback } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';

interface EmailResult {
  email: string;
  name: string;
  status: 'sent' | 'failed';
  sentAt: string;
}

interface Caller {
  type: 'service' | 'user';
  ip: string;
  host: string;
  clientApp: string;
  publishedBy: string | null;
}

interface NotificationLog {
  logId: number;
  postId: number;
  title: string;
  author: string;
  excerpt: string;
  notifiedAt: string;
  caller?: Caller;
  totalSubscribers: number;
  sentCount: number;
  failedCount: number;
  results: EmailResult[];
}

interface Props {
  keycloak: Keycloak;
}

const NEWSLETTER_API = import.meta.env.VITE_NEWSLETTER_API_URL ?? 'http://localhost:4002';

const NotificationLogs: React.FC<Props> = ({ keycloak }) => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? [];
  const isAdmin = roles.includes('admin');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await keycloak.updateToken(30);
      const { data } = await axios.get<{ count: number; logs: NotificationLog[] }>(
        `${NEWSLETTER_API}/api/notify/logs`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setLogs(data.logs);
      setCount(data.count);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Access denied — Admin role required to view notification logs.');
      } else {
        setError(err.response?.data?.error || 'Failed to load notification logs.');
      }
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (keycloak.authenticated) {
      fetchLogs();
    }
  }, [keycloak.authenticated, fetchLogs]);

  const toggleLog = (logId: number) =>
    setExpandedLog((prev) => (prev === logId ? null : logId));

  if (!isAdmin) {
    return (
      <div className="access-denied">
        <div className="access-denied-icon">🚫</div>
        <h2>Access Denied</h2>
        <p>Your account does not have the <strong>admin</strong> role required to view this page.</p>
      </div>
    );
  }

  return (
    <div className="logs-container">
      <div className="logs-header">
        <div>
          <h2 className="logs-title">Email Notification Logs</h2>
          <p className="logs-subtitle">
            Record of every notification sent to subscribers when a new post is published.
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchLogs} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="logs-state">Loading logs…</div>
      ) : error ? (
        <div className="logs-state error">{error}</div>
      ) : logs.length === 0 ? (
        <div className="logs-empty">
          <div className="logs-empty-icon">📭</div>
          <p>No notification events yet.</p>
          <p className="logs-empty-hint">Publish a post from the blog app to trigger a notification.</p>
        </div>
      ) : (
        <>
          <div className="logs-summary-bar">
            <span>
              <strong>{count}</strong> notification event{count !== 1 ? 's' : ''} recorded
            </span>
          </div>

          <div className="logs-list">
            {logs.map((log) => (
              <div key={log.logId} className="log-event">
                {/* ── Header row ── */}
                <div
                  className="log-event-header"
                  onClick={() => toggleLog(log.logId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleLog(log.logId)}
                >
                  <div className="log-event-meta">
                    <span className="log-event-title">{log.title}</span>
                    <span className="log-event-author">by {log.author}</span>
                  </div>

                  <div className="log-event-right">
                    <span className="log-event-time">
                      {new Date(log.notifiedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {log.totalSubscribers === 0 ? (
                      <span className="log-badge zero">0 subscribers</span>
                    ) : (
                      <span className="log-badge sent">✓ {log.sentCount} sent</span>
                    )}

                    {log.failedCount > 0 && (
                      <span className="log-badge failed">✗ {log.failedCount} failed</span>
                    )}

                    <span className="log-expand-arrow">
                      {expandedLog === log.logId ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                {expandedLog === log.logId && (
                  <div className="log-event-detail">
                    {/* Caller machine info */}
                    {log.caller && (
                      <div className="log-caller-bar">
                        <span className="log-caller-item">
                          <span className={`log-caller-type-badge ${log.caller.type}`}>
                            {log.caller.type === 'service' ? '⚙ M2M' : '👤 User'}
                          </span>
                        </span>
                        <span className="log-caller-sep">·</span>
                        <span className="log-caller-item">
                          <span className="log-caller-label">🖥 Sender</span>
                          <span className="log-caller-value">{log.caller.host}</span>
                        </span>
                        <span className="log-caller-sep">·</span>
                        <span className="log-caller-item">
                          <span className="log-caller-label">📡 IP</span>
                          <span className="log-caller-value">{log.caller.ip}</span>
                        </span>
                        <span className="log-caller-sep">·</span>
                        <span className="log-caller-item">
                          <span className="log-caller-label">⚙ Client App</span>
                          <span className="log-caller-value">{log.caller.clientApp}</span>
                        </span>
                        {log.caller.publishedBy && (
                          <>
                            <span className="log-caller-sep">·</span>
                            <span className="log-caller-item">
                              <span className="log-caller-label">
                                {log.caller.type === 'service' ? '👤 Published by' : '🔑 Caller'}
                              </span>
                              <span className="log-caller-value log-caller-user">{log.caller.publishedBy}</span>
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {log.excerpt && (
                      <p className="log-excerpt">"{log.excerpt}"</p>
                    )}

                    {log.results.length === 0 ? (
                      <p className="logs-state">
                        No subscribers were on the list at the time of this notification.
                      </p>
                    ) : (
                      <div className="log-table-wrap">
                        <table className="log-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Status</th>
                              <th>Sent At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {log.results.map((r, i) => (
                              <tr key={r.email}>
                                <td>{i + 1}</td>
                                <td>{r.name || <span className="text-dim">—</span>}</td>
                                <td>{r.email}</td>
                                <td>
                                  <span className={`status-pill ${r.status}`}>
                                    {r.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                                  </span>
                                </td>
                                <td>
                                  {new Date(r.sentAt).toLocaleString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationLogs;
