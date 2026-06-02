import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchTickets, getMe, getMyCsatRecords } from '../../services/ticketService';

const NOTIF_KEY = 'nextdesk_notif_prefs';

function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}; }
  catch { return {}; }
}

function saveNotifPrefs(prefs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
}

function memberSince(isoDate) {
  if (!isoDate) return 'Member since —';
  const d = new Date(isoDate);
  return 'Member since ' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function avgResolutionHrs(tickets) {
  const resolved = tickets.filter(t => {
    const s = (t.status || '').toUpperCase();
    return ['RESOLVED', 'CLOSED', 'AI_RESOLVED', 'AI_RESOLVED_PENDING_USER_CONFIRMATION'].includes(s)
      && t.created_at && t.updated_at;
  });
  if (!resolved.length) return '—';
  const avgMs = resolved.reduce((s, t) =>
    s + (new Date(t.updated_at) - new Date(t.created_at)), 0) / resolved.length;
  const h = avgMs / 3600000;
  return h >= 1 ? `${h.toFixed(1)} hrs` : `${Math.round(h * 60)} min`;
}

function recentActivity(tickets) {
  const events = [];
  tickets.forEach(t => {
    const s = (t.status || '').toUpperCase();
    const isAI = s.includes('AI_RESOLVED') || t.resolution_type === 'AI_AUTO_RESOLVE';
    const isResolved = ['RESOLVED', 'CLOSED'].includes(s);

    if (isAI) {
      const conf = t.final_resolution_confidence ? ` (${Math.round(t.final_resolution_confidence)}% confidence)` : '';
      events.push({ dot: '#a855f7', text: `${t.ticket_no} AI auto-resolved${conf}`, time: t.updated_at || t.created_at });
    } else if (isResolved) {
      events.push({ dot: '#34d399', text: `${t.ticket_no} resolved — ${t.subject}`, time: t.updated_at || t.created_at });
    } else {
      events.push({ dot: '#4f8ef7', text: `Submitted ${t.ticket_no} — ${t.subject}`, time: t.created_at });
    }
  });
  return events
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '42px', height: '24px', borderRadius: '12px', flexShrink: 0,
        background: value ? '#4f8ef7' : '#0e1629',
        border: `1px solid ${value ? '#4f8ef7' : '#1e3047'}`,
        position: 'relative', cursor: 'pointer', transition: 'background .2s, border .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: value ? '19px' : '3px',
        width: '16px', height: '16px',
        borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.4)',
        transition: 'left .2s',
      }} />
    </div>
  );
}

