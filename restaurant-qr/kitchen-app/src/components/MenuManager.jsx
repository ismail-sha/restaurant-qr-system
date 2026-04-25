import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { menuAPI } from '../hooks/useApi';
import styles from './MenuManager.module.css';

export default function MenuManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    menuAPI.getAll()
      .then(data => setCategories(data.categories || []))
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const toggleItem = async (itemId, currentAvail) => {
    setToggling(p => ({ ...p, [itemId]: true }));
    try {
      await menuAPI.toggleAvailability(itemId, !currentAvail);
      setCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items.map(item =>
          item.id === itemId ? { ...item, isAvailable: !currentAvail } : item
        ),
      })));
      toast.success(!currentAvail ? 'Item marked available' : 'Item marked unavailable');
    } catch {
      toast.error('Failed to update item');
    } finally {
      setToggling(p => ({ ...p, [itemId]: false }));
    }
  };

  if (loading) return <div className={styles.loading}>Loading menu...</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Menu Manager</h2>
        <p className={styles.pageSub}>Toggle item availability. Changes reflect instantly on customer devices.</p>
      </div>

      {categories.map(cat => (
        <div key={cat.id} className={styles.category}>
          <div className={styles.catHeader}>{cat.name}</div>
          <div className={styles.itemList}>
            {cat.items.map(item => (
              <div key={item.id} className={`${styles.item} ${!item.isAvailable ? styles.itemOff : ''}`}>
                <span className={styles.emoji}>{item.emoji}</span>
                <div className={styles.info}>
                  <div className={styles.name}>{item.name}</div>
                  <div className={styles.meta}>₹{item.price} · ~{item.prepTimeMinutes}m</div>
                </div>
                <button
                  className={`${styles.toggle} ${item.isAvailable ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => toggleItem(item.id, item.isAvailable)}
                  disabled={toggling[item.id]}
                >
                  {toggling[item.id] ? '...' : item.isAvailable ? 'Available' : 'Unavailable'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
