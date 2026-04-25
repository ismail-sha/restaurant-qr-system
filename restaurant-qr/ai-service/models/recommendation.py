"""
RECOMMENDATION SYSTEM
=====================
Uses two approaches combined:
1. Collaborative Filtering  — "people who ordered X also ordered Y"
   (uses cosine similarity on order co-occurrence matrix)
2. Content-Based Filtering  — "items similar to what you like"
   (uses item features: category, price, spice level, veg/non-veg)

Falls back to popularity-based ranking when not enough data exists.
"""

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import joblib
import os
from utils.database import fetch_all

MODEL_PATH = "models/saved/recommendation_model.pkl"


# ── Helpers ────────────────────────────────────────────────────────────────

def load_order_history():
    """Load all past order items from the database."""
    return fetch_all("""
        SELECT
            oi.order_id,
            oi.menu_item_id,
            oi.quantity,
            mi.category_id,
            mi.price,
            mi.spice_level,
            mi.is_vegetarian,
            mi.prep_time_minutes,
            o.table_id
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled')
        ORDER BY oi.order_id
    """)

def load_all_menu_items():
    """Load all available menu items."""
    return fetch_all("""
        SELECT id, name, category_id, price, spice_level,
               is_vegetarian, prep_time_minutes, emoji
        FROM menu_items
        WHERE is_available = true
        ORDER BY id
    """)

def load_item_ratings():
    """Load explicit item ratings if any exist."""
    return fetch_all("""
        SELECT menu_item_id, AVG(rating) as avg_rating, COUNT(*) as num_ratings
        FROM item_ratings
        GROUP BY menu_item_id
    """)


# ── Model Building ─────────────────────────────────────────────────────────

