import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { usePwaInstall } from '../lib/pwaInstall';
import { usePriceStore } from '../store';
import styles from './LandingPage.module.css';

const TICKER_SYMBOLS = [
  'XAU/USD', 'BTC/USD', 'NVDA', 'ETH/USD', 'EUR/USD', 'XAG/USD',
  'SOL/USD', 'AAPL', 'BNB/USD', 'USD/JPY', 'TSLA',
];

function formatLivePrice(price: number): string {
  const digits = price < 5 ? 4 : 2;
  return price.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const STATS = [
  { label: 'Assets Available', value: '35+' },
  { label: 'Simulated Volume', value: '$2.4B' },
  { label: 'Active Traders', value: '12,000+' },
  { label: 'Vault Services', value: '8' },
];

const FEATURES = [
  { icon: '📈', title: 'Live FX Trading', desc: 'Trade 7 major currency pairs with real-time simulated prices powered by our GBM engine.' },
  { icon: '₿', title: 'Crypto Markets', desc: 'Bitcoin, Ethereum, Solana, XRP — and more coming. Paper trade 24/7.' },
  { icon: '🤖', title: 'Automated Bots', desc: 'Grid bots, DCA strategies, and copy trading — all running on autopilot.' },
  { icon: '💰', title: 'Earn Products', desc: 'Allocate idle funds to simulated earn products at up to 8% APY.' },
  { icon: '📡', title: 'Copy Trading', desc: 'Follow top signal providers and mirror their trades automatically.' },
  { icon: '⚡', title: 'Arbitrage', desc: 'Watch cross-exchange price discrepancies get captured in real-time.' },
];

function LiveTicker() {
  const ticks = usePriceStore(s => s.ticks);
  const items = TICKER_SYMBOLS.map((sym) => {
    const tick = ticks[sym];
    const up = (tick?.changePct ?? 0) >= 0;
    return {
      sym,
      price: tick ? formatLivePrice(tick.price) : '—',
      chg: tick ? `${up ? '+' : ''}${tick.changePct.toFixed(2)}%` : '—',
      up,
    };
  });

  return (
    <div className={styles.tickerWrap}>
      <div className={styles.ticker}>
        {[...items, ...items].map((p, i) => (
          <div key={`${p.sym}-${i}`} className={styles.tickerItem}>
            <span className={styles.tickerSym}>{p.sym}</span>
            <span className={styles.tickerPrice}>{p.price}</span>
            <span className={`${styles.tickerChg} ${p.up ? styles.tickerUp : styles.tickerDown}`}>{p.chg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isInstalled: installed, isIOS, install } = usePwaInstall();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Particle canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }[] = [];
    const colors = ['#f0a500', '#00c9a7', '#3b82f6'];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let frame: number;
    const render = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = '#f0a500';
            ctx.globalAlpha = (1 - dist / 100) * 0.08;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
      frame = requestAnimationFrame(render);
    };
    render();

    const onResize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', onResize); };
  }, []);

  // PWA install handler
  const handleInstall = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    await install();
  };

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.heroGlow} />

        <header className={styles.header}>
          <div className={styles.headerLogo}>
            <span className={styles.logoMark}>HK</span>
            <span className={styles.logoText}>FES</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnGhost} onClick={() => navigate('/login')}>Log In</button>
            <button className={styles.btnPrimary} onClick={() => navigate('/register')}>Get Started</button>
          </div>
        </header>

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.liveDot} />
            Live Markets · 18 Assets · Real-time Prices
          </div>
          <h1 className={styles.heroTitle}>
            Trade the World's<br />
            <span className={styles.heroGradient}>Markets</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Professional-grade FX, crypto, and equities trading. Automated strategies, copy trading, and earn products — all in one platform.
          </p>
          <div className={styles.heroCtas}>
            <button className={styles.btnHeroPrimary} onClick={() => navigate('/register')}>
              Start Trading Free
              <span>→</span>
            </button>
            <button className={styles.btnHeroSecondary} onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
          <div className={styles.heroStats}>
            {STATS.map(s => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <LiveTicker />

      {/* ── Features ── */}
      <section className={styles.features}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2>Everything You Need to Trade</h2>
            <p>Eight powerful trading services in a single, seamlessly integrated platform</p>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaGlow} />
            <h2>Ready to start trading?</h2>
            <p>Create your account in under 2 minutes. Start with $10,000 in your account.</p>
            <button className={styles.btnHeroPrimary} onClick={() => navigate('/register')}>
              Create Free Account <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <span className={styles.logoMark}>HK</span>
                <span className={styles.logoText}>FES</span>
              </div>
              <p>Professional multi-asset trading platform. Available on iOS, Android, and Desktop.</p>
            </div>
            <div className={styles.footerLinks}>
              <div>
                <h4>Platform</h4>
                <a onClick={() => navigate('/register')}>Trading</a>
                <a onClick={() => navigate('/register')}>Services</a>
                <a onClick={() => navigate('/register')}>Portfolio</a>
              </div>
              <div>
                <h4>Account</h4>
                <a onClick={() => navigate('/register')}>Sign Up</a>
                <a onClick={() => navigate('/login')}>Log In</a>
                <a onClick={() => navigate('/help')}>Help</a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 HKFES. All rights reserved.</span>
            <span>Terms · Privacy · Risk Disclosure</span>
          </div>
        </div>
      </footer>

      {/* ── PWA Install Banner ── */}
      {showInstallBanner && !installed && (
        <div className={styles.installBanner}>
          <div className={styles.installContent}>
            <span className={styles.installIcon}>📲</span>
            <div>
              <strong>Install HKFES</strong>
              <p>Add to your home screen for the best experience</p>
            </div>
          </div>
          <div className={styles.installActions}>
            <button className={`tapticPress ${styles.btnInstall}`} onClick={handleInstall}>Install</button>
            <button className={styles.btnDismiss} onClick={() => setShowInstallBanner(false)}>×</button>
          </div>
        </div>
      )}

      {/* ── iOS Add to Home Screen Coachmark ── */}
      {showIosGuide && (
        <div className={styles.iosModalBackdrop} onClick={() => setShowIosGuide(false)}>
          <div className={styles.iosModalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '20px' }}>📲</span>
                <strong style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Install HKFES on iPhone</strong>
              </div>
              <button
                className={styles.btnDismiss}
                onClick={() => setShowIosGuide(false)}
                style={{ width: 36, height: 36 }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Install as a native standalone PWA with full-screen trading, zero URL bar, and real-time alerts.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '4px 0' }}>
              <div className={styles.iosStep}>
                <span className={styles.iosStepNumber}>1</span>
                <div>
                  Tap the <strong>Share</strong> button <span style={{ color: 'var(--brand-mint-500)', fontSize: '15px' }}>⎋</span> in Safari's bottom toolbar.
                </div>
              </div>

              <div className={styles.iosStep}>
                <span className={styles.iosStepNumber}>2</span>
                <div>
                  Scroll down the options list and select <strong>Add to Home Screen</strong> <span style={{ color: 'var(--brand-mint-500)', fontSize: '15px' }}>⊞</span>.
                </div>
              </div>

              <div className={styles.iosStep}>
                <span className={styles.iosStepNumber}>3</span>
                <div>
                  Tap <strong>Add</strong> in the top-right corner to launch HKFES directly from your home screen!
                </div>
              </div>
            </div>

            <button
              type="button"
              className="tapticPress"
              style={{
                background: 'linear-gradient(135deg, var(--brand-mint-500), #00b377)',
                color: '#07090e',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                minHeight: 44,
                width: '100%',
              }}
              onClick={() => setShowIosGuide(false)}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
