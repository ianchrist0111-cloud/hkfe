import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconPlus,
  IconTrash,
  IconEdit,
  IconUploadCloud,
  IconShieldCheck,
  IconClock,
  IconX,
  IconTelegram,
  IconAlertTriangle,
} from '../../components/common/Icons';
import styles from './Admin.module.css';

interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'super_admin';
  status: string;
  kycStatus: string;
  wallet?: { totalBalance: number };
}

interface DepositWallet {
  id: string;
  asset: string;
  network: string;
  address: string;
  memoOrTag?: string | null;
  qrCodeUrl?: string | null;
  minDeposit: number;
  details?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PlatformConfigData {
  paymentsEnabled: boolean;
  telegramEnabled: boolean;
  telegramHandle: string;
  telegramNumber: string;
  telegramUrl: string;
}

export default function SuperAdminConfigPage() {
  const currentUser = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState<'payments' | 'telegram' | 'team' | 'risk'>('payments');

  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // ─── 1. Platform Global Settings State ─────────────────────
  const [platformConfig, setPlatformConfig] = useState<PlatformConfigData>({
    paymentsEnabled: false,
    telegramEnabled: false,
    telegramHandle: '',
    telegramNumber: '',
    telegramUrl: '',
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // ─── 2. Deposit Wallets State ──────────────────────────────
  const [wallets, setWallets] = useState<DepositWallet[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);

  // Wallet Form State
  const [walletFormAsset, setWalletFormAsset] = useState('USDT');
  const [walletFormNetwork, setWalletFormNetwork] = useState('USDT_TRC20');
  const [walletFormAddress, setWalletFormAddress] = useState('');
  const [walletFormDetails, setWalletFormDetails] = useState('');
  const [walletFormMinDeposit, setWalletFormMinDeposit] = useState('10');
  const [walletFormMemo, setWalletFormMemo] = useState('');
  const [walletFormQrUrl, setWalletFormQrUrl] = useState('');
  const [walletFormIsActive, setWalletFormIsActive] = useState(true);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  // ─── 3. Telegram Form State ────────────────────────────────
  const [tgHandle, setTgHandle] = useState('');
  const [tgNumber, setTgNumber] = useState('');
  const [tgUrl, setTgUrl] = useState('');
  const [tgEnabled, setTgEnabled] = useState(false);

  // ─── 4. Team & Governance State ────────────────────────────
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // ─── 5. Asset Circuit Breaker States ───────────────────────
  const [circuitBreakerTriggered, setCircuitBreakerTriggered] = useState(false);
  const [assetStatuses, setAssetStatuses] = useState<Record<string, boolean>>({
    'BTC/USD': true,
    'ETH/USD': true,
    'EUR/USD': true,
    'GBP/USD': true,
    'NVDA': true,
    'AAPL': true,
    'SPX500': true,
    'NAS100': true,
  });

  // ───────────────────────────────────────────────────────────
  // Data Fetching
  // ───────────────────────────────────────────────────────────
  const fetchAllData = async () => {
    try {
      // 1. Platform Settings
      setLoadingConfig(true);
      const confRes = await api.getAdminPlatformSettings();
      if (confRes.success && confRes.data) {
        setPlatformConfig(confRes.data);
        setTgHandle(confRes.data.telegramHandle || '');
        setTgNumber(confRes.data.telegramNumber || '');
        setTgUrl(confRes.data.telegramUrl || '');
        setTgEnabled(Boolean(confRes.data.telegramEnabled));
      }
    } catch (err: any) {
      console.error('Failed to load platform settings', err);
    } finally {
      setLoadingConfig(false);
    }

    try {
      // 2. Deposit Wallets
      setLoadingWallets(true);
      const walRes = await api.getAdminDepositWallets();
      if (walRes.success && walRes.data) {
        setWallets(walRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load deposit wallets', err);
    } finally {
      setLoadingWallets(false);
    }

    try {
      // 3. Team Users
      setLoadingUsers(true);
      const userRes = await api.getAdminUsers('', 1, 50);
      if (userRes.success && userRes.data?.users) {
        setUsers(userRes.data.users);
      }
    } catch (err: any) {
      console.error('Failed to load users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ───────────────────────────────────────────────────────────
  // 1. Payment Methods Actions
  // ───────────────────────────────────────────────────────────
  const handleTogglePaymentsGlobal = async () => {
    const nextState = !platformConfig.paymentsEnabled;
    try {
      setSavingSettings(true);
      const res = await api.updateAdminPlatformSettings({ paymentsEnabled: nextState });
      if (res.success) {
        setPlatformConfig(prev => ({ ...prev, paymentsEnabled: nextState }));
        notify(
          nextState
            ? '✓ Payment Gateway ENABLED: Traders can now deposit using published deposit methods.'
            : '⚠️ Payment Gateway DISABLED: Deposit page will show maintenance notice.',
          nextState ? 'success' : 'warning'
        );
      }
    } catch (err: any) {
      notify(err.message || 'Failed to update payment status', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenCreateWallet = () => {
    setEditingWalletId(null);
    setWalletFormAsset('USDT');
    setWalletFormNetwork('USDT_TRC20');
    setWalletFormAddress('');
    setWalletFormDetails('');
    setWalletFormMinDeposit('10');
    setWalletFormMemo('');
    setWalletFormQrUrl('');
    setWalletFormIsActive(true);
    setShowWalletModal(true);
  };

  const handleOpenEditWallet = (w: DepositWallet) => {
    setEditingWalletId(w.id);
    setWalletFormAsset(w.asset);
    setWalletFormNetwork(w.network);
    setWalletFormAddress(w.address);
    setWalletFormDetails(w.details || '');
    setWalletFormMinDeposit(String(w.minDeposit || 10));
    setWalletFormMemo(w.memoOrTag || '');
    setWalletFormQrUrl(w.qrCodeUrl || '');
    setWalletFormIsActive(w.isActive);
    setShowWalletModal(true);
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        notify('QR picture size must be under 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setWalletFormQrUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletFormAddress.trim()) {
      notify('Wallet address or destination account is required.', 'error');
      return;
    }

    setWalletSubmitting(true);
    try {
      const payload = {
        asset: walletFormAsset.trim().toUpperCase(),
        network: walletFormNetwork.trim(),
        address: walletFormAddress.trim(),
        details: walletFormDetails.trim() || undefined,
        minDeposit: parseFloat(walletFormMinDeposit) || 10,
        memoOrTag: walletFormMemo.trim() || undefined,
        qrCodeUrl: walletFormQrUrl.trim() || undefined,
        isActive: walletFormIsActive,
      };

      if (editingWalletId) {
        const res = await api.updateAdminDepositWallet(editingWalletId, payload);
        if (res.success) {
          notify(`✓ Deposit method for ${payload.asset} (${payload.network}) updated.`);
          setShowWalletModal(false);
          const walRes = await api.getAdminDepositWallets();
          if (walRes.success) setWallets(walRes.data);
        }
      } else {
        const res = await api.createAdminDepositWallet(payload);
        if (res.success) {
          notify(`✓ New deposit method for ${payload.asset} (${payload.network}) published!`);
          setShowWalletModal(false);
          const walRes = await api.getAdminDepositWallets();
          if (walRes.success) setWallets(walRes.data);
        }
      }
    } catch (err: any) {
      notify(err.message || 'Failed to save deposit method.', 'error');
    } finally {
      setWalletSubmitting(false);
    }
  };

  const handleToggleWalletActive = async (w: DepositWallet) => {
    try {
      const res = await api.toggleAdminDepositWallet(w.id);
      if (res.success) {
        setWallets(prev => prev.map(item => item.id === w.id ? { ...item, isActive: !item.isActive } : item));
        notify(`Method ${w.asset} (${w.network}) is now ${!w.isActive ? 'ACTIVE' : 'PAUSED'}.`);
      }
    } catch (err: any) {
      notify(err.message || 'Failed to toggle status.', 'error');
    }
  };

  const handleDeleteWallet = async (w: DepositWallet) => {
    if (!window.confirm(`Are you sure you want to delete the deposit method for ${w.asset} (${w.network})?\nAddress: ${w.address}`)) {
      return;
    }
    try {
      const res = await api.deleteAdminDepositWallet(w.id);
      if (res.success) {
        setWallets(prev => prev.filter(item => item.id !== w.id));
        notify(`✓ Deposit method for ${w.asset} removed successfully.`);
      }
    } catch (err: any) {
      notify(err.message || 'Failed to delete deposit method.', 'error');
    }
  };

  // ───────────────────────────────────────────────────────────
  // 2. Telegram Support Actions
  // ───────────────────────────────────────────────────────────
  const handleSaveTelegram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const cleanHandle = tgHandle.trim();
      const cleanNumber = tgNumber.trim();
      let resolvedUrl = tgUrl.trim();
      if (!resolvedUrl) {
        if (cleanHandle) {
          resolvedUrl = `https://t.me/${cleanHandle.replace(/^@/, '')}`;
        } else if (cleanNumber) {
          resolvedUrl = `https://t.me/${cleanNumber.replace(/[^0-9+]/g, '')}`;
        }
      }

      const res = await api.updateAdminPlatformSettings({
        telegramEnabled: tgEnabled,
        telegramHandle: cleanHandle,
        telegramNumber: cleanNumber,
        telegramUrl: resolvedUrl,
      });

      if (res.success) {
        setPlatformConfig(prev => ({
          ...prev,
          telegramEnabled: tgEnabled,
          telegramHandle: cleanHandle,
          telegramNumber: cleanNumber,
          telegramUrl: resolvedUrl,
        }));
        notify(
          tgEnabled
            ? '✓ Telegram Live Support PUBLISHED! It is now visible to all traders.'
            : '✓ Telegram Live Support HIDDEN. Traders will only see standard tickets.',
          tgEnabled ? 'success' : 'warning'
        );
      }
    } catch (err: any) {
      notify(err.message || 'Failed to update Telegram settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // ───────────────────────────────────────────────────────────
  // 3. Team & Role Delegation Actions
  // ───────────────────────────────────────────────────────────
  const handleRoleChange = async (targetUser: PlatformUser, newRole: 'user' | 'admin') => {
    if (targetUser.email === 'superadmin@hkfes.com') {
      alert('The root Super Admin account cannot be modified.');
      return;
    }

    try {
      const res = await api.adminUpdateUser(targetUser.id, { role: newRole });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
        notify(`✓ Role for ${targetUser.firstName} ${targetUser.lastName} updated to "${newRole.toUpperCase()}".`);
      }
    } catch (err) {
      console.error(err);
      notify('Failed to update role', 'error');
    }
  };

  // ───────────────────────────────────────────────────────────
  // 4. Circuit Breakers Actions
  // ───────────────────────────────────────────────────────────
  const toggleAssetTrading = (symbol: string) => {
    setAssetStatuses(prev => {
      const updated = !prev[symbol];
      notify(`Asset ${symbol} trading status updated to ${updated ? 'ENABLED' : 'HALTED (Circuit Breaker)'}.`, updated ? 'success' : 'warning');
      return { ...prev, [symbol]: updated };
    });
  };

  const handleEmergencyHalt = () => {
    setCircuitBreakerTriggered(true);
    setAssetStatuses(prev => {
      const halted: Record<string, boolean> = {};
      Object.keys(prev).forEach(k => { halted[k] = false; });
      return halted;
    });
    notify('⚠️ EMERGENCY CIRCUIT BREAKER ACTIVATED: All order execution halted.', 'error');
  };

  const handleEmergencyRestore = () => {
    setCircuitBreakerTriggered(false);
    setAssetStatuses(prev => {
      const restored: Record<string, boolean> = {};
      Object.keys(prev).forEach(k => { restored[k] = true; });
      return restored;
    });
    notify('✓ System restored: Normal algorithmic trading resumed.');
  };

  const totalPaperLiabilities = users.reduce((acc, u) => acc + (u.wallet?.totalBalance || 0), 0);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem' }}>👑</span>
            <h1 style={{ margin: 0 }}>Super Admin Governance & Configuration</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Control client payment gateways, publish live Telegram channels, delegate staff permissions, and manage solvency.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {circuitBreakerTriggered ? (
            <button
              className={styles.actionBtn}
              style={{ background: 'var(--color-gain)', color: '#fff', borderColor: 'var(--color-gain)', fontWeight: 700 }}
              onClick={handleEmergencyRestore}
            >
              ✓ Restore All Trading
            </button>
          ) : (
            <button
              className={styles.actionBtn}
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-loss)', borderColor: 'rgba(239, 68, 68, 0.4)', fontWeight: 700 }}
              onClick={handleEmergencyHalt}
            >
              ⚠️ Emergency Kill Switch
            </button>
          )}
        </div>
      </div>

      {/* Global Notifications / Alert Banner */}
      {notification && (
        <div style={{
          background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : notification.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${notification.type === 'error' ? 'var(--color-loss)' : notification.type === 'warning' ? 'var(--accent-gold)' : 'var(--color-gain)'}`,
          color: notification.type === 'error' ? 'var(--color-loss)' : notification.type === 'warning' ? 'var(--accent-gold)' : 'var(--color-gain)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* High-Level Institutional Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>💳</span>
            <span className={styles.statChange} style={{ color: platformConfig.paymentsEnabled ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {platformConfig.paymentsEnabled ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className={styles.statValue}>
            {wallets.filter(w => w.isActive).length} Active
          </div>
          <div className={styles.statLabel}>Deposit Methods Configured</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>📱</span>
            <span className={styles.statChange} style={{ color: platformConfig.telegramEnabled ? 'var(--color-gain)' : 'var(--text-muted)' }}>
              {platformConfig.telegramEnabled ? 'PUBLISHED' : 'HIDDEN'}
            </span>
          </div>
          <div className={styles.statValue} style={{ fontSize: 'var(--text-lg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {platformConfig.telegramHandle || (platformConfig.telegramEnabled ? 'Direct Link' : 'Hidden')}
          </div>
          <div className={styles.statLabel}>Telegram Support Channel</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>🏦</span>
            <span className={styles.statChange} style={{ color: 'var(--color-gain)' }}>100% Backed</span>
          </div>
          <div className={styles.statValue}>
            ${Math.round(totalPaperLiabilities).toLocaleString()}
          </div>
          <div className={styles.statLabel}>Platform User Liabilities</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>🛡️</span>
            <span className={styles.statChange}>Active</span>
          </div>
          <div className={styles.statValue}>
            {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length} Staff
          </div>
          <div className={styles.statLabel}>Authorized Admin Accounts</div>
        </div>
      </div>

      {/* Super Admin Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '2px',
        overflowX: 'auto',
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          style={{
            background: activeTab === 'payments' ? 'var(--bg-elevated)' : 'transparent',
            border: activeTab === 'payments' ? '1px solid var(--border-default)' : '1px solid transparent',
            borderBottom: activeTab === 'payments' ? '2px solid var(--brand-mint-500)' : '2px solid transparent',
            color: activeTab === 'payments' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>💳</span>
          <span>Payment & Deposit Methods</span>
          {platformConfig.paymentsEnabled ? (
            <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: 'var(--color-gain)', padding: '1px 6px', borderRadius: 4 }}>
              Active
            </span>
          ) : (
            <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.15)', color: 'var(--color-loss)', padding: '1px 6px', borderRadius: 4 }}>
              Disabled
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telegram')}
          style={{
            background: activeTab === 'telegram' ? 'var(--bg-elevated)' : 'transparent',
            border: activeTab === 'telegram' ? '1px solid var(--border-default)' : '1px solid transparent',
            borderBottom: activeTab === 'telegram' ? '2px solid #0088cc' : '2px solid transparent',
            color: activeTab === 'telegram' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconTelegram size={16} color="#0088cc" />
          <span>Telegram Live Support</span>
          {platformConfig.telegramEnabled ? (
            <span style={{ fontSize: '10px', background: 'rgba(0,136,204,0.15)', color: '#0088cc', padding: '1px 6px', borderRadius: 4 }}>
              Visible
            </span>
          ) : (
            <span style={{ fontSize: '10px', background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4 }}>
              Hidden
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          style={{
            background: activeTab === 'team' ? 'var(--bg-elevated)' : 'transparent',
            border: activeTab === 'team' ? '1px solid var(--border-default)' : '1px solid transparent',
            borderBottom: activeTab === 'team' ? '2px solid var(--accent-gold)' : '2px solid transparent',
            color: activeTab === 'team' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>👥</span>
          <span>Team Roles & Governance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('risk')}
          style={{
            background: activeTab === 'risk' ? 'var(--bg-elevated)' : 'transparent',
            border: activeTab === 'risk' ? '1px solid var(--border-default)' : '1px solid transparent',
            borderBottom: activeTab === 'risk' ? '2px solid var(--color-loss)' : '2px solid transparent',
            color: activeTab === 'risk' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚡</span>
          <span>Market Circuit Breakers</span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════ */}
      {/* TAB 1: PAYMENT & DEPOSIT METHODS                          */}
      {/* ═════════════════════════════════════════════════════════ */}
      {activeTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Master Payment Gateway Toggle Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
                  Platform Inbound Payment Gateway
                </h3>
                <span className={`badge ${platformConfig.paymentsEnabled ? 'badge-gain' : 'badge-loss'}`} style={{ fontSize: '11px' }}>
                  {platformConfig.paymentsEnabled ? '● PAYMENTS ONLINE' : '○ DISABLED / MAINTENANCE'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: 640 }}>
                When enabled, clients clicking "Deposit" see your published payment methods below.
                When disabled, dummy details are never shown; clients instead see a secure maintenance notice.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className={styles.actionBtn}
                style={{
                  background: platformConfig.paymentsEnabled ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-gain)',
                  color: platformConfig.paymentsEnabled ? 'var(--color-loss)' : '#07090e',
                  borderColor: platformConfig.paymentsEnabled ? 'rgba(239, 68, 68, 0.4)' : 'var(--color-gain)',
                  fontWeight: 700,
                  padding: '10px 18px',
                  fontSize: 'var(--text-sm)',
                }}
                onClick={handleTogglePaymentsGlobal}
                disabled={savingSettings}
              >
                {platformConfig.paymentsEnabled ? 'Turn OFF Payments' : 'Turn ON Payments'}
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleOpenCreateWallet}
              >
                <IconPlus size={16} />
                <span>Add Deposit Method</span>
              </button>
            </div>
          </div>

          {/* Configured Wallets List */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
                  Published Deposit Wallets & Methods
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Manage the receiving addresses, QR codes, and network instructions shown to traders.
                </p>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {wallets.length} total methods configured
              </span>
            </div>

            {loadingWallets ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading deposit methods...
              </div>
            ) : wallets.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-8) var(--space-4)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-default)',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💳</div>
                <h4 style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>No Deposit Methods Configured</h4>
                <p style={{ margin: '0 0 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                  By default, dummy details are hidden on the user side. Click below to add your first real wallet (e.g. USDT TRC20, BTC, etc.) and publish it to traders.
                </p>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleOpenCreateWallet}
                >
                  <IconPlus size={15} />
                  <span>Add First Deposit Method</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {wallets.map(w => (
                  <div
                    key={w.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: `1px solid ${w.isActive ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                      opacity: w.isActive ? 1 : 0.65,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {/* Method details & address */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: '1 1 380px' }}>
                      {/* Optional QR preview thumbnail */}
                      <div style={{
                        width: 64,
                        height: 64,
                        background: '#ffffff',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid var(--border-default)',
                      }}>
                        {w.qrCodeUrl ? (
                          <img
                            src={w.qrCodeUrl}
                            alt="QR"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(w.address)}`}
                            alt="Auto QR"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                            {w.asset}
                          </strong>
                          <span style={{
                            fontSize: '11px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--brand-mint-500)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                          }}>
                            {w.network}
                          </span>
                          <span className={`badge ${w.isActive ? 'badge-gain' : 'badge-default'}`} style={{ fontSize: '10px' }}>
                            {w.isActive ? 'Active' : 'Paused'}
                          </span>
                          {w.qrCodeUrl && (
                            <span style={{ fontSize: '10px', color: 'var(--accent-gold)' }}>
                              📷 Custom QR
                            </span>
                          )}
                        </div>

                        {/* Address */}
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          background: 'var(--bg-card)',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          wordBreak: 'break-all',
                          marginTop: 2,
                        }}>
                          {w.address}
                        </div>

                        {/* Instructions / details */}
                        {w.details && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                            📝 {w.details}
                          </div>
                        )}

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                          Min Deposit: <strong style={{ color: 'var(--text-primary)' }}>{w.minDeposit} {w.asset}</strong>
                          {w.memoOrTag ? ` • Memo: ${w.memoOrTag}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        style={{
                          fontSize: '11px',
                          padding: '6px 12px',
                          color: w.isActive ? 'var(--color-loss)' : 'var(--color-gain)',
                          borderColor: w.isActive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
                        }}
                        onClick={() => handleToggleWalletActive(w)}
                      >
                        {w.isActive ? 'Pause' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        className={styles.actionBtn}
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                        onClick={() => handleOpenEditWallet(w)}
                      >
                        <IconEdit size={13} style={{ marginRight: 4 }} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className={styles.actionBtn}
                        style={{
                          fontSize: '11px',
                          padding: '6px 10px',
                          color: 'var(--color-loss)',
                          borderColor: 'rgba(239,68,68,0.3)',
                        }}
                        onClick={() => handleDeleteWallet(w)}
                        title="Delete deposit method"
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* TAB 2: TELEGRAM LIVE SUPPORT CONFIGURATION                */}
      {/* ═════════════════════════════════════════════════════════ */}
      {activeTab === 'telegram' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
          {/* Telegram Settings Form */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(0, 136, 204, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0088cc',
              }}>
                <IconTelegram size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
                  Institutional Telegram Helpdesk
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Streamline live support by publishing direct Telegram access to traders.
                </p>
              </div>
            </div>

            {/* Visibility Toggle Callout */}
            <div style={{
              background: tgEnabled ? 'rgba(0, 136, 204, 0.08)' : 'var(--bg-elevated)',
              border: `1px solid ${tgEnabled ? '#0088cc' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  Publish Telegram Option to Clients
                </strong>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {tgEnabled
                    ? '● Visible: Traders see the Telegram desk card in the support modal and help desk.'
                    : '🔒 Hidden: Currently hidden from all traders. Support modal only accepts ticket submissions.'}
                </p>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={tgEnabled}
                  onChange={e => setTgEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#0088cc' }}
                />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: tgEnabled ? '#0088cc' : 'var(--text-muted)' }}>
                  {tgEnabled ? 'PUBLISHED' : 'HIDDEN'}
                </span>
              </label>
            </div>

            <form onSubmit={handleSaveTelegram} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Telegram Username / Handle */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Telegram Support Handle / Username
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px' }}>
                    @
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. hkfes_support or your_desk_handle"
                    value={tgHandle.replace(/^@/, '')}
                    onChange={e => setTgHandle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 30px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Traders will see this username and can copy it or click to launch directly in Telegram.
                </span>
              </div>

              {/* Direct Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Telegram Support Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +1 234 567 8900"
                  value={tgNumber}
                  onChange={e => setTgNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  If you use an official phone number instead of a handle, enter it with country code.
                </span>
              </div>

              {/* Custom Direct URL */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Custom Direct Telegram URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate from handle (e.g. https://t.me/your_handle)"
                  value={tgUrl}
                  onChange={e => setTgUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Auto-resolves to: <strong style={{ color: '#0088cc' }}>
                    {tgUrl || (tgHandle ? `https://t.me/${tgHandle.replace(/^@/, '')}` : tgNumber ? `https://t.me/${tgNumber.replace(/[^0-9+]/g, '')}` : 'https://t.me/...')}
                  </strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={savingSettings}
                  style={{ background: '#0088cc', color: '#fff', boxShadow: '0 2px 10px rgba(0, 136, 204, 0.35)' }}
                >
                  <IconTelegram size={16} />
                  <span>{savingSettings ? 'Publishing...' : 'Save & Publish Telegram Settings'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12 }}>
              Trader View Preview
            </div>

            {!tgEnabled ? (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-default)',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>🔒</div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', display: 'block' }}>
                  Telegram Option Is Currently Hidden
                </strong>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Traders will not see any Telegram tabs or links. Toggle "Publish Telegram Option" ON when your support number/handle is ready.
                </p>
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(145deg, rgba(0, 136, 204, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1px solid rgba(0, 136, 204, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#0088cc',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <IconTelegram size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      Institutional Telegram Desk
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--brand-mint-500)', fontWeight: 600 }}>
                      ● Online 24/7
                    </span>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Connect directly with the Official Helpdesk on Telegram for rapid answers, KYC questions, or order assistance.
                </p>

                <div style={{
                  background: 'var(--bg-input)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>Handle: <strong>{tgHandle ? (tgHandle.startsWith('@') ? tgHandle : `@${tgHandle}`) : (tgNumber || '@official_support')}</strong></span>
                  <span style={{ color: 'var(--brand-mint-500)', fontSize: '10px' }}>Verified</span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <a
                    href={tgUrl || (tgHandle ? `https://t.me/${tgHandle.replace(/^@/, '')}` : '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      background: '#0088cc',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      textDecoration: 'none',
                    }}
                  >
                    <IconExternalLink size={13} />
                    <span>Open in Telegram</span>
                  </a>
                  <button
                    type="button"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    onClick={() => {
                      navigator.clipboard?.writeText(tgHandle ? (tgHandle.startsWith('@') ? tgHandle : `@${tgHandle}`) : tgNumber);
                      notify('Preview: Handle copied to clipboard!');
                    }}
                  >
                    <IconCopy size={13} />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* TAB 3: TEAM GOVERNANCE & ROLES                            */}
      {/* ═════════════════════════════════════════════════════════ */}
      {activeTab === 'team' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
            👥 Team Role Delegation & Governance
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Promote verified users to Compliance Admins or revoke administrative access.
          </p>

          {loadingUsers ? (
            <div style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Loading team members...</div>
          ) : (
            <div className={styles.table}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--bg-elevated)',
                fontSize: '10px',
                fontWeight: 'var(--weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--text-muted)',
              }}>
                <span>User</span>
                <span>Current Role</span>
                <span>KYC Status</span>
                <span>Account Status</span>
                <span style={{ textAlign: 'right' }}>Role Delegation Action</span>
              </div>

              {users.map(u => (
                <div
                  key={u.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--border-subtle)',
                    alignItems: 'center',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <div className={styles.userCell}>
                    <div className={styles.userAvatar}>
                      {u.firstName?.[0] || 'U'}{u.lastName?.[0] || 'D'}
                    </div>
                    <div>
                      <strong>{u.firstName} {u.lastName}</strong>
                      <p>{u.email}</p>
                    </div>
                  </div>

                  <div>
                    <span className={`badge ${
                      u.role === 'super_admin' ? 'badge-gold' : u.role === 'admin' ? 'badge-teal' : 'badge-default'
                    }`}>
                      {u.role === 'super_admin' ? '👑 Super Admin' : u.role === 'admin' ? '🛡️ Admin' : '👤 Trader'}
                    </span>
                  </div>

                  <div>
                    <span className={`badge badge-${u.kycStatus === 'approved' ? 'gain' : u.kycStatus === 'pending' ? 'medium' : u.kycStatus === 'not_started' ? 'default' : 'loss'}`}>
                      {u.kycStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <span className={`badge badge-${u.status === 'active' ? 'gain' : 'loss'}`}>
                      {u.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {u.role === 'super_admin' ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-gold)', fontWeight: 600 }}>
                        Root Operator
                      </span>
                    ) : u.role === 'admin' ? (
                      <button
                        className={styles.actionBtn}
                        style={{ color: 'var(--color-loss)', borderColor: 'rgba(239,68,68,0.3)', fontSize: '11px' }}
                        onClick={() => handleRoleChange(u, 'user')}
                      >
                        Demote to User
                      </button>
                    ) : (
                      <button
                        className={styles.actionBtn}
                        style={{ color: 'var(--accent-gold)', borderColor: 'rgba(245,158,11,0.3)', fontSize: '11px' }}
                        onClick={() => handleRoleChange(u, 'admin')}
                      >
                        Promote to Admin 🛡️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* TAB 4: MARKET CIRCUIT BREAKERS                            */}
      {/* ═════════════════════════════════════════════════════════ */}
      {activeTab === 'risk' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
            ⚡ Asset Market Circuit Breakers
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Halt trading instantly on high-volatility assets during simulated market stress.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-3)',
          }}>
            {Object.entries(assetStatuses).map(([sym, isEnabled]) => (
              <div
                key={sym}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px var(--space-4)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{sym}</strong>
                  <span style={{ fontSize: '10px', color: isEnabled ? 'var(--color-gain)' : 'var(--color-loss)', fontWeight: 600 }}>
                    {isEnabled ? '● TRADING ACTIVE' : '■ HALTED'}
                  </span>
                </div>
                <button
                  className={styles.actionBtn}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    background: isEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color: isEnabled ? 'var(--color-loss)' : 'var(--color-gain)',
                    borderColor: isEnabled ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
                  }}
                  onClick={() => toggleAssetTrading(sym)}
                >
                  {isEnabled ? 'Halt Trading' : 'Enable Trading'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT DEPOSIT METHOD                          */}
      {/* ═════════════════════════════════════════════════════════ */}
      {showWalletModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: 540,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: 'var(--shadow-modal)',
            position: 'relative',
          }}>
            <button
              onClick={() => setShowWalletModal(false)}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <IconX size={20} />
            </button>

            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
              {editingWalletId ? 'Edit Deposit Method' : 'Add & Publish Deposit Method'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Configure wallet details, network protocol, and optional QR picture for traders.
            </p>

            <form onSubmit={handleSaveWallet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Asset & Network grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Asset / Coin *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. USDT, BTC, ETH"
                    value={walletFormAsset}
                    onChange={e => setWalletFormAsset(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Network / Protocol *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TRC20, ERC20, SegWit"
                    value={walletFormNetwork}
                    onChange={e => setWalletFormNetwork(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                </div>
              </div>

              {/* Destination Address */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Payment Wallet Address / Account *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Paste your receiving wallet address (e.g. TYDzsYUEpvnYmQk4zGP9s2T7vLqNxVn8W9)"
                  value={walletFormAddress}
                  onChange={e => setWalletFormAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Wallet Details / Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Wallet Details & Trader Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Send ONLY USDT via Tron network. Transfers from other networks will be lost."
                  value={walletFormDetails}
                  onChange={e => setWalletFormDetails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Min Deposit & Memo/Tag */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Minimum Deposit Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="10"
                    value={walletFormMinDeposit}
                    onChange={e => setWalletFormMinDeposit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Memo / Destination Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10029348 (for XRP/BNB)"
                    value={walletFormMemo}
                    onChange={e => setWalletFormMemo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                </div>
              </div>

              {/* QR Picture (Optional) */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  QR Code Picture (Optional)
                </label>
                <div style={{
                  border: '1px dashed var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}>
                  {walletFormQrUrl ? (
                    <div style={{ position: 'relative', width: 64, height: 64, background: '#fff', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={walletFormQrUrl} alt="QR Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 64, background: 'var(--bg-input)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <IconUploadCloud size={24} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="file"
                      ref={qrFileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleQrFileUpload}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => qrFileInputRef.current?.click()}
                      >
                        {walletFormQrUrl ? 'Change QR Image' : 'Upload QR Image'}
                      </button>
                      {walletFormQrUrl && (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--color-loss)' }}
                          onClick={() => setWalletFormQrUrl('')}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      {walletFormQrUrl
                        ? 'Custom QR image selected.'
                        : 'Optional. If omitted, standard QR is auto-generated for the trader from the wallet address.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Toggle Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={walletFormIsActive}
                  onChange={e => setWalletFormIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand-mint-500)' }}
                />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Active & Published immediately to traders
                </span>
              </label>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowWalletModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={walletSubmitting}
                >
                  {walletSubmitting
                    ? 'Saving...'
                    : editingWalletId
                      ? 'Save Changes'
                      : 'Publish Deposit Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
