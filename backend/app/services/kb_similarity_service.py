"""
KB Similarity + Resolution Confidence Engine.

Pipeline:
  Ticket → embedding → pgvector KB search → similarity/coverage/quality scores
  → weighted confidence formula → decision label → DB persist → API dict
"""
from dataclasses import dataclass
from typing import Any, Dict, List

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import (
    KnowledgeBase, Ticket, TicketAISuggestion,
    TicketSimilarityResult, TicketResolutionScore,
)
from app.services.embedding_service import EmbeddingService


# ── Data class for a single KB match ──────────────────────────────────────────

@dataclass
class KBMatch:
    article_id: str
    title: str
    similarity: float        # 0-1
    has_resolution: bool
    resolution_length: int
    has_tags: bool
    resolution_text: str = ""


# ── Step 1 — ticket embedding ──────────────────────────────────────────────────

def _ticket_embedding(ticket: Ticket) -> np.ndarray:
    text = EmbeddingService.build_embedding_text(
        subject=ticket.subject or "",
        description=(ticket.description or "")[:1000],
    )
    return EmbeddingService.generate_embedding(text)


# ── Step 2 — pgvector KB search ───────────────────────────────────────────────

def _search_kb(db: Session, embedding: np.ndarray, top_k: int = 5) -> List[KBMatch]:
    query_vector = np.asarray(embedding, dtype=np.float32).tolist()
    sql = text("""
        SELECT
            k.id,
            k.title,
            k.resolution,
            k.tags,
            1 - (ke.embedding <=> CAST(:qv AS vector)) AS sim
        FROM kb_embeddings ke
        JOIN knowledge_base k ON ke.kb_id = k.id
        WHERE k.is_published = TRUE
          AND ke.embedding IS NOT NULL
        ORDER BY sim DESC
        LIMIT :top_k
    """)
    try:
        rows = db.execute(sql, {"qv": str(query_vector), "top_k": top_k}).fetchall()
    except Exception as e:
        print(f"[KB_SIM] pgvector search error: {e}")
        return []

    matches = []
    for row in rows:
        resolution = row[2] or ""
        matches.append(KBMatch(
            article_id=str(row[0]),
            title=row[1] or "",
            similarity=max(0.0, min(1.0, float(row[4]))),
            has_resolution=len(resolution.strip()) > 10,
            resolution_length=len(resolution),
            has_tags=bool(row[3] and str(row[3]).strip()),
            resolution_text=resolution,
        ))
    return matches


# ── Step 3 — Similarity Score (0-100) ─────────────────────────────────────────

def _similarity_score(matches: List[KBMatch]) -> float:
    if not matches:
        return 0.0
    return round(matches[0].similarity * 100, 2)


# ── Step 4 — Coverage Score (0-100) ───────────────────────────────────────────

def _coverage_score(matches: List[KBMatch]) -> float:
    if not matches:
        return 0.0
    above_90 = sum(1 for m in matches if m.similarity >= 0.90)
    above_80 = sum(1 for m in matches if m.similarity >= 0.80)
    above_70 = sum(1 for m in matches if m.similarity >= 0.70)
    if above_90 >= 5:
        return 95.0
    if above_90 >= 3:
        return 90.0
    if above_90 >= 1:
        return 80.0
    if above_80 >= 2:
        return 75.0
    if above_80 >= 1:
        return 60.0
    if above_70 >= 1:
        return 40.0
    return 20.0


# ── Step 5 — Classification Confidence from AI suggestion (0-100) ─────────────

def _classification_confidence(db: Session, ticket_id: str) -> float:
    row = (
        db.query(TicketAISuggestion)
        .filter(TicketAISuggestion.ticket_id == ticket_id)
        .first()
    )
    if row and row.confidence is not None:
        return round(float(row.confidence) * 100, 2)
    return 50.0


# ── Step 6 — Resolution Quality Score (0-100) ─────────────────────────────────

def _resolution_quality_score(matches: List[KBMatch]) -> float:
    if not matches:
        return 0.0
    top = matches[:3]
    weighted_sum = 0.0
    weight_sum = sum(m.similarity for m in top)
    if weight_sum == 0:
        return 0.0
    for m in top:
        q = 0.0
        if m.has_resolution:
            q += 40.0
        if m.resolution_length >= 500:
            q += 30.0
        elif m.resolution_length >= 200:
            q += 20.0
        elif m.resolution_length >= 50:
            q += 10.0
        if m.has_tags:
            q += 15.0
        q += 15.0  # is_published always true (filtered in SQL)
        weighted_sum += q * m.similarity
    return round(min(100.0, weighted_sum / weight_sum), 2)


