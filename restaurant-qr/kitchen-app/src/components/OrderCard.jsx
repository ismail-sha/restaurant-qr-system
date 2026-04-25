import React, { useState, useEffect } from 'react';
import styles from './OrderCard.module.css';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#F39C12', bg: 'rgba(243,156,18,0.12)'  },
  confirmed: { label: 'Confirmed', color: '#2980B9', bg: 'rgba(41,128,185,0.12)'  },
  cooking:   { label: 'Cooking',   color: '#8E44AD', bg: 'rgba(142,68,173,0.12)'  },
  ready:     { label: 'Ready',     color: '#27AE60', bg: 'rgba(39,174,96,0.12)'   },
  served:    { label: 'Served',    color: '#555',    bg: 'rgba(85,85,85,0.12)'     },
  cancelled: { label: 'Cancelled', color: '#E74C3C', bg: 'rgba(231,76,60,0.12)'   },
};

const NEXT_ACTION = {
  pending:   { label: 'Confirm Order', nextStatus: 'confirmed', color: '#2980B9' },
  confirmed: { label: 'Start Cooking', nextStatus: 'cooking',   color: '#8E44AD' },
  cooking:   { label: 'Mark Ready',    nextStatus: 'ready',     color: '#27AE60' },
  ready:     { label: 'Mark Served',   nextStatus: 'served',    color: '#555'    },
};

export default function OrderCard({ order, onUpdateStatus, onRemove }) {
  const [elapsed, setElapsed] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [newTime, setNewTime] = useState('');

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const nextAction = NEXT_ACTION[order.status];
  const isNew = order._isNew;

  useEffect(() => {
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60000);
      setElapsed(mins);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [order.placedAt]);

  const handleAction = async () => {
    if (!nextAction || updating) return;
    setUpdating(true);
    await onUpdateStatus(order.id, nextAction.nextStatus, order.tableId);
    setUpdating(false);
    if (nextAction.nextStatus === 'served') {
      setTimeout(() => onRemove(order.id), 3000);
    }
  };

  const handleTimeUpdate = async () => {
    const mins = parseInt(newTime);
    if (!mins || mins < 1) return;
    setUpdating(true);
    await onUpdateStatus(order.id, order.status, order.tableId, { estimatedTimeMinutes: mins });
    setUpdating(false);
    setShowTime(false);
    setNewTime('');
  };

  const urgency = elapsed > (order.estimatedTimeMinutes || 20) ? 'overdue'
    : elapsed > (order.estimatedTimeMinutes || 20) * 0.8 ? 'warning' : 'normal';

  return (
    <div
      className={`${styles.card} ${isNew ? styles.cardNew : ''} ${styles[`urgency_${urgency}`]}`}
      style={{ '--status-color': config.color, '--status-bg': config.bg }}
    >
      {/* Card header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.tableTag}>Table {order.tableNumber}</span>
          <span className={styles.orderNum}>#{order.orderNumber || order.id}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.elapsedBadge} ${urgency !== 'normal' ? styles.elapsedWarning : ''}`}>
            {elapsed}m ago
          </span>
          <span className={styles.statusBadge} style={{ color: config.color, background: config.bg }}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className={styles.items}>
        {(order.items || []).map((item, i) => (
          <div key={i} className={styles.item}>
            <span className={styles.itemQty}>×{item.quantity}</span>
            <span className={styles.itemEmoji}>{item.emoji || '🍽️'}</span>
            <span className={styles.itemName}>{item.name}</span>
            {item.specialInstructions && (
              <span className={styles.itemNote} title={item.specialInstructions}>📝</span>
            )}
            <span className={styles.itemTime}>{item.prepTimeMinutes || '?'}m</span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className={styles.notes}>📝 {order.notes}</div>
      )}

      {/* Estimated time row */}
      <div className={styles.timeRow}>
        <span className={styles.timeLabel}>
          Est. {order.estimatedTimeMinutes || '—'} min
        </span>
        <button className={styles.timeEditBtn} onClick={() => setShowTime(!showTime)}>
          ✏️ Update time
        </button>
      </div>

      {showTime && (
        <div className={styles.timeInput}>
          <input
            type="number"
            className={styles.timeField}
            placeholder="Minutes..."
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            min={1}
            max={120}
          />
          <button className={styles.timeConfirmBtn} onClick={handleTimeUpdate}>
            Send to customer
          </button>
        </div>
      )}

      {/* Action button */}
      {nextAction && (
        <button
          className={styles.actionBtn}
          style={{ '--action-color': nextAction.color }}
          onClick={handleAction}
          disabled={updating}
        >
          {updating
            ? <span className={styles.spinner} />
            : nextAction.label
          }
        </button>
      )}

      {order.status === 'served' && (
        <div className={styles.servedMsg}>✅ Order served — removing shortly</div>
      )}
    </div>
  );
}
