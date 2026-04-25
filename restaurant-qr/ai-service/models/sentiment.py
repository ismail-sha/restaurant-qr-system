"""
CUSTOMER SENTIMENT & FEEDBACK ANALYSIS
========================================
Uses a 2-layer approach:
1. TextBlob — baseline polarity score (-1 to +1)
2. Custom keyword/phrase classifier — detects specific categories:
   - food_quality  (taste, spicy, bland, delicious, bad...)
   - speed         (fast, slow, waiting, quick...)
   - service       (waiter, staff, rude, friendly, helpful...)
   - value         (expensive, cheap, worth it, overpriced...)
   - cleanliness   (clean, dirty, hygiene...)

Generates a weekly summary report with trends.
"""

import re
import math
from collections import defaultdict
from textblob import TextBlob
from utils.database import fetch_all, execute, fetch_one
from datetime import datetime, timedelta

# ── Keyword Dictionaries ────────────────────────────────────────────────────

CATEGORY_KEYWORDS = {
    "food_quality": {
        "positive": [
            "delicious", "tasty", "amazing", "great food", "loved the food",
            "flavourful", "flavorful", "fresh", "perfect", "excellent taste",
            "wonderful", "superb", "divine", "heavenly", "authentic",
            "well cooked", "well-cooked", "spiced perfectly", "yummy", "scrumptious"
        ],
        "negative": [
            "bland", "tasteless", "bad food", "terrible food", "horrible",
            "undercooked", "overcooked", "stale", "cold food", "raw",
            "salty", "too spicy", "disgusting", "awful", "worst food",
            "no flavour", "no flavor", "disappointing food"
        ],
    },
    "speed": {
        "positive": [
            "fast", "quick", "prompt", "speedy", "on time", "timely",
            "no wait", "quick service", "delivered fast", "immediate"
        ],
        "negative": [
            "slow", "too long", "waited", "waiting forever", "late",
            "delayed", "took ages", "very slow", "long wait",
            "never came", "forgot our order", "took too long"
        ],
    },
    "service": {
        "positive": [
            "friendly", "helpful", "attentive", "polite", "kind",
            "great staff", "wonderful service", "excellent service",
            "courteous", "accommodating", "responsive", "warm"
        ],
        "negative": [
            "rude", "unfriendly", "ignored", "bad service", "unhelpful",
            "terrible service", "worst service", "disrespectful",
            "inattentive", "poor service", "dismissive", "arrogant"
        ],
    },
    "value": {
        "positive": [
            "worth it", "value for money", "affordable", "reasonable price",
            "good price", "cheap", "inexpensive", "great deal", "budget friendly"
        ],
        "negative": [
            "expensive", "overpriced", "too costly", "rip off", "not worth",
            "pricey", "costly", "highway robbery", "waste of money"
        ],
    },
    "cleanliness": {
        "positive": [
            "clean", "hygienic", "spotless", "tidy", "well maintained"
        ],
        "negative": [
            "dirty", "unhygienic", "filthy", "cockroach", "insects",
            "garbage", "smell bad", "gross", "unclean"
        ],
    },
}

# ── Core Analysis ───────────────────────────────────────────────────────────

def analyze_sentiment(review_text: str) -> dict:
    """
    Full sentiment analysis of a review.
    Returns detailed breakdown by category.
    """
    if not review_text or not review_text.strip():
        return {
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "categories": {},
            "summary": "No review text provided.",
        }

    text_lower = review_text.lower().strip()

    # ── TextBlob baseline ─────────────────────────────────────────────
    blob = TextBlob(review_text)
    polarity = blob.sentiment.polarity          # -1.0 to 1.0
    subjectivity = blob.sentiment.subjectivity  # 0 = objective, 1 = subjective

    # ── Category scoring ──────────────────────────────────────────────
    category_scores = {}
    category_hits = defaultdict(list)

    for category, keywords in CATEGORY_KEYWORDS.items():
        pos_hits = [kw for kw in keywords["positive"] if kw in text_lower]
        neg_hits = [kw for kw in keywords["negative"] if kw in text_lower]

        if not pos_hits and not neg_hits:
            continue  # Category not mentioned

        pos_score = len(pos_hits)
        neg_score = len(neg_hits)
        total = pos_score + neg_score

        # Score between -1 and 1
        cat_score = (pos_score - neg_score) / total if total > 0 else 0.0

        # Blend with TextBlob polarity
        cat_score = 0.7 * cat_score + 0.3 * polarity
        cat_score = max(-1.0, min(1.0, cat_score))

        category_scores[category] = round(cat_score, 3)
        category_hits[category] = {"positive": pos_hits, "negative": neg_hits}

    # ── Overall sentiment ─────────────────────────────────────────────
    if category_scores:
        # Average category scores + TextBlob
        avg_cat = sum(category_scores.values()) / len(category_scores)
        final_score = 0.6 * avg_cat + 0.4 * polarity
    else:
        final_score = polarity

    final_score = round(max(-1.0, min(1.0, final_score)), 3)

    if final_score >= 0.15:
        sentiment_label = "positive"
    elif final_score <= -0.15:
        sentiment_label = "negative"
    else:
        sentiment_label = "neutral"

    # ── Auto summary ──────────────────────────────────────────────────
    summary = _build_summary(sentiment_label, category_scores, category_hits)

    return {
        "sentiment": sentiment_label,
        "sentiment_score": final_score,
        "subjectivity": round(subjectivity, 3),
        "categories": category_scores,
        "category_hits": dict(category_hits),
        "textblob_polarity": round(polarity, 3),
        "summary": summary,
    }


