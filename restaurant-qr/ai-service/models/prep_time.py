"""
KITCHEN PREP TIME PREDICTOR
============================
Uses a Random Forest Regressor trained on:
- Number of items in the order
- Types of items (mains, starters, etc.)
- Current queue size (how many orders are already cooking)
- Time of day (lunch rush vs quiet period)
- Day of week
- Max individual item prep time
- Whether order has complex items

Falls back to a rule-based estimate when not enough training data.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
import joblib
import os
from datetime import datetime
from utils.database import fetch_all, execute

MODEL_PATH = "models/saved/prep_time_model.pkl"
SCALER_PATH = "models/saved/prep_time_scaler.pkl"

# ── Feature Engineering ────────────────────────────────────────────────────

def build_features(
    num_items: int,
    total_quantity: int,
    max_prep_time: int,
    avg_prep_time: float,
    has_mains: bool,
    has_starters: bool,
    has_drinks: bool,
    queue_size: int,
    hour_of_day: int,
    day_of_week: int,
) -> np.ndarray:
    """Convert order attributes into a feature vector."""

    # Is it a rush hour? (12-2pm lunch, 7-9pm dinner)
    is_lunch_rush = 1 if 12 <= hour_of_day <= 14 else 0
    is_dinner_rush = 1 if 19 <= hour_of_day <= 21 else 0

    # Is it weekend?
    is_weekend = 1 if day_of_week >= 5 else 0

    # Queue pressure: more orders = slower
    queue_pressure = min(queue_size / 10.0, 1.0)  # normalize 0-1

    return np.array([[
        num_items,
        total_quantity,
        max_prep_time,
        avg_prep_time,
        int(has_mains),
        int(has_starters),
        int(has_drinks),
        queue_size,
        queue_pressure,
        hour_of_day,
        day_of_week,
        is_lunch_rush,
        is_dinner_rush,
        is_weekend,
    ]])

FEATURE_NAMES = [
    "num_items", "total_quantity", "max_prep_time", "avg_prep_time",
    "has_mains", "has_starters", "has_drinks", "queue_size",
    "queue_pressure", "hour_of_day", "day_of_week",
    "is_lunch_rush", "is_dinner_rush", "is_weekend",
]

# ── Load Training Data ─────────────────────────────────────────────────────

def load_training_data():
    """Load actual order completion times from the database."""
    rows = fetch_all("""
        SELECT
            o.id as order_id,
            COUNT(DISTINCT oi.menu_item_id) as num_items,
            SUM(oi.quantity) as total_quantity,
            MAX(mi.prep_time_minutes) as max_prep_time,
            AVG(mi.prep_time_minutes) as avg_prep_time,
            BOOL_OR(c.name ILIKE '%main%') as has_mains,
            BOOL_OR(c.name ILIKE '%starter%') as has_starters,
            BOOL_OR(c.name ILIKE '%drink%') as has_drinks,
            EXTRACT(HOUR FROM o.placed_at) as hour_of_day,
            EXTRACT(DOW FROM o.placed_at) as day_of_week,
            EXTRACT(EPOCH FROM (o.ready_at - o.placed_at)) / 60.0 as actual_minutes
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        JOIN categories c ON c.id = mi.category_id
        WHERE o.ready_at IS NOT NULL
          AND o.placed_at IS NOT NULL
          AND o.status NOT IN ('cancelled')
        GROUP BY o.id
        HAVING EXTRACT(EPOCH FROM (o.ready_at - o.placed_at)) / 60.0 BETWEEN 2 AND 90
    """)
    return rows

def get_current_queue_size():
    """How many orders are currently pending/cooking."""
    row = fetch_all("""
        SELECT COUNT(*) as queue_size
        FROM orders
        WHERE status IN ('pending', 'confirmed', 'cooking')
    """)
    return row[0]["queue_size"] if row else 0


# ── Model ──────────────────────────────────────────────────────────────────

class PrepTimeModel:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.mae = None          # mean absolute error in minutes
        self.num_samples = 0

    def train(self):
        """Train on historical order data."""
        print("Training prep time predictor...")
        data = load_training_data()

        if len(data) < 10:
            print(f"  ⚠️  Only {len(data)} completed orders found — using rule-based fallback.")
            print("  ℹ️  Model will improve automatically as more orders are completed.")
            self.is_trained = False
            return

        df = pd.DataFrame(data)

        X = []
        y = []
        for _, row in df.iterrows():
            features = build_features(
                num_items=int(row["num_items"]),
                total_quantity=int(row["total_quantity"]),
                max_prep_time=float(row["max_prep_time"] or 15),
                avg_prep_time=float(row["avg_prep_time"] or 15),
                has_mains=bool(row["has_mains"]),
                has_starters=bool(row["has_starters"]),
                has_drinks=bool(row["has_drinks"]),
                queue_size=0,  # historical queue not tracked in MVP
                hour_of_day=int(row["hour_of_day"] or 12),
                day_of_week=int(row["day_of_week"] or 1),
            )
            X.append(features[0])
            y.append(float(row["actual_minutes"]))

        X = np.array(X)
        y = np.array(y)

        X_scaled = self.scaler.fit_transform(X)

        if len(X) >= 20:
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42
            )
        else:
            X_train, X_test, y_train, y_test = X_scaled, X_scaled, y, y

        # Random Forest: robust, handles non-linear patterns well
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42
        )
        self.model.fit(X_train, y_train)

        preds = self.model.predict(X_test)
        self.mae = mean_absolute_error(y_test, preds)
        self.num_samples = len(data)
        self.is_trained = True

        # Save
        os.makedirs("models/saved", exist_ok=True)
        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)

        print(f"  ✅ Trained on {len(data)} orders | MAE: {self.mae:.1f} min")

        # Log training
        execute("""
            INSERT INTO ml_model_log (model_name, accuracy, num_samples, notes)
            VALUES (%s, %s, %s, %s)
        """, ("prep_time_predictor", round(self.mae, 2), self.num_samples,
              f"RandomForest, MAE={self.mae:.1f}min"))

    def predict(
        self,
        items: list,          # list of {menu_item_id, quantity, prep_time_minutes, category_name}
        queue_size: int = None,
    ) -> dict:
        """
        Predict how long the order will take.
        Returns: {predicted_minutes, confidence, breakdown, method}
        """
        if not items:
            return {"predicted_minutes": 15, "confidence": "low", "method": "default"}

        now = datetime.now()
        hour = now.hour
        dow = now.weekday()

        if queue_size is None:
            queue_size = get_current_queue_size()

        num_items = len(items)
        total_qty = sum(i.get("quantity", 1) for i in items)
        prep_times = [i.get("prep_time_minutes", 15) for i in items]
        max_prep = max(prep_times)
        avg_prep = sum(prep_times) / len(prep_times)
        categories = [str(i.get("category_name", "")).lower() for i in items]
        has_mains = any("main" in c for c in categories)
        has_starters = any("starter" in c for c in categories)
        has_drinks = any("drink" in c for c in categories)

        if self.is_trained and self.model is not None:
            feats = build_features(
                num_items, total_qty, max_prep, avg_prep,
                has_mains, has_starters, has_drinks,
                queue_size, hour, dow,
            )
            feats_scaled = self.scaler.transform(feats)
            pred = float(self.model.predict(feats_scaled)[0])
            pred = max(5, min(pred, 90))  # clamp 5-90 min
            method = "ml_model"
            confidence = "high" if self.num_samples > 50 else "medium"
        else:
            # Rule-based fallback
            pred = max_prep
            if has_mains:
                pred += 3
            if total_qty > 4:
                pred += 5
            # Queue penalty: +2 min per 3 orders in queue
            pred += (queue_size // 3) * 2
            method = "rule_based"
            confidence = "low"

        # Human-readable breakdown
        breakdown = {
            "base_cook_time": max_prep,
            "queue_delay": max(0, (queue_size // 3) * 2),
            "complexity_factor": num_items,
            "rush_hour": hour in range(12, 15) or hour in range(19, 22),
        }

        return {
            "predicted_minutes": round(pred),
            "confidence": confidence,
            "method": method,
            "breakdown": breakdown,
            "queue_size": queue_size,
        }


# ── Singleton ───────────────────────────────────────────────────────────────

_model_instance = None

def get_model() -> PrepTimeModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = PrepTimeModel()
        # Try loading saved model
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            try:
                _model_instance.model = joblib.load(MODEL_PATH)
                _model_instance.scaler = joblib.load(SCALER_PATH)
                _model_instance.is_trained = True
                print("  ✅ Loaded saved prep time model")
            except Exception:
                _model_instance.train()
        else:
            _model_instance.train()
    return _model_instance

def retrain():
    global _model_instance
    _model_instance = PrepTimeModel()
    _model_instance.train()
    return {
        "status": "retrained",
        "mae_minutes": _model_instance.mae,
        "samples": _model_instance.num_samples,
    }
