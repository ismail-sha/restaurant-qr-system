import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import styles from './MenuTab.module.css';

const SPICE_LABELS = ['', '🌶️', '🌶️🌶️', '🌶️🌶️🌶️'];

export default function MenuTab({ categories, loading }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const { items: cartItems, addItem, removeItem } = useCart();

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  const allItems = categories.flatMap(c => c.items);
  const displayItems = activeCategory === 'all'
    ? allItems
    : categories.find(c => c.id === activeCategory)?.items || [];

  return (
    <div className={styles.wrap}>
      {/* Category filter pills */}
      <div className={styles.catBar}>
        <button
          className={`${styles.pill} ${activeCategory === 'all' ? styles.pillActive : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`${styles.pill} ${activeCategory === cat.id ? styles.pillActive : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className={styles.list}>
        {activeCategory === 'all'
          ? categories.map(cat => (
              <div key={cat.id}>
                <div className={styles.catHeader}>{cat.name}</div>
                {cat.items.map(item => (
                  <MenuItem key={item.id} item={item} qty={cartItems[item.id]?.quantity || 0} onAdd={addItem} onRemove={removeItem} />
                ))}
              </div>
            ))
          : displayItems.map(item => (
              <MenuItem key={item.id} item={item} qty={cartItems[item.id]?.quantity || 0} onAdd={addItem} onRemove={removeItem} />
            ))
        }
      </div>
    </div>
  );
}

function MenuItem({ item, qty, onAdd, onRemove }) {
  return (
    <div className={`${styles.item} ${!item.isAvailable ? styles.unavailable : ''}`}>
      <div className={styles.itemEmoji}>{item.emoji}</div>
      <div className={styles.itemInfo}>
        <div className={styles.itemTop}>
          <span className={styles.itemName}>{item.name}</span>
          <div className={styles.itemTags}>
            {item.isVegetarian && <span className={styles.vegDot} title="Vegetarian" />}
            {item.spiceLevel > 0 && <span className={styles.spice}>{SPICE_LABELS[item.spiceLevel]}</span>}
          </div>
        </div>
        <div className={styles.itemDesc}>{item.description}</div>
        <div className={styles.itemBottom}>
          <div>
            <span className={styles.price}>₹{item.price}</span>
            <span className={styles.prepTime}>· ~{item.prepTimeMinutes}m</span>
          </div>
          {!item.isAvailable ? (
            <span className={styles.unavailTag}>Unavailable</span>
          ) : qty === 0 ? (
            <button className={styles.addBtn} onClick={() => onAdd(item)}>+ Add</button>
          ) : (
            <div className={styles.qtyCtrl}>
              <button className={styles.qtyBtn} onClick={() => onRemove(item.id)}>−</button>
              <span className={styles.qty}>{qty}</span>
              <button className={styles.qtyBtn} onClick={() => onAdd(item)}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
