import React from 'react';
import {
  IconCheckCircle,
  IconRefreshCw,
  IconAlertTriangle,
  IconZap,
  IconShieldCheck,
  IconClock,
} from './Icons';

export type CryptoStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'PENDING_REVIEW'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED';

interface Props {
  status: CryptoStatus | string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
    description: string;
  }
> = {
  AWAITING_PAYMENT: {
    label: 'Awaiting Transfer',
    color: 'var(--accent-gold)',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.35)',
    icon: IconClock,
    description: 'Trader started a deposit and has not marked the payment as sent',
  },
  PENDING_VERIFICATION: {
    label: 'Pending Verification',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
    border: 'rgba(251, 133, 0, 0.35)',
    icon: IconClock,
    description: 'Awaiting blockchain explorer audit by platform desk',
  },
  PENDING_REVIEW: {
    label: 'Under Security Review',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
    border: 'rgba(251, 133, 0, 0.35)',
    icon: IconShieldCheck,
    description: 'Reserved in queue for manual security sign-off',
  },
  PROCESSING: {
    label: 'In Settlement',
    color: 'var(--brand-bot-500)',
    bg: 'rgba(99, 102, 241, 0.14)',
    border: 'rgba(99, 102, 241, 0.35)',
    icon: IconZap,
    description: 'Compliance operator active on wallet dispatch',
  },
  COMPLETED: {
    label: 'Settled & Completed',
    color: 'var(--color-gain)',
    bg: 'var(--color-gain-bg)',
    border: 'var(--color-gain-border)',
    icon: IconCheckCircle,
    description: 'Confirmed on ledger and blockchain',
  },
  REJECTED: {
    label: 'Declined / Restored',
    color: 'var(--color-loss)',
    bg: 'var(--color-loss-bg)',
    border: 'var(--color-loss-border)',
    icon: IconAlertTriangle,
    description: 'Declined by security desk; funds restored',
  },
  FAILED: {
    label: 'Execution Failed',
    color: 'var(--color-loss-dim)',
    bg: 'rgba(224, 43, 74, 0.12)',
    border: 'rgba(224, 43, 74, 0.30)',
    icon: IconAlertTriangle,
    description: 'Broadcast or node validation error',
  },
};

export const CryptoStatusBadge: React.FC<Props> = ({ status, size = 'md', pulse = true }) => {
  const normStatus = status?.toUpperCase() || 'PENDING_VERIFICATION';
  const config = STATUS_CONFIG[normStatus] || STATUS_CONFIG.PENDING_VERIFICATION;
  const Icon = config.icon;
  const isPending =
    normStatus === 'AWAITING_PAYMENT' ||
    normStatus === 'PENDING_VERIFICATION' ||
    normStatus === 'PENDING_REVIEW' ||
    normStatus === 'PROCESSING';

  return (
    <span
      title={config.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? 4 : 6,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: size === 'sm' ? '11px' : 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        letterSpacing: '0.01em',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon
        size={size === 'sm' ? 12 : 13}
        color={config.color}
        className={isPending && pulse ? 'spin-slow' : undefined}
      />
      <span>{config.label}</span>
    </span>
  );
};
