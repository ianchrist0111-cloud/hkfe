import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import PriceEngineService from '../services/priceEngineService';

const router = Router();

// GET /market/assets
router.get('/assets', async (_req: Request, res: Response) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    });

    const engine = PriceEngineService.getInstance();
    const result = assets.map((a) => {
      const quote = engine.getQuote(a.symbol);
      const quoteLive = quote?.live === true;
      const livePrice = quoteLive && quote ? quote.price : a.currentPrice;
      const change24h = quoteLive && quote
        ? Number(quote.change24h.toFixed(2))
        : Number((((livePrice - a.seedPrice) / (a.seedPrice || 1)) * 100).toFixed(2));
      return {
        ...a,
        currentPrice: livePrice,
        change24h,
        high24h: quoteLive && quote ? quote.high24h : a.high24h,
        low24h: quoteLive && quote ? quote.low24h : a.low24h,
        quoteLive,
      };
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ASSETS_ERROR', message: err.message } });
  }
});

// GET /market/assets/:symbol
router.get('/assets/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const asset = await prisma.asset.findUnique({ where: { symbol } });

    if (!asset) {
      return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: `Asset ${symbol} not found.` } });
    }

    const quote = PriceEngineService.getInstance().getQuote(asset.symbol);
    const quoteLive = quote?.live === true;
    const livePrice = quoteLive && quote ? quote.price : asset.currentPrice;
    const change24h = quoteLive && quote
      ? Number(quote.change24h.toFixed(2))
      : Number((((livePrice - asset.seedPrice) / (asset.seedPrice || 1)) * 100).toFixed(2));

    res.json({
      success: true,
      data: {
        ...asset,
        currentPrice: livePrice,
        change24h,
        high24h: quoteLive && quote ? quote.high24h : asset.high24h,
        low24h: quoteLive && quote ? quote.low24h : asset.low24h,
        quoteLive,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ASSET_ERROR', message: err.message } });
  }
});

// Symbol mappings for live historical candles
const BINANCE_CANDLE_MAP: Record<string, string> = {
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
  'SOL/USD': 'SOLUSDT',
  'BNB/USD': 'BNBUSDT',
  'XRP/USD': 'XRPUSDT',
  'DOGE/USD': 'DOGEUSDT',
  'ADA/USD': 'ADAUSDT',
  'AVAX/USD': 'AVAXUSDT',
  'DOT/USD': 'DOTUSDT',
  'LINK/USD': 'LINKUSDT',
  'NEAR/USD': 'NEARUSDT',
  'SUI/USD': 'SUIUSDT',
  'XAU/USD': 'PAXGUSDT',
};

const YAHOO_CANDLE_MAP: Record<string, string> = {
  'AAPL': 'AAPL', 'NVDA': 'NVDA', 'MSFT': 'MSFT', 'AMZN': 'AMZN',
  'GOOGL': 'GOOGL', 'META': 'META', 'TSLA': 'TSLA', 'NFLX': 'NFLX',
  'AMD': 'AMD', 'BABA': 'BABA', 'COIN': 'COIN', 'PLTR': 'PLTR',
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'JPY=X',
  'AUD/USD': 'AUDUSD=X', 'USD/CHF': 'CHF=X', 'USD/CAD': 'CAD=X',
  'GBP/JPY': 'GBPJPY=X', 'EUR/GBP': 'EURGBP=X',
  'WTI/USD': 'CL=F', 'BRENT/USD': 'BZ=F', 'NG/USD': 'NG=F', 'XAG/USD': 'SI=F',
  'SPX500': '^GSPC', 'NAS100': '^IXIC', 'US30': '^DJI', 'GER40': '^GDAXI',
};

