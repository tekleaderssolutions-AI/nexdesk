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


class ResolutionConfidenceResponse(BaseModel):
    ticket_id: str
    top_matches: List[KBSimilarityMatchResponse]
    similarity_score: float
    coverage_score: float
    resolution_quality_score: float
    classification_confidence: float
    final_resolution_confidence: float
    decision: str


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
