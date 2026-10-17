import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AuthPages.module.css';
import { useAuthStore, useWalletStore } from '../store';
import { api, setAuthToken } from '../lib/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const [form, setForm] = useState({ email: '', password: '', confirm: '', country: 'US', agree: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyStage, setVerifyStage] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [emailCreated, setEmailCreated] = useState('');

  const strength = (pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    return s;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.includes('@')) e.email = 'Enter a valid email address';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (strength(form.password) < 3) e.password = 'Password must include uppercase, number, and special character';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    if (!form.agree) e.agree = 'You must agree to the Terms of Service';
    return e;
  };

  const handleVerifyEmail = async () => {
    if (!emailCreated) return;
    setServerError('');
    setVerificationLoading(true);
    try {
      const res = await api.verifyOtp(emailCreated, verificationCode.trim(), 'verification');
      if (res.success) {
        const loginRes = await api.login({ email: emailCreated, password: form.password });
        if (loginRes.success && loginRes.data?.token) {
          setAuthToken(loginRes.data.token);
          login(loginRes.data.user, loginRes.data.token);
          useWalletStore.getState().fetchWallet().catch(() => {});
          navigate('/onboarding');
          return;
        }
        setServerError(loginRes.error?.message || 'Verification succeeded, but login could not continue.');
        return;
      }

      setServerError(res.error?.message || 'Invalid verification code.');
    } catch {
      setServerError('Could not confirm the verification code.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!emailCreated) return;
    setServerError('');
    const res = await api.sendOtp(emailCreated, 'verification');
    if (res.success) {
      setServerError('');
      return;
    }
    setServerError(res.error?.message || 'Could not resend the verification code.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);

    try {
      const res = await api.register({
        email: form.email,
        password: form.password,
        firstName: form.email.split('@')[0],
      });

      if (res.success) {
        setEmailCreated(form.email.trim().toLowerCase());
        setVerifyStage(true);
        setVerificationCode('');
        return;
      }

      if (res.error) {
        if (res.error.code === 'NETWORK_ERROR') {
          login({
            id: `user-${Date.now()}`,
            email: form.email,
            firstName: form.email.split('@')[0],
            lastName: '',
            role: 'user',
            kycStatus: 'pending',
            mfaEnabled: false,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          }, 'demo-token');
          navigate('/onboarding');
          return;
        }
        setServerError(res.error.message || 'Registration failed.');
      }
    } catch {
      login({
        id: `user-${Date.now()}`,
        email: form.email,
        firstName: form.email.split('@')[0],
        lastName: '',
        role: 'user',
        kycStatus: 'pending',
        mfaEnabled: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }, 'demo-token');
      navigate('/onboarding');
    } finally {
      setLoading(false);
    }
  };

  const pw_strength = strength(form.password);

  if (verifyStage) {
    return (
      <div className={styles.page}>
        <div className={styles.bg} />
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.logo}><span className={styles.logoMark}>HK</span><span className={styles.logoText}>FES</span></div>
            <h1>Verify your email</h1>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label>Email address</label>
              <input type="email" value={emailCreated} disabled />
            </div>

            <div className={styles.field}>
              <label>Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            {serverError && <div className={styles.errorAlert} style={{ marginTop: 8 }}>{serverError}</div>}

            <button type="button" className={`tapticPress ${styles.btnSubmit}`} onClick={handleVerifyEmail} disabled={verificationLoading || verificationCode.length !== 6}>
              {verificationLoading ? <span className={styles.spinner} /> : 'Verify & Finish Signup'}
            </button>

            <button type="button" className={`tapticPress ${styles.createAccountBtn}`} onClick={handleResendCode} style={{ marginTop: 12 }}>
              Resend code
            </button>
          </div>

          <div className={styles.cardFooter}>
            <div className={styles.cardFooterText}>
              <span>Need to change your email?</span>
            </div>
            <button type="button" className={`tapticPress ${styles.createAccountBtn}`} onClick={() => { setVerifyStage(false); setServerError(''); setVerificationCode(''); }}>
              Back to sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.logo}><span className={styles.logoMark}>HK</span><span className={styles.logoText}>FES</span></div>
          <h1>Create your account</h1>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email address</label>
            <input type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={errors.email ? styles.inputError : ''} />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>

          <div className={styles.field}>
            <label>Password</label>
            <input type="password" placeholder="Min. 8 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={errors.password ? styles.inputError : ''} />
            {form.password && (
              <div className={styles.strengthBar}>
                <div className={styles.strengthFill} data-strength={pw_strength} style={{ width: `${pw_strength * 25}%` }} />
              </div>
            )}
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>

          <div className={styles.field}>
            <label>Confirm password</label>
            <input type="password" placeholder="Repeat your password" value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className={errors.confirm ? styles.inputError : ''} />
            {errors.confirm && <span className={styles.error}>{errors.confirm}</span>}
          </div>

          <div className={styles.field}>
            <label>Country</label>
            <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="HK">Hong Kong</option>
              <option value="SG">Singapore</option>
              <option value="AU">Australia</option>
              <option value="CA">Canada</option>
              <option value="AE">United Arab Emirates</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="CH">Switzerland</option>
              <option value="JP">Japan</option>
            </select>
          </div>

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.agree} onChange={e => setForm(f => ({ ...f, agree: e.target.checked }))} />
            <span>I agree to the <a>Terms of Service</a> and <a>Privacy Policy</a></span>
          </label>
          {errors.agree && <span className={styles.error}>{errors.agree}</span>}
          {serverError && <div className={styles.errorAlert} style={{ marginTop: 8 }}>{serverError}</div>}

          <button type="submit" className={`tapticPress ${styles.btnSubmit}`} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : 'Create Account'}
          </button>
        </form>

        <div className={styles.cardFooter}>
          <div className={styles.cardFooterText}>
            <span>Already have an account?</span>
          </div>
          <button
            type="button"
            className={`tapticPress ${styles.createAccountBtn}`}
            onClick={() => navigate('/login')}
          >
            Sign In to Existing Account
          </button>
        </div>
      </div>
    </div>
  );
}
