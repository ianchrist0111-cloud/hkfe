import { useState, useRef, useEffect } from 'react';
import { priceEngine, Candle } from '../../lib/priceEngine';
import { usePriceStore, useUIStore } from '../../store';
import { api } from '../../lib/api';
import styles from './TechnicalChart.module.css';

interface TechnicalChartProps {
  symbol: string;
  timeframe?: string;
}

// Indicator Calculation Helpers
function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const slice = data.slice(0, period);
      prevEma = slice.reduce((a, b) => a + b, 0) / period;
      result.push(prevEma);
    } else {
      prevEma = data[i] * k + prevEma! * (1 - k);
      result.push(prevEma);
    }
  }
  return result;
}

function calculateBollingerBands(data: number[], period = 20, stdDev = 2) {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
      const sd = Math.sqrt(variance);

      middle.push(mean);
      upper.push(mean + sd * stdDev);
      lower.push(mean - sd * stdDev);
    }
  }
  return { upper, middle, lower };
}

function calculateRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;
  rsi.push(...Array(period).fill(null));

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + rs)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

function calculateMACD(closes: number[]) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(ema12[i]! - ema26[i]!);
    } else {
      macdLine.push(null);
    }
  }

  // Signal line (9-period EMA of MACD)
  const validMacd = macdLine.filter((v): v is number => v !== null);
  const validSignal = calculateEMA(validMacd, 9);
  const signalLine: (number | null)[] = [];
  let sigIdx = 0;

  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      signalLine.push(validSignal[sigIdx] ?? null);
      sigIdx++;
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      histogram.push(macdLine[i]! - signalLine[i]!);
    } else {
      histogram.push(null);
    }
  }

  return { macdLine, signalLine, histogram };
}

