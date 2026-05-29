import logging
from pathlib import Path

from app.db.database import engine
from app.models import Base


SQL_SCHEMA_REFERENCE = Path(__file__).resolve().parents[2] / "db_schema.sql"


def init_db() -> None:
    """Initialize the database.

    The SQLAlchemy ORM models are treated as the long-term source of truth.
    If tables are missing, Base.metadata.create_all() auto-creates them.

    The SQL schema file at the repository root is kept as a reference for
    the original SQL table definitions.
    """
    if SQL_SCHEMA_REFERENCE.exists():
        logging.debug("SQL schema reference available at %s", SQL_SCHEMA_REFERENCE)

    # Safer creation strategy:
    # - Inspect existing tables and columns
    # - Create only tables that don't exist AND whose foreign-key targets
    #   already exist with the referenced columns
    from sqlalchemy import inspect

    inspector = inspect(engine)
    existing_tables = set()
    try:
        existing_tables = set(inspector.get_table_names())
    except Exception:
        logging.warning("Could not list existing tables; proceeding conservatively")

    failed_tables = []
    for table in Base.metadata.sorted_tables:
        tname = table.name
        if tname in existing_tables:
            logging.info("Table '%s' already exists — skipping", tname)
            continue

        # Validate that all foreign key references exist in current DB schema
        fk_ok = True
        for fk in table.foreign_keys:
            ref_table = fk.column.table.name
            ref_col = fk.column.name
            if ref_table not in existing_tables:
                logging.warning("Table '%s' references missing table '%s' — will skip creating '%s'",
                                tname, ref_table, tname)
                fk_ok = False
                break
            # check referenced column exists
            try:
                cols = [c['name'] for c in inspector.get_columns(ref_table)]
            except Exception:
                logging.warning("Could not inspect columns of '%s' — skipping create of '%s'", ref_table, tname)
                fk_ok = False
                break
            if ref_col not in cols:
                logging.warning("Referenced column '%s.%s' missing — skipping creation of '%s'",
                                ref_table, ref_col, tname)
                fk_ok = False
                break

        if not fk_ok:
            failed_tables.append(tname)
            continue

        # At this point it's safe to create the table
        try:
            table.create(bind=engine)
            logging.info("Created table '%s'", tname)
            existing_tables.add(tname)
        except Exception as e:
            logging.error("Failed to create table '%s': %s", tname, e)
            failed_tables.append(tname)

    if failed_tables:
        logging.error("Some tables were not created due to missing referenced objects: %s", failed_tables)
        logging.error("No SQL schema reference found and ORM create_all() failed")
        raise RuntimeError("Database initialization failed; see logs for details")

    logging.info("Tables initialized (safe creation)")
