import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AuthPages.module.css';
import { useAuthStore, useWalletStore, useTradesStore } from '../store';
import { api, setAuthToken } from '../lib/api';

const DEMO_PERSONAS = [
  { label: '🛡️ Admin Sam', email: 'admin@hkfes.com', password: 'AdminPassword123!', role: 'admin' as const, kycStatus: 'approved' as const, firstName: 'Sam', lastName: 'Vance', badge: 'Compliance Admin' },
  { label: '👑 Super Admin', email: 'superadmin@hkfes.com', password: 'SuperAdmin123!', role: 'super_admin' as const, kycStatus: 'approved' as const, firstName: 'Chief', lastName: 'Admin', badge: 'Root Owner' },
  { label: '📈 Trader Alex', email: 'alex@hkfes.com', password: 'Password123!', role: 'user' as const, kycStatus: 'approved' as const, firstName: 'Alex', lastName: 'Chen', badge: 'Day Trader ($10k)' },
  { label: '🤖 Quant Maya', email: 'maya@hkfes.com', password: 'Password123!', role: 'user' as const, kycStatus: 'approved' as const, firstName: 'Maya', lastName: 'Lin', badge: 'Bot Trader ($25k)' },
  { label: '💰 Investor Jordan', email: 'jordan@hkfes.com', password: 'Password123!', role: 'user' as const, kycStatus: 'approved' as const, firstName: 'Jordan', lastName: 'Taylor', badge: 'Vault Investor ($12k)' },
  { label: '💎 VIP Elena', email: 'elena@hkfes.com', password: 'Password123!', role: 'user' as const, kycStatus: 'approved' as const, firstName: 'Elena', lastName: 'Rostova', badge: 'Institutional ($100k)' },
  { label: '⏳ Pending Lucas', email: 'lucas@hkfes.com', password: 'Password123!', role: 'user' as const, kycStatus: 'pending' as const, firstName: 'Lucas', lastName: 'Wright', badge: 'KYC In Review' },
  { label: '❌ Rejected Sarah', email: 'sarah@hkfes.com', password: 'Password123!', role: 'user' as const, kycStatus: 'rejected' as const, firstName: 'Sarah', lastName: 'Connor', badge: 'KYC Rejected' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [mfa, setMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePersona, setActivePersona] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'sent'>('request');
  const [forgotMethod, setForgotMethod] = useState<'email' | 'admin' | null>(null);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSelectPersona = (p: typeof DEMO_PERSONAS[0]) => {
    setForm({ email: p.email, password: p.password, remember: true });
    setError('');
  };

  const executeLocalFallback = (email: string, firstName: string, lastName: string, role: 'user' | 'admin' | 'super_admin', kycStatus: 'pending' | 'approved' | 'rejected') => {
    const isAdmin = role === 'admin' || role === 'super_admin';
    login({
      id: `${role}-${email.replace(/[^a-zA-Z0-9]/g, '')}`,
      email,
      firstName,
      lastName,
      role,
      kycStatus,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }, 'demo-token');

    navigate(isAdmin ? '/admin' : '/dashboard');
  };

  const handleAuthSuccess = async (userData: any, token: string) => {
    setAuthToken(token);
    login(userData, token);

    // Eagerly prefetch wallet and positions from server
    useWalletStore.getState().fetchWallet().catch(() => {});
    useTradesStore.getState().fetchPositions().catch(() => {});

    const isAdmin = userData.role === 'admin' || userData.role === 'super_admin';
    navigate(isAdmin ? '/admin' : '/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please enter your email and password.'); return; }
    setLoading(true);

    try {
      const res = await api.login({
        email: form.email,
        password: form.password,
        ...(mfa && mfaCode ? { mfaCode } : {}),
      } as any);

      if (res.success && res.data?.token) {
        await handleAuthSuccess(res.data.user, res.data.token);
        return;
      }

      if (res.success && res.data?.mfaRequired) {
        setMfa(true);
        setLoading(false);
        return;
      }

      if (res.error) {
        if (res.error.code === 'NETWORK_ERROR') {
          // Backend is offline, fall back to persona login
          const found = DEMO_PERSONAS.find(p => p.email.toLowerCase() === form.email.toLowerCase());
          if (found) {
            executeLocalFallback(found.email, found.firstName, found.lastName, found.role, found.kycStatus);
          } else {
            const isAdmin = form.email.toLowerCase().includes('admin');
            executeLocalFallback(form.email, form.email.split('@')[0], '', isAdmin ? 'admin' : 'user', 'approved');
          }
          return;
        }
        setError(res.error.message || 'Invalid email or password.');
      }
    } catch {
      // Fallback
      const found = DEMO_PERSONAS.find(p => p.email.toLowerCase() === form.email.toLowerCase());
      if (found) {
        executeLocalFallback(found.email, found.firstName, found.lastName, found.role, found.kycStatus);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (p: typeof DEMO_PERSONAS[0]) => {
    setActivePersona(p.email);
    setForm({ email: p.email, password: p.password, remember: true });
    setLoading(true);
    setError('');
    try {
      const res = await api.login({ email: p.email, password: p.password });
      if (res.success && res.data?.token) {
        await handleAuthSuccess(res.data.user, res.data.token);
        return;
      }

      if (res.success && res.data?.mfaRequired) {
        setMfa(true);
        setLoading(false);
        setActivePersona(null);
        return;
      }

      if (res.error) {
        if (res.error.code === 'NETWORK_ERROR') {
          // Backend is genuinely offline, fall back to simulated persona
          executeLocalFallback(p.email, p.firstName, p.lastName, p.role, p.kycStatus);
          return;
        }
        setError(`Auto-login error: ${res.error.message || 'Invalid credentials'}`);
      }
    } catch (err: any) {
      // If network unreachable, allow fallback
      if (err.message && err.message.includes('Failed to fetch')) {
        executeLocalFallback(p.email, p.firstName, p.lastName, p.role, p.kycStatus);
        return;
      }
      setError(`Auto-login error: ${err.message || 'Server connection failed'}`);
    } finally {
      setLoading(false);
      setActivePersona(null);
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Please enter a valid 6-digit TOTP code.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await api.login({ email: form.email, password: form.password, mfaCode } as any);
    if (res.success && res.data?.token) {
      await handleAuthSuccess(res.data.user, res.data.token);
    } else {
      setError(res.error?.message || 'Invalid MFA code.');
      setLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgotModal(false);
    setForgotStep('request');
    setForgotMethod(null);
    setForgotError('');
    setForgotMsg('');
  };

  const handleForgotSubmit = async (method: 'email' | 'admin') => {
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError('Enter the email on the account.');
      return;
    }
    setForgotLoading(true);
    setForgotMethod(method);
    const res = await api.forgotPassword(forgotEmail.trim(), method);
    setForgotLoading(false);
    if (res.success) {
      setForgotMsg(res.data?.message || 'Request received.');
      setForgotStep('sent');
    } else {
      setForgotError(res.error?.message || 'Failed to process request.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card} style={{ maxWidth: 520 }}>
        <div className={styles.cardHeader}>
          <div className={styles.logo}><span className={styles.logoMark}>HK</span><span className={styles.logoText}>FES</span></div>
          <h1>Welcome back</h1>
          <p>Sign in to your trading terminal account</p>
        </div>

        {/* ── Demo Account Selector (Commented out per requirements) ──
        <div style={{
          marginBottom: '18px',
          background: 'var(--bg-input)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>⚡ Test Persona Quick-Select</span>
            <span style={{ color: 'var(--accent-primary)', fontSize: '10px' }}>Click to Auto-Sign In</span>
          </div>

          <div className={styles.personaGrid}>
            {DEMO_PERSONAS.map(p => {
              const isActive = activePersona === p.email;
              const isSelected = form.email === p.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleQuickLogin(p)}
                  disabled={loading}
                  className="tapticPress"
                  style={{
                    background: isActive ? 'rgba(0, 229, 153, 0.22)' : isSelected ? 'rgba(0, 229, 153, 0.12)' : 'var(--bg-elevated)',
                    border: isActive ? '1px solid var(--accent-primary)' : isSelected ? '1px solid rgba(0, 229, 153, 0.5)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    minHeight: 44,
                    textAlign: 'left',
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '2px',
                    transition: 'all var(--transition-fast)',
                    opacity: loading && !isActive ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                      {isActive ? '⏳ Signing in...' : p.label}
                    </strong>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: p.role === 'admin' || p.role === 'super_admin' ? 'rgba(255, 183, 3, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: p.role === 'admin' || p.role === 'super_admin' ? 'var(--accent-gold)' : 'var(--text-muted)',
                    }}>
                      {p.role.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    {isActive ? 'Validating session with server...' : p.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        ── */}

        {!mfa ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label>Password</label>
                <a
                  className={styles.forgotLink}
                  onClick={() => {
                    setForgotEmail(form.email);
                    setForgotStep('request');
                    setForgotMethod(null);
                    setForgotError('');
                    setForgotMsg('');
                    setShowForgotModal(true);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                placeholder="Your password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.remember}
                onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
              />
              <span>Remember me for 30 days</span>
            </label>

            {error && <div className={styles.errorAlert}>{error}</div>}

            <button type="submit" className={`tapticPress ${styles.btnSubmit}`} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className={styles.mfaBox}>
            <p>Enter the 6-digit MFA TOTP code from your authenticator app (Google Authenticator / Authy)</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value)}
              className={styles.mfaInput}
              autoFocus
            />
            {error && <div className={styles.errorAlert} style={{ marginTop: 8 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className={`tapticPress ${styles.linkBtn}`}
                onClick={() => { setMfa(false); setError(''); }}
              >
                Back
              </button>
              <button
                type="button"
                className={`tapticPress ${styles.btnSubmit}`}
                onClick={handleMfaSubmit}
                disabled={loading}
              >
                {loading ? <span className={styles.spinner} /> : 'Verify & Proceed'}
              </button>
            </div>
          </div>
        )}

        <div className={styles.cardFooter}>
          <div className={styles.cardFooterText}>
            <span>Don't have an account yet?</span>
          </div>
          <button
            type="button"
            className={`tapticPress ${styles.createAccountBtn}`}
            onClick={() => navigate('/register')}
          >
            Create New Account
          </button>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-surface, #111827)',
            border: '1px solid var(--border-subtle, #1f2937)',
            borderRadius: '12px',
            maxWidth: 440,
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--text-primary)' }}>
              {forgotStep === 'sent' ? 'Request received' : 'Reset your password'}
            </h2>

            {forgotStep === 'request' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Choose how to recover the account. A reset key is never shown on this screen.
                </p>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email address</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      marginTop: 4,
                    }}
                  />
                </div>
                {forgotError && <div className={styles.errorAlert}>{forgotError}</div>}
                <button
                  type="button"
                  className={styles.btnSubmit}
                  disabled={forgotLoading}
                  onClick={() => handleForgotSubmit('email')}
                >
                  {forgotLoading && forgotMethod === 'email' ? 'Sending...' : 'Send email link'}
                </button>
                <button
                  type="button"
                  className={styles.btnSubmit}
                  disabled={forgotLoading}
                  onClick={() => handleForgotSubmit('admin')}
                  style={{ background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--border-default)', boxShadow: 'none' }}
                >
                  {forgotLoading && forgotMethod === 'admin' ? 'Sending...' : 'Submit request to admin'}
                </button>
                <button type="button" className={styles.linkBtn} onClick={closeForgot}>
                  Cancel
                </button>
              </div>
            )}

            {forgotStep === 'sent' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {forgotMsg}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  {forgotMethod === 'admin'
                    ? 'Admin and super admin can see this request in the support desk. They will generate a new password and email it to you.'
                    : 'Open the link in that email to choose a new password. The link does not display a reset key.'}
                </p>
                <button type="button" className={styles.btnSubmit} onClick={closeForgot}>
                  Return to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
