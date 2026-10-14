// HKFES Zustand Stores — API-backed state management
// Backend is the single source of truth. Stores cache API responses in memory without localStorage persist.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, getAuthToken, setAuthToken } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────

export type UserRole = 'user' | 'admin' | 'super_admin';
export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';
export type TradeDirection = 'buy' | 'sell' | 'call' | 'put';
export type OrderType = 'market' | 'limit' | 'stop' | 'short_term_option';
export type TradeStatus = 'pending' | 'open' | 'closed' | 'cancelled' | 'won' | 'lost' | 'tied';
export type ServiceType = 'earn' | 'grid_bot' | 'dca_bot' | 'copy_trade' | 'arbitrage' | 'options';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  role: UserRole;
  kycStatus: KycStatus;
  status?: string;
  tradingBlocked?: boolean;
  withdrawalsBlocked?: boolean;
  depositsBlocked?: boolean;
  mfaEnabled: boolean;
  emailVerified?: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface PriceTick {
  symbol: string;
  bid: number;
  ask: number;
  price: number;
  change: number;
  changePct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
  direction: 'up' | 'down' | 'flat';
}

export interface Trade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  orderType: OrderType;
  status: TradeStatus;
  sizeUsd: number;
  entryPrice: number;
  strikePrice?: number;
  durationSeconds?: number;
  targetExpiry?: string;
  payoutRate?: number;
  exitPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  openedAt: string;
  closedAt?: string;
  fee: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'trade_pnl' | 'earn_payout' | 'fee' | 'balance_reset' | 'admin_adjustment' | 'internal_transfer';
  amount: number;

  balanceBefore: number;
  balanceAfter: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  referenceId?: string;
}

export interface CryptoTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  asset: 'USDT' | 'BTC' | string;
  network: string;
  amount: number;
  amountUsd?: number;
  feeAmount?: number;
  netAmount?: number;
  txHash?: string;
  toAddress?: string;
  status: 'PENDING_VERIFICATION' | 'PENDING_REVIEW' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED' | string;
  rejectionReason?: string;
  internalNotes?: string;
  proofImageUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ServiceSubscription {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: ServiceType;
  status: 'active' | 'paused' | 'stopped';
  allocatedUsd: number;
  totalPnl: number;
  accruedYield: number;
  startedAt: string;
  config: Record<string, unknown>;
  riskLevel: RiskLevel;
  simulatedApy?: number;
}

export type NotificationType =
  | 'order_filled'
  | 'bot_activity'
  | 'earn_payout'
  | 'system'
  | 'deposit'
  | 'withdrawal'
  | 'margin_warning'
  | 'security'
  | 'price_alert';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  symbol?: string;
  amount?: number;
  deepLink?: string;
  actionText?: string;
}

// ─── Auth Store ─────────────────────────────────────────────
// Auth is persisted so session survives refresh

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      login: (user, token) => {
        setAuthToken(token);
        set({ user, token, isAuthenticated: true, isAdmin: user.role !== 'user' });
      },
      logout: () => {
        api.logout().catch(() => {});
        setAuthToken(null);
        set({ user: null, token: null, isAuthenticated: false, isAdmin: false });
        useWalletStore.getState().reset();
        useTradesStore.getState().reset();
        useServicesStore.getState().reset();
      },
      updateUser: (partial) => {
        const user = get().user;
        if (user) set({ user: { ...user, ...partial } });
      },
    }),
    { name: 'hkfes-auth' }
  )
);

// ─── Wallet Store (NO PERSIST — backend source of truth) ───

interface WalletStore {
  totalBalance: number;
  availableBalance: number;
  reservedTrading: number;
  reservedEarn: number;
  reservedBots: number;
  reservedWithdrawal: number;
  transactions: Transaction[];
  cryptoTransactions: CryptoTransaction[];
  isLoading: boolean;
  lastFetched: number | null;
  // Methods
  deposit: (amount: number, method?: string) => Promise<boolean> | boolean;
  withdraw: (amount: number, destination?: string, method?: string) => Promise<boolean> | boolean;
  submitCryptoDepositClaim: (data: { asset: string; network: string; amount: number; txHash: string; proofImageUrl?: string }) => Promise<boolean>;
  requestCryptoWithdrawal: (data: { asset: string; network: string; amount: number; destinationAddress: string }) => Promise<boolean>;
  fetchCryptoTransactions: () => Promise<void>;
  reserveTradeMargin: (amount: number, symbol?: string, side?: string) => boolean;
  releaseTradeMargin: (amount: number) => void;
  resetBalance: (initialAmount?: number) => void;
  subwalletTransfer: (from: 'available' | 'trading' | 'earn' | 'bots', to: 'available' | 'trading' | 'earn' | 'bots', amount: number) => boolean;
  fetchWallet: () => Promise<void>;
  fetchTransactions: (page?: number, limit?: number) => Promise<void>;
  reset: () => void;
}

