import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { tablesAPI } from '../hooks/useApi';
import styles from './QRManager.module.css';

export default function QRManager() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState({});
  const [loadingQr, setLoadingQr] = useState({});

  useEffect(() => {
    tablesAPI.getAll()
      .then(data => setTables(data.tables || []))
      .catch(() => toast.error('Failed to load tables'))
      .finally(() => setLoading(false));
  }, []);

  const loadQR = async (tableId) => {
    if (qrData[tableId]) return;
    setLoadingQr(p => ({ ...p, [tableId]: true }));
    try {
      const data = await tablesAPI.getQR(tableId);
      setQrData(p => ({ ...p, [tableId]: data }));
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setLoadingQr(p => ({ ...p, [tableId]: false }));
    }
  };

  const downloadQR = (tableId) => {
    const qr = qrData[tableId];
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr.qrDataUrl;
    link.download = `table-${qr.table.tableNumber}-qr.png`;
    link.click();
    toast.success('QR code downloaded!');
  };

  if (loading) return <div className={styles.loading}>Loading tables...</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>QR Code Manager</h2>
        <p className={styles.pageSub}>Generate and download QR codes for each table. Print and place them on tables.</p>
      </div>

      <div className={styles.grid}>
        {tables.map(table => (
          <div key={table.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.tableNum}>Table {table.table_number}</span>
              <span className={styles.capacity}>{table.capacity} seats</span>
              {table.active_orders > 0 && (
                <span className={styles.activeBadge}>{table.active_orders} active</span>
              )}
            </div>

            {qrData[table.id] ? (
              <>
                <div className={styles.qrWrap}>
                  <img
                    src={qrData[table.id].qrDataUrl}
                    alt={`QR for Table ${table.table_number}`}
                    className={styles.qrImg}
                  />
                </div>
                <div className={styles.qrUrl}>{qrData[table.id].url}</div>
                <div className={styles.actions}>
                  <button className={styles.dlBtn} onClick={() => downloadQR(table.id)}>
                    ⬇️ Download PNG
                  </button>
                  <a
                    href={qrData[table.id].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.testBtn}
                  >
                    🔗 Test Link
                  </a>
                </div>
              </>
            ) : (
              <button
                className={styles.generateBtn}
                onClick={() => loadQR(table.id)}
                disabled={loadingQr[table.id]}
              >
                {loadingQr[table.id] ? 'Generating...' : '📱 Generate QR Code'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
