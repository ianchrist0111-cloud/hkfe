import { useState, useEffect } from 'react';
import { FAQ_DATA } from '../data';
import { api } from '../lib/api';
import {
  IconSearch,
  IconMail,
  IconMessageSquare,
  IconX,
  IconArrowRight
} from '../components/common/Icons';
import styles from './HelpPage.module.css';

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState<{ enabled: boolean; url: string }>({
    enabled: false,
    url: '',
  });

  useEffect(() => {
    api.getPlatformConfig().then(res => {
      if (res.success && res.data) {
        setTelegramConfig({
          enabled: Boolean(res.data.telegramEnabled),
          url: res.data.telegramUrl || (res.data.telegramHandle ? `https://t.me/${res.data.telegramHandle.replace('@', '')}` : 'https://t.me/hkfes_support'),
        });
      }
    }).catch(() => {});
  }, []);

  const filtered = FAQ_DATA.map(cat => ({
    ...cat,
    items: cat.items.filter(
      i =>
        !search ||
        i.q.toLowerCase().includes(search.toLowerCase()) ||
        i.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className={styles.page}>
      <div>
        <h1>Help & Support</h1>
        <p className={styles.headerSub}>Find answers, regulatory documentation, or contact institutional live support.</p>
      </div>

      <div className={styles.searchWrap}>
        <IconSearch size={18} color="var(--text-muted)" />
        <input
          placeholder="Search for answers, order types, bot rules…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.faqs}>
        {filtered.map(cat => (
          <div key={cat.category} className={styles.category}>
            <h3>{cat.category}</h3>
            {cat.items.map(item => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.contact}>
        <div>
          <h3>Still need help?</h3>
          <p>
            Our Tier-1 trading & compliance desk is available 24/7 via official ticket submission
            {telegramConfig.enabled ? ' or live Telegram.' : '.'}
          </p>
        </div>
        <div className={styles.contactBtns}>
          <button
            className={styles.btnEmail}
            onClick={() => window.dispatchEvent(new CustomEvent('open-support-modal', { detail: { category: 'other' } }))}
          >
            <IconMail size={16} />
            <span>Submit Support Ticket</span>
          </button>
          {telegramConfig.enabled && (
            <a
              href={telegramConfig.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnChat}
              style={{ textDecoration: 'none' }}
            >
              <IconMessageSquare size={16} />
              <span>Contact on Telegram</span>
            </a>
          )}
        </div>
      </div>

      {showChat && (
        <div className={styles.chatWidget}>
          <div className={styles.chatHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconMessageSquare size={16} color="var(--brand-mint-500)" />
              <span>Live Support Chat</span>
            </div>
            <button className={styles.chatClose} onClick={() => setShowChat(false)}>
              <IconX size={16} />
            </button>
          </div>
          <div className={styles.chatBody}>
            <div className={styles.chatMsg}>
              <strong>HKFES Support Desk</strong>
              <p>Hi! How can we assist with your trading, bot automation, or deposits today? (Simulated assistant active)</p>
            </div>
          </div>
          <div className={styles.chatInput}>
            <input placeholder="Type a question…" />
            <button aria-label="Send message">
              <IconArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}