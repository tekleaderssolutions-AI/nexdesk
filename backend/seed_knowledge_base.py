"""
Migrate knowledge_base table to new schema and seed with ticketops_synthetic_200.xlsx data.

Run from the backend/ directory:
    python seed_knowledge_base.py
Or from the project root:
    python backend/seed_knowledge_base.py
"""
import os
import sys
import uuid

# Allow imports from backend/
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/nextdesk"
)

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ticketops_synthetic_200.xlsx")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def migrate():
    """Drop and recreate knowledge_base with the new schema."""
    with engine.begin() as conn:
        # Drop dependent tables first
        conn.execute(text("DROP TABLE IF EXISTS kb_feedback CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS kb_embeddings CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS knowledge_base CASCADE"))
        conn.execute(text("""
            CREATE TABLE knowledge_base (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_ref VARCHAR(50),
                title VARCHAR(500) NOT NULL,
                description TEXT,
                resolution TEXT NOT NULL,
                category VARCHAR(100),
                priority VARCHAR(10),
                assigned_team VARCHAR(255),
                resolution_time VARCHAR(50),
                tags TEXT,
                is_published BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE kb_embeddings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                kb_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
                embedding_text TEXT,
                embedding_model VARCHAR(255),
                vector_id VARCHAR(255)
            )
        """))
        conn.execute(text("""
            CREATE TABLE kb_feedback (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                kb_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(user_id),
                rating INTEGER CHECK (rating BETWEEN 1 AND 5),
                feedback_text TEXT
            )
        """))
    print("[migrate] knowledge_base schema recreated.")


def seed():
    """Insert all 200 rows from the Excel file."""
    df = pd.read_excel(EXCEL_PATH, sheet_name="Tickets")
    df.columns = [c.strip() for c in df.columns]

    rows = []
    for _, row in df.iterrows():
        rows.append({
            "id": str(uuid.uuid4()),
            "ticket_ref": str(row.get("TICKET ID", "")).strip() or None,
            "title": str(row.get("TICKET SUBJECT", "")).strip(),
            "description": str(row.get("SHORT DESCRIPTION", "")).strip() or None,
            "resolution": str(row.get("RESOLUTION", "")).strip(),
            "category": str(row.get("CATEGORY", "")).strip() or None,
            "priority": str(row.get("PRIORITY", "")).strip() or None,
            "assigned_team": str(row.get("ASSIGNED TEAM", "")).strip() or None,
            "resolution_time": str(row.get("RESOLUTION TIME", "")).strip() or None,
            "tags": None,
            "is_published": True,
        })

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO knowledge_base
                    (id, ticket_ref, title, description, resolution, category,
                     priority, assigned_team, resolution_time, tags, is_published)
                VALUES
                    (:id, :ticket_ref, :title, :description, :resolution, :category,
                     :priority, :assigned_team, :resolution_time, :tags, :is_published)
            """),
            rows,
        )
    print(f"[seed] Inserted {len(rows)} knowledge base articles.")


if __name__ == "__main__":
    migrate()
    seed()
    print("Done.")
