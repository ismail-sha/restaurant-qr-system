import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CartProvider, useCart } from '../context/CartContext';
import { useSocket } from '../hooks/useSocket';
import { menuAPI, ordersAPI } from '../hooks/useApi';
import MenuTab from '../components/MenuTab';
import CartTab from '../components/CartTab';
import OrderStatusTab from '../components/OrderStatusTab';

const TABS = [
  { id: 'menu',   label: 'Menu',      icon: '🍽️' },
  { id: 'cart',   label: 'Cart',      icon: '🛒' },
  { id: 'status', label: 'My Order',  icon: '📋' },
];

function TablePageInner() {
  const { tableId }   = useParams();
  const [activeTab, setActiveTab]     = useState('menu');
  const [menu, setMenu]               = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);
  const [placing, setPlacing]         = useState(false);
  const { cartItems, totalCount, totalAmount, notes, clearCart } = useCart();
  const { isConnected, on } = useSocket(tableId);

  // Load menu
  useEffect(() => {
    menuAPI.getAll()
      .then(data => setMenu(data.categories))
      .catch(() => toast.error('Failed to load menu. Please refresh.'))
      .finally(() => setMenuLoading(false));
  }, []);

  // Load existing active order for this table
  useEffect(() => {
    ordersAPI.getByTable(tableId)
      .then(data => { if (data.orders?.length) setActiveOrder(data.orders[0]); })
      .catch(() => {});
  }, [tableId]);

  // Real-time order status updates
  useEffect(() => {
    const off = on('order_status_update', (data) => {
      setActiveOrder(prev =>
        prev ? { ...prev, status: data.status, estimatedTimeMinutes: data.estimatedTimeMinutes } : prev
      );
      const msgs = {
        confirmed: '✅ Your order is confirmed!',
        cooking:   '👨‍🍳 Chef is cooking your order!',
        ready:     '🔔 Your food is ready!',
        served:    '😊 Enjoy your meal!',
      };
      if (msgs[data.status]) toast.success(msgs[data.status], { duration: 5000 });
      if (['ready', 'cooking', 'served'].includes(data.status)) setActiveTab('status');
    });
    return off;
  }, [on]);

  // Menu availability updates
  useEffect(() => {
    const off = on('menu_updated', ({ itemId, isAvailable }) => {
      setMenu(prev => prev.map(cat => ({
        ...cat,
        items: cat.items.map(item =>
          item.id === itemId ? { ...item, isAvailable } : item
        ),
      })));
    });
    return off;
  }, [on]);

  const placeOrder = useCallback(async () => {
    if (!cartItems.length) return;
    setPlacing(true);
    try {
      const payload = {
        tableId: parseInt(tableId),
        items: cartItems.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
        notes,
      };
      const data = await ordersAPI.place(payload);
      setActiveOrder(data.order);
      clearCart();
      setActiveTab('status');
      toast.success(`Order placed! Est. wait: ${data.order.estimatedTimeMinutes} min`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order. Try again.');
    } finally {
      setPlacing(false);
    }
  }, [cartItems, tableId, notes, clearCart]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh',
                  background:'#f7f7f5', position:'relative' }}>
      {/* Header */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                       padding:'14px 16px', background:'#fff',
                       borderBottom:'1px solid #e8e8e6', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:24 }}>🌶️</span>
          <div>
            <div style={{ fontSize:16, fontWeight:600, color:'#1a1a1a', lineHeight:1.2 }}>
              Spice Garden
            </div>
            <div style={{ fontSize:11, color:'#C0392B', fontWeight:500 }}>
              Table {tableId}
            </div>
          </div>
        </div>
        <div style={{ width:9, height:9, borderRadius:'50%',
                      background: isConnected ? '#27AE60' : '#E74C3C',
                      animation: isConnected ? 'pulse 2s infinite' : 'none' }} />
      </header>

      {/* Tab content */}
      <main style={{ flex:1, overflowY:'auto', paddingBottom:80 }}>
        {activeTab === 'menu'   && <MenuTab categories={menu} loading={menuLoading} />}
        {/* ✅ Pass tableId to CartTab so recommendations work */}
        {activeTab === 'cart'   && <CartTab onPlaceOrder={placeOrder} placing={placing} tableId={tableId} />}
        {activeTab === 'status' && <OrderStatusTab order={activeOrder} tableId={tableId} />}
      </main>

      {/* Bottom nav */}
      <nav style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
                    width:'100%', maxWidth:480, background:'#fff',
                    borderTop:'1px solid #e8e8e6', display:'flex', zIndex:20 }}>
        {TABS.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                     gap:3, padding:'10px 8px 12px', background:'none', border:'none',
                     position:'relative', cursor:'pointer',
                     color: activeTab === tab.id ? '#C0392B' : '#6b6b6b',
                     transition:'color 0.15s' }}>
            <span style={{ fontSize:20 }}>{tab.icon}</span>
            <span style={{ fontSize:11, fontWeight:500 }}>{tab.label}</span>
            {tab.id === 'cart' && totalCount > 0 && (
              <span style={{ position:'absolute', top:6, right:'calc(50% - 18px)',
                             background:'#C0392B', color:'#fff', fontSize:10,
                             fontWeight:600, borderRadius:10, padding:'1px 5px',
                             minWidth:16, textAlign:'center' }}>
                {totalCount}
              </span>
            )}
            {tab.id === 'status' && activeOrder &&
             !['served','cancelled'].includes(activeOrder.status) && (
              <span style={{ position:'absolute', top:6, right:'calc(50% - 18px)',
                             background:'#27AE60', color:'#fff', fontSize:9,
                             borderRadius:10, padding:'2px 4px' }}>●</span>
            )}
          </button>
        ))}
      </nav>

      {/* Cart bar */}
      {activeTab === 'menu' && totalCount > 0 && (
        <div onClick={() => setActiveTab('cart')}
          style={{ position:'fixed', bottom:65, left:'50%',
                   transform:'translateX(-50%)', width:'calc(100% - 32px)',
                   maxWidth:448, background:'#C0392B', color:'#fff',
                   borderRadius:12, padding:'14px 20px', display:'flex',
                   alignItems:'center', justifyContent:'space-between',
                   cursor:'pointer', zIndex:15,
                   boxShadow:'0 4px 20px rgba(192,57,43,0.35)',
                   animation:'slideUp 0.25s ease' }}>
          <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:20,
                         padding:'3px 10px', fontSize:12, fontWeight:600 }}>
            {totalCount} item{totalCount > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize:14, fontWeight:600 }}>View Cart</span>
          <span style={{ fontSize:14, fontWeight:600 }}>₹{totalAmount}</span>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp { from{transform:translateX(-50%) translateY(100%)} to{transform:translateX(-50%) translateY(0)} }
      `}</style>
    </div>
  );
}

export default function TablePage() {
  return (
    <CartProvider>
      <TablePageInner />
    </CartProvider>
  );
}
