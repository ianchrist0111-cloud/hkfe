import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './AuthPages.module.css';
import { api } from '../lib/api';

type VerificationStatus = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const started = useRef(false);
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing or invalid. Please request a new email.');
      return;
    }

    let active = true;

    const verify = async () => {
      try {
        const response = await api.verifyEmailLink(token);

        if (!active) return;

        if (response.success) {
          setStatus('success');
          setMessage('Your email address has been verified successfully. You can now sign in.');
        } else {
          setStatus('error');
          setMessage(
            response.error?.message ||
              'This verification link is invalid, expired, or has already been used.'
          );
        }
      } catch {
        if (!active) return;
        setStatus('error');
        setMessage('We could not verify your email. Please try again or request a new link.');
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <main className={styles.card}>
        <header className={styles.cardHeader}>
          <h1>
            {status === 'success'
              ? 'Email Verified'
              : status === 'error'
                ? 'Verification Unsuccessful'
                : 'Verify Your Email'}
          </h1>
          <p>{message}</p>
        </header>

        {status === 'loading' && (
          <div className={styles.spinnerLarge} role="status" aria-label="Verifying email" />
        )}

        {status === 'success' && (
          <div className={styles.checkCircle} aria-hidden="true">✓</div>
        )}

        {status === 'error' && (
          <div className={styles.errorAlert} role="alert">{message}</div>
        )}

        <div className={styles.form}>
          {status === 'success' ? (
            <Link to="/login" className={styles.btnSubmit}>
              Continue to Login
            </Link>
          ) : status === 'error' ? (
            <Link to="/login" className={styles.createAccountBtn}>
              Back to Login
            </Link>
          ) : null}
        </div>

        {status === 'error' && (
          <footer className={styles.cardFooter}>
            <p className={styles.cardFooterText}>
              If your link has expired, return to registration or contact support for help.
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}
