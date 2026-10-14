import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OnboardingPage.module.css';

const SLIDES = [
  {
    icon: '📊',
    title: 'Trade 8 Asset Classes',
    subtitle: 'FX pairs, cryptocurrencies, US equities, and indices — all in one professional platform.',
    bg: 'linear-gradient(135deg, rgba(240,165,0,0.08), transparent)',
    accent: '#f0a500',
  },
  {
    icon: '🤖',
    title: 'Automate with Bots',
    subtitle: 'Set up Grid Bots, DCA strategies, and copy trading that run 24/7 — even while you sleep.',
    bg: 'linear-gradient(135deg, rgba(0,201,167,0.08), transparent)',
    accent: '#00c9a7',
  },
  {
    icon: '💼',
    title: 'Track Your Portfolio',
    subtitle: 'Real-time P&L, performance charts, and analytics — everything in one dashboard.',
    bg: 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)',
    accent: '#3b82f6',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < SLIDES.length - 1) setCurrent(s => s + 1);
    else navigate('/kyc');
  };

  const slide = SLIDES[current];

  return (
    <div className={styles.page} style={{ background: slide.bg }}>
      <div className={styles.skip} onClick={() => navigate('/kyc')}>Skip</div>

      <div className={styles.slideWrap}>
        <div className={styles.iconCircle} style={{ '--accent': slide.accent } as React.CSSProperties}>
          <span className={styles.icon}>{slide.icon}</span>
        </div>
        <h1 className={styles.title}>{slide.title}</h1>
        <p className={styles.subtitle}>{slide.subtitle}</p>
      </div>

      <div className={styles.dots}>
        {SLIDES.map((_, i) => (
          <button key={i} className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
            onClick={() => setCurrent(i)} style={{ '--accent': slide.accent } as React.CSSProperties} />
        ))}
      </div>

      <div className={styles.footer}>
        {current === SLIDES.length - 1 ? (
          <button className={styles.btnCreate} onClick={next}>Create Account →</button>
        ) : (
          <button className={styles.btnNext} onClick={next} style={{ background: slide.accent }}>Next →</button>
        )}
      </div>
    </div>
  );
}
