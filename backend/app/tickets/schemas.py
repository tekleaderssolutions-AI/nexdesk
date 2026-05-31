from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class AttachmentCreate(BaseModel):
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    storage_path: Optional[str] = None


class AttachmentResponse(AttachmentCreate):
    id: UUID
    uploaded_by: Optional[UUID] = None


class TicketCreate(BaseModel):
    subject: str
    description: str
    category_id: Optional[UUID] = None
    subcategory_id: Optional[UUID] = None
    priority: Optional[str] = None
    source: Optional[str] = None
    major_incident_flag: Optional[bool] = False
    emergency_override: Optional[bool] = False
    attachments: Optional[List[AttachmentCreate]] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    subcategory_id: Optional[UUID] = None
    priority: Optional[str] = None
    impact: Optional[str] = None
    urgency: Optional[str] = None
    scope: Optional[str] = None
    major_incident_flag: Optional[bool] = None
    emergency_override: Optional[bool] = None
    attachments: Optional[List[AttachmentCreate]] = None


class TicketAssignRequest(BaseModel):
    assigned_team_id: Optional[UUID] = None
    assigned_agent_id: Optional[UUID] = None


class TicketStatusUpdate(BaseModel):
    status: str


class TicketRelationshipResponse(BaseModel):
    relationship_id: UUID
    parent_ticket_id: UUID
    parent_ticket_no: Optional[str] = None
    child_ticket_id: UUID
    relation_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class AISuggestionResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    problem_summary: str
    probable_root_cause: str
    suggested_steps: list
    confidence: float
    recommended_escalation_team: Optional[str] = None
    resolution: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TicketResolutionResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    resolution_summary: Optional[str] = None
    root_cause: Optional[str] = None
    resolution_type: Optional[str] = None
    resolved_by: Optional[UUID] = None
    ai_generated: bool = False

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    ticket_id: UUID
    ticket_no: str
    organization_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    assigned_team_id: Optional[UUID] = None
    assigned_agent_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    category_id: Optional[UUID] = None
    subcategory_id: Optional[UUID] = None
    subject: str
    description: str
    status: str
    priority: str
    impact: str
    urgency: str
    scope: str
    source: str
    major_incident_flag: bool
    emergency_override: bool
    duplicate_status: str
    duplicate_of: Optional[UUID] = None
    duplicate_reason: Optional[str] = None
    reopened_from: Optional[UUID] = None
    process_tag: Optional[str] = None
    incident_id: Optional[UUID] = None
    ai_resolved: bool
    attachments: Optional[List[AttachmentResponse]] = None
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    # Relationship info (populated when a parent link exists)
    parent_ticket_no: Optional[str] = None
    parent_ticket_id: Optional[UUID] = None
    relationship_type: Optional[str] = None
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[str] = None
    # Classification display names (resolved server-side)
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    assigned_team_name: Optional[str] = None
    department_name: Optional[str] = None
    # Lifecycle fields
    assigned_department_id: Optional[UUID] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_type: Optional[str] = None
    final_resolution_confidence: Optional[float] = None
    closed_by_user: bool = False
    ai_resolution_rejected: bool = False

    class Config:
        from_attributes = True



class KBArticleResponse(BaseModel):
    id: UUID
    ticket_ref: Optional[str] = None
    title: str
    description: Optional[str] = None
    resolution: str
    category: Optional[str] = None
    priority: Optional[str] = None
    assigned_team: Optional[str] = None
    resolution_time: Optional[str] = None
    tags: Optional[str] = None
    is_published: bool
    created_at: datetime

    class Config:
        from_attributes = True


class KBSimilarityMatchResponse(BaseModel):
    article_id: str
    title: str
    similarity_score: float
    resolution: Optional[str] = None


class CoverageDetail(BaseModel):
    matched_terms: int
    total_terms: int
    coverage: float
    sample_matched: Optional[List[str]] = None


class LLMVerificationDetail(BaseModel):
    resolution_type: str
    confidence: float
    reason: str


class ComponentScores(BaseModel):
    similarity: float
    coverage: float
    classification: float
    kb_quality: float
    llm_verification: float


class ResolutionConfidenceResponse(BaseModel):
    ticket_id: str
    top_matches: List[KBSimilarityMatchResponse]
    # Component scores
    similarity_score: float
    coverage_score: float
    classification_confidence: float
    resolution_quality_score: float
    llm_verification_score: float
    final_resolution_confidence: float
    # Decision + explainability
    decision: str
    decision_reason: Optional[str] = None
    matched_kb_article_id: Optional[str] = None
    component_scores: Optional[ComponentScores] = None
    coverage_detail: Optional[CoverageDetail] = None
    llm_verification: Optional[LLMVerificationDetail] = None
    # Config visibility
    formula_weights: Optional[dict] = None
    thresholds: Optional[dict] = None


class ActionEngineRequest(BaseModel):
    kb_confidence: Optional[float] = 0.0
    kb_title: Optional[str] = ""
    kb_resolution: Optional[str] = ""


class ActionEngineResponse(BaseModel):
    decision: str
    action_taken: Optional[str] = None
    action_summary: Optional[str] = None
    execution_status: Optional[str] = None
    confidence: float = 0.0
    risk_level: Optional[str] = None
    selection_reason: Optional[str] = None
    risk_reason: Optional[str] = None
    final_reason: Optional[str] = None
    resolved_params: Optional[dict] = None


class ActionConfirmRequest(BaseModel):
    resolved: bool


class TeamAIActionRequest(BaseModel):
    action: str                            # APPROVE | EDIT | REJECT
    edited_solution: Optional[str] = None  # required when action=EDIT


class AIResolutionDataResponse(BaseModel):
    ticket_id: str
    level: str                             # L1_AUTO / L2_TEAM_REVIEW / L3_INTERNAL
    original_ai_solution: Optional[str] = None
    edited_team_solution: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    resolution_type: Optional[str] = None
    final_confidence: Optional[float] = None
    status: Optional[str] = None


class ConversationCreate(BaseModel):
    message: str
    attachment_url: Optional[str] = None


class ConversationResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    sender_id: Optional[UUID] = None
    sender_name: Optional[str] = None
    sender_role: str
    message: str
    attachment_url: Optional[str] = None
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TicketMessageCreate(BaseModel):
    message_body: str


class TicketMessageResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    sender_id: Optional[UUID] = None
    sender_name: Optional[str] = None
    sender_type: Optional[str] = None
    message_body: str
    created_at: datetime

    class Config:
        from_attributes = True
