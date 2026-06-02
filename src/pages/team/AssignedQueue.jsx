import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchTickets, getMe, getTeamMembersWorkload, assignTicketToMember,
} from '../../services/ticketService';

const PRIORITY_LABEL = { P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Medium', P4: 'P4 Low', P5: 'P5 Minimal' };
const PRIORITY_CLASS = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' };
const PAGE_SIZE = 10;

function statusBadge(s) {
  const u = (s || '').toUpperCase();
  const cls = {
    OPEN: 's-open', IN_PROGRESS: 's-prog', RESOLVED: 's-res', CLOSED: 's-res',
    ESCALATED: 's-esc', AI_RESOLVED: 's-ai',
    AI_RESOLVED_PENDING_USER_CONFIRMATION: 's-ai', AI_TEAM_REVIEW: 's-ai',
    TEAM_APPROVED_AI_RESPONSE: 's-ai', REOPENED: 's-reo', ASSIGNED: 's-open',
  };
  const lbl = {
    OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed',
    ESCALATED: 'Escalated', AI_RESOLVED: 'AI Resolved',
    AI_RESOLVED_PENDING_USER_CONFIRMATION: 'AI Pending', AI_TEAM_REVIEW: 'AI Review',
    TEAM_APPROVED_AI_RESPONSE: 'Team Approved', REOPENED: 'Reopened', ASSIGNED: 'Assigned',
  };
  return <span className={`b ${cls[u] || 's-open'}`}>{lbl[u] || s}</span>;
}

function fmtSLA(ticket) {
  if (ticket.sla_breached) return <span style={{ color: '#f87171', fontWeight: 700, fontSize: '11px' }}>⚠ BREACHED</span>;
  if (ticket.sla_at_risk)  return <span style={{ color: '#fb923c', fontWeight: 700, fontSize: '11px' }}>⚑ AT RISK</span>;
  if (ticket.sla_minutes_remaining != null) {
    const h = Math.floor(ticket.sla_minutes_remaining / 60);
    const m = ticket.sla_minutes_remaining % 60;
    return <span style={{ color: '#34d399', fontSize: '12px' }}>⏱ {h > 0 ? `${h}h ${m}m` : `${m}m`} left</span>;
  }
  return <span style={{ color: '#1e3047', fontSize: '11px' }}>—</span>;
}

function quickActionBtn(ticket, isManager, onAssign, onNavigate) {
  const s = (ticket.status || '').toUpperCase();
  if (['RESOLVED', 'CLOSED', 'AI_RESOLVED'].includes(s)) {
    return (
      <button className="btn-s" onClick={() => onNavigate(ticket.ticket_id)}
        style={{ height: '24px', padding: '0 10px', fontSize: '11px' }}>
        View
      </button>
    );
  }
  if (s === 'ESCALATED') return (
    <button className="btn-s" style={{ height: '24px', padding: '0 10px', fontSize: '11px', color: '#f87171', borderColor: '#f87171' }}>
      Esc
    </button>
  );
  if (s === 'AI_TEAM_REVIEW' || s === 'AI_RESOLVED_PENDING_USER_CONFIRMATION') return (
    <button className="btn-s" onClick={() => onNavigate(ticket.ticket_id)}
      style={{ height: '24px', padding: '0 10px', fontSize: '11px', color: '#a855f7', borderColor: '#a855f7' }}>
      AI Res
    </button>
  );
  if (!ticket.assigned_agent_id && isManager) return (
    <button className="btn-p" onClick={() => onAssign(ticket)}
      style={{ height: '24px', padding: '0 10px', fontSize: '11px' }}>
      Assign
    </button>
  );
  return (
    <button className="btn-p" onClick={() => onNavigate(ticket.ticket_id)}
      style={{ height: '24px', padding: '0 10px', fontSize: '11px', background: '#059669', borderColor: '#059669' }}>
      Resolve
    </button>
  );
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({ ticket, members, onClose, onAssigned }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  const handleAssign = async () => {
    if (!selected) { setErr('Select a team member'); return; }
    setBusy(true); setErr('');
    const r = await assignTicketToMember(ticket.ticket_id, selected);
    setBusy(false);
    if (r.success) { onAssigned(); onClose(); }
    else setErr(r.message || 'Assignment failed');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card ff" style={{ width: '400px', padding: '26px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>Assign Ticket</div>
        <div style={{ fontSize: '12px', color: '#3d5378', marginBottom: '20px' }}>{ticket.ticket_no} — {ticket.subject}</div>
        <label style={{ fontSize: '11px', color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: '6px' }}>Assign to</label>
        <select className="sel" value={selected} onChange={e => setSelected(e.target.value)} style={{ width: '100%', marginBottom: '16px' }}>
          <option value="">Select team member…</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name} ({m.member_role})</option>)}
        </select>
        {err && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-s" onClick={onClose} style={{ height: '32px', padding: '0 16px', fontSize: '12px' }}>Cancel</button>
          <button className="btn-p" onClick={handleAssign} disabled={busy} style={{ height: '32px', padding: '0 16px', fontSize: '12px' }}>
            {busy ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
function AssignedQueue() {
  const navigate = useNavigate();

  const [tickets,       setTickets]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [workload,      setWorkload]      = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [deptId,        setDeptId]        = useState('');

  // Filters
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [memberFilter,   setMemberFilter]   = useState(''); // defaults to current user
  const [slaFilter,      setSlaFilter]      = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Bulk select
  const [selected, setSelected] = useState(new Set());

  // Assign modal
  const [assignModal, setAssignModal] = useState(null);

  const isManager  = (workload?.current_user_member_role || '').toUpperCase() === 'MANAGER';
  const deptMembers = workload?.department_members || [];
  const memberNameMap = {};
  deptMembers.forEach(m => { memberNameMap[m.user_id] = m.full_name; });

  const sortedDeptMembers = [...deptMembers].sort((a, b) => {
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  // Load workload + current user on mount
  useEffect(() => {
    getTeamMembersWorkload().then(r => { if (r.success) setWorkload(r.data); });
    getMe().then(r => {
      if (r.user?.id) {
        setCurrentUserId(r.user.id);
        setMemberFilter(r.user.id);
      }
      if (r.user?.department_id) setDeptId(r.user.department_id);
    });
  }, []);

  const loadTickets = () => {
    setLoading(true); setError('');
    const params = {};
    if (workload?.team_id) params.assigned_team_id = workload.team_id;
    else if (deptId)       params.department_id    = deptId;
    fetchTickets(params).then(r => {
      if (r.success) setTickets(r.tickets || []);
      else setError(r.message || 'Failed to load tickets');
      setLoading(false);
    });
  };

  useEffect(() => {
    if (deptId || workload?.team_id) loadTickets();
  }, [deptId, workload?.team_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side filtering
  const filtered = useMemo(() => {
    let out = tickets;
    if (memberFilter) out = out.filter(t => String(t.assigned_agent_id) === String(memberFilter));
    if (statusFilter)  out = out.filter(t => t.status === statusFilter);
    if (priorityFilter) out = out.filter(t => t.priority === priorityFilter);
    if (slaFilter === 'breached') out = out.filter(t => t.sla_breached);
    if (slaFilter === 'at_risk')  out = out.filter(t => t.sla_at_risk);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(t =>
        t.ticket_no?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        (t.creator_name || '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [tickets, memberFilter, statusFilter, priorityFilter, slaFilter, search]);

  useEffect(() => { setPage(1); }, [filtered.length]);

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageTickets = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // SLA counts (across all tickets, not just filtered)
  const slaBreachedCount = tickets.filter(t => t.sla_breached).length;
  const slaAtRiskCount   = tickets.filter(t => t.sla_at_risk).length;
  const teamName         = workload?.team_name || '';
  const activeCount      = tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length;

  // Bulk select
  const allPageSelected = pageTickets.length > 0 && pageTickets.every(t => selected.has(t.ticket_id));
  const someSelected    = selected.size > 0;

  const toggleAll = () => {
    const next = new Set(selected);
    if (allPageSelected) pageTickets.forEach(t => next.delete(t.ticket_id));
    else pageTickets.forEach(t => next.add(t.ticket_id));
    setSelected(next);
  };
  const toggleOne = id => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <div className="page ff">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '20px', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
            Assigned Ticket Queue
          </h1>
          <p style={{ fontSize: '12px', color: '#3d5378', marginTop: '4px', margin: '4px 0 0' }}>
            {teamName && <span style={{ color: '#34d399', fontWeight: 600 }}>{teamName}</span>}
            {teamName && ' · '}
            {activeCount} active ticket{activeCount !== 1 ? 's' : ''}
            {slaAtRiskCount > 0 && (
              <span style={{ color: '#fb923c', marginLeft: '10px', fontWeight: 600 }}>
                · {slaAtRiskCount} SLA alert{slaAtRiskCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {slaBreachedCount > 0 && (
            <span style={{
              background: 'rgba(248,113,113,.15)', border: '1px solid rgba(248,113,113,.35)',
              color: '#f87171', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              padding: '5px 12px', whiteSpace: 'nowrap',
            }}>
              ⚠ {slaBreachedCount} SLA Breach{slaBreachedCount !== 1 ? 'es' : ''}
            </span>
          )}
          {someSelected && (
            <button className="btn-s" style={{ height: '34px', padding: '0 14px', fontSize: '12px' }}>
              Bulk Actions ({selected.size})
            </button>
          )}
          <button
            className="btn-p"
            onClick={() => navigate('/team/workspace')}
            style={{ height: '34px', padding: '0 16px', fontSize: '12px' }}
          >
            Open Workspace
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <input
          className="inp"
          placeholder="Search tickets, users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1', minWidth: '200px', height: '34px', fontSize: '12.5px' }}
        />

        <select className="sel" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '34px', fontSize: '12.5px', minWidth: '120px' }}>
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="ESCALATED">Escalated</option>
          <option value="AI_TEAM_REVIEW">AI Review</option>
          <option value="AI_RESOLVED_PENDING_USER_CONFIRMATION">AI Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>

        <select className="sel" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ height: '34px', fontSize: '12.5px', minWidth: '120px' }}>
          <option value="">All Priority</option>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 High</option>
          <option value="P3">P3 Medium</option>
          <option value="P4">P4 Low</option>
          <option value="P5">P5 Minimal</option>
        </select>

        <select className="sel" value={memberFilter} onChange={e => setMemberFilter(e.target.value)} style={{ height: '34px', fontSize: '12.5px', minWidth: '150px' }}>
          <option value="">All Assignees</option>
          {sortedDeptMembers.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.user_id === currentUserId ? 'My Tickets' : m.full_name}
            </option>
          ))}
        </select>

        <select className="sel" value={slaFilter} onChange={e => setSlaFilter(e.target.value)} style={{ height: '34px', fontSize: '12.5px', minWidth: '120px' }}>
          <option value="">SLA: All</option>
          <option value="breached">Breached</option>
          <option value="at_risk">At Risk</option>
        </select>

        {(statusFilter || priorityFilter || slaFilter || search) && (
          <button
            className="btn-s"
            onClick={() => { setStatusFilter(''); setPriorityFilter(''); setSlaFilter(''); setSearch(''); }}
            style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
          >
            Clear
          </button>
        )}

        <span style={{ fontSize: '11.5px', color: '#3d5378', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : `Showing ${pageTickets.length} of ${filtered.length} ticket${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {error ? (
          <div style={{ padding: '24px', fontSize: '13px', color: '#f87171' }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: '24px', fontSize: '13px', color: '#3d5378' }}>Loading queue…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#3d5378' }}>
            No tickets found for the selected filters.
          </div>
        ) : (
          <table className="tbl" style={{ margin: 0, minWidth: '1100px' }}>
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                    style={{ accentColor: '#34d399', cursor: 'pointer' }} />
                </th>
                <th>Ticket</th>
                <th>User / Subject</th>
                <th>Priority</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Duplicate</th>
                <th>Incident</th>
                <th style={{ textAlign: 'right' }}>AI Conf%</th>
                <th>Assignee</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageTickets.map(ticket => {
                const agentName  = memberNameMap[ticket.assigned_agent_id] || null;
                const agentInit  = agentName ? agentName[0].toUpperCase() : null;
                const dupCount   = ticket.duplicate_count || 0;
                const aiConf     = ticket.final_resolution_confidence;
                const isSelected = selected.has(ticket.ticket_id);

                return (
                  <tr
                    key={ticket.ticket_id}
                    style={{ background: isSelected ? 'rgba(79,142,247,.06)' : undefined }}
                  >
                    {/* Checkbox */}
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(ticket.ticket_id)}
                        style={{ accentColor: '#34d399', cursor: 'pointer' }} />
                    </td>

                    {/* Ticket no */}
                    <td className="bright" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      <button
                        onClick={() => navigate(`/team/ticket/${ticket.ticket_id}`)}
                        style={{ background: 'none', border: 'none', color: '#4f8ef7', fontWeight: 700, fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                      >
                        {ticket.ticket_no}
                      </button>
                    </td>

                    {/* User / Subject */}
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: '#c9d8ee', fontWeight: 500 }}>
                        {ticket.subject}
                      </div>
                      {ticket.creator_name && (
                        <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ticket.creator_name}
                        </div>
                      )}
                    </td>

                    {/* Priority */}
                    <td>
                      <span className={`b ${PRIORITY_CLASS[ticket.priority] || 'p3'}`}>
                        ● {PRIORITY_LABEL[ticket.priority] || ticket.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td>{statusBadge(ticket.status)}</td>

                    {/* SLA */}
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtSLA(ticket)}</td>

                    {/* Duplicate */}
                    <td>
                      {dupCount > 0 ? (
                        <span style={{
                          background: 'rgba(251,146,60,.12)', border: '1px solid rgba(251,146,60,.3)',
                          color: '#fb923c', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700,
                          padding: '2px 8px', whiteSpace: 'nowrap',
                        }}>
                          {dupCount} dup{dupCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ color: '#1e3047', fontSize: '12px' }}>—</span>
                      )}
                    </td>

                    {/* Incident */}
                    <td>
                      {ticket.incident_id ? (
                        <span style={{
                          background: 'rgba(168,85,247,.12)', border: '1px solid rgba(168,85,247,.3)',
                          color: '#a855f7', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700,
                          padding: '2px 8px', whiteSpace: 'nowrap',
                        }}>
                          INC
                        </span>
                      ) : (
                        <span style={{ color: '#1e3047', fontSize: '12px' }}>—</span>
                      )}
                    </td>

                    {/* AI Conf% */}
                    <td style={{ textAlign: 'right' }}>
                      {aiConf != null ? (
                        <span style={{
                          fontSize: '12px', fontWeight: 700,
                          color: aiConf >= 75 ? '#34d399' : aiConf >= 50 ? '#facc15' : '#f87171',
                        }}>
                          {Math.round(aiConf)}%
                        </span>
                      ) : (
                        <span style={{ color: '#1e3047', fontSize: '12px' }}>—</span>
                      )}
                    </td>

                    {/* Assignee */}
                    <td>
                      {agentName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg,#34d399,#059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: 800, color: '#fff',
                          }}>
                            {agentInit}
                          </div>
                          <span style={{ fontSize: '12px', color: '#c9d8ee', whiteSpace: 'nowrap' }}>{agentName}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#1e3047', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="btn-s"
                          onClick={() => navigate(`/team/ticket/${ticket.ticket_id}`)}
                          style={{ height: '24px', padding: '0 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        >
                          Open
                        </button>
                        {quickActionBtn(ticket, isManager, setAssignModal, id => navigate(`/team/ticket/${id}`))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
          <span style={{ fontSize: '12px', color: '#3d5378' }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} tickets
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn-s"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ height: '30px', padding: '0 12px', fontSize: '12px', opacity: page === 1 ? .4 : 1 }}
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                style={{
                  height: '30px', minWidth: '30px', padding: '0 8px', fontSize: '12px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: n === page ? 'var(--accent)' : 'transparent',
                  color: n === page ? '#fff' : '#3d5378',
                  fontWeight: n === page ? 700 : 400,
                }}
              >
                {n}
              </button>
            ))}
            <button
              className="btn-s"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ height: '30px', padding: '0 12px', fontSize: '12px', opacity: page === totalPages ? .4 : 1 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && isManager && (
        <AssignModal
          ticket={assignModal}
          members={sortedDeptMembers}
          onClose={() => setAssignModal(null)}
          onAssigned={() => { loadTickets(); setAssignModal(null); }}
        />
      )}
    </div>
  );
}

export default AssignedQueue;
