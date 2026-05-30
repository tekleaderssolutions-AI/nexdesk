"""
Backfill classifier — re-runs the full classification pipeline on existing tickets.

Targets all tickets whose status is not a terminal state (CLOSED / RESOLVED).
Use --status to restrict to a specific status, --force to include closed tickets.

Run from the backend/ directory:
    python backfill_classify.py [--dry-run] [--limit N] [--status OPEN] [--force]
"""
import sys
import argparse
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal
from app.models.models import Ticket
from app.services.classification_service import run_classification_pipeline

# Statuses that are candidates for re-classification by default
_DEFAULT_ELIGIBLE = {"OPEN", "PENDING_ADMIN_REVIEW", "ASSIGNED"}


def run(dry_run: bool = False, limit: int = 0, force: bool = False, status_filter: str = ""):
    db = SessionLocal()
    try:
        if force:
            query = db.query(Ticket)
        elif status_filter:
            query = db.query(Ticket).filter(Ticket.status == status_filter.upper())
        else:
            query = db.query(Ticket).filter(Ticket.status.in_(_DEFAULT_ELIGIBLE))

        query = query.order_by(Ticket.created_at.asc())

        if limit:
            query = query.limit(limit)

        tickets = query.all()
        total = len(tickets)
        print(f"[BACKFILL] Found {total} ticket(s) to process")

        if total == 0:
            print("[BACKFILL] Nothing to do.")
            return

        ok = fail = skip = 0

        for i, ticket in enumerate(tickets, 1):
            print(f"\n[{i}/{total}] {ticket.ticket_no} — {ticket.subject[:60]}")

            if dry_run:
                print("  [DRY-RUN] skipping")
                skip += 1
                continue

            try:
                result = run_classification_pipeline(db, ticket)
                team = result.get("team") or {}
                print(
                    f"  category={result.get('category_name','?')} / subcategory={result.get('subcategory_name','?')}\n"
                    f"  team={team.get('name','?')}  priority={result.get('priority','?')}  "
                    f"impact={result.get('impact','?')}  urgency={result.get('urgency','?')}\n"
                    f"  confidence={result.get('confidence',0):.2f}  routing={result.get('routing_decision','?')}"
                )
                print(f"  -> status={ticket.status}  [OK]")
                ok += 1

            except Exception as exc:
                print(f"  [ERROR] {exc}")
                try:
                    db.rollback()
                except Exception:
                    pass
                fail += 1

        print(
            f"\n[BACKFILL] Done — ok={ok}  failed={fail}  skipped={skip}  total={total}"
        )

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill classification for existing tickets")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without writing")
    parser.add_argument("--limit", type=int, default=0, metavar="N", help="Process at most N tickets (0=all)")
    parser.add_argument("--force", action="store_true", help="Include CLOSED and RESOLVED tickets")
    parser.add_argument("--status", default="", metavar="STATUS", help="Filter by a single status (e.g. OPEN, PENDING_ADMIN_REVIEW)")
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit, force=args.force, status_filter=args.status)
