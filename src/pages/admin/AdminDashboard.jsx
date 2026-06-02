import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardStats } from '../../services/ticketService';

// ── helpers ────────────────────────────────────────────────────────────────────
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString(); }
function pct(n)  { return n == null ? '—' : `${n}%`; }

const PRIORITY_LABEL = { P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Medium', P4: 'P4 Low', P5: 'P5 Minimal' };
const PRIORITY_COLOR = { P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#3b82f6', P5: '#6b7280' };
const STATUS_BADGE = {
  OPEN: 's-open', IN_PROGRESS: 's-prog', RESOLVED: 's-res', CLOSED: 's-res',
  ESCALATED: 's-esc', REOPENED: 's-reo',
};

// ── simple SVG polyline chart ──────────────────────────────────────────────────
function VolumeChart({ data }) {
  const W = 600, H = 120, PAD = 10;
  if (!data || data.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d5378', fontSize: 13 }}>
      No volume data yet
    </div>
  );

  const maxVal = Math.max(...data.map(d => Math.max(d.new, d.resolved)), 1);
  const xStep = (W - PAD * 2) / (data.length - 1);

  const pts = (key) => data.map((d, i) => {
    const x = PAD + i * xStep;
    const y = PAD + (1 - d[key] / maxVal) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPath = (key, color) => {
    const points = data.map((d, i) => {
      const x = PAD + i * xStep;
      const y = PAD + (1 - d[key] / maxVal) * (H - PAD * 2);
      return [x, y];
    });
    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const areaD = lineD + ` L${points[points.length - 1][0]},${H - PAD} L${PAD},${H - PAD} Z`;
    return (
      <path d={areaD} fill={color} opacity="0.15" />
    );
  };

  const showLabels = data.filter((_, i) => i % Math.ceil(data.length / 6) === 0);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {/* grid lines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD} y1={PAD + (1 - f) * (H - PAD * 2)} x2={W - PAD} y2={PAD + (1 - f) * (H - PAD * 2)}
            stroke="#101828" strokeWidth="1" />
        ))}
        {/* areas */}
        {areaPath('new', '#3b82f6')}
        {areaPath('resolved', '#34d399')}
        {/* lines */}
        <polyline points={pts('new')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={pts('resolved')} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
          <span style={{ width: 12, height: 2, background: '#3b82f6', display: 'inline-block', borderRadius: 2 }} /> New
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
          <span style={{ width: 12, height: 2, background: '#34d399', display: 'inline-block', borderRadius: 2 }} /> Resolved
        </div>
      </div>
    </div>
  );
}

// ── SVG donut chart ────────────────────────────────────────────────────────────
const DONUT_COLORS = ['#3b82f6', '#a855f7', '#eab308', '#34d399', '#f97316', '#06b6d4'];

function DonutChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d5378', fontSize: 13 }}>
      No category data
    </div>
  );

  const total = data.reduce((s, d) => s + d.count, 0);
  const R = 52, cx = 70, cy = 70, stroke = 22;
  const circumference = 2 * Math.PI * R;
  let offset = 0;

  const slices = data.map((d, i) => {
    const frac = d.count / total;
    const dash = frac * circumference;
    const gap = circumference - dash;
    const slice = { offset: circumference - offset, dash, gap, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    offset += dash;
    return slice;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={140} height={140} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#101828" strokeWidth={stroke} />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{d.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── department performance bar chart ──────────────────────────────────────────
function DeptPerformanceChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ color: '#3d5378', fontSize: 13 }}>No department data yet</div>
  );
  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const BAR_COLORS = ['#34d399', '#3b82f6', '#f97316', '#eab308', '#a855f7', '#06b6d4'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.slice(0, 6).map((d, i) => {
        const pctFill = (d.total / maxTotal) * 100;
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={d.dept_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 110, fontSize: 12, color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.dept_name}
            </div>
            <div style={{ flex: 1, background: '#101828', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${pctFill}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#e2e8f0', minWidth: 28, textAlign: 'right' }}>
              {d.sla_compliance != null ? `${d.sla_compliance}%` : `${d.total}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── stat card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, subColor, icon }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>{title}</div>
        {icon && <div style={{ fontSize: 20, opacity: 0.35 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11.5, color: subColor || '#3d5378', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats().then(r => {
      if (r.success) setStats(r.stats);
      setLoading(false);
    });
  }, []);

  const s = stats || {};

  // Best / worst dept by SLA compliance
  const sortedDepts = [...(s.department_breakdown || [])].sort((a, b) => b.sla_compliance - a.sla_compliance);
  const bestDept  = sortedDepts[0] || null;
  const worstDept = sortedDepts[sortedDepts.length - 1] || null;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Row 1: 4 primary KPIs ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard
          title="Total Tickets"
          value={loading ? '…' : fmt(s.total_tickets)}
          sub={s.total_tickets ? `${s.open || 0} still open` : null}
          icon="🎫"
        />
        <KpiCard
          title="Active Incidents"
          value={loading ? '…' : fmt(s.active_incidents ?? 0)}
          sub={s.active_incidents > 0 ? 'Needs attention' : 'All clear'}
          subColor={s.active_incidents > 0 ? '#ef4444' : '#34d399'}
          icon="🔥"
        />
        <KpiCard
          title="AI Resolution %"
          value={loading ? '…' : pct(s.ai_resolution_pct)}
          sub={`${fmt(s.ai_auto_resolved)} auto-resolved`}
          subColor="#34d399"
          icon="🤖"
        />
        <KpiCard
          title="SLA Compliance"
          value={loading ? '…' : pct(s.sla_compliance_pct)}
          sub={`${fmt(s.assigned ?? 0)} assigned tickets`}
          subColor={s.sla_compliance_pct >= 80 ? '#34d399' : s.sla_compliance_pct >= 60 ? '#eab308' : '#ef4444'}
          icon="📋"
        />
      </div>

      {/* ── Row 2: 4 secondary KPIs ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard
          title="Open Tickets"
          value={loading ? '…' : fmt(s.open)}
          sub="Awaiting action"
        />
        <KpiCard
          title="In Progress"
          value={loading ? '…' : fmt(s.in_progress)}
          sub="Being worked on"
        />
        <KpiCard
          title="Resolved (all time)"
          value={loading ? '…' : fmt(s.resolved)}
          sub={`${fmt(s.ai_auto_resolved ?? 0)} by AI`}
          subColor="#34d399"
        />
        <KpiCard
          title="Duplicate Reduction"
          value={loading ? '…' : pct(s.duplicate_reduction_pct)}
          sub="AI dedup"
          subColor="#a855f7"
        />
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' }}>Ticket Volume (30 days)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="b" style={{ background: 'rgba(59,130,246,.15)', color: '#3b82f6', border: 'none' }}>New</span>
              <span className="b" style={{ background: 'rgba(52,211,153,.15)', color: '#34d399', border: 'none' }}>Resolved</span>
            </div>
          </div>
          {loading ? <div style={{ height: 120, display: 'flex', alignItems: 'center', color: '#3d5378', fontSize: 13 }}>Loading…</div>
            : <VolumeChart data={s.daily_volume} />}
        </div>

        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>
            Category Breakdown
            <span className="b" style={{ marginLeft: 8, background: 'rgba(168,85,247,.15)', color: '#a855f7', border: 'none' }}>AI Classified</span>
          </div>
          {loading
            ? <div style={{ height: 140, display: 'flex', alignItems: 'center', color: '#3d5378', fontSize: 13 }}>Loading…</div>
            : <DonutChart data={s.category_breakdown} />}
        </div>
      </div>

      {/* ── CSAT / Best / Worst dept row ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14 }}>
        {/* CSAT placeholder */}
        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 8 }}>Overall CSAT Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#e2e8f0' }}>—</span>
            <span style={{ fontSize: 16, color: '#3d5378' }}>/5</span>
          </div>
          <div style={{ marginTop: 12, height: 4, background: '#101828', borderRadius: 4 }}>
            <div style={{ width: '0%', height: '100%', background: '#eab308', borderRadius: 4 }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: '#3d5378' }}>Enable CSAT module to track scores</div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 8 }}>Best Performing Dept</div>
          {loading ? <div style={{ color: '#3d5378' }}>…</div> : bestDept ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>{bestDept.dept_name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{bestDept.sla_compliance}% SLA compliance</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{bestDept.total} total tickets</div>
            </>
          ) : <div style={{ fontSize: 12, color: '#3d5378' }}>No department data</div>}
        </div>

        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 8 }}>Lowest Performing Dept</div>
          {loading ? <div style={{ color: '#3d5378' }}>…</div> : worstDept && worstDept !== bestDept ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>{worstDept.dept_name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{worstDept.sla_compliance}% SLA compliance</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{worstDept.open} open tickets</div>
            </>
          ) : <div style={{ fontSize: 12, color: '#3d5378' }}>No comparison data</div>}
        </div>
      </div>

      {/* ── Quick stats row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 8 }}>Avg Resolution Time</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#e2e8f0' }}>{loading ? '…' : s.avg_resolution_hours ?? '—'}</span>
            <span style={{ fontSize: 14, color: '#3d5378' }}>h</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#34d399', marginTop: 6 }}>Average hours to resolve</div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 8 }}>Tickets Reopened</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: s.tickets_reopened > 0 ? '#f97316' : '#e2e8f0' }}>
            {loading ? '…' : fmt(s.tickets_reopened ?? 0)}
          </div>
          <div style={{ fontSize: 11.5, color: '#3d5378', marginTop: 6 }}>Currently in reopened state</div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 8 }}>Pending Feedback</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: s.pending_feedback > 0 ? '#eab308' : '#e2e8f0' }}>
            {loading ? '…' : fmt(s.pending_feedback ?? 0)}
          </div>
          <div style={{ fontSize: 11.5, color: '#3d5378', marginTop: 6 }}>Awaiting user CSAT ratings</div>
        </div>
      </div>

      {/* ── Bottom: Active Incidents + Department Performance ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>

        {/* Active incidents table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' }}>Active Incidents</div>
            {(s.active_incidents ?? 0) > 0 && (
              <span className="b p1">{s.active_incidents} Critical</span>
            )}
          </div>
          {loading ? (
            <div style={{ color: '#3d5378', fontSize: 13 }}>Loading…</div>
          ) : !s.incidents_list?.length ? (
            <div style={{ color: '#3d5378', fontSize: 13 }}>No active incidents</div>
          ) : (
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {s.incidents_list.map(inc => (
                  <tr key={inc.ticket_id}>
                    <td className="bright">
                      <Link to={`/admin/ticket/${inc.ticket_id}`} style={{ color: '#a855f7', textDecoration: 'none', fontFamily: 'monospace' }}>
                        {inc.ticket_no}
                      </Link>
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.subject}</td>
                    <td>
                      <span className={`b p${inc.priority?.replace('P', '') || '3'}`}>
                        {PRIORITY_LABEL[inc.priority] || inc.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`b ${STATUS_BADGE[inc.status] || 's-pend'}`}>{inc.status}</span>
                    </td>
                    <td>{inc.assigned_team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Department performance */}
        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Department Performance</div>
          {loading
            ? <div style={{ color: '#3d5378', fontSize: 13 }}>Loading…</div>
            : <DeptPerformanceChart data={s.department_breakdown} />}
        </div>
      </div>

    </div>
  );
}
