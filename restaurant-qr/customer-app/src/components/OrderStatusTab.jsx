import React, { useEffect, useState } from 'react';

const STAGES = [
  { key: 'pending',   label: 'Received',  icon: '📝' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'cooking',   label: 'Cooking',   icon: '👨‍🍳' },
  { key: 'ready',     label: 'Ready!',    icon: '🔔' },
  { key: 'served',    label: 'Served',    icon: '😊' },
];

const STATUS_INFO = {
  pending:   { title: 'Order received!',       sub: 'Your order is in the queue.',         icon: '⏳', color: '#E67E22' },
  confirmed: { title: 'Order confirmed!',       sub: 'Your order has been confirmed.',      icon: '✅', color: '#27AE60' },
  cooking:   { title: 'Cooking in progress!',  sub: 'Our chefs are preparing your order.', icon: '👨‍🍳', color: '#2980B9' },
  ready:     { title: 'Your food is ready!',   sub: 'A waiter is bringing it to you now.', icon: '🔔', color: '#27AE60' },
  served:    { title: 'Enjoy your meal!',       sub: 'Thank you for dining with us. 🙏',   icon: '😊', color: '#27AE60' },
  cancelled: { title: 'Order cancelled.',       sub: 'Please speak with a waiter.',        icon: '❌', color: '#E74C3C' },
};

// ─── Inline Feedback Form ────────────────────────────────────────────────────
function FeedbackForm({ orderId, tableId }) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [livesentiment, setLiveSentiment] = useState(null);
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const AI  = 'http://localhost:8000';

  // Live sentiment as user types
  useEffect(() => {
    if (text.length < 8) { setLiveSentiment(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${AI}/ai/feedback/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const d = await r.json();
        setLiveSentiment(d);
      } catch { setLiveSentiment(null); }
    }, 700);
    return () => clearTimeout(t);
  }, [text]);

  const handleSubmit = async () => {
    if (!text.trim() || !rating) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/api/orders/${orderId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewText: text, rating, tableId }),
      });
      setSubmitted(true);
    } catch { alert('Failed to submit. Try again.'); }
    finally { setSubmitting(false); }
  };

  const sentEmoji = { positive: '😊', neutral: '😐', negative: '😞' };
  const sentColor = { positive: '#27AE60', neutral: '#F39C12', negative: '#E74C3C' };
  const sentBg    = { positive: '#D5F5E3', neutral: '#FEF9E7', negative: '#FADBD8' };

  if (submitted) {
    return (
      <div style={{ textAlign:'center', padding:'28px 16px', background:'#fff',
                    borderRadius:12, border:'1px solid #e8e8e6', marginTop:16 }}>
        <div style={{ fontSize:44, marginBottom:10 }}>🙏</div>
        <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>
          Thank you for your feedback!
        </div>
        <div style={{ fontSize:13, color:'#6b6b6b' }}>
          Your review helps us improve every dish.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:12,
                  padding:'20px 16px', marginTop:16 }}>
      {/* Title */}
      <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a',
                    textAlign:'center', marginBottom:16 }}>
        ⭐ How was your experience?
      </div>

      {/* Stars */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
                    gap:8, marginBottom:16 }}>
        {[1,2,3,4,5].map(s => (
          <button key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            style={{ fontSize:34, background:'none', border:'none', cursor:'pointer',
                     color: s <= (hover || rating) ? '#F39C12' : '#ddd',
                     transition:'all 0.1s', transform: s <= (hover||rating) ? 'scale(1.15)':'scale(1)' }}>
            ★
          </button>
        ))}
        {rating > 0 && (
          <span style={{ fontSize:13, fontWeight:600, color:'#F39C12', marginLeft:4 }}>
            {['','Poor','Fair','Good','Great','Excellent!'][rating]}
          </span>
        )}
      </div>

      {/* Text area */}
      <textarea
        placeholder="Tell us about your meal — food quality, speed, service..."
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        maxLength={500}
        style={{ width:'100%', padding:'12px', border:'1px solid #e8e8e6',
                 borderRadius:8, fontFamily:'inherit', fontSize:14,
                 lineHeight:1.5, color:'#1a1a1a', resize:'none', outline:'none',
                 boxSizing:'border-box' }}
      />
      <div style={{ textAlign:'right', fontSize:11, color:'#6b6b6b', marginBottom:10 }}>
        {text.length}/500
      </div>

      {/* Live sentiment preview */}
      {livesentiment && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 14px', borderRadius:8, marginBottom:12,
          background: sentBg[livesentiment?.sentiment] || '#f5f5f5',
          border: `1.5px solid ${sentColor[livesentiment?.sentiment] || '#ddd'}`,
          animation:'fadeIn 0.25s ease',
        }}>
          <span style={{ fontSize:22 }}>{sentEmoji[livesentiment?.sentiment]}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:600,
                          color: sentColor[livesentiment?.sentiment] }}>
              {livesentiment?.sentiment?.charAt(0).toUpperCase() +
               livesentiment?.sentiment?.slice(1)} review detected
            </div>
            {livesentiment?.summary && (
              <div style={{ fontSize:11, color:'#6b6b6b', marginTop:2, lineHeight:1.4 }}>
                {livesentiment.summary}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !text.trim() || !rating}
        style={{ width:'100%', padding:14, background: (!text.trim()||!rating) ? '#aaa' : '#C0392B',
                 color:'#fff', border:'none', borderRadius:8, fontSize:15,
                 fontWeight:600, cursor: (!text.trim()||!rating) ? 'default':'pointer',
                 transition:'background 0.15s' }}>
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}

