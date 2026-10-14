import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useWalletStore, useTradesStore, useNotificationsStore } from '../store';

// In-memory localStorage mock for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
});

describe('Frontend Zustand State Stores', () => {
  beforeEach(() => {
    // Reset stores to predictable baseline
    useWalletStore.setState({
      totalBalance: 10000,
      availableBalance: 10000,
      reservedTrading: 0,
      reservedEarn: 0,
      reservedBots: 0,
      transactions: [],
    });

    useTradesStore.setState({
      openTrades: [],
      closedTrades: [],
    });
  });

  it('deposit should increase total and available balances and record transaction', () => {
    const { deposit } = useWalletStore.getState();
    deposit(2500, 'Crypto Deposit (USDT)');

    const state = useWalletStore.getState();
    expect(state.totalBalance).toBe(12500);
    expect(state.availableBalance).toBe(12500);
    expect(state.transactions.length).toBe(1);
    expect(state.transactions[0].type).toBe('deposit');
    expect(state.transactions[0].amount).toBe(2500);
  });

  it('withdraw should decrease available and total balance', () => {
    const { withdraw } = useWalletStore.getState();
    const success = withdraw(3000);

    expect(success).toBe(true);
    const state = useWalletStore.getState();
    expect(state.totalBalance).toBe(7000);
    expect(state.availableBalance).toBe(7000);
  });

  it('withdraw should fail if requested amount exceeds available balance', () => {
    const { withdraw } = useWalletStore.getState();
    const success = withdraw(15000);

    expect(success).toBe(false);
    const state = useWalletStore.getState();
    expect(state.totalBalance).toBe(10000);
  });

  it('placeTrade should create an open position and record initial trade data', () => {
    const { placeTrade } = useTradesStore.getState();
    const trade = placeTrade({
      symbol: 'BTC/USD',
      direction: 'buy',
      orderType: 'market',
      sizeUsd: 2000,
      entryPrice: 65000,
      fee: 2.0,
    });

    expect(trade.id).toBeDefined();
    expect(trade.symbol).toBe('BTC/USD');
    expect(trade.direction).toBe('buy');
    expect(trade.sizeUsd).toBe(2000);

    const tradesState = useTradesStore.getState();
    expect(tradesState.openTrades.length).toBe(1);
    expect(tradesState.openTrades[0].symbol).toBe('BTC/USD');
  });

  it('closeTrade should compute realized PnL and move position to closedTrades', () => {
    const { placeTrade, closeTrade } = useTradesStore.getState();
    const trade = placeTrade({
      symbol: 'EUR/USD',
      direction: 'buy',
      orderType: 'market',
      sizeUsd: 1000,
      entryPrice: 1.0800,
      fee: 1.0,
    });

    // Close trade at higher price (1.0908 = ~1% gain)
    closeTrade(trade.id, 1.0908);

    const tradesState = useTradesStore.getState();
    expect(tradesState.openTrades.length).toBe(0);
    expect(tradesState.closedTrades.length).toBe(1);
    expect(tradesState.closedTrades[0].realizedPnl).toBeGreaterThan(0);
  });

  it('notificationsStore should add notification and mark as read', () => {
    const { addNotification, markRead } = useNotificationsStore.getState();
    addNotification({
      title: 'Test Alert',
      message: 'Order filled at market price',
      type: 'order_filled',
    });

    const notifs = useNotificationsStore.getState().notifications;
    expect(notifs.length).toBeGreaterThan(0);
    const latest = notifs[0];
    expect(latest.read).toBe(false);

    markRead(latest.id);
    const updated = useNotificationsStore.getState().notifications.find(n => n.id === latest.id);
    expect(updated?.read).toBe(true);
  });
});
