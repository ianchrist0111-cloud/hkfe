import { useState } from 'react';
import {
  IconLandmark,
  IconZap,
  IconTrade,
  IconBot,
  IconShieldCheck,
  IconArrowLeft,
  IconArrowRight,
  IconX
} from '../common/Icons';
import styles from './GuidedTour.module.css';

interface TourStep {
  title: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to HKFES Trading',
    description: 'A professional multi-asset trading platform with real-time simulated market feeds, automated bots, copy trading, and yield strategies.',
    Icon: IconLandmark,
  },
  {
    title: 'Real-Time Price Engine',
    description: 'Live Geometric Brownian Motion price feeds across FX majors, Crypto (BTC, ETH, SOL), Indices, and Commodities with sub-second ticks.',
    Icon: IconZap,
  },
  {
    title: 'Advanced Trading Desk',
    description: 'Execute Market, Limit, and Stop orders with leverage up to 1:100, live candlestick charts, order books, and real-time PnL tracking.',
    Icon: IconTrade,
  },
  {
    title: 'Automated Strategies & Earn',
    description: 'Deploy Grid Trading bots, Dollar-Cost Averaging (DCA), Arbitrage scanners, and Copy Trading with professional master traders.',
    Icon: IconBot,
  },
  {
    title: 'Institutional Wallet & Security',
    description: 'Deposit, withdraw, manage multi-currency balances, and monitor KYC compliance seamlessly.',
    Icon: IconShieldCheck,
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuidedTour({ isOpen, onClose }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.Icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('hkfes_tour_completed', 'true');
      onClose();
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hkfes_tour_completed', 'true');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleSkip}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconBadge}>
            <StepIcon size={26} color="var(--brand-mint-500)" />
          </div>
          <button className={styles.skipBtn} onClick={handleSkip}>
            <span>Skip</span>
            <IconX size={14} />
          </button>
        </div>

        <div className={styles.content}>
          <h3 className={styles.title}>{step.title}</h3>
          <p className={styles.desc}>{step.description}</p>
        </div>

        <div className={styles.dots}>
          {TOUR_STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`${styles.dot} ${idx === currentStep ? styles.activeDot : ''}`}
              onClick={() => setCurrentStep(idx)}
            />
          ))}
        </div>

        <div className={styles.footer}>
          <button
            className="btn btn-secondary"
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{ opacity: currentStep === 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconArrowLeft size={16} />
            <span>Previous</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNext}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>{isLast ? 'Get Started' : 'Next'}</span>
            {!isLast && <IconArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
