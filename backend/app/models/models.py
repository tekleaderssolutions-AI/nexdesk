import uuid
from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Text, TIMESTAMP, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.db.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    plan_type = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Department(Base):
    __tablename__ = "departments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    department_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Team(Base):
    __tablename__ = "teams"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id = Column(PG_UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    team_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())



class User(Base):
    __tablename__ = "users"

    user_id = Column("user_id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    organization_id = Column(PG_UUID(as_uuid=True),ForeignKey("organizations.id", ondelete="CASCADE"),nullable=True)
    department_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id"),
        nullable=True
    )

    full_name = Column(
        String(255),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        Text,
        nullable=False
    )

    role = Column(
        String(20),
        nullable=False
    )

    phone = Column(
        String(30),
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True
    )

    is_temp_password = Column(
        Boolean,
        default=False
    )

    created_by = Column(
        PG_UUID(as_uuid=True),
        nullable=True
    )

    last_login = Column(
        TIMESTAMP,
        nullable=True
    )

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('USER', 'TEAM', 'ADMIN')",
            name="chk_user_role"
        ),
    )

class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(PG_UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    member_role = Column(String(50), nullable=False, default="AGENT")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    employee_code = Column(String(100), nullable=True)
    skill_group = Column(String(255), nullable=True)
    is_available = Column(Boolean, nullable=False, default=True)


class Skill(Base):
    __tablename__ = "skills"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class TeamMemberSkill(Base):
    __tablename__ = "team_member_skills"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_member_id = Column(PG_UUID(as_uuid=True), ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(PG_UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    proficiency = Column(String(50), nullable=False, default="INTERMEDIATE")


class Category(Base):
    __tablename__ = "categories"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Subcategory(Base):
    __tablename__ = "subcategories"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(PG_UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    subcategory_name = Column(String(255), nullable=False)


class PriorityMaster(Base):
    __tablename__ = "priority_master"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    priority_code = Column(String(10), nullable=False, unique=True)
    priority_name = Column(String(50), nullable=False)
    business_impact = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class SLARule(Base):
    __tablename__ = "sla_rules"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    priority_id = Column(PG_UUID(as_uuid=True), ForeignKey("priority_master.id"), nullable=False)
    first_response_minutes = Column(Integer, nullable=False)
    resolution_minutes = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class AssignmentRule(Base):
    __tablename__ = "assignment_rules"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(PG_UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    subcategory_id = Column(PG_UUID(as_uuid=True), ForeignKey("subcategories.id"), nullable=False)
    team_id = Column(PG_UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False)
    team_id = Column(PG_UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    assigned_to = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    assigned_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    assignment_reason = Column(Text, nullable=True)
    assigned_at = Column(TIMESTAMP, server_default=func.now())


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_name = Column(String(255), nullable=False)
    trigger_event = Column(String(255), nullable=True)
    conditions = Column(JSONB, nullable=True)
    actions = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_no = Column(String(50), nullable=False, unique=True)
    organization_id = Column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    department_id = Column(PG_UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    assigned_team_id = Column(PG_UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    assigned_agent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    category_id = Column(PG_UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    subcategory_id = Column(PG_UUID(as_uuid=True), ForeignKey("subcategories.id"), nullable=True)
    subject = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    attachments = relationship("Attachment", backref="ticket", cascade="all, delete-orphan")
    status = Column(String(50), nullable=False, default="OPEN")
    priority = Column(String(50), nullable=False, default="P3")
    urgency = Column(String(50), nullable=False, default="MEDIUM")
    impact = Column(String(50), nullable=False, default="MEDIUM")
    scope = Column(String(50), nullable=False, default="PERSONAL")
    source = Column(String(50), nullable=False, default="PORTAL")
    major_incident_flag = Column(Boolean, nullable=False, default=False)
    emergency_override = Column(Boolean, nullable=False, default=False)
    duplicate_status = Column(String(50), nullable=False, default="NO")
    duplicate_of = Column(PG_UUID(as_uuid=True), nullable=True)
    duplicate_reason = Column(String(100), nullable=True)
    is_duplicate = Column(Boolean, nullable=False, default=False)
    reopened_from = Column(PG_UUID(as_uuid=True), nullable=True)
    reopened_at = Column(TIMESTAMP, nullable=True)
    incident_id = Column(PG_UUID(as_uuid=True), nullable=True)
    ai_resolved = Column(Boolean, nullable=False, default=False)
    visibility_type = Column(String(50), nullable=False, default="ORGANIZATIONAL")
    ai_summary = Column(Text, nullable=True)
    ai_sentiment = Column(String(50), nullable=True)
    process_tag = Column(String(100), nullable=True)
    assigned_at = Column(TIMESTAMP, nullable=True)
    assigned_by = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    closed_at = Column(TIMESTAMP, nullable=True)

    @property
    def ticket_id(self):
        return self.id


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    sender_type = Column(String(50), nullable=True)
    message_type = Column(String(50), nullable=False, default="EMAIL")
    message_body = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    message_id = Column(PG_UUID(as_uuid=True), ForeignKey("ticket_messages.id", ondelete="CASCADE"), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    storage_path = Column(Text, nullable=False)
    uploaded_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)


class TicketAssignmentHistory(Base):
    __tablename__ = "ticket_assignment_history"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    previous_team_id = Column(PG_UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    new_team_id = Column(PG_UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    previous_agent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    new_agent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    assigned_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    assignment_reason = Column(Text, nullable=True)


class TicketRelationship(Base):
    __tablename__ = "ticket_relationships"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    child_ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(50), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class DuplicateDecisionAudit(Base):
    __tablename__ = "duplicate_decision_audit"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    matched_ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=True)
    similarity_score = Column(Numeric(5, 4), nullable=True)
    decision = Column(String(100), nullable=False)
    llm_classification = Column(String(50), nullable=True)
    llm_decision = Column(String(50), nullable=True)
    confidence = Column(Numeric(5, 4), nullable=True)
    reasoning = Column(Text, nullable=True)
    final_action = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    field_changed = Column(String(255), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)


class TicketResolution(Base):
    __tablename__ = "ticket_resolution"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    resolution_summary = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    resolution_type = Column(String(100), nullable=True)
    resolved_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    ai_generated = Column(Boolean, nullable=False, default=False)


class TicketEmbedding(Base):
    __tablename__ = "ticket_embeddings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    masked_text = Column(Text, nullable=False)
    embedding_text = Column(Text, nullable=True)  # Keep for backward compatibility / debugging
    embedding_model = Column(String(255), nullable=True)
    embedding = Column(Vector(384), nullable=True)
    vector_id = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    suggestion_type = Column(String(100), nullable=True)
    ai_response = Column(Text, nullable=True)
    feedback_status = Column(String(50), nullable=True)
    corrected_response = Column(Text, nullable=True)
    reviewed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_ref = Column(String(50), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    resolution = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    priority = Column(String(10), nullable=True)
    assigned_team = Column(String(255), nullable=True)
    resolution_time = Column(String(50), nullable=True)
    tags = Column(Text, nullable=True)
    is_published = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class KBEmbedding(Base):
    __tablename__ = "kb_embeddings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(PG_UUID(as_uuid=True), ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False)
    embedding_text = Column(Text, nullable=True)
    embedding_model = Column(String(255), nullable=True)
    vector_id = Column(String(255), nullable=True)
    embedding = Column(Vector(384), nullable=True)


class KBFeedback(Base):
    __tablename__ = "kb_feedback"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(PG_UUID(as_uuid=True), ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    rating = Column(Integer, nullable=False)
    feedback_text = Column(Text, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(String(100), nullable=True)
    title = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=True)
    sender_email = Column(String(255), nullable=True)
    receiver_email = Column(String(255), nullable=True)
    subject = Column(Text, nullable=True)
    raw_email = Column(Text, nullable=True)
    email_direction = Column(String(50), nullable=True)
    processing_status = Column(String(50), nullable=False, default="RECEIVED")


class CommentData(Base):
    __tablename__ = "comments_data"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    comment = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=True)


class AgentActivityLog(Base):
    __tablename__ = "agent_activity_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String(100), nullable=True)
    activity_description = Column(Text, nullable=True)


class CSATFeedback(Base):
    __tablename__ = "csat_feedback"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    rating = Column(Integer, nullable=False)
    feedback_text = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(PG_UUID(as_uuid=True), nullable=True)
    action_type = Column(String(100), nullable=True)
    performed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    old_data = Column(JSONB, nullable=True)
    new_data = Column(JSONB, nullable=True)


class TicketAISuggestion(Base):
    __tablename__ = "ticket_ai_suggestions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, unique=True)
    problem_summary = Column(Text, nullable=False)
    probable_root_cause = Column(Text, nullable=False)
    suggested_steps_json = Column(JSONB, nullable=False)
    confidence = Column(Numeric(5, 4), nullable=False)
    recommended_escalation_team = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class TicketSimilarityResult(Base):
    __tablename__ = "ticket_similarity_results"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    knowledge_article_id = Column(PG_UUID(as_uuid=True), ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False)
    similarity_score = Column(Numeric(6, 4), nullable=False)
    rank = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class TicketResolutionScore(Base):
    __tablename__ = "ticket_resolution_scores"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    similarity_score = Column(Numeric(6, 2), nullable=True)
    coverage_score = Column(Numeric(6, 2), nullable=True)
    resolution_quality_score = Column(Numeric(6, 2), nullable=True)
    classification_confidence = Column(Numeric(6, 2), nullable=True)
    final_resolution_confidence = Column(Numeric(6, 2), nullable=True)
    decision = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
