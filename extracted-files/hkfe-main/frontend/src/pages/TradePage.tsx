import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ASSETS } from '../lib/priceEngine';
import { getAssetMarketStatus } from '../lib/marketHours';
import { usePriceStore, useTradesStore, useWalletStore, useNotificationsStore, useUIStore, useAuthStore } from '../store';
import { triggerFintechAlert } from '../lib/pushNotifications';
import {
  IconAlertTriangle,
  IconSearch,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconZap,
  IconTrade,
  IconCheck,
  IconX,
} from '../components/common/Icons';

import TechnicalChart from '../components/trading/TechnicalChart';
import styles from './TradePage.module.css';


type OrderType = 'market' | 'limit' | 'stop';
type Side = 'buy' | 'sell';
type TF = '1m' | '5m' | '15m' | '1H' | '4H' | '1D';

// ── Slide to Confirm Slider Component ──
function SlideToConfirm({
  side,
  onConfirm,
  disabled,
  disabledReason,
}: {
  side: Side;
  onConfirm: () => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [sliderPct, setSliderPct] = useState(0);
  const isDragging = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left - 24;
    const maxTrack = rect.width - 48;
    const pct = Math.max(0, Math.min(100, (currentX / maxTrack) * 100));
    setSliderPct(pct);

    if (pct >= 90) {
      isDragging.current = false;
      setSliderPct(100);
      try {
        if ('vibrate' in navigator) navigator.vibrate([15, 30, 20]);
      } catch (err) { }
      onConfirm();
      setTimeout(() => setSliderPct(0), 1000);
    }
  };

  const handlePointerUp = () => {
    if (sliderPct < 90) {
      setSliderPct(0);
    }
    isDragging.current = false;
  };

  const isBuy = side === 'buy';

  return (
    <div
      ref={trackRef}
      className={`${styles.slideTrack} ${disabled ? styles.slideDisabled : ''} ${isBuy ? styles.slideTrackBuy : styles.slideTrackSell}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={styles.slideFill}
        style={{
          width: `${sliderPct}%`,
          background: isBuy ? 'linear-gradient(90deg, #00e599, #00b4d8)' : 'linear-gradient(90deg, #ff3b5c, #e02b4a)',
        }}
      />
      <span className={styles.slideLabel}>
        {disabled && disabledReason
          ? disabledReason
          : sliderPct > 40
            ? 'Release to Confirm'
            : `Slide to Confirm ${side.toUpperCase()}`}
      </span>
      <div
        className={styles.slideThumb}
        style={{ left: `calc(${sliderPct}% * 0.88)` }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sliderPct >= 90 ? <IconCheck size={16} strokeWidth={2.5} /> : <IconArrowRight size={16} strokeWidth={2.5} />}
        </span>
      </div>
    </div>
  );
}

export default function TradePage() {
  const { symbol: paramSym } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isTradingBlocked = Boolean(user?.tradingBlocked || user?.status === 'suspended');
  const ticks = usePriceStore(s => s.ticks);
  const { openTrades, closedTrades, placeTrade, closeTrade, placeOptionContract, settleOptionContract, fetchPositions, fetchHistory } = useTradesStore();
  const { availableBalance } = useWalletStore();
  const addNotif = useNotificationsStore(s => s.addNotification);
  const { stealthMode } = useUIStore();

  useEffect(() => {
    fetchPositions();
    fetchHistory();
  }, []);

  const [selectedAsset, setSelectedAsset] = useState(paramSym ? decodeURIComponent(paramSym) : 'BTC/USD');
  const [tradingMode, setTradingMode] = useState<'turbo_options' | 'classic'>('turbo_options');
  const [selectedDuration, setSelectedDuration] = useState<30 | 60 | 90 | 120>(60);
  const [optionAmount, setOptionAmount] = useState('100');
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [settlementModalData, setSettlementModalData] = useState<{
    outcome: 'won' | 'lost' | 'tied';
    pnl: number;
    symbol: string;
    direction: string;
    strike: number;
    exit: number;
    amount: number;
  } | null>(null);

  const [side, setSide] = useState<Side>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [amount, setAmount] = useState('1000');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [filter, setFilter] = useState<'all' | 'crypto' | 'commodity' | 'equity' | 'fx' | 'index'>('all');
  const [tf, setTf] = useState<TF>('1H');
  const [lastFilled, setLastFilled] = useState<string | null>(null);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showAssetSearchModal, setShowAssetSearchModal] = useState(false);
  const [showOrderBreakdown, setShowOrderBreakdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [closeModalTrade, setCloseModalTrade] = useState<any | null>(null);
  const [closePct, setClosePct] = useState<number>(100);
  const [positionsTab, setPositionsTab] = useState<'options' | 'margin' | 'history'>('options');

  const tick = ticks[selectedAsset];
  const asset = ASSETS.find(a => a.symbol === selectedAsset);
  const fillPrice = side === 'buy' ? tick?.ask : tick?.bid;
  const amtNum = parseFloat(amount) || 0;
  const optAmtNum = parseFloat(optionAmount) || 0;
  const fee = 0; // Zero commission institutional pricing model
  const units = fillPrice ? (amtNum / fillPrice).toFixed(6) : '—';

  // Real-time ticking interval for short-term option countdown & automated expiry settlement
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNowTs(currentNow);

      // Check all active short-term options
      const activeOptions = openTrades.filter(t => t.orderType === 'short_term_option' && t.status === 'open');
      for (const contract of activeOptions) {
        if (contract.targetExpiry) {
          const expiryMs = new Date(contract.targetExpiry).getTime();
          if (currentNow >= expiryMs) {
            const livePrice = ticks[contract.symbol]?.price ?? contract.entryPrice;
            settleOptionContract(contract.id, livePrice).then(res => {
              setSettlementModalData({
                outcome: res.outcome,
                pnl: res.pnl,
                symbol: contract.symbol,
                direction: contract.direction,
                strike: contract.strikePrice ?? contract.entryPrice,
                exit: livePrice,
                amount: contract.sizeUsd,
              });
              triggerFintechAlert({
                type: res.outcome === 'won' ? 'earn_payout' : 'order_filled',
                title: res.outcome === 'won'
                  ? `Option Won! +$${res.pnl.toFixed(2)} USD 🎯`
                  : res.outcome === 'tied'
                    ? `Option Tied — Stake Refunded 🔄`
                    : `Option Expired OTM 📉`,
                message: `${contract.symbol} (${contract.direction.toUpperCase()}) settled at $${livePrice.toFixed(4)} vs strike $${(contract.strikePrice ?? contract.entryPrice).toFixed(4)}`,
                symbol: contract.symbol,
                amount: res.pnl,
              });
            }).catch(() => { });
          }
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [openTrades, ticks, settleOptionContract]);

  const filteredAssets = ASSETS.filter(a => {
    const matchFilter = filter === 'all' || a.assetClass === filter;
    const matchQuery = !searchQuery || a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || a.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchQuery;
  });

  const handlePlaceOption = async (dir: 'call' | 'put') => {
    if (isTradingBlocked) {
      addNotif({
        type: 'system',
        title: 'Trading Suspended',
        message: 'Your account is restricted from executing trades by Compliance. Please contact Support.',
      });
      return;
    }
    if (!tick || !optAmtNum || optAmtNum > availableBalance) return;

    setIsSubmittingOption(true);
    try {
      const strike = tick.price;
      const contract = await placeOptionContract({
        symbol: selectedAsset,
        direction: dir,
        durationSeconds: selectedDuration,
        amount: optAmtNum,
        strikePrice: strike,
        payoutRate: 0.90,
      });

      if (contract) {
        setPositionsTab('options');
        triggerFintechAlert({
          type: 'order_filled',
          title: `Option Placed: ${dir.toUpperCase()} ${selectedAsset} ⚡`,
          message: `${selectedDuration}s Expiry — Strike: $${strike.toFixed(4)} — Stake: $${optAmtNum.toLocaleString()} USD`,
          symbol: selectedAsset,
          amount: optAmtNum,
          deepLink: `/trade/${encodeURIComponent(selectedAsset)}`,
          actionText: 'View Contract',
        });
        setLastFilled(`${dir.toUpperCase()} ${selectedDuration}s Option opened at $${strike.toFixed(4)}`);
        setShowMobilePanel(false);
        setTimeout(() => setLastFilled(null), 3500);
      }
    } finally {
      setIsSubmittingOption(false);
    }
  };

  const handlePlaceOrder = () => {
    if (isTradingBlocked) {
      addNotif({
        type: 'system',
        title: 'Trading Suspended',
        message: 'Your account is restricted from executing trades by Compliance. Please contact Support.',
      });
      return;
    }
    if (!tick || !amtNum || amtNum > availableBalance) return;
    const reserved = useWalletStore.getState().reserveTradeMargin(amtNum, selectedAsset, side);
    if (!reserved) return;
    placeTrade({
      symbol: selectedAsset,
      direction: side,
      orderType,
      sizeUsd: amtNum,
      entryPrice: fillPrice!,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      fee,
    });
    setPositionsTab('margin');
    triggerFintechAlert({
      type: 'order_filled',
      title: `Order Executed: ${side.toUpperCase()} ${selectedAsset} ⚡`,
      message: `Filled at $${fillPrice?.toFixed(4)} — Size: $${amtNum.toLocaleString()} USD`,
      symbol: selectedAsset,
      amount: amtNum,
      deepLink: `/trade/${encodeURIComponent(selectedAsset)}`,
      actionText: 'View Position',
    });
    setLastFilled(`${side.toUpperCase()} ${selectedAsset} filled at $${fillPrice?.toFixed(4)}`);
    setShowMobilePanel(false);
    setTimeout(() => setLastFilled(null), 3500);
  };

  const fmtPrice = (p?: number, targetAsset?: any) => {
    if (p == null) return '—';
    const cfg = targetAsset || asset;
    const decimals = cfg?.pipSize && cfg.pipSize <= 0.0001 ? 4 : cfg?.pipSize && cfg.pipSize <= 0.001 ? 3 : (p < 5 ? 3 : 2);
    return p.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const setQuickPercent = (pct: number) => {
    const calculated = Math.floor(availableBalance * pct);
    setAmount(String(Math.max(10, calculated)));
  };

  const setQuickOptionStake = (val: number | 'max') => {
    if (val === 'max') {
      setOptionAmount(String(Math.floor(availableBalance)));
    } else {
      setOptionAmount(String(val));
    }
  };

  const activeOptions = openTrades.filter(t => t.orderType === 'short_term_option');
  const marginPositions = openTrades.filter(t => t.orderType !== 'short_term_option');

  const assetTrades = openTrades.filter(t => t.symbol === selectedAsset);

  return (
    <div className={styles.page}>
      {/* Real-time Order Filled Toast */}
      {lastFilled && (
        <div className={styles.toast}>
          <span className={styles.toastIcon}>
            <IconZap size={15} color="#f59e0b" />
          </span>
          <span>{lastFilled}</span>
        </div>
      )}

      {/* ── Asset Sidebar ── */}
      <aside className={styles.assetSidebar}>
        <div className={styles.assetSearch}>
          <div className={styles.searchWrapper}>
            <IconSearch size={14} className={styles.searchIcon} />
            <input
              placeholder="Search US stocks, crypto, FX…"
              className={styles.searchInput}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.filterTabs}>
          {(['all', 'crypto', 'commodity', 'equity', 'fx', 'index'] as const).map(f => (
            <button
              key={f}
              className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'commodity' ? 'Cmdty' : f.toUpperCase()}
            </button>
          ))}
        </div>
        <div className={styles.assetList}>
          {filteredAssets.map(a => {
            const t = ticks[a.symbol];
            const isUp = (t?.changePct ?? 0) >= 0;
            return (
              <div
                key={a.symbol}
                className={`${styles.assetItem} ${selectedAsset === a.symbol ? styles.assetItemActive : ''}`}
                onClick={() => setSelectedAsset(a.symbol)}
              >
                <div>
                  <div className={styles.assetItemSym}>{a.symbol}</div>
                  <div className={styles.assetItemName}>{a.displayName}</div>
                </div>
                <div className={styles.assetItemRight}>
                  <div className={`${styles.assetItemPrice} mono`}>{fmtPrice(t?.price, a)}</div>
                  <div className={`${styles.assetItemChg} ${isUp ? styles.up : styles.dn}`}>
                    {isUp ? '+' : ''}{(t?.changePct ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Center: Chart + Indicators ── */}
      <div className={styles.center}>
        {/* Chart Header Bar */}
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleBlock}>
            <div
              className={styles.assetSwitcherBtn}
              onClick={() => setShowAssetSearchModal(true)}
              role="button"
              tabIndex={0}
              title="Click to switch trading asset"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h1 className={styles.chartSym}>{selectedAsset}</h1>
                <IconChevronDown size={14} className={styles.assetSwitchChevron} />
              </div>
              {asset && (
                <span
                  className={`badge ${getAssetMarketStatus(asset.assetClass).isOpen ? 'badge-gain' : 'badge-loss'}`}
                  style={{ fontSize: '10px', padding: '2px 8px', letterSpacing: '0.04em' }}
                >
                  {getAssetMarketStatus(asset.assetClass).label}
                </span>
              )}
            </div>
            <span className={styles.chartName}>{asset?.displayName}</span>
          </div>


          <div className={styles.chartPrices}>
            {tick && (
              <>
                <span className={styles.bidAsk}>
                  Bid <strong className={`${styles.dn} mono`}>{fmtPrice(tick.bid)}</strong>
                </span>
                <span className={`${styles.chartBig} mono`}>{fmtPrice(tick.price)}</span>
                <span className={styles.bidAsk}>
                  Ask <strong className={`${styles.up} mono`}>{fmtPrice(tick.ask)}</strong>
                </span>
                <span className={`badge ${tick.changePct >= 0 ? 'badge-gain' : 'badge-loss'}`}>
                  {tick.changePct >= 0 ? '+' : ''}{tick.changePct.toFixed(2)}%
                </span>
              </>
            )}
          </div>

          {/* Timeframe selector */}
          <div className={styles.tfPills}>
            {(['1m', '5m', '15m', '1H', '4H', '1D'] as TF[]).map(t => (
              <button
                key={t}
                className={`${styles.tfPill} ${tf === t ? styles.tfPillActive : ''}`}
                onClick={() => setTf(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Lightweight Trading Chart */}
        <div className={styles.chartWrap}>
          <TechnicalChart symbol={selectedAsset} timeframe={tf} />
        </div>

        {/* Market Stats Bar */}
        {tick && (
          <div className={styles.statsBar}>
            <div className={styles.stat}>
              <span>24H High</span>
              <strong className={`${styles.up} mono`}>{fmtPrice(tick.high24h)}</strong>
            </div>
            <div className={styles.stat}>
              <span>24H Low</span>
              <strong className={`${styles.dn} mono`}>{fmtPrice(tick.low24h)}</strong>
            </div>
            <div className={styles.stat}>
              <span>24H Volume</span>
              <strong className="mono">${(tick.volume24h * tick.price / 1e6).toFixed(1)}M</strong>
            </div>
            <div className={styles.stat}>
              <span>Spread</span>
              <strong className="mono">{(tick.ask - tick.bid).toFixed(asset?.pipSize && asset.pipSize < 0.01 ? 4 : 2)}</strong>
            </div>
          </div>
        )}

        {/* Positions & Closed Trades History */}
        <div className={styles.assetPositions}>
          <div className={styles.assetPositionsHeader}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  background: positionsTab === 'options' ? 'var(--accent-gold-glow)' : 'transparent',
                  border: positionsTab === 'options' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  color: positionsTab === 'options' ? 'var(--accent-gold)' : 'var(--text-muted)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setPositionsTab('options')}
              >
                <span>⚡ Active Options</span>
                <span className="badge badge-gain" style={{ fontSize: '9px', padding: '1px 5px' }}>{activeOptions.length}</span>
              </button>
              <button
                type="button"
                style={{
                  background: positionsTab === 'margin' ? 'var(--accent-gold-glow)' : 'transparent',
                  border: positionsTab === 'margin' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  color: positionsTab === 'margin' ? 'var(--accent-gold)' : 'var(--text-muted)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => setPositionsTab('margin')}
              >
                Margin Positions ({marginPositions.length})
              </button>
              <button
                type="button"
                style={{
                  background: positionsTab === 'history' ? 'var(--accent-gold-glow)' : 'transparent',
                  border: positionsTab === 'history' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  color: positionsTab === 'history' ? 'var(--accent-gold)' : 'var(--text-muted)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => setPositionsTab('history')}
              >
                Settled History ({closedTrades.length})
              </button>
            </div>
          </div>

          {positionsTab === 'options' ? (
            activeOptions.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                ⚡ No active short-term contracts. Choose an interval (30s-120s) and enter Call or Put to start!
              </div>
            ) : (
              activeOptions.map(contract => {
                const cTick = ticks[contract.symbol];
                const curP = cTick?.price ?? contract.entryPrice;
                const strikeP = contract.strikePrice ?? contract.entryPrice;
                const isCall = contract.direction === 'call' || contract.direction === 'buy';
                const isItm = isCall ? curP > strikeP : curP < strikeP;
                const isAtm = curP === strikeP;
                const expiryMs = contract.targetExpiry ? new Date(contract.targetExpiry).getTime() : 0;
                const remSec = Math.max(0, Math.ceil((expiryMs - nowTs) / 1000));
                const potentialProfit = contract.sizeUsd * (contract.payoutRate ?? 0.90);

                return (
                  <div
                    key={contract.id}
                    className={`${styles.activeOptionRow} ${isItm ? styles.activeOptionRowItm : styles.activeOptionRowOtm}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge ${isCall ? 'badge-gain' : 'badge-loss'}`} style={{ fontWeight: 800 }}>
                        {isCall ? 'CALL ↗' : 'PUT ↘'}
                      </span>
                      <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{contract.symbol}</strong>
                    </div>

                    <div style={{ fontSize: '11px', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Strike: <strong className="mono" style={{ color: 'var(--text-primary)' }}>${strikeP.toFixed(4)}</strong>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Live: <strong className="mono" style={{ color: isItm ? 'var(--color-gain)' : 'var(--color-loss)' }}>${curP.toFixed(4)}</strong>
                      </span>
                      <span className="mono" style={{ color: 'var(--text-muted)' }}>
                        Stake: <strong style={{ color: 'var(--text-primary)' }}>${contract.sizeUsd.toLocaleString()}</strong>
                      </span>
                    </div>

                    <div>
                      <span className={styles.timerBadge}>
                        ⏱ {remSec}s
                      </span>
                    </div>

                    <div>
                      <span className={`${styles.itmPill} ${isAtm ? '' : isItm ? styles.itmPillGreen : styles.itmPillRed}`}>
                        {isAtm ? 'AT MONEY' : isItm ? 'IN THE MONEY' : 'OUT OF MONEY'}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: '11px', color: isItm ? 'var(--color-gain)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {isItm ? `+$${potentialProfit.toFixed(2)} (+90%)` : `-$${contract.sizeUsd.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )
          ) : positionsTab === 'margin' ? (
            marginPositions.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                No active margin positions. Place a classic CFD order to start trading.
              </div>
            ) : (
              marginPositions.map(t => {
                const tTick = ticks[t.symbol];
                const curP = tTick?.price ?? t.entryPrice;
                const pnl = ((curP - t.entryPrice) / t.entryPrice) * t.sizeUsd * (t.direction === 'buy' ? 1 : -1);
                return (
                  <div key={t.id} className={styles.posRow}>
                    <span className={`badge ${t.direction === 'buy' ? 'badge-gain' : 'badge-loss'}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{t.symbol}</strong>
                    <span className="mono">${t.sizeUsd.toLocaleString()}</span>
                    <span className="mono">@ {t.entryPrice.toFixed(4)}</span>
                    <span className={`${pnl >= 0 ? styles.up : styles.dn} mono`}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </span>
                    <button
                      className={styles.btnClose}
                      onClick={() => {
                        setCloseModalTrade(t);
                        setClosePct(100);
                      }}
                    >
                      ✕ Close / Partial
                    </button>
                  </div>
                );
              })
            )
          ) : (
            closedTrades.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                No closed trades yet.
              </div>
            ) : (
              closedTrades.slice(0, 15).map(t => {
                const isOption = t.orderType === 'short_term_option';
                const isWin = t.status === 'won' || (t.realizedPnl ?? 0) > 0;
                const isTie = t.status === 'tied' || (t.realizedPnl ?? 0) === 0;

                return (
                  <div key={t.id} className={styles.posRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge ${t.direction === 'buy' || t.direction === 'call' ? 'badge-gain' : 'badge-loss'}`}>
                        {t.direction.toUpperCase()}
                      </span>
                      {isOption && (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '9px', padding: '1px 5px' }}>
                          TURBO {t.durationSeconds ? `${t.durationSeconds}s` : 'OPT'}
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{t.symbol}</strong>
                    <span className="mono">${t.sizeUsd.toLocaleString()}</span>
                    <span className="mono">
                      {isOption ? `Strike: $${(t.strikePrice ?? t.entryPrice).toFixed(4)}` : `Exit: $${(t.exitPrice || 0).toFixed(4)}`}
                    </span>
                    <span className={`${isWin ? styles.up : isTie ? '' : styles.dn} mono`} style={{ fontWeight: 700 }}>
                      {(t.realizedPnl ?? 0) > 0 ? '+' : ''}${(t.realizedPnl ?? 0).toFixed(2)}
                      {isOption && (
                        <span style={{ fontSize: '9px', marginLeft: 4, opacity: 0.85 }}>
                          ({t.status?.toUpperCase() || (isWin ? 'WON' : 'LOST')})
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(t.closedAt || t.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Mobile Fixed Action Buttons */}
        <div className={styles.mobileOrderTriggerBar}>
          {tradingMode === 'turbo_options' ? (
            <>
              <button
                className={`${styles.mobileActionBtn} ${styles.mobileBuyBtn}`}
                onClick={() => {
                  setShowMobilePanel(true);
                }}
              >
                ⚡ CALL ↗ (30s-120s)
              </button>
              <button
                className={`${styles.mobileActionBtn} ${styles.mobileSellBtn}`}
                onClick={() => {
                  setShowMobilePanel(true);
                }}
              >
                ⚡ PUT ↘ (30s-120s)
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.mobileActionBtn} ${styles.mobileBuyBtn}`}
                onClick={() => {
                  setSide('buy');
                  setShowMobilePanel(true);
                }}
              >
                BUY / LONG {selectedAsset.split('/')[0]}
              </button>
              <button
                className={`${styles.mobileActionBtn} ${styles.mobileSellBtn}`}
                onClick={() => {
                  setSide('sell');
                  setShowMobilePanel(true);
                }}
              >
                SELL / SHORT {selectedAsset.split('/')[0]}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Order Ticket Panel / iOS Mobile Bottom Sheet ── */}
      <div
        className={`${styles.orderPanel} ${showMobilePanel ? styles.orderPanelOpen : ''}`}
      >
        {/* Mobile Drag Handle */}
        <div className={styles.mobileSheetHandleRow} onClick={() => setShowMobilePanel(false)}>
          <div className={styles.mobileSheetPill} />
          <button className={styles.mobileSheetClose}>✕</button>
        </div>

        <div className={styles.orderHeader}>
          <h3>Order Ticket</h3>
          <span className={styles.cashPill}>
            Cash: <strong className={stealthMode ? 'stealth-blur' : ''}>${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </span>
        </div>

        {/* Compliance Trading Restriction Warning Banner */}
        {isTradingBlocked && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: 14,
            color: '#ff6b81',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, color: '#ff4d6d' }}>
              <IconAlertTriangle size={15} />
              <span>Trading Privileges Suspended</span>
            </div>
            <div>
              Order execution is currently disabled for this account by HKFES Risk & Compliance. If you require assistance or feel this is an error, please reach out to our Helpdesk.
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('hkfes:open-support', { detail: { category: 'trading', subject: 'Trading Privileges Inquiry' } }))}
              style={{
                marginTop: 8,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Contact Support Desk →
            </button>
          </div>
        )}

        {/* Trading Mode Switcher: Turbo Short-Term Options (PRIMARY) vs Classic Margin */}
        <div className={styles.tradingModeSwitcher}>
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${tradingMode === 'turbo_options' ? styles.modeSwitchBtnActive : ''}`}
            onClick={() => setTradingMode('turbo_options')}
          >
            <span>⚡ Turbo Options</span>
            {/* <span className={styles.primaryBadge}>Primary</span> */}
          </button>
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${tradingMode === 'classic' ? styles.modeSwitchBtnActive : ''}`}
            onClick={() => setTradingMode('classic')}
          >
            <span>📊 Classic Margin</span>
          </button>
        </div>

        {tradingMode === 'turbo_options' ? (
          <div>
            {/* Expiry Intervals: 30s, 60s, 90s, 120s */}
            <div className={styles.orderField} style={{ marginBottom: 12 }}>
              <div className={styles.fieldLabelRow}>
                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Contract Expiry Interval
                </label>
                <span className={styles.fieldHint} style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                  ⚡ High-Speed Turbo
                </span>
              </div>
              <div className={styles.durationGrid}>
                {([30, 60, 90, 120] as const).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    className={`${styles.durationChip} ${selectedDuration === sec ? styles.durationChipActive : ''}`}
                    onClick={() => setSelectedDuration(sec)}
                  >
                    <span className={styles.durationSec}>{sec}s</span>
                    <span className={styles.durationLabel}>{sec === 60 ? '1 Min' : sec === 120 ? '2 Min' : 'Sec'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stake Amount Input & Quick Chips */}
            <div className={styles.orderField} style={{ marginBottom: 12 }}>
              <div className={styles.fieldLabelRow}>
                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Investment Stake (USD)
                </label>
                <span className={styles.fieldHint}>
                  Avail: <strong className={stealthMode ? 'stealth-blur' : ''}>${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
              </div>
              <div className={styles.inputWrapper}>
                <span className={styles.inputCurrencyPrefix}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={optionAmount}
                  onChange={e => setOptionAmount(e.target.value)}
                  placeholder="100"
                  className={styles.orderInput}
                />
              </div>
              <div className={styles.quickPctRow} style={{ marginTop: 8 }}>
                {[25, 50, 100, 250, 500].map(val => (
                  <button
                    key={val}
                    type="button"
                    className={styles.pctChip}
                    onClick={() => setQuickOptionStake(val)}
                  >
                    ${val}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.pctChip}
                  onClick={() => setQuickOptionStake('max')}
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Real-time Payout & Return Summary */}
            <div className={styles.payoutCard}>
              <div className={styles.payoutRow}>
                <span className={styles.payoutRowTitle}>Strike Price</span>
                <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                  ${fmtPrice(tick?.price)}
                </strong>
              </div>
              <div className={styles.payoutRow}>
                <span className={styles.payoutRowTitle}>Fixed Win Payout</span>
                <span className={styles.payoutRateTag}>+90.0% Net Profit</span>
              </div>
              <div className={styles.payoutRow}>
                <span className={styles.payoutRowTitle}>Est. Net Profit</span>
                <strong className="mono" style={{ color: 'var(--color-gain)' }}>
                  +${(optAmtNum * 0.90).toFixed(2)} USD
                </strong>
              </div>
              <div className={styles.payoutRow} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 2 }}>
                <span style={{ fontWeight: 700 }}>Total Payout on Win</span>
                <strong className="mono" style={{ color: 'var(--accent-gold)', fontSize: '13px' }}>
                  ${(optAmtNum * 1.90).toFixed(2)} USD
                </strong>
              </div>
            </div>

            {/* Large Prominent Turbo Actions: HIGHER / CALL & LOWER / PUT */}
            <div className={styles.turboActionGrid}>
              <button
                type="button"
                className={`${styles.turboBtn} ${styles.turboCallBtn}`}
                disabled={!optAmtNum || optAmtNum > availableBalance || isTradingBlocked || isSubmittingOption}
                onClick={() => handlePlaceOption('call')}
              >
                <div className={styles.turboBtnTitle}>
                  <span>HIGHER ↗</span>
                </div>
                <div className={styles.turboBtnSub}>
                  CALL ({selectedDuration}s)
                </div>
                <div className={styles.turboBtnReturn}>
                  +90% Payout
                </div>
              </button>

              <button
                type="button"
                className={`${styles.turboBtn} ${styles.turboPutBtn}`}
                disabled={!optAmtNum || optAmtNum > availableBalance || isTradingBlocked || isSubmittingOption}
                onClick={() => handlePlaceOption('put')}
              >
                <div className={styles.turboBtnTitle}>
                  <span>LOWER ↘</span>
                </div>
                <div className={styles.turboBtnSub}>
                  PUT ({selectedDuration}s)
                </div>
                <div className={styles.turboBtnReturn}>
                  +90% Payout
                </div>
              </button>
            </div>

            {optAmtNum > availableBalance && (
              <p className={styles.insufficientFunds} style={{ marginTop: 12 }}>
                ⚠️ Insufficient available cash. <a onClick={() => navigate('/wallet/deposit')}>Deposit now →</a>
              </p>
            )}
          </div>
        ) : (
          /* Classic Margin & CFD Order Ticket */
          <>
            {/* Buy / Sell Toggle Tabs */}
            <div className={styles.sideToggle}>
              <button
                className={`${styles.sideBuy} ${side === 'buy' ? styles.sideBuyActive : ''}`}
                onClick={() => setSide('buy')}
              >
                BUY / LONG
              </button>
              <button
                className={`${styles.sideSell} ${side === 'sell' ? styles.sideSellActive : ''}`}
                onClick={() => setSide('sell')}
              >
                SELL / SHORT
              </button>
            </div>

            {/* Order Types */}
            <div className={styles.orderTypes}>
              {(['market', 'limit', 'stop'] as OrderType[]).map(ot => (
                <button
                  key={ot}
                  className={`${styles.otBtn} ${orderType === ot ? styles.otBtnActive : ''}`}
                  onClick={() => setOrderType(ot)}
                >
                  {ot.charAt(0).toUpperCase() + ot.slice(1)}
                </button>
              ))}
            </div>

            {/* Amount Input & Percentage Chips */}
            <div className={styles.orderFields}>
              <div className={styles.orderField}>
                <div className={styles.fieldLabelRow}>
                  <label>Amount (USD)</label>
                  <span className={styles.fieldHint}>≈ {units} {selectedAsset.split('/')[0]}</span>
                </div>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputCurrencyPrefix}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="1000"
                    className={styles.orderInput}
                  />
                </div>

                {/* Quick Percentage Chips */}
                <div className={styles.quickPctRow}>
                  <button className={styles.pctChip} onClick={() => setQuickPercent(0.25)}>25%</button>
                  <button className={styles.pctChip} onClick={() => setQuickPercent(0.50)}>50%</button>
                  <button className={styles.pctChip} onClick={() => setQuickPercent(0.75)}>75%</button>
                  <button className={styles.pctChip} onClick={() => setQuickPercent(1.0)}>MAX</button>
                </div>
              </div>

              {orderType !== 'market' && (
                <div className={styles.orderField}>
                  <label>{orderType === 'limit' ? 'Limit Price (USD)' : 'Stop Price (USD)'}</label>
                  <input
                    type="number"
                    step="any"
                    value={limitPrice}
                    onChange={e => setLimitPrice(e.target.value)}
                    placeholder={fmtPrice(fillPrice)}
                    className={styles.orderInput}
                  />
                </div>
              )}

              <div className={styles.slTpRow}>
                <div className={styles.orderField}>
                  <label>Stop Loss (USD)</label>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss}
                    onChange={e => setStopLoss(e.target.value)}
                    placeholder="Optional"
                    className={styles.orderInput}
                  />
                </div>
                <div className={styles.orderField}>
                  <label>Take Profit (USD)</label>
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={e => setTakeProfit(e.target.value)}
                    placeholder="Optional"
                    className={styles.orderInput}
                  />
                </div>
              </div>
            </div>

            {/* Transparent Execution & Fee Breakdown with Progressive Disclosure */}
            <div className={styles.orderSummary}>
              <div className={`${styles.summaryRow} ${styles.summaryTotalRow}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Total Settlement</span>
                  <button
                    type="button"
                    className={styles.breakdownToggleBtn}
                    onClick={() => setShowOrderBreakdown(prev => !prev)}
                    aria-label="Toggle fee breakdown"
                  >
                    {showOrderBreakdown ? 'Details ▴' : 'Details ▾'}
                  </button>
                </div>
                <strong className="mono">${amtNum.toLocaleString()}</strong>
              </div>

              {showOrderBreakdown && (
                <div className={styles.breakdownExpanded}>
                  <div className={styles.summaryRow}>
                    <span>Est. Execution Price</span>
                    <strong className="mono">{fmtPrice(fillPrice)}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Commission & Exchange Fee</span>
                    <strong className="mono" style={{ color: 'var(--color-gain)' }}>$0.00 (Zero Fee)</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Est. Slippage Protection</span>
                    <strong className="mono">0.02% (Tier 1 Router)</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Slide-to-Confirm Execution Bar */}
            <div className={styles.slideActionArea}>
              <SlideToConfirm
                side={side}
                onConfirm={handlePlaceOrder}
                disabled={!amtNum || amtNum > availableBalance || isTradingBlocked}
                disabledReason={isTradingBlocked ? 'Trading Disabled by Compliance' : undefined}
              />
            </div>

            {amtNum > availableBalance && (
              <p className={styles.insufficientFunds}>
                ⚠️ Insufficient available cash. <a onClick={() => navigate('/wallet/deposit')}>Deposit now →</a>
              </p>
            )}
          </>
        )}
      </div>

      {/* Partial / Full Close Position Modal */}
      {closeModalTrade && (() => {
        const tTick = ticks[closeModalTrade.symbol];
        const curP = tTick?.price ?? closeModalTrade.entryPrice;
        const closeFraction = closePct / 100;
        const closeSize = closeModalTrade.sizeUsd * closeFraction;
        const pnl = ((curP - closeModalTrade.entryPrice) / closeModalTrade.entryPrice) * closeSize * (closeModalTrade.direction === 'buy' ? 1 : -1);
        const estCashReturn = closeSize + pnl;

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 'var(--space-4)',
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '440px',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-modal)',
            }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 6 }}>
                Close Position ({closeModalTrade.symbol})
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
                Realize simulated profit/loss and release margin balance back to your cash wallet.
              </p>

              <div style={{
                background: 'var(--bg-elevated)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                fontSize: 'var(--text-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Side</span>
                  <span className={`badge ${closeModalTrade.direction === 'buy' ? 'badge-gain' : 'badge-loss'}`}>
                    {closeModalTrade.direction.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Position Size</span>
                  <strong className="mono">${closeModalTrade.sizeUsd.toLocaleString()} USD</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Entry Price</span>
                  <strong className="mono">${closeModalTrade.entryPrice.toFixed(4)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Price</span>
                  <strong className="mono">${curP.toFixed(4)}</strong>
                </div>
              </div>

              {/* Percentage Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Closing Percentage: <strong>{closePct}%</strong> (${closeSize.toLocaleString()} USD)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      className={styles.pctChip}
                      style={{
                        flex: 1,
                        background: closePct === pct ? 'var(--accent-gold-glow)' : 'var(--bg-elevated)',
                        borderColor: closePct === pct ? 'var(--accent-gold)' : 'var(--border-subtle)',
                        color: closePct === pct ? 'var(--accent-gold)' : 'var(--text-primary)',
                      }}
                      onClick={() => setClosePct(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Realized Settlement Preview */}
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 12,
                marginBottom: 16,
                fontSize: 'var(--text-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Realized PnL:</span>
                  <strong className="mono" style={{ color: pnl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash Returned to Wallet:</span>
                  <strong className="mono" style={{ color: 'var(--accent-gold)' }}>
                    ${estCashReturn.toFixed(2)} USD
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={styles.btnClose}
                  style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
                  onClick={() => setCloseModalTrade(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    background: 'var(--color-loss)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    closeTrade(closeModalTrade.id, curP, closePct);
                    setCloseModalTrade(null);
                  }}
                >
                  Confirm {closePct}% Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Backdrop overlay on mobile when sheet is open */}
      {showMobilePanel && (
        <div
          className="backdrop"
          onClick={() => setShowMobilePanel(false)}
        />
      )}

      {/* ── Mobile Full-Screen Asset Search & Switcher Modal Takeover ── */}
      {showAssetSearchModal && (
        <div className={styles.assetModalTakeover}>
          <div className={styles.assetModalHeader}>
            <div className={styles.assetModalTitleRow}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Select Trading Asset</h3>
              <button
                className={styles.assetModalCloseBtn}
                onClick={() => setShowAssetSearchModal(false)}
                aria-label="Close asset selector"
              >
                ✕
              </button>
            </div>
            <div className={styles.assetModalSearchBox}>
              <input
                type="text"
                placeholder="Search US stocks, crypto, FX (BTC, NVDA, EUR)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className={styles.assetModalSearchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.assetModalClearBtn}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter pills with horizontal scroll */}
            <div className="fadeEdgeTrack" style={{ padding: '6px 0', margin: 0 }}>
              {(['all', 'crypto', 'commodity', 'equity', 'fx', 'index'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  className={`filterPill ${filter === f ? 'filterPillActive' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All Assets' : f === 'commodity' ? 'Commodities' : f === 'fx' ? 'Forex' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.assetModalList}>
            {filteredAssets.map(a => {
              const t = ticks[a.symbol];
              const isUp = (t?.changePct ?? 0) >= 0;
              const isSelected = selectedAsset === a.symbol;
              return (
                <div
                  key={a.symbol}
                  className={`${styles.assetModalItem} ${isSelected ? styles.assetModalItemActive : ''}`}
                  onClick={() => {
                    setSelectedAsset(a.symbol);
                    setShowAssetSearchModal(false);
                    navigate(`/trade/${encodeURIComponent(a.symbol)}`);
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={styles.assetItemSym} style={{ fontSize: '14px', fontWeight: 800 }}>{a.symbol}</span>
                      <span className={`badge ${isUp ? 'badge-gain' : 'badge-loss'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                        {isUp ? '+' : ''}{(t?.changePct ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className={styles.assetItemName} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.displayName}</div>
                  </div>
                  <div className={styles.assetItemRight}>
                    <div className={`${styles.assetItemPrice} mono`} style={{ fontSize: '14px', fontWeight: 700 }}>
                      ${fmtPrice(t?.price, a)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {a.assetClass}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* ── Turbo Options Settlement Modal Takeover ── */}
      {settlementModalData && (
        <div className={styles.settlementModalOverlay} onClick={() => setSettlementModalData(null)}>
          <div className={styles.settlementModalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: 12 }}>
              {settlementModalData.outcome === 'won' ? '🎉' : settlementModalData.outcome === 'tied' ? '🔄' : '📉'}
            </div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: settlementModalData.outcome === 'won' ? 'var(--color-gain)' : settlementModalData.outcome === 'tied' ? 'var(--accent-gold)' : 'var(--color-loss)',
              marginBottom: 4,
            }}>
              {settlementModalData.outcome === 'won' ? 'CONTRACT WON!' : settlementModalData.outcome === 'tied' ? 'TIE / REFUND' : 'OPTION EXPIRED OTM'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 20 }}>
              {settlementModalData.outcome === 'won'
                ? `Congratulations! Your prediction on ${settlementModalData.symbol} was in the money.`
                : settlementModalData.outcome === 'tied'
                  ? `Contract settled exactly at strike price. Full stake refunded to your cash balance.`
                  : `Market moved against contract prediction at expiry.`}
            </p>

            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 20,
              textAlign: 'left',
              fontSize: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Asset & Direction</span>
                <span className={`badge ${settlementModalData.direction === 'call' ? 'badge-gain' : 'badge-loss'}`} style={{ fontWeight: 800 }}>
                  {settlementModalData.symbol} {settlementModalData.direction.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Strike Price</span>
                <strong className="mono">${settlementModalData.strike.toFixed(4)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Expiry Settlement Price</span>
                <strong className="mono" style={{ color: settlementModalData.outcome === 'won' ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                  ${settlementModalData.exit.toFixed(4)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <span style={{ fontWeight: 700 }}>Realized P&L</span>
                <strong className="mono" style={{
                  fontSize: '15px',
                  color: settlementModalData.outcome === 'won' ? 'var(--color-gain)' : settlementModalData.outcome === 'tied' ? 'var(--accent-gold)' : 'var(--color-loss)',
                }}>
                  {settlementModalData.pnl >= 0 ? '+' : ''}${settlementModalData.pnl.toFixed(2)} USD
                </strong>
              </div>
              {settlementModalData.outcome === 'won' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Cash Credited</span>
                  <strong className="mono" style={{ color: 'var(--accent-gold)' }}>
                    +${(settlementModalData.amount + settlementModalData.pnl).toFixed(2)} USD
                  </strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 800 }}
              onClick={() => setSettlementModalData(null)}
            >
              Continue Trading ⚡
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

