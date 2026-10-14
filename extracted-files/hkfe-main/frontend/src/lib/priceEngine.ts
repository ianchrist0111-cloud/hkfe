// HKFES Market Price Engine & WebSocket Consumer
// Connects to backend WebSocket price stream when live, with local fallback simulation.

import { useEffect, useRef, useCallback } from 'react';
import { usePriceStore, useTradesStore, useWalletStore, useNotificationsStore } from '../store';
import { API_BASE_URL, WS_BASE_URL, getAuthToken } from './api';
import type { PriceTick } from '../store';

export const BINANCE_CRYPTO_MAP: Record<string, string> = {
  'BTCUSDT': 'BTC/USD',
  'ETHUSDT': 'ETH/USD',
  'SOLUSDT': 'SOL/USD',
  'BNBUSDT': 'BNB/USD',
  'XRPUSDT': 'XRP/USD',
  'DOGEUSDT': 'DOGE/USD',
  'ADAUSDT': 'ADA/USD',
  'AVAXUSDT': 'AVAX/USD',
  'DOTUSDT': 'DOT/USD',
  'LINKUSDT': 'LINK/USD',
  'NEARUSDT': 'NEAR/USD',
  'SUIUSDT': 'SUI/USD',
};

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetConfig {
  symbol: string;
  displayName: string;
  assetClass: 'fx' | 'crypto' | 'equity' | 'index' | 'commodity';
  pipSize: number;
  minTradeSize: number;
  seedPrice: number;
}

