import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import {
  IconDashboard,
  IconShieldCheck,
  IconUsers,
  IconZap,
  IconFileText,
  IconActivity,
  IconCrown,
  IconArrowLeft,
  IconArrowDownRight,
  IconArrowUpRight,
  IconHeadphones
} from '../common/Icons';
import styles from './AdminShell.module.css';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/admin/support', label: 'Support Desk', Icon: IconHeadphones, end: false },
  { to: '/admin/deposits', label: 'Crypto Deposits', Icon: IconArrowDownRight, end: false },
  { to: '/admin/withdrawals', label: 'Crypto Withdrawals', Icon: IconArrowUpRight, end: false },
  { to: '/admin/kyc', label: 'KYC Queue', Icon: IconShieldCheck, end: false },
  { to: '/admin/users', label: 'Users', Icon: IconUsers, end: false },
  { to: '/admin/engine', label: 'Market Engine', Icon: IconZap, end: false },
  { to: '/admin/audit-logs', label: 'Audit Log', Icon: IconFileText, end: false },
  { to: '/admin/reports', label: 'Reports', Icon: IconActivity, end: false },
];

export default function AdminShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <span className={styles.logoMark}>HK</span>
            <span className={styles.logoText}>FES</span>
          </div>
          <span className={styles.adminBadge}>{isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
        </div>
        <nav className={styles.nav}>
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <span className={styles.navIcon}><item.Icon size={17} /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {isSuperAdmin && (
            <NavLink
              to="/admin/system"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
              style={{ borderLeft: '3px solid var(--brand-bot-500)' }}
            >
              <span className={styles.navIcon}><IconCrown size={17} /></span>
              <span>System & Risk</span>
            </NavLink>
          )}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{user?.firstName?.[0] || 'A'}{user?.lastName?.[0] || 'D'}</div>
            <div>
              <strong>{user?.firstName} {user?.lastName}</strong>
              <p>{user?.role}</p>
            </div>
          </div>
          <button className={styles.backToApp} onClick={() => navigate('/dashboard')} title="Return to retail trading dashboard">
            <IconArrowLeft size={14} style={{ marginRight: 6 }} />
            <span>Trader Terminal</span>
          </button>
          <button className={styles.signOut} onClick={() => { logout(); navigate('/login'); }}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className={styles.content}>
        <div className={styles.contentInner}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
