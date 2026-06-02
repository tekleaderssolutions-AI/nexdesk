import { useEffect, useState } from 'react';
import { fetchAdminCSATAnalytics } from '../../services/ticketService';

const SEVERITY_STYLE = {
  critical: { bg: 'rgba(239,68,68,.12)', color: '#ef4444', label: 'Critical' },
  high:     { bg: 'rgba(249,115,22,.12)', color: '#f97316', label: 'High' },
  medium:   { bg: 'rgba(234,179,8,.12)',  color: '#eab308', label: 'Medium' },
};

// ── mini bar chart for rating distribution ─────────────────────────────────────
function RatingBar({ distribution }) {
  const max = Math.max(...Object.values(distribution), 1);
  const COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#34d399', 5: '#22c55e' };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
      {[1, 2, 3, 4, 5].map(r => {
        const h = Math.max((distribution[r] || 0) / max * 40, 3);
        return (
          <div key={r} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', height: h, background: COLORS[r], borderRadius: 3 }} />
            <div style={{ fontSize: 10, color: '#3d5378' }}>{r}★</div>
          </div>
        );
      })}
    </div>
  );
}

// ── SVG trend line chart ────────────────────────────────────────────────────────
function TrendChart({ data }) {
  const W = 500, H = 100, PAD = 12;
  if (!data || data.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d5378', fontSize: 12 }}>
      Not enough data
    </div>
  );
  const vals = data.map(d => d.avg);
  const min = Math.max(Math.min(...vals) - 0.5, 0);
  const max = Math.min(Math.max(...vals) + 0.5, 5);
  const xStep = (W - PAD * 2) / (data.length - 1);
  const yScale = (H - PAD * 2) / (max - min);

  const points = data.map((d, i) => {
    const x = PAD + i * xStep;
    const y = H - PAD - (d.avg - min) * yScale;
    return [x, y];
  });
  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaD = lineD + ` L${points[points.length - 1][0]},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <path d={areaD} fill="rgba(234,179,8,.1)" />
        <path d={lineD} fill="none" stroke="#eab308" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#eab308" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {data.map(d => (
          <div key={d.month} style={{ fontSize: 10, color: '#3d5378', textAlign: 'center' }}>{d.month}</div>
        ))}
      </div>
    </div>
  );
}

// ── dept/team CSAT horizontal bars ─────────────────────────────────────────────
function DeptCSATBars({ data }) {
  if (!data || data.length === 0) return <div style={{ color: '#3d5378', fontSize: 12 }}>No data</div>;
  const COLORS = ['#34d399', '#3b82f6', '#a855f7', '#f97316', '#eab308', '#06b6d4'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={d.dept_name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: '#94a3b8', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.dept_name}
          </div>
          <div style={{ flex: 1, background: '#101828', borderRadius: 4, height: 8 }}>
            <div style={{ width: `${(d.avg / 5) * 100}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: '#e2e8f0', minWidth: 32, textAlign: 'right' }}>{d.avg}/5</div>
        </div>
      ))}
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function CSATAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [ratingFilter, setRatingFilter] = useState('');

  const load = (d, r) => {
    setLoading(true);
    fetchAdminCSATAnalytics({ days: d, rating: r || null }).then(res => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(days, ratingFilter); }, []);

  const d = data || {};

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>CSAT Analytics</div>
          <div style={{ fontSize: 12, color: '#3d5378', marginTop: 3 }}>Enterprise customer satisfaction reporting & department performance</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="sel" style={{ fontSize: 12, padding: '6px 10px' }}
            value={days} onChange={e => { setDays(+e.target.value); load(+e.target.value, ratingFilter); }}>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={180}>Last 6 Months</option>
          </select>
          <select className="sel" style={{ fontSize: 12, padding: '6px 10px' }}
            value={ratingFilter} onChange={e => { setRatingFilter(e.target.value); load(days, e.target.value); }}>
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
          <button className="btn-s" style={{ fontSize: 12, padding: '6px 14px' }}>Export</button>
        </div>
      </div>

      {/* ── 4 KPI cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>

        {/* Overall CSAT */}
        <div className="card">
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>Overall CSAT</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0 6px' }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: '#eab308' }}>{loading ? '…' : d.avg_csat ?? '—'}</span>
            <span style={{ fontSize: 14, color: '#3d5378' }}>/5</span>
          </div>
          <div style={{ height: 4, background: '#101828', borderRadius: 4, marginBottom: 8 }}>
            <div style={{ width: `${(d.avg_csat || 0) / 5 * 100}%`, height: '100%', background: '#eab308', borderRadius: 4 }} />
          </div>
          {!loading && d.rating_distribution && <RatingBar distribution={d.rating_distribution} />}
        </div>

        {/* Satisfaction Rate */}
        <div className="card">
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>Satisfaction Rate</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#34d399', margin: '8px 0 4px' }}>
            {loading ? '…' : `${d.satisfaction_rate ?? '—'}%`}
          </div>
          <div style={{ fontSize: 11.5, color: '#34d399' }}>Rated 4–5 stars</div>
          <div style={{ fontSize: 11, color: '#3d5378', marginTop: 4 }}>{d.total_rated ?? 0} total responses</div>
        </div>

        {/* Reopen Rate */}
        <div className="card">
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>Reopen Rate</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: (d.reopen_rate ?? 0) >= 8 ? '#ef4444' : '#eab308', margin: '8px 0 4px' }}>
            {loading ? '…' : `${d.reopen_rate ?? '—'}%`}
          </div>
          <div style={{ fontSize: 11.5, color: (d.reopen_rate ?? 0) >= 8 ? '#ef4444' : '#3d5378' }}>
            {(d.reopen_rate ?? 0) >= 8 ? '⚠ Watch closely' : 'Within threshold'}
          </div>
        </div>

        {/* Low Satisfaction */}
        <div className="card">
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>Low Satisfaction</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#ef4444', margin: '8px 0 4px' }}>
            {loading ? '…' : d.low_satisfaction_count ?? '—'}
          </div>
          <div style={{ fontSize: 11.5, color: '#ef4444' }}>Rated 1–2 stars this period</div>
        </div>
      </div>

      {/* ── Low Satisfaction Alerts ─────────────────────────────────────── */}
      {!loading && d.alerts?.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' }}>Low Satisfaction Alerts</span>
            </div>
            <span className="b" style={{ background: 'rgba(239,68,68,.15)', color: '#ef4444', border: 'none' }}>Needs Attention</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.alerts.map((alert, i) => {
              const sty = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.medium;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#090d1a', borderRadius: 10, border: '1px solid #101828' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sty.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{alert.title}</div>
                    <div style={{ fontSize: 11.5, color: '#3d5378', marginTop: 2 }}>{alert.description}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: sty.bg, color: sty.color, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {sty.label}
                  </span>
                  <button className="btn-s" style={{ fontSize: 11, padding: '4px 12px', flexShrink: 0 }}>
                    {alert.action === 'view' ? 'View Tickets' : 'Review'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Charts row: Monthly Trend + Dept CSAT ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' }}>Monthly Satisfaction Trend</div>
            <span className="b" style={{ background: 'rgba(59,130,246,.15)', color: '#3b82f6', border: 'none' }}>
              {days >= 180 ? '6 months' : days >= 90 ? '3 months' : '30 days'}
            </span>
          </div>
          {loading ? <div style={{ height: 100, display: 'flex', alignItems: 'center', color: '#3d5378', fontSize: 12 }}>Loading…</div>
            : <TrendChart data={d.monthly_trend} />}
        </div>

        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Department CSAT Scores</div>
          {loading ? <div style={{ color: '#3d5378', fontSize: 12 }}>Loading…</div>
            : <DeptCSATBars data={d.dept_csat} />}
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 10 }}>Resolution Time Trend</div>
          <div style={{ color: '#3d5378', fontSize: 12 }}>See Analytics page for resolution time breakdown</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 10 }}>Reopen Trend</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: (d.reopen_rate ?? 0) >= 8 ? '#ef4444' : '#e2e8f0' }}>
              {loading ? '…' : `${d.reopen_rate ?? 0}%`}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: '#3d5378', marginTop: 4 }}>Over selected period</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600, marginBottom: 10 }}>Ticket Volume vs Satisfaction</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>{loading ? '…' : d.total_rated ?? 0}</div>
              <div style={{ fontSize: 11, color: '#3d5378' }}>Rated tickets</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399' }}>{loading ? '…' : `${d.satisfaction_rate ?? 0}%`}</div>
              <div style={{ fontSize: 11, color: '#3d5378' }}>Satisfied</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Department CSAT Performance table ───────────────────────────── */}
      {!loading && d.dept_csat?.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Department CSAT Performance</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Department</th>
                <th>Avg Score</th>
                <th>Responses</th>
                <th>Satisfaction Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...d.dept_csat].sort((a, b) => b.avg - a.avg).map(dept => {
                const satRate = dept.count > 0 ? Math.round((dept.avg / 5) * 100) : 0;
                const status = dept.avg >= 4 ? { label: 'Good', cls: 's-res' } :
                               dept.avg >= 3 ? { label: 'Average', cls: 's-pend' } :
                               { label: 'Poor', cls: 's-esc' };
                return (
                  <tr key={dept.dept_name}>
                    <td className="bright">{dept.dept_name}</td>
                    <td>
                      <span style={{ color: dept.avg >= 4 ? '#34d399' : dept.avg >= 3 ? '#eab308' : '#ef4444', fontWeight: 700 }}>
                        {dept.avg}/5
                      </span>
                    </td>
                    <td>{dept.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#101828', borderRadius: 3, height: 6 }}>
                          <div style={{ width: `${satRate}%`, height: '100%', background: dept.avg >= 4 ? '#34d399' : dept.avg >= 3 ? '#eab308' : '#ef4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 32 }}>{satRate}%</span>
                      </div>
                    </td>
                    <td><span className={`b ${status.cls}`}>{status.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
