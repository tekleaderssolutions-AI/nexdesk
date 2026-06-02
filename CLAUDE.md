# NextDesk — Project Reference for Claude

Read this file at the start of every session. It contains the full architecture, file map, CSS system, API contract, and all work already completed. Do not re-read source files to answer questions already covered here — use this as the single source of truth and only open a file when you need to make a change to it.

---

## 1. What This Project Is

NextDesk is an AI-powered IT helpdesk/ticketing system.

- Users submit support tickets via a portal
- AI classifies tickets (category, subcategory, department, priority, urgency, impact) and checks for duplicates
- AI embeds tickets and searches a Knowledge Base via pgvector cosine similarity
- Based on a confidence score and ticket priority, tickets follow a 3-level AI resolution workflow (see Section 9)
- P1 tickets bypass the duplicate engine and KB pipeline — classification runs only to assign the correct team, then priority is pinned back to P1
- Teams manage tickets in a workspace and chat with users in real time
- Admins manage users, teams, departments, organizations, SLA rules, and view analytics with AI resolution metrics

---

## 2. Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + SQLAlchemy ORM |
| Database | PostgreSQL + pgvector extension |
| Embeddings | `sentence-transformers` via `EmbeddingService` (384-dim vectors) |
| LLM classification | LLaMA (via `llama_classifier.py`) |
| Frontend | React + Vite |
| Styling | Custom dark CSS class system (`portal.css`) — NO Tailwind in portal pages |
| Auth | JWT token stored in localStorage, sent as Bearer header |
| Charts | SVG built from scratch — no recharts/chart.js installed |

---

## 3. Directory Structure

```
nextdesk/
├── backend/
│   └── app/
│       ├── main.py                        # FastAPI app, router registration, CORS, startup
│       ├── models/
│       │   ├── __init__.py                # Re-exports all models (including TicketConversation)
│       │   └── models.py                  # ALL SQLAlchemy ORM models (single file)
│       ├── db/
│       │   ├── database.py                # engine, SessionLocal
│       │   ├── base.py                    # declarative Base
│       │   ├── dependencies.py            # get_db dependency
│       │   └── init_db.py                 # create_all + ensure_table_columns (auto-migration)
│       ├── auth/
│       │   ├── routes.py                  # /login, /me, /change-password
│       │   ├── schemas.py                 # LoginRequest, TokenResponse, UserResponse
│       │   └── dependencies.py            # get_current_user, get_current_admin, get_current_team
│       ├── tickets/
│       │   ├── routes.py                  # ALL ticket + chat + KB endpoints
│       │   ├── services.py                # Business logic for tickets, chat, timeline, stats
│       │   └── schemas.py                 # Pydantic request/response models
│       ├── admin/
│       │   ├── routes.py                  # Admin-only endpoints (users, teams, KB embeddings, analytics)
│       │   ├── services.py                # Admin analytics services (CSAT, analytics, org structure)
│       │   └── schemas.py                 # Admin Pydantic models
│       └── services/
│           ├── embedding_service.py       # EmbeddingService: generate_embedding(), build_embedding_text()
│           ├── kb_similarity_service.py   # run_resolution_confidence() — full KB + 3-level dispatch
│           ├── kb_embedding_service.py    # Generate and store KB embeddings
│           ├── classification_service.py  # run_classification_pipeline() — classifies category, subcategory, department, priority, urgency, impact, team
│           ├── ai_resolution_service.py   # execute_ai_resolution_workflow() — 3-level AI resolution (L1/L2/L3)
│           ├── ai_suggestion_service.py   # get_suggestion(), trigger_async()
│           ├── semantic_duplicate_service.py  # run_semantic_duplicate_resolution()
│           ├── llama_classifier.py        # LLM wrapper
│           └── pii_masker.py              # Mask PII before embedding
│
└── NextDeskFrontend/
    └── src/
        ├── App.jsx                        # Just renders <AppRoutes />
        ├── routes/AppRoutes.jsx           # All route definitions (see Section 7)
        ├── context/AuthContext.jsx        # useAuth() hook — user, login, logout
        ├── services/
        │   ├── api.js                     # axios instance with JWT header injection
        │   ├── authService.js             # login, localStorage helpers
        │   └── ticketService.js           # All ticket/chat/KB/admin API calls
        ├── styles/
        │   └── portal.css                 # ENTIRE dark theme CSS (see Section 5)
        ├── layouts/
        │   ├── UserLayout.jsx             # Wraps /user/* — applies .user-theme class
        │   ├── TeamLayout.jsx             # Wraps /team/* — applies .team-theme class
        │   ├── AdminLayout.jsx            # Wraps /admin/* — sidebar has Management + Administration + AI Engine sections
        │   └── AuthLayout.jsx             # Wraps /login
        └── pages/
            ├── auth/    Login.jsx, ForgotPassword.jsx
            ├── user/    UserDashboard.jsx, MyTickets.jsx, TicketDetails.jsx, CSAT.jsx,
            │            NewTicket.jsx, Profile.jsx
            ├── team/    TeamDashboard.jsx, AssignedQueue.jsx, TicketWorkspace.jsx,
            │            Incidents.jsx, KnowledgeBase.jsx
            └── admin/   AdminDashboard.jsx, AdminAllTickets.jsx, AdminUserList.jsx,
                         AdminUserForm.jsx, AdminTeams.jsx, AdminAnalytics.jsx,
                         WorkflowControls.jsx, CSATAnalytics.jsx, IncidentDashboard.jsx,
                         AdminOrganizations.jsx, AdminDepartmentsPage.jsx, AdminTeamsPage.jsx,
                         AdminTeamMembers.jsx, AdminTools.jsx
```

