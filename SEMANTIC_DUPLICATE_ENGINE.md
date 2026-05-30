# Semantic Duplicate Detection Engine - Implementation Complete

## Overview

Replaced the legacy TEXT_HEURISTIC + SequenceMatcher approach with a production-ready semantic duplicate detection system using:

- **Embeddings**: Sentence-Transformers MiniLM (all-MiniLM-L6-v2) - 384 dimensions
- **Vector Search**: PostgreSQL pgvector with cosine similarity  
- **Classification**: Local Llama model (via Ollama) for PERSONAL vs ORGANIZATIONAL issue detection
- **PII Protection**: Automatic masking of sensitive data before embedding
- **Process Tracking**: Tagged decisions using `process_tag` field instead of duplicate-specific columns

---

## Architecture

### 1. PII Masking (`app/services/pii_masker.py`)

**Masks before embedding generation:**
- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- IP addresses → `[IP]`
- Employee IDs → `[EMPLOYEE_ID]`
- SSN patterns → `[SSN]`
- Person names → `[PERSON]`

**Usage:**
```python
from app.services.pii_masker import PIIMasker

masked_text = PIIMasker.mask_pii("John Doe (john@company.com) has VPN issue")
# → "[PERSON] ([EMAIL]) has VPN issue"
```

---

### 2. Embedding Service (`app/services/embedding_service.py`)

**Generates MiniLM embeddings (384 dimensions) with PII masking:**

```python
from app.services.embedding_service import EmbeddingService

# Build text from ticket fields
original, masked = EmbeddingService.mask_and_build(
    subject="Login error",
    description="Cannot login to VPN",
    attachment_text=None
)

# Generate embedding (normalized)
embedding = EmbeddingService.generate_embedding(masked)
# → numpy array of shape (384,)

# Compute similarity between embeddings
similarity = EmbeddingService.cosine_similarity(emb1, emb2)
# → float between -1 and 1 (1.0 = identical)
```

**Model**: `sentence-transformers/all-MiniLM-L6-v2`

---

### 3. Llama Classifier (`app/services/llama_classifier.py`)

**Uses local Llama model (via Ollama) to classify issues:**

- **PERSONAL ISSUE**: Affects individual user (password reset, laptop issue)
- **ORGANIZATIONAL ISSUE**: Affects multiple users (VPN outage, email outage)

**Endpoint**: `http://localhost:11434` (Ollama default)

**Fallback**: Heuristic keyword matching if Ollama unavailable

```python
from app.services.llama_classifier import LlamaClassifier

result = LlamaClassifier.classify(
    parent_subject="VPN not responding",
    parent_description="Cannot connect to VPN since this morning",
    new_subject="VPN connection issue",
    new_description="VPN is down for me"
)

# → ClassificationResult(
#     classification="ORGANIZATIONAL",
#     confidence=0.85,
#     reasoning="Both tickets describe VPN infrastructure issue"
# )
```

---

### 4. Semantic Duplicate Resolution (`app/services/semantic_duplicate_service.py`)

**Main engine - runs after ticket creation:**

#### Process Tags (instead of duplicate flags)

```python
PROCESS_TAGS = {
    "DUPLICATE_ATTACHED": "Same user + active ticket → auto-link as comment",
    "ORGANIZATIONAL_INCIDENT_LINKED": "Different user, org issue → create relationship",
    "PERSONAL_SIMILARITY_MATCH": "Different user, personal issue → new ticket",
    "NEW_TICKET_AFTER_CLOSED_WINDOW": "Closed >7 days → new ticket",
    "REOPEN_REVIEW_REQUIRED": "Closed <1 day → needs review",
    "AUTO_REOPEN": "Closed 1-7 days → auto-reopen",
    "SKIPPED_PRIORITY_P1": "P1 ticket → skip engine",
    "SKIPPED_EMERGENCY_OVERRIDE": "Emergency flag → skip engine",
    "NO_SIMILAR_TICKETS": "No candidates found",
}
```

#### Similarity Search

Uses pgvector cosine similarity operator:

```sql
SELECT ticket_id, 1 - (embedding <=> :query_vector::vector) as similarity
FROM ticket_embeddings
WHERE 1 - (embedding <=> :query_vector::vector) >= 0.85
ORDER BY similarity DESC
LIMIT 10;
```

#### Decision Rules

1. **Skip duplicate engine if**: P1 priority OR emergency_override OR major_incident_flag
2. **Same user + active ticket**: ATTACH_TO_PARENT (link as comment to parent)
3. **Closed ticket**:
   - Closed < 1 day: REOPEN_REVIEW_REQUIRED (needs manual review)
   - Closed 1-7 days: AUTO_REOPEN (reopen parent automatically)
   - Closed > 7 days: CREATE_NEW_TICKET (treat as new)
4. **Different user**:
   - Llama classification = PERSONAL: CREATE_NEW_TICKET
   - Llama classification = ORGANIZATIONAL: ORGANIZATIONAL_INCIDENT_LINKED

---

## Database Schema Changes

### ticket_embeddings table

