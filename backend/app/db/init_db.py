import logging
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.orm import sessionmaker

from app.db.database import engine
from app.models import Base


SQL_SCHEMA_REFERENCE = Path(__file__).resolve().parents[2] / "db_schema.sql"


def _format_server_default(default_value):
    if default_value is None:
        return None

    if isinstance(default_value, str):
        if not (default_value.startswith("'") or default_value.startswith('"')):
            return f"'{default_value}'"
        return default_value

    return str(default_value)


def ensure_table_columns(engine, inspector, table) -> None:
    existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
    missing_columns = [col for col in table.columns if col.name not in existing_columns]
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column in missing_columns:
            column_type = column.type.compile(dialect=engine.dialect)
            sql = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column_type}'
            default_value = None
            if column.server_default is not None:
                default_value = _format_server_default(column.server_default.arg)
            elif column.default is not None and column.default.arg is not None:
                default_value = _format_server_default(column.default.arg)

            if default_value is not None:
                sql += f" DEFAULT {default_value}"
            if not column.nullable and default_value is None:
                # Do not add a strict NOT NULL column to an existing table without a default.
                # Add it as nullable first so legacy data can remain valid.
                sql += " NULL"

            try:
                connection.execute(text(sql))
                logging.info("Added missing column '%s.%s'", table.name, column.name)
            except Exception as exc:
                logging.warning(
                    "Failed to add missing column '%s.%s': %s. SQL: %s",
                    table.name,
                    column.name,
                    exc,
                    sql,
                )


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
            logging.info("Table '%s' already exists — checking columns", tname)
            try:
                ensure_table_columns(engine=engine, inspector=inspector, table=table)
            except Exception as e:
                logging.error("Failed to reconcile columns for table '%s': %s", tname, e)
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

    # Initialize pgvector extension and migrate ticket_embeddings
    try:
        from app.db.pgvector_migration import init_pgvector, migrate_ticket_embeddings, migrate_kb_embeddings
        Session = sessionmaker(bind=engine)
        db_session = Session()

        init_pgvector(db_session)
        migrate_ticket_embeddings(db_session)
        migrate_kb_embeddings(db_session)

        db_session.close()
        logging.info("pgvector initialized and migrations applied")
    except Exception as e:
        logging.warning(f"pgvector initialization error (may already exist): {e}")

