import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { ENV } from '../config/env';

export interface PriceTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  change24h: number;
  timestamp: string;
}

export class PriceEngineService {
  private static instance: PriceEngineService;
  private wss: WebSocketServer | null = null;
  private isPaused: boolean = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private assetPrices: Map<string, { price: number; seedPrice: number; volatility: number; high24h: number; low24h: number; change24h?: number; anchor: number; live: boolean; changeReady: boolean }> = new Map();
  private syncInFlight: Promise<{ synced: number; details: Record<string, number> }> | null = null;
  private lastYahooSync = 0;

  private constructor() {}

  public static getInstance(): PriceEngineService {
    if (!PriceEngineService.instance) {
      PriceEngineService.instance = new PriceEngineService();
    }
    return PriceEngineService.instance;
  }

  public async initialize(wss: WebSocketServer) {
    this.wss = wss;

    // Load the symbol universe. These rows are not broadcast until an exchange
    // quote marks them live, so a fresh session never paints a stale seed.
    const assets = await prisma.asset.findMany({ where: { isActive: true } });
    for (const asset of assets) {
      const price = asset.currentPrice || asset.seedPrice;
      this.assetPrices.set(asset.symbol, {
        price,
        seedPrice: asset.seedPrice,
        volatility: asset.volatilityParam || 0.15,
        high24h: asset.high24h || price,
        low24h: asset.low24h || price,
        change24h: asset.change24h || 0,
        anchor: price,
        live: false,
        changeReady: false,
      });
    }

    this.setupWebSocketServer();

    try {
      console.log('[PriceEngine] Calibrating market feed with live exchange quotes before serving prices...');
      await this.syncLiveMarketData();
    } catch (err: any) {
      console.warn('[PriceEngine] Initial live sync deferred:', err.message);
    }

    this.startSimulation();

    // Crypto and FX are refreshed on this cadence. Equities refresh inside the sync, less often.
    setInterval(() => {
      if (!this.isPaused) {
        this.syncLiveMarketData().catch(() => {});
      }
    }, 5000);

    console.log(`[PriceEngine] Initialized with ${this.assetPrices.size} assets. Live quotes: ${this.liveCount()}.`);
  }

  private liveCount(): number {
    let n = 0;
    this.assetPrices.forEach((val) => {
      if (val.live) n += 1;
    });
    return n;
  }