def _build_summary(sentiment: str, cat_scores: dict, cat_hits: dict) -> str:
    """Build a human-readable summary of the analysis."""
    parts = []

    emoji_map = {
        "food_quality": "🍛",
        "speed": "⚡",
        "service": "👨‍🍳",
        "value": "💰",
        "cleanliness": "✨",
    }

    for cat, score in sorted(cat_scores.items(), key=lambda x: abs(x[1]), reverse=True):
        hits = cat_hits.get(cat, {})
        label = cat.replace("_", " ").title()
        icon = emoji_map.get(cat, "•")
        if score >= 0.15:
            kws = hits.get("positive", [])[:2]
            parts.append(f'{icon} {label}: Positive ({", ".join(kws)})')
        elif score <= -0.15:
            kws = hits.get("negative", [])[:2]
            parts.append(f'{icon} {label}: Needs improvement ({", ".join(kws)})')

    if not parts:
        return f"Overall {sentiment} review."

    return " | ".join(parts)


# ── Save to Database ────────────────────────────────────────────────────────

def save_feedback(
    review_text: str,
    rating: int,
    order_id: int = None,
    table_id: int = None,
    item_ratings: dict = None,  # {menu_item_id: rating}
) -> dict:
    """Analyze and save a customer review."""
    analysis = analyze_sentiment(review_text)

    import json
    execute("""
        INSERT INTO customer_feedback
            (order_id, table_id, review_text, rating,
             sentiment, sentiment_score, categories)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        order_id, table_id, review_text, rating,
        analysis["sentiment"],
        analysis["sentiment_score"],
        json.dumps(analysis["categories"]),
    ))

    # Get the feedback id we just inserted
    row = fetch_one("""
        SELECT id FROM customer_feedback
        WHERE review_text = %s
        ORDER BY created_at DESC LIMIT 1
    """, (review_text,))

    if row and item_ratings:
        for item_id, item_rating in item_ratings.items():
            execute("""
                INSERT INTO item_ratings (feedback_id, menu_item_id, rating)
                VALUES (%s, %s, %s)
                ON CONFLICT (feedback_id, menu_item_id) DO NOTHING
            """, (row["id"], item_id, item_rating))

    return {"feedback_id": row["id"] if row else None, "analysis": analysis}


# ── Weekly Report ───────────────────────────────────────────────────────────

def generate_weekly_report(days: int = 7) -> dict:
    """
    Generate a full analytics report for the past N days.
    Shows sentiment trends, top complaints, best categories.
    """
    since = datetime.now() - timedelta(days=days)

    reviews = fetch_all("""
        SELECT sentiment, sentiment_score, categories, rating, created_at
        FROM customer_feedback
        WHERE created_at >= %s
        ORDER BY created_at DESC
    """, (since,))

    if not reviews:
        return {
            "period_days": days,
            "total_reviews": 0,
            "message": "No reviews in this period yet.",
        }

    import json

    total = len(reviews)
    sentiments = [r["sentiment"] for r in reviews]
    scores = [float(r["sentiment_score"]) for r in reviews]
    ratings = [r["rating"] for r in reviews if r["rating"]]

    # Category aggregation
    cat_totals = defaultdict(list)
    for r in reviews:
        cats = r["categories"]
        if isinstance(cats, str):
            cats = json.loads(cats)
        for cat, score in (cats or {}).items():
            cat_totals[cat].append(float(score))

    cat_averages = {
        cat: round(sum(scores_) / len(scores_), 3)
        for cat, scores_ in cat_totals.items()
        if scores_
    }

    # Trend: compare first half vs second half
    mid = total // 2
    first_half_avg = sum(scores[:mid]) / max(mid, 1)
    second_half_avg = sum(scores[mid:]) / max(total - mid, 1)
    trend = "improving" if second_half_avg > first_half_avg + 0.05 else \
            "declining" if second_half_avg < first_half_avg - 0.05 else "stable"

    # Top issues (most negative categories)
    issues = sorted(
        [(cat, avg) for cat, avg in cat_averages.items() if avg < -0.1],
        key=lambda x: x[1]
    )

    # Top strengths (most positive categories)
    strengths = sorted(
        [(cat, avg) for cat, avg in cat_averages.items() if avg > 0.1],
        key=lambda x: -x[1]
    )

    return {
        "period_days": days,
        "total_reviews": total,
        "sentiment_breakdown": {
            "positive": sentiments.count("positive"),
            "neutral": sentiments.count("neutral"),
            "negative": sentiments.count("negative"),
        },
        "average_sentiment_score": round(sum(scores) / total, 3),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "trend": trend,
        "category_scores": cat_averages,
        "top_issues": [
            {"category": c.replace("_", " ").title(), "score": s}
            for c, s in issues[:3]
        ],
        "top_strengths": [
            {"category": c.replace("_", " ").title(), "score": s}
            for c, s in strengths[:3]
        ],
        "recommendation": _make_recommendation(issues, strengths, trend),
    }


def _make_recommendation(issues, strengths, trend):
    """Auto-generate a management recommendation."""
    if not issues and not strengths:
        return "Not enough data for recommendations yet."

    recs = []
    if issues:
        worst_cat = issues[0][0].replace("_", " ")
        recs.append(f"Focus on improving {worst_cat} — it has the most negative feedback.")
    if strengths:
        best_cat = strengths[0][0].replace("_", " ")
        recs.append(f"Highlight your {best_cat} — customers love it.")
    if trend == "improving":
        recs.append("Great news — customer satisfaction is trending upward!")
    elif trend == "declining":
        recs.append("Warning: satisfaction is declining. Review recent complaints immediately.")

    return " ".join(recs)
