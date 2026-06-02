import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets } from '../../services/ticketService';

const PER_PAGE = 8;

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

function statusClass(s) {
  const u = (s || '').toUpperCase();
  if (u === 'OPEN') return 's-open';
  if (u === 'IN_PROGRESS') return 's-prog';
  if (u === 'RESOLVED' || u === 'CLOSED') return 's-res';
  if (u === 'ESCALATED') return 's-esc';
  if (u === 'AI_RESOLVED' || u === 'AI_RESOLVED_PENDING_USER_CONFIRMATION') return 's-ai';
  if (u.includes('REOPEN')) return 's-reo';
  if (u.includes('PENDING') || u.includes('ON_HOLD') || u === 'AI_TEAM_REVIEW' || u === 'TEAM_APPROVED_AI_RESPONSE') return 's-pend';
  return 's-open';
}

function statusLabel(s) {
  const map = {
    IN_PROGRESS: 'In Progress',
    AI_RESOLVED: 'AI Resolved',
    AI_RESOLVED_PENDING_USER_CONFIRMATION: 'AI Resolved',
    AI_TEAM_REVIEW: 'AI Review',
    TEAM_APPROVED_AI_RESPONSE: 'Pending Confirm',
    OPEN: 'Open',
    RESOLVED: 'Resolved',
    ESCALATED: 'Escalated',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
    ON_HOLD: 'On Hold',
    PENDING_ADMIN_REVIEW: 'Pending Review',
  };
  return map[(s || '').toUpperCase()] || s;
}

const PRIORITY_META = {
  P1: { cls: 'p1', label: 'P1 Critical' },
  P2: { cls: 'p2', label: 'P2 High' },
  P3: { cls: 'p3', label: 'P3 Medium' },
  P4: { cls: 'p4', label: 'P4 Low' },
  P5: { cls: 'p5', label: 'P5 Info' },
};

function MyTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    fetchTickets().then((r) => {
      if (!mounted) return;
      if (r.success) setTickets(r.tickets || []);
      else setError(r.message || 'Unable to load tickets');
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // reset page on filter change
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPriority, filterDate]);

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || (t.subject || '').toLowerCase().includes(q)
      || (t.ticket_no || '').toLowerCase().includes(q)
      || (t.category_name || '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || (t.status || '').toUpperCase() === filterStatus;
    const matchPriority = !filterPriority || (t.priority || '').toUpperCase() === filterPriority;
    const matchDate = !filterDate || (t.created_at || '').slice(0, 10) === filterDate;
    return matchSearch && matchStatus && matchPriority && matchDate;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const pageNums = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  };

  return (
    <div className="page ff">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>My Tickets</h1>
          <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '4px' }}>All support requests submitted by you</p>
        </div>
        <button className="btn-p" onClick={() => navigate('/user/new')} style={{ height: '36px', fontSize: '13px' }}>
          + New Ticket
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <svg style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="inp"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', height: '36px', fontSize: '12.5px', paddingLeft: '32px', boxSizing: 'border-box' }}
          />
        </div>
        <select
          className="sel"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ height: '36px', minWidth: '130px', fontSize: '12.5px' }}
        >
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="AI_RESOLVED_PENDING_USER_CONFIRMATION">AI Resolved</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
          <option value="ESCALATED">Escalated</option>
        </select>
        <select
          className="sel"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          style={{ height: '36px', minWidth: '130px', fontSize: '12.5px' }}
        >
          <option value="">All Priority</option>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 High</option>
          <option value="P3">P3 Medium</option>
          <option value="P4">P4 Low</option>
          <option value="P5">P5 Info</option>
        </select>
        <input
          type="date"
          className="inp"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{ height: '36px', minWidth: '140px', fontSize: '12px', colorScheme: 'dark' }}
        />
      </div>

      {/* Table area */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '52px', textAlign: 'center', color: '#3d5378', fontSize: '13px' }}>Loading tickets…</div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#f87171', fontSize: '13px' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '52px', textAlign: 'center', color: '#3d5378', fontSize: '13px' }}>
            {tickets.length === 0 ? 'No tickets yet. Create your first ticket to get started.' : 'No tickets match your filters.'}
          </div>
        ) : (
          <>
            <table className="tbl" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '110px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '36px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>TICKET ID</th>
                  <th>SUBJECT</th>
                  <th>CATEGORY</th>
                  <th>PRIORITY</th>
                  <th>STATUS</th>
                  <th>ASSIGNED TEAM</th>
                  <th>LAST UPDATED</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((ticket) => {
                  const prio = (ticket.priority || 'P5').toUpperCase();
                  const pm = PRIORITY_META[prio] || PRIORITY_META.P5;
                  return (
                    <tr
                      key={ticket.ticket_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/user/ticket/${ticket.ticket_id}`)}
                    >
                      {/* Ticket ID */}
                      <td>
                        <span style={{ color: '#4f8ef7', fontWeight: 600, fontSize: '13px', fontFamily: "'Outfit', sans-serif" }}>
                          {ticket.ticket_no || '—'}
                        </span>
                      </td>

                      {/* Subject */}
                      <td>
                        <span style={{
                          fontSize: '13px',
                          color: '#c9d8ee',
                          fontWeight: 500,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {ticket.subject || '—'}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                        {ticket.category_name || '—'}
                      </td>

                      {/* Priority */}
                      <td>
                        <span className={`b ${pm.cls}`}>● {pm.label}</span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`b ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
                      </td>

                      {/* Team */}
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                        {ticket.assigned_team_name || <span style={{ color: '#2a3f5a' }}>Unassigned</span>}
                      </td>

                      {/* Last updated */}
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {timeAgo(ticket.updated_at || ticket.created_at)}
                      </td>

                      {/* Chevron */}
                      <td style={{ textAlign: 'center', color: '#2a3f5a', fontSize: '14px' }}>›</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderTop: '1px solid #101828',
            }}>
              <span style={{ fontSize: '12px', color: '#3d5378' }}>
                Showing {Math.min((safePage - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
              </span>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={paginBtnStyle(false, safePage === 1)}
                >
                  ← Prev
                </button>

                {pageNums().map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={paginBtnStyle(n === safePage, false)}
                  >
                    {n}
                  </button>
                ))}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={paginBtnStyle(false, safePage === totalPages)}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function paginBtnStyle(active, disabled) {
  return {
    height: '28px',
    minWidth: '32px',
    padding: '0 8px',
    borderRadius: '6px',
    border: active ? 'none' : '1px solid #101828',
    background: active ? '#4f8ef7' : 'transparent',
    color: disabled ? '#1e3047' : active ? '#fff' : '#3d5378',
    fontSize: '12px',
    fontFamily: "'Outfit', sans-serif",
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.15s',
  };
}

export default MyTickets;
