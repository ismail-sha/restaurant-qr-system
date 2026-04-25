/**
 * SentimentReport.jsx
 * Add to: kitchen-app/src/components/SentimentReport.jsx
 *
 * Shows the weekly AI sentiment report in the kitchen dashboard.
 * Add a "Reports" tab to the sidebar in DashboardPage.jsx
 */

import React, { useState, useEffect } from 'react';
import styles from './SentimentReport.module.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CATEGORY_ICONS = {
  'food quality': '🍛',
  'speed': '⚡',
  'service': '👨‍🍳',
  'value': '💰',
  'cleanliness': '✨',
};

export default function SentimentReport() {
  const [report, setReport] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kitchen_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [repRes, revRes] = await Promise.all([
        fetch(`${API}/api/orders/ai/report?days=${days}`, { headers }),
        fetch(`${API.replace(':5000', ':8000')}/ai/feedback/recent?limit=15`),
      ]);

      const repData = await repRes.json();
      const revData = await revRes.json();

      setReport(repData);
      setReviews(revData.reviews || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [days]);

  if (loading) {
    return <div className={styles.loading}>Loading AI report...</div>;
  }

  const sentimentColor = (s) =>
    s === 'positive' ? '#27AE60' : s === 'negative' ? '#E74C3C' : '#F39C12';

  const scoreBar = (score) => {
    const pct = Math.round(((score + 1) / 2) * 100);
    const color = score > 0.1 ? '#27AE60' : score < -0.1 ? '#E74C3C' : '#F39C12';
    return (
      <div className={styles.barWrap}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>🤖 AI Sentiment Report</h2>
          <p className={styles.pageSub}>Automatically analysed from customer reviews</p>
        </div>
        <div className={styles.periodSelect}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              className={`${styles.periodBtn} ${days === d ? styles.periodActive : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {!report || report.total_reviews === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyTitle}>No reviews yet</div>
          <div className={styles.emptySub}>
            Customer reviews will appear here after they submit feedback from their phones.
          </div>
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div className={styles.overviewGrid}>
            <div className={styles.overviewCard}>
              <div className={styles.bigNum}>{report.total_reviews}</div>
              <div className={styles.bigLabel}>Total Reviews</div>
            </div>
            <div className={styles.overviewCard}>
              <div className={styles.bigNum} style={{ color: '#F39C12' }}>
                {report.average_rating ? `${report.average_rating}★` : '—'}
              </div>
              <div className={styles.bigLabel}>Avg Rating</div>
            </div>
            <div className={styles.overviewCard}>
              <div className={styles.bigNum} style={{
                color: report.trend === 'improving' ? '#27AE60' : report.trend === 'declining' ? '#E74C3C' : '#888'
              }}>
                {report.trend === 'improving' ? '↑' : report.trend === 'declining' ? '↓' : '→'}
                {report.trend}
              </div>
              <div className={styles.bigLabel}>Trend</div>
            </div>
          </div>

          {/* Sentiment breakdown */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Sentiment Breakdown</div>
            <div className={styles.sentRow}>
              {['positive', 'neutral', 'negative'].map(s => (
                <div key={s} className={styles.sentBox}>
                  <div className={styles.sentNum} style={{ color: sentimentColor(s) }}>
                    {report.sentiment_breakdown?.[s] || 0}
                  </div>
                  <div className={styles.sentLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</div>
                  <div className={styles.sentPct}>
                    {Math.round(((report.sentiment_breakdown?.[s] || 0) / report.total_reviews) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category scores */}
          {report.category_scores && Object.keys(report.category_scores).length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Category Analysis</div>
              {Object.entries(report.category_scores).map(([cat, score]) => (
                <div key={cat} className={styles.catRow}>
                  <span className={styles.catIcon}>
                    {CATEGORY_ICONS[cat.toLowerCase()] || '•'}
                  </span>
                  <span className={styles.catName}>{cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <div className={styles.catBar}>{scoreBar(score)}</div>
                  <span className={styles.catScore} style={{
                    color: score > 0.1 ? '#27AE60' : score < -0.1 ? '#E74C3C' : '#888'
                  }}>
                    {score > 0.1 ? '👍' : score < -0.1 ? '👎' : '😐'}
                    {score > 0 ? '+' : ''}{score.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Strengths and Issues */}
          <div className={styles.twoCol}>
            {report.top_strengths?.length > 0 && (
              <div className={`${styles.section} ${styles.greenSection}`}>
                <div className={styles.sectionTitle}>✅ Strengths</div>
                {report.top_strengths.map((s, i) => (
                  <div key={i} className={styles.listItem}>
                    <span className={styles.listDot} style={{ background: '#27AE60' }} />
                    {s.category}
                  </div>
                ))}
              </div>
            )}
            {report.top_issues?.length > 0 && (
              <div className={`${styles.section} ${styles.redSection}`}>
                <div className={styles.sectionTitle}>⚠️ Needs Attention</div>
                {report.top_issues.map((s, i) => (
                  <div key={i} className={styles.listItem}>
                    <span className={styles.listDot} style={{ background: '#E74C3C' }} />
                    {s.category}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Recommendation */}
          {report.recommendation && (
            <div className={styles.aiRec}>
              <span className={styles.aiRecIcon}>🤖</span>
              <p>{report.recommendation}</p>
            </div>
          )}
        </>
      )}

      {/* Recent reviews */}
      {reviews.length > 0 && (
        <div className={styles.section} style={{ marginTop: 24 }}>
          <div className={styles.sectionTitle}>Recent Reviews</div>
          {reviews.map((r, i) => (
            <div key={i} className={styles.reviewCard}>
              <div className={styles.reviewTop}>
                <span className={styles.reviewTable}>Table {r.table_number || '?'}</span>
                <span className={styles.reviewRating}>{'★'.repeat(r.rating || 0)}</span>
                <span
                  className={styles.reviewSentiment}
                  style={{ color: sentimentColor(r.sentiment) }}
                >
                  {r.sentiment}
                </span>
              </div>
              <p className={styles.reviewText}>"{r.review_text}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
