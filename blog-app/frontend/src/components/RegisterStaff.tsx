import React, { useState } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';

interface Props {
  keycloak: Keycloak;
}

type Persona = 'agent' | 'member' | 'staff' | 'admin';

interface FormData {
  email: string;
  firstName: string;
  lastName: string;
  persona: Persona;
  tenantRealm: string;
  ownerSub: string;
}

interface RegisterResult {
  userId: string;
  temporaryPassword: string;
  email: string;
  persona: string;
  tenantRealm: string;
}

const PERSONAS: Persona[] = ['agent', 'member', 'staff', 'admin'];

const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  agent: 'Can manage content on behalf of others',
  member: 'Standard authenticated member with read access',
  staff: 'Internal staff user linked to an owner account',
  admin: 'Full administrative access',
};

const DEFAULT_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'corenroll';

const RegisterStaff: React.FC<Props> = ({ keycloak }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState<FormData>({
    email: '',
    firstName: '',
    lastName: '',
    persona: 'member',
    tenantRealm: DEFAULT_REALM,
    ownerSub: '',
  });



  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const reset = () => {
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      persona: 'member',
      tenantRealm: DEFAULT_REALM,
      ownerSub: '',
    });
    setStatus('idle');
    setMessage('');
    setResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    setResult(null);

    try {
      await keycloak.updateToken(30);
      const { data } = await axios.post<RegisterResult>(
        `${import.meta.env.VITE_API_URL}/api/register-staff`,
        form,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setStatus('success');
      setResult(data);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Registration failed. Check console for details.');
    }
  };

  const handleCopyPassword = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.temporaryPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!open) {
    return (
      <div className="register-staff-trigger">
        <button className="btn-register-staff" onClick={() => setOpen(true)}>
          <span>👤</span> Register New User
        </button>
      </div>
    );
  }

  return (
    <div className="publish-overlay">
      <div className="publish-modal register-staff-modal">
        <div className="publish-modal-header">
          <h2>Register New User</h2>
          <button className="btn-close" onClick={handleClose}>✕</button>
        </div>

        {status === 'success' && result ? (
          <div className="register-staff-result">
            <div className="register-staff-success-icon">✓</div>
            <h3>User Created Successfully</h3>
            <div className="register-staff-result-grid">
              <div className="result-row">
                <span className="result-label">User ID</span>
                <span className="result-value result-mono">{result.userId}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Email</span>
                <span className="result-value">{result.email}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Persona</span>
                <span className="result-value">
                  <span className={`persona-badge persona-badge--${result.persona.toLowerCase()}`}>
                    {result.persona}
                  </span>
                </span>
              </div>
              <div className="result-row">
                <span className="result-label">Realm</span>
                <span className="result-value result-mono">{result.tenantRealm}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Temp Password</span>
                <span className="result-value result-password-row">
                  <code className="result-mono result-password">{result.temporaryPassword}</code>
                  <button
                    type="button"
                    className="btn-copy-password"
                    onClick={handleCopyPassword}
                    title="Copy password"
                  >
                    {copied ? '✓ Copied' : '⎘ Copy'}
                  </button>
                </span>
              </div>
            </div>
            <p className="register-staff-note">
              ⚠ Share the temporary password securely. The user will be required to change it on
              first login.
            </p>
            <button className="btn-primary register-staff-register-another" onClick={reset}>
              Register Another User
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="publish-form register-staff-form">
            {/* ── Row: First & Last name ── */}
            <div className="register-staff-row">
              <label>
                First Name
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="e.g. Jane"
                />
              </label>
              <label>
                Last Name
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="e.g. Smith"
                />
              </label>
            </div>

            {/* ── Email ── */}
            <label>
              Email *
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="user@example.com"
              />
            </label>

            {/* ── Persona ── */}
            <label>
              Persona *
              <select name="persona" value={form.persona} onChange={handleChange} required>
                {PERSONAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {form.persona && (
              <p className="register-staff-hint">{PERSONA_DESCRIPTIONS[form.persona]}</p>
            )}

            {/* ── Tenant Realm ── */}
            <label>
              Tenant Realm *
              <input
                name="tenantRealm"
                value={form.tenantRealm}
                onChange={handleChange}
                required
                placeholder="e.g. CloudTech"
              />
            </label>

            {/* ── Owner Sub — only relevant for STAFF ── */}
            <label>
              Owner Sub (UUID)
              <input
                name="ownerSub"
                value={form.ownerSub}
                onChange={handleChange}
                placeholder={
                  form.persona === 'STAFF'
                    ? 'Required — Keycloak sub of the owning user'
                    : 'Optional — leave blank if not applicable'
                }
              />
            </label>
            {form.persona === 'STAFF' && !form.ownerSub && (
              <p className="register-staff-hint register-staff-hint--warn">
                STAFF persona typically requires an owner sub to link the account.
              </p>
            )}

            {status === 'error' && <p className="publish-error">{message}</p>}

            <div className="publish-form-actions">
              <button type="button" className="btn-outline" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={status === 'loading'}>
                {status === 'loading' ? 'Registering…' : 'Register User'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterStaff;
