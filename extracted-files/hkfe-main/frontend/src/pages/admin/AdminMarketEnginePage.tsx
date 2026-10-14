import { useState } from 'react';
import { usePriceStore } from '../../store';
import { priceEngine } from '../../lib/priceEngine';
import { api } from '../../lib/api';
import styles from './Admin.module.css';

export default function AdminMarketEnginePage() {
  const ticks = usePriceStore(s => s.ticks);
  const [targetSymbol, setTargetSymbol] = useState('BTC/USD');
  const [magnitude, setMagnitude] = useState(10);
  const [direction, setDirection] = useState<'up' | 'down' | 'random'>('down');
  const [feedPaused, setFeedPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const symbols = Object.keys(ticks).length > 0
    ? Object.keys(ticks)
    : ['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD', 'SOL/USD', 'AAPL', 'TSLA', 'NVDA', 'SPX500'];

  const handleInjectSpike = async () => {
    // 1. Local priceEngine spike injection
    priceEngine.injectSpike(targetSymbol, magnitude, direction);

    // 2. Call backend spike endpoint
    try {
      await api.adminSpike(targetSymbol, magnitude, direction);
    } catch (err) {
      console.error(err);
    }

    const dirText = direction === 'up' ? 'Bull Surge (+)' : direction === 'down' ? 'Flash Crash (-)' : 'High Volatility (±)';
    setStatusMessage(`⚡ Volatility shock injected: ${targetSymbol} ${dirText} ${magnitude}%`);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleToggleFeed = async () => {
    if (feedPaused) {
      priceEngine.resume();
      await api.adminResumeFeed().catch(() => {});
      setFeedPaused(false);
      setStatusMessage('▶ Live market price feed resumed.');
    } else {
      priceEngine.pause();
      await api.adminPauseFeed().catch(() => {});
      setFeedPaused(true);
      setStatusMessage('⏸ Live market price feed paused.');
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const [syncingLive, setSyncingLive] = useState(false);

  const handleResetPrices = async () => {
    priceEngine.resetPrices();
    await api.adminResetPrices().catch(() => {});
    setStatusMessage('↺ All market assets reset to initial seed benchmark prices.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleLiveSync = async () => {
    setSyncingLive(true);
    try {
      const res = await api.adminLiveSync();
      if (res.success) {
        setStatusMessage(`🌐 Market feed calibrated with live real-world exchange quotes.`);
      } else {
        setStatusMessage(`⚠️ Live sync warning: ${res.error?.message}`);
      }
    } catch {
      setStatusMessage(`⚠️ Failed to fetch live exchange quotes.`);
    } finally {
      setSyncingLive(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Market Engine & Volatility Controls</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Control the Geometric Brownian Motion (GBM) simulation feed, stream live exchange tickers, and inject test market conditions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={styles.actionBtn}
            style={{
              background: 'rgba(0, 229, 153, 0.15)',
              color: 'var(--accent-primary)',
              borderColor: 'var(--accent-primary)',
              fontWeight: 600,
            }}
            disabled={syncingLive}
            onClick={handleLiveSync}
          >
            {syncingLive ? 'Connecting...' : '🌐 Sync Live Tickers'}
          </button>
          <button
            className={styles.actionBtn}
            style={{
              background: feedPaused ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: feedPaused ? 'var(--color-gain)' : 'var(--color-loss)',
              borderColor: feedPaused ? 'var(--color-gain)' : 'var(--color-loss)',
              fontWeight: 600,
            }}
            onClick={handleToggleFeed}
          >
            {feedPaused ? '▶ Resume Feed' : '⏸ Pause Feed'}
          </button>
          <button className={styles.actionBtn} onClick={handleResetPrices}>
            ↺ Reset Seed Prices
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.15)',
          border: '1px solid var(--accent-gold)',
          color: 'var(--accent-gold)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}>
          {statusMessage}
        </div>
      )}

      {/* Engine Metrics */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>⚙️</span>
            <span className={styles.statChange} style={{ color: feedPaused ? 'var(--color-loss)' : 'var(--color-gain)' }}>
              {feedPaused ? 'PAUSED' : 'ACTIVE'}
            </span>
          </div>
          <div className={styles.statValue} style={{ color: feedPaused ? 'var(--color-loss)' : 'var(--color-gain)' }}>
            {feedPaused ? 'Paused' : 'Running'}
          </div>
          <div className={styles.statLabel}>GBM Simulation Feed</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>📡</span></div>
          <div className={styles.statValue}>1,000 ms</div>
          <div className={styles.statLabel}>Tick Interval (1 Hz)</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>📊</span></div>
          <div className={styles.statValue}>{Object.keys(ticks).length || 17}</div>
          <div className={styles.statLabel}>Active Market Pairs</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>⚡</span></div>
          <div className={styles.statValue}>GBM Engine</div>
          <div className={styles.statLabel}>Stochastic Model</div>
        </div>
      </div>

      {/* Volatility Shock Injector Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '1.4rem' }}>⚡</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
              Simulated Volatility Shock Injector
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Inject sudden institutional order-flow shocks, flash crashes, or bull rallies to test margin liquidations and bot responsiveness.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}>
          {/* Target Symbol */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
              Target Asset Symbol:
            </label>
            <select
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
              value={targetSymbol}
              onChange={e => setTargetSymbol(e.target.value)}
            >
              {symbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
              Shock Direction:
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`${styles.filterBtn} ${direction === 'down' ? styles.filterActive : ''}`}
                style={{
                  flex: 1,
                  background: direction === 'down' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-elevated)',
                  color: direction === 'down' ? 'var(--color-loss)' : 'var(--text-muted)',
                  borderColor: direction === 'down' ? 'var(--color-loss)' : 'var(--border-subtle)',
                }}
                onClick={() => setDirection('down')}
              >
                ▼ Flash Crash
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${direction === 'up' ? styles.filterActive : ''}`}
                style={{
                  flex: 1,
                  background: direction === 'up' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-elevated)',
                  color: direction === 'up' ? 'var(--color-gain)' : 'var(--text-muted)',
                  borderColor: direction === 'up' ? 'var(--color-gain)' : 'var(--border-subtle)',
                }}
                onClick={() => setDirection('up')}
              >
                ▲ Bull Rally
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${direction === 'random' ? styles.filterActive : ''}`}
                style={{ flex: 1 }}
                onClick={() => setDirection('random')}
              >
                ⚡ Whipsaw
              </button>
            </div>
          </div>

          {/* Magnitude Preset */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
              Shock Magnitude (%):
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[5, 10, 20, 50].map(pct => (
                <button
                  key={pct}
                  type="button"
                  className={`${styles.filterBtn} ${magnitude === pct ? styles.filterActive : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setMagnitude(pct)}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className={styles.btnCreate}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onClick={handleInjectSpike}
        >
          ⚡ Inject {magnitude}% {direction.toUpperCase()} Volatility Shock on {targetSymbol}
        </button>
      </div>

      {/* Live Market Assets List */}
      <div className={styles.priceGrid}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Live Real-Time Market Feed</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated every second via WebSocket</span>
        </div>
        <div className={styles.priceList} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
          {Object.values(ticks).map(t => (
            <div key={t.symbol} className={styles.priceRow}>
              <span>{t.symbol}</span>
              <span className="mono">{t.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className={t.changePct >= 0 ? styles.up : styles.dn}>
                {t.changePct >= 0 ? '▲ +' : '▼ '}{t.changePct.toFixed(2)}%
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  className={styles.dir}
                  style={{
                    background: t.direction === 'up' ? 'var(--color-gain-bg)' : t.direction === 'down' ? 'var(--color-loss-bg)' : 'var(--bg-elevated)',
                    color: t.direction === 'up' ? 'var(--color-gain)' : t.direction === 'down' ? 'var(--color-loss)' : 'var(--text-muted)',
                  }}
                >
                  {t.direction}
                </span>
                <button
                  className={styles.btnView}
                  style={{ fontSize: '10px', padding: '2px 8px' }}
                  onClick={() => {
                    setTargetSymbol(t.symbol);
                    setMagnitude(10);
                    setDirection('down');
                    handleInjectSpike();
                  }}
                >
                  ⚡ -10% Spike
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
