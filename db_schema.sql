
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    plan_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    department_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL,
    CHECK (role IN ('USER', 'TEAM', 'ADMIN')),
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    is_temp_password BOOLEAN DEFAULT FALSE,
    created_by UUID,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    member_role VARCHAR(50) DEFAULT 'AGENT',
    CHECK (member_role IN ('TEAM_LEAD', 'AGENT', 'MANAGER', 'L2_SUPPORT', 'L3_SUPPORT'))
);

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    employee_code VARCHAR(100),
    skill_group VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_member_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficiency VARCHAR(50) DEFAULT 'INTERMEDIATE',
    CHECK (proficiency IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'))
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_name VARCHAR(255) NOT NULL
);

CREATE TABLE priority_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_code VARCHAR(10) UNIQUE NOT NULL,
    priority_name VARCHAR(50) NOT NULL,
    business_impact TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sla_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_id UUID NOT NULL,
    first_response_minutes INTEGER NOT NULL,
    resolution_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sla_priority
        FOREIGN KEY(priority_id)
        REFERENCES priority_master(id)
);

CREATE TABLE assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL,
    subcategory_id UUID NOT NULL,
    team_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ar_category
        FOREIGN KEY(category_id)
        REFERENCES categories(id),
    CONSTRAINT fk_ar_subcategory
        FOREIGN KEY(subcategory_id)
        REFERENCES subcategories(id),
    CONSTRAINT fk_ar_team
        FOREIGN KEY(team_id)
        REFERENCES teams(id)
);

CREATE TABLE ticket_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    team_id UUID,
    assigned_to UUID,
    assigned_by UUID,
    assignment_reason TEXT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(255),
    conditions JSONB,
    actions JSONB,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_no VARCHAR(50) UNIQUE NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    department_id UUID REFERENCES departments(id),
    assigned_team_id UUID REFERENCES teams(id),
    created_by UUID REFERENCES users(user_id),
    assigned_agent_id UUID REFERENCES agents(id),
    category_id UUID REFERENCES categories(id),
    subcategory_id UUID REFERENCES subcategories(id),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'OPEN',
    priority VARCHAR(50) DEFAULT 'P3',
    urgency VARCHAR(50) DEFAULT 'MEDIUM',
    impact VARCHAR(50) DEFAULT 'MEDIUM',
    scope VARCHAR(50) DEFAULT 'PERSONAL',
    source VARCHAR(50) DEFAULT 'PORTAL',
    major_incident_flag BOOLEAN DEFAULT FALSE,
    emergency_override BOOLEAN DEFAULT FALSE,
    duplicate_status VARCHAR(50) DEFAULT 'NO',
    duplicate_of UUID,
    duplicate_reason VARCHAR(100),
    is_duplicate BOOLEAN DEFAULT FALSE,
    reopened_from UUID,
    reopened_at TIMESTAMP,
    incident_id UUID,
    ai_resolved BOOLEAN DEFAULT FALSE,
    visibility_type VARCHAR(50) DEFAULT 'ORGANIZATIONAL',
    ai_summary TEXT,
    ai_sentiment VARCHAR(50),
    process_tag VARCHAR(100),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    closed_at TIMESTAMP
);

CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(user_id),
    sender_type VARCHAR(50),
    message_type VARCHAR(50) DEFAULT 'EMAIL',
    message_body TEXT NOT NULL
);

CREATE TABLE ticket_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    child_ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE duplicate_decision_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    matched_ticket_id UUID REFERENCES tickets(id),
    similarity_score NUMERIC(5,4),
    decision VARCHAR(100) NOT NULL,
    llm_decision VARCHAR(50),
    confidence NUMERIC(5,4),
    reasoning TEXT,
    final_action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(user_id)
);

CREATE TABLE ticket_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    previous_team_id UUID REFERENCES teams(id),
    new_team_id UUID REFERENCES teams(id),
    previous_agent_id UUID REFERENCES agents(id),
    new_agent_id UUID REFERENCES agents(id),
    assigned_by UUID REFERENCES users(user_id),
    assignment_reason TEXT
);

CREATE TABLE ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    field_changed VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(user_id)
);

CREATE TABLE ticket_resolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    resolution_summary TEXT,
    root_cause TEXT,
    resolution_type VARCHAR(100),
    resolved_by UUID REFERENCES users(user_id),
    ai_generated BOOLEAN DEFAULT FALSE
);

CREATE TABLE ticket_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    masked_text TEXT NOT NULL,
    embedding_text TEXT,
    embedding VECTOR(384),
    embedding_model VARCHAR(255),
    vector_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(100),
    ai_response TEXT,
    feedback_status VARCHAR(50),
    corrected_response TEXT,
    reviewed_by UUID REFERENCES users(user_id)
);

CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_ref VARCHAR(50),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    resolution TEXT NOT NULL,
    category VARCHAR(100),
    priority VARCHAR(10),
    assigned_team VARCHAR(255),
    resolution_time VARCHAR(50),
    tags TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kb_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
    embedding_text TEXT,
    embedding_model VARCHAR(255),
    vector_id VARCHAR(255)
);

CREATE TABLE kb_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(100),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE
);

CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id),
    sender_email VARCHAR(255),
    receiver_email VARCHAR(255),
    subject TEXT,
    raw_email TEXT,
    email_direction VARCHAR(50),
    processing_status VARCHAR(50) DEFAULT 'RECEIVED'
);

CREATE TABLE comments_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE
);

CREATE TABLE agent_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    activity_type VARCHAR(100),
    activity_description TEXT
);

CREATE TABLE csat_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100),
    entity_id UUID,
    action_type VARCHAR(100),
    performed_by UUID REFERENCES users(user_id),
    old_data JSONB,
    new_data JSONB
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_agent_id ON tickets(assigned_agent_id);
CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_embeddings_ticket_id ON ticket_embeddings(ticket_id);
CREATE INDEX idx_ticket_embedding ON ticket_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_kb_embeddings_kb_id ON kb_embeddings(kb_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_email_logs_ticket_id ON email_logs(ticket_id);

-- ==================== SEED DATA ====================

INSERT INTO priority_master (priority_code, priority_name, business_impact)
VALUES
    ('P1', 'Critical', 'Business outage'),
    ('P2', 'High',     'Department impact'),
    ('P3', 'Medium',   'Single user impact'),
    ('P4', 'Low',      'Service request');

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 15,   240  FROM priority_master WHERE priority_code = 'P1';

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 30,   480  FROM priority_master WHERE priority_code = 'P2';

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 120,  1440 FROM priority_master WHERE priority_code = 'P3';

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 480,  4320 FROM priority_master WHERE priority_code = 'P4';

-- ==================== SEED DATA ====================

INSERT INTO priority_master (priority_code, priority_name, business_impact)
VALUES
    ('P1', 'Critical', 'Business outage'),
    ('P2', 'High',     'Department impact'),
    ('P3', 'Medium',   'Single user impact'),
    ('P4', 'Low',      'Service request');

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 15,   240  FROM priority_master WHERE priority_code = 'P1';

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 30,   480  FROM priority_master WHERE priority_code = 'P2';

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 120,  1440 FROM priority_master WHERE priority_code = 'P3';

INSERT INTO sla_rules (priority_id, first_response_minutes, resolution_minutes)
SELECT id, 480,  4320 FROM priority_master WHERE priority_code = 'P4';
