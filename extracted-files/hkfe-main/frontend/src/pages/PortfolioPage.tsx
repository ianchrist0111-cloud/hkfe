import { useState, useEffect } from "react";
import { useTradesStore, useWalletStore, useServicesStore, usePriceStore, useUIStore } from "../store";
import { generatePortfolioHistory } from "../data";
import styles from "./PortfolioPage.module.css";

export default function PortfolioPage() {
  const { openTrades, closedTrades, fetchPositions, fetchHistory } = useTradesStore();
  const { totalBalance, fetchWallet } = useWalletStore();
  const { subscriptions, fetchSubscriptions } = useServicesStore();
  const ticks = usePriceStore(s => s.ticks);
  const { stealthMode } = useUIStore();

  useEffect(() => {
    fetchWallet();
    fetchPositions();
    fetchHistory();
    fetchSubscriptions();
  }, []);


  const [tab, setTab] = useState<"overview"|"holdings"|"history">("overview");
  const history = generatePortfolioHistory(totalBalance, 30);
  const totalPnl = closedTrades.reduce((s,t) => s + (t.realizedPnl || 0), 0);
  const openPnl = openTrades.reduce((s, t) => {
    const tick = ticks[t.symbol];
    if (!tick) return s;
    const mult = t.direction === "buy" ? 1 : -1;
    return s + ((tick.price - t.entryPrice) / t.entryPrice) * t.sizeUsd * mult;
  }, 0);

  const fmtUsd = (n: number, signed = false) => {
    if (stealthMode) return "$ ••••••••";
    const s = n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
    return signed && n > 0 ? `+${s}` : s;
  };

  return (
    <div className={styles.page}>
      <h1>Portfolio & Asset Breakdown</h1>
      <div className={styles.tabs}>
        {(["overview", "holdings", "history"] as const).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className={styles.overview}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span>Total Portfolio Value</span>
              <strong className={`mono ${stealthMode ? "stealth-blur" : ""}`}>{fmtUsd(totalBalance)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Realized P&L</span>
              <strong className={`${totalPnl >= 0 ? styles.up : styles.dn} mono ${stealthMode ? "stealth-blur" : ""}`}>
                {fmtUsd(totalPnl, true)}
              </strong>
            </div>
            <div className={styles.stat}>
              <span>Open Position P&L</span>
              <strong className={`${openPnl >= 0 ? styles.up : styles.dn} mono ${stealthMode ? "stealth-blur" : ""}`}>
                {fmtUsd(openPnl, true)}
              </strong>
            </div>
            <div className={styles.stat}>
              <span>Completed Trades</span>
              <strong className="mono">{closedTrades.length}</strong>
            </div>
          </div>
          <div className={styles.card}>
            <h3>30-Day Performance History</h3>
            <div className={styles.chartRow}>
              {history.map((p, i) => (
                <div
                  key={i}
                  className={styles.bar}
                  style={{
                    height: `${Math.max(10, ((p.value - Math.min(...history.map(h => h.value))) / (Math.max(...history.map(h => h.value)) - Math.min(...history.map(h => h.value)) || 1)) * 100)}%`,
                    background: p.value >= history[0].value ? "var(--color-gain)" : "var(--color-loss)",
                  }}
                  title={`${p.time}: ${fmtUsd(p.value)}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "holdings" && (
        <div className={styles.card}>
          {openTrades.length === 0 && subscriptions.length === 0 ? (
            <p className={styles.empty}>No active holdings. Start trading or activate an automated bot service.</p>
          ) : (
            <>
              {openTrades.map(t => {
                const tick = ticks[t.symbol];
                const pnl = tick ? ((tick.price - t.entryPrice) / t.entryPrice) * t.sizeUsd * (t.direction === "buy" ? 1 : -1) : 0;
                return (
                  <div key={t.id} className={styles.holdingRow}>
                    <span style={{ fontWeight: 700 }}>{t.symbol}</span>
                    <span className={`badge ${t.direction === "buy" ? "badge-gain" : "badge-loss"}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <span className={`mono ${stealthMode ? "stealth-blur" : ""}`}>{fmtUsd(t.sizeUsd)}</span>
                    <span className={`${pnl >= 0 ? styles.up : styles.dn} mono ${stealthMode ? "stealth-blur" : ""}`}>
                      {fmtUsd(pnl, true)}
                    </span>
                  </div>
                );
              })}
              {subscriptions.map(s => (
                <div key={s.id} className={styles.holdingRow}>
                  <span style={{ fontWeight: 700 }}>{s.serviceName}</span>
                  <span className="badge badge-teal">AUTOMATED BOT</span>
                  <span className={`mono ${stealthMode ? "stealth-blur" : ""}`}>{fmtUsd(s.allocatedUsd)}</span>
                  <span className={`${styles.up} mono ${stealthMode ? "stealth-blur" : ""}`}>
                    {fmtUsd(s.accruedYield, true)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className={styles.card}>
          {closedTrades.length === 0 ? (
            <p className={styles.empty}>No closed trade records yet.</p>
          ) : (
            closedTrades.map(t => (
              <div key={t.id} className={styles.histRow}>
                <span style={{ fontWeight: 700 }}>{t.symbol}</span>
                <span className={`badge ${t.direction === "buy" ? "badge-gain" : "badge-loss"}`}>
                  {t.direction.toUpperCase()}
                </span>
                <span className="mono">{new Date(t.closedAt || "").toLocaleDateString()}</span>
                <span className={`${(t.realizedPnl || 0) >= 0 ? styles.up : styles.dn} mono ${stealthMode ? "stealth-blur" : ""}`}>
                  {fmtUsd(t.realizedPnl || 0, true)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}