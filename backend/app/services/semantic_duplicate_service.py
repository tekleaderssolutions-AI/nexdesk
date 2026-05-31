"""Semantic duplicate resolution engine using MiniLM embeddings and pgvector similarity."""
import datetime
from typing import List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import (
    Ticket, User, TicketMessage, TicketRelationship,
    DuplicateDecisionAudit, TicketEmbedding, Notification, TeamMember,
    TicketAssignmentHistory,
)
from app.services.embedding_service import EmbeddingService
from app.services.llama_classifier import LlamaClassifier
from app.services.pii_masker import PIIMasker


PROCESS_TAGS = {
    "DUPLICATE_ATTACHED": "DUPLICATE_ATTACHED",
    "ORGANIZATIONAL_INCIDENT_LINKED": "ORGANIZATIONAL_INCIDENT_LINKED",
    "ORGANIZATIONAL_POTENTIAL": "ORGANIZATIONAL_POTENTIAL",
    "PERSONAL_MATCH_NEW_TICKET": "PERSONAL_MATCH_NEW_TICKET",
    "NEW_TICKET_AFTER_CLOSED_WINDOW": "NEW_TICKET_AFTER_CLOSED_WINDOW",
    "REOPEN_REVIEW_REQUIRED": "REOPEN_REVIEW_REQUIRED",
    "AUTO_REOPENED": "AUTO_REOPENED",
    "SKIPPED_PRIORITY_P1": "SKIPPED_PRIORITY_P1",
    "SKIPPED_EMERGENCY_OVERRIDE": "SKIPPED_EMERGENCY_OVERRIDE",
    "NO_SIMILAR_TICKETS": "NO_SIMILAR_TICKETS",
}

# Statuses considered "active" for same-user duplicate detection
ACTIVE_STATUSES = {"OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_USER", "PENDING_VENDOR"}

# Statuses eligible to appear in similarity search results
SEARCHABLE_STATUSES = (
    "OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_USER", "PENDING_VENDOR", "CLOSED"
)


def _commit_decision(db: Session, ticket: Ticket, *extra_objs) -> None:
    """Commit main ticket data (process_tag, relationships, status). Must succeed."""
    db.add(ticket)
    for obj in extra_objs:
        if obj is not None:
            db.add(obj)
    db.commit()


def _try_audit(db: Session, audit: DuplicateDecisionAudit) -> None:
    """Best-effort audit insert. Failure is logged but never propagated."""
    try:
        db.add(audit)
        db.commit()
    except Exception as exc:
        print(f"[AUDIT] Failed to persist audit record: {exc}")
        try:
            db.rollback()
        except Exception:
            pass


def _make_audit(
    tag: str,
    ticket_id,
    *,
    matched_ticket_id=None,
    similarity_score=None,
    llm_decision=None,
    confidence=None,
    reasoning: str = "",
) -> DuplicateDecisionAudit:
    """Build a DuplicateDecisionAudit with decision always set."""
    return DuplicateDecisionAudit(
        ticket_id=ticket_id,
        matched_ticket_id=matched_ticket_id,
        similarity_score=similarity_score,
        decision=tag,           # always equals final_action; satisfies NOT NULL
        llm_decision=llm_decision,
        confidence=confidence,
        reasoning=reasoning,
        final_action=tag,
    )


def generate_embedding_for_ticket(
    subject: str,
    description: str,
    attachment_text: Optional[str] = None,
) -> Tuple[str, object]:
    """Return (masked_text, embedding_vector) for a ticket."""
    original_text, masked_text = EmbeddingService.mask_and_build(
        subject=subject,
        description=description,
        attachment_text=attachment_text,
    )
    print("[EMBEDDING] ── Embedding input ─────────────────────────────────────────")
    print(f"[EMBEDDING] Fields: subject={bool(subject and subject.strip())}, "
          f"description={bool(description and description.strip())}, "
          f"attachment={bool(attachment_text)}")
    print(f"[EMBEDDING] Original ({len(original_text)} chars):")
    print(original_text[:600])
    print(f"[EMBEDDING] Masked   ({len(masked_text)} chars):")
    print(masked_text[:600])
    print("[EMBEDDING] ─────────────────────────────────────────────────────────────")
    embedding = EmbeddingService.generate_embedding(masked_text)
    print(f"[EMBEDDING] Vector generated: dim={len(embedding)}")
    return masked_text, embedding


