import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding comprehensive HKFES database...');

  // 1. Assets
  const assetsData = [
    // ── Commodities ──
    { symbol: 'XAU/USD', displayName: 'Gold Spot / US Dollar', assetClass: 'commodity', baseCurrency: 'XAU', seedPrice: 2685.50, currentPrice: 2685.50, volatilityParam: 0.12, pipSize: 0.01 },
    { symbol: 'XAG/USD', displayName: 'Silver Spot / US Dollar', assetClass: 'commodity', baseCurrency: 'XAG', seedPrice: 31.85, currentPrice: 31.85, volatilityParam: 0.22, pipSize: 0.001 },
    { symbol: 'WTI/USD', displayName: 'Crude Oil (WTI) / US Dollar', assetClass: 'commodity', baseCurrency: 'WTI', seedPrice: 71.40, currentPrice: 71.40, volatilityParam: 0.26, pipSize: 0.01 },
    { symbol: 'BRENT/USD', displayName: 'Brent Crude Oil / US Dollar', assetClass: 'commodity', baseCurrency: 'BRENT', seedPrice: 75.20, currentPrice: 75.20, volatilityParam: 0.24, pipSize: 0.01 },
    { symbol: 'NG/USD', displayName: 'Natural Gas / US Dollar', assetClass: 'commodity', baseCurrency: 'NG', seedPrice: 2.85, currentPrice: 2.85, volatilityParam: 0.35, pipSize: 0.001 },

    // ── Crypto / Proper Coins ──
    { symbol: 'BTC/USD', displayName: 'Bitcoin / US Dollar', assetClass: 'crypto', baseCurrency: 'BTC', seedPrice: 85930.0, currentPrice: 85930.0, volatilityParam: 0.45, pipSize: 0.5 },
    { symbol: 'ETH/USD', displayName: 'Ethereum / US Dollar', assetClass: 'crypto', baseCurrency: 'ETH', seedPrice: 2715.0, currentPrice: 2715.0, volatilityParam: 0.50, pipSize: 0.1 },
    { symbol: 'SOL/USD', displayName: 'Solana / US Dollar', assetClass: 'crypto', baseCurrency: 'SOL', seedPrice: 120.60, currentPrice: 120.60, volatilityParam: 0.60, pipSize: 0.05 },
    { symbol: 'BNB/USD', displayName: 'Binance Coin / US Dollar', assetClass: 'crypto', baseCurrency: 'BNB', seedPrice: 781.90, currentPrice: 781.90, volatilityParam: 0.40, pipSize: 0.1 },
    { symbol: 'XRP/USD', displayName: 'XRP (Ripple) / US Dollar', assetClass: 'crypto', baseCurrency: 'XRP', seedPrice: 1.5040, currentPrice: 1.5040, volatilityParam: 0.55, pipSize: 0.0001 },
    { symbol: 'DOGE/USD', displayName: 'Dogecoin / US Dollar', assetClass: 'crypto', baseCurrency: 'DOGE', seedPrice: 0.0950, currentPrice: 0.0950, volatilityParam: 0.65, pipSize: 0.0001 },
    { symbol: 'ADA/USD', displayName: 'Cardano / US Dollar', assetClass: 'crypto', baseCurrency: 'ADA', seedPrice: 0.2740, currentPrice: 0.2740, volatilityParam: 0.50, pipSize: 0.0001 },
    { symbol: 'AVAX/USD', displayName: 'Avalanche / US Dollar', assetClass: 'crypto', baseCurrency: 'AVAX', seedPrice: 11.40, currentPrice: 11.40, volatilityParam: 0.58, pipSize: 0.01 },
    { symbol: 'DOT/USD', displayName: 'Polkadot / US Dollar', assetClass: 'crypto', baseCurrency: 'DOT', seedPrice: 1.237, currentPrice: 1.237, volatilityParam: 0.52, pipSize: 0.01 },
    { symbol: 'LINK/USD', displayName: 'Chainlink / US Dollar', assetClass: 'crypto', baseCurrency: 'LINK', seedPrice: 13.97, currentPrice: 13.97, volatilityParam: 0.50, pipSize: 0.01 },
    { symbol: 'NEAR/USD', displayName: 'NEAR Protocol / US Dollar', assetClass: 'crypto', baseCurrency: 'NEAR', seedPrice: 5.30, currentPrice: 5.30, volatilityParam: 0.55, pipSize: 0.01 },
    { symbol: 'SUI/USD', displayName: 'Sui Network / US Dollar', assetClass: 'crypto', baseCurrency: 'SUI', seedPrice: 1.206, currentPrice: 1.206, volatilityParam: 0.65, pipSize: 0.001 },

    // ── Equities / Top Companies ──
    { symbol: 'AAPL', displayName: 'Apple Inc.', assetClass: 'equity', baseCurrency: 'AAPL', seedPrice: 228.40, currentPrice: 228.40, volatilityParam: 0.22, pipSize: 0.01 },
    { symbol: 'NVDA', displayName: 'NVIDIA Corporation', assetClass: 'equity', baseCurrency: 'NVDA', seedPrice: 125.60, currentPrice: 125.60, volatilityParam: 0.40, pipSize: 0.01 },
    { symbol: 'MSFT', displayName: 'Microsoft Corporation', assetClass: 'equity', baseCurrency: 'MSFT', seedPrice: 432.10, currentPrice: 432.10, volatilityParam: 0.18, pipSize: 0.01 },
    { symbol: 'AMZN', displayName: 'Amazon.com, Inc.', assetClass: 'equity', baseCurrency: 'AMZN', seedPrice: 186.50, currentPrice: 186.50, volatilityParam: 0.24, pipSize: 0.01 },
    { symbol: 'GOOGL', displayName: 'Alphabet Inc. (Google)', assetClass: 'equity', baseCurrency: 'GOOGL', seedPrice: 164.80, currentPrice: 164.80, volatilityParam: 0.20, pipSize: 0.01 },
    { symbol: 'META', displayName: 'Meta Platforms Inc.', assetClass: 'equity', baseCurrency: 'META', seedPrice: 568.20, currentPrice: 568.20, volatilityParam: 0.30, pipSize: 0.01 },
    { symbol: 'TSLA', displayName: 'Tesla, Inc.', assetClass: 'equity', baseCurrency: 'TSLA', seedPrice: 245.80, currentPrice: 245.80, volatilityParam: 0.48, pipSize: 0.01 },
    { symbol: 'NFLX', displayName: 'Netflix Inc.', assetClass: 'equity', baseCurrency: 'NFLX', seedPrice: 708.50, currentPrice: 708.50, volatilityParam: 0.28, pipSize: 0.01 },
    { symbol: 'AMD', displayName: 'Advanced Micro Devices', assetClass: 'equity', baseCurrency: 'AMD', seedPrice: 156.40, currentPrice: 156.40, volatilityParam: 0.42, pipSize: 0.01 },
    { symbol: 'BABA', displayName: 'Alibaba Group', assetClass: 'equity', baseCurrency: 'BABA', seedPrice: 88.60, currentPrice: 88.60, volatilityParam: 0.35, pipSize: 0.01 },
    { symbol: 'COIN', displayName: 'Coinbase Global Inc.', assetClass: 'equity', baseCurrency: 'COIN', seedPrice: 216.50, currentPrice: 216.50, volatilityParam: 0.55, pipSize: 0.01 },
    { symbol: 'PLTR', displayName: 'Palantir Technologies', assetClass: 'equity', baseCurrency: 'PLTR', seedPrice: 38.20, currentPrice: 38.20, volatilityParam: 0.45, pipSize: 0.01 },

    // ── Forex ──
    { symbol: 'EUR/USD', displayName: 'Euro / US Dollar', assetClass: 'fx', baseCurrency: 'EUR', seedPrice: 1.0825, currentPrice: 1.0825, volatilityParam: 0.08, pipSize: 0.0001 },
    { symbol: 'GBP/USD', displayName: 'British Pound / US Dollar', assetClass: 'fx', baseCurrency: 'GBP', seedPrice: 1.2940, currentPrice: 1.2940, volatilityParam: 0.10, pipSize: 0.0001 },
    { symbol: 'USD/JPY', displayName: 'US Dollar / Japanese Yen', assetClass: 'fx', baseCurrency: 'USD', seedPrice: 154.60, currentPrice: 154.60, volatilityParam: 0.11, pipSize: 0.01 },
    { symbol: 'AUD/USD', displayName: 'Australian Dollar / US Dollar', assetClass: 'fx', baseCurrency: 'AUD', seedPrice: 0.6580, currentPrice: 0.6580, volatilityParam: 0.12, pipSize: 0.0001 },
    { symbol: 'USD/CAD', displayName: 'US Dollar / Canadian Dollar', assetClass: 'fx', baseCurrency: 'USD', seedPrice: 1.3620, currentPrice: 1.3620, volatilityParam: 0.09, pipSize: 0.0001 },
    { symbol: 'USD/CHF', displayName: 'US Dollar / Swiss Franc', assetClass: 'fx', baseCurrency: 'USD', seedPrice: 0.8840, currentPrice: 0.8840, volatilityParam: 0.08, pipSize: 0.0001 },
    { symbol: 'GBP/JPY', displayName: 'British Pound / Japanese Yen', assetClass: 'fx', baseCurrency: 'GBP', seedPrice: 189.45, currentPrice: 189.45, volatilityParam: 0.13, pipSize: 0.01 },
    { symbol: 'EUR/GBP', displayName: 'Euro / British Pound', assetClass: 'fx', baseCurrency: 'EUR', seedPrice: 0.8538, currentPrice: 0.8538, volatilityParam: 0.08, pipSize: 0.0001 },

    // ── Indices ──
    { symbol: 'SPX500', displayName: 'S&P 500 Index', assetClass: 'index', baseCurrency: 'SPX', seedPrice: 5620.0, currentPrice: 5620.0, volatilityParam: 0.14, pipSize: 0.25 },
    { symbol: 'NAS100', displayName: 'Nasdaq 100 Index', assetClass: 'index', baseCurrency: 'NDX', seedPrice: 19780.0, currentPrice: 19780.0, volatilityParam: 0.18, pipSize: 0.5 },
    { symbol: 'US30', displayName: 'Dow Jones 30 Index', assetClass: 'index', baseCurrency: 'DJI', seedPrice: 42120.0, currentPrice: 42120.0, volatilityParam: 0.14, pipSize: 1.0 },
    { symbol: 'GER40', displayName: 'DAX 40 Index', assetClass: 'index', baseCurrency: 'DAX', seedPrice: 18950.0, currentPrice: 18950.0, volatilityParam: 0.16, pipSize: 0.5 },
  ];

  for (const asset of assetsData) {
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      create: asset,
      update: asset,
    });
  }
  console.log(`✓ Seeded ${assetsData.length} market assets`);

  // 2. Strategies
  const strategiesData = [
    {
      id: 'strat-earn-5',
      name: 'USD Stable Earn (5% APY)',
      strategyType: 'earn',
      description: 'Daily yield accrual on unencumbered USD balances backed by simulated treasury yields.',
      riskLevel: 'low',
      simulatedApy: 0.05,
      assetSymbol: 'EUR/USD',
    },
    {
      id: 'strat-earn-8',
      name: 'High Yield USD Vault (8% APY)',
      strategyType: 'earn',
      description: 'Enhanced fixed-yield program with automated liquidity provisioning and monthly distribution.',
      riskLevel: 'medium',
      simulatedApy: 0.08,
      assetSymbol: 'EUR/USD',
    },
    {
      id: 'strat-grid-btc',
      name: 'Grid Bot — BTC/USD',
      strategyType: 'grid_bot',
      description: 'Automated 12-grid high-frequency market-making between $60,000 and $70,000.',
      riskLevel: 'medium',
      simulatedApy: 0.185,
      assetSymbol: 'BTC/USD',
      configSchema: JSON.stringify({ lowerBound: 60000, upperBound: 70000, grids: 12 }),
    },
    {
      id: 'strat-dca-eth',
      name: 'Smart DCA — ETH/USD',
      strategyType: 'dca_bot',
      description: 'Algorithmic dollar-cost averaging every 6 hours with RSI dip-detection weighting.',
      riskLevel: 'medium',
      simulatedApy: 0.22,
      assetSymbol: 'ETH/USD',
      configSchema: JSON.stringify({ intervalHours: 6, dipThresholdPercent: 2 }),
    },
    {
      id: 'strat-copy-alpha',
      name: 'Alpha Quant FX Copy',
      strategyType: 'copy_trade',
      description: 'Mirrors real-time algorithmic trades from our institutional systematic FX models.',
      riskLevel: 'high',
      simulatedApy: 0.31,
      assetSymbol: 'EUR/USD',
    },
    {
      id: 'strat-arb-crypto',
      name: 'Simulated Triangular Arbitrage',
      strategyType: 'arbitrage',
      description: 'Exploits micro-spread price discrepancies between BTC, ETH, and USD synthetic order books.',
      riskLevel: 'low',
      simulatedApy: 0.14,
      assetSymbol: 'BTC/USD',
    },
  ];

  for (const strat of strategiesData) {
    await prisma.strategy.upsert({
      where: { id: strat.id },
      create: strat,
      update: strat,
    });
  }
  console.log(`✓ Seeded ${strategiesData.length} strategies`);

  // 3. User Credentials Hashes
  const userPasswordHash = await bcrypt.hash('Password123!', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin123!', 10);

  // ── USER 1: Super Admin (Root Platform Operator) ──
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@hkfes.com' },
    create: {
      email: 'superadmin@hkfes.com',
      passwordHash: superAdminPasswordHash,
      firstName: 'Chief',
      lastName: 'Admin',
      role: 'super_admin',
      status: 'active',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 250000.0,
          availableBalance: 250000.0,
          currency: 'USD',
        },
      },
    },
    update: {
      passwordHash: superAdminPasswordHash,
      firstName: 'Chief',
      lastName: 'Admin',
      role: 'super_admin',
      status: 'active',
      kycStatus: 'approved',
    },
    include: { wallet: true },
  });

  // ── USER 2: Admin Sam (Risk & Compliance Officer) ──
  const adminSam = await prisma.user.upsert({
    where: { email: 'admin@hkfes.com' },
    create: {
      email: 'admin@hkfes.com',
      passwordHash: adminPasswordHash,
      firstName: 'Sam',
      lastName: 'Vance',
      role: 'admin',
      status: 'active',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 50000.0,
          availableBalance: 50000.0,
          currency: 'USD',
        },
      },
    },
    update: {
      passwordHash: adminPasswordHash,
      firstName: 'Sam',
      lastName: 'Vance',
      role: 'admin',
      status: 'active',
      kycStatus: 'approved',
    },
    include: { wallet: true },
  });

  // ── USER 3: Trader Alex (Active Retail FX / Crypto Day Trader) ──
  const alex = await prisma.user.upsert({
    where: { email: 'alex@hkfes.com' },
    create: {
      email: 'alex@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Alex',
      lastName: 'Chen',
      phoneNumber: '+1 (555) 234-5678',
      role: 'user',
      status: 'active',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 10450.0,
          availableBalance: 7950.0,
          reservedTrading: 2500.0,
          currency: 'USD',
        },
      },
      kycRecord: {
        create: {
          addressLine1: '100 Wall Street, Apt 14B',
          city: 'New York',
          state: 'NY',
          zipCode: '10005',
          country: 'US',
          documentType: 'passport',
          documentRef: 'sample-passport-alex.jpg',
          submittedAt: new Date(Date.now() - 86400000 * 30),
          reviewedAt: new Date(Date.now() - 86400000 * 29),
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  // ── USER 4: Quant Maya (Algorithmic Trading Bot Deployer) ──
  const maya = await prisma.user.upsert({
    where: { email: 'maya@hkfes.com' },
    create: {
      email: 'maya@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Maya',
      lastName: 'Lin',
      phoneNumber: '+1 (555) 345-6789',
      role: 'user',
      status: 'active',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 25000.0,
          availableBalance: 15000.0,
          reservedBots: 10000.0,
          currency: 'USD',
        },
      },
      kycRecord: {
        create: {
          addressLine1: '50 California Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94111',
          country: 'US',
          documentType: 'drivers_license',
          documentRef: 'sample-license-maya.jpg',
          submittedAt: new Date(Date.now() - 86400000 * 20),
          reviewedAt: new Date(Date.now() - 86400000 * 19),
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  // ── USER 5: Investor Jordan (Passive Yield & Copy Trading) ──
  const jordan = await prisma.user.upsert({
    where: { email: 'jordan@hkfes.com' },
    create: {
      email: 'jordan@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Jordan',
      lastName: 'Taylor',
      phoneNumber: '+1 (555) 456-7890',
      role: 'user',
      status: 'active',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 12500.0,
          availableBalance: 4500.0,
          reservedEarn: 8000.0,
          currency: 'USD',
        },
      },
      kycRecord: {
        create: {
          addressLine1: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62704',
          country: 'US',
          documentType: 'national_id',
          documentRef: 'sample-id-jordan.jpg',
          submittedAt: new Date(Date.now() - 86400000 * 15),
          reviewedAt: new Date(Date.now() - 86400000 * 14),
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  // ── USER 6: VIP Elena (Institutional Multi-Asset Portfolio Trader) ──
  const elena = await prisma.user.upsert({
    where: { email: 'elena@hkfes.com' },
    create: {
      email: 'elena@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Elena',
      lastName: 'Rostova',
      phoneNumber: '+1 (555) 567-8901',
      role: 'user',
      status: 'active',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 100000.0,
          availableBalance: 60000.0,
          reservedTrading: 25000.0,
          reservedEarn: 15000.0,
          currency: 'USD',
        },
      },
      kycRecord: {
        create: {
          addressLine1: '888 Brickell Avenue, Suite 3000',
          city: 'Miami',
          state: 'FL',
          zipCode: '33131',
          country: 'US',
          documentType: 'passport',
          documentRef: 'sample-passport-elena.jpg',
          submittedAt: new Date(Date.now() - 86400000 * 10),
          reviewedAt: new Date(Date.now() - 86400000 * 9),
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  // ── USER 7: Lucas Wright (New Onboarding User — KYC Pending Review) ──
  const lucas = await prisma.user.upsert({
    where: { email: 'lucas@hkfes.com' },
    create: {
      email: 'lucas@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Lucas',
      lastName: 'Wright',
      role: 'user',
      status: 'active',
      kycStatus: 'pending',
      wallet: {
        create: {
          totalBalance: 10000.0,
          availableBalance: 10000.0,
          currency: 'USD',
        },
      },
      kycRecord: {
        create: {
          addressLine1: '12 Austin Parkway',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          country: 'US',
          documentType: 'drivers_license',
          documentRef: 'sample-license-lucas.jpg',
          submittedAt: new Date(Date.now() - 3600000 * 2), // Submitted 2 hours ago
          notes: 'Awaiting admin document review',
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  // ── USER 8: Sarah Connor (KYC Rejected User — Blurred Document) ──
  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@hkfes.com' },
    create: {
      email: 'sarah@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Sarah',
      lastName: 'Connor',
      role: 'user',
      status: 'active',
      kycStatus: 'rejected',
      wallet: {
        create: {
          totalBalance: 10000.0,
          availableBalance: 10000.0,
          currency: 'USD',
        },
      },
      kycRecord: {
        create: {
          addressLine1: '304 Cyberdyne Way',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'US',
          documentType: 'passport',
          documentRef: 'sample-passport-blurred.jpg',
          submittedAt: new Date(Date.now() - 86400000 * 3),
          reviewedAt: new Date(Date.now() - 86400000 * 2),
          notes: 'Document image blurry and illegible. Please re-upload a clear government ID.',
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  // ── USER 9: Victor Vance (Suspended Account — Compliance Hold) ──
  const victor = await prisma.user.upsert({
    where: { email: 'victor@hkfes.com' },
    create: {
      email: 'victor@hkfes.com',
      passwordHash: userPasswordHash,
      firstName: 'Victor',
      lastName: 'Vance',
      role: 'user',
      status: 'suspended',
      kycStatus: 'approved',
      wallet: {
        create: {
          totalBalance: 5000.0,
          availableBalance: 5000.0,
          currency: 'USD',
        },
      },
    },
    update: {},
    include: { wallet: true },
  });

  console.log('✓ Seeded 9 realistic demo users across all roles & personas');

  // 4. Populate Active Strategy Subscriptions
  // Maya: Active Grid Bot & DCA Bot
  await prisma.strategySubscription.upsert({
    where: { id: 'sub-maya-grid' },
    create: {
      id: 'sub-maya-grid',
      userId: maya.id,
      strategyId: 'strat-grid-btc',
      status: 'active',
      allocatedUsd: 6000.0,
      totalPnl: 342.50,
      accruedYield: 0.0,
      config: JSON.stringify({ lowerBound: 61000, upperBound: 68000, grids: 10 }),
    },
    update: {},
  });

  await prisma.strategySubscription.upsert({
    where: { id: 'sub-maya-dca' },
    create: {
      id: 'sub-maya-dca',
      userId: maya.id,
      strategyId: 'strat-dca-eth',
      status: 'active',
      allocatedUsd: 4000.0,
      totalPnl: 185.20,
      accruedYield: 0.0,
      config: JSON.stringify({ intervalHours: 6, dipThresholdPercent: 2.5 }),
    },
    update: {},
  });

  // Jordan: Active 8% High Yield Vault
  await prisma.strategySubscription.upsert({
    where: { id: 'sub-jordan-earn' },
    create: {
      id: 'sub-jordan-earn',
      userId: jordan.id,
      strategyId: 'strat-earn-8',
      status: 'active',
      allocatedUsd: 8000.0,
      totalPnl: 0.0,
      accruedYield: 142.88,
      nextAccrualAt: new Date(Date.now() + 86400000),
    },
    update: {},
  });

  // Elena: Copy Trading
  await prisma.strategySubscription.upsert({
    where: { id: 'sub-elena-copy' },
    create: {
      id: 'sub-elena-copy',
      userId: elena.id,
      strategyId: 'strat-copy-alpha',
      status: 'active',
      allocatedUsd: 15000.0,
      totalPnl: 890.40,
      accruedYield: 0.0,
    },
    update: {},
  });

  console.log('✓ Seeded active strategy subscriptions for Maya, Jordan, and Elena');

  // 5. Populate Realistic Open and Closed Trades
  // Clean existing trades for idempotency
  await prisma.trade.deleteMany({
    where: {
      userId: { in: [alex.id, elena.id, maya.id] }
    }
  });

  // Alex's Trades
  await prisma.trade.create({
    data: {
      userId: alex.id,
      assetSymbol: 'EUR/USD',
      direction: 'buy',
      orderType: 'market',
      status: 'open',
      sizeUsd: 1500.0,
      units: 1385.68,
      entryPrice: 1.0825,
      openedAt: new Date(Date.now() - 3600000 * 6),
    },
  });

  await prisma.trade.create({
    data: {
      userId: alex.id,
      assetSymbol: 'BTC/USD',
      direction: 'buy',
      orderType: 'market',
      status: 'open',
      sizeUsd: 1000.0,
      units: 0.0157,
      entryPrice: 63700.0,
      openedAt: new Date(Date.now() - 3600000 * 3),
    },
  });

  await prisma.trade.create({
    data: {
      userId: alex.id,
      assetSymbol: 'AAPL',
      direction: 'buy',
      orderType: 'market',
      status: 'closed',
      sizeUsd: 2000.0,
      units: 8.92,
      entryPrice: 224.2,
      exitPrice: 228.4,
      realizedPnl: 37.46,
      openedAt: new Date(Date.now() - 86400000 * 2),
      closedAt: new Date(Date.now() - 86400000),
    },
  });

  // Elena's Institutional Trades
  await prisma.trade.create({
    data: {
      userId: elena.id,
      assetSymbol: 'SPX500',
      direction: 'buy',
      orderType: 'market',
      status: 'open',
      sizeUsd: 15000.0,
      units: 2.67,
      entryPrice: 5618.0,
      openedAt: new Date(Date.now() - 3600000 * 12),
    },
  });

  await prisma.trade.create({
    data: {
      userId: elena.id,
      assetSymbol: 'NVDA',
      direction: 'buy',
      orderType: 'market',
      status: 'open',
      sizeUsd: 10000.0,
      units: 80.64,
      entryPrice: 124.0,
      openedAt: new Date(Date.now() - 3600000 * 8),
    },
  });

  console.log('✓ Seeded open and historical trades');

  // 6. Audit Logs
  await prisma.auditLog.create({
    data: {
      eventType: 'SYSTEM_DATABASE_COMPREHENSIVE_SEEDED',
      actorId: adminSam.id,
      actorRole: 'admin',
      metadata: JSON.stringify({
        totalUsers: 9,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // 7. Official Custodial Platform Deposit Wallets (Binance)
  const depositWalletsData = [
    {
      asset: 'BTC',
      network: 'Bitcoin',
      address: '12creiPyw9Xuc7Jr6UXxHe7t92jVTpPi2w',
      qrCodeUrl: '/wallets/btc-qr.jpg',
      minDeposit: 0.0005,
      confirmationsNeeded: 1,
      details: "Deposit BTC to Binance. Network: Bitcoin. Don't send NFTs to this address. Smart contract deposits are not supported with the exception of ETH via ERC20, BSC via BEP20, Arbitrum and Optimism networks.",
      isActive: true,
    },
    {
      asset: 'USDC',
      network: 'Ethereum (ERC20)',
      address: '0xe11abcb9acc3655857ab9c3c07cac1a26d009329',
      qrCodeUrl: '/wallets/usdc-qr.jpg',
      minDeposit: 10.0,
      confirmationsNeeded: 6,
      details: "Deposit USDC to Binance. Network: Ethereum (ERC20). Don't send NFTs to this address.",
      isActive: true,
    },
    {
      asset: 'USDT',
      network: 'Tron (TRC20)',
      address: 'TEETqxCvQ7eGKP4Qrj81vhgcZb7Cfxnp1i',
      qrCodeUrl: '/wallets/usdt-qr.jpg',
      minDeposit: 10.0,
      confirmationsNeeded: 1,
      details: "Deposit USDT to Binance. Network: Tron (TRC20). Don't send NFTs to this address. Smart contract deposits are not supported with the exception of ETH via ERC20, BSC via BEP20, Arbitrum and Optimism networks.",
      isActive: true,
    },
  ];

  for (const w of depositWalletsData) {
    await prisma.platformDepositWallet.upsert({
      where: { address: w.address },
      update: w,
      create: w,
    });
  }
  console.log(`✓ Seeded ${depositWalletsData.length} official Binance deposit custody wallets`);

  // 8. Platform Config
  await prisma.platformConfig.upsert({
    where: { id: 'default' },
    update: { paymentsEnabled: true },
    create: { id: 'default', paymentsEnabled: true },
  });
  console.log('✓ Seeded platform settings with active payments');

  console.log('🎉 Comprehensive database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