// ─── Main OrderStatusTab ─────────────────────────────────────────────────────
export default function OrderStatusTab({ order, tableId }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!order || ['served','cancelled'].includes(order.status)) return;
    const tick = () => setElapsed(
      Math.round((Date.now() - new Date(order.placedAt).getTime()) / 60000)
    );
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [order]);

  if (!order) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    justifyContent:'center', padding:'80px 24px', textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>📋</div>
        <div style={{ fontSize:18, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>
          No active order
        </div>
        <div style={{ fontSize:14, color:'#6b6b6b', lineHeight:1.5 }}>
          Place an order from the menu and track it here in real time.
        </div>
      </div>
    );
  }

  const info      = STATUS_INFO[order.status] || STATUS_INFO.pending;
  const stageIdx  = STAGES.findIndex(s => s.key === order.status);
  const remaining = Math.max(0, (order.estimatedTimeMinutes || 0) - elapsed);
  const progress  = order.estimatedTimeMinutes
    ? Math.min(100, Math.round((elapsed / order.estimatedTimeMinutes) * 100))
    : 0;

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>

      {/* Status hero */}
      <div style={{ borderRadius:12, border:`1.5px solid ${info.color}40`,
                    background:`${info.color}0d`, padding:'24px 20px', textAlign:'center' }}>
        <div style={{ fontSize:44, marginBottom:12 }}>{info.icon}</div>
        <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>
          {info.title}
        </div>
        <div style={{ fontSize:14, color:'#6b6b6b', marginBottom:16 }}>{info.sub}</div>

        {!['served','cancelled'].includes(order.status) && (
          <>
            <div style={{ fontSize:32, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>
              {remaining} min left
            </div>
            <div style={{ height:8, background:'rgba(0,0,0,0.08)', borderRadius:20,
                          overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', borderRadius:20, background:info.color,
                            width:`${progress}%`, transition:'width 1s ease' }} />
            </div>
            <div style={{ fontSize:11, color:'#6b6b6b' }}>
              Est. total: {order.estimatedTimeMinutes} min · {elapsed} min elapsed
            </div>
          </>
        )}
      </div>

      {/* Stage tracker */}
      <div style={{ display:'flex', alignItems:'flex-start', background:'#fff',
                    borderRadius:12, border:'1px solid #e8e8e6', padding:'20px 16px' }}>
        {STAGES.map((stage, i) => {
          const done   = i < stageIdx;
          const active = i === stageIdx;
          return (
            <React.Fragment key={stage.key}>
              {i > 0 && (
                <div style={{ flex:1, height:2, marginTop:14,
                              background: done ? '#C0392B' : '#e8e8e6',
                              transition:'background 0.4s' }} />
              )}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  border:`2px solid ${done||active ? '#C0392B' : '#e8e8e6'}`,
                  background: done ? '#C0392B' : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, color: done ? '#fff' : '#1a1a1a',
                  boxShadow: active ? '0 0 0 4px #FADBD8' : 'none',
                  transition:'all 0.3s',
                }}>
                  {done ? '✓' : stage.icon}
                </div>
                <div style={{ fontSize:10, color: done||active ? '#C0392B' : '#6b6b6b',
                              textAlign:'center', fontWeight: active ? 600 : 400,
                              whiteSpace:'nowrap' }}>
                  {stage.label}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Order details */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e8e8e6',
                    overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'12px 16px', background:'#f7f7f5',
                      borderBottom:'1px solid #e8e8e6' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>
            Order #{order.orderNumber || order.id}
          </span>
          <span style={{ fontSize:12, fontWeight:600, background:'#C0392B', color:'#fff',
                         borderRadius:20, padding:'2px 10px' }}>
            Table {tableId}
          </span>
        </div>
        {(order.items || []).map((item, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between',
                                padding:'10px 16px', fontSize:13, color:'#1a1a1a',
                                borderBottom:'1px solid #e8e8e6' }}>
            <span>{item.emoji} {item.name}</span>
            <span style={{ color:'#6b6b6b' }}>×{item.quantity} · ₹{item.unitPrice * item.quantity}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between',
                      padding:'12px 16px', fontSize:15, fontWeight:700, color:'#1a1a1a' }}>
          <span>Total</span>
          <span>₹{order.totalAmount}</span>
        </div>
        {order.notes && (
          <div style={{ padding:'10px 16px', fontSize:12, color:'#6b6b6b',
                        borderTop:'1px solid #e8e8e6', background:'#f7f7f5' }}>
            📝 {order.notes}
          </div>
        )}
      </div>

      {/* ✅ FEEDBACK FORM — shows when order is served */}
      {order.status === 'served' && (
        <FeedbackForm orderId={order.id} tableId={tableId} />
      )}

    </div>
  );
}
