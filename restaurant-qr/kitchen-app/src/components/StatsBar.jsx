import React from 'react';
import styles from './StatsBar.module.css';

export default function StatsBar({ stats }) {
  const items = [
    { label: 'Pending',   value: stats.pending,   color: '#F39C12', icon: '⏳' },
    { label: 'Confirmed', value: stats.confirmed,  color: '#2980B9', icon: '✅' },
    { label: 'Cooking',   value: stats.cooking,    color: '#8E44AD', icon: '👨‍🍳' },
    { label: 'Ready',     value: stats.ready,      color: '#27AE60', icon: '🔔' },
    { label: 'Total',     value: stats.total,      color: '#555',    icon: '📋' },
  ];

  return (
    <div className={styles.bar}>
      {items.map(item => (
        <div key={item.label} className={styles.card}>
          <div className={styles.cardIcon}>{item.icon}</div>
          <div className={styles.cardNum} style={{ color: item.color }}>{item.value}</div>
          <div className={styles.cardLabel}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
