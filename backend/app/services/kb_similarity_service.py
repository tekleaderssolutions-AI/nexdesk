"""
KB Similarity + Resolution Confidence Engine.

Pipeline:
  Ticket → embedding → pgvector KB search → retrieval quality gate
  → coverage scoring → LLM verification → weighted confidence formula
  → priority threshold check → decision label → DB persist → API dict

Auto-resolve rule:
  Only when ALL of the following hold:
    1. similarity_score >= MIN_SIMILARITY_FOR_AUTORESOLVE
    2. LLM verification says can_resolve=True  (when Ollama is available)
    3. final_score >= priority threshold  (P3=80, P4=75, P5=70)
    4. priority IN (P3, P4, P5) — P1/P2 are NEVER auto-resolved
"""
import datetime
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import (
    KnowledgeBase, Ticket, TicketAISuggestion, TicketTimeline,
    TicketSimilarityResult, TicketResolutionScore,
)
from app.services.embedding_service import EmbeddingService


# ══════════════════════════════════════════════════════════════════════════════
# Configurable weights and thresholds
# All values can be moved to environment variables for zero-code tuning.
# ══════════════════════════════════════════════════════════════════════════════

# Final score formula weights (must sum to 1.0)
# W_SIM  — semantic similarity is the primary signal; drives the bulk of the score
# W_LLM  — LLM verification acts as a strong quality gate before auto-resolving
# W_CLS  — classification confidence shows how well AI understood the ticket
# W_COV  — keyword coverage confirms the KB article addresses the reported issue
# W_QUAL — KB article quality (well-written, detailed articles score slightly higher)
W_SIM  = 0.50
W_LLM  = 0.20
W_CLS  = 0.15
W_COV  = 0.10
W_QUAL = 0.05

# Retrieval quality gate — below this similarity the KB match is too weak to attempt LLM
MIN_SIMILARITY_FOR_AUTORESOLVE = 70.0   # 0-100 scale

# ── Enterprise 3-level decision thresholds ─────────────────────────────────────
# Level 1 — AI_AUTO_RESOLVE  (P4/P5 only)
THRESHOLD_AUTO_P4 = 75.0
THRESHOLD_AUTO_P5 = 70.0

# Level 2 — AI_TEAM_REVIEW
# P3: team reviews before anything reaches the user
THRESHOLD_TEAM_REVIEW_P3 = 65.0
# P4/P5: falls to team review when score doesn't reach auto-resolve bar
THRESHOLD_TEAM_REVIEW_P4 = 50.0
THRESHOLD_TEAM_REVIEW_P5 = 45.0

from app.services import llm_client as _llm

# Backfill: non-terminal statuses that have not already been AI-resolved
_BACKFILL_STATUSES = {
    "OPEN", "NEW", "IN_PROGRESS",
    "ASSIGNED",             # set after classification auto-assign
    "PENDING_ADMIN_REVIEW", # set when classification confidence is low
    "PENDING_USER",
    "PENDING_VENDOR",
    "ESCALATED",
    "ON_HOLD",
    # AI_RESOLVED_PENDING_USER_CONFIRMATION intentionally excluded —
    # ticket is already in the AI-first flow, do not re-process
}

# Words too generic to contribute to coverage signal
_STOP_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can",
    "her", "was", "one", "our", "out", "had", "has", "him", "his",
    "how", "its", "may", "new", "now", "own", "say", "see", "two",
    "who", "did", "get", "has", "let", "put", "too", "use", "way",
    "with", "from", "this", "that", "they", "will", "been", "have",
    "when", "your", "more", "also", "into", "than", "then", "some",
    "very", "just", "like", "over", "such", "after", "above", "about",
    "where", "there", "their", "which", "while", "during", "before",
    "issue", "problem", "error", "help", "please", "getting", "using",
    "user", "ticket", "request", "support", "team", "able", "need",
}


# ══════════════════════════════════════════════════════════════════════════════
# Data classes
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class KBMatch:
    article_id: str
    title: str
    similarity: float         # 0-1 raw cosine similarity
    has_resolution: bool
    resolution_length: int
    has_tags: bool
    resolution_text: str = ""


