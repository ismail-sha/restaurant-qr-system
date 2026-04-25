import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';

// ─── Inline Recommendation Bar ───────────────────────────────────────────────
function RecommendationBar({ tableId }) {
  const { cartItems, addItem } = useCart();
  const [recs, setRecs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded]     = useState({});
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!cartItems.length) { setRecs([]); return; }
    const ids = cartItems.map(i => i.id).join(',');
    setLoading(true);
    fetch(`${API}/api/orders/recommend?itemIds=${ids}&tableId=${tableId}`)
      .then(r => r.json())
      .then(d => setRecs(d.recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [cartItems.length, tableId]);

  const handleAdd = (rec) => {
    addItem({ id: rec.id, name: rec.name, emoji: rec.emoji, price: rec.price });
    setAdded(p => ({ ...p, [rec.id]: true }));
  };

  if (!cartItems.length) return null;

  return (
    <div style={{ background:'linear-gradient(135deg,#fff9f0,#fff3e0)',
                  border:'1.5px solid #FFE0B2', borderRadius:12,
                  padding:'14px 16px', marginBottom:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'baseline', marginBottom:12 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#E65100' }}>
          🤖 You might also like
        </span>
        <span style={{ fontSize:11, color:'#BF360C', opacity:0.7 }}>
          Based on your cart
        </span>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:52, background:'#ffe0b2', borderRadius:8,
                                  animation:'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : recs.length === 0 ? (
        <div style={{ fontSize:12, color:'#BF360C', opacity:0.6, textAlign:'center' }}>
          No recommendations yet — add more items!
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {recs.map(rec => (
            <div key={rec.id} style={{ display:'flex', alignItems:'center', gap:10,
                                       background:'rgba(255,255,255,0.7)',
                                       borderRadius:8, padding:'10px 12px',
                                       border:'1px solid rgba(255,152,0,0.2)' }}>
              <span style={{ fontSize:22 }}>{rec.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {rec.name}
                </div>
                <div style={{ fontSize:11, color:'#F57C00', marginTop:1 }}>
                  {rec.reason}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'#C0392B', marginTop:2 }}>
                  ₹{rec.price}
                </div>
              </div>
              <button
                onClick={() => handleAdd(rec)}
                disabled={added[rec.id]}
                style={{
                  padding:'6px 14px',
                  background: added[rec.id] ? '#27AE60' : '#FF6F00',
                  color:'#fff', border:'none', borderRadius:20,
                  fontSize:12, fontWeight:600, cursor: added[rec.id] ? 'default':'pointer',
                  whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s',
                }}>
                {added[rec.id] ? '✓ Added' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main CartTab ────────────────────────────────────────────────────────────
export default function CartTab({ onPlaceOrder, placing, tableId }) {
  const { cartItems, totalAmount, notes, addItem, removeItem, setNotes } = useCart();

  if (!cartItems.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    justifyContent:'center', padding:'80px 24px', textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🛒</div>
        <div style={{ fontSize:18, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>
          Your cart is empty
        </div>
        <div style={{ fontSize:14, color:'#6b6b6b' }}>
          Go to the menu and add some delicious items!
        </div>
      </div>
    );
  }

  const gst   = Math.round(totalAmount * 0.05);
  const total = Math.round(totalAmount * 1.05);

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>

      {/* ✅ AI RECOMMENDATIONS — shows above cart items */}
      <RecommendationBar tableId={tableId} />

      {/* Cart items */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e8e8e6',
                    overflow:'hidden' }}>
        <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase',
                      letterSpacing:'0.06em', color:'#6b6b6b', padding:'12px 16px',
                      borderBottom:'1px solid #e8e8e6' }}>
          Your Items
        </div>
        {cartItems.map(item => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12,
                                      padding:'12px 16px', borderBottom:'1px solid #e8e8e6' }}>
            <span style={{ fontSize:24 }}>{item.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.name}</div>
              <div style={{ fontSize:12, color:'#6b6b6b' }}>₹{item.price} each</div>
            </div>
            <div style={{ display:'flex', alignItems:'center',
                          border:'1px solid #e8e8e6', borderRadius:20, overflow:'hidden' }}>
              <button onClick={() => removeItem(item.id)}
                style={{ width:30, height:30, background:'none', border:'none',
                         fontSize:16, color:'#C0392B', fontWeight:600, cursor:'pointer' }}>
                −
              </button>
              <span style={{ minWidth:26, textAlign:'center', fontSize:14,
                             fontWeight:600, color:'#1a1a1a' }}>
                {item.quantity}
              </span>
              <button onClick={() => addItem(item)}
                style={{ width:30, height:30, background:'none', border:'none',
                         fontSize:16, color:'#C0392B', fontWeight:600, cursor:'pointer' }}>
                +
              </button>
            </div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a',
                          minWidth:52, textAlign:'right' }}>
              ₹{item.price * item.quantity}
            </div>
          </div>
        ))}
      </div>

      {/* Special instructions */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e8e8e6',
                    overflow:'hidden' }}>
        <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase',
                      letterSpacing:'0.06em', color:'#6b6b6b', padding:'12px 16px',
                      borderBottom:'1px solid #e8e8e6' }}>
          Special Instructions
        </div>
        <textarea
          placeholder="Allergies, preferences, requests..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          style={{ width:'100%', padding:'12px 16px', border:'none', outline:'none',
                   resize:'none', fontFamily:'inherit', fontSize:13, color:'#1a1a1a',
                   lineHeight:1.5, boxSizing:'border-box' }}
        />
      </div>

      {/* Bill */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e8e8e6' }}>
        {[
          ['Subtotal', `₹${totalAmount}`],
          ['GST (5%)', `₹${gst}`],
        ].map(([label, val]) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between',
                                    padding:'12px 16px', fontSize:14, color:'#1a1a1a',
                                    borderBottom:'1px solid #e8e8e6' }}>
            <span>{label}</span><span>{val}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px',
                      fontSize:16, fontWeight:700, color:'#1a1a1a' }}>
          <span>Total</span><span>₹{total}</span>
        </div>
      </div>

      {/* Place order button */}
      <button onClick={onPlaceOrder} disabled={placing}
        style={{ width:'100%', padding:16, background: placing ? '#aaa' : '#C0392B',
                 color:'#fff', border:'none', borderRadius:12, fontSize:16,
                 fontWeight:700, cursor: placing ? 'default':'pointer',
                 transition:'background 0.15s' }}>
        {placing
          ? 'Placing order...'
          : `Place Order · ₹${total}`
        }
      </button>

      <p style={{ fontSize:12, color:'#6b6b6b', textAlign:'center', margin:0 }}>
        Payment at the counter after your meal.
      </p>
    </div>
  );
}