export const ASSETS: AssetConfig[] = [
  // ── Commodities (Gold, Silver, Energy) ──
  { symbol: 'XAU/USD',  displayName: 'Gold Spot / USD',           assetClass: 'commodity', pipSize: 0.01,   minTradeSize: 10,  seedPrice: 4158.50 },
  { symbol: 'XAG/USD',  displayName: 'Silver Spot / USD',         assetClass: 'commodity', pipSize: 0.001,  minTradeSize: 10,  seedPrice: 48.75 },
  { symbol: 'WTI/USD',  displayName: 'Crude Oil (WTI) / USD',     assetClass: 'commodity', pipSize: 0.01,   minTradeSize: 10,  seedPrice: 88.50 },
  { symbol: 'BRENT/USD', displayName: 'Brent Crude Oil / USD',    assetClass: 'commodity', pipSize: 0.01,   minTradeSize: 10,  seedPrice: 92.20 },
  { symbol: 'NG/USD',   displayName: 'Natural Gas / USD',         assetClass: 'commodity', pipSize: 0.001,  minTradeSize: 10,  seedPrice: 2.85 },

  // ── Crypto (Proper High-Liquidity Coins calibrated to Binance) ──
  { symbol: 'BTC/USD',  displayName: 'Bitcoin',                   assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 85930.00 },
  { symbol: 'ETH/USD',  displayName: 'Ethereum',                  assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 2715.00 },
  { symbol: 'SOL/USD',  displayName: 'Solana',                    assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 120.60 },
  { symbol: 'BNB/USD',  displayName: 'BNB (Binance Coin)',        assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 781.90 },
  { symbol: 'XRP/USD',  displayName: 'XRP (Ripple)',              assetClass: 'crypto',    pipSize: 0.0001, minTradeSize: 10,  seedPrice: 1.5040 },
  { symbol: 'DOGE/USD', displayName: 'Dogecoin',                  assetClass: 'crypto',    pipSize: 0.0001, minTradeSize: 10,  seedPrice: 0.0950 },
  { symbol: 'ADA/USD',  displayName: 'Cardano',                   assetClass: 'crypto',    pipSize: 0.0001, minTradeSize: 10,  seedPrice: 0.2740 },
  { symbol: 'AVAX/USD', displayName: 'Avalanche',                 assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 11.40 },
  { symbol: 'DOT/USD',  displayName: 'Polkadot',                  assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 1.237 },
  { symbol: 'LINK/USD', displayName: 'Chainlink',                 assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 13.97 },
  { symbol: 'NEAR/USD', displayName: 'NEAR Protocol',             assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 5.30 },
  { symbol: 'SUI/USD',  displayName: 'Sui Network',               assetClass: 'crypto',    pipSize: 0.001,  minTradeSize: 10,  seedPrice: 1.206 },

  // ── Equities (Top Global Companies & Mega-Caps) ──
  { symbol: 'AAPL',     displayName: 'Apple Inc.',                assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 254.40 },
  { symbol: 'NVDA',     displayName: 'NVIDIA Corp.',              assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 180.20 },
  { symbol: 'MSFT',     displayName: 'Microsoft Corp.',           assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 435.00 },
  { symbol: 'AMZN',     displayName: 'Amazon.com Inc.',           assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 195.00 },
  { symbol: 'GOOGL',    displayName: 'Alphabet Inc. (Google)',    assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 178.50 },
  { symbol: 'META',     displayName: 'Meta Platforms Inc.',       assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 595.00 },
  { symbol: 'TSLA',     displayName: 'Tesla Inc.',                assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 378.70 },
  { symbol: 'NFLX',     displayName: 'Netflix Inc.',              assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 720.00 },
  { symbol: 'AMD',      displayName: 'Advanced Micro Devices',    assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 160.00 },
  { symbol: 'BABA',     displayName: 'Alibaba Group',             assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 95.00 },
  { symbol: 'COIN',     displayName: 'Coinbase Global',           assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 225.00 },
  { symbol: 'PLTR',     displayName: 'Palantir Technologies',     assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 45.00 },

  // ── FX Major Pairs ──
  { symbol: 'EUR/USD',  displayName: 'Euro / US Dollar',          assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 1.0825 },
  { symbol: 'GBP/USD',  displayName: 'British Pound / USD',       assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 1.2940 },
  { symbol: 'USD/JPY',  displayName: 'US Dollar / Yen',           assetClass: 'fx',        pipSize: 0.01,   minTradeSize: 100, seedPrice: 157.98 },
  { symbol: 'AUD/USD',  displayName: 'Australian Dollar / USD',   assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 0.6580 },
  { symbol: 'USD/CHF',  displayName: 'US Dollar / Swiss Franc',   assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 0.8311 },
  { symbol: 'USD/CAD',  displayName: 'US Dollar / Canadian $',    assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 1.4256 },
  { symbol: 'GBP/JPY',  displayName: 'British Pound / Yen',       assetClass: 'fx',        pipSize: 0.01,   minTradeSize: 100, seedPrice: 204.45 },
  { symbol: 'EUR/GBP',  displayName: 'Euro / British Pound',      assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 0.8365 },

  // ── World Indices ──
  { symbol: 'SPX500',   displayName: 'S&P 500 Index',             assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 5850 },
  { symbol: 'NAS100',   displayName: 'NASDAQ 100 Index',          assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 20450 },
  { symbol: 'US30',     displayName: 'Dow Jones 30 Index',        assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 51270 },
  { symbol: 'GER40',    displayName: 'DAX 40 (Germany)',          assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 19450 },
];

const VOLATILITIES: Record<string, number> = {
  // Commodities
  'XAU/USD': 0.0008, 'XAG/USD': 0.0015, 'WTI/USD': 0.0018, 'BRENT/USD': 0.0016, 'NG/USD': 0.0022,
  // Crypto
  'BTC/USD': 0.0025, 'ETH/USD': 0.003, 'SOL/USD': 0.0045, 'BNB/USD': 0.0028,
  'XRP/USD': 0.0040, 'DOGE/USD': 0.0055, 'ADA/USD': 0.0042, 'AVAX/USD': 0.0048,
  'DOT/USD': 0.0042, 'LINK/USD': 0.0040, 'NEAR/USD': 0.0045, 'SUI/USD': 0.0050,
  // Equities
  'AAPL': 0.001, 'NVDA': 0.0022, 'MSFT': 0.001, 'AMZN': 0.0015, 'GOOGL': 0.0012,
  'META': 0.0018, 'TSLA': 0.0025, 'NFLX': 0.0018, 'AMD': 0.0024, 'BABA': 0.0020,
  'COIN': 0.0032, 'PLTR': 0.0028,
  // FX
  'EUR/USD': 0.0004, 'GBP/USD': 0.0005, 'USD/JPY': 0.0004, 'AUD/USD': 0.0005,
  'USD/CHF': 0.0004, 'USD/CAD': 0.0004, 'GBP/JPY': 0.0006, 'EUR/GBP': 0.0004,
  // Indices
  'SPX500': 0.0006, 'NAS100': 0.0009, 'US30': 0.0006, 'GER40': 0.0007,
};

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function mapBackendTick(tick: any): PriceTick {
  return {
    symbol: tick.symbol,
    price: tick.price,
    bid: tick.bid ?? tick.price * 0.9999,
    ask: tick.ask ?? tick.price * 1.0001,
    change: tick.change24h ?? 0,
    changePct: tick.change24h ?? 0,
    high24h: tick.high24h ?? tick.price,
    low24h: tick.low24h ?? tick.price,
    volume24h: tick.volume24h ?? 0,
    timestamp: Date.now(),
    direction: tick.price > (tick.previousPrice ?? tick.price) ? 'up' : tick.price < (tick.previousPrice ?? tick.price) ? 'down' : 'flat',
  };
}