// GET /market/assets/:symbol/candles
router.get('/assets/:symbol/candles', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const limit = Math.min(150, Math.max(20, parseInt(req.query.limit as string || '80', 10)));
    const rawTf = (req.query.timeframe as string || '1m').toLowerCase();
    const timeframe = rawTf === '1h' ? '1H' : rawTf === '4h' ? '4H' : rawTf === '1d' ? '1D' : rawTf;

    const asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } });
    }

    const engine = PriceEngineService.getInstance();
    const quoteLive = engine.isQuoteLive(symbol);
    const enginePrice = engine.getCurrentPrice(symbol);
    const currentPrice = (quoteLive && enginePrice) ? enginePrice : asset.currentPrice;
    const precision = symbol.includes('BTC') ? 2 : currentPrice < 5 ? 4 : 2;

    let candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];

    // 1. Try Binance for Crypto and Gold (PAXG)
    const binanceSym = BINANCE_CANDLE_MAP[symbol];
    if (binanceSym) {
      try {
        const binanceInterval = timeframe === '1D' ? '1d' : timeframe === '4H' ? '4h' : timeframe === '1H' ? '1h' : timeframe === '15m' ? '15m' : timeframe === '5m' ? '5m' : '1m';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const bRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${binanceInterval}&limit=${limit}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (bRes.ok) {
          const raw = await bRes.json();
          if (Array.isArray(raw) && raw.length > 0) {
            candles = raw.map((item: any) => ({
              time: Math.floor(Number(item[0]) / 1000),
              open: Number(parseFloat(item[1]).toFixed(precision)),
              high: Number(parseFloat(item[2]).toFixed(precision)),
              low: Number(parseFloat(item[3]).toFixed(precision)),
              close: Number(parseFloat(item[4]).toFixed(precision)),
              volume: Math.round(parseFloat(item[5])),
            }));
          }
        }
      } catch (err) {
        // Fallback to next strategy
      }
    }

    // 2. Try Yahoo Finance for Equities, FX, Commodities, Indices
    const yahooSym = YAHOO_CANDLE_MAP[symbol];
    if (!candles.length && yahooSym) {
      try {
        const yahooInterval = timeframe === '1D' ? '1d' : (timeframe === '4H' || timeframe === '1H') ? '60m' : timeframe === '15m' ? '15m' : timeframe === '5m' ? '5m' : '1m';
        const yahooRange = timeframe === '1D' ? '1y' : (timeframe === '4H' || timeframe === '1H') ? '1mo' : '5d';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const yRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${yahooInterval}&range=${yahooRange}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (yRes.ok) {
          const yData: any = await yRes.json();
          const chartResult = yData?.chart?.result?.[0];
          const timestamps = chartResult?.timestamp;
          const quote = chartResult?.indicators?.quote?.[0];
          if (Array.isArray(timestamps) && quote && quote.open) {
            const temp: typeof candles = [];
            for (let i = Math.max(0, timestamps.length - limit); i < timestamps.length; i++) {
              const o = quote.open[i];
              const h = quote.high[i];
              const l = quote.low[i];
              const c = quote.close[i];
              const v = quote.volume?.[i] ?? 1000;
              if (o != null && c != null) {
                temp.push({
                  time: timestamps[i],
                  open: Number(Number(o).toFixed(precision)),
                  high: Number(Number(h ?? Math.max(o, c)).toFixed(precision)),
                  low: Number(Number(l ?? Math.min(o, c)).toFixed(precision)),
                  close: Number(Number(c).toFixed(precision)),
                  volume: Math.round(v),
                });
              }
            }
            if (temp.length > 5) {
              candles = temp;
            }
          }
        }
      } catch (err) {
        // Fallback to backward generator
      }
    }

    // Last resort only after a confirmed live quote exists, so the chart is never
    // drawn from a stored seed price.
    if (!candles.length && quoteLive && enginePrice) {
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = timeframe === '1D' ? 86400 : timeframe === '4H' ? 14400 : timeframe === '1H' ? 3600 : timeframe === '15m' ? 900 : timeframe === '5m' ? 300 : 60;
      let walkPrice = enginePrice;
      const vol = asset.volatilityParam || 0.001;

      for (let i = 0; i < limit; i++) {
        const time = now - i * intervalSec;
        const drift = (Math.random() - 0.5) * (vol * walkPrice * 0.02);
        const open = Math.max(0.0001, walkPrice - drift);
        const close = walkPrice;
        const high = Math.max(open, close) + Math.random() * Math.abs(drift) * 0.3;
        const low = Math.min(open, close) - Math.random() * Math.abs(drift) * 0.3;
        const volume = Math.floor(Math.random() * 5000 + 1000);

        candles.unshift({
          time,
          open: Number(open.toFixed(precision)),
          high: Number(high.toFixed(precision)),
          low: Number(low.toFixed(precision)),
          close: Number(close.toFixed(precision)),
          volume,
        });

        walkPrice = open;
      }
    }

    // Pin the active candle only to a confirmed exchange quote. A stored seed
    // must not overwrite a real exchange close.
    if (quoteLive && enginePrice && candles.length > 0) {
      const last = candles[candles.length - 1];
      last.close = Number(enginePrice.toFixed(precision));
      last.high = Number(Math.max(last.high, enginePrice).toFixed(precision));
      last.low = Number(Math.min(last.low, enginePrice).toFixed(precision));
    }

    res.json({ success: true, data: candles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CANDLES_ERROR', message: err.message } });
  }
});

// GET /market/assets/:symbol/orderbook
router.get('/assets/:symbol/orderbook', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const asset = await prisma.asset.findUnique({ where: { symbol } });
    const currentPrice = (asset ? PriceEngineService.getInstance().getCurrentPrice(symbol) || asset.currentPrice : 100);

    const step = symbol.includes('BTC') ? 10 : (currentPrice > 100 ? 0.25 : 0.0005);
    const bids = [];
    const asks = [];

    for (let i = 1; i <= 10; i++) {
      bids.push({
        price: Number((currentPrice - i * step).toFixed(symbol.includes('BTC') ? 2 : 4)),
        size: Number((Math.random() * 5 + 0.5).toFixed(2)),
        total: Number((currentPrice * (Math.random() * 5 + 0.5)).toFixed(0)),
      });
      asks.push({
        price: Number((currentPrice + i * step).toFixed(symbol.includes('BTC') ? 2 : 4)),
        size: Number((Math.random() * 5 + 0.5).toFixed(2)),
        total: Number((currentPrice * (Math.random() * 5 + 0.5)).toFixed(0)),
      });
    }

    res.json({ success: true, data: { symbol, currentPrice, bids, asks } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ORDERBOOK_ERROR', message: err.message } });
  }
});

export default router;