@dataclass
class LLMVerification:
    resolution_type: str      # AUTO_RESOLVE | AI_TEAM_REVIEW | ROUTE_TO_TEAM
    confidence: float         # 0-100
    reason: str


# ══════════════════════════════════════════════════════════════════════════════
# Step 1 — Ticket embedding
# ══════════════════════════════════════════════════════════════════════════════

def _ticket_embedding(ticket: Ticket) -> np.ndarray:
    emb_text = EmbeddingService.build_embedding_text(
        subject=ticket.subject or "",
        description=(ticket.description or "")[:1000],
    )
    return EmbeddingService.generate_embedding(emb_text)


# ══════════════════════════════════════════════════════════════════════════════
# Step 2 — pgvector KB search
# ══════════════════════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════════════════════
# Step 3 — Similarity Score (0-100)
# ══════════════════════════════════════════════════════════════════════════════

def _similarity_score(matches: List[KBMatch]) -> float:
    if not matches:
        return 0.0
    return round(matches[0].similarity * 100, 2)


# ══════════════════════════════════════════════════════════════════════════════
# Step 4 — Coverage Score (0-100) — keyword overlap between ticket and KB
# ══════════════════════════════════════════════════════════════════════════════

def _extract_keywords(raw: str) -> set:
    """Return meaningful words: length >= 4, not a stop word."""
    words = set(re.findall(r'\b[a-z][a-z0-9]{2,}\b', raw.lower()))
    return words - _STOP_WORDS


def _coverage_score(ticket: Ticket, matches: List[KBMatch]) -> Tuple[float, dict]:
    """
    Compute what fraction of the ticket's meaningful keywords appear in
    the top KB article. Returns (score 0-100, detail dict for logging).
    """
    if not matches:
        return 0.0, {"matched_terms": 0, "total_terms": 0, "coverage": 0}

    ticket_text = f"{ticket.subject or ''} {ticket.description or ''}"
    ticket_kw = _extract_keywords(ticket_text)

    if not ticket_kw:
        return 0.0, {"matched_terms": 0, "total_terms": 0, "coverage": 0}

    top = matches[0]
    kb_text = f"{top.title} {top.resolution_text}"
    kb_kw = _extract_keywords(kb_text)

    matched = ticket_kw & kb_kw
    total = len(ticket_kw)
    score = round(len(matched) / total * 100, 2) if total > 0 else 0.0

    detail = {
        "matched_terms": len(matched),
        "total_terms": total,
        "coverage": score,
        "sample_matched": sorted(matched)[:10],
    }
    return score, detail


# ══════════════════════════════════════════════════════════════════════════════
# Step 5 — Classification Confidence from AI suggestion (0-100)
# ══════════════════════════════════════════════════════════════════════════════

def _classification_confidence(db: Session, ticket_id: str) -> float:
    row = (
        db.query(TicketAISuggestion)
        .filter(TicketAISuggestion.ticket_id == ticket_id)
        .first()
    )
    if row and row.confidence is not None:
        return round(float(row.confidence) * 100, 2)
    return 50.0


# ══════════════════════════════════════════════════════════════════════════════
# Step 6 — KB Quality Score (0-100)
# ══════════════════════════════════════════════════════════════════════════════

def _resolution_quality_score(matches: List[KBMatch]) -> float:
    if not matches:
        return 0.0
    top = matches[:3]
    weight_sum = sum(m.similarity for m in top)
    if weight_sum == 0:
        return 0.0
    weighted = 0.0
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
        q += 15.0   # always published (filtered in SQL)
        weighted += q * m.similarity
    return round(min(100.0, weighted / weight_sum), 2)


# ══════════════════════════════════════════════════════════════════════════════
# Step 7 — LLM Verification
# ══════════════════════════════════════════════════════════════════════════════