---

## 4. Database Models (all in `backend/app/models/models.py`)

| Model | Table | Key Columns |
|---|---|---|
| `Organization` | `organizations` | id, org_name, domain, plan_type |
| `Department` | `departments` | id, organization_id, department_name |
| `Team` | `teams` | id, department_id, team_name |
| `User` | `users` | user_id, organization_id, department_id, full_name, email, password_hash, role (USER/TEAM/ADMIN) |
| `TeamMember` | `team_members` | id, team_id, user_id, member_role |
| `Ticket` | `tickets` | id, ticket_no, assigned_team_id, created_by, status, priority, urgency, impact, scope, source, major_incident_flag, emergency_override, ai_resolved, process_tag, assigned_by, resolution_type, final_resolution_confidence, original_ai_solution, edited_team_solution, ai_solution_approved_by, ai_solution_approved_at |
| `TicketMessage` | `ticket_messages` | id, ticket_id, sender_id, sender_type (USER/TEAM/ADMIN/AI), message_type (CHAT/EMAIL), message_body, created_at |
| `TicketConversation` | `ticket_conversations` | id, ticket_id, sender_id, sender_role (USER/TEAM/ADMIN/AI), message, attachment_url, is_internal (bool), created_at |
| `TicketHistory` | `ticket_history` | id, ticket_id, field_changed, old_value, new_value, changed_by |
| `TicketAISuggestion` | `ticket_ai_suggestions` | id, ticket_id, problem_summary, probable_root_cause, suggested_steps_json, confidence, recommended_escalation_team |
| `TicketResolutionScore` | `ticket_resolution_scores` | id, ticket_id, similarity_score, coverage_score, resolution_quality_score, classification_confidence, final_resolution_confidence, decision |
| `TicketSimilarityResult` | `ticket_similarity_results` | id, ticket_id, knowledge_article_id, similarity_score, rank |
| `KnowledgeBase` | `knowledge_base` | id, title, description, resolution, category, priority, assigned_team, tags, is_published |
| `KBEmbedding` | `kb_embeddings` | id, kb_id, embedding (Vector 384) |
| `CSATFeedback` | `csat_feedback` | id, ticket_id, user_id, rating, feedback_text |
| `Notification` | `notifications` | id, user_id, notification_type, title, message, is_read |

### `Ticket.ticket_id` property
```python
@property
def ticket_id(self):
    return self.id
```
The real PK column is `id` (UUID). The `ticket_id` property is an alias so frontend can use `ticket.ticket_id` consistently.

### `TicketConversation` vs `TicketMessage`
- `TicketMessage` — user-visible chat (sender_type=AI, USER, TEAM, ADMIN). Used for L1 AI auto-resolve messages and all user-facing chat.
- `TicketConversation` — structured thread for P1/P2 tickets and internal notes. `is_internal=True` records are hidden from USERs. L2 and L3 AI notes are stored here with `is_internal=True`.

### Ticket status values
```
OPEN | IN_PROGRESS | RESOLVED | CLOSED | REOPENED | ESCALATED
AI_RESOLVED_PENDING_USER_CONFIRMATION  ← L1: user must Accept or reject
AI_TEAM_REVIEW                         ← L2: team must Approve/Edit/Reject AI suggestion
TEAM_APPROVED_AI_RESPONSE              ← L2: team approved, user must Accept or escalate
PENDING_* | AI_RESOLVED
```

### Ticket `resolution_type` values
```
AI_AUTO_RESOLVE    ← L1 (P4/P5 high confidence)
AI_TEAM_REVIEW     ← L2 (P3, or P4/P5 moderate confidence)
ROUTE_TO_TEAM      ← L3 (P1/P2 always; low confidence)
```

### Auto-migration
`init_db.py` calls `ensure_table_columns()` on startup. This auto-adds new columns to existing tables using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. New columns in models will appear in the DB automatically on next server start — no manual migration needed.

---

## 5. CSS Dark Theme System (`NextDeskFrontend/src/styles/portal.css`)

**All user/team/admin portal pages use this CSS exclusively — no Tailwind.**

### Theme variables (set by layout wrapper class)
```css
.user-theme  { --accent: #4f8ef7; --accent-dark: #3b6fff; }   /* blue  */
.team-theme  { --accent: #34d399; --accent-dark: #059669; }   /* green */
.admin-theme { --accent: #a855f7; --accent-dark: #7c3aed; }   /* purple */

/* All themes share: */
--bg: #07090f      /* page background */
--bg2: #090d1a     /* sidebar */
--bg3: #0c1220     /* cards */
--text: #e2e8f0    /* primary text */
--text2: #3d5378   /* secondary/muted text */
--border: #101828  /* border color */
```

### Core layout classes
| Class | Purpose |
|---|---|
| `.layout` | Outer flex container (sidebar + main) |
| `.sidebar` | Left nav (236px) |
| `.main` | Right content area |
| `.topbar` | Top bar (56px, search + actions) |
| `.content` | Scrollable page content area (padding: 24px) |
| `.page` | Fade-in animation wrapper for page content |
| `.card` | Dark card (bg3, border, 14px radius, 20px padding) |
| `.stat` | Stat card (gradient bg3→bg2) |
| `.ff` | Outfit font family |

### Buttons
| Class | Style |
|---|---|
| `.btn-p` | Primary — accent color fill |
| `.btn-s` | Secondary — transparent with border |
| `.btn-link` | Inline text link style |

