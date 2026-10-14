import { describe, it, expect } from 'vitest';

// Indicator calculation formulas under test
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

describe('Technical Analysis Indicator Algorithms', () => {
  it('calculateSMA should accurately calculate 5-period moving average', () => {
    const prices = [10, 11, 12, 13, 14, 15];
    const sma = calculateSMA(prices, 5);

    expect(sma[0]).toBeNull();
    expect(sma[3]).toBeNull();
    expect(sma[4]).toBe(12); // (10+11+12+13+14)/5 = 12
    expect(sma[5]).toBe(13); // (11+12+13+14+15)/5 = 13
  });

  it('calculateEMA should weight recent prices more heavily than older prices', () => {
    const prices = [10, 10, 10, 10, 20];
    const ema = calculateEMA(prices, 4);

    expect(ema[3]).toBe(10);
    // After jump to 20, EMA must be higher than 10
    expect(ema[4]).toBeGreaterThan(10);
    expect(ema[4]).toBeLessThan(20);
  });

  it('calculateBollingerBands should produce symmetric upper and lower bands around middle mean', () => {
    const prices = Array(25).fill(100).map((v, i) => v + (i % 2 === 0 ? 2 : -2));
    const bb = calculateBollingerBands(prices, 20, 2);

    expect(bb.upper[24]).toBeDefined();
    expect(bb.middle[24]).toBe(100);
    expect(bb.upper[24]!).toBeGreaterThan(bb.middle[24]!);
    expect(bb.lower[24]!).toBeLessThan(bb.middle[24]!);
    // Upper and lower bands must be equidistant from middle
    const diffUpper = bb.upper[24]! - bb.middle[24]!;
    const diffLower = bb.middle[24]! - bb.lower[24]!;
    expect(Math.abs(diffUpper - diffLower)).toBeLessThan(0.0001);
  });

  it('calculateRSI should return values strictly between 0 and 100', () => {
    // Upward trend
    const uptrend = Array(30).fill(0).map((_, i) => 100 + i * 2);
    const rsiUp = calculateRSI(uptrend, 14);
    const lastRsiUp = rsiUp[rsiUp.length - 1];

    expect(lastRsiUp).toBeDefined();
    expect(lastRsiUp!).toBeGreaterThan(70); // Should be overbought
    expect(lastRsiUp!).toBeLessThanOrEqual(100);

    // Downward trend
    const downtrend = Array(30).fill(0).map((_, i) => 100 - i * 2);
    const rsiDown = calculateRSI(downtrend, 14);
    const lastRsiDown = rsiDown[rsiDown.length - 1];

    expect(lastRsiDown).toBeDefined();
    expect(lastRsiDown!).toBeLessThan(30); // Should be oversold
    expect(lastRsiDown!).toBeGreaterThanOrEqual(0);
  });
});
