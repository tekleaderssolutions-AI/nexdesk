import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets } from '../../services/ticketService';

const STATUS_OPTS = ['All Status', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED', 'REOPENED', 'AI_RESOLVED'];
const PRIORITY_OPTS = ['All Priority', 'P1', 'P2', 'P3', 'P4', 'P5'];

const PRIORITY_LABEL = { P1: 'P1', P2: 'P2', P3: 'P3', P4: 'P4', P5: 'P5' };
const PRIORITY_COLOR = { P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#3b82f6', P5: '#6b7280' };
const STATUS_MAP = {
  OPEN: { label: 'Open', cls: 's-open' },
  IN_PROGRESS: { label: 'In Progress', cls: 's-prog' },
  RESOLVED: { label: 'Resolved', cls: 's-res' },
  CLOSED: { label: 'Resolved', cls: 's-res' },
  ESCALATED: { label: 'Escalated', cls: 's-esc' },
  REOPENED: { label: 'Reopened', cls: 's-reo' },
  AI_RESOLVED: { label: 'AI Resolved', cls: 's-ai' },
  AI_RESOLVED_PENDING_USER_CONFIRMATION: { label: 'AI Pending', cls: 's-ai' },
  AI_TEAM_REVIEW: { label: 'AI Review', cls: 's-ai' },
  TEAM_APPROVED_AI_RESPONSE: { label: 'Team Approved', cls: 's-prog' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function slaDisplay(ticket) {
  if (!ticket.created_at) return null;
  const slaMap = { P1: 60, P2: 240, P3: 480, P4: 1440, P5: 2880 };
  const slaMins = slaMap[ticket.priority] || 480;
  const elapsedMins = Math.floor((Date.now() - new Date(ticket.created_at)) / 60000);
  const h = Math.floor(elapsedMins / 60);
  const m = elapsedMins % 60;
  const breached = elapsedMins > slaMins && !['RESOLVED', 'CLOSED', 'AI_RESOLVED'].includes(ticket.status);
  return { label: `${h}h ${String(m).padStart(2, '0')}m`, breached };
}

const PAGE_SIZE = 15;

export default function AdminAllTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [priority, setPriority] = useState('All Priority');
  const [team, setTeam] = useState('All Teams');
  const [allTeams, setAllTeams] = useState([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (status !== 'All Status') params.status = status;
    if (priority !== 'All Priority') params.priority = priority;
    if (search.trim()) params.search = search.trim();
    const r = await fetchTickets(params);
    if (r.success) {
      let list = r.tickets || [];
      if (team !== 'All Teams') list = list.filter(t => t.assigned_team_name === team);
      setTickets(list);
      // Collect unique team names
      const names = [...new Set(list.map(t => t.assigned_team_name).filter(Boolean))];
      setAllTeams(names);
    }
    setLoading(false);
    setPage(1);
    setSelected(new Set());
  }, [status, priority, team, search]);

  useEffect(() => { load(); }, [status, priority, team]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') load();
  };

  const needAttention = tickets.filter(t =>
    ['ESCALATED', 'REOPENED'].includes(t.status) ||
    slaDisplay(t)?.breached
  ).length;

  // Pagination
  const totalPages = Math.ceil(tickets.length / PAGE_SIZE);
  const pageTickets = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Select all on current page
  const allSelected = pageTickets.length > 0 && pageTickets.every(t => selected.has(t.id || t.ticket_id));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) pageTickets.forEach(t => next.delete(t.id || t.ticket_id));
      else pageTickets.forEach(t => next.add(t.id || t.ticket_id));
      return next;
    });
  };
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>All Tickets</div>
          <div style={{ fontSize: 12.5, color: '#3d5378', marginTop: 4 }}>
            {tickets.length.toLocaleString()} total
            {needAttention > 0 && (
              <span style={{ color: '#ef4444', marginLeft: 6 }}>· {needAttention} need attention</span>
            )}
          </div>
        </div>
        <button className="btn-s" style={{ fontSize: 12, padding: '7px 16px' }}
          onClick={() => {
            const csv = ['Ticket ID,Subject,User,Priority,Status,Team,Created']
              .concat(tickets.map(t =>
                `${t.ticket_no},${t.subject},${t.created_by_name || ''},${t.priority},${t.status},${t.assigned_team_name || ''},${t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}`
              )).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            a.download = 'tickets.csv';
            a.click();
          }}>
          Export
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="inp"
          placeholder="Search tickets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          style={{ width: 220, fontSize: 12.5 }}
        />
        <select className="sel" value={status} onChange={e => setStatus(e.target.value)} style={{ fontSize: 12.5, minWidth: 130 }}>
          {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="sel" value={priority} onChange={e => setPriority(e.target.value)} style={{ fontSize: 12.5, minWidth: 130 }}>
          {PRIORITY_OPTS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="sel" value={team} onChange={e => setTeam(e.target.value)} style={{ fontSize: 12.5, minWidth: 130 }}>
          <option>All Teams</option>
          {allTeams.map(t => <option key={t}>{t}</option>)}
        </select>
        {(status !== 'All Status' || priority !== 'All Priority' || team !== 'All Teams' || search) && (
          <button className="btn-s" style={{ fontSize: 11.5, padding: '5px 12px' }}
            onClick={() => { setStatus('All Status'); setPriority('All Priority'); setTeam('All Teams'); setSearch(''); }}>
            Clear
          </button>
        )}
        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: '#a855f7', marginLeft: 8 }}>
            {selected.size} selected
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#3d5378', fontSize: 13 }}>Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#3d5378', fontSize: 13 }}>No tickets found</div>
        ) : (
          <table className="tbl" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 36, paddingLeft: 16 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    style={{ accentColor: '#a855f7', cursor: 'pointer' }} />
                </th>
                <th>Ticket ID</th>
                <th>Subject</th>
                <th>User</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Team</th>
                <th>SLA</th>
                <th>AI</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {pageTickets.map(t => {
                const tid = t.id || t.ticket_id;
                const sla = slaDisplay(t);
                const sm = STATUS_MAP[t.status] || { label: t.status, cls: 's-pend' };
                const aiScore = t.final_resolution_confidence;
                return (
                  <tr key={tid} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/admin/ticket/${tid}`)}>
                    <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(tid)} onChange={() => toggleOne(tid)}
                        style={{ accentColor: '#a855f7', cursor: 'pointer' }} />
                    </td>
                    <td>
                      <span style={{ color: '#a855f7', fontWeight: 600, fontSize: 12.5 }}>
                        {t.ticket_no || `TKT-${String(tid).slice(0, 4).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="bright" style={{ maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {t.subject}
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{t.created_by_name || '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                        background: (PRIORITY_COLOR[t.priority] || '#6b7280') + '22',
                        color: PRIORITY_COLOR[t.priority] || '#6b7280',
                        border: `1px solid ${(PRIORITY_COLOR[t.priority] || '#6b7280')}44`,
                      }}>
                        {PRIORITY_LABEL[t.priority] || t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`b ${sm.cls}`}>{sm.label}</span>
                    </td>
                    <td style={{ fontSize: 12.5, color: '#94a3b8' }}>
                      {t.assigned_team_name || '—'}
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {sla ? (
                        sla.breached ? (
                          <span style={{
                            background: 'rgba(239,68,68,.15)', color: '#ef4444',
                            border: '1px solid rgba(239,68,68,.3)', borderRadius: 4,
                            padding: '2px 7px', fontSize: 11, fontWeight: 700,
                          }}>BREACH</span>
                        ) : (
                          <span style={{ color: '#3d5378' }}>{sla.label}</span>
                        )
                      ) : <span style={{ color: '#3d5378' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {aiScore != null ? (
                        <span style={{ color: aiScore >= 70 ? '#22c55e' : aiScore >= 50 ? '#eab308' : '#ef4444', fontWeight: 600 }}>
                          🤖 {Math.round(aiScore)}%
                        </span>
                      ) : (
                        <span style={{ color: '#3d5378' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: '#3d5378', whiteSpace: 'nowrap' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && tickets.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#3d5378' }}>
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, tickets.length)} of {tickets.length.toLocaleString()} tickets
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-s" style={{ fontSize: 12, padding: '5px 14px' }}
              disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              ← Prev
            </button>
            <button className="btn-s" style={{ fontSize: 12, padding: '5px 14px' }}
              disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
