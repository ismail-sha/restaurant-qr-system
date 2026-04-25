/**
 * RecommendationBar.jsx
 * Add this file to: customer-app/src/components/RecommendationBar.jsx
 *
 * Shows "You might also like" recommendations in the cart tab.
 * Calls the AI service via the Node.js backend.
 */

import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import styles from './RecommendationBar.module.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function RecommendationBar({ tableId }) {
  const { cartItems, addItem } = useCart();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState({});

  useEffect(() => {
    if (cartItems.length === 0) {
      setRecommendations([]);
      return;
    }

    const itemIds = cartItems.map(i => i.id).join(',');
    setLoading(true);

    fetch(`${API}/api/orders/recommend?itemIds=${itemIds}&tableId=${tableId}`)
      .then(r => r.json())
      .then(data => setRecommendations(data.recommendations || []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, [cartItems.length, tableId]); // re-fetch when cart changes

  const handleAdd = (rec) => {
    // Build a minimal item object for the cart
    addItem({
      id: rec.id,
      name: rec.name,
      emoji: rec.emoji,
      price: rec.price,
    });
    setAdded(prev => ({ ...prev, [rec.id]: true }));
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.title}>🤖 AI Recommendations</div>
        <div className={styles.skeletonRow}>
          {[1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    );
  }

  if (!recommendations.length) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>🤖 You might also like</span>
        <span className={styles.subtitle}>Based on your order</span>
      </div>

      <div className={styles.list}>
        {recommendations.map(rec => (
          <div key={rec.id} className={styles.card}>
            <div className={styles.emoji}>{rec.emoji}</div>
            <div className={styles.info}>
              <div className={styles.name}>{rec.name}</div>
              <div className={styles.reason}>{rec.reason}</div>
              <div className={styles.price}>₹{rec.price}</div>
            </div>
            <button
              className={`${styles.addBtn} ${added[rec.id] ? styles.addedBtn : ''}`}
              onClick={() => handleAdd(rec)}
              disabled={added[rec.id]}
            >
              {added[rec.id] ? '✓ Added' : '+ Add'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