_LLM_VERIFY_PROMPT = """\
Ticket:
{ticket_description}

KB Article: {kb_title}

KB Solution:
{kb_solution}

Evaluate whether the KB article can resolve this ticket.

Return JSON:

{{"resolution_type": "AUTO_RESOLVE | AI_TEAM_REVIEW | ROUTE_TO_TEAM", "confidence": 0-100, "reason": "short explanation"}}

Rules:

AUTO_RESOLVE:
- Well-known, repetitive, low-risk issue.
- KB steps are deterministic and safe to apply without technician.
- P4/P5 severity only.
Examples: Password reset, unlock account, VPN cache clear, Outlook profile rebuild, browser cache.

AI_TEAM_REVIEW:
- KB is relevant but solution needs human judgment before delivery.
- Moderate confidence — team should verify before sending to user.
- P3 severity or ambiguous issues.
Examples: DNS issues, network latency, SAP errors, printer issues, application crashes.

ROUTE_TO_TEAM:
- KB is a weak match or issue requires specialist investigation.
- P1/P2 severity, infrastructure, security, or major incidents.
Examples: Server outage, database corruption, security breach, network core failure.

Return only valid JSON. No text before or after. No markdown.
"""


_VALID_RESOLUTION_TYPES = {"AUTO_RESOLVE", "AI_TEAM_REVIEW", "ROUTE_TO_TEAM"}


def _call_llm_verify(ticket: Ticket, match: KBMatch) -> Optional[LLMVerification]:
    """Ask OpenAI to classify whether the KB article auto-resolves, suggests, or routes."""
    ticket_desc = f"Subject: {ticket.subject or ''}\nDescription: {(ticket.description or '')[:500]}"
    kb_solution = (match.resolution_text or "")[:600]
    prompt = _LLM_VERIFY_PROMPT.format(
        ticket_description=ticket_desc,
        kb_title=match.title,
        kb_solution=kb_solution,
    )
    parsed = _llm.call_json(prompt, max_tokens=200, tag="KB_SIM")
    if not parsed:
        return None

    resolution_type = str(parsed.get("resolution_type", "ROUTE_TO_TEAM")).upper()
    if resolution_type not in _VALID_RESOLUTION_TYPES:
        resolution_type = "ROUTE_TO_TEAM"

    return LLMVerification(
        resolution_type=resolution_type,
        confidence=max(0.0, min(100.0, float(parsed.get("confidence", 0)))),
        reason=str(parsed.get("reason", "")),
    )


# ══════════════════════════════════════════════════════════════════════════════
# Step 8 — Priority threshold + decision label
# ══════════════════════════════════════════════════════════════════════════════

def _decide(
    final: float,
    priority: str,
    sim: float,
    llm: Optional[LLMVerification],
) -> Tuple[str, str]:
    """
    Return (decision_label, human-readable reason).

    Level 1 — AI_AUTO_RESOLVE : P4/P5 only, high confidence
    Level 2 — AI_TEAM_REVIEW  : P3 (team reviews before user sees anything);
                                 P4/P5 when confidence is moderate (team fallback)
    Level 3 — ROUTE_TO_TEAM   : P1/P2 always; low confidence for any priority
    """
    p = priority.upper()

    # ── P1/P2 — always human team (Level 3) ───────────────────────────────────
    if p in ("P1", "P2"):
        return "ROUTE_TO_TEAM", "P1/P2 tickets are always handled by the human support team"

    # ── Retrieval quality gate ─────────────────────────────────────────────────
    if sim < MIN_SIMILARITY_FOR_AUTORESOLVE:
        return (
            "ROUTE_TO_TEAM",
            f"Similarity {sim:.1f}% is below retrieval gate "
            f"({MIN_SIMILARITY_FOR_AUTORESOLVE:.0f}%) — no AI action possible",
        )

    # ── LLM override — ROUTE_TO_TEAM hard stop ────────────────────────────────
    if llm is not None and llm.resolution_type == "ROUTE_TO_TEAM":
        return "ROUTE_TO_TEAM", f"LLM assessed KB as a weak match: {llm.reason}"

    # ── P3 — AI_TEAM_REVIEW only (never auto-resolve to user) ─────────────────
    if p == "P3":
        if final >= THRESHOLD_TEAM_REVIEW_P3 or (
            llm is not None and llm.resolution_type == "AI_TEAM_REVIEW"
        ):
            return (
                "AI_TEAM_REVIEW",
                f"P3 ticket: AI suggestion ({final:.1f}% confidence) routed to team for review",
            )
        return "ROUTE_TO_TEAM", f"Confidence {final:.1f}% below P3 team-review threshold ({THRESHOLD_TEAM_REVIEW_P3:.0f}%)"

    # ── P4 — try auto-resolve, fall back to team review ───────────────────────
    if p == "P4":
        if final >= THRESHOLD_AUTO_P4 and (llm is None or llm.resolution_type == "AUTO_RESOLVE"):
            return (
                "AI_AUTO_RESOLVE",
                f"P4 ticket: confidence {final:.1f}% ≥ {THRESHOLD_AUTO_P4:.0f}% — delivering AI resolution to user",
            )
        if final >= THRESHOLD_TEAM_REVIEW_P4:
            return (
                "AI_TEAM_REVIEW",
                f"P4 ticket: confidence {final:.1f}% — team review before user delivery",
            )
        return "ROUTE_TO_TEAM", f"P4 confidence {final:.1f}% too low for AI action"

    # ── P5 — lowest bar for auto-resolve ──────────────────────────────────────
    if p == "P5":
        if final >= THRESHOLD_AUTO_P5 and (llm is None or llm.resolution_type == "AUTO_RESOLVE"):
            return (
                "AI_AUTO_RESOLVE",
                f"P5 ticket: confidence {final:.1f}% ≥ {THRESHOLD_AUTO_P5:.0f}% — delivering AI resolution to user",
            )
        if final >= THRESHOLD_TEAM_REVIEW_P5:
            return (
                "AI_TEAM_REVIEW",
                f"P5 ticket: confidence {final:.1f}% — team review before user delivery",
            )
        return "ROUTE_TO_TEAM", f"P5 confidence {final:.1f}% too low for AI action"

    return "ROUTE_TO_TEAM", f"Unrecognised priority {p} — routing to team"


