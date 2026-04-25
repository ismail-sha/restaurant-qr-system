"""
Run this ONCE to add AI-related tables to your existing restaurant_qr database.
Command: python utils/migrate_ai.py
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def migrate():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "restaurant_qr"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    cur = conn.cursor()

    print("Running AI table migrations...")

    # ── 1. Customer feedback & sentiment ───────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS customer_feedback (
            id          SERIAL PRIMARY KEY,
            order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
            table_id    INTEGER REFERENCES tables(id) ON DELETE SET NULL,
            review_text TEXT NOT NULL,
            rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
            sentiment   VARCHAR(20),        -- 'positive' | 'neutral' | 'negative'
            sentiment_score FLOAT,          -- -1.0 to 1.0
            categories  JSONB DEFAULT '{}', -- {"food": 0.8, "speed": -0.3, "service": 0.5}
            created_at  TIMESTAMP DEFAULT NOW()
        );
    """)
    print("  ✅ customer_feedback table created")

    # ── 2. Order item ratings (used for recommendations) ───────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS item_ratings (
            id           SERIAL PRIMARY KEY,
            feedback_id  INTEGER REFERENCES customer_feedback(id) ON DELETE CASCADE,
            menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
            rating       INTEGER CHECK (rating BETWEEN 1 AND 5),
            created_at   TIMESTAMP DEFAULT NOW(),
            UNIQUE (feedback_id, menu_item_id)
        );
    """)
    print("  ✅ item_ratings table created")

    # ── 3. ML model metadata (track training history) ──────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ml_model_log (
            id           SERIAL PRIMARY KEY,
            model_name   VARCHAR(100) NOT NULL,
            trained_at   TIMESTAMP DEFAULT NOW(),
            accuracy     FLOAT,
            num_samples  INTEGER,
            notes        TEXT
        );
    """)
    print("  ✅ ml_model_log table created")

    # ── 4. Prep time actual vs predicted (for model improvement) ───────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS prep_time_log (
            id               SERIAL PRIMARY KEY,
            order_id         INTEGER REFERENCES orders(id) ON DELETE CASCADE,
            predicted_minutes INTEGER,
            actual_minutes   INTEGER,
            queue_size       INTEGER,
            hour_of_day      INTEGER,
            day_of_week      INTEGER,
            created_at       TIMESTAMP DEFAULT NOW()
        );
    """)
    print("  ✅ prep_time_log table created")

    # ── 5. Recommendation log (track what was shown & clicked) ─────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS recommendation_log (
            id              SERIAL PRIMARY KEY,
            table_id        INTEGER REFERENCES tables(id),
            recommended_ids INTEGER[],
            clicked_id      INTEGER REFERENCES menu_items(id),
            created_at      TIMESTAMP DEFAULT NOW()
        );
    """)
    print("  ✅ recommendation_log table created")

    conn.commit()
    cur.close()
    conn.close()
    print("\n✅ All AI migrations done!")

if __name__ == "__main__":
    migrate()