def persist_ticket_embedding(
    db: Session,
    ticket: Ticket,
    masked_text: str,
    embedding: object,
) -> bool:
    """Store masked text and 384-dim embedding in ticket_embeddings."""
    try:
        record = TicketEmbedding(
            ticket_id=ticket.id,
            masked_text=masked_text,
            embedding_text=masked_text[:500],
            embedding_model="sentence-transformers/all-MiniLM-L6-v2",
            embedding=embedding.tolist() if hasattr(embedding, "tolist") else embedding,
        )
        db.add(record)
        db.commit()
        try:
            db.refresh(record)
        except Exception:
            pass
        print(f"[EMBEDDING] Stored embedding for ticket {ticket.ticket_no}")
        return True
    except Exception as e:
        print(f"[EMBEDDING] Failed to persist embedding: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return False


def search_similar_embeddings(
    db: Session,
    embedding: object,
    exclude_ticket_id: str,
    limit: int = 10,
    threshold: float = 0.75,
) -> List[Tuple[Ticket, float]]:
    """
    Search for similar tickets using pgvector cosine similarity.
    Restricts to SEARCHABLE_STATUSES (active + closed).
    Fetches top-25 raw results and logs all scores before threshold filtering,
    so low-similarity misses are visible in the logs.
    Returns list of (Ticket, similarity_score) sorted by score descending.
    """
    try:
        import numpy as np

        query_vector = np.asarray(embedding, dtype=np.float32).tolist()
        vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"

        statuses_placeholder = ",".join(f"'{s}'" for s in SEARCHABLE_STATUSES)

        print(f"[SEARCH] Querying similar embeddings (threshold={threshold}, limit={limit})...")
        print(f"[SEARCH] Excluding ticket_id={exclude_ticket_id}")

        # Fetch raw top-25 WITHOUT the threshold so we can see actual scores.
        sql = text(
            f"""
            SELECT
                t.id,
                t.ticket_no,
                t.subject,
                1 - (te.embedding <=> CAST(:query_vector AS vector)) AS similarity
            FROM ticket_embeddings te
            JOIN tickets t ON te.ticket_id = t.id
            WHERE t.id != CAST(:exclude_ticket_id AS uuid)
              AND t.status IN ({statuses_placeholder})
            ORDER BY similarity DESC
            LIMIT 25
            """
        )

        rows = db.execute(sql, {
            "query_vector": vector_str,
            "exclude_ticket_id": str(exclude_ticket_id),
        }).fetchall()

        print(f"[SEARCH] Raw top-{len(rows)} results (before threshold={threshold}):")
        for r in rows:
            print(f"  [{r[1]}] score={float(r[3]):.4f}  subject={r[2][:80]!r}")

        # Apply threshold in Python
        candidates = []
        for row in rows:
            score = float(row[3])
            if score < threshold:
                continue
            ticket = db.query(Ticket).filter(Ticket.id == row[0]).first()
            if ticket:
                candidates.append((ticket, score))
            if len(candidates) >= limit:
                break

        print(f"[SEARCH] After threshold filter: {len(candidates)} candidates")
        return sorted(candidates, key=lambda x: x[1], reverse=True)

    except Exception as e:
        print(f"[SEARCH] Error searching embeddings: {e}")
        import traceback
        traceback.print_exc()
        return []


def _notify_reopen_review(db: Session, new_ticket: Ticket, matched_ticket: Ticket) -> None:
    """Create in-app notifications for REOPEN_REVIEW_REQUIRED."""
    db.add(Notification(
        user_id=new_ticket.created_by,
        notification_type="REOPEN_REVIEW",
        title="Ticket Under Review",
        message=(
            f"Your request is similar to ticket {matched_ticket.ticket_no} "
            "which was recently closed. It is pending review for possible reopening."
        ),
        is_read=False,
    ))

    if matched_ticket.assigned_team_id:
        members = db.query(TeamMember).filter(
            TeamMember.team_id == matched_ticket.assigned_team_id
        ).all()
        for member in members:
            db.add(Notification(
                user_id=member.user_id,
                notification_type="REOPEN_REVIEW",
                title="Ticket Reopen Review Required",
                message=(
                    f"Ticket {matched_ticket.ticket_no} may need to be reopened. "
                    "Please review the new similar request."
                ),
                is_read=False,
            ))


def _reassign_previous_team(db: Session, ticket: Ticket) -> None:
    """Restore the assigned team for a reopened ticket.

    Uses the current assigned_team_id if present; falls back to the most
    recent TicketAssignmentHistory entry with a non-null team.
    """
    if ticket.assigned_team_id:
        return

    last = (
        db.query(TicketAssignmentHistory)
        .filter(
            TicketAssignmentHistory.ticket_id == ticket.id,
            TicketAssignmentHistory.new_team_id.isnot(None),
        )
        .first()
    )
    if last:
        ticket.assigned_team_id = last.new_team_id


def _incident_threshold_met(
    ticket: Ticket,
    candidates: List[Tuple[Ticket, float]],
    window_minutes: int = 30,
    min_tickets: int = 3,
    min_users: int = 3,
) -> bool:
    """
    Return True only when enough distinct users reported similar issues recently.

    Guards against salary, login, and other personal-looking topics being
    auto-grouped into incidents just because two people have similar wording.
    Requires >= min_tickets similar active tickets from >= min_users unique
    creators, all created within window_minutes of now.
    """
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=window_minutes)

    recent = []
    for cand, _ in candidates:
        if str(cand.created_by) == str(ticket.created_by):
            continue
        if (cand.status or "").upper() not in ACTIVE_STATUSES:
            continue
        if cand.created_at and cand.created_at < cutoff:
            continue
        recent.append(cand)

    # Include the current ticket itself in both counts
    total_tickets = len(recent) + 1
    unique_users = {str(c.created_by) for c in recent}
    unique_users.add(str(ticket.created_by))
    unique_user_count = len(unique_users)

    print(
        f"[DUPLICATE_ENGINE] Incident threshold: "
        f"similar_tickets={total_tickets} (need {min_tickets}), "
        f"unique_users={unique_user_count} (need {min_users}), "
        f"window={window_minutes}min"
    )
    return total_tickets >= min_tickets and unique_user_count >= min_users