export default function TechnicalChart({ symbol, timeframe = '1m' }: TechnicalChartProps) {
  const mainSvgRef = useRef<SVGSVGElement>(null);
  const subSvgRef = useRef<SVGSVGElement>(null);
  const ticks = usePriceStore(s => s.ticks);
  const theme = useUIStore(s => s.theme);
  const colorblindMode = useUIStore(s => s.colorblindMode);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [candleState, setCandleState] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [, setLoading] = useState(false);

  // Indicators toggle state
  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [subIndicator, setSubIndicator] = useState<'rsi' | 'macd' | 'none'>('rsi');

  // Dynamic palette mapping
  const isLight = theme === 'light';
  const chartPalette = {
    grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.05)',
    bullish: colorblindMode ? '#38bdf8' : (isLight ? '#059669' : '#00e599'),
    bearish: colorblindMode ? '#f97316' : (isLight ? '#dc2626' : '#ff3b5c'),
    bbStroke: isLight ? '#7c3aed' : '#a855f7',
    bbFill: isLight ? 'rgba(124, 58, 237, 0.07)' : 'rgba(168, 85, 247, 0.07)',
    sma: isLight ? '#d97706' : '#f59e0b',
    ema: isLight ? '#0284c7' : '#38bdf8',
    rsi: isLight ? '#7c3aed' : '#c084fc',
    zeroLine: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)',
    macd: isLight ? '#0284c7' : '#06b6d4',
    signal: isLight ? '#ea580c' : '#f97316',
  };

  // Latest readout values
  const [readouts, setReadouts] = useState({
    sma20: null as number | null,
    ema50: null as number | null,
    bbUpper: null as number | null,
    bbLower: null as number | null,
    rsi: null as number | null,
    macd: null as number | null,
  });

  // Fetch exchange candles whenever symbol or timeframe changes.
  // Never fall back to a synthetic series — that series was built from seed prices.
  useEffect(() => {
    let active = true;
    async function loadCandles(attempt = 0) {
      setCandleState('loading');
      setLoading(true);
      try {
        const res = await api.getCandles(symbol, timeframe, 80);
        if (!active) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const list: Candle[] = res.data.map((c: Candle) => ({ ...c }));
          const liveP = usePriceStore.getState().ticks[symbol]?.price;
          if (liveP && list.length > 0) {
            const last = list[list.length - 1];
            last.close = liveP;
            last.high = Math.max(last.high, liveP);
            last.low = Math.min(last.low, liveP);
          }
          setCandles(list);
          priceEngine.setCandles(symbol, list);
          setCandleState('ready');
          return;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (active) return loadCandles(attempt + 1);
          return;
        }
        setCandles([]);
        setCandleState('empty');
      } catch {
        if (!active) return;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (active) return loadCandles(attempt + 1);
          return;
        }
        setCandles([]);
        setCandleState('empty');
      } finally {
        if (active) setLoading(false);
      }
    }
    setCandles([]);
    loadCandles();
    return () => {
      active = false;
    };
  }, [symbol, timeframe]);

  // Synchronize incoming live tick to active candle with 0 gap
  useEffect(() => {
    const liveP = ticks[symbol]?.price;
    if (!liveP) return;
    setCandles(prev => {
      if (!prev || prev.length === 0) return prev;
      const next = [...prev];
      const last = { ...next[next.length - 1] };
      last.close = liveP;
      last.high = Math.max(last.high, liveP);
      last.low = Math.min(last.low, liveP);
      last.volume = (last.volume || 1) + 1;
      next[next.length - 1] = last;
      return next;
    });
  }, [ticks[symbol]?.price]);

  useEffect(() => {
    drawMainChart();
    drawSubChart();
  }, [candles, symbol, showSMA, showEMA, showBB, subIndicator, theme, colorblindMode]);

  function drawMainChart() {
    if (!mainSvgRef.current) return;
    const svg = mainSvgRef.current;
    const activeCandles = (candles.length > 0 ? candles : priceEngine.getCandles(symbol)).slice(-65);
    if (!activeCandles.length) {
      svg.innerHTML = '';
      return;
    }
    const w = svg.clientWidth || 700;
    const h = svg.clientHeight || 300;
    const closes = activeCandles.map((c: any) => c.close);

    // Calculate indicators
    const sma20 = calculateSMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const bb = calculateBollingerBands(closes, 20, 2);

    // Dynamic price scale min/max
    const allPrices = activeCandles.flatMap((c: any) => [c.high, c.low]);
    if (showBB) {
      bb.upper.forEach(v => v !== null && allPrices.push(v));
      bb.lower.forEach(v => v !== null && allPrices.push(v));
    }
    const min = Math.min(...allPrices) * 0.9992;
    const max = Math.max(...allPrices) * 1.0008;
    const range = max - min;
    const cw = w / activeCandles.length;
    const scaleY = (v: number) => h - ((v - min) / range) * h;

    svg.innerHTML = '';

    // Subtle horizontal grid lines
    for (let i = 0; i < 5; i++) {
      const y = (h / 5) * i;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0'); line.setAttribute('x2', String(w));
      line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
      line.setAttribute('stroke', chartPalette.grid); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }

    // 1. Bollinger Bands Shaded Area & Lines
    if (showBB) {
      let upperPath = '';
      let lowerPath = '';
      let fillPolygon = '';

      const validUpperPoints: { x: number; y: number }[] = [];
      const validLowerPoints: { x: number; y: number }[] = [];

      activeCandles.forEach((_, i) => {
        const x = i * cw + cw / 2;
        if (bb.upper[i] !== null && bb.lower[i] !== null) {
          const yUp = scaleY(bb.upper[i]!);
          const yLow = scaleY(bb.lower[i]!);
          validUpperPoints.push({ x, y: yUp });
          validLowerPoints.push({ x, y: yLow });

          upperPath += upperPath === '' ? `M ${x} ${yUp}` : ` L ${x} ${yUp}`;
          lowerPath += lowerPath === '' ? `M ${x} ${yLow}` : ` L ${x} ${yLow}`;
        }
      });

      if (validUpperPoints.length > 1) {
        // Build translucent filled channel
        fillPolygon = upperPath;
        for (let i = validLowerPoints.length - 1; i >= 0; i--) {
          fillPolygon += ` L ${validLowerPoints[i].x} ${validLowerPoints[i].y}`;
        }
        fillPolygon += ' Z';

        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        poly.setAttribute('d', fillPolygon);
        poly.setAttribute('fill', chartPalette.bbFill);
        svg.appendChild(poly);

        // Upper line
        const uLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        uLine.setAttribute('d', upperPath);
        uLine.setAttribute('stroke', chartPalette.bbStroke);
        uLine.setAttribute('stroke-width', '1.2');
        uLine.setAttribute('fill', 'none');
        svg.appendChild(uLine);

        // Lower line
        const lLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        lLine.setAttribute('d', lowerPath);
        lLine.setAttribute('stroke', chartPalette.bbStroke);
        lLine.setAttribute('stroke-width', '1.2');
        lLine.setAttribute('fill', 'none');
        svg.appendChild(lLine);
      }
    }

    // 2. Candlesticks
    activeCandles.forEach((c: any, i: number) => {
      const x = i * cw + cw / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? chartPalette.bullish : chartPalette.bearish;

      // Wick
      const wick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      wick.setAttribute('x1', String(x)); wick.setAttribute('x2', String(x));
      wick.setAttribute('y1', String(scaleY(c.high))); wick.setAttribute('y2', String(scaleY(c.low)));
      wick.setAttribute('stroke', color); wick.setAttribute('stroke-width', '1');
      svg.appendChild(wick);

      // Body
      const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const bodyTop = Math.min(scaleY(c.open), scaleY(c.close));
      const bodyH = Math.max(Math.abs(scaleY(c.open) - scaleY(c.close)), 1.5);
      body.setAttribute('x', String(x - cw * 0.35));
      body.setAttribute('y', String(bodyTop));
      body.setAttribute('width', String(cw * 0.7));
      body.setAttribute('height', String(bodyH));
      body.setAttribute('fill', color);
      body.setAttribute('rx', '1');
      svg.appendChild(body);
    });

    // 3. SMA 20 Line
    if (showSMA) {
      let d = '';
      activeCandles.forEach((_, i) => {
        const val = sma20[i];
        if (val !== null) {
          const x = i * cw + cw / 2;
          const y = scaleY(val);
          d += d === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
        }
      });
      if (d) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', chartPalette.sma);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }
    }

    // 4. EMA 50 Line
    if (showEMA) {
      let d = '';
      activeCandles.forEach((_, i) => {
        const val = ema50[i];
        if (val !== null) {
          const x = i * cw + cw / 2;
          const y = scaleY(val);
          d += d === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
        }
      });
      if (d) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', chartPalette.ema);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }
    }

    // 5. Live Price Horizontal Line & Marker (Confirms 0 Gap Alignment)
    if (activeCandles.length > 0) {
      const lastCandle = activeCandles[activeCandles.length - 1];
      const curPrice = lastCandle.close;
      const curY = scaleY(curPrice);
      const isUp = curPrice >= lastCandle.open;
      const lineColor = isUp ? chartPalette.bullish : chartPalette.bearish;

      // Dashed horizontal price line
      const priceLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      priceLine.setAttribute('x1', '0');
      priceLine.setAttribute('x2', String(w));
      priceLine.setAttribute('y1', String(curY));
      priceLine.setAttribute('y2', String(curY));
      priceLine.setAttribute('stroke', lineColor);
      priceLine.setAttribute('stroke-width', '1.2');
      priceLine.setAttribute('stroke-dasharray', '4,3');
      priceLine.setAttribute('opacity', '0.85');
      svg.appendChild(priceLine);

      // Price Tag Pill on Right Axis
      const pillW = 64;
      const pillH = 18;
      const pillX = w - pillW - 4;
      const pillY = Math.max(2, Math.min(h - pillH - 2, curY - pillH / 2));

      const tagBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tagBg.setAttribute('x', String(pillX));
      tagBg.setAttribute('y', String(pillY));
      tagBg.setAttribute('width', String(pillW));
      tagBg.setAttribute('height', String(pillH));
      tagBg.setAttribute('rx', '3');
      tagBg.setAttribute('fill', lineColor);
      svg.appendChild(tagBg);

      const tagText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tagText.setAttribute('x', String(pillX + pillW / 2));
      tagText.setAttribute('y', String(pillY + 12));
      tagText.setAttribute('fill', '#ffffff');
      tagText.setAttribute('font-size', '10');
      tagText.setAttribute('font-family', 'var(--font-mono, monospace)');
      tagText.setAttribute('font-weight', 'bold');
      tagText.setAttribute('text-anchor', 'middle');
      tagText.textContent = curPrice.toFixed(symbol.includes('BTC') ? 1 : curPrice < 5 ? 4 : 2);
      svg.appendChild(tagText);
    }

    // Update readouts for latest candle
    const lastIdx = activeCandles.length - 1;
    setReadouts(prev => ({
      ...prev,
      sma20: sma20[lastIdx] ? Number(sma20[lastIdx]!.toFixed(symbol.includes('BTC') ? 1 : 4)) : null,
      ema50: ema50[lastIdx] ? Number(ema50[lastIdx]!.toFixed(symbol.includes('BTC') ? 1 : 4)) : null,
      bbUpper: bb.upper[lastIdx] ? Number(bb.upper[lastIdx]!.toFixed(symbol.includes('BTC') ? 1 : 4)) : null,
      bbLower: bb.lower[lastIdx] ? Number(bb.lower[lastIdx]!.toFixed(symbol.includes('BTC') ? 1 : 4)) : null,
    }));
  }

  function drawSubChart() {
    if (!subSvgRef.current || subIndicator === 'none') return;
    const svg = subSvgRef.current;
    const activeCandles = (candles.length > 0 ? candles : priceEngine.getCandles(symbol)).slice(-65);
    if (!activeCandles.length) {
      svg.innerHTML = '';
      return;
    }
    const w = svg.clientWidth || 700;
    const h = svg.clientHeight || 100;
    const closes = activeCandles.map((c: any) => c.close);
    const cw = w / activeCandles.length;

    svg.innerHTML = '';

    if (subIndicator === 'rsi') {
      const rsi = calculateRSI(closes, 14);
      const scaleRSI = (val: number) => h - (val / 100) * h;

      // 70 overbought dotted line
      const line70 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line70.setAttribute('x1', '0'); line70.setAttribute('x2', String(w));
      line70.setAttribute('y1', String(scaleRSI(70))); line70.setAttribute('y2', String(scaleRSI(70)));
      line70.setAttribute('stroke', chartPalette.bearish); line70.setAttribute('stroke-dasharray', '3,3');
      line70.setAttribute('stroke-width', '1'); line70.setAttribute('opacity', '0.7');
      svg.appendChild(line70);

      // 30 oversold dotted line
      const line30 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line30.setAttribute('x1', '0'); line30.setAttribute('x2', String(w));
      line30.setAttribute('y1', String(scaleRSI(30))); line30.setAttribute('y2', String(scaleRSI(30)));
      line30.setAttribute('stroke', chartPalette.bullish); line30.setAttribute('stroke-dasharray', '3,3');
      line30.setAttribute('stroke-width', '1'); line30.setAttribute('opacity', '0.7');
      svg.appendChild(line30);

      // RSI Curve
      let d = '';
      rsi.forEach((val, i) => {
        if (val !== null) {
          const x = i * cw + cw / 2;
          const y = scaleRSI(val);
          d += d === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
        }
      });

      if (d) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', chartPalette.rsi);
        path.setAttribute('stroke-width', '1.8');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }

      const lastRsi = rsi[rsi.length - 1];
      setReadouts(prev => ({
        ...prev,
        rsi: lastRsi !== null ? Number(lastRsi.toFixed(1)) : null,
      }));
    } else if (subIndicator === 'macd') {
      const { macdLine, signalLine, histogram } = calculateMACD(closes);
      const allVals = [...macdLine, ...signalLine, ...histogram].filter((v): v is number => v !== null);
      const maxAbs = Math.max(0.0001, ...allVals.map(Math.abs)) * 1.15;
      const zeroY = h / 2;
      const scaleMACD = (v: number) => zeroY - (v / maxAbs) * (h / 2 - 8);

      // Zero baseline
      const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      zeroLine.setAttribute('x1', '0'); zeroLine.setAttribute('x2', String(w));
      zeroLine.setAttribute('y1', String(zeroY)); zeroLine.setAttribute('y2', String(zeroY));
      zeroLine.setAttribute('stroke', chartPalette.zeroLine); zeroLine.setAttribute('stroke-width', '1');
      svg.appendChild(zeroLine);

      // Histogram bars
      histogram.forEach((v, i) => {
        if (v !== null) {
          const x = i * cw + cw / 2;
          const y = scaleMACD(v);
          const barH = Math.max(1, Math.abs(y - zeroY));
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(x - cw * 0.3));
          rect.setAttribute('y', String(v >= 0 ? y : zeroY));
          rect.setAttribute('width', String(cw * 0.6));
          rect.setAttribute('height', String(barH));
          rect.setAttribute('fill', v >= 0 ? chartPalette.bullish : chartPalette.bearish);
          rect.setAttribute('opacity', '0.75');
          svg.appendChild(rect);
        }
      });

      // MACD Line
      let dMacd = '';
      macdLine.forEach((v, i) => {
        if (v !== null) {
          const x = i * cw + cw / 2;
          const y = scaleMACD(v);
          dMacd += dMacd === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
        }
      });
      if (dMacd) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', dMacd);
        path.setAttribute('stroke', chartPalette.macd);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }

      // Signal Line
      let dSig = '';
      signalLine.forEach((v, i) => {
        if (v !== null) {
          const x = i * cw + cw / 2;
          const y = scaleMACD(v);
          dSig += dSig === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
        }
      });
      if (dSig) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', dSig);
        path.setAttribute('stroke', chartPalette.signal);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }

      const lastMacd = macdLine[macdLine.length - 1];
      setReadouts(prev => ({
        ...prev,
        macd: lastMacd !== null ? Number(lastMacd.toFixed(4)) : null,
      }));
    }
  }

  return (
    <div className={styles.container}>
      {/* Indicator Controls & Readout Bar */}
      <div className={styles.indicatorToolbar}>
        <div className={styles.indicatorPills}>
          <button
            className={`${styles.indicatorPill} ${showSMA ? styles.pillActive : ''}`}
            onClick={() => setShowSMA(!showSMA)}
          >
            <span className={styles.pillDot} style={{ background: chartPalette.sma }} />
            SMA 20
          </button>

          <button
            className={`${styles.indicatorPill} ${showEMA ? styles.pillActive : ''}`}
            onClick={() => setShowEMA(!showEMA)}
          >
            <span className={styles.pillDot} style={{ background: chartPalette.ema }} />
            EMA 50
          </button>

          <button
            className={`${styles.indicatorPill} ${showBB ? styles.pillActive : ''}`}
            onClick={() => setShowBB(!showBB)}
          >
            <span className={styles.pillDot} style={{ background: chartPalette.bbStroke }} />
            Bollinger Bands (20,2)
          </button>

          <button
            className={`${styles.indicatorPill} ${subIndicator === 'rsi' ? styles.pillActive : ''}`}
            onClick={() => setSubIndicator(subIndicator === 'rsi' ? 'none' : 'rsi')}
          >
            <span className={styles.pillDot} style={{ background: chartPalette.rsi }} />
            RSI (14)
          </button>

          <button
            className={`${styles.indicatorPill} ${subIndicator === 'macd' ? styles.pillActive : ''}`}
            onClick={() => setSubIndicator(subIndicator === 'macd' ? 'none' : 'macd')}
          >
            <span className={styles.pillDot} style={{ background: chartPalette.macd }} />
            MACD (12,26,9)
          </button>
        </div>

        {/* Live Indicator Readout Values */}
        <div className={styles.readoutBar}>
          {showSMA && readouts.sma20 && (
            <div className={styles.readoutItem}>
              <span className={styles.readoutLabel} style={{ color: chartPalette.sma }}>SMA:</span>
              <span className={styles.readoutVal}>{readouts.sma20}</span>
            </div>
          )}
          {showEMA && readouts.ema50 && (
            <div className={styles.readoutItem}>
              <span className={styles.readoutLabel} style={{ color: chartPalette.ema }}>EMA:</span>
              <span className={styles.readoutVal}>{readouts.ema50}</span>
            </div>
          )}
          {showBB && readouts.bbUpper && readouts.bbLower && (
            <div className={styles.readoutItem}>
              <span className={styles.readoutLabel} style={{ color: chartPalette.bbStroke }}>BB:</span>
              <span className={styles.readoutVal}>[{readouts.bbLower} - {readouts.bbUpper}]</span>
            </div>
          )}
          {subIndicator === 'rsi' && readouts.rsi !== null && (
            <div className={styles.readoutItem}>
              <span className={styles.readoutLabel} style={{ color: chartPalette.rsi }}>RSI:</span>
              <span className={styles.readoutVal} style={{
                color: readouts.rsi > 70 ? chartPalette.bearish : readouts.rsi < 30 ? chartPalette.bullish : chartPalette.rsi
              }}>
                {readouts.rsi} {readouts.rsi > 70 ? '(Overbought)' : readouts.rsi < 30 ? '(Oversold)' : '(Neutral)'}
              </span>
            </div>
          )}
          {subIndicator === 'macd' && readouts.macd !== null && (
            <div className={styles.readoutItem}>
              <span className={styles.readoutLabel} style={{ color: chartPalette.macd }}>MACD:</span>
              <span className={styles.readoutVal}>{readouts.macd}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Candlestick Chart Area */}
      <div className={styles.mainChartArea}>
        <svg ref={mainSvgRef} className={styles.svgChart} />
        {candleState !== 'ready' && (
          <div className={styles.chartStatus}>
            {candleState === 'loading' ? 'Loading live market prices…' : 'Live candles are not available yet'}
          </div>
        )}
      </div>

      {/* Sub Indicator Pane (RSI / MACD) */}
      {subIndicator !== 'none' && (
        <div className={styles.subPane}>
          <div className={styles.subPaneHeader}>
            <span>{subIndicator === 'rsi' ? 'RSI (14, Close)' : 'MACD (12, 26, 9)'}</span>
            {subIndicator === 'rsi' && readouts.rsi !== null && (
              <span className={styles.subPaneBadge} style={{
                background: readouts.rsi > 70 ? 'var(--color-loss-bg)' : readouts.rsi < 30 ? 'var(--color-gain-bg)' : 'var(--bg-elevated)',
                color: readouts.rsi > 70 ? chartPalette.bearish : readouts.rsi < 30 ? chartPalette.bullish : chartPalette.rsi,
                border: `1px solid ${readouts.rsi > 70 ? 'var(--color-loss-border)' : readouts.rsi < 30 ? 'var(--color-gain-border)' : 'var(--border-subtle)'}`,
              }}>
                {readouts.rsi}
              </span>
            )}
          </div>
          <svg ref={subSvgRef} className={styles.subSvg} />
        </div>
      )}
    </div>
  );
}
