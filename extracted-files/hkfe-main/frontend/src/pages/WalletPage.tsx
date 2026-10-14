import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useUIStore } from '../store';
import { CryptoActivityLedger } from '../components/wallet/CryptoActivityLedger';

import {
  IconLandmark,
  IconArrowDownRight,
  IconArrowUpRight,
  IconTrade,
  IconShieldCheck,
  IconZap,
  IconRefreshCw,
  IconArrowLeftRight,
  IconPlus,
  IconDownload
} from '../components/common/Icons';
import styles from './WalletPage.module.css';

type SubwalletKey = 'available' | 'trading' | 'earn' | 'bots';

export default function WalletPage() {
  const navigate = useNavigate();
  const {
    totalBalance,
    availableBalance,
    reservedTrading,
    reservedEarn,
    reservedBots,
    reservedWithdrawal,
    transactions,
    cryptoTransactions,
    subwalletTransfer,
    fetchWallet,
    fetchTransactions,
    fetchCryptoTransactions,
    isLoading,
  } = useWalletStore();
  const { stealthMode } = useUIStore();

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    fetchCryptoTransactions();
  }, []);


  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState<SubwalletKey>('available');
  const [transferTo, setTransferTo] = useState<SubwalletKey>('trading');
  const [transferAmount, setTransferAmount] = useState('1000');
  const [transferToast, setTransferToast] = useState<string | null>(null);

  const fmtUsd = (n: number) => {
    if (stealthMode) return '$ ••••••••';
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  };

  const getSubwalletBalance = (key: SubwalletKey) => {
    switch (key) {
      case 'available': return availableBalance;
      case 'trading': return reservedTrading;
      case 'earn': return reservedEarn;
      case 'bots': return reservedBots;
    }
  };

  const getSubwalletLabel = (key: SubwalletKey) => {
    switch (key) {
      case 'available': return 'Available Cash';
      case 'trading': return 'Trading Margin';
      case 'earn': return 'Yield Vaults';
      case 'bots': return 'Bot Grids';
    }
  };

  const [transferError, setTransferError] = useState<string | null>(null);

  const handleExecuteTransfer = () => {
    setTransferError(null);
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid transfer amount.');
      return;
    }
    const fromBal = getSubwalletBalance(transferFrom);
    if (amt > fromBal) {
      setTransferError(`Insufficient balance in ${getSubwalletLabel(transferFrom)}. Available: $${fromBal.toLocaleString()}`);
      return;
    }

    const success = subwalletTransfer(transferFrom, transferTo, amt);
    if (success) {
      setTransferToast(`✓ Successfully transferred $${amt.toLocaleString()} from ${getSubwalletLabel(transferFrom)} to ${getSubwalletLabel(transferTo)}`);
      setShowTransferModal(false);
      setTimeout(() => setTransferToast(null), 4000);
    }
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) {
      setTransferToast('No transactions available to export.');
      setTimeout(() => setTransferToast(null), 3000);
      return;
    }
    let csv = 'Transaction ID,Type,Description,Amount USD,Date\n';
    transactions.forEach(t => {
      csv += `"${t.id}","${t.type}","${t.description}",${t.amount},"${t.createdAt}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hkfes-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTxIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <IconArrowDownRight size={16} color="var(--color-gain)" />;
      case 'withdrawal': return <IconArrowUpRight size={16} color="var(--color-loss)" />;
      case 'trade_pnl': return <IconTrade size={16} color="var(--brand-mint-500)" />;
      case 'earn_payout': return <IconShieldCheck size={16} color="var(--accent-gold)" />;
      case 'fee': return <IconZap size={16} color="var(--text-muted)" />;
      case 'balance_reset': return <IconRefreshCw size={16} color="var(--text-muted)" />;
      default: return <IconArrowLeftRight size={16} color="var(--brand-mint-500)" />;
    }
  };

  const txColor = (amt: number) => amt >= 0 ? 'var(--color-gain)' : 'var(--color-loss)';

  return (
    <div className={styles.page}>
      <div className={styles.walletHeader}>
        <h1 style={{ margin: 0 }}>Wallet & Cash Management</h1>
        <div className={styles.walletHeaderActions}>
          <button
            className={styles.btnDeposit}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => { fetchWallet(); fetchTransactions(); }}
            title="Refresh balances and transaction ledger"
          >
            <IconRefreshCw size={14} className={isLoading ? 'spin-anim' : ''} /> Refresh
          </button>
          <button
            className={styles.btnDeposit}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowTransferModal(true)}
          >
            <IconArrowLeftRight size={15} /> Sub-Wallet Transfer
          </button>
        </div>
      </div>


      {transferToast && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--color-gain)',
          color: 'var(--color-gain)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}>
          {transferToast}
        </div>
      )}

      {/* Main Balance Overview */}
      <div className={styles.balanceCard}>
        <div className={styles.totalBal}>
          <span>Total Net Equity</span>
          <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`}>{fmtUsd(totalBalance)}</strong>
        </div>
        <div className={styles.subBals} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <div>
            <span>Available Cash</span>
            <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`} style={{ color: 'var(--color-gain)' }}>
              {fmtUsd(availableBalance)}
            </strong>
          </div>
          <div>
            <span>In Active Trades</span>
            <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`}>{fmtUsd(reservedTrading)}</strong>
          </div>
          <div>
            <span>In Yield Vaults</span>
            <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`}>{fmtUsd(reservedEarn)}</strong>
          </div>
          <div>
            <span>In Bot Grids</span>
            <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`}>{fmtUsd(reservedBots)}</strong>
          </div>
          <div>
            <span>Pending Withdrawal</span>
            <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`} style={{ color: 'var(--brand-bot-500)' }}>
              {fmtUsd(reservedWithdrawal)}
            </strong>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnDeposit} onClick={() => navigate('/wallet/deposit')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPlus size={15} /> Deposit Crypto (BTC / USDT)
          </button>
          <button className={styles.btnWithdraw} onClick={() => navigate('/wallet/withdraw')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconArrowUpRight size={15} /> Withdraw Crypto
          </button>
          <button
            className={styles.btnDeposit}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowTransferModal(true)}
          >
            <IconArrowLeftRight size={15} /> Internal Transfers
          </button>
        </div>
      </div>

      {/* Crypto Activity Ledger */}
      <CryptoActivityLedger transactions={cryptoTransactions} stealthMode={stealthMode} />

      {/* Transaction History Section */}
      <div className={styles.txSection}>
        <div className={styles.sectionHead}>
          <h3 style={{ margin: 0 }}>Recent Activity Ledger</h3>
          <button
            onClick={handleExportCsv}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <IconDownload size={13} /> Export Ledger (CSV)
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className={styles.empty}>No transactions recorded yet.</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className={styles.txRow}>
              <div className={styles.txIcon}>{renderTxIcon(tx.type)}</div>
              <div className={styles.txInfo}>
                <strong>{tx.description}</strong>
                <span>{new Date(tx.createdAt).toLocaleString()}</span>
              </div>
              <strong className={`mono ${stealthMode ? 'stealth-blur' : ''}`} style={{ color: txColor(tx.amount) }}>
                {tx.amount > 0 ? '+' : ''}{fmtUsd(tx.amount)}
              </strong>
            </div>
          ))
        )}
      </div>

      {/* Sub-Wallet Transfer Modal */}
      {showTransferModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: 'var(--space-4)',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '460px',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-modal)',
          }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 6 }}>
              Internal Sub-Wallet Transfer
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
              Instant zero-fee transfer between your simulated trading margin, earn vaults, bot allocation, and cash wallet.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Transfer From:
                </label>
                <select
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    padding: '8px 10px',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                  }}
                  value={transferFrom}
                  onChange={e => setTransferFrom(e.target.value as SubwalletKey)}
                >
                  <option value="available">Available Cash (${availableBalance.toLocaleString()})</option>
                  <option value="trading">Trading Margin (${reservedTrading.toLocaleString()})</option>
                  <option value="earn">Yield Vaults (${reservedEarn.toLocaleString()})</option>
                  <option value="bots">Bot Grids (${reservedBots.toLocaleString()})</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Transfer To:
                </label>
                <select
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    padding: '8px 10px',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                  }}
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value as SubwalletKey)}
                >
                  <option value="trading">Trading Margin (${reservedTrading.toLocaleString()})</option>
                  <option value="available">Available Cash (${availableBalance.toLocaleString()})</option>
                  <option value="earn">Yield Vaults (${reservedEarn.toLocaleString()})</option>
                  <option value="bots">Bot Grids (${reservedBots.toLocaleString()})</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
                Amount to Transfer (USD):
              </label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  fontSize: '16px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {[0.25, 0.5, 0.75, 1.0].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    style={{
                      flex: 1,
                      minHeight: '38px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const maxBal = getSubwalletBalance(transferFrom);
                      setTransferAmount(String(Math.floor(maxBal * pct)));
                    }}
                  >
                    {pct * 100}%
                  </button>
                ))}
              </div>
              {transferError && (
                <div style={{ color: 'var(--color-loss)', fontSize: '11px', marginTop: 8 }}>
                  {transferError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-muted)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
                onClick={() => setShowTransferModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  background: 'var(--brand-mint-500)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px var(--brand-glow)'
                }}
                onClick={handleExecuteTransfer}
              >
                Execute Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}