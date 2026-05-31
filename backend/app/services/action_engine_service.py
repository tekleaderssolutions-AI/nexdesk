"""
Dynamic AI Action Engine — 7-Phase Pipeline.

Phase 1  Load tool catalog from registered OpenAPI tools
Phase 2  ActionSelectionAgent  — LLM picks the best action (or none)
Phase 3  RiskEvaluationAgent   — LLM assesses safety
Phase 4  DecisionEngine        — combines KB confidence + action risk → final decision
Phase 5  ActionExecution       — HTTP call to the registered tool endpoint
Phase 6  UserConfirmationFlow  — send message, set AI_ACTION_COMPLETED status
Phase 7  Logging               — structured log block for all decisions

No action names are hardcoded. Everything flows from the registered tool catalog.
"""
import base64
import datetime
import json
import requests
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.models import (
    Ticket, TicketMessage, TicketTimeline,
    ToolRegistration, ToolCatalogOperation, TicketActionExecution,
)
from app.services import llm_client as _llm


# ── Policy ─────────────────────────────────────────────────────────────────────
# Configurable: whether to auto-execute and the minimum confidence required.

ACTION_POLICY: Dict[str, dict] = {
    "LOW":    {"auto_execute": True,  "confidence_threshold": 70.0},
    "MEDIUM": {"auto_execute": False, "confidence_threshold": 100.0},  # never auto
    "HIGH":   {"auto_execute": False, "confidence_threshold": 100.0},  # never auto
}

# ── Phase 1: Tool catalog ──────────────────────────────────────────────────────

def get_tool_catalog(db: Session) -> List[dict]:
    """Return all active operations in a compact format for LLM consumption."""
    ops = (
        db.query(ToolCatalogOperation)
        .join(ToolRegistration, ToolCatalogOperation.tool_id == ToolRegistration.id)
        .filter(ToolCatalogOperation.is_active == True, ToolRegistration.is_active == True)
        .all()
    )
    catalog = []
    for op in ops:
        entry: dict = {
            "operationId": op.operation_id,
            "summary": op.summary or "",
            "description": op.description or "",
            "risk_level": op.risk_level,
        }
        if op.side_effects:
            entry["side_effects"] = op.side_effects
        if op.parameters:
            entry["required_params"] = [
                p["name"] for p in op.parameters if p.get("required")
            ]
        catalog.append(entry)
    return catalog