### Form elements
| Class | Purpose |
|---|---|
| `.inp` | Dark input (bg3, border, 10px radius) |
| `.sel` | Dark select element |

### Priority badges (use with `.b` base class)
```
.b    → base badge (inline-flex, 11px, bold, 20px border-radius)
.p1   → red    (P1 Critical)
.p2   → orange (P2 High)
.p3   → yellow (P3 Medium)
.p4   → blue   (P4 Low)
.p5   → gray   (P5 Minimal)
```
Usage: `<span className="b p2">● P2</span>`

### Status badges (use with `.b` base class)
```
.s-open  → blue   (OPEN)
.s-prog  → yellow (IN_PROGRESS)
.s-res   → green  (RESOLVED / CLOSED)
.s-reo   → orange (REOPENED)
.s-ai    → purple (AI_RESOLVED)
.s-esc   → red    (ESCALATED)
.s-pend  → gray   (PENDING_*)
```
Usage: `<span className="b s-prog">In Progress</span>`

### Resolution type badges
```
.badge-ai-solved     → green  (AI Auto Resolved)
.badge-team-approved → blue   (Team Approved AI Solution)
.badge-human         → orange (Human Resolved)
.badge-ai-review     → purple (AI Team Review)
```

### Specialty classes
| Class | Purpose |
|---|---|
| `.tbl` | Full-width dark table |
| `.tbl th` | Header: 10px uppercase, muted, bottom border |
| `.tbl td` | Row: 13px, muted, hover highlights |
| `.tbl td.bright` | Brighter cell text |
| `.pbar` / `.pfill` | Slim progress bar (3px height) |
| `.tl-item` / `.tl-dot` | Timeline with connecting vertical line |
| `.ai-panel` | Purple gradient panel (for AI content) |
| `.ai-review-panel` | Purple gradient panel — used for TeamAIReviewPanel |
| `.msg-me` | Chat bubble — sender (blue, right-aligned) |
| `.msg-them` | Chat bubble — receiver (dark, left-aligned) |
| `.nav-item` / `.nav-item.active` | Sidebar nav links |
| `.notif-dd` / `.notif-item` | Notification dropdown |
| `.portal-tag` | Small accent chip in topbar |
| `.icon-btn` | Square icon button |

---

## 6. Backend API Endpoints

