# NextDesk — Project Reference for Claude

Read this file at the start of every session. It contains the full architecture, file map, CSS system, API contract, and all work already completed. Do not re-read source files to answer questions already covered here — use this as the single source of truth and only open a file when you need to make a change to it.

---

## 1. What This Project Is

NextDesk is an AI-powered IT helpdesk/ticketing system.

- Users submit support tickets via a portal
- AI classifies tickets (category, priority, urgency, impact) and checks for duplicates
- AI embeds tickets and searches a Knowledge Base via pgvector cosine similarity
- Based on a confidence score, tickets are either auto-resolved (KB solution shown to user), suggested to team, or routed to a team
- Teams manage tickets in a workspace and chat with users in real time
- Admins manage users, teams, departments, organizations, SLA rules, and view analytics

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

---

## 3. Directory Structure

```
nextdesk/
├── backend/
│   └── app/
│       ├── main.py                        # FastAPI app, router registration, CORS, startup
│       ├── models/
│       │   ├── __init__.py                # Re-exports all models
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
│       │   └── routes.py                  # Admin-only endpoints (users, teams, KB embeddings)
│       └── services/
│           ├── embedding_service.py       # EmbeddingService: generate_embedding(), build_embedding_text()
│           ├── kb_similarity_service.py   # run_resolution_confidence() — full KB pipeline
│           ├── kb_embedding_service.py    # Generate and store KB embeddings
│           ├── classification_service.py  # run_classification_pipeline()
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
        │   └── ticketService.js           # All ticket/chat/KB API calls
        ├── styles/
        │   └── portal.css                 # ENTIRE dark theme CSS (see Section 5)
        ├── layouts/
        │   ├── UserLayout.jsx             # Wraps /user/* — applies .user-theme class
        │   ├── TeamLayout.jsx             # Wraps /team/* — applies .team-theme class
        │   ├── AdminLayout.jsx            # Wraps /admin/*
        │   └── AuthLayout.jsx             # Wraps /login
        └── pages/
            ├── auth/    Login.jsx, ForgotPassword.jsx
            ├── user/    UserDashboard.jsx, MyTickets.jsx, TicketDetails.jsx, CSAT.jsx,
            │            NewTicket.jsx, Profile.jsx
            ├── team/    TeamDashboard.jsx, AssignedQueue.jsx, TicketWorkspace.jsx,
            │            Incidents.jsx, KnowledgeBase.jsx
            └── admin/   AdminDashboard.jsx, AdminUserList.jsx, AdminUserForm.jsx,
                         AdminTeams.jsx, AdminAnalytics.jsx, WorkflowControls.jsx,
                         CSATAnalytics.jsx, IncidentDashboard.jsx, AdminOrganizations.jsx,
                         AdminDepartmentsPage.jsx, AdminTeamsPage.jsx, AdminTeamMembers.jsx
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
| `Ticket` | `tickets` | id, ticket_no, assigned_team_id, created_by, status, priority, urgency, impact, scope, source, major_incident_flag, ai_resolved, process_tag, assigned_by |
| `TicketMessage` | `ticket_messages` | id, ticket_id, sender_id, sender_type, message_type (CHAT/EMAIL), message_body, created_at |
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
| POST | `/tickets` | Any auth | Create ticket (runs duplicate engine) |
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
| GET | `/tickets/{id}/resolution-confidence` | Scoped | Run KB similarity pipeline → decision + scores |
| GET | `/tickets/{id}/resolution` | Scoped | Get resolution record |
| GET | `/tickets/{id}/messages` | Scoped | Get CHAT messages for ticket |
| POST | `/tickets/{id}/messages` | Scoped | Send CHAT message `{ message_body }` |

### Knowledge Base
| Method | Path | Description |
|---|---|---|
| GET | `/knowledge-base` | List published KB articles (filter: category, team, priority, search) |
| GET | `/knowledge-base/meta` | Categories + teams with article counts |
| GET | `/knowledge-base/{id}` | Single KB article |

### Dashboard / Stats
| Method | Path | Access |
|---|---|---|
| GET | `/dashboard/stats` | ADMIN — ticket counts by status/priority/team |
| GET | `/department/stats` | TEAM/ADMIN — dept-scoped stats |
| GET | `/notifications` | Current user's notifications |
| POST | `/notifications/read` | Mark all notifications as read |
| GET | `/departments` | List active departments |
| GET | `/departments/{id}/teams` | List teams in a department |

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
/admin/users                    → AdminUserList.jsx
/admin/users/create             → AdminUserForm.jsx
/admin/users/:userId            → AdminUserForm.jsx (edit)
/admin/teams                    → AdminTeams.jsx
/admin/csat                     → CSATAnalytics.jsx
/admin/analytics                → AdminAnalytics.jsx
/admin/workflows                → WorkflowControls.jsx
/admin/incidents                → IncidentDashboard.jsx
/admin/organizations            → AdminOrganizations.jsx
/admin/departments              → AdminDepartmentsPage.jsx
/admin/teams-manage             → AdminTeamsPage.jsx
/admin/team-members             → AdminTeamMembers.jsx
/admin/ticket/:id               → TicketDetails.jsx  (role=ADMIN view)
```

Route protection: `RoleProtectedRoute` in `AppRoutes.jsx` redirects unauthorized roles.

---

## 8. Key Frontend Services (`ticketService.js`)

All functions return `{ success: true/false, ...data }` — never throw.