  private setupWebSocketServer() {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      // Only quotes confirmed by an exchange are sent. Clients that connect
      // mid-calibration receive the next broadcast once those quotes land.
      ws.send(JSON.stringify({ type: 'snapshot', data: this.buildSnapshot() }));

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.action === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          } else if (parsed.action === 'auth' && parsed.token) {
            try {
              const decoded = jwt.verify(parsed.token, ENV.JWT_SECRET) as { id: string };
              (ws as any).userId = decoded.id;
              ws.send(JSON.stringify({ type: 'authenticated', userId: decoded.id }));
            } catch {
              ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or expired session token.' }));
            }
          }
        } catch {
          // ignore malformed ws messages
        }
      });
    });
  }

  public notifyUser(userId: string, data: any) {
    if (!this.wss) return;
    const payload = JSON.stringify(data);
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(payload);
      }
    });
  }

  private startSimulation() {
    if (this.tickInterval) clearInterval(this.tickInterval);

    this.tickInterval = setInterval(() => {
      if (this.isPaused) return;

      const ticks: PriceTick[] = [];
      const now = new Date().toISOString();

      this.assetPrices.forEach((val, symbol) => {
        // Unconfirmed rows stay off the tape. Live rows are pinned to the last
        // exchange quote so the 1s print cannot wander away from the market.
        if (!val.live || !(val.anchor > 0)) return;

        const z = this.generateGaussianNoise();
        const micro = Math.min((val.volatility || 0.15) * 0.00004, 0.00002);
        let newPrice = Math.max(0.0001, val.price * 0.2 + val.anchor * 0.8 + val.anchor * micro * z);
        const precision = symbol.includes('BTC') || symbol.includes('ETH') ? 2 : (symbol.includes('JPY') ? 3 : (val.price < 5 ? 4 : 2));
        newPrice = Number(newPrice.toFixed(precision));

        const high24h = Math.max(val.high24h, newPrice);
        const low24h = Math.min(val.low24h, newPrice);
        val.price = newPrice;
        val.high24h = high24h;
        val.low24h = low24h;

        const spread = symbol.includes('/') ? (val.price > 1000 ? 0.5 : 0.0002) : (val.price > 100 ? 0.05 : 0.01);
        const tick: PriceTick = {
          symbol,
          price: newPrice,
          bid: Number((newPrice - spread / 2).toFixed(precision)),
          ask: Number((newPrice + spread / 2).toFixed(precision)),
          high24h,
          low24h,
          change24h: val.changeReady ? (val.change24h ?? 0) : 0,
          timestamp: now,
        };

        ticks.push(tick);
      });

      // Broadcast ticks to all connected clients
      if (this.wss && ticks.length > 0) {
        const payload = JSON.stringify({ type: 'tick', data: ticks });
        this.wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }

      // Execute limit/stop orders and TP/SL triggers against new price state
      this.evaluateOrdersAndPositions().catch(err => {
        console.error('[PriceEngine] Order evaluation error:', err);
      });
    }, 1000);
  }

  private isEvaluating = false;

  private async evaluateOrdersAndPositions() {
    if (this.isEvaluating) return;
    this.isEvaluating = true;

    try {
      // 1. Evaluate pending limit and stop orders
      const pendingOrders = await prisma.trade.findMany({
        where: { status: 'pending' },
        include: { user: { include: { wallet: true } } },
      });

      for (const order of pendingOrders) {
        const assetData = this.assetPrices.get(order.assetSymbol);
        if (!assetData?.live) continue;
        const currentPrice = assetData.price;
        let shouldFill = false;

        if (order.orderType === 'limit') {
          if (order.direction === 'buy' && order.limitPrice && currentPrice <= order.limitPrice) {
            shouldFill = true;
          } else if (order.direction === 'sell' && order.limitPrice && currentPrice >= order.limitPrice) {
            shouldFill = true;
          }
        } else if (order.orderType === 'stop') {
          if (order.direction === 'buy' && order.limitPrice && currentPrice >= order.limitPrice) {
            shouldFill = true;
          } else if (order.direction === 'sell' && order.limitPrice && currentPrice <= order.limitPrice) {
            shouldFill = true;
          }
        }

        if (shouldFill) {
          const units = Number((order.sizeUsd / currentPrice).toFixed(6));
          const updatedTrade = await prisma.trade.update({
            where: { id: order.id },
            data: {
              status: 'open',
              entryPrice: currentPrice,
              units,
              openedAt: new Date(),
            },
          });
          this.notifyUser(order.userId, {
            type: 'order_filled',
            trade: updatedTrade,
            message: `Pending ${order.direction.toUpperCase()} order on ${order.assetSymbol} was filled at $${currentPrice}`,
          });
          console.log(`[PriceEngine] Order filled: ${order.direction.toUpperCase()} ${order.assetSymbol} at $${currentPrice}`);
        }
      }

      // 2. Evaluate open positions for Stop Loss & Take Profit execution
      const openPositions = await prisma.trade.findMany({
        where: {
          status: 'open',
          OR: [
            { stopLoss: { not: null } },
            { takeProfit: { not: null } },
          ],
        },
        include: { user: { include: { wallet: true } } },
      });

      for (const pos of openPositions) {
        const assetData = this.assetPrices.get(pos.assetSymbol);
        if (!assetData?.live || !pos.entryPrice) continue;
        const currentPrice = assetData.price;
        let triggered = false;
        let triggerReason = '';

        if (pos.direction === 'buy') {
          if (pos.stopLoss && currentPrice <= pos.stopLoss) {
            triggered = true;
            triggerReason = 'Stop Loss';
          } else if (pos.takeProfit && currentPrice >= pos.takeProfit) {
            triggered = true;
            triggerReason = 'Take Profit';
          }
        } else {
          if (pos.stopLoss && currentPrice >= pos.stopLoss) {
            triggered = true;
            triggerReason = 'Stop Loss';
          } else if (pos.takeProfit && currentPrice <= pos.takeProfit) {
            triggered = true;
            triggerReason = 'Take Profit';
          }
        }

        if (triggered && pos.user.wallet) {
          const multiplier = pos.direction === 'buy' ? 1 : -1;
          const priceDiff = (currentPrice - pos.entryPrice) * multiplier;
          const realizedPnl = Number(((priceDiff / pos.entryPrice) * pos.sizeUsd).toFixed(2));
          const cashReturn = pos.sizeUsd + realizedPnl;

          await prisma.$transaction([
            prisma.trade.update({
              where: { id: pos.id },
              data: {
                status: 'closed',
                exitPrice: currentPrice,
                realizedPnl,
                closedAt: new Date(),
                notes: `Auto-closed via ${triggerReason} trigger at $${currentPrice}`,
              },
            }),
            prisma.simulatedWallet.update({
              where: { id: pos.user.wallet.id },
              data: {
                availableBalance: pos.user.wallet.availableBalance + cashReturn,
                reservedTrading: Math.max(0, pos.user.wallet.reservedTrading - pos.sizeUsd),
                totalBalance: pos.user.wallet.totalBalance + realizedPnl,
              },
            }),
            prisma.transaction.create({
              data: {
                walletId: pos.user.wallet.id,
                userId: pos.userId,
                type: 'trade_pnl',
                amount: cashReturn,
                balanceBefore: pos.user.wallet.totalBalance,
                balanceAfter: pos.user.wallet.totalBalance + realizedPnl,
                description: `${triggerReason} executed: Closed ${pos.direction.toUpperCase()} ${pos.assetSymbol} at $${currentPrice} (PnL: $${realizedPnl})`,
                status: 'completed',
                referenceId: pos.id,
              },
            }),
          ]);

          this.notifyUser(pos.userId, {
            type: 'position_closed',
            trade: pos,
            exitPrice: currentPrice,
            realizedPnl,
            reason: triggerReason,
            message: `${triggerReason} executed: Closed ${pos.direction.toUpperCase()} ${pos.assetSymbol} at $${currentPrice} (PnL: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl})`,
          });
          console.log(`[PriceEngine] ${triggerReason} executed for trade ${pos.id} at $${currentPrice} (PnL: $${realizedPnl})`);
        }
      }
    } finally {
      this.isEvaluating = false;
    }
  }

  private generateGaussianNoise(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Admin Controls
  public pause(): boolean {
    this.isPaused = true;
    console.log('[PriceEngine] Feed paused by admin.');
    return true;
  }

  public resume(): boolean {
    this.isPaused = false;
    console.log('[PriceEngine] Feed resumed by admin.');
    return true;
  }

  public isFeedPaused(): boolean {
    return this.isPaused;
  }

  public injectSpike(symbol?: string, magnitudePercent: number = 5.0, direction: 'up' | 'down' | 'random' = 'random') {
    const dir = direction === 'random' ? (Math.random() > 0.5 ? 1 : -1) : direction === 'up' ? 1 : -1;
    const factor = 1 + (dir * Math.abs(magnitudePercent)) / 100;

    const targets = symbol ? [symbol] : Array.from(this.assetPrices.keys());
    for (const sym of targets) {
      const asset = this.assetPrices.get(sym);
      if (asset) {
        asset.price = Number((asset.price * factor).toFixed(sym.includes('BTC') ? 2 : 5));
        asset.anchor = asset.price;
        asset.live = true;
        asset.high24h = Math.max(asset.high24h, asset.price);
        asset.low24h = Math.min(asset.low24h, asset.price);
      }
    }
    console.log(`[PriceEngine] Injected spike of ${magnitudePercent}% (${direction}) into ${targets.join(', ')}`);
  }

  public async resetPrices() {
    const assets = await prisma.asset.findMany();
    for (const a of assets) {
      this.assetPrices.set(a.symbol, {
        price: a.seedPrice,
        seedPrice: a.seedPrice,
        volatility: a.volatilityParam,
        high24h: a.seedPrice * 1.01,
        low24h: a.seedPrice * 0.99,
        change24h: 0,
        anchor: a.seedPrice,
        live: true,
        changeReady: true,
      });
      await prisma.asset.update({
        where: { id: a.id },
        data: { currentPrice: a.seedPrice, change24h: 0.0 },
      });
    }
    console.log('[PriceEngine] All prices reset to seed values.');
  }

  private buildSnapshot(): PriceTick[] {
    const snapshot: PriceTick[] = [];
    const now = new Date().toISOString();

    this.assetPrices.forEach((val, symbol) => {
      if (!val.live || !(val.price > 0)) return;
      const precision = symbol.includes('BTC') || symbol.includes('ETH') ? 2 : (symbol.includes('JPY') ? 3 : (val.price < 5 ? 4 : 2));
      const spread = symbol.includes('/') ? (val.price > 1000 ? 0.5 : 0.0002) : (val.price > 100 ? 0.05 : 0.01);
      const change24h = val.changeReady ? (val.change24h ?? 0) : 0;
      snapshot.push({
        symbol,
        price: val.price,
        bid: Number((val.price - spread / 2).toFixed(precision)),
        ask: Number((val.price + spread / 2).toFixed(precision)),
        high24h: val.high24h,
        low24h: val.low24h,
        change24h,
        timestamp: now,
      });
    });

    return snapshot;
  }

  public broadcastSnapshot() {
    if (!this.wss) return;
    const payload = JSON.stringify({ type: 'snapshot', data: this.buildSnapshot() });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  public syncLiveMarketData(): Promise<{ synced: number; details: Record<string, number> }> {
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this.runLiveSync().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async fetchJson(url: string, timeoutMs = 6000, headers?: Record<string, string>): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private applyLiveQuote(
    symbol: string,
    livePrice: number,
    extras?: { high24h?: number; low24h?: number; change24h?: number; referencePrice?: number },
  ): boolean {
    const asset = this.assetPrices.get(symbol);
    if (!asset || !Number.isFinite(livePrice) || livePrice <= 0) return false;
    asset.price = livePrice;
    asset.anchor = livePrice;
    asset.live = true;
    if (extras?.high24h && extras.high24h > 0) asset.high24h = extras.high24h;
    if (extras?.low24h && extras.low24h > 0) asset.low24h = extras.low24h;
    if (extras?.referencePrice && extras.referencePrice > 0) asset.seedPrice = extras.referencePrice;
    if (extras?.change24h != null && Number.isFinite(extras.change24h)) {
      asset.change24h = extras.change24h;
      asset.changeReady = true;
    }
    return true;
  }

  private persistQuote(symbol: string, data: { currentPrice: number; seedPrice?: number; high24h?: number; low24h?: number; change24h?: number }) {
    prisma.asset.updateMany({ where: { symbol }, data }).catch((err: any) => {
      console.warn(`[PriceEngine] Persist ${symbol} skipped:`, err.message);
    });
  }

  private async runLiveSync(): Promise<{ synced: number; details: Record<string, number> }> {
    const details: Record<string, number> = {};
    const yahooDue = Date.now() - this.lastYahooSync >= 15000;

    const yahooTask = yahooDue ? this.syncYahoo(details) : Promise.resolve(0);
    const [, , yahooUpdated] = await Promise.all([
      this.syncCrypto(details),
      this.syncFx(details),
      yahooTask,
    ]);

    await this.syncSpotMetals(details);

    if (!details['XAU/USD'] && !this.assetPrices.get('XAU/USD')?.live) {
      await this.syncPaxgGold(details);
    }
    if (!details['XAG/USD'] && !this.assetPrices.get('XAG/USD')?.live) {
      await this.syncSilverFutures(details);
    }

    if (yahooUpdated > 0) this.lastYahooSync = Date.now();
    console.log(`[PriceEngine] Synchronized ${Object.keys(details).length} market assets with exchange quotes.`);
    return { synced: Object.keys(details).length, details };
  }

  private async syncCrypto(details: Record<string, number>) {
    const cryptoMapping: Record<string, string> = {
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

    try {
      const symbolsParam = JSON.stringify(Object.keys(cryptoMapping));
      const data = await this.fetchJson(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`,
        5000,
      ) as Array<any>;

      let updated = 0;
      if (Array.isArray(data)) {
        for (const item of data) {
          const targetSym = cryptoMapping[item.symbol];
          if (!targetSym) continue;
          const livePrice = parseFloat(item.lastPrice);
          const high24h = parseFloat(item.highPrice) || livePrice;
          const low24h = parseFloat(item.lowPrice) || livePrice;
          const change24h = parseFloat(item.priceChangePercent) || 0;
          const openPrice = parseFloat(item.openPrice) || livePrice;
          if (!this.applyLiveQuote(targetSym, livePrice, { high24h, low24h, change24h, referencePrice: openPrice })) continue;
          details[targetSym] = livePrice;
          updated += 1;
          this.persistQuote(targetSym, { currentPrice: livePrice, seedPrice: openPrice, high24h, low24h, change24h });
        }
      }
      if (updated > 0) this.broadcastSnapshot();
    } catch (err: any) {
      console.warn('[PriceEngine] Binance live sync notice:', err.message);
    }
  }

  private async syncSpotMetals(details: Record<string, number>) {
    const metals: Record<string, { symbol: string; session: string }> = {
      XAU: { symbol: 'XAU/USD', session: 'GC=F' },
      XAG: { symbol: 'XAG/USD', session: 'SI=F' },
    };
    let updated = 0;
    await Promise.allSettled(
      Object.entries(metals).map(async ([code, meta]) => {
        try {
          const data = await this.fetchJson(`https://api.gold-api.com/price/${code}`, 5000, {
            'User-Agent': 'Mozilla/5.0',
          });
          const livePrice = Number(data?.price);
          const session = await this.fetchJson(
            `https://query1.finance.yahoo.com/v8/finance/chart/${meta.session}?interval=1d&range=1d`,
            4000,
            { 'User-Agent': 'Mozilla/5.0' },
          ).catch(() => null);
          const sessionMeta = session?.chart?.result?.[0]?.meta;
          const prevClose = sessionMeta?.chartPreviousClose || sessionMeta?.previousClose;
          const change24h = prevClose > 0 ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2)) : undefined;
          if (!this.applyLiveQuote(meta.symbol, livePrice, {
            high24h: sessionMeta?.regularMarketDayHigh,
            low24h: sessionMeta?.regularMarketDayLow,
            change24h,
            referencePrice: prevClose,
          })) return;
          details[meta.symbol] = livePrice;
          updated += 1;
          this.persistQuote(meta.symbol, {
            currentPrice: livePrice,
            seedPrice: prevClose > 0 ? prevClose : undefined,
            high24h: sessionMeta?.regularMarketDayHigh,
            low24h: sessionMeta?.regularMarketDayLow,
            change24h,
          });
        } catch (err: any) {
          console.warn(`[PriceEngine] ${meta.symbol} spot sync notice:`, err.message);
        }
      }),
    );
    if (updated > 0) this.broadcastSnapshot();
  }

  private async syncSilverFutures(details: Record<string, number>) {
    try {
      const j: any = await this.fetchJson(
        'https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d',
        5000,
        { 'User-Agent': 'Mozilla/5.0' },
      );
      const meta = j?.chart?.result?.[0]?.meta;
      const livePrice = meta?.regularMarketPrice;
      if (typeof livePrice !== 'number' || !(livePrice > 0)) return;
      const prevClose = meta?.chartPreviousClose || meta?.previousClose || livePrice;
      const change24h = prevClose > 0 ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;
      if (!this.applyLiveQuote('XAG/USD', livePrice, {
        high24h: meta?.regularMarketDayHigh || livePrice,
        low24h: meta?.regularMarketDayLow || livePrice,
        change24h,
        referencePrice: prevClose,
      })) return;
      details['XAG/USD'] = livePrice;
      this.persistQuote('XAG/USD', {
        currentPrice: livePrice,
        seedPrice: prevClose,
        high24h: meta?.regularMarketDayHigh || livePrice,
        low24h: meta?.regularMarketDayLow || livePrice,
        change24h,
      });
      this.broadcastSnapshot();
    } catch (err: any) {
      console.warn('[PriceEngine] Silver fallback sync notice:', err.message);
    }
  }

  private async syncPaxgGold(details: Record<string, number>) {
    try {
      const data = await this.fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', 5000);
      const livePrice = parseFloat(data?.lastPrice);
      const high24h = parseFloat(data?.highPrice) || livePrice;
      const low24h = parseFloat(data?.lowPrice) || livePrice;
      const change24h = parseFloat(data?.priceChangePercent) || 0;
      const openPrice = parseFloat(data?.openPrice) || livePrice;
      if (!this.applyLiveQuote('XAU/USD', livePrice, { high24h, low24h, change24h, referencePrice: openPrice })) return;
      details['XAU/USD'] = livePrice;
      this.persistQuote('XAU/USD', { currentPrice: livePrice, seedPrice: openPrice, high24h, low24h, change24h });
      this.broadcastSnapshot();
    } catch (err: any) {
      console.warn('[PriceEngine] Gold fallback sync notice:', err.message);
    }
  }

  private async syncFx(details: Record<string, number>) {
    try {
      const fxData = await this.fetchJson('https://open.er-api.com/v6/latest/USD', 5000) as any;
      const rates = fxData?.rates;
      if (!rates?.EUR || !rates?.GBP || !rates?.JPY) return;

      const fxQuotes: Record<string, number> = {
        'EUR/USD': Number((1 / rates.EUR).toFixed(5)),
        'GBP/USD': Number((1 / rates.GBP).toFixed(5)),
        'USD/JPY': Number(rates.JPY.toFixed(3)),
        'AUD/USD': Number((1 / rates.AUD).toFixed(5)),
        'USD/CAD': Number(rates.CAD.toFixed(5)),
        'USD/CHF': Number(rates.CHF.toFixed(5)),
        'GBP/JPY': Number(((1 / rates.GBP) * rates.JPY).toFixed(3)),
        'EUR/GBP': Number((rates.GBP / rates.EUR).toFixed(5)),
      };

      let updated = 0;
      for (const [sym, quote] of Object.entries(fxQuotes)) {
        if (!this.applyLiveQuote(sym, quote)) continue;
        details[sym] = quote;
        updated += 1;
        this.persistQuote(sym, { currentPrice: quote });
      }
      if (updated > 0) this.broadcastSnapshot();
    } catch (err: any) {
      console.warn('[PriceEngine] Forex live sync notice:', err.message);
    }
  }

  private async syncYahoo(details: Record<string, number>): Promise<number> {
    const yahooMapping: Record<string, string> = {
      'AAPL': 'AAPL', 'NVDA': 'NVDA', 'MSFT': 'MSFT', 'AMZN': 'AMZN', 'GOOGL': 'GOOGL',
      'META': 'META', 'TSLA': 'TSLA', 'NFLX': 'NFLX', 'AMD': 'AMD', 'BABA': 'BABA',
      'COIN': 'COIN', 'PLTR': 'PLTR',
      'CL=F': 'WTI/USD', 'BZ=F': 'BRENT/USD', 'NG=F': 'NG/USD',
      'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'JPY=X': 'USD/JPY',
      'AUDUSD=X': 'AUD/USD', 'CHF=X': 'USD/CHF', 'CAD=X': 'USD/CAD',
      'GBPJPY=X': 'GBP/JPY', 'EURGBP=X': 'EUR/GBP',
      '^GSPC': 'SPX500', '^IXIC': 'NAS100', '^DJI': 'US30', '^GDAXI': 'GER40',
    };

    let updated = 0;
    await Promise.allSettled(
      Object.entries(yahooMapping).map(async ([rawSym, target]) => {
        try {
          const j: any = await this.fetchJson(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(rawSym)}?interval=1d&range=1d`,
            5000,
            { 'User-Agent': 'Mozilla/5.0' },
          );
          const meta = j?.chart?.result?.[0]?.meta;
          const livePrice = meta?.regularMarketPrice;
          if (typeof livePrice !== 'number' || !(livePrice > 0)) return;
          const high24h = meta?.regularMarketDayHigh || livePrice;
          const low24h = meta?.regularMarketDayLow || livePrice;
          const prevClose = meta?.chartPreviousClose || meta?.previousClose || livePrice;
          const change24h = prevClose > 0 ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;
          if (!this.applyLiveQuote(target, livePrice, { high24h, low24h, change24h, referencePrice: prevClose })) return;
          details[target] = livePrice;
          updated += 1;
          this.persistQuote(target, { currentPrice: livePrice, seedPrice: prevClose, high24h, low24h, change24h });
        } catch {
          // One symbol failing must not blank the rest of the book.
        }
      }),
    );

    if (updated > 0) this.broadcastSnapshot();
    return updated;
  }

  public getCurrentPrice(symbol: string): number | null {
    const asset = this.assetPrices.get(symbol);
    if (!asset?.live || !(asset.price > 0)) return null;
    return asset.price;
  }

  public isQuoteLive(symbol: string): boolean {
    return this.assetPrices.get(symbol)?.live === true;
  }

  public getQuote(symbol: string): { price: number; live: boolean; change24h: number; high24h: number; low24h: number } | null {
    const asset = this.assetPrices.get(symbol);
    if (!asset) return null;
    return {
      price: asset.price,
      live: asset.live,
      change24h: asset.changeReady ? (asset.change24h ?? 0) : 0,
      high24h: asset.high24h,
      low24h: asset.low24h,
    };
  }
}

export default PriceEngineService;

