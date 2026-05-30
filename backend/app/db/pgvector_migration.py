"""PostgreSQL pgvector initialization and migration utilities."""
import os
from sqlalchemy import text
from sqlalchemy.orm import Session


def init_pgvector(db: Session) -> None:
    """Initialize pgvector extension in PostgreSQL database."""
    try:
        print("[PGVECTOR] Enabling pgvector extension...")
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        db.commit()
        print("[PGVECTOR] pgvector extension enabled successfully")
    except Exception as e:
        print(f"[PGVECTOR] Error enabling pgvector: {e}")
        db.rollback()
        raise


def migrate_ticket_embeddings(db: Session) -> None:
    """
    Migrate ticket_embeddings table to new schema.
    Adds: masked_text, embedding VECTOR(384), created_at
    """
    try:
        print("[MIGRATION] Starting ticket_embeddings migration...")

        # Check if masked_text column exists
        result = db.execute(text(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='ticket_embeddings' AND column_name='masked_text'
            );
            """
        )).scalar()

        if not result:
            print("[MIGRATION] Adding masked_text column...")
            db.execute(text("""
                ALTER TABLE ticket_embeddings
                ADD COLUMN masked_text TEXT;
            """))
            print("[MIGRATION] masked_text column added")

        # Check if embedding column exists
        result = db.execute(text(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='ticket_embeddings' AND column_name='embedding'
            );
            """
        )).scalar()

        if not result:
            print("[MIGRATION] Adding embedding column (VECTOR 384)...")
            db.execute(text("""
                ALTER TABLE ticket_embeddings
                ADD COLUMN embedding vector(384);
            """))
            print("[MIGRATION] embedding column added")

        # Check if created_at column exists
        result = db.execute(text(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='ticket_embeddings' AND column_name='created_at'
            );
            """
        )).scalar()

        if not result:
            print("[MIGRATION] Adding created_at column...")
            db.execute(text("""
                ALTER TABLE ticket_embeddings
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            """))
            print("[MIGRATION] created_at column added")

        # Create index on embedding vector. Use pg_indexes to check existence
        result = db.execute(text(
            """
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename='ticket_embeddings' AND indexname='idx_ticket_embedding'
            );
            """
        )).scalar()

        if not result:
            print("[MIGRATION] Creating cosine similarity index...")
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_ticket_embedding
                ON ticket_embeddings
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """))
            print("[MIGRATION] Index created")

        db.commit()
        print("[MIGRATION] ticket_embeddings migration completed successfully")

    except Exception as e:
        print(f"[MIGRATION] Error during migration: {e}")
        db.rollback()
        raise


def migrate_kb_embeddings(db: Session) -> None:
    """
    Add vector(384) embedding column and cosine index to kb_embeddings table.
    """
    try:
        print("[MIGRATION] Starting kb_embeddings migration...")

        result = db.execute(text(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='kb_embeddings' AND column_name='embedding'
            );
            """
        )).scalar()

        if not result:
            print("[MIGRATION] Adding kb_embeddings.embedding column (VECTOR 384)...")
            db.execute(text("ALTER TABLE kb_embeddings ADD COLUMN embedding vector(384);"))
            print("[MIGRATION] kb_embeddings.embedding column added")

        result = db.execute(text(
            """
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename='kb_embeddings' AND indexname='idx_kb_embedding'
            );
            """
        )).scalar()

        if not result:
            print("[MIGRATION] Creating kb_embeddings cosine index...")
            db.execute(text(
                """
                CREATE INDEX IF NOT EXISTS idx_kb_embedding
                ON kb_embeddings
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 10);
                """
            ))
            print("[MIGRATION] kb_embeddings index created")

        db.commit()
        print("[MIGRATION] kb_embeddings migration completed successfully")

    except Exception as e:
        print(f"[MIGRATION] kb_embeddings migration error: {e}")
        db.rollback()