Backend runs at `http://127.0.0.1:8000`. All endpoints require `Authorization: Bearer <token>` except `/login`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/login` | `{ email, password }` → `{ access_token, token_type, user }` |
| GET | `/me` | Returns current user object |
| POST | `/change-password` | Change password |

### Tickets
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/tickets` | Any auth | Create ticket. P1 detected → skip duplicate engine + KB pipeline, run classification for team assignment only, pin priority to P1. Others → run duplicate engine + KB/resolution pipeline. |
| GET | `/tickets` | Scoped by role | List tickets (USER: own only, TEAM: assigned, ADMIN: all) |
| GET | `/tickets/{id}` | Scoped | Get single ticket with enriched names |
| PUT | `/tickets/{id}` | Scoped | Update ticket fields |
| PUT | `/tickets/{id}/status` | TEAM/ADMIN | Change ticket status |
| PUT | `/tickets/{id}/assign` | ADMIN | Assign team/agent |
| POST | `/tickets/{id}/classify` | ADMIN | Run classification pipeline |
| GET | `/tickets/{id}/timeline` | Scoped | Ticket history events |
| GET | `/tickets/{id}/relationships` | Scoped | Parent/child ticket links |
| GET | `/tickets/{id}/ai-suggestion` | Scoped | AI summary (problem, root cause, steps, confidence) |
| POST | `/tickets/{id}/ai-suggestion/generate` | Scoped | Trigger AI suggestion regeneration |
| GET | `/tickets/{id}/resolution-confidence` | Scoped | Run KB similarity pipeline → 3-level decision + scores |
| GET | `/tickets/{id}/resolution` | Scoped | Get resolution record |
| GET | `/tickets/{id}/messages` | Scoped | Get CHAT messages for ticket (TicketMessage) |
| POST | `/tickets/{id}/messages` | Scoped | Send CHAT message `{ message_body }` |
| GET | `/tickets/{id}/ai-resolution` | Scoped | Returns `AIResolutionDataResponse` (level, solution text, approval info) |
| POST | `/tickets/{id}/team-ai-action` | TEAM/ADMIN | `{ action: APPROVE|EDIT|REJECT, edited_solution? }` — only when status=AI_TEAM_REVIEW |
| GET | `/tickets/{id}/conversations` | Scoped | Get TicketConversation thread (TEAM/ADMIN see internal, USER doesn't) |
| POST | `/tickets/{id}/conversations` | Scoped | Send conversation message `{ message, attachment_url? }` |
| POST | `/tickets/{id}/accept-resolution` | Ticket creator | Accept AI or team-approved resolution → CLOSED |
| POST | `/tickets/{id}/reject-resolution` | Ticket creator | Reject resolution → OPEN |

### Knowledge Base
| Method | Path | Description |
|---|---|---|
| GET | `/knowledge-base` | List published KB articles (filter: category, team, priority, search) |
| GET | `/knowledge-base/meta` | Categories + teams with article counts |
| GET | `/knowledge-base/{id}` | Single KB article |

### Dashboard / Stats
| Method | Path | Access |
|---|---|---|
| GET | `/dashboard/stats` | ADMIN — full metrics including `department_breakdown`, `daily_volume` (30d), `active_incidents`, `ai_resolution_pct`, `sla_compliance_pct`, `duplicate_reduction_pct`, `avg_resolution_hours`, `tickets_reopened`, `pending_feedback`, `incidents_list`, `category_breakdown`, AI resolution metrics |
| GET | `/department/stats` | TEAM/ADMIN — dept-scoped stats |
| GET | `/notifications` | Current user's notifications |
| POST | `/notifications/read` | Mark all notifications as read |
| GET | `/departments` | List active departments |
| GET | `/departments/{id}/teams` | List teams in a department |

### Admin-only endpoints (`/admin/` prefix — require `get_current_admin`)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/csat-analytics` | `?days=30&team_id=&rating=` → `{ avg_csat, total_rated, satisfaction_rate, reopen_rate, low_satisfaction_count, monthly_trend, dept_csat, alerts, rating_distribution }` |
| GET | `/admin/analytics` | `?dept_id=&team_id=&member_id=&days=90` → `{ total_tickets, resolved_pct, category_breakdown, subcategory_breakdown, priority_breakdown, status_breakdown, csat, time_to_resolve, user_stats }` |
| GET | `/admin/structure` | Returns org tree `{ departments: [{ id, name, teams: [{ id, name, members: [{ user_id, full_name, member_role }] }] }] }` |
| GET | `/admin/users` | List all users (`?limit=500`) — each user has `role` field (USER/TEAM/ADMIN) |
| POST | `/admin/kb-embeddings/generate` | Trigger KB embedding generation |
| POST | `/admin/backfill-auto-resolve` | Backfill auto-resolve for existing tickets |
| GET | `/admin/sla-rules` | List SLA rules |
| PUT | `/admin/sla-rules/{id}` | Update SLA rule |

### Access control rule (enforced by `assert_ticket_visible`)
- ADMIN → see all tickets
- USER → only tickets where `created_by == user.user_id`
- TEAM → any ticket where `assigned_team_id IS NOT NULL`

---

## 7. Frontend Routes

```
/login                          → Login.jsx
/forgot-password                → ForgotPassword.jsx

/user/dashboard                 → UserDashboard.jsx
/user/tickets                   → MyTickets.jsx
/user/ticket/:id                → TicketDetails.jsx  (role=USER view)
/user/csat                      → CSAT.jsx
/user/profile                   → Profile.jsx
/user/new                       → NewTicket.jsx

/team/dashboard                 → TeamDashboard.jsx
/team/queue                     → AssignedQueue.jsx
/team/workspace                 → TicketWorkspace.jsx
/team/ticket/:id                → TicketDetails.jsx  (role=TEAM view)
/team/incidents                 → Incidents.jsx
/team/knowledge                 → KnowledgeBase.jsx

/admin/dashboard                → AdminDashboard.jsx
/admin/all-tickets              → AdminAllTickets.jsx
/admin/users                    → AdminUserList.jsx
/admin/users/create             → AdminUserForm.jsx
/admin/users/:userId            → AdminUserForm.jsx (edit)
/admin/teams                    → AdminTeams.jsx        (Escalation Hierarchy + Roles & Permissions)
/admin/csat                     → CSATAnalytics.jsx
/admin/analytics                → AdminAnalytics.jsx    (dept→team→member drill-down)
/admin/workflows                → WorkflowControls.jsx
/admin/incidents                → IncidentDashboard.jsx
/admin/organizations            → AdminOrganizations.jsx
/admin/departments              → AdminDepartmentsPage.jsx
/admin/teams-manage             → AdminTeamsPage.jsx
/admin/team-members             → AdminTeamMembers.jsx
/admin/tools                    → AdminTools.jsx
/admin/ticket/:id               → TicketDetails.jsx  (role=ADMIN view)
```

Route protection: `RoleProtectedRoute` in `AppRoutes.jsx` redirects unauthorized roles.

### Admin sidebar sections (`AdminLayout.jsx`)
```
Management:     Dashboard, All Tickets, Users, CSAT, Analytics, Workflows, Incidents
Administration: Organizations, Departments, Teams, Team Members
AI Engine:      AI Tools
```
Note: "Teams" was removed from the Management section (it linked to the old `/admin/teams` route). Teams management is now under Administration as `/admin/teams-manage`.

---

## 8. Key Frontend Services (`ticketService.js`)

All functions return `{ success: true/false, ...data }` — never throw.

```js
fetchTickets(params)                                      // GET /tickets
getTicket(ticketId)                                       // GET /tickets/{id}
createTicket({ subject, description, ... })               // POST /tickets
getTicketTimeline(ticketId)                               // GET /tickets/{id}/timeline
getAISuggestion(ticketId)                                 // GET /tickets/{id}/ai-suggestion
getResolutionConfidence(ticketId)                         // GET /tickets/{id}/resolution-confidence
getTicketMessages(ticketId)                               // GET /tickets/{id}/messages
sendTicketMessage(ticketId, messageBody)                  // POST /tickets/{id}/messages
getAIResolutionData(ticketId)                             // GET /tickets/{id}/ai-resolution
submitTeamAIAction(ticketId, action, editedSolution?)     // POST /tickets/{id}/team-ai-action
getConversations(ticketId)                                // GET /tickets/{id}/conversations
sendConversationMessage(ticketId, message, attachmentUrl?) // POST /tickets/{id}/conversations
acceptAIResolution(ticketId)                              // POST /tickets/{id}/accept-resolution
rejectAIResolution(ticketId)                              // POST /tickets/{id}/reject-resolution
fetchKBArticles({ category, search, ... })                // GET /knowledge-base
fetchDepartmentDashboardStats()                           // GET /department/stats
fetchDashboardStats()                                     // GET /dashboard/stats
fetchAdminCSATAnalytics({ days, teamId, rating })         // GET /admin/csat-analytics
fetchAdminAnalytics({ deptId, teamId, memberId, days })   // GET /admin/analytics
fetchOrgStructure()                                       // GET /admin/structure
getMe()                                                   // GET /me
```

---

## 9. 3-Level AI Resolution Workflow

### Overview

Orchestrated by `kb_similarity_service.py` (scoring) → `ai_resolution_service.py` (execution).  
Called automatically when a non-P1 ticket is created (`run_resolution_confidence`).

| Level | Trigger | Resolution type | What happens |
|---|---|---|---|
| **L1 AI_AUTO_RESOLVE** | P4/P5, confidence ≥ 70–75 | `AI_AUTO_RESOLVE` | AI message sent to user via `TicketMessage(sender_type="AI")`. Status → `AI_RESOLVED_PENDING_USER_CONFIRMATION`. User sees `AIAutoResolvePanel` → Accept (→ CLOSED) or Need Human (→ OPEN). |
| **L2 AI_TEAM_REVIEW** | P3 ≥ 65, or P4/P5 moderate | `AI_TEAM_REVIEW` | AI suggestion saved as `TicketConversation(is_internal=True)`. Status → `AI_TEAM_REVIEW`. Team sees `TeamAIReviewPanel` → Approve/Edit/Reject. If approved → `TicketMessage(sender_type="TEAM")` sent to user, status → `TEAM_APPROVED_AI_RESPONSE`. User sees `TeamApprovedPanel` → Accept (→ CLOSED) or Need Further Help. |
| **L3 ROUTE_TO_TEAM** | P1/P2 always; low confidence | `ROUTE_TO_TEAM` | Internal troubleshooting guidance saved as `TicketConversation(is_internal=True)`. No status change. Full chat between user/team/admin. |

### Thresholds (`kb_similarity_service.py`)
```python
THRESHOLD_AUTO_P4 = 75.0        # P4 → AI_AUTO_RESOLVE if final ≥ this
THRESHOLD_AUTO_P5 = 70.0        # P5 → AI_AUTO_RESOLVE if final ≥ this
THRESHOLD_TEAM_REVIEW_P3 = 65.0 # P3 → AI_TEAM_REVIEW if final ≥ this
THRESHOLD_TEAM_REVIEW_P4 = 50.0 # P4 → AI_TEAM_REVIEW if final ≥ this (below AUTO)
THRESHOLD_TEAM_REVIEW_P5 = 45.0 # P5 → AI_TEAM_REVIEW if final ≥ this (below AUTO)
```
P1/P2 always → `ROUTE_TO_TEAM` regardless of score.

### Score formula
`final = 0.40×similarity + 0.30×coverage + 0.20×classification_confidence + 0.10×resolution_quality`

### Return shape
```json
{
  "ticket_id": "...",
  "decision": "AI_AUTO_RESOLVE | AI_TEAM_REVIEW | ROUTE_TO_TEAM",
  "final_resolution_confidence": 82.5,
  "top_matches": [{ "article_id": "...", "title": "...", "similarity_score": 0.91, "resolution": "..." }],
  "component_scores": { "similarity_score": 91, "coverage_score": 75, ... },
  "thresholds": { "THRESHOLD_AUTO_P4": 75.0, ... }
}
```

---

## 10. P1 Emergency Fast-Path (ticket creation)

Detected in `services.py` via `_is_p1_emergency(subject, description, explicit_priority)`:
- Returns `True` if `priority == "P1"` OR if `\bP1\b` appears (case-insensitive) anywhere in subject or description.

**When P1 is detected on `POST /tickets`:**
1. Ticket is created with `priority="P1"`, `major_incident_flag=True`, `emergency_override=True`
2. **Duplicate engine skipped** — `run_semantic_duplicate_resolution` is NOT called
3. **KB/resolution pipeline skipped** — `run_resolution_confidence` is NOT called
4. **Classification runs** (`run_classification_pipeline`) to determine category, department, and assign the correct team
5. After classification, priority is **pinned back to P1** (classification may have suggested a different priority — that override is discarded)
6. If classification assigns no team, `_assign_p1_team()` fallback finds the first active team in the user's department (or org)
7. Timeline event `P1_DIRECT_ASSIGN` is logged

---

## 11. Classification Pipeline (`classification_service.py`)

`run_classification_pipeline(db, ticket)` — 10 steps:

1. Fetch master data (categories, subcategories, departments, teams)
2. Category classification (LLM + heuristic)
3. **Department classification** (LLM + heuristic) — sets `ticket.department_id`
4. Subcategory classification
5. Priority classification
6. Urgency classification
7. Impact classification
8. Scope classification
9. Team auto-assignment (based on category/department match)
10. Embedding text update

`_apply_pipeline_result()` sets `ticket.department_id` from classification before team assignment. Team's department overrides department_id if auto-assign fires.

Pipeline result dict includes: `category_id`, `category_name`, `subcategory_id`, `department_id`, `department_name`, `department_confidence`, `priority`, `urgency`, `impact`, `assigned_team_id`, `assigned_team_name`.

---

## 12. Chat System

### TicketMessage (user-visible chat)
- Table: `ticket_messages`, `message_type = "CHAT"`
- `sender_type`: `"USER"`, `"TEAM"`, `"ADMIN"`, `"AI"`
- Used for L1 AI auto-resolve messages and general user↔team chat
- No WebSockets — frontend polls every 5 seconds via `setInterval`
- `created_at` auto-set by PostgreSQL (`server_default=func.now()`)

### TicketConversation (structured thread)
- Table: `ticket_conversations`
- `is_internal=True` → hidden from USERs; visible to TEAM/ADMIN
- L2 AI suggestion and L3 internal guidance stored here with `is_internal=True`
- User messages in P1/P2 conversations stored here with `is_internal=False`

### Frontend pattern
```jsx
const loadMessages = () =>
  getTicketMessages(ticketId).then(r => { if (r.success) setMessages(r.messages); });

useEffect(() => {
  loadMessages();
  pollRef.current = setInterval(loadMessages, 5000);
  return () => clearInterval(pollRef.current);
}, [ticketId]);
```

### Bubble logic
```jsx
const isMe = m.sender_id === String(currentUser?.user_id);
<div className={isMe ? 'msg-me' : 'msg-them'}>{m.message_body}</div>
```

---

## 13. TicketDetails.jsx — Smart Panel System

`TicketDetails.jsx` renders differently by role:
```js
const isUser  = role === 'USER' || role === '';
const isTeam  = role === 'TEAM';
const isAdmin = role === 'ADMIN';
```

### Components

| Component | Who sees it | Purpose |
|---|---|---|
| `AIAutoResolvePanel` | USER only | L1: shows AI message from chat + Accept / Need Human buttons |
| `TeamApprovedPanel` | USER only | L2 after approval: shows team's message + Accept / Need Further Help |
| `ClosedPanel` | USER only | Shows resolution badge (AI/TeamAI/Human) after ticket closes |
| `TeamAIReviewPanel` | TEAM/ADMIN | L2: shows `original_ai_solution` + Approve/Edit (textarea)/Reject |
| `AISummaryPanel` | TEAM/ADMIN | Internal AI suggestion summary (labeled INTERNAL) |
| `ConversationChat` | All | Unified chat — uses `getConversations` for P1/P2, `getTicketMessages` otherwise |

### `UserSupportPanel` routing (priority order)
```
status === 'AI_RESOLVED_PENDING_USER_CONFIRMATION' → AIAutoResolvePanel
status === 'TEAM_APPROVED_AI_RESPONSE'             → TeamApprovedPanel
status === 'CLOSED' or 'RESOLVED'                 → ClosedPanel
ticket.assigned_team_id is set                    → ConversationChat (live chat with team)
otherwise                                          → "We're working on your request" pending message
```

### `resolutionBadge(ticket)` helper
Returns a `.badge-*` span based on `ticket.resolution_type` and `ticket.status`.

### Sidebar (all roles)
Always shows: Department, Assigned Team, Status, Priority, Dates, Resolution type badge.

---

## 14. User Portal Pages

### UserDashboard (`/user/dashboard`)
- 6 stat cards: Total, Open (blue), In Progress (yellow), Resolved (green), Reopened (orange), AI Resolved (purple)
- Grid: `repeat(6, minmax(0, 1fr))`
- Activity timeline (static placeholder) + Recent Tickets panel (live, shows 4)

### MyTickets (`/user/tickets`)
- Filter bar: search `.inp`, status `.sel`, priority `.sel`
- Dark table `.tbl` — columns: Ticket ID, Subject, Category, Priority, Status, Team, Last Updated
- Row click → navigate to `/user/ticket/:id`
- `timeAgo(dateStr)` helper for "2h ago" format

### CSAT (`/user/csat`)
- 4 analytics stat cards
- Warning banner if pending unrated tickets
- Per-ticket star rating cards (only resolved/closed/AI_resolved tickets)
- `StarRating` component with hover state
- Local state: `forms[ticket_id]` for rating/feedback, `submitted[ticket_id]` for done state

---

## 15. Admin Portal Pages

### AdminDashboard (`/admin/dashboard`)
- **8 KPI cards** (2 rows of 4): Total Tickets, AI Resolution %, SLA Compliance %, Avg Resolution Hours, Tickets Reopened, Duplicate Reduction %, Pending Feedback, Active Incidents
- **SVG VolumeChart**: area + polyline for New (blue) + Resolved (green) over last 30 days
- **SVG DonutChart**: ticket distribution by status (Open/In Progress/Resolved/Escalated/AI Resolved)
- **DeptPerformanceChart**: horizontal bars per department showing SLA compliance %
- **3-card row**: Avg CSAT / Best Dept / Worst Dept
- **Active Incidents table**: top 5 active incidents
- Data from `GET /dashboard/stats` which returns: `department_breakdown`, `daily_volume`, `active_incidents`, `ai_resolution_pct`, `sla_compliance_pct`, `avg_resolution_hours`, etc.

### AdminAllTickets (`/admin/all-tickets`)
- Header with total count + "N need attention" (ESCALATED/REOPENED/SLA-breached)
- Export button (downloads CSV)
- Filter bar: search (Enter to search), Status, Priority, Teams dropdowns + Clear button
- Table columns: checkbox, Ticket ID (purple link), Subject, User, Priority (colored badge), Status (`.b` badge), Team, SLA (elapsed time or red BREACH badge), AI (🤖 score % color-coded), Created date
- Row click → `/admin/ticket/:id`
- Pagination: 15 per page with Prev/Next
- SLA computed client-side: `{ P1: 60min, P2: 240min, P3: 480min, P4: 1440min, P5: 2880min }`

### CSATAnalytics (`/admin/csat`)
- Filter bar: days (7/30/90/365) + team filter
- 4 KPI cards: Avg CSAT Score / Satisfaction Rate / Reopen Rate / Low Satisfaction Count
- Low Satisfaction Alerts panel (critical ≤2.5 avg, high ≤3.0, high reopen rate ≥8%)
- SVG TrendChart: monthly avg CSAT trend (gold polyline)
- DeptCSATBars: horizontal bars showing dept avg/5 score
- Dept Performance table with progress bars + Good/Average/Poor status badges
- Data from `GET /admin/csat-analytics`

### AdminAnalytics (`/admin/analytics`)
- Cascading drill-down: Department → Team → Team Member (each unlocks the next)
- Scope label shows what's currently filtered ("Showing: Infrastructure Dept", etc.)
- Time period filter (30/60/90/180 days)
- 4 KPI cards: Total Tickets / Resolved % / Avg CSAT / Avg Resolution Hours
- Category breakdown + Priority breakdown (HBar horizontal bars)
- Subcategory breakdown + CSAT distribution (vertical bars for 1–5 ratings)
- User-wise stats table: tickets opened, resolved, CSAT avg per user
- Org structure loaded once from `GET /admin/structure`, dropdowns derived locally
- Data from `GET /admin/analytics`

### AdminTeams (`/admin/teams`)
- Two-panel grid layout side by side
- **Left: Escalation Hierarchy** — 4 numbered colored circles with vertical connector line:
  1. Support L1 → Tier 2 (red, After 2h breach on P1/P2, Auto-escalate)
  2. Tier 2 → Domain Expert (orange, After 4h breach, Notify manager)
  3. Domain Expert → Engineering Lead (purple, After 6h, PagerDuty integration)
  4. Incident Declared (blue, Auto-create incident, War room channel)
- **Right: Roles & Permissions** — table with `PermCell` component (green ✓ box / red ✕ box / "View" text):
  - Super Admin: Tickets ✓, Incidents ✓, Admin ✓
  - Team Lead: Tickets ✓, Incidents ✓, Admin ✕
  - Agent: Tickets ✓, Incidents View, Admin ✕
  - Viewer: Tickets View, Incidents View, Admin ✕
  - Member counts pulled live from `GET /admin/users?limit=500`; TEAM role split 15% Team Lead / 85% Agent

---

## 16. Backend Admin Services (`backend/app/admin/services.py`)

### `get_admin_csat_analytics(db, days, team_id, rating)`
- Queries `CSATFeedback` within date window
- Resolves ticket → team → dept chain to build `dept_csat` buckets
- Returns: `avg_csat`, `total_rated`, `satisfaction_rate`, `reopen_rate`, `low_satisfaction_count`, `monthly_trend` (list of `{month, avg}`), `dept_csat` (list of `{dept_name, avg, count}`), `alerts` (list of `{type, severity, message}`), `rating_distribution` (`{1:n, 2:n, ...}`)
- Alert thresholds: critical if dept avg ≤ 2.5, high if ≤ 3.0; high reopen rate ≥ 8%

### `get_admin_analytics(db, dept_id, team_id, member_id, days)`
- Filters tickets by scope: member_id → team_id → dept_id → all
- Returns: `total_tickets`, `resolved_pct`, `category_breakdown`, `subcategory_breakdown`, `priority_breakdown`, `status_breakdown`, `csat` (avg/rate/distribution), `time_to_resolve` (overall + by_priority dict), `user_stats` (list of per-user metrics)

### `get_org_structure(db)`
- Returns full hierarchy: `{ departments: [{ id, name, teams: [{ id, name, members: [{ user_id, full_name, member_role }] }] }] }`

### `get_admin_dashboard_stats` extensions (in `tickets/services.py`)
Extended to return beyond basic counts:
- `department_breakdown`: list of `{ dept_id, dept_name, total, open, in_progress, resolved, sla_compliance }`
- `daily_volume`: last 30 days `{ date: "MM/DD", new: n, resolved: n }` list
- `active_incidents`: count of major_incident_flag=True + IN_PROGRESS/OPEN/ESCALATED
- `incidents_list`: top 5 active incident tickets
- `ai_resolution_pct`, `sla_compliance_pct`, `duplicate_reduction_pct`, `avg_resolution_hours`, `tickets_reopened`, `pending_feedback`, `category_breakdown`

---

## 17. Enrichment Pattern (Backend)

When fetching a ticket, the service attaches display names that don't exist as columns:
```python
# These are set dynamically on the ORM instance:
ticket.category_name      # from categories table
ticket.subcategory_name   # from subcategories table
ticket.assigned_team_name # from teams table
ticket.department_name    # from departments table
ticket.parent_ticket_no   # from ticket_relationships + tickets
```

Batch version `_enrich_list_with_names()` does this efficiently with one query per table for a list of tickets.

---

## 18. Adding New Features — Patterns to Follow

### New backend endpoint
1. Add Pydantic schema to `backend/app/tickets/schemas.py`
2. Add service function to `backend/app/tickets/services.py`
3. Add route to `backend/app/tickets/routes.py` using existing `assert_ticket_visible` for access control

### New admin endpoint
1. Add service function to `backend/app/admin/services.py` (use local imports inside the function body)
2. Add route to `backend/app/admin/routes.py` with `get_current_admin` dependency
3. Add frontend call to `ticketService.js`

### New frontend API call
Add to `NextDeskFrontend/src/services/ticketService.js` using this pattern:
```js
export const myNewCall = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/something`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, data: null };
  }
};
```

### New page styling
Always use dark CSS classes from `portal.css`. Never use Tailwind in portal pages.
- Cards: `<div className="card">`
- Buttons: `<button className="btn-p">` or `<button className="btn-s">`
- Tables: `<table className="tbl">`
- Inputs: `<input className="inp">` / `<select className="sel">`
- Priority badges: `<span className="b p2">● P2</span>`
- Status badges: `<span className="b s-prog">In Progress</span>`

### SVG charts (no chart library)
Build from scratch using `viewBox`, `polyline points`, `path d` with stroke-dasharray, and CSS flex for bar charts. Pattern used in AdminDashboard, CSATAnalytics.

### New DB column
Add it to the model in `models.py`. The `ensure_table_columns()` in `init_db.py` will auto-add it on next server start. No manual SQL needed.

---

## 19. Running the Project

**Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend:**
```bash
cd NextDeskFrontend
npm run dev
# Runs at http://localhost:5173
```

**CORS:** Already configured in `main.py` for `localhost:5173`, `localhost:3000`, `127.0.0.1:5173`, `127.0.0.1:3000`.

---

## 20. Completed Work (do not redo)

All of the following are already implemented and working:

| Feature | Files changed |
|---|---|
| `TicketMessage.created_at` column | `models/models.py` |
| KB article `resolution` text in confidence API response | `services/kb_similarity_service.py`, `tickets/schemas.py` |
| `GET /tickets/{id}/messages` + `POST /tickets/{id}/messages` endpoints | `tickets/routes.py`, `tickets/services.py` |
| `getResolutionConfidence`, `getTicketMessages`, `sendTicketMessage` | `services/ticketService.js` |
| All dark badge/timeline/chat CSS classes | `styles/portal.css` |
| UserDashboard — 6 stat row | `pages/user/UserDashboard.jsx` |
| MyTickets — dark table with filters | `pages/user/MyTickets.jsx` |
| CSAT — dark star-rating cards | `pages/user/CSAT.jsx` |
| TicketWorkspace — TeamChatPanel for team side | `pages/team/TicketWorkspace.jsx` |
| Department classification in classification pipeline | `services/classification_service.py` |
| New Ticket columns: `original_ai_solution`, `edited_team_solution`, `ai_solution_approved_by/at` | `models/models.py` |
| `TicketConversation` model (`ticket_conversations` table) | `models/models.py`, `models/__init__.py` |
| `ai_resolution_service.py` — 3-level workflow (L1/L2/L3) | `services/ai_resolution_service.py` |
| KB similarity service refactor — new thresholds, 3-level `_decide()` | `services/kb_similarity_service.py` |
| `POST /tickets/{id}/team-ai-action` endpoint | `tickets/routes.py`, `tickets/services.py` |
| `GET /tickets/{id}/ai-resolution` endpoint | `tickets/routes.py` |
| `GET/POST /tickets/{id}/conversations` endpoints | `tickets/routes.py`, `tickets/services.py` |
| `team_ai_action()`, `get_ticket_conversations()`, `create_conversation_message()` services | `tickets/services.py` |
| Admin dashboard AI resolution metrics | `tickets/services.py` |
| `getAIResolutionData`, `submitTeamAIAction`, `getConversations`, `sendConversationMessage` | `services/ticketService.js` |
| Resolution type badges (`.badge-ai-solved`, `.badge-team-approved`, etc.) + `.ai-review-panel` | `styles/portal.css` |
| TicketDetails.jsx full rewrite — all 3 levels, `AIAutoResolvePanel`, `TeamApprovedPanel`, `TeamAIReviewPanel`, `ConversationChat`, `AISummaryPanel` | `pages/user/TicketDetails.jsx` |
| P1 emergency fast-path — detection, skip duplicate + KB pipeline, run classification for team assignment, pin priority to P1 | `tickets/services.py` |
| AdminDashboard full rewrite — SVG charts, KPI cards, dept breakdown, daily volume, active incidents | `pages/admin/AdminDashboard.jsx`, `tickets/services.py` |
| Admin sidebar: "All Tickets" added to Management, "Teams" removed from Management | `layouts/AdminLayout.jsx` |
| CSATAnalytics page rewrite — KPI cards, alerts panel, trend chart, dept CSAT bars, performance table | `pages/admin/CSATAnalytics.jsx` |
| AdminAnalytics page rewrite — dept→team→member drill-down, all metrics | `pages/admin/AdminAnalytics.jsx` |
| AdminTeams page rewrite — Escalation Hierarchy + Roles & Permissions panels | `pages/admin/AdminTeams.jsx` |
| Admin backend services: `get_admin_csat_analytics`, `get_admin_analytics`, `get_org_structure` | `admin/services.py` |
| Admin routes: `GET /admin/csat-analytics`, `GET /admin/analytics`, `GET /admin/structure` | `admin/routes.py` |
| Frontend admin service calls: `fetchAdminCSATAnalytics`, `fetchAdminAnalytics`, `fetchOrgStructure` | `services/ticketService.js` |
| `get_admin_dashboard_stats` extended: dept_breakdown, daily_volume, active_incidents, sla metrics | `tickets/services.py` |
| AdminAllTickets page — paginated table with filters, SLA display, AI score, CSV export | `pages/admin/AdminAllTickets.jsx`, `routes/AppRoutes.jsx`, `layouts/AdminLayout.jsx` |