```js
fetchTickets(params)                        // GET /tickets
getTicket(ticketId)                         // GET /tickets/{id}
createTicket({ subject, description, ... }) // POST /tickets
getTicketTimeline(ticketId)                 // GET /tickets/{id}/timeline
getAISuggestion(ticketId)                   // GET /tickets/{id}/ai-suggestion
getResolutionConfidence(ticketId)           // GET /tickets/{id}/resolution-confidence
getTicketMessages(ticketId)                 // GET /tickets/{id}/messages
sendTicketMessage(ticketId, messageBody)    // POST /tickets/{id}/messages
fetchKBArticles({ category, search, ... }) // GET /knowledge-base
fetchDepartmentDashboardStats()             // GET /department/stats
fetchDashboardStats()                       // GET /dashboard/stats
getMe()                                     // GET /me
```

---

## 9. Resolution Confidence Pipeline (`kb_similarity_service.py`)

Called via `GET /tickets/{id}/resolution-confidence`.

**Steps:**
1. Embed ticket (subject + description[:1000]) using `EmbeddingService`
2. pgvector cosine search: `SELECT k.id, k.title, k.resolution, k.tags, 1 - (ke.embedding <=> :qv) AS sim FROM kb_embeddings ke JOIN knowledge_base k ...` top 5 results
3. Compute 4 component scores (all 0–100):
   - `similarity_score` = top match similarity × 100
   - `coverage_score` = count of matches above 0.90/0.80/0.70 thresholds
   - `classification_confidence` = from `TicketAISuggestion.confidence × 100` (default 50)
   - `resolution_quality_score` = weighted quality of top 3 articles (has resolution, length, tags)
4. `final = 0.40×sim + 0.30×cov + 0.20×cls + 0.10×qual`
5. Decision:
   - `≥ 90` → `AI_AUTO_RESOLVE`
   - `≥ 80` → `AI_SUGGEST_AND_CONFIRM`
   - `≥ 70` → `AI_SUGGEST_TO_TEAM`
   - `< 70` → `ROUTE_TO_TEAM`
6. Persist to `ticket_resolution_scores` and `ticket_similarity_results`
7. Return: `{ ticket_id, decision, final_resolution_confidence, top_matches[{article_id, title, similarity_score, resolution}], component_scores }`

The `resolution` field in `top_matches` is the actual KB article resolution text — used directly in the user-facing KB solution panel.

---

## 10. Chat System

### How it works
- Uses `TicketMessage` table with `message_type = "CHAT"` (separate from email-type messages)
- `sender_type` stores `"USER"`, `"TEAM"`, or `"ADMIN"` — used for bubble styling
- No WebSockets — frontend polls every 5 seconds via `setInterval`
- `created_at` on `TicketMessage` is auto-set by PostgreSQL (`server_default=func.now()`)

### Frontend pattern (both user and team side)
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

## 11. User Portal — TicketDetails Smart Panel

`TicketDetails.jsx` renders differently by role using:
```js
const isUser  = role === 'USER' || role === '';
const isTeam  = role === 'TEAM';
const isAdmin = role === 'ADMIN';
```

**Left column by role:**

| Role | Left column shows |
|---|---|
| USER | `UserSupportPanel` (smart — see below) + Description + Classification |
| TEAM | `AISummaryPanel` + Description + Classification + `TeamChat` |
| ADMIN | `AISummaryPanel` + Description + Classification + `TeamChat` |

**`UserSupportPanel` decision logic (priority order):**
```
1. ticket.assigned_team_id is set?  →  show TeamChat (live chat with team)
2. confidence.decision === 'AI_AUTO_RESOLVE'?  →  show KBSolutionPanel (KB article + resolution steps)
3. Otherwise  →  show pending message "We're working on your request"
```

This means: **users never see AI suggestions**. They either get chat (if team assigned) or a KB solution (if AI can auto-resolve) or a waiting message.

**Right sidebar (all roles):** Ticket metadata (status, priority, team, dates), Timeline, Action buttons (USER only).

---

## 12. User Portal Pages

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

### TicketDetails — see Section 11 above

---

## 13. Enrichment Pattern (Backend)

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

## 14. Adding New Features — Patterns to Follow

### New backend endpoint
1. Add Pydantic schema to `backend/app/tickets/schemas.py`
2. Add service function to `backend/app/tickets/services.py`
3. Add route to `backend/app/tickets/routes.py` using existing `assert_ticket_visible` for access control

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

### New DB column
Add it to the model in `models.py`. The `ensure_table_columns()` in `init_db.py` will auto-add it on next server start. No manual SQL needed.

---

## 15. Running the Project

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

## 16. Completed Work (do not redo)

All of the following are already implemented and working:

| Feature | Files changed |
|---|---|
| `TicketMessage.created_at` column | `models/models.py` |
| KB article `resolution` text in confidence API response | `services/kb_similarity_service.py`, `tickets/schemas.py` |
| `GET /tickets/{id}/messages` endpoint | `tickets/routes.py`, `tickets/services.py` |
| `POST /tickets/{id}/messages` endpoint | `tickets/routes.py`, `tickets/services.py` |
| `getResolutionConfidence`, `getTicketMessages`, `sendTicketMessage` | `services/ticketService.js` |
| All dark badge/timeline/chat CSS classes | `styles/portal.css` |
| UserDashboard — 6 stat row | `pages/user/UserDashboard.jsx` |
| MyTickets — dark table with filters | `pages/user/MyTickets.jsx` |
| CSAT — dark star-rating cards | `pages/user/CSAT.jsx` |
| TicketDetails — 2-column layout, smart UserSupportPanel, TeamChat, KBSolutionPanel, AISummaryPanel | `pages/user/TicketDetails.jsx` |
| TicketWorkspace — TeamChatPanel for team side | `pages/team/TicketWorkspace.jsx` |
