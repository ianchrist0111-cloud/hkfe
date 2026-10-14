// HKFES Simulated data — services, signal providers, FAQ, etc.

import type { ServiceType, RiskLevel } from '../store';

export interface ServiceDef {
  id: string;
  name: string;
  serviceType: ServiceType;
  shortDescription: string;
  fullDescription: string;
  riskLevel: RiskLevel;
  simulatedApy?: number;
  simulatedWeeklyReturn?: string;
  minAllocation: number;
  maxAllocation?: number;
  assetSymbol?: string;
  icon: string;
  color: string;
  howItWorks: string[];
  faq: { q: string; a: string }[];
}

export const SERVICES: ServiceDef[] = [
  {
    id: 'earn-usd-5',
    name: 'USD Earn 5% APY',
    serviceType: 'earn',
    shortDescription: 'Earn a steady 5% annual yield on your idle USD balance.',
    fullDescription: 'The USD Earn product allocates your paper funds to a simulated structured savings product, accruing yield daily at 5% APY. Your principal is always accessible with a 24-hour notice period.',
    riskLevel: 'low',
    simulatedApy: 5,
    simulatedWeeklyReturn: '+0.096%',
    minAllocation: 100,
    icon: '💰',
    color: '#22c55e',
    howItWorks: [
      'Allocate any amount of your paper USD balance.',
      'Yield accrues daily at 5% APY (simulated calculation).',
      'View accrued yield in real-time on your dashboard.',
      'Withdraw at any time — principal + accrued yield returned instantly.',
    ],
    faq: [
      { q: 'Is my money safe?', a: 'This is a simulated product. No real funds are involved. In a live product, this would be backed by treasury bills or money market instruments.' },
      { q: 'Can I withdraw anytime?', a: 'Yes — in this simulation, withdrawals are instant. In a live product, a 24-hour settlement period would apply.' },
    ],
  },
  {
    id: 'earn-usd-8',
    name: 'USD Earn 8% APY',
    serviceType: 'earn',
    shortDescription: 'Higher yield at 8% APY — for medium-term allocation.',
    fullDescription: 'A higher-yield simulated product targeting 8% APY with a 30-day simulated lock-up period.',
    riskLevel: 'low',
    simulatedApy: 8,
    simulatedWeeklyReturn: '+0.154%',
    minAllocation: 500,
    icon: '🏦',
    color: '#3b82f6',
    howItWorks: [
      'Lock up your paper USD for a 30-day simulated period.',
      'Earn 8% APY — yield accrues daily.',
      'At maturity, principal + yield is returned to your wallet.',
      'Early exit incurs a 1% simulated penalty fee.',
    ],
    faq: [
      { q: 'What is the lock-up period?', a: 'For this simulation, the 30-day lock-up is displayed but withdrawals are always allowed to keep the demo smooth.' },
    ],
  },
  {
    id: 'grid-bot-btc',
    name: 'Grid Bot — BTC/USD',
    serviceType: 'grid_bot',
    shortDescription: 'Automated grid trading on Bitcoin — profit from price oscillation.',
    fullDescription: 'A grid bot places buy and sell orders at regular price intervals within a configured range. It captures profit each time the price bounces between grid levels.',
    riskLevel: 'medium',
    simulatedWeeklyReturn: '+2.1%',
    minAllocation: 200,
    assetSymbol: 'BTC/USD',
    icon: '🤖',
    color: '#f0a500',
    howItWorks: [
      'Set a price range (e.g., $60,000–$67,000) and number of grid levels.',
      'The bot automatically places buy/sell limit orders at each grid level.',
      'When price rises to a sell level, the bot sells. When it falls to a buy level, the bot buys.',
      'Each filled grid captures a small profit — compounding over time.',
    ],
    faq: [
      { q: 'What happens outside the grid range?', a: 'If the price moves outside the configured range, the bot pauses until price returns within range.' },
      { q: 'Can I stop the bot anytime?', a: 'Yes — stopping the bot cancels all open grid orders and returns your allocation.' },
    ],
  },
  {
    id: 'dca-bot-eth',
    name: 'DCA Bot — ETH/USD',
    serviceType: 'dca_bot',
    shortDescription: 'Dollar-cost averaging into Ethereum automatically.',
    fullDescription: 'The DCA bot purchases a fixed dollar amount of ETH at regular intervals (e.g., every hour), regardless of price — smoothing your average entry cost over time.',
    riskLevel: 'medium',
    simulatedWeeklyReturn: '+1.8%',
    minAllocation: 100,
    assetSymbol: 'ETH/USD',
    icon: '📊',
    color: '#8b5cf6',
    howItWorks: [
      'Choose your allocation and purchase interval (e.g., $50 every 30 minutes).',
      'The bot automatically buys ETH at the set interval.',
      'Your average cost is smoothed across many small purchases.',
      'Stop the bot anytime to sell your accumulated position.',
    ],
    faq: [
      { q: 'Why DCA?', a: 'DCA reduces the risk of investing a large amount at a market peak by spreading purchases over time.' },
    ],
  },
  {
    id: 'copy-trade-alpha',
    name: 'Copy Trade — Alpha Signals',
    serviceType: 'copy_trade',
    shortDescription: 'Mirror the trades of a top-performing signal provider.',
    fullDescription: 'Follow our top-rated simulated signal provider "AlphaTrader" and automatically copy their FX and crypto trades proportional to your allocation.',
    riskLevel: 'medium',
    simulatedWeeklyReturn: '+3.2%',
    minAllocation: 250,
    icon: '📡',
    color: '#00c9a7',
    howItWorks: [
      'Choose a signal provider and your copy allocation.',
      'When the signal provider places a trade, yours is mirrored proportionally.',
      'Set a maximum loss limit to auto-stop copying if drawdown exceeds your threshold.',
      'Stop copying anytime — open mirrored positions can be held or closed.',
    ],
    faq: [
      { q: 'Are the signal providers real?', a: 'In this simulation, signal providers are simulated. In a live product, they would be verified real traders with audited track records.' },
    ],
  },
  {
    id: 'arbitrage-sim',
    name: 'Simulated Arbitrage',
    serviceType: 'arbitrage',
    shortDescription: 'Watch cross-exchange price discrepancies get captured in real time.',
    fullDescription: 'An educational demonstration of how cross-exchange arbitrage works. Watch as the system detects a price discrepancy between two simulated exchanges and captures the profit.',
    riskLevel: 'low',
    simulatedWeeklyReturn: '+0.5%',
    minAllocation: 500,
    icon: '⚡',
    color: '#f59e0b',
    howItWorks: [
      'The system monitors simulated prices on Exchange A and Exchange B simultaneously.',
      'When a spread exceeding 0.15% is detected, an arbitrage opportunity is flagged.',
      'The system instantly buys on the cheaper exchange and sells on the more expensive one.',
      'The spread (minus simulated fees) is captured as profit.',
    ],
    faq: [
      { q: 'Is this real arbitrage?', a: 'No — this is a purely educational simulation showing how arbitrage mechanics work. No real exchanges are connected.' },
    ],
  },
  {
    id: 'options-btc',
    name: 'Options — BTC Call/Put',
    serviceType: 'options',
    shortDescription: 'Trade simulated Bitcoin options. Calls, puts, and spreads.',
    fullDescription: 'Place simulated call and put options on Bitcoin with configurable strikes and expiries. Option premiums are calculated using the Black-Scholes model on the simulated price feed.',
    riskLevel: 'high',
    simulatedWeeklyReturn: 'Variable',
    minAllocation: 100,
    assetSymbol: 'BTC/USD',
    icon: '📈',
    color: '#ef4444',
    howItWorks: [
      'Choose call (bullish) or put (bearish) direction.',
      'Set your strike price and expiry (1 day to 30 days, simulated).',
      'The system calculates the option premium using Black-Scholes with simulated volatility.',
      'Monitor the option\'s value as the underlying BTC price moves.',
    ],
    faq: [
      { q: 'What is Black-Scholes?', a: 'Black-Scholes is the standard mathematical model for pricing options. It takes into account the current price, strike, time to expiry, volatility, and risk-free rate.' },
      { q: 'Can I lose my entire premium?', a: 'Yes — options can expire worthless if the price does not reach the strike. This is a key risk of options trading (simulated here).' },
    ],
  },
];

