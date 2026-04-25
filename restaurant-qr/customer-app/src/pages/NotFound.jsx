import React from 'react';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🍽️</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Page not found</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Please scan the QR code at your table to start ordering.</p>
    </div>
  );
}