# ══════════════════════════════════════════════════════════════════════════════
# Detailed decision log (Task 7)
# ══════════════════════════════════════════════════════════════════════════════

def _effective_threshold(priority: str) -> str:
    """Return a human-readable threshold label for the log."""
    p = priority.upper()
    if p in ("P1", "P2"):
        return "N/A (always ROUTE_TO_TEAM)"
    if p == "P3":
        return f"team_review≥{THRESHOLD_TEAM_REVIEW_P3:.0f}"
    if p == "P4":
        return f"auto≥{THRESHOLD_AUTO_P4:.0f} / team_review≥{THRESHOLD_TEAM_REVIEW_P4:.0f}"
    if p == "P5":
        return f"auto≥{THRESHOLD_AUTO_P5:.0f} / team_review≥{THRESHOLD_TEAM_REVIEW_P5:.0f}"
    return "unknown"


def _log_decision(
    ticket: Ticket,
    top_match: Optional[KBMatch],
    sim: float,
    cov: float,
    cov_detail: dict,
    cls: float,
    qual: float,
    llm: Optional[LLMVerification],
    llm_score: float,
    final: float,
    decision: str,
    reason: str,
    priority: str,
) -> None:
    print("=" * 65)
    print(f"Ticket: {ticket.ticket_no}  [{priority}]")
    print()
    print(f"Top KB Match: {top_match.title if top_match else 'None'}")
    print()
    print(f"  Similarity       : {sim:.1f}")
    print(
        f"  Coverage         : {cov:.1f}"
        f"  (matched {cov_detail.get('matched_terms', 0)}/{cov_detail.get('total_terms', 0)} terms)"
    )
    print(f"  Classification   : {cls:.1f}")
    print(f"  KB Quality       : {qual:.1f}")
    if llm:
        print(
            f"  LLM Verification : {llm_score:.1f}"
            f"  (resolution_type={llm.resolution_type}  reason={llm.reason!r})"
        )
    else:
        print("  LLM Verification : N/A (unavailable or sim below gate)")
    print()
    print(f"  Final Confidence : {final:.1f}")
    print(f"  Thresholds       : {_effective_threshold(priority)}")
    print(f"  Decision         : {decision}")
    print()
    print(f"  Reason: {reason}")
    print("=" * 65)