// ─── Signal Providers ─────────────────────────────────────────

export const SIGNAL_PROVIDERS = [
  {
    id: 'alpha-trader',
    name: 'AlphaTrader',
    avatar: '🦅',
    description: 'Specializes in FX majors. 4+ years of live track record.',
    winRate: 68.4,
    monthlyReturn: 4.2,
    maxDrawdown: 8.1,
    riskScore: 3,
    copiers: 1284,
    assets: ['EUR/USD', 'GBP/USD', 'BTC/USD'],
    returns: [3.1, 5.2, 2.8, 6.1, 4.3, 4.2],
  },
  {
    id: 'crypto-sage',
    name: 'CryptoSage',
    avatar: '🔮',
    description: 'Crypto-focused momentum trader. High risk, high reward.',
    winRate: 61.2,
    monthlyReturn: 7.8,
    maxDrawdown: 18.4,
    riskScore: 7,
    copiers: 892,
    assets: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
    returns: [12.1, -4.2, 15.3, 8.7, 6.2, 7.8],
  },
  {
    id: 'steady-hands',
    name: 'SteadyHands',
    avatar: '🤝',
    description: 'Low-volatility FX and equity portfolio. Consistency over returns.',
    winRate: 73.8,
    monthlyReturn: 2.1,
    maxDrawdown: 3.2,
    riskScore: 2,
    copiers: 3421,
    assets: ['EUR/USD', 'AAPL', 'MSFT', 'SPX500'],
    returns: [2.3, 1.8, 2.4, 2.0, 1.9, 2.1],
  },
];

