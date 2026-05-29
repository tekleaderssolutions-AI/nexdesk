import uuid
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, TIMESTAMP, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.sql import func

from app.db.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    plan_type = Column(String(50), nullable=True)


class Department(Base):
    __tablename__ = "departments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    department_name = Column(String(255), nullable=False)


class Team(Base):
    __tablename__ = "teams"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id = Column(PG_UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    team_name = Column(String(255), nullable=False)



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


class Agent(Base):
    __tablename__ = "agents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    employee_code = Column(String(100), nullable=True)
    skill_group = Column(String(255), nullable=True)
    is_available = Column(Boolean, nullable=False, default=True)


class Category(Base):
    __tablename__ = "categories"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_name = Column(String(255), nullable=False)


class Subcategory(Base):
    __tablename__ = "subcategories"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(PG_UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    subcategory_name = Column(String(255), nullable=False)


class SLARule(Base):
    __tablename__ = "sla_rules"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(PG_UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    priority = Column(String(50), nullable=True)
    response_time_minutes = Column(Integer, nullable=True)
    resolution_time_minutes = Column(Integer, nullable=True)
    escalation_enabled = Column(Boolean, nullable=False, default=True)


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
    status = Column(String(50), nullable=False, default="OPEN")
    priority = Column(String(50), nullable=False, default="MEDIUM")
    urgency = Column(String(50), nullable=False, default="MEDIUM")
    impact = Column(String(50), nullable=False, default="INDIVIDUAL")
    source = Column(String(50), nullable=False, default="EMAIL")
    visibility_type = Column(String(50), nullable=False, default="ORGANIZATIONAL")
    ai_summary = Column(Text, nullable=True)
    ai_sentiment = Column(String(50), nullable=True)
    is_duplicate = Column(Boolean, nullable=False, default=False)


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(PG_UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    sender_type = Column(String(50), nullable=True)
    message_type = Column(String(50), nullable=False, default="EMAIL")
    message_body = Column(Text, nullable=False)


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
    embedding_text = Column(Text, nullable=False)
    embedding_model = Column(String(255), nullable=True)
    vector_id = Column(String(255), nullable=True)


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
    category_id = Column(PG_UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(Text, nullable=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    is_published = Column(Boolean, nullable=False, default=True)


class KBEmbedding(Base):
    __tablename__ = "kb_embeddings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(PG_UUID(as_uuid=True), ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False)
    embedding_text = Column(Text, nullable=True)
    embedding_model = Column(String(255), nullable=True)
    vector_id = Column(String(255), nullable=True)


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
