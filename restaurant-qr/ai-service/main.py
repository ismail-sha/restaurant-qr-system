"""
AI Microservice — Main Entry Point
===================================
Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routes.ai_routes import router

app = FastAPI(
    title="Restaurant AI Service",
    description="ML-powered recommendations, prep time prediction, and sentiment analysis",
    version="1.0.0",
)

# Allow calls from Node.js backend and React apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("BACKEND_URL", "http://localhost:5000"),
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/ai")

@app.on_event("startup")
async def startup():
    """Pre-load all models at startup so first request is fast."""
    print("\n🤖 Loading AI models...")
    try:
        import models.recommendation as rec
        import models.prep_time as prep
        rec.get_model()
        prep.get_model()
        print("✅ All models loaded\n")
    except Exception as e:
        print(f"⚠️  Model load warning: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("AI_SERVICE_PORT", 8000)), reload=True)