def _parse_json(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        pass
    for marker in ["```json", "```"]:
        if marker in raw:
            s = raw.find(marker) + len(marker)
            e = raw.find("```", s)
            if e > s:
                try:
                    return json.loads(raw[s:e].strip())
                except json.JSONDecodeError:
                    pass
    depth, start = 0, None
    for i, ch in enumerate(raw):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    return json.loads(raw[start:i + 1])
                except json.JSONDecodeError:
                    pass
                start = None
    return None


# ── Phase 2: Action Selection Agent ───────────────────────────────────────────

_ACTION_SELECTION_PROMPT = """\
You are an Enterprise IT Service Desk Automation Agent.

Determine if any available API action can resolve this support ticket.

Ticket:
Subject: {subject}
Description: {description}
Priority: {priority}
Category: {category}

Knowledge Base Match:
{kb_article}

Available API Actions (you must ONLY recommend actions from this list):
{tool_catalog}

Rules:
- Recommend an action ONLY if it directly addresses the specific problem described
- Do not assume an action exists if it is not listed
- Extract any parameter values visible in the ticket text (email addresses, usernames, etc.)
- Set confidence 0-100 based on certainty that the action resolves the issue

Return ONLY this JSON. No markdown. No text before or after:
{{"can_take_action": false, "recommended_action": null, "extracted_parameters": {{}}, "confidence": 0, "reason": "..."}}
"""


def run_action_selection(
    ticket: Ticket,
    kb_article_title: str,
    kb_article_resolution: str,
    catalog: List[dict],
) -> dict:
    """Phase 2: LLM picks the best action from the catalog, or returns can_take_action=false."""
    if not catalog:
        return {"can_take_action": False, "recommended_action": None, "extracted_parameters": {}, "confidence": 0, "reason": "No actions registered"}

    catalog_text = json.dumps(catalog, indent=2)
    kb_text = f"Article: {kb_article_title}\nResolution: {kb_article_resolution[:400]}" if kb_article_title else "No KB match"

    prompt = _ACTION_SELECTION_PROMPT.format(
        subject=(ticket.subject or "")[:200],
        description=(ticket.description or "")[:400],
        priority=ticket.priority or "P3",
        category="",
        kb_article=kb_text,
        tool_catalog=catalog_text,
    )

    if not _llm.is_available():
        print("[ACTION_SELECTION] OPENAI_API_KEY not set")
        return {"can_take_action": False, "recommended_action": None, "extracted_parameters": {}, "confidence": 0, "reason": "LLM unavailable"}

    result = _llm.call_json(prompt, max_tokens=400, tag="ACTION_SELECTION")
    if not result:
        return {"can_take_action": False, "recommended_action": None, "extracted_parameters": {}, "confidence": 0, "reason": "LLM parse failure"}

    can_act = bool(result.get("can_take_action", False))
    action  = result.get("recommended_action")
    conf    = float(result.get("confidence", 0))
    reason  = str(result.get("reason", ""))
    params  = result.get("extracted_parameters") or {}

    # Validate the recommended action is in our catalog
    if can_act and action:
        valid_ids = {op["operationId"] for op in catalog}
        if action not in valid_ids:
            print(f"[ACTION_SELECTION] LLM recommended unknown action {action!r} — ignoring")
            can_act = False
            action  = None

    return {
        "can_take_action": can_act,
        "recommended_action": action,
        "extracted_parameters": params if isinstance(params, dict) else {},
        "confidence": conf,
        "reason": reason,
    }


# ── Phase 3: Risk Evaluation Agent ────────────────────────────────────────────

_RISK_EVALUATION_PROMPT = """\
You are an IT Risk Analyst. Decide if the following automated action is safe to execute without human approval.

Support Ticket:
Subject: {subject}
Priority: {priority}

Proposed Action:
Name: {action_name}
Description: {action_description}
Side effects: {side_effects}

Why this action was selected:
{selection_reason}

Risk definitions:
LOW    = Single-user, reversible. Password reset, account unlock, cache clear, email profile rebuild.
MEDIUM = Affects a team or application. Group membership, access changes. Partially reversible.
HIGH   = Broad infrastructure impact, hard to reverse. Server restart, DNS, routing, infrastructure changes.

Evaluate based on context and reasoning, not category keywords.

Return ONLY this JSON. No markdown. No text before or after:
{{"approved": true, "risk_level": "LOW", "approval_required": false, "reason": "..."}}
"""


def run_risk_evaluation(ticket: Ticket, op: ToolCatalogOperation, selection_reason: str) -> dict:
    """Phase 3: LLM evaluates whether the selected action is safe to auto-execute."""
    if not _llm.is_available():
        return {"approved": False, "risk_level": op.risk_level or "MEDIUM", "approval_required": True, "reason": "LLM unavailable — defaulting to human approval"}

    side_effects = ", ".join(op.side_effects) if op.side_effects else "Not specified"
    prompt = _RISK_EVALUATION_PROMPT.format(
        subject=(ticket.subject or "")[:200],
        priority=ticket.priority or "P3",
        action_name=op.summary or op.operation_id,
        action_description=op.description or "",
        side_effects=side_effects,
        selection_reason=selection_reason[:300],
    )
    result = _llm.call_json(prompt, max_tokens=250, tag="RISK_EVAL")
    if not result:
        return {"approved": False, "risk_level": "MEDIUM", "approval_required": True, "reason": "Risk parse failure — defaulting to human approval"}

    approved        = bool(result.get("approved", False))
    risk_level      = str(result.get("risk_level", "MEDIUM")).upper()
    approval_needed = bool(result.get("approval_required", True))
    reason          = str(result.get("reason", ""))

    if risk_level not in ("LOW", "MEDIUM", "HIGH"):
        risk_level = "MEDIUM"

    return {
        "approved": approved,
        "risk_level": risk_level,
        "approval_required": approval_needed,
        "reason": reason,
    }


# ── Phase 4: Decision Engine ───────────────────────────────────────────────────

def make_decision(
    selection: dict,
    risk: dict,
    kb_confidence: float,
    priority: str,
) -> Tuple[str, str]:
    """
    Combine action selection + risk evaluation + KB confidence into a single decision.

    Returns (decision_label, reason).

    Decision labels:
      AUTO_ACTION_AND_CONFIRM  — execute action automatically, then ask user to confirm
      AI_SUGGEST_AND_CONFIRM   — no safe action, but KB solution is strong
      AUTO_RESOLVE             — KB is very high confidence, no action needed
      ROUTE_TO_TEAM            — high-risk action required, or no good KB/action match
    """
    p = (priority or "P3").upper()

    # P1/P2 — never auto-action
    if p in ("P1", "P2"):
        return "ROUTE_TO_TEAM", "P1/P2 tickets are always routed to a human team"

    can_act    = selection.get("can_take_action", False)
    action_id  = selection.get("recommended_action")
    confidence = float(selection.get("confidence", 0))
    risk_level = risk.get("risk_level", "HIGH")
    approved   = risk.get("approved", False)

    policy = ACTION_POLICY.get(risk_level, {"auto_execute": False, "confidence_threshold": 100.0})

    if can_act and action_id and approved and policy["auto_execute"] and confidence >= policy["confidence_threshold"]:
        return (
            "AUTO_ACTION_AND_CONFIRM",
            f"Action {action_id!r} selected with {confidence:.0f}% confidence. "
            f"Risk evaluated as {risk_level} — auto-execution approved.",
        )

    if can_act and action_id and (not approved or not policy["auto_execute"]):
        return (
            "ROUTE_TO_TEAM",
            f"Action {action_id!r} identified but risk level {risk_level} requires human approval.",
        )

    if kb_confidence >= 80:
        return (
            "AI_SUGGEST_AND_CONFIRM",
            f"No safe automated action available. KB confidence {kb_confidence:.1f}% — suggesting solution to user.",
        )

    if kb_confidence >= 65:
        return (
            "AI_SUGGEST_AND_CONFIRM",
            f"KB confidence {kb_confidence:.1f}% — showing KB suggestion to user.",
        )

    return "ROUTE_TO_TEAM", f"No safe action and insufficient KB confidence ({kb_confidence:.1f}%) — routing to team."


# ── Phase 5: Parameter resolution ─────────────────────────────────────────────

def _resolve_parameters(
    op: ToolCatalogOperation,
    ticket: Ticket,
    db: Session,
    llm_extracted: dict,
) -> dict:
    """
    Resolve parameter values using the `source` field in each parameter definition.

    Sources:
      ticket_id              → ticket UUID
      ticket_creator_email   → email of the user who opened the ticket
      ticket_creator_name    → full name of the ticket creator
      organization_id        → ticket.organization_id
      static:<value>         → literal string after the colon
      llm_extract            → use LLM-extracted value from action selection
    """
    from app.models.models import User as UserModel
    resolved: dict = {}
    for p in (op.parameters or []):
        name   = p.get("name", "")
        source = p.get("source", "llm_extract")

        if source == "ticket_id":
            resolved[name] = str(ticket.id)
        elif source == "ticket_creator_email":
            user = db.query(UserModel).filter(UserModel.user_id == ticket.created_by).first()
            resolved[name] = user.email if user else ""
        elif source == "ticket_creator_name":
            user = db.query(UserModel).filter(UserModel.user_id == ticket.created_by).first()
            resolved[name] = user.full_name if user else ""
        elif source == "organization_id":
            resolved[name] = str(ticket.organization_id) if ticket.organization_id else ""
        elif source.startswith("static:"):
            resolved[name] = source[7:]
        else:
            # Fall through to LLM-extracted value, then empty
            resolved[name] = llm_extracted.get(name, "")

    return resolved


# ── Phase 5: HTTP execution ────────────────────────────────────────────────────

def _execute_http(
    tool: ToolRegistration,
    op: ToolCatalogOperation,
    resolved_params: dict,
) -> dict:
    """Call the registered endpoint with resolved parameters."""
    path       = op.path
    body_params:  dict = {}
    query_params: dict = {}

    for p in (op.parameters or []):
        name     = p.get("name", "")
        location = p.get("in", "body")
        value    = resolved_params.get(name, "")
        if location == "path":
            path = path.replace(f"{{{name}}}", str(value))
        elif location == "query":
            query_params[name] = value
        else:
            body_params[name] = value

    url     = f"{tool.base_url.rstrip('/')}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    auth_type  = (tool.auth_type or "none").lower()
    auth_cfg   = tool.auth_config or {}
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {auth_cfg.get('token', '')}"
    elif auth_type == "api_key":
        key_header = auth_cfg.get("header", "X-API-Key")
        headers[key_header] = auth_cfg.get("key", "")
    elif auth_type == "basic":
        creds = base64.b64encode(
            f"{auth_cfg.get('username', '')}:{auth_cfg.get('password', '')}".encode()
        ).decode()
        headers["Authorization"] = f"Basic {creds}"

    print(f"[ACTION_EXEC] {op.http_method.upper()} {url} | body={body_params} | query={query_params}")
    try:
        response = requests.request(
            method=op.http_method.upper(),
            url=url,
            json=body_params if body_params else None,
            params=query_params if query_params else None,
            headers=headers,
            timeout=30,
        )
        success = 200 <= response.status_code < 300
        print(f"[ACTION_EXEC] Response: {response.status_code} success={success}")
        return {
            "status_code": response.status_code,
            "success": success,
            "response": response.text[:500],
        }
    except Exception as e:
        print(f"[ACTION_EXEC] HTTP error: {e}")
        return {"status_code": 0, "success": False, "response": str(e)}


# ── Phase 6: Confirmation message ─────────────────────────────────────────────

def _build_confirmation_message(op: ToolCatalogOperation, resolved_params: dict, result: dict) -> str:
    side_effects = "\n".join(f"• {s}" for s in (op.side_effects or []))
    param_display = ", ".join(f"{k}={v}" for k, v in resolved_params.items() if v)
    success = result.get("success", False)

    if success:
        return (
            f"We automatically performed an action on your behalf:\n\n"
            f"Action: {op.summary or op.operation_id}\n"
            f"{f'Parameters: {param_display}' if param_display else ''}\n"
            f"{f'What happened:{chr(10)}{side_effects}' if side_effects else ''}\n\n"
            "Please try your request again and confirm whether the issue is resolved."
        ).strip()
    else:
        return (
            f"We attempted to automatically resolve your issue using: {op.summary or op.operation_id}\n\n"
            "Unfortunately the action could not be completed. A support agent will be assigned to help you."
        )


# ── Phase 7: Decision log ──────────────────────────────────────────────────────

def _log_decision(
    ticket: Ticket,
    catalog_size: int,
    selection: dict,
    risk: dict,
    final_decision: str,
    final_reason: str,
) -> None:
    print("=" * 60)
    print(f"AI Action Engine — {ticket.ticket_no} [{ticket.priority}]")
    print()
    print(f"Tool Catalog Size : {catalog_size} operations")
    print()
    print(f"Action Selection  : can_act={selection.get('can_take_action')}  action={selection.get('recommended_action')}  confidence={selection.get('confidence')}")
    print(f"Selection Reason  : {selection.get('reason', '')}")
    print()
    print(f"Risk Evaluation   : approved={risk.get('approved')}  level={risk.get('risk_level')}  needs_approval={risk.get('approval_required')}")
    print(f"Risk Reason       : {risk.get('reason', '')}")
    print()
    print(f"Final Decision    : {final_decision}")
    print(f"Reason            : {final_reason}")
    print("=" * 60)


# ── Public API ─────────────────────────────────────────────────────────────────

def run_action_engine(
    db: Session,
    ticket: Ticket,
    kb_confidence: float = 0.0,
    kb_title: str = "",
    kb_resolution: str = "",
) -> dict:
    """
    Full 7-phase action engine pipeline.

    Returns a result dict with:
      decision          — AUTO_ACTION_AND_CONFIRM | AI_SUGGEST_AND_CONFIRM | ROUTE_TO_TEAM
      action_taken      — operationId or None
      execution_status  — SUCCESS | FAILED | SKIPPED | None
      confidence        — float
      risk_level        — LOW | MEDIUM | HIGH
      reason            — human-readable explanation
    """
    ticket_id = str(ticket.id)
    priority  = (ticket.priority or "P3").upper()

    # Phase 1: Load catalog
    catalog = get_tool_catalog(db)
    print(f"[ACTION_ENGINE] {ticket.ticket_no}: catalog={len(catalog)} actions, priority={priority}")

    # Phase 2: Action selection
    selection = run_action_selection(ticket, kb_title, kb_resolution, catalog)
    print(f"[ACTION_ENGINE] Selection: can_act={selection['can_take_action']} action={selection['recommended_action']} conf={selection['confidence']}")

    # Phase 3: Risk evaluation (only if an action was found)
    risk: dict = {"approved": False, "risk_level": "HIGH", "approval_required": True, "reason": "No action to evaluate"}
    op: Optional[ToolCatalogOperation] = None

    if selection["can_take_action"] and selection["recommended_action"]:
        op = (
            db.query(ToolCatalogOperation)
            .filter(ToolCatalogOperation.operation_id == selection["recommended_action"])
            .filter(ToolCatalogOperation.is_active == True)
            .first()
        )
        if op:
            risk = run_risk_evaluation(ticket, op, selection.get("reason", ""))
        else:
            print(f"[ACTION_ENGINE] Operation {selection['recommended_action']!r} not found in DB — skipping")
            selection["can_take_action"] = False

    # Phase 4: Decision
    final_decision, final_reason = make_decision(selection, risk, kb_confidence, priority)

    # Phase 7: Log
    _log_decision(ticket, len(catalog), selection, risk, final_decision, final_reason)

    # Phase 5+6: Execute if approved
    execution_status = "SKIPPED"
    execution_result: Optional[dict] = None
    resolved_params:  dict = {}
    action_summary    = None

    if final_decision == "AUTO_ACTION_AND_CONFIRM" and op is not None:
        tool = db.query(ToolRegistration).filter(ToolRegistration.id == op.tool_id).first()
        if tool:
            resolved_params = _resolve_parameters(op, ticket, db, selection.get("extracted_parameters", {}))
            execution_result = _execute_http(tool, op, resolved_params)
            execution_status = "SUCCESS" if execution_result["success"] else "FAILED"

            msg_body = _build_confirmation_message(op, resolved_params, execution_result)
            action_summary = op.summary or op.operation_id

            now = datetime.datetime.now(datetime.timezone.utc)

            # Save execution record
            exe_rec = TicketActionExecution(
                ticket_id        = ticket.id,
                operation_id     = op.operation_id,
                tool_operation_id = op.id,
                execution_status = execution_status,
                execution_result = execution_result,
                parameters_used  = resolved_params,
                confidence       = selection["confidence"],
                risk_level       = risk["risk_level"],
                selection_reason = selection.get("reason", ""),
                risk_reason      = risk.get("reason", ""),
                action_summary   = action_summary,
                user_confirmed   = None,
            )
            db.add(exe_rec)

            if execution_status == "SUCCESS":
                # Send confirmation message to user
                db.add(TicketMessage(
                    ticket_id    = ticket.id,
                    sender_id    = None,
                    sender_type  = "AI",
                    message_type = "CHAT",
                    message_body = msg_body,
                ))
                ticket.status = "AI_ACTION_COMPLETED"
                ticket.process_tag = f"ACTION:{op.operation_id}"

                # Timeline events
                db.add(TicketTimeline(ticket_id=ticket_id, event_type="AI_ACTION_EXECUTED",
                    event_label=f"Action executed: {action_summary}", performed_by="AI_AGENT"))
                db.add(TicketTimeline(ticket_id=ticket_id, event_type="USER_CONFIRMATION_REQUESTED",
                    event_label="User confirmation requested — did the action resolve your issue?", performed_by="AI_AGENT"))
            else:
                ticket.status = "OPEN"
                db.add(TicketTimeline(ticket_id=ticket_id, event_type="AI_ACTION_FAILED",
                    event_label=f"Automated action failed: {execution_result.get('response', '')[:100]}", performed_by="AI_AGENT"))

            db.add(ticket)
            try:
                db.commit()
            except Exception as e:
                print(f"[ACTION_ENGINE] Commit error: {e}")
                db.rollback()
                execution_status = "FAILED"

    return {
        "decision":         final_decision,
        "action_taken":     op.operation_id if op else None,
        "action_summary":   action_summary,
        "execution_status": execution_status,
        "confidence":       selection.get("confidence", 0),
        "risk_level":       risk.get("risk_level", "UNKNOWN"),
        "selection_reason": selection.get("reason", ""),
        "risk_reason":      risk.get("reason", ""),
        "final_reason":     final_reason,
        "resolved_params":  {k: v for k, v in resolved_params.items() if k != "password"},
    }


def confirm_action(db: Session, ticket: Ticket, user, resolved: bool) -> Ticket:
    """
    Phase 6 — user confirms whether the automated action resolved their issue.

    resolved=True  → close ticket
    resolved=False → escalate to team (reopen to OPEN for assignment)
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    exe = (
        db.query(TicketActionExecution)
        .filter(TicketActionExecution.ticket_id == ticket.id)
        .order_by(TicketActionExecution.executed_at.desc())
        .first()
    )
    if exe:
        exe.user_confirmed = resolved
        db.add(exe)

    if resolved:
        ticket.status       = "CLOSED"
        ticket.closed_by_user = True
        ticket.closed_at    = now
        ticket.ai_resolved  = True
        db.add(TicketTimeline(ticket_id=str(ticket.id), event_type="USER_CONFIRMED_ACTION_RESOLVED",
            event_label="User confirmed the automated action resolved their issue", performed_by=str(user.user_id)))
        db.add(TicketTimeline(ticket_id=str(ticket.id), event_type="TICKET_CLOSED",
            event_label="Ticket closed after successful AI action", performed_by=str(user.user_id)))
    else:
        ticket.status = "OPEN"
        ticket.ai_resolution_rejected = True
        db.add(TicketTimeline(ticket_id=str(ticket.id), event_type="USER_REJECTED_ACTION",
            event_label="User reported the automated action did not resolve their issue — ticket routed to team", performed_by=str(user.user_id)))

    db.add(ticket)
    try:
        db.commit()
        db.refresh(ticket)
    except Exception as e:
        print(f"[ACTION_ENGINE] confirm_action commit error: {e}")
        db.rollback()

    return ticket
