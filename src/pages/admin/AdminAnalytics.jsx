import { useEffect, useState, useMemo } from 'react';
import { fetchAdminAnalytics, fetchOrgStructure } from '../../services/ticketService';

// ── helpers ────────────────────────────────────────────────────────────────────
const PRI_COLOR = { P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#3b82f6', P5: '#6b7280' };
const STATUS_COLOR = {
  OPEN: '#3b82f6', IN_PROGRESS: '#eab308', RESOLVED: '#34d399', CLOSED: '#34d399',
  ESCALATED: '#ef4444', REOPENED: '#f97316',
};

function HBar({ label, count, pct, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 120, fontSize: 12, color: '#94a3b8', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, background: '#101828', borderRadius: 4, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || '#3b82f6', borderRadius: 4, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 12, color: '#e2e8f0', minWidth: 36, textAlign: 'right' }}>{count}</div>
      <div style={{ fontSize: 11, color: '#3d5378', minWidth: 38, textAlign: 'right' }}>{pct}%</div>
    </div>
  );
}

function CSATDist({ distribution }) {
  if (!distribution) return null;
  const max = Math.max(...Object.values(distribution), 1);
  const COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#34d399', 5: '#22c55e' };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
      {[1, 2, 3, 4, 5].map(r => {
        const h = Math.max((distribution[r] || 0) / max * 52, 3);
        return (
          <div key={r} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{distribution[r] || 0}</div>
            <div style={{ width: '100%', height: h, background: COLORS[r], borderRadius: 3 }} />
            <div style={{ fontSize: 10, color: '#3d5378' }}>{r}★</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>{children}</div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [structure, setStructure] = useState({ departments: [] });
  const [deptId, setDeptId]     = useState('');
  const [teamId, setTeamId]     = useState('');
  const [memberId, setMemberId] = useState('');
  const [days, setDays]         = useState(90);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [structLoading, setStructLoading] = useState(true);

  // Load org structure once
  useEffect(() => {
    fetchOrgStructure().then(r => {
      if (r.success) setStructure(r.data);
      setStructLoading(false);
    });
  }, []);

  // Load analytics whenever filters change
  useEffect(() => {
    setLoading(true);
    fetchAdminAnalytics({ deptId: deptId || null, teamId: teamId || null, memberId: memberId || null, days }).then(r => {
      if (r.success) setData(r.data);
      setLoading(false);
    });
  }, [deptId, teamId, memberId, days]);

  // Derived filter lists
  const selectedDept = structure.departments.find(d => d.id === deptId);
  const teamsForDept = selectedDept?.teams || [];
  const selectedTeam = teamsForDept.find(t => t.id === teamId);
  const membersForTeam = selectedTeam?.members || [];

  const d = data || {};

  const scopeLabel = memberId
    ? (membersForTeam.find(m => m.user_id === memberId)?.full_name || 'Member')
    : teamId
    ? (selectedTeam?.name || 'Team')
    : deptId
    ? (selectedDept?.name || 'Department')
    : 'All Departments';

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>Analytics</div>
          <div style={{ fontSize: 12, color: '#3d5378', marginTop: 3 }}>
            Drill down by department → team → member
          </div>
        </div>
        <select className="sel" style={{ fontSize: 12, padding: '6px 10px' }}
          value={days} onChange={e => setDays(+e.target.value)}>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={180}>Last 6 Months</option>
          <option value={365}>Last Year</option>
        </select>
      </div>

      {/* ── Drill-down filter bar ───────────────────────────────────────── */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Department — main filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>Department</label>
            <select className="sel" style={{ fontSize: 12.5, minWidth: 160 }}
              value={deptId} onChange={e => { setDeptId(e.target.value); setTeamId(''); setMemberId(''); }}>
              <option value="">All Departments</option>
              {structure.departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Arrow separator */}
          <div style={{ color: '#3d5378', fontSize: 16, marginTop: 18 }}>›</div>

          {/* Team — secondary filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: deptId ? '#3d5378' : '#1e2d40', fontWeight: 600 }}>Team</label>
            <select className="sel" style={{ fontSize: 12.5, minWidth: 140, opacity: deptId ? 1 : 0.4 }}
              disabled={!deptId} value={teamId} onChange={e => { setTeamId(e.target.value); setMemberId(''); }}>
              <option value="">All Teams</option>
              {teamsForDept.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={{ color: '#3d5378', fontSize: 16, marginTop: 18 }}>›</div>

          {/* Member — tertiary filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: teamId ? '#3d5378' : '#1e2d40', fontWeight: 600 }}>Member</label>
            <select className="sel" style={{ fontSize: 12.5, minWidth: 140, opacity: teamId ? 1 : 0.4 }}
              disabled={!teamId} value={memberId} onChange={e => setMemberId(e.target.value)}>
              <option value="">All Members</option>
              {membersForTeam.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#a855f7', fontWeight: 600 }}>Showing: {scopeLabel}</span>
            {(deptId || teamId || memberId) && (
              <button className="btn-s" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => { setDeptId(''); setTeamId(''); setMemberId(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Top KPI row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Total Tickets', value: loading ? '…' : d.total_tickets ?? 0, sub: `${d.resolved_pct ?? 0}% resolved`, color: '#e2e8f0' },
          { label: 'CSAT Avg', value: loading ? '…' : d.csat?.avg ? `${d.csat.avg}/5` : '—', sub: `${d.csat?.satisfaction_rate ?? 0}% satisfaction`, color: '#eab308' },
          { label: 'Avg Resolve Time', value: loading ? '…' : d.time_to_resolve?.overall_avg_h ? `${d.time_to_resolve.overall_avg_h}h` : '—', sub: 'Average hours to resolve', color: '#3b82f6' },
          { label: 'Low Satisfaction', value: loading ? '…' : d.csat?.low_count ?? 0, sub: 'Rated 1–2 stars', color: '#ef4444' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3d5378', fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 11.5, color: '#3d5378' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#3d5378', fontSize: 13 }}>Loading analytics…</div>
      )}

      {!loading && d.total_tickets === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#3d5378', fontSize: 13 }}>
          No tickets found for the selected scope and time period.
        </div>
      )}

      {!loading && d.total_tickets > 0 && (
        <>
          {/* ── Category + Priority row ───────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>

            <div className="card">
              <SectionTitle>Category Breakdown</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(d.category_breakdown || []).slice(0, 8).map((c, i) => (
                  <HBar key={c.category} label={c.category} count={c.count} pct={c.pct}
                    color={['#3b82f6','#a855f7','#34d399','#f97316','#eab308','#06b6d4','#ec4899','#ef4444'][i % 8]} />
                ))}
                {!d.category_breakdown?.length && <div style={{ color: '#3d5378', fontSize: 12 }}>No data</div>}
              </div>
            </div>

            <div className="card">
              <SectionTitle>Priority Distribution</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(d.priority_breakdown || []).map(p => (
                  <HBar key={p.priority} label={p.priority} count={p.count} pct={p.pct} color={PRI_COLOR[p.priority]} />
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <SectionTitle>Avg Resolve Time by Priority</SectionTitle>
                {Object.keys(d.time_to_resolve?.by_priority || {}).length === 0
                  ? <div style={{ fontSize: 12, color: '#3d5378' }}>No resolved tickets</div>
                  : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(d.time_to_resolve?.by_priority || {}).sort().map(([p, h]) => (
                      <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#090d1a', borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: PRI_COLOR[p] || '#e2e8f0', fontWeight: 600 }}>{p}</span>
                        <span style={{ fontSize: 12, color: '#e2e8f0' }}>{h}h avg</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Subcategory + CSAT row ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>

            <div className="card">
              <SectionTitle>Subcategory Breakdown</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(d.subcategory_breakdown || []).slice(0, 8).map((s, i) => (
                  <HBar key={s.subcategory} label={s.subcategory} count={s.count} pct={s.pct}
                    color={['#06b6d4','#a855f7','#34d399','#f97316','#3b82f6','#eab308','#ec4899','#ef4444'][i % 8]} />
                ))}
                {!d.subcategory_breakdown?.length && <div style={{ color: '#3d5378', fontSize: 12 }}>No subcategory data</div>}
              </div>
            </div>

            <div className="card">
              <SectionTitle>CSAT Distribution</SectionTitle>
              {d.csat?.total > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#eab308' }}>{d.csat.avg}/5</div>
                      <div style={{ fontSize: 11, color: '#3d5378' }}>{d.csat.total} responses</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>{d.csat.satisfaction_rate}%</div>
                      <div style={{ fontSize: 11, color: '#3d5378' }}>Satisfied (4-5★)</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{d.csat.low_count}</div>
                      <div style={{ fontSize: 11, color: '#3d5378' }}>Low (1-2★)</div>
                    </div>
                  </div>
                  <CSATDist distribution={d.csat.distribution} />
                </>
              ) : (
                <div style={{ color: '#3d5378', fontSize: 12 }}>No CSAT data for this scope</div>
              )}

              <div style={{ marginTop: 20 }}>
                <SectionTitle>Status Breakdown</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(d.status_breakdown || []).slice(0, 5).map(s => (
                    <HBar key={s.status} label={s.status} count={s.count} pct={s.pct} color={STATUS_COLOR[s.status] || '#3b82f6'} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── User Stats table ─────────────────────────────────────── */}
          {d.user_stats?.length > 0 && (
            <div className="card">
              <SectionTitle>User-wise Stats (Ticket Creators)</SectionTitle>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Tickets Submitted</th>
                    <th>Avg CSAT</th>
                    <th>Reopened</th>
                    <th>Reopen Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {d.user_stats.map(u => {
                    const reopenRate = u.tickets > 0 ? Math.round(u.reopened / u.tickets * 100) : 0;
                    return (
                      <tr key={u.user_id}>
                        <td className="bright">{u.name}</td>
                        <td>{u.tickets}</td>
                        <td>
                          {u.avg_csat != null
                            ? <span style={{ color: u.avg_csat >= 4 ? '#34d399' : u.avg_csat >= 3 ? '#eab308' : '#ef4444', fontWeight: 600 }}>
                                {u.avg_csat}/5
                              </span>
                            : <span style={{ color: '#3d5378' }}>—</span>}
                        </td>
                        <td>{u.reopened}</td>
                        <td>
                          <span style={{ color: reopenRate >= 20 ? '#ef4444' : reopenRate >= 10 ? '#eab308' : '#34d399', fontSize: 12 }}>
                            {reopenRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