```sql
CREATE TABLE ticket_embeddings (
    id UUID PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id),
    masked_text TEXT NOT NULL,           -- PII-masked original text
    embedding_text TEXT,                 -- First 500 chars (debugging)
    embedding VECTOR(384),               -- MiniLM embedding vector
    embedding_model VARCHAR(255),        -- "sentence-transformers/all-MiniLM-L6-v2"
    vector_id VARCHAR(255),              -- Optional external vector DB ID
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cosine similarity index
CREATE INDEX idx_ticket_embedding 
ON ticket_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### tickets table additions

```sql
ALTER TABLE tickets ADD COLUMN process_tag VARCHAR(100);
```

### duplicate_decision_audit (unchanged)

Logs every duplicate resolution decision with similarity scores and reasoning.

---

## Integration Points

### 1. Ticket Creation Flow

```python
# In app/tickets/services.py:create_ticket()

# After ticket saved to DB:
run_semantic_duplicate_resolution(
    db=db,
    ticket=ticket,
    user=user,
    attachment_text=optional_attachment_text
)
```

### 2. Database Initialization

```python
# In app/db/init_db.py

from app.db.pgvector_migration import init_pgvector, migrate_ticket_embeddings

init_pgvector(db_session)  # Enable pgvector extension
migrate_ticket_embeddings(db_session)  # Create/migrate columns & indices
```

---

## Dependencies

Added to `backend/requirements.txt`:

```
sentence-transformers        # MiniLM embeddings
pgvector                      # PostgreSQL vector type support
numpy                         # Numerical operations
requests                      # HTTP calls to Ollama
```

Install with:
```bash
pip install -r backend/requirements.txt
```

---

## Performance Characteristics

### Embedding Generation
- **Model**: MiniLM (lightweight, ~80MB)
- **Inference time**: ~50ms per ticket
- **Vector dimension**: 384 (compact vs large models)

### Vector Search
- **Index type**: IVFFlat (approximate, fast)
- **List parameter**: 100 (balanced accuracy/speed)
- **Threshold**: 0.85 cosine similarity
- **Typical query time**: <10ms on <100k embeddings

### Llama Classification
- **Depends on**: Ollama availability + local model speed
- **Timeout**: 30 seconds
- **Fallback**: Heuristic keyword matching

---

## Testing & Validation

### 1. Create two identical tickets from different users:

```bash
POST /tickets
{
    "subject": "VPN not working",
    "description": "Cannot login to VPN since this morning",
    "priority": "P2"  # Not P1
}
```

### 2. Check ticket_embeddings:

```sql
SELECT ticket_id, masked_text, embedding IS NOT NULL 
FROM ticket_embeddings 
WHERE ticket_id IN (...);
```

Should show masked text (names/emails removed) and non-null embeddings.

### 3. Check duplicate_decision_audit:

```sql
SELECT ticket_id, matched_ticket_id, decision, reasoning 
FROM duplicate_decision_audit;
```

Should log decision with confidence scores.

### 4. Check process_tag:

```sql
SELECT ticket_no, process_tag 
FROM tickets;
```

Should show appropriate process tags (e.g., ORGANIZATIONAL_INCIDENT_LINKED).

---

## Monitoring

### Logs to watch:

```
[EMBEDDING] Loading model sentence-transformers/all-MiniLM-L6-v2...
[EMBEDDING] Masked text: ...
[SEARCH] Querying similar embeddings...
[LLAMA] Classifying issue...
[DUPLICATE_ENGINE] Processing ticket INC-2026-000001...
```

### Common issues:

1. **"Ollama not available"**: Llama service not running → uses heuristic fallback
2. **pgvector extension missing**: Database migration will enable it
3. **Memory pressure**: MiniLM model (~80MB) + batch inference can use RAM
4. **Slow embedding generation**: First load caches model (~30 seconds), subsequent calls <100ms

---

## Migration for Existing Tickets

Background job script (not yet implemented):

```python
# Pseudocode: app/scripts/migrate_embeddings.py
def migrate_existing_tickets(batch_size=100):
    """Migrate all existing tickets to new embedding system."""
    tickets = db.query(Ticket).filter(Ticket.id.notin_(
        db.query(TicketEmbedding.ticket_id)
    )).all()
    
    for batch in chunk(tickets, batch_size):
        for ticket in batch:
            masked_text, embedding = generate_embedding_for_ticket(
                subject=ticket.subject,
                description=ticket.description
            )
            persist_ticket_embedding(db, ticket, masked_text, embedding)
        db.commit()
```

---

## Success Criteria ✓

- ✓ No SequenceMatcher usage
- ✓ No TEXT_HEURISTIC model
- ✓ Uses MiniLM embeddings (384 dimensions)
- ✓ Uses pgvector cosine similarity
- ✓ Uses Llama for PERSONAL/ORGANIZATIONAL classification
- ✓ PII masked before embedding generation
- ✓ Same-user duplicates automatically linked
- ✓ Organizational incidents automatically grouped
- ✓ Full audit logging for every decision
- ✓ Uses process_tag instead of duplicate flags