function Profile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [csatList, setCsatList] = useState([]);
  const [notif, setNotif] = useState({ email: true, browser: true, sla: false, ...loadNotifPrefs() });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getMe(), fetchTickets(), getMyCsatRecords()]).then(([me, tr, cr]) => {
      if (!mounted) return;
      if (me.success) setProfile(me.user);
      if (tr.success) setTickets(tr.tickets || []);
      if (cr.success) setCsatList(cr.records || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const handleNotif = (key) => (val) => {
    const next = { ...notif, [key]: val };
    setNotif(next);
    saveNotifPrefs(next);
  };

  const name = profile?.full_name || authUser?.full_name || authUser?.email || 'User';
  const email = profile?.email || authUser?.email || '';
  const role = (profile?.role || authUser?.role || 'USER').toUpperCase();
  const initial = (name[0] || 'U').toUpperCase();
  const since = memberSince(profile?.created_at);
  const orgName = profile?.org_name || null;

  const roleBadgeLabel = role === 'ADMIN' ? 'Administrator' : role === 'TEAM' ? 'Team Member' : orgName ? `${orgName} User` : 'Enterprise User';

  // Stats
  const totalTickets = tickets.length;
  const resolvedCount = tickets.filter(t =>
    ['RESOLVED', 'CLOSED', 'AI_RESOLVED', 'AI_RESOLVED_PENDING_USER_CONFIRMATION'].includes((t.status || '').toUpperCase())
  ).length;
  const aiResolved = tickets.filter(t =>
    (t.status || '').toUpperCase().includes('AI_RESOLVED') || t.resolution_type === 'AI_AUTO_RESOLVE'
  ).length;
  const avgRes = loading ? '—' : avgResolutionHrs(tickets);
  const avgCsat = csatList.length
    ? (csatList.reduce((s, r) => s + r.rating, 0) / csatList.length).toFixed(1)
    : null;

  const activity = recentActivity(tickets);

  if (loading) {
    return <div className="page ff" style={{ color: '#3d5378', fontSize: '13px' }}>Loading…</div>;
  }

  return (
    <div className="page ff">
      <div style={{ marginBottom: '22px' }}>
        <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>My Profile</h1>
        <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '4px' }}>Account settings and preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: '14px', alignItems: 'start' }}>
        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Avatar card */}
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#7c4dff,#4f8ef7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700, color: '#fff',
              margin: '0 auto 12px',
            }}>{initial}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginBottom: '3px' }}>{name}</div>
            <div style={{ fontSize: '11.5px', color: '#3d5378', marginBottom: '10px' }}>{email}</div>
            <span style={{
              display: 'inline-block',
              background: 'rgba(124,77,255,.15)', border: '1px solid rgba(124,77,255,.3)',
              color: '#a78bfa', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
              padding: '3px 10px', marginBottom: '8px',
            }}>{roleBadgeLabel}</span>
            <div style={{ fontSize: '11px', color: '#1e3047', marginBottom: '14px' }}>{since}</div>
            <button className="btn-s" style={{ width: '100%', height: '32px', fontSize: '12px' }}>Edit Profile</button>
          </div>

          {/* Stats card */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '12px' }}>My Statistics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <StatRow label="Total Tickets" value={totalTickets} />
              <StatRow label="Resolved" value={resolvedCount} accent="#34d399" />
              <StatRow label="Avg Resolution" value={avgRes} />
              <StatRow label="CSAT Score" value={avgCsat
                ? <span><span style={{ color: '#facc15' }}>★</span> {avgCsat} <span style={{ color: '#1e3047' }}>/5</span></span>
                : <span style={{ color: '#2a3f5a' }}>—</span>} />
              <StatRow label="AI Resolved" value={aiResolved} accent="#a855f7" />
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Notification Preferences */}
          <div className="card">
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '18px' }}>Notification Preferences</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <NotifRow
                label="Email Notifications"
                desc="All ticket status changes and assignments"
                value={notif.email}
                onChange={handleNotif('email')}
              />
              <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
              <NotifRow
                label="Browser Push"
                desc="Critical P1/P2 alerts in real-time"
                value={notif.browser}
                onChange={handleNotif('browser')}
              />
              <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
              <NotifRow
                label="SLA Breach Alerts"
                desc="Notify when ticket approaches SLA deadline"
                value={notif.sla}
                onChange={handleNotif('sla')}
              />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' }}>Recent Activity</div>
            {activity.length === 0 ? (
              <div style={{ fontSize: '12.5px', color: '#2a3f5a' }}>No recent activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {activity.map((ev, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: ev.dot, flexShrink: 0, marginTop: '5px',
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12.5px', color: '#c9d8ee' }}>{ev.text}</div>
                        <div style={{ fontSize: '11px', color: '#2a3f5a', marginTop: '2px' }}>{timeAgo(ev.time)}</div>
                      </div>
                    </div>
                    {i < activity.length - 1 && <div style={{ height: '1px', background: '#0a1020', marginLeft: '18px' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', color: '#3d5378' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: accent || '#e2e8f0' }}>{value}</span>
    </div>
  );
}

function NotifRow({ label, desc, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#c9d8ee', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '11.5px', color: '#3d5378' }}>{desc}</div>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

export default Profile;