// ─── Admin Users (for demo) ───────────────────────────────────

export const DEMO_USERS = [
  { id: 'user-1', email: 'alex@demo.hkfes.com',   firstName: 'Alex',   lastName: 'Chen',     role: 'user' as const,  kycStatus: 'approved' as const, balance: 14285.40, lastActive: '2 min ago',   status: 'active' as const },
  { id: 'user-2', email: 'maya@demo.hkfes.com',   firstName: 'Maya',   lastName: 'Patel',    role: 'user' as const,  kycStatus: 'approved' as const, balance: 28910.75, lastActive: '8 min ago',   status: 'active' as const },
  { id: 'user-3', email: 'jordan@demo.hkfes.com', firstName: 'Jordan', lastName: 'Lee',      role: 'user' as const,  kycStatus: 'approved' as const, balance: 19432.60, lastActive: '1 hr ago',    status: 'active' as const },
  { id: 'user-4', email: 'sam@hkfes.com',         firstName: 'Sam',    lastName: 'Williams', role: 'admin' as const, kycStatus: 'approved' as const, balance: 10000.00, lastActive: 'Just now',    status: 'active' as const },
  { id: 'user-5', email: 'test1@demo.hkfes.com',  firstName: 'Tyler',  lastName: 'Moore',    role: 'user' as const,  kycStatus: 'pending'  as const, balance: 10000.00, lastActive: '3 days ago',  status: 'active' as const },
  { id: 'user-6', email: 'test2@demo.hkfes.com',  firstName: 'Sofia',  lastName: 'Reyes',    role: 'user' as const,  kycStatus: 'approved' as const, balance: 5681.20,  lastActive: '2 days ago',  status: 'suspended' as const },
];