# ── Step 7 — Decision ─────────────────────────────────────────────────────────

def _decision(score: float) -> str:
    if score >= 90.0:
        return "AI_AUTO_RESOLVE"
    if score >= 80.0:
        return "AI_SUGGEST_AND_CONFIRM"
    if score >= 70.0:
        return "AI_SUGGEST_TO_TEAM"
    return "ROUTE_TO_TEAM"


# ── DB persistence ────────────────────────────────────────────────────────────

def _save_similarity_results(db: Session, ticket_id: str, matches: List[KBMatch]) -> None:
    try:
        db.query(TicketSimilarityResult).filter(
            TicketSimilarityResult.ticket_id == ticket_id
        ).delete()
        for rank, m in enumerate(matches, start=1):
            db.add(TicketSimilarityResult(
                ticket_id=ticket_id,
                knowledge_article_id=m.article_id,
                similarity_score=m.similarity,
                rank=rank,
            ))
        db.commit()
    except Exception as e:
        print(f"[KB_SIM] save similarity results error: {e}")
        db.rollback()


def _save_resolution_score(
    db: Session,
    ticket_id: str,
    sim: float,
    cov: float,
    qual: float,
    cls: float,
    final: float,
    decision: str,
) -> None:
    try:
        existing = (
            db.query(TicketResolutionScore)
            .filter(TicketResolutionScore.ticket_id == ticket_id)
            .first()
        )
        if existing:
            existing.similarity_score = sim
            existing.coverage_score = cov
            existing.resolution_quality_score = qual
            existing.classification_confidence = cls
            existing.final_resolution_confidence = final
            existing.decision = decision
        else:
            db.add(TicketResolutionScore(
                ticket_id=ticket_id,
                similarity_score=sim,
                coverage_score=cov,
                resolution_quality_score=qual,
                classification_confidence=cls,
                final_resolution_confidence=final,
                decision=decision,
            ))
        db.commit()
    except Exception as e:
        print(f"[KB_SIM] save resolution score error: {e}")
        db.rollback()


# ── Public API ────────────────────────────────────────────────────────────────

def run_resolution_confidence(db: Session, ticket: Ticket) -> Dict[str, Any]:
    """
    Full pipeline: embed ticket → KB search → score → persist → return dict.
    """
    ticket_id = str(ticket.id)
    print(f"[KB_SIM] Running confidence for {ticket.ticket_no}")

    try:
        embedding = _ticket_embedding(ticket)
    except Exception as e:
        print(f"[KB_SIM] Embedding error: {e}")
        return _empty(ticket_id)

    matches = _search_kb(db, embedding, top_k=5)

    sim   = _similarity_score(matches)
    cov   = _coverage_score(matches)
    qual  = _resolution_quality_score(matches)
    cls   = _classification_confidence(db, ticket_id)

    final = round(
        0.40 * sim + 0.30 * cov + 0.20 * cls + 0.10 * qual,
        2,
    )
    final = max(0.0, min(100.0, final))
    dec   = _decision(final)

    _save_similarity_results(db, ticket_id, matches)
    _save_resolution_score(db, ticket_id, sim, cov, qual, cls, final, dec)

    print(f"[KB_SIM] {ticket.ticket_no}: sim={sim} cov={cov} cls={cls} qual={qual} → final={final} [{dec}]")

    return {
        "ticket_id": ticket_id,
        "top_matches": [
            {
                "article_id": m.article_id,
                "title": m.title,
                "similarity_score": round(m.similarity * 100, 2),
                "resolution": m.resolution_text or None,
            }
            for m in matches
        ],
        "similarity_score": sim,
        "coverage_score": cov,
        "resolution_quality_score": qual,
        "classification_confidence": cls,
        "final_resolution_confidence": final,
        "decision": dec,
    }


def _empty(ticket_id: str) -> Dict[str, Any]:
    return {
        "ticket_id": ticket_id,
        "top_matches": [],
        "similarity_score": 0.0,
        "coverage_score": 0.0,
        "resolution_quality_score": 0.0,
        "classification_confidence": 50.0,
        "final_resolution_confidence": 0.0,
        "decision": "ROUTE_TO_TEAM",
    }
