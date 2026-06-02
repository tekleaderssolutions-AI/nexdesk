import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDepartmentDashboardStats, getTeamMembersWorkload, assignTicketToMember } from '../../services/ticketService';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────────
const PRIORITY_COLOR = { P1: '#f87171', P2: '#fb923c', P3: '#facc15', P4: '#4f8ef7', P5: '#94a3b8' };
const PRIORITY_CLASS = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' };
const CAT_COLORS = ['#4f8ef7', '#34d399', '#a855f7', '#fb923c', '#f87171', '#facc15', '#06b6d4', '#ec4899'];

function statusBadge(s) {
  const u = (s || '').toUpperCase();
  const map = {
    OPEN: 's-open', IN_PROGRESS: 's-prog', RESOLVED: 's-res', CLOSED: 's-res',
    ESCALATED: 's-esc', AI_RESOLVED: 's-ai',
    AI_RESOLVED_PENDING_USER_CONFIRMATION: 's-ai', AI_TEAM_REVIEW: 's-ai',
    TEAM_APPROVED_AI_RESPONSE: 's-ai', REOPENED: 's-reo',
  };
  const label = {
    OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed',
    ESCALATED: 'Escalated', AI_RESOLVED: 'AI Resolved',
    AI_RESOLVED_PENDING_USER_CONFIRMATION: 'AI Sent', AI_TEAM_REVIEW: 'AI Review',
    TEAM_APPROVED_AI_RESPONSE: 'Team Approved', REOPENED: 'Reopened',
  };
  return <span className={`b ${map[u] || 's-open'}`}>{label[u] || s}</span>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtSLA(t) {
  if (t.sla_breached) return <span style={{ color: '#f87171', fontWeight: 700, fontSize: '11px' }}>BREACHED</span>;
  if (t.sla_at_risk) return <span style={{ color: '#fb923c', fontWeight: 700, fontSize: '11px' }}>AT RISK</span>;
  if (t.sla_minutes_remaining != null) {
    const h = Math.floor(t.sla_minutes_remaining / 60);
    const m = t.sla_minutes_remaining % 60;
    return <span style={{ color: '#34d399', fontSize: '11px' }}>{h > 0 ? `${h}h ${m}m` : `${m}m`} left</span>;
  }
  return null;
}

// ── Donut chart (SVG) ──────────────────────────────────────────────────────────
function polarToXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function buildArc(cx, cy, outerR, innerR, startDeg, endDeg) {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.99;
  const o1 = polarToXY(cx, cy, outerR, startDeg), o2 = polarToXY(cx, cy, outerR, endDeg);
  const i1 = polarToXY(cx, cy, innerR, endDeg),   i2 = polarToXY(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M${o1.x.toFixed(1)},${o1.y.toFixed(1)}`,
    `A${outerR},${outerR},0,${large},1,${o2.x.toFixed(1)},${o2.y.toFixed(1)}`,
    `L${i1.x.toFixed(1)},${i1.y.toFixed(1)}`,
    `A${innerR},${innerR},0,${large},0,${i2.x.toFixed(1)},${i2.y.toFixed(1)}`, 'Z',
  ].join(' ');
}
function Donut({ segments, total }) {
  const cx = 60, cy = 60, outerR = 50, innerR = 32;
  let angle = 0;
  const arcs = total > 0
    ? segments.filter(s => s.value > 0).map(s => {
        const sweep = (s.value / total) * 360;
        const path = buildArc(cx, cy, outerR, innerR, angle, angle + sweep);
        angle += sweep;
        return { ...s, path };
      })
    : [];
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      {arcs.length === 0
        ? <circle cx={cx} cy={cy} r={outerR - 9} fill="none" stroke="#101828" strokeWidth="18" />
        : arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)}
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="700">{total}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill="#3d5378" fontSize="8">tickets</text>
    </svg>
  );
}

// ── Bar chart (SVG) ───────────────────────────────────────────────────────────
function BarChart({ weeks }) {
  if (!weeks || weeks.length === 0) return <div style={{ color: '#2a3f5a', fontSize: '12px', padding: '20px' }}>No trend data yet.</div>;
  const maxVal = Math.max(...weeks.flatMap(w => [w.open || 0, w.resolved || 0, w.escalated || 0]), 1);
  const W = 56, H = 120, gap = 8, barW = 14, groupW = W;
  const totalW = weeks.length * groupW + gap;
  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${H + 20}`} style={{ overflow: 'visible' }}>
      {weeks.map((w, i) => {
        const x = i * groupW + gap;
        const openH  = Math.round((w.open || 0) / maxVal * H);
        const resH   = Math.round((w.resolved || 0) / maxVal * H);
        const escH   = Math.round((w.escalated || 0) / maxVal * H);
        return (
          <g key={i}>
            <rect x={x}           y={H - openH}  width={barW} height={openH}  fill="#4f8ef7" rx="2" />
            <rect x={x + barW + 2} y={H - resH}   width={barW} height={resH}   fill="#34d399" rx="2" />
            <rect x={x + barW*2+4} y={H - escH}   width={barW} height={escH}   fill="#f87171" rx="2" />
            <text x={x + barW + 6} y={H + 14} textAnchor="middle" fill="#1e3047" fontSize="8">{w.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, loading }) {
  return (
    <div className="card" style={{ padding: '16px 18px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
        <span style={{ fontSize: '14px', color }}>{icon}</span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: loading ? '#1e3047' : color }}>{loading ? '—' : (value ?? 0)}</div>
    </div>
  );
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({ ticket, members, onClose, onAssigned }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleAssign = async () => {
    if (!selected) { setErr('Select a member'); return; }
    setBusy(true); setErr('');
    const r = await assignTicketToMember(ticket.ticket_id, selected);
    setBusy(false);
    if (r.success) { onAssigned(); onClose(); }
    else setErr(r.message || 'Failed');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card ff" style={{ width: '380px', padding: '24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>Assign Ticket</div>
        <div style={{ fontSize: '12px', color: '#3d5378', marginBottom: '18px' }}>
          {ticket.ticket_no} — {ticket.subject}
        </div>
        <select
          className="sel"
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ width: '100%', marginBottom: '14px' }}
        >
          <option value="">Select team member…</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name} ({m.member_role})
            </option>
          ))}
        </select>
        {err && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '10px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-s" onClick={onClose} style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}>Cancel</button>
          <button className="btn-p" onClick={handleAssign} disabled={busy} style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}>
            {busy ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Workload Row ────────────────────────────────────────────────────────
function MemberRow({ member, allMembers, isManager, maxTickets, onReload }) {
  const [open, setOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const navigate = useNavigate();
  const count = member.tickets.length;
  const pct   = maxTickets > 0 ? Math.round((count / maxTickets) * 100) : 0;
  const barColor = pct >= 80 ? '#f87171' : pct >= 60 ? '#fb923c' : '#34d399';
  const initial = (member.full_name[0] || '?').toUpperCase();

  return (
    <>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0',
          borderBottom: '1px solid #0a1020', cursor: 'pointer',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Avatar */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#34d399,#059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, color: '#fff',
        }}>{initial}</div>

        {/* Name + role */}
        <div style={{ minWidth: '120px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#c9d8ee' }}>{member.full_name}</div>
          <div style={{ fontSize: '10.5px', color: member.member_role === 'MANAGER' ? '#34d399' : '#3d5378', marginTop: '1px' }}>
            {member.member_role}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, margin: '0 8px' }}>
          <div style={{ height: '6px', background: '#101828', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width .4s' }} />
          </div>
        </div>

        {/* Count + pct */}
        <div style={{ textAlign: 'right', minWidth: '72px' }}>
          <div style={{ fontSize: '12.5px', color: '#c9d8ee', fontWeight: 600 }}>{count} tickets</div>
          <div style={{ fontSize: '10.5px', color: barColor }}>{pct}%</div>
        </div>

        {/* Chevron */}
        <div style={{ color: '#2a3f5a', fontSize: '12px', marginLeft: '4px' }}>
          {open ? '▲' : '▼'}
        </div>
      </div>

      {/* Drill-down ticket list */}
      {open && (
        <div style={{ background: 'rgba(9,13,26,.6)', borderRadius: '8px', margin: '4px 0 8px 44px', overflowX: 'auto' }}>
          {count === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '12px', color: '#2a3f5a' }}>No active tickets assigned.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '540px' }}>
              <thead>
                <tr>
                  {['Ticket', 'Subject', 'Priority', 'Status', 'SLA', 'Created', isManager ? 'Action' : null]
                    .filter(Boolean)
                    .map(h => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #101828' }}>
                        {h}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {member.tickets.map(t => (
                  <tr key={t.ticket_id} style={{ borderBottom: '1px solid #0a1020' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/team/ticket/${t.ticket_id}`); }}
                        style={{ background: 'none', border: 'none', color: '#4f8ef7', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        {t.ticket_no}
                      </button>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: '#c9d8ee', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className={`b ${PRIORITY_CLASS[t.priority] || 'p3'}`}>● {t.priority}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>{statusBadge(t.status)}</td>
                    <td style={{ padding: '8px 12px' }}>{fmtSLA(t)}</td>
                    <td style={{ padding: '8px 12px', fontSize: '11px', color: '#2a3f5a' }}>{fmtDate(t.created_at)}</td>
                    {isManager && (
                      <td style={{ padding: '8px 12px' }}>
                        <button
                          className="btn-s"
                          onClick={e => { e.stopPropagation(); setAssignTarget(t); }}
                          style={{ height: '24px', padding: '0 10px', fontSize: '10.5px' }}
                        >
                          Reassign
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {assignTarget && (
        <AssignModal
          ticket={assignTarget}
          members={allMembers}
          onClose={() => setAssignTarget(null)}
          onAssigned={onReload}
        />
      )}
    </>
  );
}

// ── Department Member Workload Chart ──────────────────────────────────────────
function DeptMemberChart({ members }) {
  if (!members || members.length === 0) return null;

  // Sort descending by ticket count so the busiest person is at the top
  const sorted = [...members].sort((a, b) => b.ticket_count - a.ticket_count);
  const max = Math.max(...sorted.map(m => m.ticket_count), 1);

  const MEMBER_COLORS  = ['#4f8ef7', '#34d399', '#a855f7', '#fb923c', '#f87171', '#facc15', '#06b6d4', '#ec4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sorted.map((m, i) => {
        const pct  = (m.ticket_count / max) * 100;
        const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
        const initial = (m.full_name[0] || '?').toUpperCase();
        return (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Avatar */}
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg,${color}99,${color}44)`,
              border: `1.5px solid ${color}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 800, color,
            }}>
              {initial}
            </div>
            {/* Name */}
            <div style={{ width: '130px', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', color: '#c9d8ee', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.full_name}
              </div>
              <div style={{ fontSize: '10px', color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {m.member_role}
              </div>
            </div>
            {/* Bar */}
            <div style={{ flex: 1, height: '8px', background: '#101828', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: '4px',
                background: `linear-gradient(90deg,${color},${color}88)`,
                transition: 'width .5s ease',
                minWidth: m.ticket_count > 0 ? '6px' : '0',
              }} />
            </div>
            {/* Count */}
            <div style={{ width: '30px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: m.ticket_count > 0 ? color : '#2a3f5a' }}>
              {m.ticket_count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function TeamDashboard() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats]       = useState(null);
  const [workload, setWorkload]  = useState(null);
  const [loading, setLoading]   = useState(true);
  const [assignModal, setAssignModal] = useState(null); // for unassigned tickets

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchDepartmentDashboardStats(),
      getTeamMembersWorkload(),
    ]).then(([sr, wr]) => {
      if (sr.success) setStats(sr.stats);
      if (wr.success) setWorkload(wr.data);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const teamName = workload?.team_name || stats?.dept_name || 'Team';
  const isManager    = (workload?.current_user_member_role || '').toUpperCase() === 'MANAGER';
  const deptMembers  = workload?.department_members || [];

  // Build category donut segments
  const catBreakdown = stats?.category_breakdown || [];
  const catTotal = catBreakdown.reduce((s, c) => s + c.count, 0);
  const catSegments = catBreakdown.slice(0, 6).map((c, i) => ({
    label: c.category, value: c.count, color: CAT_COLORS[i % CAT_COLORS.length],
  }));

  // Build weekly trend data from stats
  const weeks = (() => {
    if (!stats) return [];
    const now = new Date();
    const buckets = [];
    for (let w = 5; w >= 0; w--) {
      const d = new Date(now);
      d.setDate(d.getDate() - w * 7);
      buckets.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        open: 0, resolved: 0, escalated: 0,
      });
    }
    // Use available stats to populate the most recent bucket
    if (buckets.length > 0) {
      const last = buckets[buckets.length - 1];
      last.open     = stats.open || 0;
      last.resolved = stats.resolved || 0;
      last.escalated = stats.escalated || 0;
      // Spread this_week / last_week into the recent buckets
      if (buckets.length >= 2) {
        const prev = buckets[buckets.length - 2];
        prev.open = stats.last_week || 0;
        prev.resolved = Math.round((stats.last_week || 0) * 0.6);
        prev.escalated = Math.round((stats.last_week || 0) * 0.1);
      }
    }
    return buckets;
  })();

  // Max tickets across all members (for bar scaling)
  const maxTickets = workload
    ? Math.max(...(workload.members || []).map(m => m.tickets.length), 1)
    : 1;

  // Activity feed from recent_activity
  const activity = stats?.recent_activity || [];

  const unassigned = workload?.unassigned_tickets || [];

  return (
    <div className="page ff">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '20px', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Team Dashboard</h1>
          <p style={{ fontSize: '12px', color: '#3d5378', marginTop: '4px' }}>
            {dateStr} · {teamName}{isManager ? ' · Manager View' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-s" onClick={() => navigate('/team/queue')} style={{ height: '32px', padding: '0 16px', fontSize: '12.5px' }}>
            View Queue
          </button>
          <button className="btn-p" onClick={() => navigate('/team/workspace')} style={{ height: '32px', padding: '0 16px', fontSize: '12.5px' }}>
            + Start Shift
          </button>
        </div>
      </div>

      {/* ── 5 stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Assigned"   value={stats?.open}        color="#4f8ef7" icon="📋" loading={loading} />
        <StatCard label="Pending"    value={stats?.pending}     color="#facc15" icon="⏳" loading={loading} />
        <StatCard label="Escalated"  value={stats?.escalated}   color="#fb923c" icon="⚠" loading={loading} />
        <StatCard label="SLA Breach" value={stats?.sla_breached} color="#f87171" icon="🔴" loading={loading} />
        <StatCard label="Incidents"  value={stats?.incidents}   color="#f87171" icon="🚨" loading={loading} />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '16px' }}>
        {/* Resolution Trends */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e2e8f0' }}>Resolution Trends</div>
              <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px' }}>Team performance · Last 30 days</div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[['#4f8ef7','Open'], ['#34d399','Resolved'], ['#f87171','Escalated']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#3d5378' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: c, display: 'inline-block' }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <BarChart weeks={weeks} />
          </div>
        </div>

        {/* Ticket Categories */}
        <div className="card">
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '14px' }}>Ticket Categories</div>
          {loading ? (
            <div style={{ color: '#2a3f5a', fontSize: '12px' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Donut segments={catSegments} total={catTotal} />
              <div style={{ width: '100%' }}>
                {catSegments.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11.5px', color: '#3d5378', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8499b5' }}>
                      {catTotal > 0 ? Math.round(s.value / catTotal * 100) : 0}%
                    </span>
                  </div>
                ))}
                {catSegments.length === 0 && <div style={{ fontSize: '12px', color: '#2a3f5a' }}>No category data yet.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Team Workload + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
        {/* Team Workload with drill-down */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e2e8f0' }}>Team Workload</div>
              {isManager && (
                <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px' }}>Manager — click member to see tickets & assign</div>
              )}
              {!isManager && (
                <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px' }}>Click a member to see their active tickets</div>
              )}
            </div>
            {unassigned.length > 0 && (
              <span style={{
                background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.25)',
                color: '#f87171', borderRadius: '12px', fontSize: '10.5px', fontWeight: 700,
                padding: '3px 10px',
              }}>
                {unassigned.length} Unassigned
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ color: '#2a3f5a', fontSize: '12px' }}>Loading…</div>
          ) : !workload?.members?.length ? (
            <div style={{ color: '#2a3f5a', fontSize: '12px' }}>No team members found.</div>
          ) : (
            workload.members.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                allMembers={deptMembers}
                isManager={isManager}
                maxTickets={maxTickets}
                onReload={loadData}
              />
            ))
          )}

          {/* Unassigned tickets section */}
          {unassigned.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px' }}>
                Unassigned Tickets ({unassigned.length})
              </div>
              <div style={{ background: 'rgba(9,13,26,.6)', borderRadius: '8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                  <thead>
                    <tr>
                      {['Ticket', 'Subject', 'Priority', 'Status', 'SLA', isManager ? 'Assign' : null].filter(Boolean).map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #101828' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unassigned.slice(0, 10).map(t => (
                      <tr key={t.ticket_id} style={{ borderBottom: '1px solid #0a1020' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <button
                            onClick={() => navigate(`/team/ticket/${t.ticket_id}`)}
                            style={{ background: 'none', border: 'none', color: '#4f8ef7', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                          >
                            {t.ticket_no}
                          </button>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12px', color: '#c9d8ee', maxWidth: '180px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                        </td>
                        <td style={{ padding: '8px 12px' }}><span className={`b ${PRIORITY_CLASS[t.priority] || 'p3'}`}>● {t.priority}</span></td>
                        <td style={{ padding: '8px 12px' }}>{statusBadge(t.status)}</td>
                        <td style={{ padding: '8px 12px' }}>{fmtSLA(t)}</td>
                        {isManager && (
                          <td style={{ padding: '8px 12px' }}>
                            <button
                              className="btn-p"
                              onClick={() => setAssignModal(t)}
                              style={{ height: '24px', padding: '0 10px', fontSize: '10.5px' }}
                            >
                              Assign
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Team Activity */}
        <div className="card">
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '14px' }}>Team Activity</div>
          {loading ? (
            <div style={{ color: '#2a3f5a', fontSize: '12px' }}>Loading…</div>
          ) : activity.length === 0 ? (
            <div style={{ color: '#2a3f5a', fontSize: '12px' }}>No recent activity.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {activity.map((a, i) => {
                const dotColors = ['#f87171', '#a855f7', '#fb923c', '#34d399', '#4f8ef7'];
                const dot = dotColors[i % dotColors.length];
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 0' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot, flexShrink: 0, marginTop: '5px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#c9d8ee', fontWeight: 500 }}>
                          {a.ticket_no && (
                            <span
                              onClick={() => navigate(`/team/ticket/${a.ticket_id}`)}
                              style={{ color: '#4f8ef7', cursor: 'pointer', marginRight: '6px', fontWeight: 700 }}
                            >
                              {a.ticket_no}
                            </span>
                          )}
                          {a.event}
                        </div>
                        {a.value && <div style={{ fontSize: '11px', color: '#2a3f5a', marginTop: '2px' }}>{a.value}</div>}
                      </div>
                    </div>
                    {i < activity.length - 1 && <div style={{ height: '1px', background: '#0a1020', marginLeft: '17px' }} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* SLA health summary */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #101828' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>SLA Health</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#3d5378' }}>Compliance</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: (stats?.sla_compliance ?? 100) >= 80 ? '#34d399' : '#f87171' }}>
                  {loading ? '—' : `${stats?.sla_compliance ?? 100}%`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#3d5378' }}>Breached</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: (stats?.sla_breached ?? 0) > 0 ? '#f87171' : '#34d399' }}>
                  {loading ? '—' : stats?.sla_breached ?? 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#3d5378' }}>At Risk</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: (stats?.sla_at_risk ?? 0) > 0 ? '#fb923c' : '#34d399' }}>
                  {loading ? '—' : stats?.sla_at_risk ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Department Member Ticket Distribution Chart ── */}
      {deptMembers.length > 0 && (
        <div className="card" style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e2e8f0' }}>Department Ticket Distribution</div>
              <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px' }}>Active tickets assigned per member across all teams in this department</div>
            </div>
            <span style={{ fontSize: '11px', color: '#3d5378' }}>
              {deptMembers.reduce((s, m) => s + (m.ticket_count || 0), 0)} total active
            </span>
          </div>
          {loading ? (
            <div style={{ color: '#2a3f5a', fontSize: '12px' }}>Loading…</div>
          ) : (
            <DeptMemberChart members={deptMembers} />
          )}
        </div>
      )}

      {/* Assign modal for unassigned tickets */}
      {assignModal && isManager && workload && (
        <AssignModal
          ticket={assignModal}
          members={deptMembers}
          onClose={() => setAssignModal(null)}
          onAssigned={loadData}
        />
      )}
    </div>
  );
}

export default TeamDashboard;
