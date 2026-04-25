import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useKitchenSocket } from '../hooks/useKitchenSocket';
import { ordersAPI, menuAPI } from '../hooks/useApi';
import OrderCard from '../components/OrderCard';
import StatsBar from '../components/StatsBar';
import MenuManager from '../components/MenuManager';
import QRManager from '../components/QRManager';
import styles from './DashboardPage.module.css';

const FILTERS = ['all', 'pending', 'confirmed', 'cooking', 'ready'];

export default function DashboardPage() {
  const { staff, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeView, setActiveView] = useState('orders'); // orders | menu | qr
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);

  const { isConnected, on } = useKitchenSocket(staff?.id);

  // Initial load
  useEffect(() => {
    ordersAPI.getActive()
      .then(data => setOrders(data.orders || []))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  // New order arrives
  useEffect(() => {
    return on('new_order', ({ order }) => {
      setOrders(prev => {
        if (prev.find(o => o.id === order.id)) return prev;
        return [{ ...order, _isNew: true }, ...prev];
      });
      toast.success(`🛒 New order — Table ${order.tableNumber}!`, { duration: 6000 });
      // Play notification sound if available
      audioRef.current?.play().catch(() => {});
    });
  }, [on]);

  // Order updated
  useEffect(() => {
    return on('order_updated', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    });
  }, [on]);

  const updateStatus = useCallback(async (orderId, newStatus, tableId, extra = {}) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus, extra);
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: newStatus, _isNew: false, ...extra } : o
      ));
      // Notify customer table via socket
      // (backend already emits socket event, this is just optimistic UI)
    } catch (err) {
      toast.error('Failed to update order status');
    }
  }, []);

  const removeServed = useCallback((orderId) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  }, []);

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter);

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    cooking: orders.filter(o => o.status === 'cooking').length,
    ready: orders.filter(o => o.status === 'ready').length,
    total: orders.length,
  };

  return (
    <div className={styles.page}>
      {/* Hidden audio for notifications */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sideTop}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🌶️</span>
            <div>
              <div className={styles.brandName}>Spice Garden</div>
              <div className={styles.brandRole}>Kitchen Dashboard</div>
            </div>
          </div>

          <nav className={styles.nav}>
            {[
              { id: 'orders', icon: '📋', label: 'Live Orders', badge: stats.pending || null },
              { id: 'menu', icon: '🍽️', label: 'Menu Manager' },
              { id: 'qr', icon: '📱', label: 'QR Codes' },
            ].map(item => (
              <button
                key={item.id}
                className={`${styles.navItem} ${activeView === item.id ? styles.navActive : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className={styles.sideBottom}>
          <div className={`${styles.connStatus} ${isConnected ? styles.connOn : styles.connOff}`}>
            <div className={styles.connDot} />
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
          <div className={styles.staffInfo}>
            <div className={styles.staffName}>{staff?.name}</div>
            <div className={styles.staffRole}>{staff?.role}</div>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {activeView === 'orders' && (
          <>
            <StatsBar stats={stats} />

            {/* Filter tabs */}
            <div className={styles.filterBar}>
              {FILTERS.map(f => (
                <button
                  key={f}
                  className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && stats[f] > 0 && (
                    <span className={styles.filterCount}>{stats[f]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Orders grid */}
            {loading ? (
              <div className={styles.loadingGrid}>
                {[...Array(4)].map((_, i) => <div key={i} className={styles.skeleton} />)}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>👨‍🍳</div>
                <div className={styles.emptyTitle}>
                  {filter === 'all' ? 'No active orders yet' : `No ${filter} orders`}
                </div>
                <div className={styles.emptySub}>New orders will appear here in real time</div>
              </div>
            ) : (
              <div className={styles.ordersGrid}>
                {filteredOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={updateStatus}
                    onRemove={removeServed}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'menu' && <MenuManager />}
        {activeView === 'qr' && <QRManager />}
      </main>
    </div>
  );
}
