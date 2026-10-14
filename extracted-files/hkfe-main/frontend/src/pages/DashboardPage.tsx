import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useWalletStore, useTradesStore, useServicesStore, usePriceStore, useUIStore } from '../store';
import { generatePortfolioHistory } from '../data';
import { ASSETS } from '../lib/priceEngine';
import GuidedTour from '../components/ui/GuidedTour';
import {
  IconWallet,
  IconZap,
  IconBot,
  IconArrowUpRight,
  IconShieldCheck,
  IconLock,
  IconEye,
  IconEyeOff,
  IconSparkles,
  IconActivity,
  IconArrowRight,
  IconAlertTriangle
} from '../components/common/Icons';
import styles from './DashboardPage.module.css';

function PriceCard({ symbol, tick, onClick }: { symbol: string; tick: any; onClick: () => void }) {
  const [flash, setFlash] = useState('');
  const prevPrice = useRef(tick?.price);

  useEffect(() => {
    if (!tick || tick.price === prevPrice.current) return;
    const cls = tick.price > prevPrice.current ? 'flash-gain' : 'flash-loss';
    setFlash(cls);
    prevPrice.current = tick.price;
    const t = setTimeout(() => setFlash(''), 500);
    return () => clearTimeout(t);
  }, [tick?.price]);

  if (!tick) {
    return (
      <div className={styles.priceCard} onClick={onClick}>
        <div className={styles.priceCardHeader}>
          <span className={styles.priceSymbol}>{symbol}</span>
        </div>
        <div className={styles.priceValue}>—</div>
      </div>
    );
  }

  const asset = ASSETS.find(a => a.symbol === symbol);
  const isUp = tick.changePct >= 0;

  return (
    <div className={`${styles.priceCard} ${flash}`} onClick={onClick}>
      <div className={styles.priceCardHeader}>
        <span className={styles.priceSymbol}>{symbol}</span>
        <span className={`badge ${isUp ? 'badge-gain' : 'badge-loss'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(tick.changePct).toFixed(2)}%
        </span>
      </div>
      <div className={styles.priceValue}>
        {tick.price.toLocaleString('en-US', { minimumFractionDigits: asset?.pipSize && asset.pipSize < 0.01 ? 4 : 2 })}
      </div>
      <div className={`${styles.priceChange} ${isUp ? styles.up : styles.down}`}>
        {isUp ? '+' : ''}{tick.change.toFixed(asset?.pipSize && asset.pipSize < 0.01 ? 4 : 2)} today
      </div>
    </div>
  );
}

// ── Interactive Scrubbable Performance Chart (Robinhood-Style) ──
interface ScrubbableChartProps {
  data: { time: string; value: number }[];
  isGain: boolean;
  onScrub: (point: { time: string; value: number } | null) => void;
}

function ScrubbableChart({ data, isGain, onScrub }: ScrubbableChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubX, setScrubX] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!data.length) return [];
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return data.map((d, i) => ({
      x: (i / (data.length - 1 || 1)) * 100, // percentage
      y: 100 - ((d.value - min) / range) * 85 - 8, // percentage with margin
      raw: d,
    }));
  }, [data]);

  const pathD = useMemo(() => {
    if (!points.length) return '';
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (!points.length) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${pathD} L ${lastX} 100 L ${firstX} 100 Z`;
  }, [pathD, points]);

  const handlePointer = (clientX: number) => {
    if (!containerRef.current || !data.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(relX * (data.length - 1));
    const targetPoint = data[idx];
    setScrubX(relX * 100);
    onScrub(targetPoint);
  };

  const strokeColor = isGain ? '#00e599' : '#ff3b5c';
  const gradientId = isGain ? 'chart-gain' : 'chart-loss';

  return (
    <div
      ref={containerRef}
      className={styles.scrubContainer}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        handlePointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0 || scrubX !== null) {
          handlePointer(e.clientX);
        }
      }}
      onPointerUp={() => {
        setScrubX(null);
        onScrub(null);
      }}
      onPointerLeave={() => {
        setScrubX(null);
        onScrub(null);
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.scrubSvg}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

        {/* Scrub Vertical Guide Line */}
        {scrubX !== null && (
          <line
            x1={scrubX}
            y1="0"
            x2={scrubX}
            y2="100"
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="1"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Scrub Dot & Tooltip */}
      {scrubX !== null && (
        <div className={styles.scrubPill} style={{ left: `${scrubX}%` }}>
          <span className={styles.scrubDot} style={{ borderColor: strokeColor }} />
        </div>
      )}
    </div>
  );
}

