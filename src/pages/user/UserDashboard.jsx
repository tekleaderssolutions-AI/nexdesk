import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchTickets } from '../../services/ticketService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(name) {
  const h = new Date().getHours();
  const emoji = h < 12 ? '☀️' : h < 17 ? '🌤' : h < 21 ? '🌆' : '🌙';
  const word = h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  const first = (name || 'there').split(' ')[0];
  return { text: `Good ${word}, ${first}`, emoji };
}

function fmtDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

// ── Line Chart ────────────────────────────────────────────────────────────────

function smoothPath(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${cpx} ${prev.y.toFixed(1)} ${cpx} ${curr.y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function computeDailyData(tickets, days) {
  const now = new Date();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const opened = Object.fromEntries(dates.map(d => [d, 0]));
  const resolved = Object.fromEntries(dates.map(d => [d, 0]));
  for (const t of tickets) {
    const cd = (t.created_at || '').slice(0, 10);
    if (opened[cd] !== undefined) opened[cd]++;
    const isRes = ['RESOLVED', 'CLOSED', 'AI_RESOLVED', 'AI_RESOLVED_PENDING_USER_CONFIRMATION', 'TEAM_APPROVED_AI_RESPONSE'].includes((t.status || '').toUpperCase());
    if (isRes) {
      const ud = (t.updated_at || t.created_at || '').slice(0, 10);
      if (resolved[ud] !== undefined) resolved[ud]++;
    }
  }
  return dates.map(d => ({ date: d, opened: opened[d], resolved: resolved[d] }));
}

function LineChart({ data, period }) {
  const W = 580; const H = 150;
  const PL = 28; const PR = 16; const PT = 14; const PB = 30;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const maxVal = Math.max(...data.flatMap(d => [d.opened, d.resolved]), 1);

  const pts = (key) => data.map((d, i) => ({
    x: PL + (data.length > 1 ? (i / (data.length - 1)) : 0.5) * innerW,
    y: PT + (1 - d[key] / maxVal) * innerH,
  }));

  const openedPts = pts('opened');
  const resolvedPts = pts('resolved');
  const op = smoothPath(openedPts);
  const rp = smoothPath(resolvedPts);

  const fillPath = (pts, pathStr) => {
    if (!pts.length) return '';
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${pathStr} L ${last.x.toFixed(1)} ${(H - PB).toFixed(1)} L ${first.x.toFixed(1)} ${(H - PB).toFixed(1)} Z`;
  };

  // X-axis tick indices
  const step = Math.ceil(data.length / 6);
  const xTicks = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i === 0 || i === data.length - 1 || i % step === 0);

  const gridVals = [0, 0.33, 0.67, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '140px' }}>
      <defs>
        <linearGradient id="lgO" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="lgR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {gridVals.map(f => (
        <line key={f} x1={PL} y1={(PT + f * innerH).toFixed(1)} x2={W - PR} y2={(PT + f * innerH).toFixed(1)}
          stroke="#101828" strokeWidth="1" />
      ))}
      <path d={fillPath(openedPts, op)} fill="url(#lgO)" />
      <path d={fillPath(resolvedPts, rp)} fill="url(#lgR)" />
      <path d={op} fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={rp} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {openedPts.map((p, i) => (
        i % step === 0 || i === 0 || i === openedPts.length - 1 ?
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.5" fill="#4f8ef7" /> : null
      ))}
      {resolvedPts.map((p, i) => (
        i % step === 0 || i === 0 || i === resolvedPts.length - 1 ?
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.5" fill="#34d399" /> : null
      ))}
      {xTicks.map(({ d, i }) => (
        <text key={i} x={(PL + (data.length > 1 ? i / (data.length - 1) : 0.5) * innerW).toFixed(1)}
          y={H - 8} textAnchor="middle" fontSize="9" fill="#3d5378">
          {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function donutSlice(cx, cy, r, ri, s, e) {
  if (Math.abs(e - s) < 0.01) return '';
  const toR = d => (d * Math.PI) / 180;
  const x1o = cx + r * Math.cos(toR(s)); const y1o = cy + r * Math.sin(toR(s));
  const x2o = cx + r * Math.cos(toR(e)); const y2o = cy + r * Math.sin(toR(e));
  const x1i = cx + ri * Math.cos(toR(e)); const y1i = cy + ri * Math.sin(toR(e));
  const x2i = cx + ri * Math.cos(toR(s)); const y2i = cy + ri * Math.sin(toR(s));
  const lg = (e - s) > 180 ? 1 : 0;
  return `M ${x1o.toFixed(2)} ${y1o.toFixed(2)} A ${r} ${r} 0 ${lg} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} L ${x1i.toFixed(2)} ${y1i.toFixed(2)} A ${ri} ${ri} 0 ${lg} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)} Z`;
}

function DonutChart({ slices }) {
  const total = slices.reduce((s, d) => s + d.count, 0);
  let angle = -90;
  const paths = slices.map(sl => {
    const sweep = total > 0 ? (sl.count / total) * 358 : 0;
    const end = angle + sweep;
    const path = sweep > 0.5 ? donutSlice(60, 60, 48, 30, angle, end) : '';
    angle = end + 1;
    return { ...sl, path };
  });

  if (total === 0) {
    return (
      <svg viewBox="0 0 120 120" style={{ width: '120px', height: '120px' }}>
        <circle cx="60" cy="60" r="48" fill="none" stroke="#1a2535" strokeWidth="18" />
        <circle cx="60" cy="60" r="28" fill="#0c1220" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" style={{ width: '120px', height: '120px' }}>
      {paths.map(sl => sl.path ? <path key={sl.label} d={sl.path} fill={sl.color} /> : null)}
      <circle cx="60" cy="60" r="28" fill="#0c1220" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function UserDashboard() {
  const navigate = useNavigate();
  const { user, csatRecords } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    let mounted = true;
    fetchTickets().then(r => {
      if (!mounted) return;
      if (r.success) setTickets(r.tickets || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const displayName = user?.full_name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) || 'User';
  const { text: greetText, emoji: greetEmoji } = getGreeting(displayName);

  // ── Ticket stat counters
  const totals = useMemo(() => {
    const open = tickets.filter(t => t.status?.toUpperCase() === 'OPEN').length;
    const inProgress = tickets.filter(t => t.status?.toUpperCase() === 'IN_PROGRESS').length;
    const resolved = tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status?.toUpperCase())).length;
    const aiResolved = tickets.filter(t => ['AI_RESOLVED', 'AI_RESOLVED_PENDING_USER_CONFIRMATION', 'TEAM_APPROVED_AI_RESPONSE'].includes(t.status?.toUpperCase())).length;
    const reopened = tickets.filter(t => t.status?.toUpperCase() === 'REOPENED').length;
    return { total: tickets.length, open, inProgress, resolved, aiResolved, reopened };
  }, [tickets]);

  // ── CSAT metrics
  const csatStats = useMemo(() => {
    const userEmail = (user?.email || '').toLowerCase();
    const myRecords = csatRecords.filter(r => (r.userEmail || '').toLowerCase() === userEmail);
    const avg = myRecords.length
      ? (myRecords.reduce((s, r) => s + (r.rating || 0), 0) / myRecords.length).toFixed(1)
      : null;
    const resolvedCount = totals.resolved + totals.aiResolved;
    const recentlyRated = myRecords.length;
    const pendingFeedback = Math.max(0, resolvedCount - recentlyRated);
    return { avg, resolvedCount, pendingFeedback, recentlyRated };
  }, [csatRecords, user, totals]);

  // ── Charts
  const dailyData = useMemo(() => computeDailyData(tickets, period), [tickets, period]);

  const prioritySlices = useMemo(() => {
    const p1 = tickets.filter(t => t.priority?.toUpperCase() === 'P1').length;
    const p2 = tickets.filter(t => t.priority?.toUpperCase() === 'P2').length;
    const p3 = tickets.filter(t => t.priority?.toUpperCase() === 'P3').length;
    const p45 = tickets.filter(t => ['P4', 'P5'].includes(t.priority?.toUpperCase())).length;
    return [
      { label: 'P1 Critical', color: '#ef4444', count: p1 },
      { label: 'P2 High', color: '#f97316', count: p2 },
      { label: 'P3 Medium', color: '#fbbf24', count: p3 },
      { label: 'P4/P5', color: '#475569', count: p45 },
    ];
  }, [tickets]);

  // ── Recent activity derived from tickets
  const recentActivity = useMemo(() => {
    const events = [];
    const sorted = [...tickets].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    for (const t of sorted.slice(0, 8)) {
      const st = (t.status || '').toUpperCase();
      const tno = t.ticket_no || t.id?.slice(0, 8);
      const ts = t.updated_at || t.created_at;
      if (t.major_incident_flag) {
        events.push({ dot: '#ef4444', title: `${tno} escalated to Critical`, subtitle: `${t.subject || '—'} · ${timeAgo(ts)}` });
      } else if (st === 'IN_PROGRESS') {
        events.push({ dot: '#fbbf24', title: `${tno} moved to In Progress`, subtitle: `${t.assigned_team_name || 'Team'} assigned · ${timeAgo(ts)}` });
      } else if (['RESOLVED', 'CLOSED'].includes(st)) {
        events.push({ dot: '#34d399', title: `${tno} resolved`, subtitle: `${t.assigned_team_name || 'Support team'} · ${timeAgo(ts)}` });
      } else if (['AI_RESOLVED', 'AI_RESOLVED_PENDING_USER_CONFIRMATION'].includes(st)) {
        events.push({ dot: '#a78bfa', title: `${tno} AI auto-resolved`, subtitle: `${t.subject || '—'} · ${timeAgo(ts)}` });
      } else if (st === 'REOPENED') {
        events.push({ dot: '#fb923c', title: `${tno} reopened`, subtitle: `${t.subject || '—'} · ${timeAgo(ts)}` });
      } else if (st === 'OPEN') {
        events.push({ dot: '#4f8ef7', title: `You submitted ${tno}`, subtitle: `${t.subject || '—'} · ${timeAgo(t.created_at)}` });
      }
      if (events.length >= 6) break;
    }
    return events;
  }, [tickets]);

  // ── Progress bar fill for avg satisfaction
  const satisfactionPct = csatStats.avg ? (parseFloat(csatStats.avg) / 5) * 100 : 0;

  return (
    <div className="page ff">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0' }}>
            {greetText} <span style={{ fontSize: '18px' }}>{greetEmoji}</span>
          </h1>
          <p style={{ fontSize: '12px', color: '#3d5378', marginTop: '3px' }}>
            {fmtDate()} · Your ticket overview
          </p>
        </div>
        <button type="button" className="btn-p" onClick={() => navigate('/user/new')}>+ New Ticket</button>
      </div>

      {/* Row 1 — 6 Ticket Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
        {[
          { label: 'Total', value: totals.total, color: '#e2e8f0', sub: 'All tickets' },
          { label: 'Open', value: totals.open, color: '#4f8ef7', sub: 'Awaiting action' },
          { label: 'In Progress', value: totals.inProgress, color: '#fbbf24', sub: 'Being worked on' },
          { label: 'Resolved', value: totals.resolved, color: '#34d399', sub: 'Closed tickets' },
          { label: 'Reopened', value: totals.reopened, color: '#fb923c', sub: 'Needs review' },
          { label: 'AI Resolved', value: totals.aiResolved, color: '#a78bfa', sub: 'Automatically closed' },
        ].map(c => (
          <div key={c.label} className="stat">
            <div style={{ fontSize: '10px', fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>{c.label}</div>
            <div className="ff" style={{ fontSize: '26px', fontWeight: 700, color: c.color }}>{loading ? '—' : c.value}</div>
            <div style={{ fontSize: '11px', color: '#1e2d44', marginTop: '4px' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 2 — CSAT / Satisfaction Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>

        {/* Avg Satisfaction */}
        <div className="stat" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>Avg Satisfaction</div>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>★</span>
          </div>
          <div className="ff" style={{ fontSize: '26px', fontWeight: 700, color: '#fbbf24' }}>
            {csatStats.avg ?? '—'}<span style={{ fontSize: '13px', color: '#3d5378', fontWeight: 400 }}>/5</span>
          </div>
          <div style={{ fontSize: '11px', color: '#1e2d44', marginTop: '6px', marginBottom: '8px' }}>Global CSAT index</div>
          <div style={{ height: '3px', borderRadius: '2px', background: '#101828', overflow: 'hidden' }}>
            <div style={{ width: `${satisfactionPct}%`, height: '100%', background: '#fbbf24', borderRadius: '2px', transition: 'width .4s' }} />
          </div>
        </div>

        {/* Resolved Tickets */}
        <div className="stat" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>Resolved Tickets</div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#34d399" strokeOpacity=".4"/><path d="M4 7l2 2 4-4" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="ff" style={{ fontSize: '26px', fontWeight: 700, color: '#34d399' }}>{loading ? '—' : csatStats.resolvedCount}</div>
          <div style={{ fontSize: '11px', color: '#1e2d44', marginTop: '4px' }}>Awaiting your rating</div>
        </div>

        {/* Pending Feedback */}
        <div className="stat" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>Pending Feedback</div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h10v8H8l-3 2v-2H2V2z" stroke="#f97316" strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="ff" style={{ fontSize: '26px', fontWeight: 700, color: '#f97316' }}>{loading ? '—' : csatStats.pendingFeedback}</div>
          <div style={{ fontSize: '11px', color: '#1e2d44', marginTop: '4px' }}>Needs your review</div>
        </div>

        {/* Recently Rated */}
        <div className="stat" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>Recently Rated</div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.5 3.2L12 4.8l-2.5 2.4.6 3.4L7 9l-3.1 1.6.6-3.4L2 4.8l3.5-.6L7 1z" stroke="#60a5fa" strokeOpacity=".5" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="ff" style={{ fontSize: '26px', fontWeight: 700, color: '#60a5fa' }}>{csatStats.recentlyRated}</div>
          <div style={{ fontSize: '11px', color: '#1e2d44', marginTop: '4px' }}>Tickets rated</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '14px', marginBottom: '16px' }}>

        {/* Line Chart — Ticket Activity */}
        <div className="card" style={{ padding: '18px 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Ticket Activity</div>
              <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px' }}>Last {period} days</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[30, 90].map(p => (
                <button key={p} type="button" onClick={() => setPeriod(p)}
                  style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: period === p ? 'var(--accent)' : '#101828',
                    color: period === p ? '#fff' : '#3d5378',
                  }}>{p}d</button>
              ))}
            </div>
          </div>
          <LineChart data={dailyData} period={period} />
          <div style={{ display: 'flex', gap: '18px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '2px', background: '#4f8ef7', borderRadius: '1px' }} />
              <span style={{ fontSize: '11px', color: '#3d5378' }}>Opened</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '2px', background: '#34d399', borderRadius: '1px' }} />
              <span style={{ fontSize: '11px', color: '#3d5378' }}>Resolved</span>
            </div>
          </div>
        </div>

        {/* Donut Chart — By Priority */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 16px 16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', alignSelf: 'flex-start', marginBottom: '14px' }}>By Priority</div>
          <div style={{ fontSize: '11px', color: '#3d5378', alignSelf: 'flex-start', marginTop: '-10px', marginBottom: '14px' }}>Total distribution</div>
          <DonutChart slices={prioritySlices} />
          <div style={{ display: 'grid', gap: '7px', width: '100%', marginTop: '14px' }}>
            {prioritySlices.map(sl => (
              <div key={sl.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sl.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{sl.label}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>{sl.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>Recent Activity</div>
        {loading ? (
          <div style={{ fontSize: '12px', color: '#3d5378' }}>Loading activity…</div>
        ) : recentActivity.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#3d5378' }}>No recent activity yet. Submit a ticket to get started.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
            {recentActivity.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.dot, flexShrink: 0, marginTop: '4px' }} />
                <div>
                  <div style={{ fontSize: '12.5px', color: '#c9d8ee', fontWeight: 500 }}>{item.title}</div>
                  <div style={{ fontSize: '11.5px', color: '#3d5378', marginTop: '2px' }}>{item.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default UserDashboard;
