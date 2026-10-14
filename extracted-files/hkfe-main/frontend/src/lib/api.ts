// HKFES Full-Stack API Client
// Connects to Node.js / Express backend with automatic fallback to local simulation

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? (window.location.port === '5173'
        ? `${window.location.origin}/api/v1`
        : (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? `${window.location.origin}/api/v1`
            : 'http://localhost:4000/api/v1'))
    : 'http://localhost:4000/api/v1');

export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined'
    ? (window.location.port === '5173'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/prices`
        : (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/prices`
            : 'ws://localhost:4000/ws/prices'))
    : 'ws://localhost:4000/ws/prices');

const readStoredToken = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  const direct = localStorage.getItem('hkfes_token');
  if (direct) return direct;
  try {
    const authData = localStorage.getItem('hkfes-auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed?.state?.token || null;
    }
  } catch {}
  return null;
};

let authToken: string | null = readStoredToken();

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('hkfes_token', token);
    } else {
      localStorage.removeItem('hkfes_token');
    }
  }
};

export const getAuthToken = (): string | null => {
  if (authToken) return authToken;
  authToken = readStoredToken();
  return authToken;
};


export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  paymentsEnabled?: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  [key: string]: any;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    console.log(`[API] Requesting: ${url}`);
    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    console.log(`[API] Response:`, json);
    return json as ApiResponse<T>;
  } catch (err: any) {
    console.error(`[API] Error:`, err);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Failed to communicate with HKFES backend server.',
      },
    };
  }
}