// ─── FAQ Data ─────────────────────────────────────────────────

export const FAQ_DATA = [
  {
    category: 'Getting Started',
    items: [
      { q: 'What is HKFES?', a: 'HKFES is a multi-asset trading platform offering FX, crypto, equities, automated strategies, and more. You can explore all features using paper (simulated) funds.' },
      { q: 'How do I get started?', a: 'Create an account, complete identity verification, and you\'ll receive a starting paper balance of $10,000 USD to trade with.' },
      { q: 'Is my money real?', a: 'All funds on the platform are simulated paper funds. No real money is involved, and no real trades are executed on live markets.' },
      { q: 'How do I install the app?', a: 'On iOS: tap the Share icon in Safari, then "Add to Home Screen". On Android/Desktop: tap the install button that appears in your browser.' },
    ],
  },
  {
    category: 'Trading',
    items: [
      { q: 'What assets can I trade?', a: 'HKFES offers FX pairs (EUR/USD, GBP/USD, etc.), cryptocurrencies (BTC, ETH, SOL, XRP), US equities (AAPL, TSLA, AMZN, MSFT, NVDA), and indices (SPX500, NAS100).' },
      { q: 'What order types are available?', a: 'You can place Market orders (filled immediately), Limit orders (filled when price reaches your level), and Stop orders. You can also attach Stop-Loss and Take-Profit to any position.' },
      { q: 'What is a spread?', a: 'The spread is the difference between the buy (ask) price and the sell (bid) price. It represents the cost of entering a trade and varies by asset.' },
      { q: 'What is leverage?', a: 'Leverage allows you to control a larger position with a smaller amount of capital. Higher leverage amplifies both gains and losses.' },
    ],
  },
  {
    category: 'Wallet & Funds',
    items: [
      { q: 'How do I deposit funds?', a: 'Go to Wallet → Deposit. Choose a simulated deposit method (Bank Transfer, Card, or Crypto) and enter the amount. Funds appear instantly.' },
      { q: 'How do I withdraw?', a: 'Go to Wallet → Withdraw. Enter the amount and destination. Withdrawals are simulated — no real funds are transferred.' },
      { q: 'What is my available balance?', a: 'Your available balance is your total balance minus any funds reserved in open trades, active bots, or earn products.' },
    ],
  },
  {
    category: 'Services',
    items: [
      { q: 'What are Services?', a: 'Services are automated trading and earning products — including Bot Strategies, Copy Trading, Earn products, and more. Each runs on simulated data.' },
      { q: 'How does Copy Trading work?', a: 'You select a signal provider and allocate funds. Their future trades are automatically mirrored in your account proportionally to your allocation.' },
      { q: 'What is a Grid Bot?', a: 'A grid bot places buy and sell orders at regular price intervals. It profits when price oscillates within the configured range.' },
    ],
  },
  {
    category: 'Technical Issues',
    items: [
      { q: 'The app is offline — what can I do?', a: 'HKFES requires an internet connection for live price data. Your most recent portfolio data is cached and will display while offline.' },
      { q: 'Push notifications are not working on iPhone', a: 'Web Push notifications require iOS 16.4+ and the app must be installed via Add to Home Screen. In Safari browser mode, push notifications are not available on iOS.' },
      { q: 'How do I clear my data?', a: 'Go to Settings → App → Clear Cache. This resets locally cached data. Your account data is stored securely on our servers.' },
    ],
  },
];

// ─── Seed portfolio history ───────────────────────────────────

export function generatePortfolioHistory(startBalance = 10000, days = 30) {
  const points: { time: string; value: number }[] = [];
  let value = startBalance;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const drift = 1 + (Math.random() - 0.44) * 0.025; // slight upward bias
    value = Math.max(value * drift, startBalance * 0.7);
    points.push({
      time: new Date(now - i * 86400000).toISOString().slice(0, 10),
      value: parseFloat(value.toFixed(2)),
    });
  }
  return points;
}