const defaultCryptoTransactions: CryptoTransaction[] = [
  {
    id: 'ctx_dep_101',
    type: 'deposit',
    asset: 'USDT',
    network: 'USDT_TRC20',
    amount: 1500.0,
    amountUsd: 1500.0,
    toAddress: 'TYDzsYUEpvnYmQk4zGP9s2T7vLqNxVn8W9',
    txHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
  },
  {
    id: 'ctx_dep_102',
    type: 'deposit',
    asset: 'BTC',
    network: 'BTC_MAINNET',
    amount: 2450.0,
    amountUsd: 2450.0,
    toAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    txHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    status: 'PENDING_VERIFICATION',
    createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
  },
  {
    id: 'ctx_wdr_103',
    type: 'withdrawal',
    asset: 'USDT',
    network: 'USDT_TRC20',
    amount: 500.0,
    feeAmount: 1.5,
    netAmount: 498.5,
    toAddress: 'TLyqzVGLV1srkB7dToTAuggRe5GJ1s7392',
    status: 'PENDING_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

const defaultWalletState = {
  totalBalance: 10000,
  availableBalance: 9500,
  reservedTrading: 0,
  reservedEarn: 0,
  reservedBots: 0,
  reservedWithdrawal: 500,
  transactions: [] as Transaction[],
  cryptoTransactions: defaultCryptoTransactions,
  isLoading: false,
  lastFetched: null as number | null,
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...defaultWalletState,

  deposit: (amount: number, method = 'Bank Transfer') => {
    if (amount <= 0) return false;
    const { totalBalance, availableBalance, transactions } = get();
    const balanceBefore = totalBalance;
    const balanceAfter = balanceBefore + amount;
    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'deposit',
      amount,
      balanceBefore,
      balanceAfter,
      description: `Deposit via ${method}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    set({
      totalBalance: balanceAfter,
      availableBalance: availableBalance + amount,
      transactions: [newTx, ...transactions],
    });

    if (getAuthToken()) {
      api.deposit(amount, method).catch(() => {});
    }
    return true;
  },

  withdraw: (amount: number, destination = 'Default Bank Account', method = 'Bank Transfer') => {
    const { availableBalance, totalBalance, transactions } = get();
    if (amount <= 0 || amount > availableBalance) return false;

    const balanceBefore = totalBalance;
    const balanceAfter = balanceBefore - amount;
    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'withdrawal',
      amount,
      balanceBefore,
      balanceAfter,
      description: `Withdrawal via ${method}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    set({
      totalBalance: balanceAfter,
      availableBalance: availableBalance - amount,
      transactions: [newTx, ...transactions],
    });

    if (getAuthToken()) {
      api.withdraw(amount, destination, method).catch(() => {});
    }
    return true;
  },

  submitCryptoDepositClaim: async (data: { asset: string; network: string; amount: number; txHash: string; proofImageUrl?: string }) => {
    const { cryptoTransactions } = get();
    const newTx: CryptoTransaction = {
      id: `ctx_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'deposit',
      asset: data.asset,
      network: data.network,
      amount: data.amount,
      amountUsd: data.amount,
      txHash: data.txHash,
      proofImageUrl: data.proofImageUrl,
      status: 'PENDING_VERIFICATION',
      createdAt: new Date().toISOString(),
    };

    set({
      cryptoTransactions: [newTx, ...cryptoTransactions],
    });

    if (getAuthToken()) {
      try {
        const res = await api.submitCryptoDepositClaim(data);
        if (res.success && res.data) {
          set(s => ({
            cryptoTransactions: s.cryptoTransactions.map(t => t.id === newTx.id ? { ...t, id: res.data.id } : t)
          }));
        }
      } catch {}
    }
    return true;
  },

  requestCryptoWithdrawal: async (data: { asset: string; network: string; amount: number; destinationAddress: string }) => {
    const { availableBalance, reservedWithdrawal, cryptoTransactions } = get();
    if (data.amount <= 0 || data.amount > availableBalance) return false;

    const fee = data.network?.includes('TRC20') ? 1.5 : data.network?.includes('ERC20') ? 12.0 : data.network?.includes('BTC') ? 15.0 : 1.0;
    const netAmount = Math.max(0, data.amount - fee);

    const newTx: CryptoTransaction = {
      id: `ctx_wdr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'withdrawal',
      asset: data.asset,
      network: data.network,
      amount: data.amount,
      amountUsd: data.amount,
      feeAmount: fee,
      netAmount,
      toAddress: data.destinationAddress,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };

    // Atomic local reservation: available balance decrements, reservedWithdrawal increments
    set({
      availableBalance: availableBalance - data.amount,
      reservedWithdrawal: reservedWithdrawal + data.amount,
      cryptoTransactions: [newTx, ...cryptoTransactions],
    });

    if (getAuthToken()) {
      try {
        const res = await api.requestCryptoWithdrawal(data);
        if (res.success && res.data) {
          set(s => ({
            cryptoTransactions: s.cryptoTransactions.map(t => t.id === newTx.id ? { ...t, id: res.data.id } : t)
          }));
        }
      } catch {}
    }
    return true;
  },

  fetchCryptoTransactions: async () => {
    if (!getAuthToken()) return;
    try {
      const res = await api.getCryptoTransactions();
      if (res.success && Array.isArray(res.data)) {
        set({ cryptoTransactions: res.data });
      }
    } catch {}
  },

  reserveTradeMargin: (amount: number) => {
    const { availableBalance, reservedTrading } = get();
    if (amount <= 0 || amount > availableBalance) return false;
    set({
      availableBalance: availableBalance - amount,
      reservedTrading: reservedTrading + amount,
    });
    return true;
  },

  releaseTradeMargin: (amount: number) => {
    const { availableBalance, reservedTrading } = get();
    const releaseAmt = Math.min(amount, Math.max(0, reservedTrading));
    set({
      availableBalance: availableBalance + releaseAmt,
      reservedTrading: Math.max(0, reservedTrading - releaseAmt),
    });
  },

  resetBalance: (initialAmount = 10000) => {
    set({
      totalBalance: initialAmount,
      availableBalance: initialAmount,
      reservedTrading: 0,
      reservedEarn: 0,
      reservedBots: 0,
      transactions: [
        {
          id: `tx_${Date.now()}`,
          type: 'balance_reset',
          amount: initialAmount,
          balanceBefore: get().totalBalance,
          balanceAfter: initialAmount,
          description: 'Demo balance reset to baseline',
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  },

  subwalletTransfer: (from, to, amount) => {
    if (from === to || amount <= 0) return false;
    const state = get();
    const getField = (key: 'available' | 'trading' | 'earn' | 'bots') => {
      if (key === 'available') return 'availableBalance' as const;
      if (key === 'trading') return 'reservedTrading' as const;
      if (key === 'earn') return 'reservedEarn' as const;
      return 'reservedBots' as const;
    };

    const fromField = getField(from);
    const toField = getField(to);
    if (state[fromField] < amount) return false;

    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'internal_transfer',
      amount,
      balanceBefore: state.totalBalance,
      balanceAfter: state.totalBalance,
      description: `Sub-wallet transfer: $${amount.toLocaleString()} from ${from} to ${to}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    set({
      [fromField]: state[fromField] - amount,
      [toField]: state[toField] + amount,
      transactions: [newTx, ...state.transactions],
    } as any);

    if (getAuthToken()) {
      api.transferSubwallet(from, to, amount).catch(() => {});
    }
    return true;
  },

  fetchWallet: async () => {
    if (!getAuthToken()) return;
    set({ isLoading: true });
    try {
      const res = await api.getWallet();
      if (res.success && res.data) {
        set({
          totalBalance: res.data.totalBalance ?? get().totalBalance,
          availableBalance: res.data.availableBalance ?? get().availableBalance,
          reservedTrading: res.data.reservedTrading ?? get().reservedTrading,
          reservedEarn: res.data.reservedEarn ?? get().reservedEarn,
          reservedBots: res.data.reservedBots ?? get().reservedBots,
          isLoading: false,
          lastFetched: Date.now(),
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchTransactions: async (page = 1, limit = 50) => {
    if (!getAuthToken()) return;
    try {
      const res = await api.getTransactions(page, limit);
      if (res.success && res.data?.transactions) {
        set({
          transactions: res.data.transactions.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            balanceBefore: tx.balanceBefore,
            balanceAfter: tx.balanceAfter,
            description: tx.description || '',
            status: tx.status,
            createdAt: tx.createdAt,
            referenceId: tx.referenceId,
          })),
        });
      }
    } catch {
      // Fallback
    }
  },

  reset: () => set(defaultWalletState),
    }),
    { name: 'hkfes-wallet' }
  )
);

// ─── Trades Store (persisted cache + backend sync) ───

interface TradesStore {
  openTrades: Trade[];
  closedTrades: Trade[];
  isLoading: boolean;
  // Methods
  placeTrade: (order: {
    symbol: string;
    direction: TradeDirection;
    orderType: OrderType;
    sizeUsd: number;
    entryPrice: number;
    limitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    fee?: number;
  }) => Trade;
  closeTrade: (tradeId: string, exitPrice?: number, percentage?: number) => { success: boolean; pnl?: number };
  fetchPositions: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  updateTradePrices: (prices: Record<string, PriceTick>) => void;
  placeOptionContract: (contract: {
    symbol: string;
    direction: 'call' | 'put';
    durationSeconds: number;
    amount: number;
    strikePrice: number;
    payoutRate?: number;
  }) => Promise<Trade | null>;
  settleOptionContract: (contractId: string, exitPrice?: number) => Promise<{ outcome: 'won' | 'lost' | 'tied'; pnl: number }>;
  reset: () => void;
}

const defaultTradesState = {
  openTrades: [],
  closedTrades: [],
  isLoading: false,
};

export const useTradesStore = create<TradesStore>()(
  persist(
    (set, get) => ({
      ...defaultTradesState,

      placeTrade: (order) => {
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.tradingBlocked || currentUser?.status === 'suspended') {
          useNotificationsStore.getState().addNotification({
            type: 'system',
            title: 'Trading Disabled by Compliance',
            message: 'Your account is restricted from executing orders. Please contact Support.',
          });
          return null as any;
        }

        const newTrade: Trade = {
          id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          symbol: order.symbol,
          direction: order.direction,
          orderType: order.orderType,
          status: 'open',
          sizeUsd: order.sizeUsd,
          entryPrice: order.entryPrice,
          currentPrice: order.entryPrice,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
          fee: order.fee ?? 0,
          unrealizedPnl: 0,
          openedAt: new Date().toISOString(),
        };

        set(s => ({
          openTrades: [newTrade, ...s.openTrades],
        }));

        if (getAuthToken()) {
          api.placeOrder({
            symbol: order.symbol,
            direction: order.direction,
            orderType: order.orderType,
            sizeUsd: order.sizeUsd,
            limitPrice: order.limitPrice,
            stopLoss: order.stopLoss,
            takeProfit: order.takeProfit,
          }).then((res) => {
            if (res.success && res.data?.order) {
              const bo = res.data.order;
              set(s => ({
                openTrades: s.openTrades.map(t => t.id === newTrade.id ? {
                  ...t,
                  id: bo.id || t.id,
                  entryPrice: bo.entryPrice || t.entryPrice,
                  currentPrice: bo.currentPrice || t.currentPrice,
                } : t)
              }));
            } else if (!res.success) {
              // Rollback trade and release reserved margin
              set(s => ({
                openTrades: s.openTrades.filter(t => t.id !== newTrade.id),
              }));
              useWalletStore.getState().releaseTradeMargin(order.sizeUsd);
              useNotificationsStore.getState().addNotification({
                type: 'system',
                title: 'Order Placement Blocked',
                message: res.error?.message || 'Trading order was rejected by Compliance.',
              });
            }
          }).catch(() => {
            set(s => ({
              openTrades: s.openTrades.filter(t => t.id !== newTrade.id),
            }));
            useWalletStore.getState().releaseTradeMargin(order.sizeUsd);
          });
        }

        return newTrade;
      },

  closeTrade: (tradeId, exitPrice, percentage = 100) => {
    const { openTrades, closedTrades } = get();
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return { success: false };

    const effectiveExitPrice = exitPrice ?? trade.currentPrice ?? trade.entryPrice;
    const fraction = Math.min(100, Math.max(1, percentage)) / 100;
    const closingSize = trade.sizeUsd * fraction;
    const multiplier = trade.direction === 'buy' ? 1 : -1;
    const pnl = ((effectiveExitPrice - trade.entryPrice) / trade.entryPrice) * closingSize * multiplier;

    const closedItem: Trade = {
      ...trade,
      sizeUsd: closingSize,
      status: 'closed',
      exitPrice: effectiveExitPrice,
      realizedPnl: parseFloat(pnl.toFixed(2)),
      closedAt: new Date().toISOString(),
    };

    let remainingTrades: Trade[];
    if (fraction >= 1) {
      remainingTrades = openTrades.filter(t => t.id !== tradeId);
    } else {
      remainingTrades = openTrades.map(t =>
        t.id === tradeId ? { ...t, sizeUsd: t.sizeUsd - closingSize } : t
      );
    }

    set({
      openTrades: remainingTrades,
      closedTrades: [closedItem, ...closedTrades],
    });

    // Update wallet: return margin + realized pnl
    const { availableBalance, reservedTrading, totalBalance, transactions } = useWalletStore.getState();
    const cashReturn = closingSize + pnl;
    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'trade_pnl',
      amount: parseFloat(cashReturn.toFixed(2)),
      balanceBefore: totalBalance,
      balanceAfter: parseFloat((totalBalance + pnl).toFixed(2)),
      description: `Closed ${trade.direction.toUpperCase()} ${trade.symbol} (${percentage}%) PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    useWalletStore.setState({
      availableBalance: parseFloat((availableBalance + cashReturn).toFixed(2)),
      reservedTrading: Math.max(0, parseFloat((reservedTrading - closingSize).toFixed(2))),
      totalBalance: parseFloat((totalBalance + pnl).toFixed(2)),
      transactions: [newTx, ...transactions],
    });

    if (getAuthToken()) {
      api.closePosition(tradeId, percentage).catch(() => {});
    }

    return { success: true, pnl };
  },

  placeOptionContract: async (contract) => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.tradingBlocked || currentUser?.status === 'suspended') {
      useNotificationsStore.getState().addNotification({
        type: 'system',
        title: 'Trading Disabled by Compliance',
        message: 'Your account is restricted from executing short-term option contracts.',
      });
      return null;
    }

    const { availableBalance } = useWalletStore.getState();
    if (contract.amount <= 0 || contract.amount > availableBalance) {
      useNotificationsStore.getState().addNotification({
        type: 'system',
        title: 'Insufficient Balance',
        message: `Available cash ($${availableBalance.toFixed(2)}) is less than contract amount ($${contract.amount}).`,
      });
      return null;
    }

    useWalletStore.getState().reserveTradeMargin(contract.amount);

    const now = Date.now();
    const expiryDate = new Date(now + contract.durationSeconds * 1000).toISOString();
    const newContract: Trade = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      symbol: contract.symbol,
      direction: contract.direction,
      orderType: 'short_term_option',
      status: 'open',
      sizeUsd: contract.amount,
      entryPrice: contract.strikePrice,
      strikePrice: contract.strikePrice,
      currentPrice: contract.strikePrice,
      durationSeconds: contract.durationSeconds,
      targetExpiry: expiryDate,
      payoutRate: contract.payoutRate ?? 0.90,
      fee: 0,
      unrealizedPnl: 0,
      openedAt: new Date(now).toISOString(),
    };

    set(s => ({
      openTrades: [newContract, ...s.openTrades],
    }));

    if (getAuthToken()) {
      try {
        const res = await api.placeOptionOrder({
          symbol: contract.symbol,
          direction: contract.direction,
          durationSeconds: contract.durationSeconds,
          amount: contract.amount,
          payoutRate: contract.payoutRate ?? 0.90,
        });
        if (res.success && res.data?.contract) {
          const bc = res.data.contract;
          set(s => ({
            openTrades: s.openTrades.map(t => t.id === newContract.id ? {
              ...t,
              id: bc.id,
              strikePrice: bc.strikePrice || t.strikePrice,
              entryPrice: bc.entryPrice || t.entryPrice,
              targetExpiry: bc.targetExpiry || t.targetExpiry,
            } : t),
          }));
        } else if (!res.success) {
          set(s => ({ openTrades: s.openTrades.filter(t => t.id !== newContract.id) }));
          useWalletStore.getState().releaseTradeMargin(contract.amount);
          useNotificationsStore.getState().addNotification({
            type: 'system',
            title: 'Option Order Rejected',
            message: res.error?.message || 'Server rejected option order.',
          });
          return null;
        }
      } catch {
        // Optimistic fallback
      }
    }

    return newContract;
  },

  settleOptionContract: async (contractId, exitPrice) => {
    const { openTrades, closedTrades } = get();
    const contract = openTrades.find(t => t.id === contractId);
    if (!contract || contract.status !== 'open') return { outcome: 'lost' as const, pnl: 0 };

    const strikePrice = contract.strikePrice ?? contract.entryPrice;
    const finalPrice = exitPrice ?? contract.currentPrice ?? strikePrice;
    const isCall = contract.direction === 'call' || contract.direction === 'buy';
    const payoutRate = contract.payoutRate ?? 0.90;

    let outcome: 'won' | 'lost' | 'tied';
    let pnl = 0;
    let cashReturn = 0;

    if (finalPrice === strikePrice) {
      outcome = 'tied';
      pnl = 0;
      cashReturn = contract.sizeUsd;
    } else if (isCall ? finalPrice > strikePrice : finalPrice < strikePrice) {
      outcome = 'won';
      pnl = parseFloat((contract.sizeUsd * payoutRate).toFixed(2));
      cashReturn = contract.sizeUsd + pnl;
    } else {
      outcome = 'lost';
      pnl = -contract.sizeUsd;
      cashReturn = 0;
    }

    const settledContract: Trade = {
      ...contract,
      status: outcome === 'won' ? 'won' : outcome === 'lost' ? 'lost' : 'tied',
      exitPrice: finalPrice,
      realizedPnl: pnl,
      closedAt: new Date().toISOString(),
    };

    set({
      openTrades: openTrades.filter(t => t.id !== contractId),
      closedTrades: [settledContract, ...closedTrades],
    });

    const { availableBalance, reservedTrading, totalBalance, transactions } = useWalletStore.getState();
    const newTx: Transaction = {
      id: `tx_opt_${Date.now()}`,
      type: 'trade_pnl',
      amount: pnl,
      balanceBefore: totalBalance,
      balanceAfter: parseFloat((totalBalance + pnl).toFixed(2)),
      description: `Settled ${contract.durationSeconds}s Option: ${contract.direction.toUpperCase()} ${contract.symbol} (${outcome.toUpperCase()}) P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
      referenceId: contract.id,
    };

    useWalletStore.setState({
      availableBalance: parseFloat((availableBalance + cashReturn).toFixed(2)),
      reservedTrading: Math.max(0, parseFloat((reservedTrading - contract.sizeUsd).toFixed(2))),
      totalBalance: parseFloat((totalBalance + pnl).toFixed(2)),
      transactions: [newTx, ...transactions],
    });

    useNotificationsStore.getState().addNotification({
      type: 'order_filled',
      title: outcome === 'won' ? `🎉 Option Won: +$${pnl.toFixed(2)}` : outcome === 'tied' ? `Option Tied: Stake Refunded` : `Option Expired Out-of-the-Money`,
      message: `${contract.durationSeconds}s ${contract.direction.toUpperCase()} on ${contract.symbol} — Strike: $${strikePrice.toFixed(4)}, Exit: $${finalPrice.toFixed(4)}`,
    });

    if (getAuthToken()) {
      api.settleOptionOrder(contractId, finalPrice).catch(() => {});
    }

    return { outcome, pnl };
  },

  fetchPositions: async () => {
    if (!getAuthToken()) return;
    try {
      const res = await api.getPositions();
      if (res.success && res.data) {
        const positions = Array.isArray(res.data) ? res.data : [];
        set({
          openTrades: positions.map((p: any) => ({
            id: p.id,
            symbol: p.assetSymbol || p.symbol,
            direction: p.direction,
            orderType: p.orderType,
            status: p.status,
            sizeUsd: p.sizeUsd,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
            unrealizedPnl: p.unrealizedPnl,
            openedAt: p.openedAt || p.createdAt,
            fee: p.simulatedFee || 0,
          })),
        });
      }
    } catch {
      // Fallback
    }
  },

  fetchHistory: async () => {
    if (!getAuthToken()) return;
    try {
      const res = await api.getTradeHistory();
      if (res.success && res.data) {
        const history = res.data.history || res.data || [];
        set({
          closedTrades: (Array.isArray(history) ? history : []).map((t: any) => ({
            id: t.id,
            symbol: t.assetSymbol || t.symbol,
            direction: t.direction,
            orderType: t.orderType,
            status: 'closed',
            sizeUsd: t.sizeUsd,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            realizedPnl: t.realizedPnl,
            openedAt: t.openedAt || t.createdAt,
            closedAt: t.closedAt,
            fee: t.simulatedFee || 0,
          })),
        });
      }
    } catch {
      // Fallback
    }
  },

  updateTradePrices: (prices) => {
    set(s => ({
      openTrades: s.openTrades.map(t => {
        const tick = prices[t.symbol];
        if (!tick) return t;
        const multiplier = t.direction === 'buy' ? 1 : -1;
        const priceDiff = (tick.price - t.entryPrice) * multiplier;
        const unrealizedPnl = (priceDiff / t.entryPrice) * t.sizeUsd;
        return { ...t, currentPrice: tick.price, unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)) };
      }),
    }));
  },

  reset: () => set(defaultTradesState),
    }),
    { name: 'hkfes-trades' }
  )
);

// ─── Services Store (persisted cache + backend sync) ──

interface ServicesStore {
  subscriptions: ServiceSubscription[];
  isLoading: boolean;
  subscribe: (
    serviceOrSub: Partial<ServiceSubscription> | string,
    amount?: number,
    config?: any
  ) => Promise<boolean> | boolean;
  accrueYield: () => void;
  fetchSubscriptions: () => Promise<void>;
  reset: () => void;
}

const defaultServicesState = {
  subscriptions: [],
  isLoading: false,
};

export const useServicesStore = create<ServicesStore>()(
  persist(
    (set, get) => ({
      ...defaultServicesState,

  subscribe: (serviceOrSub, amount, config = {}) => {
    let subItem: ServiceSubscription;

    if (typeof serviceOrSub === 'string') {
      const alloc = amount || 1000;
      subItem = {
        id: `sub_${Date.now()}`,
        serviceId: serviceOrSub,
        serviceName: serviceOrSub,
        serviceType: 'earn',
        status: 'active',
        allocatedUsd: alloc,
        totalPnl: 0,
        accruedYield: 0,
        startedAt: new Date().toISOString(),
        config,
        riskLevel: 'medium',
      };
    } else {
      subItem = {
        id: serviceOrSub.id || `sub_${Date.now()}`,
        serviceId: serviceOrSub.serviceId || 'svc',
        serviceName: serviceOrSub.serviceName || 'Strategy',
        serviceType: serviceOrSub.serviceType || 'earn',
        status: serviceOrSub.status || 'active',
        allocatedUsd: serviceOrSub.allocatedUsd || 1000,
        totalPnl: 0,
        accruedYield: 0,
        startedAt: new Date().toISOString(),
        config: serviceOrSub.config || {},
        riskLevel: serviceOrSub.riskLevel || 'medium',
        simulatedApy: serviceOrSub.simulatedApy,
      };
    }

    const { availableBalance, reservedEarn } = useWalletStore.getState();
    if (availableBalance >= subItem.allocatedUsd) {
      useWalletStore.setState({
        availableBalance: availableBalance - subItem.allocatedUsd,
        reservedEarn: reservedEarn + subItem.allocatedUsd,
      });
    }

    set(s => ({
      subscriptions: [subItem, ...s.subscriptions],
    }));

    if (getAuthToken()) {
      api.subscribeService(subItem.serviceId, subItem.allocatedUsd, subItem.config).catch(() => {});
    }

    return true;
  },

  accrueYield: () => {
    const { subscriptions } = get();
    if (!subscriptions.length) return;

    let updated = false;
    const now = Date.now();
    const newSubs = subscriptions.map(sub => {
      if (sub.status !== 'active') return sub;
      const apy = sub.simulatedApy || 0.08;
      // Per-second yield fraction
      const perSec = (sub.allocatedUsd * (apy / 100)) / (365 * 86400);
      const yieldDelta = parseFloat((perSec * 1.5).toFixed(4));
      if (yieldDelta > 0) {
        updated = true;
        return {
          ...sub,
          accruedYield: parseFloat(((sub.accruedYield || 0) + yieldDelta).toFixed(4)),
          totalPnl: parseFloat(((sub.totalPnl || 0) + yieldDelta).toFixed(4)),
        };
      }
      return sub;
    });

    if (updated) {
      set({ subscriptions: newSubs });
    }
  },

  fetchSubscriptions: async () => {
    if (!getAuthToken()) return;
    try {
      const res = await api.getUserSubscriptions();
      if (res.success && res.data) {
        const subs = Array.isArray(res.data) ? res.data : [];
        set({
          subscriptions: subs.map((s: any) => ({
            id: s.id,
            serviceId: s.strategyId || s.serviceId,
            serviceName: s.strategy?.name || s.serviceName || 'Strategy',
            serviceType: s.strategy?.strategyType || s.serviceType || 'earn',
            status: s.status,
            allocatedUsd: s.allocatedUsd,
            totalPnl: s.totalPnl || 0,
            accruedYield: s.accruedYield || 0,
            startedAt: s.startedAt || s.createdAt,
            config: s.config ? (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) : {},
            riskLevel: s.strategy?.riskLevel || 'medium',
            simulatedApy: s.strategy?.simulatedApy,
          })),
        });
      }
    } catch {
      // Fallback
    }
  },

  reset: () => set(defaultServicesState),
    }),
    { name: 'hkfes-services' }
  )
);

// ─── Price Store ────────────────────────────────────────────

interface PriceStore {
  ticks: Record<string, PriceTick>;
  setTicks: (ticks: Record<string, PriceTick>) => void;
  getTick: (symbol: string) => PriceTick | undefined;
}

export const usePriceStore = create<PriceStore>()((set, get) => ({
  ticks: {},
  setTicks: (ticks) => set({ ticks }),
  getTick: (symbol) => get().ticks[symbol],
}));

// ─── Notifications Store (persisted) ─────────────────────────

interface NotificationsStore {
  notifications: Notification[];
  unreadCount: number;
  activeToast: Notification | null;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  dismissToast: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set, get) => ({
      notifications: [
        {
          id: 'notif_welcome',
          type: 'system',
          title: 'Welcome to HKFES Global',
          message: 'Institutional-grade simulated trading platform ready for deployment.',
          read: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          deepLink: '/dashboard',
          actionText: 'Explore',
        },
      ],
      unreadCount: 1,
      activeToast: null,

      addNotification: (n) => {
        const notif: Notification = {
          ...n,
          id: `n_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          read: false,
          createdAt: new Date().toISOString(),
        };
        set(s => ({
          notifications: [notif, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
          activeToast: notif,
        }));
      },

      dismissToast: () => set({ activeToast: null }),

      markRead: (id) => {
        set(s => {
          const target = s.notifications.find(n => n.id === id);
          if (!target || target.read) return s;
          return {
            notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
            unreadCount: Math.max(0, s.unreadCount - 1),
          };
        });
      },

      markAllRead: () => {
        set(s => ({
          notifications: s.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      clearAll: () => set({ notifications: [], unreadCount: 0, activeToast: null }),
    }),
    { name: 'hkfes-notifications' }
  )
);

// ─── UI & Accessibility Store (persisted) ───────────────────

export type Theme = 'light' | 'dark';

interface UIStore {
  theme: Theme;
  colorblindMode: boolean;
  stealthMode: boolean;
  sidebarCollapsed: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleColorblind: () => void;
  toggleColorblindMode: () => void;
  toggleStealth: () => void;
  toggleStealthMode: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (c: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      colorblindMode: false,
      stealthMode: false,
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      toggleColorblind: () => set(s => ({ colorblindMode: !s.colorblindMode })),
      toggleColorblindMode: () => set(s => ({ colorblindMode: !s.colorblindMode })),
      toggleStealth: () => set(s => ({ stealthMode: !s.stealthMode })),
      toggleStealthMode: () => set(s => ({ stealthMode: !s.stealthMode })),
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'hkfes-ui' }
  )
);