type Range = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { totalBalance, availableBalance, transactions } = useWalletStore();
  const { openTrades } = useTradesStore();
  const { subscriptions } = useServicesStore();
  const ticks = usePriceStore(s => s.ticks);
  const { stealthMode, toggleStealthMode } = useUIStore();

  const [range, setRange] = useState<Range>('1W');
  const [portfolioHistory] = useState(() => generatePortfolioHistory(totalBalance, 90));
  const [showTour, setShowTour] = useState(false);
  const [scrubbedPoint, setScrubbedPoint] = useState<{ time: string; value: number } | null>(null);

  // Real-time ticking simulated yield
  const [tickingYield, setTickingYield] = useState(1842.18);
  useEffect(() => {
    const timer = setInterval(() => {
      setTickingYield(v => v + 0.03);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const rangeData = useMemo(() => {
    return {
      '1D': portfolioHistory.slice(-24),
      '1W': portfolioHistory.slice(-7),
      '1M': portfolioHistory.slice(-30),
      '3M': portfolioHistory.slice(-60),
      '1Y': portfolioHistory,
      'ALL': portfolioHistory,
    };
  }, [portfolioHistory]);

  const chartData = rangeData[range] || portfolioHistory;
  const portfolioStart = chartData[0]?.value ?? totalBalance;
  const activeValue = scrubbedPoint ? scrubbedPoint.value : totalBalance;
  const deltaPnl = activeValue - portfolioStart;
  const deltaPnlPct = portfolioStart > 0 ? (deltaPnl / portfolioStart) * 100 : 0;
  const isUp = deltaPnl >= 0;

  const openPnl = openTrades.reduce((sum, t) => {
    const tick = ticks[t.symbol];
    if (!tick) return sum;
    const mult = t.direction === 'buy' ? 1 : -1;
    const pnl = ((tick.price - t.entryPrice) / t.entryPrice) * t.sizeUsd * mult;
    return sum + pnl;
  }, 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fmtUsd = (n: number, signed = false) => {
    if (stealthMode) return '$ ••••••••';
    const s = n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    return signed && n > 0 ? `+${s}` : s;
  };

  const WATCH_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XAU/USD', 'XAG/USD', 'NVDA', 'AAPL', 'MSFT', 'TSLA', 'EUR/USD', 'SPX500'];

  return (
    <div className={styles.page}>
      {/* ── Welcome Header ── */}
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.greeting}>
            {greeting()}, {user?.firstName || 'Trader'}
          </h1>
          <p className={styles.greetingSub}>
            Here is your live multi-asset portfolio and earning performance.
          </p>
        </div>
        <div className={styles.welcomeActions}>
          <button
            className={styles.stealthToggle}
            onClick={toggleStealthMode}
            title={stealthMode ? 'Show portfolio figures' : 'Hide portfolio figures (Stealth)'}
          >
            {stealthMode ? <><IconEyeOff size={15} /> Show Balance</> : <><IconEye size={15} /> Hide Balance</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTour(true)}>
            <IconSparkles size={14} style={{ marginRight: 4 }} /> Quick Tour
          </button>
          <div className={styles.livePill}>
            <span className="live-pulse" />
            <span>US MARKETS LIVE</span>
          </div>
        </div>
      </div>

      {/* ── Compliance Restrictions Alert Banner ── */}
      {(user?.tradingBlocked || user?.withdrawalsBlocked || user?.depositsBlocked || user?.status === 'suspended') && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.10)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff4d6d', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
              <IconAlertTriangle size={18} />
              <span>Compliance & Account Status Notice</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {user?.status === 'suspended' && (
                <span className="badge badge-loss" style={{ fontSize: '10px' }}>ACCOUNT SUSPENDED</span>
              )}
              {user?.tradingBlocked && (
                <span className="badge badge-loss" style={{ fontSize: '10px' }}>TRADING RESTRICTED</span>
              )}
              {user?.withdrawalsBlocked && (
                <span className="badge badge-loss" style={{ fontSize: '10px' }}>WITHDRAWALS RESTRICTED</span>
              )}
              {user?.depositsBlocked && (
                <span className="badge badge-loss" style={{ fontSize: '10px' }}>DEPOSITS RESTRICTED</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Certain execution privileges on your account have been restricted by HKFES Risk & Compliance. If you have questions regarding identity clearance, verification documents, or account status, submit an inquiry to our 24/7 Compliance Desk.
          </div>
          <div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('hkfes:open-support', { detail: { category: 'account', subject: 'Account Clearance & Restrictions Inquiry' } }))}
              style={{
                background: 'rgba(239, 68, 68, 0.20)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Contact Compliance Desk</span>
              <IconArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Quick Action Dock (Robinhood / Cash App Floating Pill) ── */}
      <div className={styles.quickDock}>
        <button className={styles.dockItem} onClick={() => navigate('/wallet/deposit')}>
          <span className={styles.dockIcon}><IconWallet size={18} /></span>
          <span className={styles.dockLabel}>Deposit</span>
        </button>
        <button className={`${styles.dockItem} ${styles.dockItemPrimary}`} onClick={() => navigate('/trade')}>
          <span className={styles.dockIcon}><IconZap size={18} /></span>
          <span className={styles.dockLabel}>Trade</span>
        </button>
        <button className={styles.dockItem} onClick={() => navigate('/services')}>
          <span className={styles.dockIcon}><IconBot size={18} /></span>
          <span className={styles.dockLabel}>Earn & Bots</span>
        </button>
        <button className={styles.dockItem} onClick={() => navigate('/wallet/withdraw')}>
          <span className={styles.dockIcon}><IconArrowUpRight size={18} /></span>
          <span className={styles.dockLabel}>Withdraw</span>
        </button>
      </div>

      {/* ── Live Yield Streamer ── */}
      <div className={styles.yieldStreamer}>
        <div className={styles.yieldStreamerLeft}>
          <span className="live-pulse" />
          <span className={styles.yieldStreamerTitle}>LIVE YIELD STREAM</span>
        </div>
        <div className={styles.yieldStreamerCenter}>
          <span className={styles.yieldTickingLabel}>Total Accrued:</span>
          <strong className={`${styles.yieldTickingVal} mono ${stealthMode ? 'stealth-blur' : ''}`}>
            ${tickingYield.toFixed(2)}
          </strong>
          <span className={styles.yieldChip}>⚡ AI Grid Bot Alpha (+18.4% APY)</span>
          <span className={styles.yieldChip}>🟢 USD High-Yield Vault (8.2% APY)</span>
        </div>
        <button className={styles.yieldStreamerBtn} onClick={() => navigate('/services')}>
          <span>Manage Bots</span>
          <IconArrowRight size={13} style={{ marginLeft: 4 }} />
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className={styles.summaryCards}>
        <div className={`${styles.card} ${styles.cardPrimary}`}>
          <div className={styles.cardHeaderRow}>
            <span className={styles.cardLabel}>Portfolio Value</span>
            <span className={styles.statusPillLive}>Live Updated</span>
          </div>
          <span className={`${styles.cardBigValue} ${stealthMode ? 'stealth-blur' : ''}`}>
            {fmtUsd(activeValue)}
          </span>
          <div className={`${styles.cardChange} ${isUp ? styles.up : styles.down}`}>
            <span>{isUp ? '▲ +' : '▼ '}{deltaPnlPct.toFixed(2)}%</span>
            <span className="mono">({fmtUsd(deltaPnl, true)})</span>
            <span className={styles.rangeIndicator}>{range}</span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Available Cash</span>
          <span className={`${styles.cardValue} ${stealthMode ? 'stealth-blur' : ''}`}>
            {fmtUsd(availableBalance)}
          </span>
          <span className={styles.cardSub}>Ready for instant orders</span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Open Position P&L</span>
          <span className={`${styles.cardValue} ${openPnl >= 0 ? styles.up : styles.down} ${stealthMode ? 'stealth-blur' : ''}`}>
            {fmtUsd(openPnl, true)}
          </span>
          <span className={styles.cardSub}>{openTrades.length} open position{openTrades.length !== 1 ? 's' : ''}</span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Active Automated Bots</span>
          <span className={styles.cardValue}>
            {subscriptions.filter(s => s.status === 'active').length || 2}
          </span>
          <span className={styles.cardSub}>Grid, DCA & Staking</span>
        </div>
      </div>

      {/* ── Scrubbable Performance Curve + Watchlist ── */}
      <div className={styles.mainRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Portfolio Performance</h2>
              <div className={styles.scrubIndicatorRow}>
                <span className={`${styles.scrubValue} mono ${stealthMode ? 'stealth-blur' : ''}`}>
                  {fmtUsd(activeValue)}
                </span>
                <span className={`${styles.scrubPnl} ${isUp ? styles.up : styles.down}`}>
                  {isUp ? '▲ +' : '▼ '}{deltaPnlPct.toFixed(2)}% ({fmtUsd(deltaPnl, true)})
                </span>
                {scrubbedPoint && (
                  <span className={styles.scrubTimePill}>
                    {scrubbedPoint.time}
                  </span>
                )}
              </div>
            </div>

            {/* Timeframe selector pills */}
            <div className={styles.rangePills}>
              {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as Range[]).map(r => (
                <button
                  key={r}
                  className={`${styles.rangePill} ${range === r ? styles.rangePillActive : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.chartArea}>
            <ScrubbableChart
              data={chartData}
              isGain={isUp}
              onScrub={setScrubbedPoint}
            />
          </div>
          <div className={styles.chartHint}>
            <IconSparkles size={13} color="var(--brand-mint-500)" style={{ verticalAlign: 'middle', marginRight: 4 }} />
            <em>Tip: Tap or drag across chart to scrub past balance points.</em>
          </div>
        </div>

        {/* Watchlist */}
        <div className={styles.watchCard}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.sectionTitle}>Quick Watchlist</h2>
            <button className={styles.btnLink} onClick={() => navigate('/trade')}>View All →</button>
          </div>
          <div className={styles.watchList}>
            {WATCH_SYMBOLS.map(sym => {
              const tick = ticks[sym];
              const isTickUp = (tick?.changePct ?? 0) >= 0;
              return (
                <div key={sym} className={styles.watchItem} onClick={() => navigate(`/trade/${encodeURIComponent(sym)}`)}>
                  <div>
                    <span className={styles.watchSym}>{sym}</span>
                    <span className={styles.watchClass}>
                      {ASSETS.find(a => a.symbol === sym)?.assetClass.toUpperCase() || 'EQUITY'}
                    </span>
                  </div>
                  <div className={styles.watchRight}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                      {tick?.price ? tick.price.toLocaleString('en-US', { minimumFractionDigits: (sym.includes('/') && !sym.startsWith('USD/J') && !sym.startsWith('XAU') && !sym.startsWith('WTI') && !sym.startsWith('BRENT') && tick.price < 10) ? 4 : 2 }) : '—'}
                    </span>
                    <span className={`badge ${isTickUp ? 'badge-gain' : 'badge-loss'}`} style={{ marginTop: 2 }}>
                      {isTickUp ? '+' : ''}{(tick?.changePct ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Open Positions ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Open Positions</h2>
          <button className={styles.btnLink} onClick={() => navigate('/portfolio')}>Full Portfolio →</button>
        </div>
        {openTrades.length === 0 ? (
          <div className={styles.emptyState}>
            <IconActivity size={32} color="var(--text-muted)" />
            <p>No open positions right now. <a onClick={() => navigate('/trade')}>Place your first trade →</a></p>
          </div>
        ) : (
          <div className={styles.posTable}>
            <div className={styles.posHeader}>
              <span>Asset</span><span>Direction</span><span>Size</span><span>Entry</span><span>Current</span><span>P&L</span>
            </div>
            {openTrades.slice(0, 5).map(t => {
              const tick = ticks[t.symbol];
              const mult = t.direction === 'buy' ? 1 : -1;
              const pnl = tick ? ((tick.price - t.entryPrice) / t.entryPrice) * t.sizeUsd * mult : 0;
              const pnlPct = (pnl / t.sizeUsd) * 100;
              return (
                <div key={t.id} className={styles.posRow}>
                  <span className={styles.posAsset}>{t.symbol}</span>
                  <span className={`badge ${t.direction === 'buy' ? 'badge-gain' : 'badge-loss'}`}>
                    {t.direction.toUpperCase()}
                  </span>
                  <span className={`mono ${stealthMode ? 'stealth-blur' : ''}`}>{fmtUsd(t.sizeUsd)}</span>
                  <span className="mono">{t.entryPrice.toFixed(4)}</span>
                  <span className="mono">{tick?.price ? tick.price.toFixed(4) : '—'}</span>
                  <span className={`${pnl >= 0 ? styles.up : styles.down} mono ${stealthMode ? 'stealth-blur' : ''}`}>
                    {fmtUsd(pnl, true)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Market Prices Ticker ── */}
      <div className={styles.marketRow}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Market Overview</h2>
          <button className={styles.btnLink} onClick={() => navigate('/trade')}>Trade Hub →</button>
        </div>
        <div className={styles.priceCards}>
          {WATCH_SYMBOLS.map(sym => (
            <PriceCard key={sym} symbol={sym} tick={ticks[sym]} onClick={() => navigate(`/trade/${encodeURIComponent(sym)}`)} />
          ))}
        </div>
      </div>

      {/* ── US Regulatory Disclosures & Security Footer ── */}
      <footer className={styles.regulatoryFooter}>
        <div className={styles.trustMarks}>
          <div className={styles.trustItem}>
            <span className={styles.trustItemIcon}><IconShieldCheck size={20} color="var(--brand-mint-500)" /></span>
            <div>
              <strong>SIPC Protection</strong>
              <p>Securities protected up to $500,000</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustItemIcon}><IconLock size={20} color="var(--brand-mint-500)" /></span>
            <div>
              <strong>256-Bit SSL Encryption</strong>
              <p>Institutional security & SOC2 certified</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustItemIcon}><IconZap size={20} color="var(--brand-mint-500)" /></span>
            <div>
              <strong>Sub-Millisecond Routing</strong>
              <p>Direct Tier-1 clearing & smart order router</p>
            </div>
          </div>
        </div>
        <p className={styles.regulatoryText}>
          Trading stocks, crypto, and forex involves substantial risk of loss. All investments are subject to market volatility.
          HKFES is a technology platform providing simulated and automated execution infrastructure. Not FDIC insured.
        </p>
      </footer>

      <GuidedTour isOpen={showTour} onClose={() => setShowTour(false)} />
    </div>
  );
}

