import React, { useState } from 'react';
import { CryptoStatusBadge } from '../common/CryptoStatusBadge';
import {
  IconSearch,
  IconArrowDownRight,
  IconArrowUpRight,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconX,
  IconDownload,
} from '../common/Icons';
import { downloadReceiptImage } from '../../lib/receiptImage';
import styles from './CryptoActivityLedger.module.css';

export interface CryptoLedgerItem {
  id: string;
  type: 'deposit' | 'withdrawal' | string;
  asset: 'USDT' | 'BTC' | string;
  network: string;
  amount: number;
  amountUsd?: number;
  feeAmount?: number;
  netAmount?: number;
  txHash?: string;
  toAddress?: string;
  status: string;
  rejectionReason?: string;
  internalNotes?: string;
  createdAt: string;
  completedAt?: string;
  proofImageUrl?: string;
}

interface Props {
  transactions: CryptoLedgerItem[];
  stealthMode?: boolean;
}

export const CryptoActivityLedger: React.FC<Props> = ({ transactions, stealthMode }) => {
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<CryptoLedgerItem | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const getExplorerUrl = (hash: string, network: string) => {
    if (!hash) return '#';
    if (network?.includes('TRC20')) return `https://tronscan.org/#/transaction/${hash}`;
    if (network?.includes('ERC20')) return `https://etherscan.io/tx/${hash}`;
    if (network?.includes('BEP20')) return `https://bscscan.com/tx/${hash}`;
    if (network?.includes('BTC')) return `https://mempool.space/tx/${hash}`;
    return `https://blockchair.com/search?q=${hash}`;
  };

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.asset.toLowerCase().includes(q) ||
        t.network.toLowerCase().includes(q) ||
        (t.txHash && t.txHash.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const fmtUsd = (val: number) => {
    if (stealthMode) return '$ ••••••••';
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const saveScreenshot = (tx: CryptoLedgerItem) => {
    const kind = tx.type === 'deposit' ? 'Deposit' : 'Withdrawal';
    downloadReceiptImage({
      title: `${kind} receipt`,
      filename: `hkfes-${tx.type}-${tx.asset}-${tx.id.slice(0, 8)}.png`,
      rows: [
        ['Status', tx.status.replace(/_/g, ' ')],
        ['Amount', fmtUsd(tx.amount)],
        ['Asset', tx.asset],
        ['Network', tx.network || '—'],
        ['Reference', tx.txHash || 'Pending'],
        ['Date', new Date(tx.createdAt).toLocaleString()],
        ['Record', tx.id],
      ],
    });
  };

  return (
    <div className={styles.ledger}>
      <div className={styles.header}>
        <div>
          <h3>Crypto Payment Activity & Audit Ledger</h3>
          <p>Real-time on-chain verification tracking for all manual deposits and withdrawals.</p>
        </div>
        <div className={styles.search}>
          <IconSearch size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search TXID, asset, ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.filters}>
        {[
          { id: 'all', label: 'All Activity' },
          { id: 'deposit', label: 'Deposits' },
          { id: 'withdrawal', label: 'Withdrawals' },
        ].map(tab => (
          <button
            key={`type-${tab.id}`}
            type="button"
            className={`${styles.chip} ${filterType === tab.id ? styles.chipActive : ''}`}
            onClick={() => setFilterType(tab.id as 'all' | 'deposit' | 'withdrawal')}
          >
            {tab.label}
          </button>
        ))}
        {[
          { id: 'all', label: 'All Statuses' },
          { id: 'AWAITING_PAYMENT', label: 'Started' },
          { id: 'PENDING_VERIFICATION', label: 'Pending Verification' },
          { id: 'PENDING_REVIEW', label: 'Under Review' },
          { id: 'COMPLETED', label: 'Completed' },
          { id: 'REJECTED', label: 'Declined' },
        ].map(st => (
          <button
            key={`status-${st.id}`}
            type="button"
            className={`${styles.statusChip} ${filterStatus === st.id ? styles.statusActive : ''}`}
            onClick={() => setFilterStatus(st.id)}
          >
            {st.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: 8 }}>📑</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>No crypto activity records match your criteria.</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
            Submit a deposit claim or request a withdrawal to see verified records here.
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(tx => {
            const isDeposit = tx.type === 'deposit';
            return (
              <div key={tx.id} className={styles.row} onClick={() => setSelectedTx(tx)}>
                <div
                  className={styles.icon}
                  style={{ background: isDeposit ? 'var(--color-gain-bg)' : 'var(--color-loss-bg)' }}
                >
                  {isDeposit ? (
                    <IconArrowDownRight size={16} color="var(--color-gain)" />
                  ) : (
                    <IconArrowUpRight size={16} color="var(--color-loss)" />
                  )}
                </div>
                <div className={styles.titleBlock}>
                  <div className={styles.title}>
                    {isDeposit ? 'Crypto Deposit' : 'Crypto Withdrawal'} • {tx.asset}
                  </div>
                  <div className={styles.meta}>
                    {tx.network?.replace(/_/g, ' ')} • {new Date(tx.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={styles.status}>
                  <CryptoStatusBadge status={tx.status} size="sm" />
                </div>
                <div className={styles.hash}>
                  {tx.txHash ? `${tx.txHash.slice(0, 6)}...${tx.txHash.slice(-4)}` : 'Pending Dispatch'}
                </div>
                <div className={styles.amount} style={{ color: isDeposit ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                  {isDeposit ? '+' : '-'}{fmtUsd(tx.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTx && (
        <div className={styles.modal} onClick={() => setSelectedTx(null)}>
          <div className={styles.receipt} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  className={styles.icon}
                  style={{ background: selectedTx.type === 'deposit' ? 'var(--color-gain-bg)' : 'var(--color-loss-bg)', flexShrink: 0 }}
                >
                  {selectedTx.type === 'deposit' ? '↓' : '↑'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                    {selectedTx.type === 'deposit' ? 'Deposit Audit Receipt' : 'Withdrawal Audit Receipt'}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>ID: {selectedTx.id}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <IconX size={18} />
              </button>
            </div>

            <div style={{
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verification State</div>
                <div style={{ marginTop: 4 }}>
                  <CryptoStatusBadge status={selectedTx.status} />
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xl)',
                fontWeight: 800,
                color: selectedTx.type === 'deposit' ? 'var(--color-gain)' : 'var(--color-loss)',
              }}>
                {selectedTx.type === 'deposit' ? '+' : '-'}${selectedTx.amount.toFixed(2)} USD
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-xs)', marginBottom: 20 }}>
              <div className={styles.detail}>
                <span style={{ color: 'var(--text-muted)' }}>Asset / Network:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedTx.asset} ({selectedTx.network})</span>
              </div>
              <div className={styles.detail}>
                <span style={{ color: 'var(--text-muted)' }}>Initiated Timestamp:</span>
                <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>
              {selectedTx.toAddress && (
                <div className={styles.detail}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Address:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {selectedTx.toAddress.slice(0, 10)}...{selectedTx.toAddress.slice(-6)}
                  </span>
                </div>
              )}
              {selectedTx.feeAmount ? (
                <div className={styles.detail}>
                  <span style={{ color: 'var(--text-muted)' }}>Network Gas Fee:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>${selectedTx.feeAmount.toFixed(2)}</span>
                </div>
              ) : null}
              {selectedTx.txHash && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 6,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Blockchain Transaction Hash (TXID):</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--brand-mint-500)', wordBreak: 'break-all' }}>
                      {selectedTx.txHash}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedTx.txHash!)}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '4px 8px',
                          color: copiedHash ? 'var(--brand-mint-500)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                        title="Copy Hash"
                      >
                        {copiedHash ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      </button>
                      <a
                        href={getExplorerUrl(selectedTx.txHash, selectedTx.network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'var(--brand-mint-500)',
                          color: '#07090e',
                          borderRadius: 'var(--radius-xs)',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                        }}
                        title="View on Explorer"
                      >
                        <IconExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {selectedTx.proofImageUrl && (
                <img
                  src={selectedTx.proofImageUrl}
                  alt="Payment screenshot"
                  style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8, background: 'var(--bg-input)' }}
                />
              )}
              {selectedTx.rejectionReason && (
                <div style={{
                  background: 'var(--color-loss-bg)',
                  border: '1px solid var(--color-loss-border)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-loss)',
                  marginTop: 6,
                }}>
                  <strong>Compliance Rejection Reason:</strong>
                  <div style={{ marginTop: 2 }}>{selectedTx.rejectionReason}</div>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.statusChip} onClick={() => saveScreenshot(selectedTx)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconDownload size={14} /> Save screenshot
              </button>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
