from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.dependencies import get_db

router = APIRouter()

@router.get("/", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Basic health check endpoint using a database session dependency."""
    return {"message": "Backend running successfully"}
