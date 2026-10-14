import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  isBiometricEnrolled,
  enrollBiometrics,
  disableBiometrics,
  checkBiometricSupport,
  verifyBiometrics,
} from '../lib/biometrics';
import {
  IconUser,
  IconLock,
  IconBell,
  IconSmartphone,
  IconShieldCheck,
  IconCheck,
  IconX,
  IconAlertCircle
} from '../components/common/Icons';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme, stealthMode, toggleStealthMode, colorblindMode, toggleColorblindMode } = useUIStore();
  const navigate = useNavigate();
  const [section, setSection] = useState<'profile' | 'security' | 'notifications' | 'app'>('profile');
  const [savedToast, setSavedToast] = useState(false);

  // Email verification modal states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyStep, setVerifyStep] = useState<'idle' | 'sent' | 'verifying' | 'success'>('idle');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);

  // Biometrics state
  const [biometricEnabled, setBiometricEnabled] = useState(() => isBiometricEnrolled());
  const [biometricName, setBiometricName] = useState('Face ID / Touch ID');
  const [testBioMsg, setTestBioMsg] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricSupport().then((res) => {
      if (res.type === 'face_id') setBiometricName('Apple Face ID');
      else if (res.type === 'touch_id') setBiometricName('Touch ID');
      else if (res.type === 'fingerprint') setBiometricName('Fingerprint Scan');
    });
  }, []);

  const handleToggleBiometrics = async () => {
    if (biometricEnabled) {
      disableBiometrics();
      setBiometricEnabled(false);
      setTestBioMsg(null);
    } else {
      if (user) {
        const res = await enrollBiometrics({ id: user.id, email: user.email });
        if (res.success) {
          setBiometricEnabled(true);
          setTestBioMsg('Enrolled successfully!');
          setTimeout(() => setTestBioMsg(null), 3000);
        }
      }
    }
  };

  const handleTestBiometrics = async () => {
    setTestBioMsg('Scanning sensor…');
    const res = await verifyBiometrics();
    if (res.success) {
      setTestBioMsg('Verification Successful! ✓');
    } else {
      setTestBioMsg('Scan cancelled or failed.');
    }
    setTimeout(() => setTestBioMsg(null), 3500);
  };

  const sections = [
    { id: 'profile' as const, label: 'Profile', Icon: IconUser },
    { id: 'security' as const, label: 'Security & Auth', Icon: IconLock },
    { id: 'notifications' as const, label: 'Notifications', Icon: IconBell },
    { id: 'app' as const, label: 'Platform & Display', Icon: IconSmartphone },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Settings & Preferences</h1>
          <p className={styles.pageSubtitle}>Manage your account credentials, security preferences, and display settings.</p>
        </div>
        {savedToast && (
          <div className={styles.toastSuccess}>
            <IconCheck size={16} /> Preferences Saved
          </div>
        )}
      </div>

      <div className={styles.layout}>
        {/* Navigation Sidebar */}
        <nav className={styles.nav}>
          {sections.map(s => (
            <button
              key={s.id}
              className={`${styles.navItem} ${section === s.id ? styles.navActive : ''}`}
              onClick={() => setSection(s.id)}
            >
              <s.Icon size={18} />
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className={styles.content}>
          {/* ── PROFILE SECTION ── */}
          {section === 'profile' && (
            <form className={styles.section} onSubmit={handleSave}>
              <div className={styles.sectionHeader}>
                <h3>Account Profile</h3>
                <span className={styles.verifiedBadge}>
                  <IconShieldCheck size={14} color="var(--color-gain)" /> Verified Individual
                </span>
              </div>

              <div className={styles.avatarRow}>
                <div className={styles.avatar}>
                  {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || 'S'}
                </div>
                <div className={styles.avatarMeta}>
                  <strong>{user?.firstName} {user?.lastName}</strong>
                  <span className={styles.emailPill}>{user?.email}</span>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>First Name</label>
                  <input defaultValue={user?.firstName} required />
                </div>
                <div className={styles.field}>
                  <label>Last Name</label>
                  <input defaultValue={user?.lastName} required />
                </div>
                <div className={styles.field}>
                  <div className={styles.emailLabelRow}>
                    <label style={{ margin: 0 }}>Registered Email</label>
                    {user?.emailVerified ? (
                      <span className={styles.verifiedPill}>
                        <IconCheck size={12} color="var(--color-gain)" /> Verified
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={styles.unverifiedPill}>Unverified</span>
                        <button
                          type="button"
                          className={styles.btnVerifyEmail}
                          onClick={() => {
                            setShowVerifyModal(true);
                            setVerifyStep('idle');
                            setVerifyErr(null);
                            setVerifyMsg(null);
                          }}
                        >
                          Verify Now
                        </button>
                      </div>
                    )}
                  </div>
                  <input defaultValue={user?.email} disabled />
                </div>
                <div className={styles.field}>
                  <label>Account Role</label>
                  <input value={user?.role?.toUpperCase() || 'TRADER'} disabled />
                </div>
              </div>

              <div className={styles.sectionFooter}>
                <button type="submit" className={styles.btnSave}>
                  Save Profile Changes
                </button>
              </div>
            </form>
          )}

          {/* Email Verification Modal */}
          {showVerifyModal && (
            <div className={styles.modalBackdrop} onClick={() => setShowVerifyModal(false)}>
              <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>Verify Your Email Address</h3>
                  <button className={styles.closeBtn} onClick={() => setShowVerifyModal(false)}>
                    <IconX size={18} />
                  </button>
                </div>

                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  We will send a 6-digit confirmation code to <strong>{user?.email}</strong>.
                </p>

                {verifyErr && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'var(--color-loss-bg)',
                    border: '1px solid var(--color-loss-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-loss)',
                    fontSize: 'var(--text-xs)'
                  }}>
                    <IconAlertCircle size={16} /> {verifyErr}
                  </div>
                )}

                {verifyMsg && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'var(--color-gain-bg)',
                    border: '1px solid var(--color-gain-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-gain)',
                    fontSize: 'var(--text-xs)'
                  }}>
                    <IconCheck size={16} /> {verifyMsg}
                  </div>
                )}

                {verifyStep === 'idle' && (
                  <button
                    type="button"
                    className={styles.btnSave}
                    style={{ width: '100%' }}
                    onClick={async () => {
                      setVerifyErr(null);
                      setVerifyStep('verifying');
                      try {
                        const res = await api.sendOtp(user?.email || '', 'verification');
                        if (res.success) {
                          setVerifyStep('sent');
                          setVerifyMsg(`Code dispatched to ${user?.email}. Check your email inbox.`);
                        } else {
                          setVerifyStep('idle');
                          setVerifyErr(res.error?.message || 'Failed to send verification code.');
                        }
                      } catch {
                        setVerifyStep('idle');
                        setVerifyErr('Network error sending code.');
                      }
                    }}
                  >
                    Send 6-Digit Verification Code
                  </button>
                )}

                {verifyStep === 'sent' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className={styles.field}>
                      <label>Enter 6-Digit Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 123456"
                        maxLength={6}
                        value={verifyCode}
                        onChange={e => setVerifyCode(e.target.value)}
                        style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className={styles.btnSave}
                        style={{ flex: 1 }}
                        disabled={verifyCode.length < 6}
                        onClick={async () => {
                          setVerifyErr(null);
                          try {
                            const res = await api.verifyOtp(user?.email || '', verifyCode, 'verification');
                            if (res.success) {
                              updateUser({ emailVerified: true });
                              setVerifyStep('success');
                              setVerifyMsg('Email verified successfully!');
                              setTimeout(() => setShowVerifyModal(false), 2000);
                            } else {
                              setVerifyErr(res.error?.message || 'Invalid verification code.');
                            }
                          } catch {
                            setVerifyErr('Failed to verify code.');
                          }
                        }}
                      >
                        Confirm & Verify
                      </button>
                    </div>
                  </div>
                )}

                {verifyStep === 'success' && (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <IconShieldCheck size={48} color="var(--color-gain)" style={{ margin: '0 auto 8px' }} />
                    <h4 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>Account Verified</h4>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      Your email address is now fully verified.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SECURITY SECTION ── */}
          {section === 'security' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Security & Authentication</h3>
              </div>

              <div className={styles.settingRow}>
                <div>
                  <strong>Two-Factor Authentication (2FA)</strong>
                  <p>Require an authenticator code or SMS OTP on each login</p>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" defaultChecked={user?.mfaEnabled ?? true} />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.settingRow}>
                <div>
                  <strong>Hardware Biometrics ({biometricName})</strong>
                  <p>Fast WebAuthn authentication barrier before executing trades and accessing withdrawals</p>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={biometricEnabled}
                    onChange={handleToggleBiometrics}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              {biometricEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: -8, marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleTestBiometrics}
                  >
                    Test {biometricName} Scan ⚡
                  </button>
                  {testBioMsg && (
                    <span style={{ fontSize: '11px', color: 'var(--brand-mint-500)', fontWeight: 600 }}>
                      {testBioMsg}
                    </span>
                  )}
                </div>
              )}

              <div className={styles.settingRow}>
                <div>
                  <strong>Active Sessions</strong>
                  <p>You are signed in on 1 active device (Current Session)</p>
                </div>
                <button type="button" className={styles.btnSecondaryDanger}>
                  Sign Out All Other Sessions
                </button>
              </div>

              <hr className={styles.divider} />

              <button
                type="button"
                className={styles.btnLogout}
                onClick={() => { logout(); navigate('/login'); }}
              >
                Sign Out of HKFES
              </button>
            </div>
          )}

          {/* ── NOTIFICATIONS SECTION ── */}
          {section === 'notifications' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Notification Preferences</h3>
              </div>

              {[
                { title: 'Order Fills & Execution', desc: 'Instant push alert when a limit or market order is executed' },
                { title: 'Yield & Bot Payouts', desc: 'Daily settlement summary of accrued bot earnings' },
                { title: 'Price Volatility Alerts', desc: 'Alerts when watchlist assets move more than ±3.5%' },
                { title: 'Weekly Performance Ledger', desc: 'Weekly audit digest sent to your registered email' },
              ].map(n => (
                <div key={n.title} className={styles.settingRow}>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.desc}</p>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.slider} />
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* ── APP & DISPLAY SECTION ── */}
          {section === 'app' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Display & Accessibility</h3>
              </div>

              <div className={styles.settingRow}>
                <div>
                  <strong>Dark Mode (OLED Void)</strong>
                  <p>Switch between OLED deep charcoal and Federal Slate light mode</p>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.settingRow}>
                <div>
                  <strong>Stealth Balance Mode</strong>
                  <p>Mask sensitive portfolio figures with dots (••••••••) when in public</p>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={stealthMode} onChange={toggleStealthMode} />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.settingRow}>
                <div>
                  <strong>High-Contrast Colorblind Mode</strong>
                  <p>Optically distinct Sky Blue (Gain) and Amber (Loss) technical chart palettes</p>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={colorblindMode} onChange={toggleColorblindMode} />
                  <span className={styles.slider} />
                </label>
              </div>

              <hr className={styles.divider} />

              <div className={styles.sectionHeader}>
                <h3>Platform Infrastructure</h3>
              </div>

              <div className={styles.aboutInfo}>
                <div className={styles.aboutItem}>
                  <span>Engine Architecture</span>
                  <strong>GBM Real-Time 1s Ticks</strong>
                </div>
                <div className={styles.aboutItem}>
                  <span>Security Standard</span>
                  <strong>256-bit AES & JWT</strong>
                </div>
                <div className={styles.aboutItem}>
                  <span>PWA Version</span>
                  <strong>Apex 2.0 (ServiceWorker Active)</strong>
                </div>
                <div className={styles.aboutItem}>
                  <span>Regulatory Standard</span>
                  <strong>US SIPC Partner Ready</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}