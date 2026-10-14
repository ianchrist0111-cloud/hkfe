import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore, useNotificationsStore, useWalletStore, useTradesStore, useServicesStore, useUIStore, usePriceStore } from '../../store';
import { api } from '../../lib/api';
import { ASSETS } from '../../lib/priceEngine';
import { getUSMarketStatus } from '../../lib/marketHours';
import PwaInstallModal from '../ui/PwaInstallModal';
import GlobalNotificationToast from '../common/GlobalNotificationToast';
import NetworkStatusBar from '../common/NetworkStatusBar';
import PullToRefreshIndicator from '../common/PullToRefreshIndicator';
import BiometricLockModal from '../common/BiometricLockModal';
import { useVisualViewport } from '../../hooks/useVisualViewport';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { registerServiceWorker, updateAppBadge } from '../../lib/pushNotifications';
import { isBiometricEnrolled } from '../../lib/biometrics';


import {
  IconDashboard,
  IconTrade,
  IconBot,
  IconPortfolio,
  IconWallet,
  IconEye,
  IconEyeOff,
  IconSun,
  IconMoon,
  IconShieldCheck,
  IconZap,
  IconSliders,
  IconDownload,
  IconSmartphone,
  IconX,
  IconSearch,
  IconBell,
  IconPlus,
  IconCrown,
  IconChevronDown,
  IconAlertCircle,
  IconArrowRight,
  IconHeadphones,
} from '../common/Icons';
import SupportModal, { SupportFloatingLauncher } from '../support/SupportModal';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', Icon: IconDashboard, label: 'Dashboard' },
  { to: '/trade', Icon: IconTrade, label: 'Trade' },
  { to: '/services', Icon: IconBot, label: 'Earn & Bots' },
  { to: '/portfolio', Icon: IconPortfolio, label: 'Portfolio' },
  { to: '/wallet', Icon: IconWallet, label: 'Wallet' },
];

const MOBILE_TAB_ITEMS = [
  { to: '/dashboard', Icon: IconDashboard, label: 'Dashboard' },
  { to: '/trade', Icon: IconTrade, label: 'Trade' },
  { to: '/services', Icon: IconBot, label: 'Earn' },
  { to: '/wallet', Icon: IconWallet, label: 'Wallet' },
];