def run_semantic_duplicate_resolution(
    db: Session,
    ticket: Ticket,
    user: User,
    attachment_text: Optional[str] = None,
) -> None:
    """
    Duplicate detection engine — runs immediately after ticket creation.
    Skipped when priority = P1 or emergency/major-incident flags are set.
    """
    print(f"\n[DUPLICATE_ENGINE] Processing ticket {ticket.ticket_no} (ID: {ticket.id})")
    print(
        f"[DUPLICATE_ENGINE] Creator: {ticket.created_by}, "
        f"Priority: {ticket.priority}, "
        f"Major Incident: {ticket.major_incident_flag}"
    )

    # --- Skip conditions ---
    priority = (ticket.priority or "").upper()
    if priority == "P1":
        print("[DUPLICATE_ENGINE] Priority P1 — skipping duplicate engine")
        tag = PROCESS_TAGS["SKIPPED_PRIORITY_P1"]
        ticket.process_tag = tag
        _commit_decision(db, ticket)
        _try_audit(db, _make_audit(tag, ticket.id,
            reasoning="Priority P1 ticket — duplicate engine skipped"))
        return

    if ticket.major_incident_flag or ticket.emergency_override:
        print("[DUPLICATE_ENGINE] Emergency override or major incident flag — skipping")
        tag = PROCESS_TAGS["SKIPPED_EMERGENCY_OVERRIDE"]
        ticket.process_tag = tag
        _commit_decision(db, ticket)
        _try_audit(db, _make_audit(tag, ticket.id,
            reasoning="Emergency override or major incident flag set"))
        return

    # --- Generate embedding with PII masking ---
    try:
        masked_text, embedding = generate_embedding_for_ticket(
            subject=ticket.subject,
            description=ticket.description,
            attachment_text=attachment_text,
        )
        if not persist_ticket_embedding(db, ticket, masked_text, embedding):
            print("[EMBEDDING] Persistence failed — skipping duplicate search")
            ticket.process_tag = PROCESS_TAGS["NO_SIMILAR_TICKETS"]
            _commit_decision(db, ticket)
            return
    except Exception as e:
        print(f"[EMBEDDING] Error generating embedding: {e}")
        ticket.process_tag = PROCESS_TAGS["NO_SIMILAR_TICKETS"]
        _commit_decision(db, ticket)
        return

    # --- Vector similarity search ---
    candidates = search_similar_embeddings(
        db=db,
        embedding=embedding,
        exclude_ticket_id=ticket.id,
        threshold=0.75,
        limit=10,
    )

    # decision_made tracks whether a candidate-based decision was already committed.
    # Initialized here so it is in scope even when candidates is empty.
    decision_made = bool(not candidates)   # True when no candidates → already handled above

    if not candidates:
        print("[DUPLICATE_ENGINE] No similar tickets found")
        tag = PROCESS_TAGS["NO_SIMILAR_TICKETS"]
        ticket.process_tag = tag
        _commit_decision(db, ticket)
        _try_audit(db, _make_audit(tag, ticket.id,
            reasoning="No similar tickets discovered"))
        # Fall through — classification must still run below

    else:
        # --- Candidate summary ---
        print(f"\n[DUPLICATE_ENGINE] ══ Candidates above threshold ({len(candidates)}) ══")
        for _c, _s in candidates:
            _same = str(_c.created_by) == str(ticket.created_by)
            print(
                f"  {_c.ticket_no:<12}  score={_s:.4f}  status={_c.status:<22}  "
                f"created_by_id={_c.created_by}  is_same_user={_same}"
            )
        print()

    # --- Decision workflow (only runs when candidates exist) ---
    now = datetime.datetime.utcnow()

    for candidate, similarity_score in candidates:
        cstatus = (candidate.status or "").upper()
        is_same_user = str(candidate.created_by) == str(ticket.created_by)

        print(f"[DUPLICATE_ENGINE] ─ Candidate Found: {candidate.ticket_no}")
        print(f"[DUPLICATE_ENGINE]   score={similarity_score:.4f}")
        print(f"[DUPLICATE_ENGINE]   status={cstatus}")
        print(f"[DUPLICATE_ENGINE]   created_by_id={candidate.created_by}")
        print(f"[DUPLICATE_ENGINE]   is_same_user={is_same_user}")

        # ── Case 1: Same user + active ticket ──────────────────────────────
        if is_same_user and cstatus in ACTIVE_STATUSES:
            print("[DUPLICATE_ENGINE]   LLM Invoked=False")
            print("[DUPLICATE_ENGINE]   Decision=DUPLICATE_ATTACHED")
            tag = PROCESS_TAGS["DUPLICATE_ATTACHED"]
            ticket.process_tag = tag
            ticket.is_duplicate = True
            ticket.duplicate_of = candidate.id
            ticket.duplicate_status = "DUPLICATE"
            ticket.duplicate_reason = "SEMANTIC_MATCH"

            rel = TicketRelationship(
                parent_ticket_id=candidate.id,
                child_ticket_id=ticket.id,
                relation_type="DUPLICATE",
            )
            msg = TicketMessage(
                ticket_id=candidate.id,
                sender_id=ticket.created_by,
                message_type="COMMENT",
                message_body=(
                    f"Related request linked to this ticket:\n\n"
                    f"Subject: {ticket.subject}\n\n{ticket.description}"
                ),
            )
            _commit_decision(db, ticket, rel, msg)
            _try_audit(db, _make_audit(tag, ticket.id,
                matched_ticket_id=candidate.id,
                similarity_score=similarity_score,
                reasoning=f"Same creator, active ticket, similarity={similarity_score:.3f}"))
            decision_made = True
            break

        # ── Case 2: Closed ticket — time-window based decision ─────────────
        if cstatus == "CLOSED":
            if candidate.closed_at:
                days = (now - candidate.closed_at).total_seconds() / 86400.0
            else:
                days = 9999.0

            if days < 1:
                tag = PROCESS_TAGS["REOPEN_REVIEW_REQUIRED"]
                print(f"[DUPLICATE_ENGINE]   LLM Invoked=False")
                print(f"[DUPLICATE_ENGINE]   Decision={tag} (closed {days:.2f} days ago)")
                ticket.process_tag = tag
                _commit_decision(db, ticket)
                try:
                    _notify_reopen_review(db, ticket, candidate)
                    db.commit()
                except Exception as exc:
                    print(f"[DUPLICATE_ENGINE] Notification error: {exc}")
                    try:
                        db.rollback()
                    except Exception:
                        pass
                _try_audit(db, _make_audit(tag, ticket.id,
                    matched_ticket_id=candidate.id,
                    similarity_score=similarity_score,
                    reasoning=f"Matched closed ticket ({days:.2f} days ago); review required"))
                decision_made = True
                break

            elif days <= 7:
                tag = PROCESS_TAGS["AUTO_REOPENED"]
                print(f"[DUPLICATE_ENGINE]   LLM Invoked=False")
                print(f"[DUPLICATE_ENGINE]   Decision={tag} (closed {days:.2f} days ago)")
                ticket.process_tag = tag
                candidate.status = "REOPENED"
                candidate.reopened_at = now
                _reassign_previous_team(db, candidate)

                rel = TicketRelationship(
                    parent_ticket_id=candidate.id,
                    child_ticket_id=ticket.id,
                    relation_type="REOPENED_FROM",
                )
                _commit_decision(db, ticket, candidate, rel)
                _try_audit(db, _make_audit(tag, ticket.id,
                    matched_ticket_id=candidate.id,
                    similarity_score=similarity_score,
                    reasoning=f"Auto-reopened previous ticket (closed {days:.2f} days ago)"))
                decision_made = True
                break

            else:
                tag = PROCESS_TAGS["NEW_TICKET_AFTER_CLOSED_WINDOW"]
                print(f"[DUPLICATE_ENGINE]   LLM Invoked=False")
                print(f"[DUPLICATE_ENGINE]   Decision={tag} (closed {days:.2f} days ago)")
                ticket.process_tag = tag
                _commit_decision(db, ticket)
                _try_audit(db, _make_audit(tag, ticket.id,
                    matched_ticket_id=candidate.id,
                    similarity_score=similarity_score,
                    reasoning=f"Matched ticket closed >7 days ago ({days:.2f}); new ticket created"))
                decision_made = True
                break

        # ── Case 3: Different user, active ticket — Llama classification ────
        else:
            if is_same_user:
                # Same user but status is neither active nor closed (edge case) — skip
                continue

            print(f"[DUPLICATE_ENGINE]   LLM Invoked=True")
            result = LlamaClassifier.classify(
                parent_subject=candidate.subject or "",
                parent_description=candidate.description or "",
                new_subject=ticket.subject or "",
                new_description=ticket.description or "",
            )

            if not result:
                print("[DUPLICATE_ENGINE]   LLM result=None — trying next candidate")
                continue

            print(
                f"[DUPLICATE_ENGINE]   LLM result={result.classification} "
                f"confidence={result.confidence:.2f}"
            )

            if result.classification == "PERSONAL":
                tag = PROCESS_TAGS["PERSONAL_MATCH_NEW_TICKET"]
                print(f"[DUPLICATE_ENGINE]   Decision={tag}")
                ticket.process_tag = tag
                _commit_decision(db, ticket)
                _try_audit(db, _make_audit(tag, ticket.id,
                    matched_ticket_id=candidate.id,
                    similarity_score=similarity_score,
                    llm_decision="PERSONAL",
                    confidence=result.confidence,
                    reasoning=f"Llama: personal issue — {result.reasoning}"))
                decision_made = True
                break

            else:  # ORGANIZATIONAL — only link if cluster is large enough
                if _incident_threshold_met(ticket, candidates):
                    tag = PROCESS_TAGS["ORGANIZATIONAL_INCIDENT_LINKED"]
                    print(f"[DUPLICATE_ENGINE]   Decision={tag} (threshold met)")
                    ticket.process_tag = tag
                    rel = TicketRelationship(
                        parent_ticket_id=candidate.id,
                        child_ticket_id=ticket.id,
                        relation_type="ORGANIZATIONAL_INCIDENT",
                    )
                    _commit_decision(db, ticket, rel)
                    _try_audit(db, _make_audit(tag, ticket.id,
                        matched_ticket_id=candidate.id,
                        similarity_score=similarity_score,
                        llm_decision="ORGANIZATIONAL",
                        confidence=result.confidence,
                        reasoning=f"Llama: organizational incident (threshold met) — {result.reasoning}"))
                else:
                    tag = PROCESS_TAGS["ORGANIZATIONAL_POTENTIAL"]
                    print(f"[DUPLICATE_ENGINE]   Decision={tag} (threshold not met: <3 users or <3 tickets in 30 min)")
                    ticket.process_tag = tag
                    _commit_decision(db, ticket)
                    _try_audit(db, _make_audit(tag, ticket.id,
                        matched_ticket_id=candidate.id,
                        similarity_score=similarity_score,
                        llm_decision="ORGANIZATIONAL",
                        confidence=result.confidence,
                        reasoning=f"Llama: organizational (threshold not met) — {result.reasoning}"))
                decision_made = True
                break

    if not decision_made:
        print("[DUPLICATE_ENGINE] No candidate met decision criteria")
        tag = PROCESS_TAGS["NO_SIMILAR_TICKETS"]
        ticket.process_tag = tag
        _commit_decision(db, ticket)
        _try_audit(db, _make_audit(tag, ticket.id,
            reasoning="No candidate met any decision criteria"))

    print(f"[DUPLICATE_ENGINE] Completed → process_tag={ticket.process_tag}\n")

    # Auto-classify tickets that are not duplicates and need routing
    _CLASSIFY_ELIGIBLE = {
        "NO_SIMILAR_TICKETS",
        "NEW_TICKET_AFTER_CLOSED_WINDOW",
        "PERSONAL_MATCH_NEW_TICKET",
        "ORGANIZATIONAL_POTENTIAL",
    }
    if ticket.process_tag in _CLASSIFY_ELIGIBLE:
        try:
            from app.services.classification_service import run_classification_pipeline
            print(f"[CLASSIFY] Auto-triggering for ticket {ticket.ticket_no} (tag={ticket.process_tag})")
            run_classification_pipeline(db, ticket)
            db.refresh(ticket)
            print(f"[CLASSIFY] Done → status={ticket.status} priority={ticket.priority} team={ticket.assigned_team_id}")
        except Exception as exc:
            print(f"[CLASSIFY] Auto-classification failed: {exc}")

        # AI Suggestion — runs in a background thread after classification sets category/team
        try:
            from app.services.ai_suggestion_service import trigger_async
            print(f"[AISuggestion] Queuing background generation for {ticket.ticket_no}")
            trigger_async(str(ticket.id))
        except Exception as exc:
            print(f"[AISuggestion] Failed to queue: {exc}")
