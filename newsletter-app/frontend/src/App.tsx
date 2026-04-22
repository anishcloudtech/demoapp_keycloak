import React, { useState, useEffect } from 'react';
import Keycloak from 'keycloak-js';
import Navbar from './components/Navbar';
import NotificationLogs from './components/NotificationLogs';
import AuditLogs from './components/AuditLogs';
import Login from './components/Login';

interface AppProps {
  keycloak: Keycloak;
}

type Tab = 'notifications' | 'audit';

const App: React.FC<AppProps> = ({ keycloak }) => {
  const [activeTab, setActiveTab] = useState<Tab>('notifications');

  // Track critical audit count for the badge on the Audit tab.
  // We derive this from a lightweight re-fetch — the component owns its own data,
  // but we want a badge on the nav tab. Use a simple state seeded when the
  // notification-logs tab is active and the user first authenticates.
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    if (!keycloak.authenticated) return;
    const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? [];
    if (!roles.includes('admin')) return;

    (async () => {
      try {
        await keycloak.updateToken(30);
        const res = await fetch(
          `${(import.meta as any).env?.VITE_NEWSLETTER_API_URL ?? 'http://localhost:4002'}/api/audit/logs`,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const count = (data.logs as any[]).filter((l: any) => l.severity === 'CRITICAL').length;
          setCriticalCount(count);
        }
      } catch {
        // silently ignore — badge is cosmetic
      }
    })();
  }, [keycloak.authenticated]);

  return (
    <div>
      <Navbar keycloak={keycloak} />
      {keycloak.authenticated ? (
        <>
          {/* ── Tab navigation ── */}
          <nav className="tabs-nav" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'notifications'}
              className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              📬 Notification Logs
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'audit'}
              className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              🛡 Audit Logs
              {criticalCount > 0 && (
                <span className="tab-badge" title={`${criticalCount} critical security event(s)`}>
                  {criticalCount}
                </span>
              )}
            </button>
          </nav>

          {/* ── Tab panels ── */}
          <main className="main-content">
            {activeTab === 'notifications' && <NotificationLogs keycloak={keycloak} />}
            {activeTab === 'audit'         && <AuditLogs        keycloak={keycloak} />}
          </main>
        </>
      ) : (
        <Login keycloak={keycloak} />
      )}
    </div>
  );
};

export default App;
