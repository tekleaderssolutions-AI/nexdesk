import { useMemo } from 'react';
import tickets from '../../data/sampleTickets';

function UserDashboard() {
  const totals = useMemo(() => {
    const open = tickets.filter((ticket) => ['Open', 'In Progress', 'Escalated'].includes(ticket.status)).length;
    const inProgress = tickets.filter((ticket) => ticket.status === 'In Progress').length;
    const resolved = tickets.filter((ticket) => ticket.status === 'Resolved').length;
    const aiResolved = tickets.filter((ticket) => ticket.status === 'AI Resolved').length;
    return { total: tickets.length, open, inProgress, resolved, aiResolved };
  }, []);

  return (
    <div className="page ff">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0' }}>User Dashboard</h1>
          <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '3px' }}>Overview of your open tickets, AI insights, and recent activity.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-s">Refresh</button>
          <button type="button" className="btn-p">New Ticket</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="stat" style={{ borderTop: '2px solid #4f8ef7' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px' }}>Total tickets</div>
          <div className="ff" style={{ fontSize: '28px', fontWeight: 800, color: '#e2e8f0' }}>{totals.total}</div>
          <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>↗ +6% vs last week</div>
          <div className="pbar" style={{ marginTop: '10px' }}><div className="pfill" style={{ width: '72%', background: '#4f8ef7' }} /></div>
        </div>
        <div className="stat" style={{ borderTop: '2px solid #fbbf24' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px' }}>In progress</div>
          <div className="ff" style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24' }}>{totals.inProgress}</div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '4px' }}>Active SLA tickets</div>
          <div className="pbar" style={{ marginTop: '10px' }}><div className="pfill" style={{ width: `${Math.min(100, (totals.inProgress / totals.total) * 100)}%`, background: '#fbbf24' }} /></div>
        </div>
        <div className="stat" style={{ borderTop: '2px solid #34d399' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px' }}>Resolved</div>
          <div className="ff" style={{ fontSize: '28px', fontWeight: 800, color: '#34d399' }}>{totals.resolved}</div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '4px' }}>Closed tickets</div>
          <div className="pbar" style={{ marginTop: '10px' }}><div className="pfill" style={{ width: `${Math.min(100, (totals.resolved / totals.total) * 100)}%`, background: '#34d399' }} /></div>
        </div>
        <div className="stat" style={{ borderTop: '2px solid #a855f7' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px' }}>AI Resolved</div>
          <div className="ff" style={{ fontSize: '28px', fontWeight: 800, color: '#a855f7' }}>{totals.aiResolved}</div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '4px' }}>AI-assisted closures</div>
          <div className="pbar" style={{ marginTop: '10px' }}><div className="pfill" style={{ width: `${Math.min(100, (totals.aiResolved / totals.total) * 100)}%`, background: '#a855f7' }} /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '14px', marginBottom: '20px' }}>
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>Recent Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { dot: '#ef4444', title: 'TKT-0001 escalated to Critical', subtitle: 'Server cluster outage · 2 min ago' },
              { dot: '#fbbf24', title: 'TKT-0003 moved to In Progress', subtitle: 'Payments team assigned · 18 min ago' },
              { dot: '#a78bfa', title: 'TKT-0005 AI auto-resolved (94%)', subtitle: 'Email notifications delay · 1 hr ago' },
              { dot: '#34d399', title: 'TKT-0007 resolved by Product Team', subtitle: 'Profile picture upload fix · 3 hrs ago' },
              { dot: '#4f8ef7', title: 'TKT-0008 linked to INC-0012', subtitle: 'DB replication → incident cluster · 4 hrs ago' },
            ].map((item) => (
              <div key={item.title} className="tl-item">
                <div className="tl-dot" style={{ background: item.dot }} />
                <div style={{ fontSize: '12.5px', color: '#c9d8ee', fontWeight: 500 }}>{item.title}</div>
                <div style={{ fontSize: '11.5px', color: '#3d5378', marginTop: '2px' }}>{item.subtitle}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>My tickets</div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {tickets.slice(0, 4).map((ticket) => (
              <div key={ticket.id} style={{ padding: '14px', borderRadius: '14px', background: '#090d1a', border: '1px solid #101828' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f8ef7' }}>{ticket.id}</div>
                    <div style={{ fontSize: '12.5px', color: '#c9d8ee', marginTop: '6px' }}>{ticket.title}</div>
                  </div>
                  <span className="b" style={{ borderColor: ticket.priority.includes('P1') ? 'rgba(239,68,68,.22)' : ticket.priority.includes('P2') ? 'rgba(249,115,22,.22)' : ticket.priority.includes('P3') ? 'rgba(234,179,8,.22)' : 'rgba(100,116,139,.18)' }}>{ticket.priority}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#3d5378' }}>{ticket.category}</div>
                  <div style={{ fontSize: '12px', color: '#3d5378' }}>{ticket.assignee}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;
