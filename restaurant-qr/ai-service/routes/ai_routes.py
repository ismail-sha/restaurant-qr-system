"""
All AI API routes exposed by the FastAPI service.
Your Node.js backend calls these endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import models.recommendation as rec_model
import models.prep_time as prep_model
import models.sentiment as sentiment_model

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
# 1. RECOMMENDATION SYSTEM
# ════════════════════════════════════════════════════════════════════

class RecommendRequest(BaseModel):
    cart_item_ids: List[int] = Field(..., description="IDs of items currently in cart")
    table_id: Optional[int] = None
    top_n: Optional[int] = 4

class RecommendResponse(BaseModel):
    recommendations: list
    model_trained: bool
    message: str

@router.post("/recommend", response_model=RecommendResponse)
def get_recommendations(body: RecommendRequest):
    """
    Given items in a customer's cart, suggest other items they might like.
    Called by the customer app in real time.
    """
    try:
        model = rec_model.get_model()
        recs = model.recommend(
            cart_item_ids=body.cart_item_ids,
            table_id=body.table_id,
            top_n=body.top_n,
        )
        return {
            "recommendations": recs,
            "model_trained": model.is_trained,
            "message": f"Found {len(recs)} recommendations",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recommend/retrain")
def retrain_recommendations():
    """Force retrain the recommendation model. Call after bulk order imports."""
    result = rec_model.retrain()
    return result


# ════════════════════════════════════════════════════════════════════
# 2. KITCHEN PREP TIME PREDICTOR
# ════════════════════════════════════════════════════════════════════

class OrderItem(BaseModel):
    menu_item_id: int
    quantity: int = 1
    prep_time_minutes: int = 15
    category_name: Optional[str] = ""

class PrepTimeRequest(BaseModel):
    items: List[OrderItem]
    queue_size: Optional[int] = None   # if None, reads from DB

class PrepTimeResponse(BaseModel):
    predicted_minutes: int
    confidence: str     # "high" | "medium" | "low"
    method: str         # "ml_model" | "rule_based"
    breakdown: dict
    queue_size: int
    message: str

@router.post("/predict-prep-time", response_model=PrepTimeResponse)
def predict_prep_time(body: PrepTimeRequest):
    """
    Predict how long an order will take given its items and current kitchen queue.
    Called by Node.js backend when a new order is placed.
    """
    try:
        model = prep_model.get_model()
        items = [item.dict() for item in body.items]
        result = model.predict(items=items, queue_size=body.queue_size)

        conf_map = {"high": "Based on 50+ orders", "medium": "Based on limited data", "low": "Estimated"}
        result["message"] = conf_map.get(result["confidence"], "")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict-prep-time/retrain")
def retrain_prep_time():
    """Retrain the prep time model on latest order history."""
    result = prep_model.retrain()
    return result

@router.get("/predict-prep-time/stats")
def prep_time_stats():
    """Get model performance stats."""
    model = prep_model.get_model()
    return {
        "is_trained": model.is_trained,
        "mae_minutes": model.mae,
        "num_training_samples": model.num_samples,
        "method": "RandomForestRegressor" if model.is_trained else "Rule-based fallback",
    }


# ════════════════════════════════════════════════════════════════════
# 3. SENTIMENT & FEEDBACK ANALYSIS
# ════════════════════════════════════════════════════════════════════

class FeedbackRequest(BaseModel):
    review_text: str = Field(..., min_length=3)
    rating: int = Field(..., ge=1, le=5)
    order_id: Optional[int] = None
    table_id: Optional[int] = None
    item_ratings: Optional[Dict[str, int]] = None  # {"12": 4, "7": 5}

class AnalyzeOnlyRequest(BaseModel):
    text: str

@router.post("/feedback/analyze")
def analyze_only(body: AnalyzeOnlyRequest):
    """
    Analyze sentiment without saving. Used for live preview as user types.
    """
    if not body.text.strip():
        return {"sentiment": "neutral", "sentiment_score": 0.0, "categories": {}}
    result = sentiment_model.analyze_sentiment(body.text)
    return result

@router.post("/feedback/submit")
def submit_feedback(body: FeedbackRequest):
    """
    Save a customer review with full sentiment analysis.
    Called when customer submits feedback after their meal.
    """
    try:
        item_ratings_int = None
        if body.item_ratings:
            item_ratings_int = {int(k): v for k, v in body.item_ratings.items()}

        result = sentiment_model.save_feedback(
            review_text=body.review_text,
            rating=body.rating,
            order_id=body.order_id,
            table_id=body.table_id,
            item_ratings=item_ratings_int,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedback/report")
def get_weekly_report(days: int = 7):
    """
    Generate a weekly sentiment/analytics report for the restaurant owner.
    """
    try:
        return sentiment_model.generate_weekly_report(days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedback/recent")
def get_recent_feedback(limit: int = 20):
    """Get recent customer reviews with sentiment scores."""
    from utils.database import fetch_all
    rows = fetch_all("""
        SELECT cf.id, cf.review_text, cf.rating, cf.sentiment,
               cf.sentiment_score, cf.categories, cf.created_at,
               t.table_number
        FROM customer_feedback cf
        LEFT JOIN tables t ON t.id = cf.table_id
        ORDER BY cf.created_at DESC
        LIMIT %s
    """, (limit,))
    return {"reviews": rows}


# ════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ════════════════════════════════════════════════════════════════════

@router.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            "recommendation": "ready",
            "prep_time": "ready",
            "sentiment": "ready",
        }
    }
