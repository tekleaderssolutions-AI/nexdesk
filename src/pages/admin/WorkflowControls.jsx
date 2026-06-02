import { useEffect, useState } from 'react';
import { getSLARules, updateSLARule } from '../../services/ticketService';

function fmtMinutes(min) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${(min / 60).toFixed(min % 60 === 0 ? 0 : 1)} hrs`;
  const days = min / 1440;
  return `${days % 1 === 0 ? days : days.toFixed(1)} day${days === 1 ? '' : 's'}`;
}

const PRIORITY_COLORS = { P1: '#f87171', P2: '#fb923c', P3: '#facc15', P4: '#4f8ef7', P5: '#94a3b8' };

function SLARow({ rule, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [frMin, setFrMin] = useState(rule.first_response_minutes);
  const [resMin, setResMin] = useState(rule.resolution_minutes);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    const fr = parseInt(frMin, 10);
    const res = parseInt(resMin, 10);
    if (!fr || fr <= 0 || !res || res <= 0) { setErr('Must be positive integers'); return; }
    if (fr >= res) { setErr('First response must be less than resolution time'); return; }
    setSaving(true);
    setErr('');
    const r = await updateSLARule(rule.id, { first_response_minutes: fr, resolution_minutes: res });
    setSaving(false);
    if (r.success) { onSaved(r.rule); setEditing(false); }
    else setErr('Save failed. Try again.');
  };

  const handleCancel = () => {
    setFrMin(rule.first_response_minutes);
    setResMin(rule.resolution_minutes);
    setErr('');
    setEditing(false);
  };

  const color = PRIORITY_COLORS[rule.priority_code] || '#94a3b8';

  return (
    <tr>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color, fontWeight: 700, fontSize: '13px' }}>{rule.priority_code}</span>
          <span style={{ color: '#3d5378', fontSize: '11.5px' }}>{rule.priority_name}</span>
        </span>
      </td>
      <td>
        {editing ? (
          <input
            className="inp"
            type="number"
            min={1}
            value={frMin}
            onChange={e => setFrMin(e.target.value)}
            style={{ width: '90px', padding: '5px 8px', fontSize: '12px' }}
          />
        ) : (
          <span style={{ color: '#c9d8ee', fontSize: '13px' }}>{fmtMinutes(rule.first_response_minutes)}</span>
        )}
        {!editing && <span style={{ color: '#2a3f5a', fontSize: '11px', marginLeft: '6px' }}>({rule.first_response_minutes} min)</span>}
      </td>
      <td>
        {editing ? (
          <input
            className="inp"
            type="number"
            min={1}
            value={resMin}
            onChange={e => setResMin(e.target.value)}
            style={{ width: '90px', padding: '5px 8px', fontSize: '12px' }}
          />
        ) : (
          <span style={{ color: '#c9d8ee', fontSize: '13px' }}>{fmtMinutes(rule.resolution_minutes)}</span>
        )}
        {!editing && <span style={{ color: '#2a3f5a', fontSize: '11px', marginLeft: '6px' }}>({rule.resolution_minutes} min)</span>}
      </td>
      <td>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700,
          background: rule.is_active ? 'rgba(52,211,153,.12)' : 'rgba(100,116,139,.12)',
          color: rule.is_active ? '#34d399' : '#64748b',
        }}>
          {rule.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {editing ? (
            <>
              <button
                className="btn-p"
                onClick={handleSave}
                disabled={saving}
                style={{ height: '28px', padding: '0 12px', fontSize: '11.5px' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                className="btn-s"
                onClick={handleCancel}
                style={{ height: '28px', padding: '0 12px', fontSize: '11.5px' }}
              >
                Cancel
              </button>
              {err && <span style={{ color: '#f87171', fontSize: '11px' }}>{err}</span>}
            </>
          ) : (
            <button
              className="btn-s"
              onClick={() => setEditing(true)}
              style={{ height: '28px', padding: '0 12px', fontSize: '11.5px' }}
            >
              Edit
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function WorkflowControls() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSLARules().then(r => {
      if (r.success) setRules(r.rules);
      setLoading(false);
    });
  }, []);

  const handleSaved = (updated) => {
    setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  return (
    <div className="page ff">
      <div style={{ marginBottom: '24px' }}>
        <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0' }}>Workflow Controls</h1>
        <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '3px' }}>
          AI pipeline configuration, SLA rules, and automation policies.
        </p>
      </div>

      {/* AI Pipeline summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Auto-Resolve Eligible', sub: 'P3 / P4 / P5 priority', color: '#34d399' },
          { label: 'Confidence Threshold', sub: '≥ 70–75% for AI resolution', color: '#4f8ef7' },
          { label: 'P1 / P2 Policy', sub: 'Always routed to team', color: '#f87171' },
        ].map((item) => (
          <div key={item.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: item.color }}>{item.label}</div>
            <div style={{ fontSize: '11.5px', color: '#3d5378', marginTop: '4px' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* AI Pipeline details */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '10px' }}>AI Pipeline — Live Mode</div>
        <div style={{ fontSize: '12px', color: '#3d5378', lineHeight: '1.8' }}>
          <div>• KB similarity search runs automatically when each ticket is submitted.</div>
          <div>• P4/P5 tickets scoring ≥ 75% / 70% confidence are moved to <span style={{ color: '#a855f7' }}>AI Solution Ready</span> immediately.</div>
          <div>• P3 tickets scoring ≥ 65% go to <span style={{ color: '#4f8ef7' }}>AI Team Review</span> for agent approval before delivery.</div>
          <div>• P1 and P2 tickets bypass AI resolution and are always routed to a team.</div>
          <div>• Users accept or reject the AI solution — rejection reopens the ticket for team handling.</div>
        </div>
      </div>

      {/* SLA Rules */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>SLA Rules</div>
            <div style={{ fontSize: '11.5px', color: '#3d5378', marginTop: '2px' }}>
              First response and resolution time targets per priority level. Click Edit to update.
            </div>
          </div>
          {loading && <span style={{ fontSize: '12px', color: '#3d5378' }}>Loading…</span>}
        </div>

        {!loading && rules.length === 0 ? (
          <div style={{ fontSize: '12.5px', color: '#2a3f5a', padding: '12px 0' }}>
            No SLA rules found in the database. Ensure priority_master and sla_rules tables are seeded.
          </div>
        ) : (
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Priority</th>
                <th>First Response</th>
                <th>Resolution Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <SLARow key={rule.id} rule={rule} onSaved={handleSaved} />
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(79,142,247,.06)', borderRadius: '8px', border: '1px solid rgba(79,142,247,.12)' }}>
          <div style={{ fontSize: '11.5px', color: '#3d5378', lineHeight: '1.7' }}>
            <span style={{ color: '#4f8ef7', fontWeight: 600 }}>Note: </span>
            SLA deadlines are calculated from ticket creation time. Tickets are flagged as{' '}
            <span style={{ color: '#fb923c' }}>At Risk</span> at 80% elapsed and{' '}
            <span style={{ color: '#f87171' }}>Breached</span> after the resolution deadline.
            Changes take effect immediately on all open tickets.
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowControls;