# ══════════════════════════════════════════════════════════════════════════════
# DB persistence
# ══════════════════════════════════════════════════════════════════════════════

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
    llm_score: float,
    final: float,
    decision: str,
    reason: str,
    matched_kb_article_id: Optional[str],
) -> None:
    try:
        existing = (
            db.query(TicketResolutionScore)
            .filter(TicketResolutionScore.ticket_id == ticket_id)
            .first()
        )
        fields = dict(
            similarity_score=sim,
            coverage_score=cov,
            resolution_quality_score=qual,
            classification_confidence=cls,
            llm_verification_score=llm_score,
            final_resolution_confidence=final,
            decision=decision,
            decision_reason=reason,
            matched_kb_article_id=matched_kb_article_id,
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
        else:
            db.add(TicketResolutionScore(ticket_id=ticket_id, **fields))
        db.commit()
    except Exception as e:
        print(f"[KB_SIM] save resolution score error: {e}")
        db.rollback()


# ══════════════════════════════════════════════════════════════════════════════
# Auto-resolve trigger
# ══════════════════════════════════════════════════════════════════════════════



# ══════════════════════════════════════════════════════════════════════════════
# Public API
# ══════════════════════════════════════════════════════════════════════════════

def run_resolution_confidence(db: Session, ticket: Ticket) -> Dict[str, Any]:
    """
    Full pipeline: embed → KB search → quality gate → score
    → LLM verify → decide → persist → return.
    If eligible, also updates ticket.status to AI_RESOLVED_PENDING_USER_CONFIRMATION.
    """
    ticket_id = str(ticket.id)
    priority = (ticket.priority or "P3").upper()
    print(f"[KB_SIM] Running confidence for {ticket.ticket_no} [{priority}]")

    # 1. Embed
    try:
        embedding = _ticket_embedding(ticket)
    except Exception as e:
        print(f"[KB_SIM] Embedding error: {e}")
        return _empty(ticket_id)

    # 2. KB search
    matches = _search_kb(db, embedding, top_k=5)

    # 3-6. Component scores
    sim           = _similarity_score(matches)
    cov, cov_det  = _coverage_score(ticket, matches)
    qual          = _resolution_quality_score(matches)
    cls           = _classification_confidence(db, ticket_id)

    print(f"[KB_SIM] Coverage Details:")
    print(f"  matched_terms = {cov_det.get('matched_terms', 0)}")
    print(f"  total_terms   = {cov_det.get('total_terms', 0)}")
    print(f"  coverage      = {cov:.1f}")

    # 7. LLM verification — only when similarity passes the retrieval gate
    llm: Optional[LLMVerification] = None
    llm_score = 0.0

    if matches and sim >= MIN_SIMILARITY_FOR_AUTORESOLVE and priority not in ("P1", "P2"):
        if _llm.is_available():
            llm = _call_llm_verify(ticket, matches[0])
            if llm:
                llm_score = llm.confidence
        else:
            print("[KB_SIM] OPENAI_API_KEY not set — LLM verification skipped")
    else:
        if sim < MIN_SIMILARITY_FOR_AUTORESOLVE:
            print(
                f"[KB_SIM] Similarity {sim:.1f}% below gate "
                f"({MIN_SIMILARITY_FOR_AUTORESOLVE:.0f}%) — skipping LLM"
            )

    # 8. Final weighted score
    final = round(
        W_SIM  * sim      +
        W_LLM  * llm_score +
        W_CLS  * cls      +
        W_COV  * cov      +
        W_QUAL * qual,
        2,
    )
    final = max(0.0, min(100.0, final))

    # 9. Decision
    decision, reason = _decide(final, priority, sim, llm)

    # 10. Log
    _log_decision(
        ticket=ticket,
        top_match=matches[0] if matches else None,
        sim=sim, cov=cov, cov_detail=cov_det,
        cls=cls, qual=qual,
        llm=llm, llm_score=llm_score,
        final=final, decision=decision, reason=reason,
        priority=priority,
    )

    # 11. Persist
    matched_id = matches[0].article_id if matches else None
    _save_similarity_results(db, ticket_id, matches)
    _save_resolution_score(
        db, ticket_id, sim, cov, qual, cls, llm_score,
        final, decision, reason, matched_id,
    )

    # 12. Dispatch to enterprise AI resolution workflow (3-level)
    try:
        from app.services.ai_resolution_service import execute_ai_resolution_workflow
        execute_ai_resolution_workflow(
            db=db,
            ticket=ticket,
            kb_matches=matches,
            decision=decision,
            final_confidence=final,
        )
    except Exception as e:
        print(f"[KB_SIM] AI resolution workflow error: {e}")

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
        # Component scores
        "similarity_score": sim,
        "coverage_score": cov,
        "classification_confidence": cls,
        "resolution_quality_score": qual,
        "llm_verification_score": llm_score,
        "final_resolution_confidence": final,
        # Decision
        "decision": decision,
        "decision_reason": reason,
        "matched_kb_article_id": matched_id,
        # Explainability breakdown
        "component_scores": {
            "similarity": sim,
            "coverage": cov,
            "classification": cls,
            "kb_quality": qual,
            "llm_verification": llm_score,
        },
        "coverage_detail": cov_det,
        "llm_verification": {
            "resolution_type": llm.resolution_type,
            "confidence": llm.confidence,
            "reason": llm.reason,
        } if llm else None,
        # Weight configuration (for admin visibility)
        "formula_weights": {
            "similarity": W_SIM,
            "llm_verification": W_LLM,
            "classification": W_CLS,
            "coverage": W_COV,
            "kb_quality": W_QUAL,
        },
        "thresholds": {
            "min_similarity": MIN_SIMILARITY_FOR_AUTORESOLVE,
            "P3_team_review": THRESHOLD_TEAM_REVIEW_P3,
            "P4_auto": THRESHOLD_AUTO_P4,
            "P4_team_review": THRESHOLD_TEAM_REVIEW_P4,
            "P5_auto": THRESHOLD_AUTO_P5,
            "P5_team_review": THRESHOLD_TEAM_REVIEW_P5,
        },
    }


