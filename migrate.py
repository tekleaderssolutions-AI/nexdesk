import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.models import Ticket, TicketEmbedding, User
from app.services.embedding_service import EmbeddingService


def get_session():
    return SessionLocal()


def print_hash(password: str) -> None:
    hashed = hash_password(password)
    print(hashed)


def set_user_password(email: str, password: str, temp: bool = False, dry_run: bool = False) -> None:
    with get_session() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise ValueError(f"User not found for email: {email}")

        new_hash = hash_password(password)
        print(f"User: {email}")
        print(f"  Old hash: {user.password_hash}")
        print(f"  New hash: {new_hash}")
        print(f"  Set is_temp_password = {temp}")

        if not dry_run:
            user.password_hash = new_hash
            user.is_temp_password = temp
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Updated user password in database.")
        else:
            print("Dry run only; no changes written.")


def migrate_csv(path: Path, email_field: str, password_field: str, temp: bool = False, dry_run: bool = False) -> None:
    with path.open(newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        if email_field not in reader.fieldnames:
            raise ValueError(f"CSV missing email field: {email_field}")
        if password_field not in reader.fieldnames:
            raise ValueError(f"CSV missing password field: {password_field}")

        with get_session() as db:
            changed = 0
            for row in reader:
                email = row[email_field].strip()
                password = row[password_field].strip()
                if not email or not password:
                    continue

                user = db.query(User).filter(User.email == email).first()
                if not user:
                    print(f"Skipping missing user: {email}")
                    continue

                new_hash = hash_password(password)
                print(f"Migrating {email}")
                print(f"  New hash: {new_hash}")
                print(f"  Set is_temp_password = {temp}")
                if not dry_run:
                    user.password_hash = new_hash
                    user.is_temp_password = temp
                    db.add(user)
                    changed += 1

            if not dry_run:
                db.commit()
            print(f"Migration complete. Rows changed: {changed}")


def backfill_ticket_embeddings(batch_size: int = 50, dry_run: bool = False) -> None:
    """Backfill ticket embeddings for existing tickets in batches."""
    with get_session() as db:
        total_processed = 0
        while True:
            tickets = (
                db.query(Ticket)
                .outerjoin(TicketEmbedding, TicketEmbedding.ticket_id == Ticket.id)
                .filter(TicketEmbedding.id.is_(None))
                .limit(batch_size)
                .all()
            )

            if not tickets:
                break

            print(f"Processing batch of {len(tickets)} tickets")
            for ticket in tickets:
                masked_text, embedding = EmbeddingService.mask_and_build(
                    subject=ticket.subject,
                    description=ticket.description,
                    attachment_text=" ".join(
                        [f"{a.file_name or ''} {a.file_type or ''}" for a in getattr(ticket, "attachments", [])]
                    ) if getattr(ticket, "attachments", None) else None,
                )
                ticket_embedding = TicketEmbedding(
                    ticket_id=ticket.id,
                    masked_text=masked_text,
                    embedding_text=masked_text[:500],
                    embedding_model=EmbeddingService.MODEL_NAME,
                    embedding=EmbeddingService.generate_embedding(masked_text).tolist(),
                )
                db.add(ticket_embedding)
                total_processed += 1

            if dry_run:
                print("Dry run enabled; rolling back batch")
                db.rollback()
            else:
                db.commit()

        print(f"Backfill complete. Tickets processed: {total_processed}")


def main():
    parser = argparse.ArgumentParser(description="Migration utility for user passwords.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    hash_parser = subparsers.add_parser("hash", help="Print a bcrypt hash for a password.")
    hash_parser.add_argument("password", help="Password to hash.")

    set_parser = subparsers.add_parser("set-password", help="Update a single user's password.")
    set_parser.add_argument("--email", required=True, help="User email address.")
    set_parser.add_argument("--password", required=True, help="New password to hash and store.")
    set_parser.add_argument("--temp", action="store_true", help="Mark the updated password as temporary.")
    set_parser.add_argument("--dry-run", action="store_true", help="Show changes without writing to the database.")

    csv_parser = subparsers.add_parser("migrate-csv", help="Migrate passwords from a CSV file.")
    csv_parser.add_argument("--file", required=True, help="CSV file containing email and password columns.")
    csv_parser.add_argument("--email-field", default="email", help="CSV column name for user email.")
    csv_parser.add_argument("--password-field", default="password", help="CSV column name for plaintext password.")
    csv_parser.add_argument("--temp", action="store_true", help="Mark the migrated passwords as temporary.")
    csv_parser.add_argument("--dry-run", action="store_true", help="Show changes without writing to the database.")

    backfill_parser = subparsers.add_parser("backfill-embeddings", help="Backfill embeddings for existing tickets.")
    backfill_parser.add_argument("--batch-size", type=int, default=50, help="Number of tickets to process per batch.")
    backfill_parser.add_argument("--dry-run", action="store_true", help="Run without committing changes.")

    args = parser.parse_args()

    if args.command == "hash":
        print_hash(args.password)
    elif args.command == "set-password":
        set_user_password(args.email, args.password, temp=args.temp, dry_run=args.dry_run)
    elif args.command == "migrate-csv":
        migrate_csv(Path(args.file), args.email_field, args.password_field, temp=args.temp, dry_run=args.dry_run)
    elif args.command == "backfill-embeddings":
        backfill_ticket_embeddings(batch_size=args.batch_size, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
