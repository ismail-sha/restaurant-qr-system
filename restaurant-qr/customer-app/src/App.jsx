import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TablePage from './pages/TablePage';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* /table/:tableId — main customer ordering page */}
      <Route path="/table/:tableId" element={<TablePage />} />

      {/* Fallback */}
      <Route path="/" element={
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Please scan your table's QR code</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Each table has a unique QR code to start ordering.</p>
        </div>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
