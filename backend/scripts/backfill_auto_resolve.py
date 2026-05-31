"""
Backfill Auto-Resolve Script
============================
Run this once to push all existing OPEN / IN_PROGRESS / NEW tickets
through the KB similarity pipeline.

Tickets that score >= 90% confidence and have priority P3/P4/P5 will be
moved to AI_RESOLVED_PENDING_USER_CONFIRMATION automatically.

Usage (from the backend/ directory):
    python scripts/backfill_auto_resolve.py

Or with a dry-run to see what would be affected without making changes:
    python scripts/backfill_auto_resolve.py --dry-run
"""

import sys
import os
import argparse
import datetime

# Make sure the app package is importable when running from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import SessionLocal
from app.models.models import Ticket

# All statuses that represent an unresolved ticket — includes post-classification states
_BACKFILL_STATUSES = {
    "OPEN", "NEW", "IN_PROGRESS",
    "ASSIGNED",              # set by classification pipeline after auto-assign
    "PENDING_ADMIN_REVIEW",  # set by classification when confidence is low
    "PENDING_USER",
    "PENDING_VENDOR",
    "ESCALATED",
    "ON_HOLD",
}
_AUTO_RESOLVE_ELIGIBLE = {"P3", "P4", "P5"}


def run(dry_run: bool = False):
    db = SessionLocal()
    try:
        tickets = (
            db.query(Ticket)
            .filter(Ticket.status.in_(list(_BACKFILL_STATUSES)))
            .all()
        )

        total = len(tickets)
        print(f"\n{'[DRY RUN] ' if dry_run else ''}Found {total} ticket(s) with status in {_BACKFILL_STATUSES}\n")

        if total == 0:
            print("Nothing to process. Exiting.")
            return

        from app.services.kb_similarity_service import run_resolution_confidence

        processed = 0
        auto_resolved = 0
        skipped_priority = 0
        errors = 0

        for ticket in tickets:
            label = getattr(ticket, "ticket_no", str(ticket.id))
            priority = (ticket.priority or "P3").upper()

            if priority not in _AUTO_RESOLVE_ELIGIBLE:
                print(f"  SKIP  {label}  [{priority}] — P1/P2 always routed to team")
                skipped_priority += 1
                continue

            try:
                if dry_run:
                    print(f"  WOULD process  {label}  [{priority}]")
                    processed += 1
                    continue

                result = run_resolution_confidence(db, ticket)
                db.refresh(ticket)

                final = result.get("final_resolution_confidence", 0)
                decision = result.get("decision", "ROUTE_TO_TEAM")

                if ticket.status == "AI_RESOLVED_PENDING_USER_CONFIRMATION":
                    print(f"  AUTO-RESOLVED  {label}  [{priority}]  confidence={final:.1f}%  decision={decision}")
                    auto_resolved += 1
                else:
                    print(f"  processed      {label}  [{priority}]  confidence={final:.1f}%  decision={decision}")

                processed += 1

            except Exception as e:
                print(f"  ERROR  {label}: {e}")
                errors += 1

        print(f"""
{'[DRY RUN] ' if dry_run else ''}Backfill complete
─────────────────────────────
  Total found     : {total}
  Processed       : {processed}
  Auto-resolved   : {auto_resolved}
  Skipped (P1/P2) : {skipped_priority}
  Errors          : {errors}
  Timestamp       : {datetime.datetime.now().isoformat(timespec='seconds')}
""")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill AI auto-resolve for existing open tickets")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be processed without making any changes",
    )
    args = parser.parse_args()
    run(dry_run=args.dry_run)
