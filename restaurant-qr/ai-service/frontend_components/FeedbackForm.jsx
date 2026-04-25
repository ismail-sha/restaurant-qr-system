/**
 * FeedbackForm.jsx
 * Add to: customer-app/src/components/FeedbackForm.jsx
 *
 * Shows after order is served. Live sentiment preview as customer types.
 */

import React, { useState, useEffect, useRef } from 'react';
import styles from './FeedbackForm.module.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SENTIMENT_CONFIG = {
  positive: { emoji: '😊', label: 'Positive', color: '#27AE60', bg: '#D5F5E3' },
  neutral:  { emoji: '😐', label: 'Neutral',  color: '#F39C12', bg: '#FEF9E7' },
  negative: { emoji: '😞', label: 'Negative', color: '#E74C3C', bg: '#FADBD8' },
};

export default function FeedbackForm({ orderId, tableId, onSubmitted }) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [sentiment, setSentiment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const debounceRef = useRef(null);

  // Live sentiment preview as user types
  useEffect(() => {
    if (!text.trim() || text.length < 8) {
      setSentiment(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API.replace(':5000', ':8000')}/ai/feedback/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        setSentiment(data);
      } catch {
        setSentiment(null);
      }
    }, 600); // wait 600ms after typing stops

    return () => clearTimeout(debounceRef.current);
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
      onSubmitted?.();
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.thankYou}>
        <div className={styles.tyIcon}>🙏</div>
        <div className={styles.tyTitle}>Thank you for your feedback!</div>
        <div className={styles.tySub}>Your review helps us improve every dish.</div>
      </div>
    );
  }

  const sentConf = sentiment ? SENTIMENT_CONFIG[sentiment.sentiment] : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>How was your experience?</div>

      {/* Star rating */}
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`${styles.star} ${star <= (hoverRating || rating) ? styles.starFilled : ''}`}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className={styles.ratingLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
          </span>
        )}
      </div>

      {/* Text review */}
      <textarea
        className={styles.textarea}
        placeholder="Tell us about your meal — food, speed, service..."
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        maxLength={500}
      />

      <div className={styles.textMeta}>
        <span className={styles.charCount}>{text.length}/500</span>
      </div>

      {/* Live sentiment preview */}
      {sentConf && (
        <div className={styles.sentimentPreview} style={{ background: sentConf.bg, borderColor: sentConf.color + '44' }}>
          <span className={styles.sentEmoji}>{sentConf.emoji}</span>
          <div>
            <div className={styles.sentLabel} style={{ color: sentConf.color }}>
              {sentConf.label} review detected
            </div>
            {sentiment.summary && (
              <div className={styles.sentSummary}>{sentiment.summary}</div>
            )}
          </div>
        </div>
      )}

      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting || !text.trim() || !rating}
      >
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}