const BENCHMARK_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XAU/USD', 'NVDA', 'AAPL', 'EUR/USD', 'SPX500'];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const navItems = [
    ...NAV_ITEMS,
    ...(isAdminUser ? [{ to: '/admin', Icon: IconCrown, label: user?.role === 'super_admin' ? 'Super Admin' : 'Compliance Admin' }] : []),
  ];
  const unreadCount = useNotificationsStore(s => s.unreadCount);
  const totalBalance = useWalletStore(s => s.totalBalance);
  const fetchWallet = useWalletStore(s => s.fetchWallet);
  const fetchTransactions = useWalletStore(s => s.fetchTransactions);
  const fetchPositions = useTradesStore(s => s.fetchPositions);
  const fetchHistory = useTradesStore(s => s.fetchHistory);
  const fetchSubscriptions = useServicesStore(s => s.fetchSubscriptions);
  const { theme, toggleTheme, stealthMode, toggleStealthMode, colorblindMode, toggleColorblindMode } = useUIStore();
  const ticks = usePriceStore(s => s.ticks);

  // Sync state with backend on mount & whenever user changes
  useEffect(() => {
    if (user) {
      api.getMe().then((res) => {
        if (res.success && res.data) {
          useAuthStore.getState().updateUser(res.data);
        }
      }).catch(() => {});
      fetchWallet();
      fetchTransactions();
      fetchPositions();
      fetchHistory();
      fetchSubscriptions();
    }
  }, [user?.id]);


  // Activate visual viewport dynamic tracking for iOS virtual keyboard
  useVisualViewport();

  // Register production service worker on mount
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Synchronize native OS app badge with unread notification count
  useEffect(() => {
    updateAppBadge(unreadCount);
  }, [unreadCount]);

  // Pull-to-Refresh on mobile content
  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        fetchWallet(),
        fetchPositions(),
        fetchHistory(),
        fetchSubscriptions(),
      ]);
    },
  });

  const [showInstall, setShowInstall] = useState(false);
  const [showBiometricLock, setShowBiometricLock] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportModalConfig, setSupportModalConfig] = useState<{ category?: string; subject?: string; message?: string }>({});
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [dismissIosBanner, setDismissIosBanner] = useState(false);
  const [marketStatus, setMarketStatus] = useState(() => getUSMarketStatus());

  // Listen for open-support-modal events from other components (like KYC inquiry)
  useEffect(() => {
    const handleOpenSupport = (e: any) => {
      if (e.detail) {
        setSupportModalConfig(e.detail);
      }
      setShowSupport(true);
    };
    window.addEventListener('open-support-modal', handleOpenSupport);
    return () => window.removeEventListener('open-support-modal', handleOpenSupport);
  }, []);

  // Periodically refresh market hours session status

  // Periodically refresh market hours session status
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getUSMarketStatus());
    }, 30000);
    return () => clearInterval(timer);
  }, []);


  // Search & Profile Dropdown state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Detect iOS Safari (not standalone)
  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIos && !isStandalone) {
      setIsIosSafari(true);
    }
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const formatBalance = (n: number) => {
    if (stealthMode) return '$ ••••••••';
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  };

  const filteredAssets = searchQuery.trim()
    ? ASSETS.filter(a =>
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 6)
    : ASSETS.slice(0, 6);

  return (
    <div className={styles.shell}>
      {/* ── Desktop Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo} onClick={() => navigate('/dashboard')}>
            <span className={styles.logoMark}>HK</span>
            <div className={styles.logoTitleGroup}>
              <span className={styles.logoText}>FES</span>
              <span className={styles.marketTag}>PRO • US</span>
            </div>
          </div>
          <div
            className={styles.marketLivePill}
            title={`${marketStatus.label} • ${marketStatus.subLabel}`}
            style={!marketStatus.isOpen ? { borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' } : undefined}
          >
            <span
              className={marketStatus.isOpen ? 'live-pulse' : ''}
              style={!marketStatus.isOpen ? { background: 'var(--color-loss)', boxShadow: 'none' } : undefined}
            />
            <span style={!marketStatus.isOpen ? { color: 'var(--color-loss)' } : undefined}>
              {marketStatus.label}
            </span>
          </div>

        </div>

        {/* Balance Card with Stealth Toggle */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceCardTop}>
            <span className={styles.balanceLabel}>Total Portfolio</span>
            <button
              className={styles.stealthBtn}
              onClick={toggleStealthMode}
              title={stealthMode ? 'Show balance' : 'Hide balance (Stealth)'}
              aria-label="Toggle balance privacy"
            >
              {stealthMode ? <IconEyeOff size={15} /> : <IconEye size={15} />}
            </button>
          </div>
          <span className={`${styles.balanceValue} ${stealthMode ? 'stealth-blur' : ''}`}>
            {formatBalance(totalBalance)}
          </span>
          <div className={styles.balanceActions}>
            <button className={styles.balanceBtn} onClick={() => navigate('/wallet/deposit')}>
              + Deposit
            </button>
            <button className={`${styles.balanceBtn} ${styles.balanceBtnSecondary}`} onClick={() => navigate('/trade')}>
              <IconZap size={14} style={{ marginRight: 4 }} /> Trade
            </button>
          </div>
        </div>

        {/* Navigation items */}
        <nav className={styles.sidebarNav}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <span className={styles.navIcon}><item.Icon size={18} /></span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className={styles.sidebarBottom}>
          <button className={styles.navItem} onClick={() => { setSupportModalConfig({}); setShowSupport(true); }}>
            <span className={styles.navIcon}><IconHeadphones size={18} color="var(--brand-mint-500)" /></span>
            <span className={styles.navLabel}>Support & Desk</span>
          </button>
          <NavLink to="/settings" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            <span className={styles.navIcon}><IconSliders size={18} /></span>
            <span className={styles.navLabel}>Settings & Risk</span>
          </NavLink>
          <button className={styles.navItem} onClick={() => setShowInstall(true)}>
            <span className={styles.navIcon}><IconDownload size={18} /></span>
            <span className={styles.navLabel}>Install PWA App</span>
          </button>
          <button className={styles.navItem} onClick={toggleTheme}>
            <span className={styles.navIcon}>{theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}</span>
            <span className={styles.navLabel}>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>

          {/* Compliance & Partner trust mark */}
          <div className={styles.trustBadge}>
            <IconShieldCheck size={16} color="var(--brand-mint-500)" />
            <span>SIPC Member • 256-bit Encrypted</span>
          </div>
        </div>
      </aside>

      {/* ── Main Layout ── */}
      <div className={styles.main}>
        {/* iOS Safari Smart A2HS Banner */}
        {isIosSafari && !dismissIosBanner && (
          <div className={styles.iosBanner}>
            <div className={styles.iosBannerText}>
              <IconSmartphone size={16} color="var(--brand-mint-500)" style={{ verticalAlign: 'middle', marginRight: 6 }} />
              <strong>Add to Home Screen:</strong> Tap <span className={styles.iosShareIcon}>⎋</span> Share, then select <em>Add to Home Screen</em> for full-screen native trading.
            </div>
            <button className={styles.iosBannerClose} onClick={() => setDismissIosBanner(true)} aria-label="Dismiss banner">
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* Institutional Top Header Bar */}
        <header className={styles.topbar}>
          {/* Left: Mobile Brand & Live Market Status (Mobile) + Global Asset Search (Desktop) */}
          <div className={styles.topbarLeft}>
            <div className={styles.mobileTopBrand} onClick={() => navigate('/dashboard')} title="HKFES Dashboard">
              <span className={styles.logoMarkSm}>HK</span>
              <div className={styles.mobileTitleGroup}>
                <span className={styles.mobileLogoText}>HKFES</span>
                <span className={styles.mobileMarketLive}>
                  <span className={marketStatus.isOpen ? 'live-pulse' : ''} style={!marketStatus.isOpen ? { background: 'var(--color-loss)', width: 6, height: 6, display: 'inline-block', borderRadius: '50%' } : { width: 6, height: 6 }} />
                  {marketStatus.label}
                </span>
              </div>
            </div>

            <div className={styles.searchContainer} ref={searchContainerRef}>
              <div className={styles.searchBox}>
                <IconSearch size={14} color="var(--text-muted)" className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search assets (BTC, EUR, NVDA)..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  className={styles.searchInput}
                />
                <kbd className={styles.searchShortcut}>⌘K</kbd>
                {searchQuery && (
                  <button className={styles.clearSearchBtn} onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <IconX size={12} />
                  </button>
                )}
              </div>

              {/* Live Search Dropdown */}
              {showSearchDropdown && (
                <div className={styles.searchDropdown}>
                  <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {searchQuery.trim() ? `Search Results (${filteredAssets.length})` : 'Popular Assets'}
                  </div>
                  {filteredAssets.map(a => {
                    const aTick = ticks[a.symbol];
                    const isUp = (aTick?.changePct ?? 0) >= 0;
                    return (
                      <div
                        key={a.symbol}
                        className={styles.searchDropdownItem}
                        onClick={() => {
                          navigate(`/trade/${encodeURIComponent(a.symbol)}`);
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className={styles.searchItemLeft}>
                          <span className={styles.searchItemSym}>{a.symbol}</span>
                          <span className={styles.searchItemName}>{a.displayName}</span>
                        </div>
                        <div className={styles.searchItemRight}>
                          <span className={`${styles.searchItemPrice} mono`}>
                            {aTick ? `$${aTick.price.toLocaleString(undefined, { minimumFractionDigits: a.pipSize < 0.01 ? 4 : 2 })}` : '—'}
                          </span>
                          <span className={`${styles.searchItemChg} ${isUp ? styles.up : styles.dn}`}>
                            {isUp ? '+' : ''}{(aTick?.changePct ?? 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center: Live Benchmark Ticker Ribbon */}
          <div className={styles.tickerRibbon}>
            {BENCHMARK_SYMBOLS.map(sym => {
              const bTick = ticks[sym];
              const isUp = (bTick?.changePct ?? 0) >= 0;
              return (
                <div
                  key={sym}
                  className={styles.tickerChip}
                  onClick={() => navigate(`/trade/${encodeURIComponent(sym)}`)}
                  title={`Trade ${sym}`}
                >
                  <span className={styles.tickerSym}>{sym}</span>
                  <span className={`${styles.tickerPrice} mono`}>
                    {bTick ? bTick.price.toLocaleString(undefined, { minimumFractionDigits: bTick.price < 5 ? 4 : (sym.includes('EUR') || sym.includes('GBP') ? 4 : 2) }) : '—'}
                  </span>
                  <span className={`${styles.tickerChg} ${isUp ? styles.up : styles.dn}`}>
                    {isUp ? '+' : ''}{(bTick?.changePct ?? 0).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: Deposit CTA, Privacy, Theme, Notifs, Admin, Profile */}
          <div className={styles.topbarRight}>
            <button
              className={styles.topbarDepositBtn}
              onClick={() => navigate('/wallet/deposit')}
              title="Deposit Simulated USD"
            >
              <IconPlus size={14} />
              <span>Deposit</span>
            </button>

            <button
              className={styles.iconBtn}
              onClick={toggleStealthMode}
              title={stealthMode ? 'Show portfolio figures' : 'Hide portfolio figures (Stealth)'}
              aria-label="Toggle stealth privacy"
            >
              {stealthMode ? <IconEyeOff size={17} color="var(--accent-gold)" /> : <IconEye size={17} />}
            </button>

            <button
              className={styles.iconBtn}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>

            <button
              className={styles.iconBtn}
              onClick={() => navigate('/notifications')}
              title="Notifications & Trade Alerts"
              aria-label="Notifications"
            >
              <IconBell size={17} />
              {unreadCount > 0 && (
                <span className={styles.unreadDot}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            <button
              className={styles.iconBtn}
              onClick={() => setShowInstall(true)}
              title="Install PWA & Push Notifications"
              aria-label="Install App"
            >
              <IconSmartphone size={17} color="var(--accent-primary)" />
            </button>

            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <button
                className={styles.adminPortalBtn}
                onClick={() => navigate('/admin')}
                title="Institutional Compliance & Risk Portal"
              >
                {user.role === 'super_admin' ? <IconCrown size={15} color="var(--brand-bot-500)" /> : <IconShieldCheck size={15} color="var(--brand-mint-500)" />}
                <span>{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
              </button>
            )}

            {/* User Profile Pill & Dropdown */}
            <div className={styles.profileMenuContainer} ref={profileMenuRef}>
              <div
                className={`${styles.userProfilePill} ${showProfileMenu ? styles.userProfilePillActive : ''}`}
                onClick={() => setShowProfileMenu(prev => !prev)}
                title="Account Menu"
              >
                <div className={styles.avatarSm}>
                  {user?.firstName?.[0] || 'T'}{user?.lastName?.[0] || 'R'}
                </div>
                <div className={styles.userMetaSm}>
                  <span className={styles.userNameSm}>{user?.firstName || 'Trader'}</span>
                  <span
                    className={`badge ${user?.kycStatus === 'approved' ? 'badge-gain' : user?.kycStatus === 'pending' ? 'badge-medium' : 'badge-default'}`}
                    style={{ fontSize: '9px', padding: '1px 5px' }}
                  >
                    {user?.kycStatus === 'approved' ? 'Verified' : user?.kycStatus === 'pending' ? 'Pending' : user?.kycStatus === 'rejected' ? 'Rejected' : 'Not Started'}
                  </span>
                </div>
                <IconChevronDown size={13} color="var(--text-muted)" className={`${styles.chevron} ${showProfileMenu ? styles.chevronOpen : ''}`} />
              </div>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className={styles.profileDropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownUserTitle}>{user?.firstName} {user?.lastName}</div>
                    <span className={styles.dropdownUserEmail}>{user?.email}</span>
                    <div className={styles.dropdownBalanceRow}>
                      <span className={styles.dropdownBalanceLabel}>Portfolio Equity</span>
                      <strong className={`mono ${stealthMode ? 'stealth-blur' : ''} ${styles.dropdownBalanceValue}`}>
                        {formatBalance(totalBalance)}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.dropdownList}>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                    >
                      <IconSliders size={15} />
                      <span>Account & Security</span>
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); setShowInstall(true); }}
                    >
                      <IconSmartphone size={15} color="var(--accent-primary)" />
                      <span>App & Push Notifications</span>
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); setShowBiometricLock(true); }}
                    >
                      <IconShieldCheck size={15} color="var(--accent-gold)" />
                      <span>Lock Terminal (Biometrics)</span>
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); navigate('/kyc'); }}
                    >
                      <IconShieldCheck size={15} color="var(--brand-mint-500)" />
                      <span>Identity Verification (KYC)</span>
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); navigate('/wallet'); }}
                    >
                      <IconWallet size={15} />
                      <span>Wallet & Internal Transfers</span>
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); navigate('/trade'); }}
                    >
                      <IconTrade size={15} />
                      <span>Trading Terminal</span>
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setShowProfileMenu(false); navigate('/services'); }}
                    >
                      <IconBot size={15} color="var(--brand-bot-500)" />
                      <span>Bots & Yield Vaults</span>
                    </button>

                    {(user?.role === 'admin' || user?.role === 'super_admin') ? (
                      <button
                        className={styles.dropdownItem}
                        style={{ color: 'var(--brand-bot-500)' }}
                        onClick={() => { setShowProfileMenu(false); navigate('/admin'); }}
                      >
                        <IconCrown size={15} />
                        <span>Admin Risk & KYC Portal</span>
                      </button>
                    ) : (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => { setShowProfileMenu(false); setSupportModalConfig({}); setShowSupport(true); }}
                      >
                        <IconHeadphones size={15} color="var(--brand-mint-500)" />
                        <span>Client Support Desk</span>
                      </button>
                    )}

                    <div className={styles.dropdownDivider} />

                    <button
                      className={`${styles.dropdownItem} ${styles.dropdownSignOut}`}
                      onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                    >
                      <IconX size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.content} style={{ position: 'relative' }}>
          <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
          <Outlet />
        </main>

        {/* ── Mobile Native-Style 5-Tab Bottom Nav ── */}
        <nav className={styles.bottomNav}>
          {MOBILE_TAB_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}
            >
              <span className={styles.bottomNavIcon}><item.Icon size={20} /></span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${styles.bottomNavBtn} ${showMoreSheet ? styles.bottomNavActive : ''}`}
            onClick={() => setShowMoreSheet(prev => !prev)}
            aria-label="More options and account"
          >
            <div className={styles.bottomNavIconWrap}>
              <IconSliders size={20} />
              {unreadCount > 0 && <span className={styles.tabBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </div>
            <span className={styles.bottomNavLabel}>More</span>
          </button>
        </nav>
      </div>

      {/* ── iOS Native "More / Hub" Bottom Sheet ── */}
      {showMoreSheet && (
        <>
          <div className="backdrop" onClick={() => setShowMoreSheet(false)} style={{ zIndex: 'var(--z-overlay)' }} />
          <div className={styles.moreSheet}>
            <div className={styles.moreSheetHandle} onClick={() => setShowMoreSheet(false)} />

            <div className={styles.moreSheetHeader}>
              <div className={styles.moreAvatar}>
                {user?.firstName?.[0] || 'T'}{user?.lastName?.[0] || 'R'}
              </div>
              <div className={styles.moreUserMeta}>
                <div className={styles.moreUserName}>{user?.firstName || 'Trader'} {user?.lastName || ''}</div>
                <div className={styles.moreUserEmail}>{user?.email}</div>
                <span className={`badge ${user?.kycStatus === 'approved' ? 'badge-gain' : 'badge-medium'}`} style={{ marginTop: 4 }}>
                  {user?.kycStatus === 'approved' ? 'Verified Institutional' : 'KYC Pending'}
                </span>
              </div>
              <button className={styles.moreCloseBtn} onClick={() => setShowMoreSheet(false)} aria-label="Close menu">
                <IconX size={18} />
              </button>
            </div>

            <div className={styles.moreBalanceBox}>
              <div className={styles.moreBalanceLabelRow}>
                <span>Total Portfolio Equity</span>
                <button className={styles.moreStealthBtn} onClick={toggleStealthMode} aria-label="Toggle stealth balance">
                  {stealthMode ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                </button>
              </div>
              <div className={`mono ${stealthMode ? 'stealth-blur' : ''} ${styles.moreBalanceVal}`}>
                {formatBalance(totalBalance)}
              </div>
            </div>

            <div className={styles.moreGrid}>
              <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); navigate('/notifications'); }}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconMint}`}>
                  <IconBell size={18} />
                  {unreadCount > 0 && <span className={styles.moreActionBadge}>{unreadCount}</span>}
                </div>
                <span>Alerts & Fills</span>
              </button>

              <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); navigate('/portfolio'); }}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconTeal}`}>
                  <IconPortfolio size={18} />
                </div>
                <span>Portfolio</span>
              </button>

              <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); navigate('/settings'); }}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconGold}`}>
                  <IconSliders size={18} />
                </div>
                <span>Settings & Risk</span>
              </button>

              <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); navigate('/kyc'); }}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconBot}`}>
                  <IconShieldCheck size={18} />
                </div>
                <span>Identity (KYC)</span>
              </button>

              <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); setShowBiometricLock(true); }}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconNeutral}`}>
                  <IconShieldCheck size={18} />
                </div>
                <span>Lock Terminal</span>
              </button>

              <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); setShowInstall(true); }}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconMint}`}>
                  <IconSmartphone size={18} />
                </div>
                <span>Install PWA</span>
              </button>

              <button className={styles.moreActionCard} onClick={toggleTheme}>
                <div className={`${styles.moreActionIcon} ${styles.moreActionIconNeutral}`}>
                  {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                </div>
                <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
              </button>

              {(user?.role === 'admin' || user?.role === 'super_admin') ? (
                <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); navigate('/admin'); }}>
                  <div className={`${styles.moreActionIcon} ${styles.moreActionIconBot}`}>
                    <IconCrown size={18} />
                  </div>
                  <span>Admin Risk</span>
                </button>
              ) : (
                <button className={styles.moreActionCard} onClick={() => { setShowMoreSheet(false); setSupportModalConfig({}); setShowSupport(true); }}>
                  <div className={`${styles.moreActionIcon} ${styles.moreActionIconMint}`}>
                    <IconHeadphones size={18} />
                  </div>
                  <span>Support Desk</span>
                </button>
              )}
            </div>

            <button className={styles.moreSignOutBtn} onClick={() => { setShowMoreSheet(false); handleLogout(); }}>
              <IconX size={16} />
              <span>Sign Out of Terminal</span>
            </button>
          </div>
        </>
      )}

      <PwaInstallModal isOpen={showInstall} onClose={() => setShowInstall(false)} />
      <GlobalNotificationToast />
      <NetworkStatusBar />
      <BiometricLockModal isOpen={showBiometricLock} onUnlocked={() => setShowBiometricLock(false)} />
      <SupportModal
        isOpen={showSupport}
        onClose={() => setShowSupport(false)}
        initialCategory={supportModalConfig.category}
        initialSubject={supportModalConfig.subject}
        initialMessage={supportModalConfig.message}
      />
      <SupportFloatingLauncher onOpen={() => { setSupportModalConfig({}); setShowSupport(true); }} />
    </div>
  );
}