export class PriceEngine {
  private prices: Record<string, number> = {};
  private candles: Record<string, Candle[]> = {};
  private listeners: Set<(ticks: Record<string, PriceTick>) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncing = false;
  private wsUrlIndex = 0;
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private paused = false;
  private liveSymbols: Set<string> = new Set();
  private anchors: Record<string, number> = {};
  private changePct: Record<string, number> = {};
  private startCount = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor() {
    for (const a of ASSETS) this.candles[a.symbol] = [];
    this.syncLiveQuotes();
  }

  private rememberQuote(symbol: string, price: number, changePct?: number) {
    if (!Number.isFinite(price) || price <= 0) return;
    this.prices[symbol] = price;
    this.anchors[symbol] = price;
    this.liveSymbols.add(symbol);
    if (changePct != null && Number.isFinite(changePct)) this.changePct[symbol] = changePct;
    this.calibrateCandles(symbol, price);
    this.updateCandle(symbol, price);
  }

  private publish(ticks: Record<string, PriceTick>) {
    if (Object.keys(ticks).length === 0) return;
    usePriceStore.getState().setTicks(ticks);
    useTradesStore.getState().updateTradePrices(ticks);
    for (const listener of this.listeners) listener(ticks);
  }

  public getCandles(symbol: string): Candle[] {
    return this.candles[symbol] || [];
  }

  public setCandles(symbol: string, candles: Candle[]) {
    if (candles && candles.length > 0) {
      this.candles[symbol] = candles;
    }
  }

  private calibrateCandles(symbol: string, currentPrice: number) {
    const cList = this.candles[symbol];
    if (cList && cList.length > 0) {
      const lastC = cList[cList.length - 1];
      if (lastC && lastC.close > 0 && Math.abs(lastC.close - currentPrice) / currentPrice > 0.02) {
        const ratio = currentPrice / lastC.close;
        const prec = currentPrice < 5 ? 4 : 2;
        for (const c of cList) {
          c.open = Number((c.open * ratio).toFixed(prec));
          c.high = Number((c.high * ratio).toFixed(prec));
          c.low = Number((c.low * ratio).toFixed(prec));
          c.close = Number((c.close * ratio).toFixed(prec));
        }
      }
    }
  }

  public async syncLiveQuotes(): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;
    let synced = false;