class RecommendationModel:
    def __init__(self):
        self.co_occurrence_matrix = None   # item × item similarity
        self.content_matrix = None          # item × item content similarity
        self.item_ids = []
        self.item_details = {}
        self.item_popularity = {}           # item_id → order count
        self.is_trained = False

    def train(self):
        """Train both collaborative and content-based models."""
        print("Training recommendation model...")

        menu_items = load_all_menu_items()
        if not menu_items:
            print("  ⚠️  No menu items found.")
            return

        self.item_ids = [item["id"] for item in menu_items]
        self.item_details = {item["id"]: item for item in menu_items}

        # ── 1. Content-based matrix ──────────────────────────────────────
        features = []
        for item in menu_items:
            features.append([
                item["category_id"] or 0,
                float(item["price"]),
                item["spice_level"] or 0,
                int(item["is_vegetarian"]),
                item["prep_time_minutes"] or 15,
            ])

        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        self.content_matrix = cosine_similarity(features_scaled)

        # ── 2. Collaborative filtering matrix ────────────────────────────
        order_history = load_order_history()
        if order_history:
            df = pd.DataFrame(order_history)

            # Build order × item matrix (1 if item was in that order)
            order_item = df.pivot_table(
                index="order_id",
                columns="menu_item_id",
                values="quantity",
                fill_value=0
            ).clip(upper=1)  # binary: ordered or not

            # Popularity: how many orders each item appeared in
            self.item_popularity = order_item.sum().to_dict()

            # Align columns to our item_ids
            for item_id in self.item_ids:
                if item_id not in order_item.columns:
                    order_item[item_id] = 0
            order_item = order_item[self.item_ids]

            # Item-item cosine similarity
            item_matrix = order_item.T.values
            if item_matrix.shape[1] > 1:
                self.co_occurrence_matrix = cosine_similarity(item_matrix)
            else:
                self.co_occurrence_matrix = np.zeros((len(self.item_ids), len(self.item_ids)))
        else:
            self.co_occurrence_matrix = np.zeros((len(self.item_ids), len(self.item_ids)))
            self.item_popularity = {iid: 0 for iid in self.item_ids}

        self.is_trained = True
        print(f"  ✅ Trained on {len(menu_items)} items, {len(order_history)} order records")

    def recommend(self, cart_item_ids: list, table_id: int = None, top_n: int = 5) -> list:
        """
        Given items currently in the cart, recommend other items.
        Returns list of dicts: [{id, name, emoji, reason, score}, ...]
        """
        if not self.is_trained or not self.item_ids:
            return self._fallback_popular(top_n, exclude=cart_item_ids)

        n = len(self.item_ids)
        scores = np.zeros(n)

        for cart_id in cart_item_ids:
            if cart_id not in self.item_ids:
                continue
            idx = self.item_ids.index(cart_id)

            # Weighted combination: 60% collaborative + 40% content
            collab = self.co_occurrence_matrix[idx] if self.co_occurrence_matrix is not None else np.zeros(n)
            content = self.content_matrix[idx] if self.content_matrix is not None else np.zeros(n)
            scores += 0.6 * collab + 0.4 * content

        # Boost by popularity (log scale so it doesn't dominate)
        for i, item_id in enumerate(self.item_ids):
            pop = self.item_popularity.get(item_id, 0)
            scores[i] += 0.1 * np.log1p(pop)

        # Zero out items already in cart
        for cart_id in cart_item_ids:
            if cart_id in self.item_ids:
                scores[self.item_ids.index(cart_id)] = 0

        # Zero out unavailable items (all items in self.item_ids are available)
        top_indices = np.argsort(scores)[::-1][:top_n]

        recommendations = []
        for idx in top_indices:
            if scores[idx] <= 0:
                continue
            item_id = self.item_ids[idx]
            item = self.item_details.get(item_id, {})
            pop = self.item_popularity.get(item_id, 0)

            # Human-readable reason
            if scores[idx] > 0.7:
                reason = "Frequently ordered together"
            elif item.get("is_vegetarian"):
                reason = "Popular vegetarian choice"
            elif pop > 5:
                reason = f"Ordered {int(pop)} times"
            else:
                reason = "You might enjoy this"

            recommendations.append({
                "id": item_id,
                "name": item.get("name", ""),
                "emoji": item.get("emoji", "🍽️"),
                "price": float(item.get("price", 0)),
                "reason": reason,
                "score": round(float(scores[idx]), 3),
            })

        if not recommendations:
            return self._fallback_popular(top_n, exclude=cart_item_ids)

        return recommendations

    def _fallback_popular(self, top_n: int, exclude: list) -> list:
        """Return most popular items when model can't give recommendations."""
        sorted_items = sorted(
            self.item_popularity.items(),
            key=lambda x: x[1],
            reverse=True
        )
        result = []
        for item_id, count in sorted_items:
            if item_id in exclude:
                continue
            item = self.item_details.get(item_id, {})
            if not item:
                continue
            result.append({
                "id": item_id,
                "name": item.get("name", ""),
                "emoji": item.get("emoji", "🍽️"),
                "price": float(item.get("price", 0)),
                "reason": "Most popular item",
                "score": round(count / max(1, max(self.item_popularity.values())), 3),
            })
            if len(result) >= top_n:
                break

        # If still nothing, return first few menu items
        if not result:
            for item_id in self.item_ids[:top_n]:
                if item_id in exclude:
                    continue
                item = self.item_details.get(item_id, {})
                result.append({
                    "id": item_id,
                    "name": item.get("name", ""),
                    "emoji": item.get("emoji", "🍽️"),
                    "price": float(item.get("price", 0)),
                    "reason": "Chef's suggestion",
                    "score": 0.1,
                })
        return result


# ── Singleton instance ──────────────────────────────────────────────────────

_model_instance = None

def get_model() -> RecommendationModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = RecommendationModel()
        _model_instance.train()
    return _model_instance

def retrain():
    """Force retrain the model (call after new orders come in)."""
    global _model_instance
    _model_instance = RecommendationModel()
    _model_instance.train()
    return {"status": "retrained", "items": len(_model_instance.item_ids)}
