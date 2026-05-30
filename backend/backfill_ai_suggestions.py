"""
Backfill AI suggestions for all tickets that have an assigned team
but no existing entry in ticket_ai_suggestions.

Run from the backend/ directory (with the venv active):
    python backfill_ai_suggestions.py

The script loads .env automatically so ANTHROPIC_API_KEY is picked up if set.
Falls back to Ollama (llama3.2:3b) when Anthropic is unavailable.
"""
import os
import sys
import time

# ── Load .env ──────────────────────────────────────────────────────────────────
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

# ── Make app importable ────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal
from app.models.models import Ticket, TicketAISuggestion
from app.services.ai_suggestion_service import generate_and_save


def backfill():
    db = SessionLocal()
    try:
        # Tickets with a team but no AI suggestion yet
        missing = (
            db.query(Ticket)
            .filter(Ticket.assigned_team_id.isnot(None))
            .filter(
                ~db.query(TicketAISuggestion)
                .filter(TicketAISuggestion.ticket_id == Ticket.id)
                .exists()
            )
            .all()
        )

        total = len(missing)
        if total == 0:
            print("All tickets already have AI suggestions. Nothing to do.")
            return

        print(f"Found {total} ticket(s) needing AI suggestions.\n")

        ok = 0
        failed = 0
        for i, ticket in enumerate(missing, 1):
            print(f"[{i}/{total}] {ticket.ticket_no} — {ticket.subject[:60]}")
            result = generate_and_save(db, ticket)
            if result:
                print(f"         OK confidence={float(result.confidence):.2f}")
                ok += 1
            else:
                print("         FAILED generation failed (LLM unavailable or parse error)")
                failed += 1
            # Brief pause to avoid hammering the LLM
            if i < total:
                time.sleep(0.5)

        print(f"\nDone. {ok} succeeded, {failed} failed.")
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
