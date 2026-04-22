import React, { useEffect, useState } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';

interface Subscriber {
  id: number;
  email: string;
  name: string;
  subscribedAt: string;
}

interface Props {
  keycloak: Keycloak;
}

const SubscriberList: React.FC<Props> = ({ keycloak }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Add-subscriber form state
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [addMessage, setAddMessage] = useState('');

  const fetchSubscribers = async () => {
    setLoading(true);
    setError(null);
    try {
      await keycloak.updateToken(30);
      const { data } = await axios.get<{ count: number; subscribers: Subscriber[] }>(
        `${import.meta.env.VITE_API_URL}/api/subscribers`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setSubscribers(data.subscribers);
      setCount(data.count);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load subscribers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchSubscribers();
  }, [open, keycloak]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStatus('loading');
    setAddMessage('');
    try {
      await axios.post(
        `${import.meta.env.VITE_NEWSLETTER_API_URL}/api/subscribers`,
        { email: addEmail, name: addName }
      );
      setAddStatus('success');
      setAddMessage(`✓ ${addEmail} subscribed successfully.`);
      setAddEmail('');
      setAddName('');
      // Refresh the list
      await fetchSubscribers();
      setTimeout(() => { setAddStatus('idle'); setAddMessage(''); setAddOpen(false); }, 3000);
    } catch (err: any) {
      setAddStatus('error');
      setAddMessage(err.response?.data?.error || 'Failed to add subscriber.');
    }
  };

  // Only render for admins
  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? [];
  if (!roles.includes('admin')) return null;

  return (
    <div className="subscriber-panel">
      <button className="subscriber-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="subscriber-toggle-icon">👥</span>
        <span>{open ? 'Hide Subscribers' : 'View Subscribers'}</span>
        {!open && count > 0 && <span className="subscriber-badge">{count}</span>}
        <span className="subscriber-toggle-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="subscriber-list-body">
          {/* ── Add subscriber form ── */}
          <div className="subscriber-add-bar">
            {!addOpen ? (
              <button className="btn-add-subscriber" onClick={() => setAddOpen(true)}>
                + Add New Subscriber
              </button>
            ) : (
              <form className="subscriber-add-form" onSubmit={handleAddSubscriber}>
                <input
                  className="subscriber-add-input"
                  type="text"
                  placeholder="Name (optional)"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  disabled={addStatus === 'loading'}
                />
                <input
                  className="subscriber-add-input"
                  type="email"
                  placeholder="Email address *"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  required
                  disabled={addStatus === 'loading'}
                />
                <div className="subscriber-add-actions">
                  <button
                    type="submit"
                    className="btn-add-subscriber"
                    disabled={addStatus === 'loading'}
                  >
                    {addStatus === 'loading' ? 'Adding…' : '✓ Add'}
                  </button>
                  <button
                    type="button"
                    className="btn-add-cancel"
                    onClick={() => { setAddOpen(false); setAddStatus('idle'); setAddMessage(''); }}
                    disabled={addStatus === 'loading'}
                  >
                    Cancel
                  </button>
                </div>
                {addMessage && (
                  <p className={`subscriber-add-msg ${addStatus}`}>{addMessage}</p>
                )}
              </form>
            )}
          </div>

          {/* ── Table ── */}
          {loading ? (
            <p className="subscriber-state">Loading subscribers…</p>
          ) : error ? (
            <p className="subscriber-state error">{error}</p>
          ) : subscribers.length === 0 ? (
            <p className="subscriber-state">No subscribers yet.</p>
          ) : (
            <>
              <div className="subscriber-stats">
                <span>Total subscribers: <strong>{count}</strong></span>
              </div>
              <div className="subscriber-table-wrap">
                <table className="subscriber-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Subscribed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s, i) => (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td>{s.name || <span className="text-dim">—</span>}</td>
                        <td>{s.email}</td>
                        <td>{new Date(s.subscribedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SubscriberList;

