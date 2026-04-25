import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    """Get a fresh PostgreSQL connection."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "restaurant_qr"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )

def fetch_all(query: str, params=None):
    """Run a SELECT query and return all rows as dicts."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or ())
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()

def fetch_one(query: str, params=None):
    """Run a SELECT query and return one row as dict."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or ())
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()

def execute(query: str, params=None):
    """Run an INSERT/UPDATE/DELETE query."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
        conn.commit()
    finally:
        conn.close()
