import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useUIStore, useAuthStore } from './store';
import { priceEngine } from './lib/priceEngine';
import { usePriceStore, useServicesStore } from './store';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { api } from './lib/api';
import adminStyles from './pages/admin/Admin.module.css';

// Layout
import AppShell from './components/layout/AppShell';
import AdminShell from './components/layout/AdminShell';
import PwaAutoInstallPrompt from './components/ui/PwaAutoInstallPrompt';

// Auth pages
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import KycPage from './pages/KycPage';

// App pages
import DashboardPage from './pages/DashboardPage';
import TradePage from './pages/TradePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import PortfolioPage from './pages/PortfolioPage';
import WalletPage from './pages/WalletPage';
import DepositPage from './pages/DepositPage';
import WithdrawPage from './pages/WithdrawPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import OfflinePage from './pages/OfflinePage';

// Admin pages (Code-split with React.lazy for instant initial bundle delivery)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminKycPage = lazy(() => import('./pages/admin/AdminKycPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminMarketEnginePage = lazy(() => import('./pages/admin/AdminMarketEnginePage'));
const AdminAuditLogPage = lazy(() => import('./pages/admin/AdminAuditLogPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const SuperAdminConfigPage = lazy(() => import('./pages/admin/SuperAdminConfigPage'));
const AdminCryptoDepositsPage = lazy(() => import('./pages/admin/AdminCryptoDepositsPage'));
const AdminCryptoWithdrawalsPage = lazy(() => import('./pages/admin/AdminCryptoWithdrawalsPage'));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage'));

import './styles/global.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminAccessGate() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  return (
    <div className={adminStyles.accessGate}>
      <div className={adminStyles.gateCard}>
        <div className={adminStyles.gateIcon}>🔒</div>
        <h2 className={adminStyles.gateTitle}>Access Restricted</h2>
        <p className={adminStyles.gateDesc}>
          Access to platform-wide risk oversight, simulated market engine control, audit trails, and user management requires Compliance Officer or Administrator clearance.
        </p>

        <div className={adminStyles.gateBadgeNotice}>
          Currently signed in as: <strong>{user?.firstName} {user?.lastName || ''}</strong> ({user?.email})
          <br />
          Current Role: <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{user?.role?.toUpperCase()}</span>
          <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--color-loss)' }}>
            ⚠️ Standard retail users cannot access the administration console.
          </div>
        </div>

        <div className={adminStyles.gateActions}>
          <button
            className={adminStyles.gateBtnReturn}
            onClick={() => navigate('/dashboard')}
          >
            ← Return to Trading Terminal
          </button>

          <button
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign Out to Switch Accounts
          </button>
        </div>
      </div>
    </div>
  );
}

function PageLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: 12,
      color: 'var(--text-muted)',
      fontSize: 13,
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border-subtle)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span>Loading compliance module...</span>
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <AdminAccessGate />;
  return <Suspense fallback={<PageLoadingFallback />}>{children}</Suspense>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  const { theme, colorblindMode, stealthMode } = useUIStore();
  const setTicks = usePriceStore(s => s.setTicks);
  const accrueYield = useServicesStore(s => s.accrueYield);

  // Apply theme & accessibility
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-colorblind', String(colorblindMode));
    document.documentElement.setAttribute('data-stealth', String(stealthMode));
  }, [theme, colorblindMode, stealthMode]);

  // Auto-detect OS theme on first load
  useEffect(() => {
    const stored = localStorage.getItem('hkfes-ui');
    if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      useUIStore.getState().setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Start price engine
  useEffect(() => {
    priceEngine.start(1000);
    const unsub = priceEngine.subscribe(ticks => {
      setTicks(ticks);
      accrueYield();
    });
    return () => {
      unsub();
      priceEngine.stop();
    };
  }, [setTicks, accrueYield]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <PwaAutoInstallPrompt />
        <Routes>
          {/* Public (Sign In shown first, marketing website hidden) */}
          <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/onboarding" element={<PublicRoute><OnboardingPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/landing" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/kyc/*" element={<ProtectedRoute><KycPage /></ProtectedRoute>} />
          <Route path="/offline" element={<OfflinePage />} />

          {/* App (protected) */}
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="trade" element={<TradePage />} />
            <Route path="trade/:symbol" element={<TradePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/:id" element={<ServiceDetailPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="wallet/deposit" element={<DepositPage />} />
            <Route path="wallet/withdraw" element={<WithdrawPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>

          {/* Admin (protected + role) */}
          <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="deposits" element={<AdminCryptoDepositsPage />} />
            <Route path="withdrawals" element={<AdminCryptoWithdrawalsPage />} />
            <Route path="kyc" element={<AdminKycPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="engine" element={<AdminMarketEnginePage />} />
            <Route path="audit-logs" element={<AdminAuditLogPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="system" element={<SuperAdminConfigPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
