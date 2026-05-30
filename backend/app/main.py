import logging

from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.auth.routes import router as auth_router
from app.admin.routes import router as admin_router
from app.tickets.routes import router as ticket_router
from app.db.database import engine
from app.db.init_db import init_db

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
)

app = FastAPI(title="NexDesk Backend", version="0.1.0")
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(ticket_router)

# Allow frontend dev servers to access the API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    logging.info("Starting NexDesk backend...")

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            logging.info("DB connected")
    except Exception as exc:
        logging.error("Database connection failed: %s", exc)
        raise

    init_db()

    from app.services.embedding_service import EmbeddingService
    EmbeddingService.warmup()

    logging.info("Backend started successfully")
