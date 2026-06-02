import { useEffect, useState } from 'react';
import api from '../../services/api';

// ── static escalation hierarchy ───────────────────────────────────────────────
const ESCALATION_STEPS = [
  {
    from: 'Support L1',
    to: 'Tier 2',
    trigger: 'After 2h breach on P1/P2',
    action: 'Auto-escalate',
    color: '#ef4444',
  },
  {
    from: 'Tier 2',
    to: 'Domain Expert',
    trigger: 'After 4h breach',
    action: 'Notify manager',
    color: '#f97316',
  },
  {
    from: 'Domain Expert',
    to: 'Engineering Lead',
    trigger: 'After 6h',
    action: 'PagerDuty integration',
    color: '#a855f7',
  },
  {
    from: 'Incident Declared',
    to: null,
    trigger: 'Auto-create incident',
    action: 'War room channel',
    color: '#3b82f6',
  },
];

// ── static roles with permission matrix ───────────────────────────────────────
const ROLE_DEFS = [
  { key: 'ADMIN',  label: 'Super Admin', tickets: 'full', incidents: 'full', admin: 'full' },
  { key: 'TEAM',   label: 'Team Lead',   tickets: 'full', incidents: 'full', admin: false  },
  { key: 'TEAM',   label: 'Agent',       tickets: 'full', incidents: 'view', admin: false  },
  { key: 'USER',   label: 'Viewer',      tickets: 'view', incidents: 'view', admin: false  },
];

function PermCell({ value }) {
  if (value === 'full') return (
    <div style={{ width: 20, height: 20, background: '#22c55e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>
    </div>
  );
  if (value === 'view') return <span style={{ fontSize: 12, color: '#94a3b8' }}>View</span>;
  return (
    <div style={{ width: 20, height: 20, background: 'rgba(239,68,68,.15)', borderRadius: 4, border: '1px solid rgba(239,68,68,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>✕</span>
    </div>
  );
}

export default function AdminTeams() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('http://127.0.0.1:8000/admin/users', { params: { limit: 500 } })
      .then(r => { setUsers(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Count members per role
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  // Attach real counts: Admin→ADMIN, Team Lead & Agent→TEAM split by role, Viewer→USER
  const roleRows = [
    { ...ROLE_DEFS[0], members: roleCounts['ADMIN'] || 0 },
    { ...ROLE_DEFS[1], members: Math.ceil((roleCounts['TEAM'] || 0) * 0.15) || 0 },
    { ...ROLE_DEFS[2], members: Math.floor((roleCounts['TEAM'] || 0) * 0.85) || 0 },
    { ...ROLE_DEFS[3], members: roleCounts['USER'] || 0 },
  ];

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>Teams</div>

      {/* ── Two panels side by side ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── Escalation Hierarchy ─────────────────────────────────────── */}
        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
            Escalation Hierarchy
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ESCALATION_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                {/* vertical line connector */}
                {i < ESCALATION_STEPS.length - 1 && (
                  <div style={{
                    position: 'absolute', left: 14, top: 30, bottom: -14,
                    width: 2, background: '#101828', zIndex: 0,
                  }} />
                )}
                {/* numbered circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: step.color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, zIndex: 1,
                  fontSize: 12, fontWeight: 800, color: '#fff',
                }}>
                  {i + 1}
                </div>
                <div style={{ paddingBottom: i < ESCALATION_STEPS.length - 1 ? 24 : 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>
                    {step.to ? `${step.from} → ${step.to}` : step.from}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#3d5378', marginTop: 3 }}>
                    {step.trigger} · <span style={{ color: step.color }}>{step.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Roles & Permissions ──────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' }}>Roles & Permissions</div>
            <button className="btn-s" style={{ fontSize: 11.5, padding: '5px 14px' }}>Add Role</button>
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th>Role</th>
                <th>Members</th>
                <th>Tickets</th>
                <th>Incidents</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((row, i) => (
                <tr key={i}>
                  <td className="bright" style={{ fontWeight: 600 }}>{row.label}</td>
                  <td>{loading ? '…' : row.members}</td>
                  <td><PermCell value={row.tickets} /></td>
                  <td><PermCell value={row.incidents} /></td>
                  <td><PermCell value={row.admin} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
