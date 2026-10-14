// HKFES Market Hours & Institutional Trading Sessions Utility
// Accurately models global trading sessions based on Eastern Standard Time (EST / UTC-5)

export type MarketSession = 'regular' | 'pre_market' | 'after_hours' | 'closed';

export interface MarketStatus {
  isOpen: boolean;
  session: MarketSession;
  label: string;
  subLabel: string;
  nextEvent: string;
}

export function getUSMarketStatus(date = new Date()): MarketStatus {
  // Convert current time to US Eastern Time (UTC-5 or UTC-4 during daylight savings)
  const estString = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const estDate = new Date(estString);
  const day = estDate.getDay(); // 0 = Sun, 6 = Sat
  const hours = estDate.getHours();
  const minutes = estDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const PRE_MARKET_START = 4 * 60;       // 04:00 EST
  const REGULAR_START = 9 * 60 + 30;     // 09:30 EST
  const REGULAR_END = 16 * 60;           // 16:00 EST
  const AFTER_HOURS_END = 20 * 60;       // 20:00 EST

  // Weekend
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      session: 'closed',
      label: 'US MARKETS CLOSED',
      subLabel: 'Weekend • Opens Monday 09:30 EST',
      nextEvent: 'Opens Mon 09:30 EST',
    };
  }

  // Weekdays
  if (timeInMinutes >= REGULAR_START && timeInMinutes < REGULAR_END) {
    return {
      isOpen: true,
      session: 'regular',
      label: 'US REGULAR SESSION',
      subLabel: 'NYSE / NASDAQ Live • Closes 16:00 EST',
      nextEvent: 'Closes 16:00 EST',
    };
  }

  if (timeInMinutes >= PRE_MARKET_START && timeInMinutes < REGULAR_START) {
    return {
      isOpen: true,
      session: 'pre_market',
      label: 'US PRE-MARKET',
      subLabel: 'Early Session • Regular Opens 09:30 EST',
      nextEvent: 'Regular Opens 09:30 EST',
    };
  }

  if (timeInMinutes >= REGULAR_END && timeInMinutes < AFTER_HOURS_END) {
    return {
      isOpen: true,
      session: 'after_hours',
      label: 'US AFTER-HOURS',
      subLabel: 'Extended Trading • Closes 20:00 EST',
      nextEvent: 'Closes 20:00 EST',
    };
  }

  // Overnight closed
  return {
    isOpen: false,
    session: 'closed',
    label: 'US MARKETS CLOSED',
    subLabel: 'Overnight • Pre-Market Opens 04:00 EST',
    nextEvent: 'Pre-Market Opens 04:00 EST',
  };
}

export function getAssetMarketStatus(assetClass: string): { label: string; isOpen: boolean } {
  if (assetClass === 'crypto') {
    return { label: '24/7 Global Crypto Feed • Live', isOpen: true };
  }

  if (assetClass === 'commodity' || assetClass === 'fx') {
    const estDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = estDate.getDay();
    const hours = estDate.getHours();
    // Forex & Commodities closed from Friday 17:00 EST to Sunday 18:00 EST
    const isWeekendClosed = (day === 5 && hours >= 17) || day === 6 || (day === 0 && hours < 18);
    if (isWeekendClosed) {
      return {
        label: `${assetClass === 'commodity' ? 'Commodities' : 'Forex'} Weekend Break • Opens Sunday 18:00 EST`,
        isOpen: false,
      };
    }
    return {
      label: `${assetClass === 'commodity' ? 'Commodity Spot/Futures' : 'Forex 24/5 Interbank Stream'} • Live`,
      isOpen: true,
    };
  }

  const us = getUSMarketStatus();
  return { label: `${us.label} • ${us.subLabel}`, isOpen: us.isOpen };
}