// API Methods
export const api = {
  // Auth
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  verifyMfa: (data: { email: string; code: string }) =>
    apiRequest('/auth/mfa/verify', { method: 'POST', body: JSON.stringify(data) }),

  setupMfa: () => apiRequest('/auth/mfa/setup', { method: 'POST' }),

  confirmMfa: (code: string) =>
    apiRequest('/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }) }),

  disableMfa: (code?: string) =>
    apiRequest('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }),

  forgotPassword: (email: string, method: 'email' | 'admin' = 'email') =>
    apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email, method }) }),

  resetPassword: (token: string, newPassword: string) =>
    apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),

  refreshToken: () =>
    apiRequest('/auth/refresh', { method: 'POST' }),

  sendEmailVerification: () =>
    apiRequest('/auth/send-verification', { method: 'POST' }),

  verifyEmail: (code: string) =>
    apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ code }) }),

  // OTP endpoints (new email-based OTP system)
  sendOtp: (email: string, purpose: string = 'verification') =>
    apiRequest('/auth/otp/send', { method: 'POST', body: JSON.stringify({ email, purpose }) }),

  verifyOtp: (email: string, code: string, purpose: string = 'verification') =>
    apiRequest('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email, code, purpose }) }),

  logout: () => apiRequest('/auth/logout', { method: 'POST' }),

  // User & KYC
  getMe: () => apiRequest('/users/me'),
  updateProfile: (data: { firstName?: string; lastName?: string; phoneNumber?: string }) =>
    apiRequest('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getKycStatus: () => apiRequest('/kyc/status'),
  submitKycStep1: (data: any) =>
    apiRequest('/kyc/personal-details', { method: 'POST', body: JSON.stringify(data) }),
  submitKycStep2: (data: any) =>
    apiRequest('/kyc/address', { method: 'POST', body: JSON.stringify(data) }),
  submitKycStep3: (data: any) =>
    apiRequest('/kyc/document', { method: 'POST', body: JSON.stringify(data) }),

  // Support Helpdesk (User)
  createSupportTicket: (data: { category: string; subject: string; message: string; priority?: string; contactChannel?: string; contactHandle?: string }) =>
    apiRequest('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getSupportTickets: () =>
    apiRequest('/support/tickets'),
  getSupportTicket: (id: string) =>
    apiRequest(`/support/tickets/${id}`),
  replySupportTicket: (id: string, body: string) =>
    apiRequest(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),

  // Wallet
  getWallet: () => apiRequest('/wallet'),
  deposit: (amount: number, method: string) =>
    apiRequest('/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount, method }) }),
  withdraw: (amount: number, destination: string, method: string) =>
    apiRequest('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount, destination, method }) }),
  transferSubwallet: (from: string, to: string, amount: number) =>
    apiRequest('/wallet/transfer', { method: 'POST', body: JSON.stringify({ from, to, amount }) }),
  getTransactions: (page = 1, limit = 20) =>
    apiRequest(`/wallet/transactions?page=${page}&limit=${limit}`),


  // Market & Trading
  getAssets: () => apiRequest('/market/assets'),
  getCandles: (symbol: string, timeframe = '1m', limit = 100) =>
    apiRequest(`/market/assets/${encodeURIComponent(symbol)}/candles?timeframe=${timeframe}&limit=${limit}`),
  getOrderbook: (symbol: string) =>
    apiRequest(`/market/assets/${encodeURIComponent(symbol)}/orderbook`),
  placeOrder: (order: any) =>
    apiRequest('/trading/orders', { method: 'POST', body: JSON.stringify(order) }),
  getPositions: () => apiRequest('/trading/positions'),
  closePosition: (positionId: string, percentage = 100) =>
    apiRequest(`/trading/positions/${positionId}/close`, { method: 'POST', body: JSON.stringify({ percentage }) }),
  getTradeHistory: () => apiRequest('/trading/history'),
  placeOptionOrder: (data: {
    symbol: string;
    direction: 'call' | 'put' | 'buy' | 'sell';
    durationSeconds: number;
    amount: number;
    payoutRate?: number;
  }) => apiRequest('/trading/options/order', { method: 'POST', body: JSON.stringify(data) }),
  settleOptionOrder: (contractId: string, exitPrice?: number) =>
    apiRequest(`/trading/options/${contractId}/settle`, { method: 'POST', body: JSON.stringify({ contractId, exitPrice }) }),
  getActiveOptions: () => apiRequest('/trading/options/active'),

  // Portfolio
  getPortfolioSummary: () => apiRequest('/portfolio/summary'),
  getPortfolioPerformance: (period = '1M') => apiRequest(`/portfolio/performance?period=${period}`),
  getPortfolioAllocation: () => apiRequest('/portfolio/allocation'),

  // Services
  getServices: () => apiRequest('/services'),
  subscribeService: (serviceId: string, allocatedUsd: number, config?: any) =>
    apiRequest(`/services/${serviceId}/subscribe`, { method: 'POST', body: JSON.stringify({ allocatedUsd, config }) }),
  getUserSubscriptions: () => apiRequest('/subscriptions/user/active'),
  stopSubscription: (subId: string) => apiRequest(`/subscriptions/user/${subId}`, { method: 'DELETE' }),

  // Admin & Super Admin
  getAdminStats: () => apiRequest('/admin/stats'),
  getAdminUsers: (search = '', page = 1, limit = 50) =>
    apiRequest(`/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`),
  getAdminUser: (userId: string) =>
    apiRequest(`/admin/users/${userId}`),
  adminUpdateUser: (userId: string, data: {
    role?: string;
    status?: string;
    kycStatus?: string;
    tradingBlocked?: boolean;
    withdrawalsBlocked?: boolean;
    depositsBlocked?: boolean;
  }) =>
    apiRequest(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminSetPassword: (userId: string, newPassword: string) =>
    apiRequest(`/admin/users/${userId}/set-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  adminGeneratePassword: (userId: string) =>
    apiRequest(`/admin/users/${userId}/generate-password`, { method: 'POST', body: JSON.stringify({}) }),
  adminResetBalance: (userId: string, newBalance = 10000, reason?: string) =>
    apiRequest(`/admin/users/${userId}/reset-balance`, { method: 'POST', body: JSON.stringify({ newBalance, reason }) }),
  adminBulkResetBalance: () =>
    apiRequest('/admin/users/bulk-reset-balance', { method: 'POST' }),
  adminSpike: (symbol?: string, magnitudePercent = 5, direction = 'random') =>
    apiRequest('/admin/engine/spike', { method: 'POST', body: JSON.stringify({ symbol, magnitudePercent, direction }) }),
  adminPauseFeed: () => apiRequest('/admin/engine/pause', { method: 'POST' }),
  adminResumeFeed: () => apiRequest('/admin/engine/resume', { method: 'POST' }),
  adminResetPrices: () => apiRequest('/admin/engine/reset-prices', { method: 'POST' }),
  adminLiveSync: () => apiRequest('/admin/engine/live-sync', { method: 'POST' }),
  adminGetAuditLogs: (page = 1, limit = 50) =>
    apiRequest(`/admin/audit-logs?page=${page}&limit=${limit}`),
  adminGetReports: (format = 'json') =>
    apiRequest(`/admin/reports/generate?format=${format}`),
  adminGetKycQueue: (status = 'all') =>
    apiRequest(`/admin/kyc/queue?status=${encodeURIComponent(status)}`),
  adminReviewKyc: (userId: string, decision: 'approved' | 'rejected', notes?: string) =>
    apiRequest(`/admin/kyc/${userId}/review`, { method: 'POST', body: JSON.stringify({ decision, notes }) }),
  adminGetSupportStats: () =>
    apiRequest('/support/admin/stats'),
  adminGetSupportTickets: (status = 'all', search = '') =>
    apiRequest(`/support/admin/tickets?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  adminGetSupportTicket: (id: string) =>
    apiRequest(`/support/admin/tickets/${id}`),
  adminReplySupportTicket: (id: string, body: string, isInternal = false) =>
    apiRequest(`/support/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ body, isInternal }) }),
  adminUpdateSupportTicket: (id: string, data: { status?: string; priority?: string; assignToMe?: boolean }) =>
    apiRequest(`/support/admin/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Crypto Payment Desk (Manual Custodial)
  getCryptoDepositWallets: () =>
    apiRequest('/crypto/deposit-wallets'),
  startCryptoDeposit: (data: { amount: number; paymentName: string }) =>
    apiRequest('/crypto/deposits/intent', { method: 'POST', body: JSON.stringify(data) }),
  selectCryptoDepositMethod: (id: string, walletId: string) =>
    apiRequest(`/crypto/deposits/${id}/method`, { method: 'PATCH', body: JSON.stringify({ walletId }) }),
  submitCryptoDepositClaim: (data: { asset: string; network: string; amount: number; txHash: string; proofImageUrl?: string; claimId?: string; contactEmail?: string }) =>
    apiRequest('/crypto/deposits/claim', { method: 'POST', body: JSON.stringify(data) }),
  requestCryptoWithdrawal: (data: { asset: string; network: string; amount: number; destinationAddress: string }) =>
    apiRequest('/crypto/withdrawals/request', { method: 'POST', body: JSON.stringify(data) }),
  getCryptoTransactions: () =>
    apiRequest('/crypto/transactions'),
  getAdminCryptoDeposits: () =>
    apiRequest('/crypto/admin/deposits'),
  approveCryptoDeposit: (id: string, creditAmount?: number, notes?: string) =>
    apiRequest(`/crypto/admin/deposits/${id}/approve`, { method: 'POST', body: JSON.stringify({ creditAmount, notes }) }),
  rejectCryptoDeposit: (id: string, reason: string, notes?: string) =>
    apiRequest(`/crypto/admin/deposits/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason, notes }) }),
  getAdminCryptoWithdrawals: () =>
    apiRequest('/crypto/admin/withdrawals'),
  approveCryptoWithdrawal: (id: string, txHash: string, notes?: string) =>
    apiRequest(`/crypto/admin/withdrawals/${id}/approve`, { method: 'POST', body: JSON.stringify({ txHash, notes }) }),
  rejectCryptoWithdrawal: (id: string, reason: string, notes?: string) =>
    apiRequest(`/crypto/admin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason, notes }) }),

  // Platform Configuration & Super Admin Controls
  getPlatformConfig: () =>
    apiRequest('/platform/config'),
  getAdminPlatformSettings: () =>
    apiRequest('/platform/admin/settings'),
  updateAdminPlatformSettings: (data: {
    paymentsEnabled?: boolean;
    telegramEnabled?: boolean;
    telegramHandle?: string;
    telegramNumber?: string;
    telegramUrl?: string;
  }) =>
    apiRequest('/platform/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getAdminDepositWallets: () =>
    apiRequest('/platform/admin/deposit-wallets'),
  createAdminDepositWallet: (data: {
    asset: string;
    network: string;
    address: string;
    memoOrTag?: string;
    qrCodeUrl?: string;
    minDeposit?: number;
    details?: string;
    isActive?: boolean;
  }) =>
    apiRequest('/platform/admin/deposit-wallets', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminDepositWallet: (
    id: string,
    data: {
      asset?: string;
      network?: string;
      address?: string;
      memoOrTag?: string;
      qrCodeUrl?: string;
      minDeposit?: number;
      details?: string;
      isActive?: boolean;
    }
  ) =>
    apiRequest(`/platform/admin/deposit-wallets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleAdminDepositWallet: (id: string) =>
    apiRequest(`/platform/admin/deposit-wallets/${id}/toggle`, { method: 'PATCH' }),
  deleteAdminDepositWallet: (id: string) =>
    apiRequest(`/platform/admin/deposit-wallets/${id}`, { method: 'DELETE' }),
};