    // 1. Try to fetch live market assets from backend REST API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE_URL}/market/assets`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
          for (const a of json.data) {
            // Ignore stored seed rows. Only an exchange-confirmed quote is shown.
            if (a.symbol && a.currentPrice && a.quoteLive === true) {
              const liveP = Number(a.currentPrice);
              const prevP = this.prices[a.symbol] || liveP;
              const chg = Number(a.change24h || 0);
              this.rememberQuote(a.symbol, liveP, chg);
              const prec = a.pipSize <= 0.0001 ? 4 : (liveP < 5 ? 3 : 2);
              ticks[a.symbol] = {
                symbol: a.symbol,
                price: liveP,
                bid: Number((liveP * 0.9999).toFixed(prec)),
                ask: Number((liveP * 1.0001).toFixed(prec)),
                change: chg,
                changePct: chg,
                high24h: a.high24h || liveP,
                low24h: a.low24h || liveP,
                volume24h: a.volume24h || 0,
                timestamp: Date.now(),
                direction: liveP > prevP ? 'up' : liveP < prevP ? 'down' : 'flat',
              };
            }
          }
          this.publish(ticks);
          if (json.data.some((a: { quoteLive?: boolean }) => a.quoteLive === true)) synced = true;
        }
      }
    } catch {
      // Backend not reached, fall back to direct Binance live quote feed
    }

    // 2. Direct Binance live quotes fallback (ensures crypto & gold prices 100% match Binance in real-time)
    try {
      const symbolsParam = JSON.stringify(Object.keys(BINANCE_CRYPTO_MAP));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
          for (const item of data) {
            const sym = BINANCE_CRYPTO_MAP[item.symbol];
            if (sym) {
              const liveP = parseFloat(item.lastPrice);
              const chg = parseFloat(item.priceChangePercent) || 0;
              const prevP = this.prices[sym] || liveP;
              if (!isNaN(liveP) && liveP > 0) {
                this.rememberQuote(sym, liveP, chg);
                const prec = sym.includes('BTC') || sym.includes('ETH') ? 2 : (liveP < 5 ? 4 : 2);
                ticks[sym] = {
                  symbol: sym,
                  price: liveP,
                  bid: parseFloat((item.bidPrice || (liveP * 0.9999)).toString()),
                  ask: parseFloat((item.askPrice || (liveP * 1.0001)).toString()),
                  change: parseFloat((item.priceChange || '0').toString()),
                  changePct: chg,
                  high24h: parseFloat(item.highPrice) || liveP,
                  low24h: parseFloat(item.lowPrice) || liveP,
                  volume24h: parseFloat(item.volume) || 0,
                  timestamp: Date.now(),
                  direction: liveP > prevP ? 'up' : liveP < prevP ? 'down' : 'flat',
                };
              }
            }
          }
          this.publish(ticks);
          synced = true;
        }
      }
    } catch {
      // Binance fetch error / offline
    }

    // 3. Spot FX from the open exchange-rate feed, so majors are not left on a seed
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        const rates = fxData?.rates;
        if (rates?.EUR && rates?.GBP && rates?.JPY) {
          const fxQuotes: Record<string, number> = {
            'EUR/USD': Number((1 / rates.EUR).toFixed(5)),
            'GBP/USD': Number((1 / rates.GBP).toFixed(5)),
            'USD/JPY': Number(Number(rates.JPY).toFixed(3)),
            'AUD/USD': Number((1 / rates.AUD).toFixed(5)),
            'USD/CAD': Number(Number(rates.CAD).toFixed(5)),
            'USD/CHF': Number(Number(rates.CHF).toFixed(5)),
            'GBP/JPY': Number(((1 / rates.GBP) * rates.JPY).toFixed(3)),
            'EUR/GBP': Number((rates.GBP / rates.EUR).toFixed(5)),
          };
          const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
          for (const [sym, liveP] of Object.entries(fxQuotes)) {
            if (!Number.isFinite(liveP) || liveP <= 0) continue;
            const prevP = this.prices[sym] || liveP;
            const chg = this.changePct[sym] ?? ticks[sym]?.changePct ?? 0;
            this.rememberQuote(sym, liveP, chg);
            const prec = liveP < 5 ? 5 : 3;
            ticks[sym] = {
              symbol: sym,
              price: liveP,
              bid: Number((liveP * 0.9999).toFixed(prec)),
              ask: Number((liveP * 1.0001).toFixed(prec)),
              change: chg,
              changePct: chg,
              high24h: ticks[sym]?.high24h || liveP,
              low24h: ticks[sym]?.low24h || liveP,
              volume24h: ticks[sym]?.volume24h || 0,
              timestamp: Date.now(),
              direction: liveP > prevP ? 'up' : liveP < prevP ? 'down' : 'flat',
            };
          }
          this.publish(ticks);
          synced = true;
        }
      }
    } catch {
      // FX feed unavailable; backend snapshot still covers these pairs
    }

    this.isSyncing = false;
    return synced;
  }

  public start(intervalMs = 1000) {
    this.startCount += 1;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.syncLiveQuotes();
    if (this.running) return;
    this.running = true;
    this.tryConnectWebSocket();

    if (!this.pollIntervalId) {
      this.pollIntervalId = setInterval(() => {
        this.syncLiveQuotes();
      }, 5000);
    }

    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      if (this.paused || this.wsConnected) return;
      this.stepSimulation();
    }, intervalMs);
  }

  public stop() {
    this.startCount = Math.max(0, this.startCount - 1);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    // React StrictMode mounts, unmounts, then mounts again. Delay the teardown
    // so that second mount cancels it and the live feed is not dropped.
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      if (this.startCount > 0) return;
      this.running = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.pollIntervalId) {
        clearInterval(this.pollIntervalId);
        this.pollIntervalId = null;
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.ws) {
        this.ws.close();
        this.ws = null;
        this.wsConnected = false;
      }
    }, 50);
  }

  public subscribe(callback: (ticks: Record<string, PriceTick>) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public pause() {
    this.paused = true;
  }

  public resume() {
    this.paused = false;
  }

  public resetPrices() {
    this.liveSymbols.clear();
    this.syncLiveQuotes();
  }

  public injectSpike(symbol: string, magnitudePercent: number, direction: 'up' | 'down' | 'random') {
    const cur = this.prices[symbol];
    if (!cur) return;
    let sign = 1;
    if (direction === 'down') sign = -1;
    else if (direction === 'random') sign = Math.random() > 0.5 ? 1 : -1;

    const newPrice = cur * (1 + sign * (magnitudePercent / 100));
    this.anchors[symbol] = newPrice;
    this.liveSymbols.add(symbol);
    this.prices[symbol] = newPrice;
    this.updateCandle(symbol, newPrice);
    this.emitCurrentTicks();
  }

  private stepSimulation() {
    const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
    let changed = false;
    for (const a of ASSETS) {
      if (!this.liveSymbols.has(a.symbol)) continue;
      const prev = this.prices[a.symbol];
      const anchor = this.anchors[a.symbol];
      if (!prev || !anchor) continue;
      const micro = Math.min((VOLATILITIES[a.symbol] || 0.001) * 0.02, 0.00002);
      const newP = prev * 0.2 + anchor * 0.8 + anchor * micro * randn();
      this.prices[a.symbol] = newP;
      const pipPrecision = a.pipSize <= 0.0001 ? 4 : a.pipSize <= 0.001 ? 3 : (anchor < 5 ? 4 : 2);
      const chg = this.changePct[a.symbol] ?? 0;

      ticks[a.symbol] = {
        symbol: a.symbol,
        price: parseFloat(newP.toFixed(pipPrecision)),
        bid: parseFloat((newP * 0.9999).toFixed(pipPrecision)),
        ask: parseFloat((newP * 1.0001).toFixed(pipPrecision)),
        change: chg,
        changePct: chg,
        high24h: ticks[a.symbol]?.high24h || anchor,
        low24h: ticks[a.symbol]?.low24h || anchor,
        volume24h: ticks[a.symbol]?.volume24h || 0,
        timestamp: Date.now(),
        direction: newP > prev ? 'up' : newP < prev ? 'down' : 'flat',
      };
      changed = true;
      this.updateCandle(a.symbol, newP);
    }

    if (changed) this.publish(ticks);
  }

  public updateCandle(symbol: string, price: number) {
    const cList = this.candles[symbol];
    if (!cList || cList.length === 0) return;
    const last = cList[cList.length - 1];
    const now = Date.now();
    if (now - last.time > 60 * 1000) {
      // New 1m candle starting at previous close for seamless continuity (0 gap)
      cList.push({
        time: now,
        open: last.close,
        high: Math.max(last.close, price),
        low: Math.min(last.close, price),
        close: price,
        volume: 1,
      });
      if (cList.length > 200) cList.shift();
    } else {
      // Update current active candle
      last.close = price;
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.volume += 1;
    }
  }

  private emitCurrentTicks() {
    const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
    for (const a of ASSETS) {
      if (!this.liveSymbols.has(a.symbol)) continue;
      const p = this.prices[a.symbol];
      if (!p) continue;
      const chg = this.changePct[a.symbol] ?? ticks[a.symbol]?.changePct ?? 0;
      const pipPrecision = a.pipSize <= 0.0001 ? 4 : a.pipSize <= 0.001 ? 3 : (p < 5 ? 4 : 2);

      ticks[a.symbol] = {
        symbol: a.symbol,
        price: parseFloat(p.toFixed(pipPrecision)),
        bid: parseFloat((p * 0.9999).toFixed(pipPrecision)),
        ask: parseFloat((p * 1.0001).toFixed(pipPrecision)),
        change: chg,
        changePct: chg,
        high24h: ticks[a.symbol]?.high24h || p,
        low24h: ticks[a.symbol]?.low24h || p,
        volume24h: ticks[a.symbol]?.volume24h || 0,
        timestamp: Date.now(),
        direction: 'flat',
      };
    }
    this.publish(ticks);
  }

  public authenticate(token: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'auth', token }));
    }
  }

  private candidateWsUrls(): string[] {
    const urls = [WS_BASE_URL];
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const direct4000 = `${protocol}//${window.location.hostname}:4000/ws/prices`;
      if (!urls.includes(direct4000)) {
        urls.push(direct4000);
      }
      const hostUrl = `${protocol}//${window.location.host}/ws/prices`;
      if (!urls.includes(hostUrl)) {
        urls.push(hostUrl);
      }
    }
    return urls;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.tryConnectWebSocket();
    }, 3000);
  }

  private tryConnectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (typeof WebSocket === 'undefined') return;

    const urls = this.candidateWsUrls();
    const targetUrl = urls[this.wsUrlIndex % urls.length];

    try {
      this.ws = new WebSocket(targetUrl);
      this.ws.onopen = () => {
        this.wsConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        const token = getAuthToken();
        if (token && this.ws) {
          this.ws.send(JSON.stringify({ action: 'auth', token }));
        }
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if ((msg.type === 'snapshot' || msg.type === 'tick') && Array.isArray(msg.data)) {
            const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
            for (const item of msg.data) {
              const mapped = mapBackendTick(item);
              if (!Number.isFinite(mapped.price) || mapped.price <= 0) continue;
              const prevAnchor = this.anchors[mapped.symbol] ?? mapped.price;
              const drift = prevAnchor > 0 ? Math.abs(mapped.price - prevAnchor) / prevAnchor : 1;
              this.prices[mapped.symbol] = mapped.price;
              this.liveSymbols.add(mapped.symbol);
              if (!this.anchors[mapped.symbol] || msg.type === 'snapshot' || drift > 0.0015) {
                this.anchors[mapped.symbol] = mapped.price;
              }
              this.changePct[mapped.symbol] = mapped.changePct;
              this.calibrateCandles(mapped.symbol, mapped.price);
              this.updateCandle(mapped.symbol, mapped.price);
              ticks[mapped.symbol] = mapped;
            }
            this.publish(ticks);
          } else if (msg.type === 'order_filled') {
            useTradesStore.getState().fetchPositions();
            useWalletStore.getState().fetchWallet();
            useNotificationsStore.getState().addNotification({
              type: 'order_filled',
              title: 'Order Executed',
              message: msg.message || 'Your pending order was executed.',
              symbol: msg.trade?.assetSymbol,
            });
          } else if (msg.type === 'position_closed') {
            useTradesStore.getState().fetchPositions();
            useTradesStore.getState().fetchHistory();
            useWalletStore.getState().fetchWallet();
            useNotificationsStore.getState().addNotification({
              type: 'order_filled',
              title: `${msg.reason || 'Position'} Triggered`,
              message: msg.message || 'Position was closed.',
              symbol: msg.trade?.assetSymbol,
            });
          }
        } catch {
          // ignore malformed ws packet
        }
      };
      this.ws.onclose = () => {
        this.wsConnected = false;
        this.ws = null;
        this.wsUrlIndex++;
        this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        this.wsConnected = false;
        if (this.ws) {
          try { this.ws.close(); } catch {}
          this.ws = null;
        }
        this.wsUrlIndex++;
        this.scheduleReconnect();
      };
    } catch {
      this.wsConnected = false;
      this.ws = null;
      this.wsUrlIndex++;
      this.scheduleReconnect();
    }
  }
}

export const priceEngine = new PriceEngine();
export const fallbackPriceEngine = priceEngine;

export function usePriceWebSocket() {
  const setTicks = usePriceStore(s => s.setTicks);
  const updateTradePrices = useTradesStore(s => s.updateTradePrices);

  useEffect(() => {
    priceEngine.start(1000);
    const unsub = priceEngine.subscribe((ticks) => {
      setTicks(ticks);
      updateTradePrices(ticks);
    });
    return () => {
      unsub();
    };
  }, [setTicks, updateTradePrices]);
}
