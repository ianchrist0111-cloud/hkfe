import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './AuthPages.module.css';
import { api } from '../lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    const res = await api.resetPassword(token, password);
    setLoading(false);
    if (res.success) {
      setDone(true);
      return;
    }
    setError(res.error?.message || 'This reset link is invalid or has expired.');
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.logo}><span className={styles.logoMark}>HK</span><span className={styles.logoText}>FES</span></div>
          <h1>Choose a new password</h1>
          <p>This page uses the private link from your email. The reset key is not shown.</p>
        </div>

        {!token && (
          <div className={styles.errorAlert}>This reset link is missing or no longer valid. Request a new email link from the sign-in page.</div>
        )}

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-gain)', fontWeight: 700 }}>Your password is updated.</p>
            <Link to="/login" className={styles.btnSubmit} style={{ display: 'inline-flex', textDecoration: 'none', marginTop: 12 }}>Return to sign in</Link>
          </div>
        ) : token ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div className={styles.field}>
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            {error && <div className={styles.errorAlert}>{error}</div>}
            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save password'}
            </button>
          </form>
        ) : null}

        <div className={styles.cardFooter}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