def _empty(ticket_id: str) -> Dict[str, Any]:
    return {
        "ticket_id": ticket_id,
        "top_matches": [],
        "similarity_score": 0.0,
        "coverage_score": 0.0,
        "classification_confidence": 50.0,
        "resolution_quality_score": 0.0,
        "llm_verification_score": 0.0,
        "final_resolution_confidence": 0.0,
        "decision": "ROUTE_TO_TEAM",
        "decision_reason": "Embedding generation failed",
        "matched_kb_article_id": None,
        "component_scores": {
            "similarity": 0.0,
            "coverage": 0.0,
            "classification": 50.0,
            "kb_quality": 0.0,
            "llm_verification": 0.0,
        },
        "coverage_detail": {"matched_terms": 0, "total_terms": 0, "coverage": 0},
        "llm_verification": None,
        "formula_weights": {
            "similarity": W_SIM,
            "llm_verification": W_LLM,
            "classification": W_CLS,
            "coverage": W_COV,
            "kb_quality": W_QUAL,
        },
        "thresholds": {
            "min_similarity": MIN_SIMILARITY_FOR_AUTORESOLVE,
            "P3_team_review": THRESHOLD_TEAM_REVIEW_P3,
            "P4_auto": THRESHOLD_AUTO_P4,
            "P5_auto": THRESHOLD_AUTO_P5,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# Backfill
# ══════════════════════════════════════════════════════════════════════════════

def run_auto_resolve_backfill(db: Session) -> Dict[str, Any]:
    """
    Run the full confidence pipeline on all unresolved tickets.
    Dispatches to the 3-level ai_resolution_service workflow.
    """
    tickets = (
        db.query(Ticket)
        .filter(Ticket.status.in_(list(_BACKFILL_STATUSES)))
        .all()
    )

    total = len(tickets)
    processed = 0
    auto_resolved = 0
    errors = 0

    for ticket in tickets:
        try:
            run_resolution_confidence(db, ticket)
            db.refresh(ticket)
            if ticket.status == "AI_RESOLVED_PENDING_USER_CONFIRMATION":
                auto_resolved += 1
            processed += 1
        except Exception as e:
            print(f"[BACKFILL] Error on {getattr(ticket, 'ticket_no', ticket.id)}: {e}")
            errors += 1

    print(f"[BACKFILL] Done — processed={processed} auto_resolved={auto_resolved} errors={errors}")
    return {
        "total_eligible": total,
        "processed": processed,
        "auto_resolved": auto_resolved,
        "errors": errors,
    }
