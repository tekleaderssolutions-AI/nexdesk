import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function Topbar({ portalLabel }) {
  const { logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = useMemo(
    () => [
      {
        title: 'TKT-0001 SLA breach in 8 min',
        subtitle: 'Server cluster outage · P1',
        time: 'Just now',
        color: '#ef4444',
      },
      {
        title: 'INC-0004 new child ticket linked',
        subtitle: 'DB replication failure · 3 affected',
        time: '5 min ago',
        color: '#fbbf24',
      },
      {
        title: 'AI resolved TKT-0009 (96% conf)',
        subtitle: 'Email delay issue auto-closed',
        time: '22 min ago',
        color: '#a78bfa',
      },
      {
        title: 'TKT-0006 escalated to you',
        subtitle: 'Transferred from Rahul · Dashboard issue',
        time: '1 hr ago',
        color: '#34d399',
      },
    ],
    []
  );

  return (
    <header className="topbar">
      <div className="topbar-search">
        <svg className="i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input className="inp" placeholder="Search tickets, incidents…" />
      </div>

      <div className="topbar-actions">
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="icon-btn"
            title="Notifications"
            onClick={() => setShowNotifications((current) => !current)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={{ position: 'absolute', top: 1, right: 1, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #07090f' }} />
          </button>
          {showNotifications && (
            <div className="notif-dd">
              <div className="notif-header">
                <span>Notifications</span>
                <span className="notif-action">Mark all read</span>
              </div>
              {notifications.map((item) => (
                <div key={item.title} className="notif-item">
                  <div className="dot" style={{ background: item.color }} />
                  <div className="content">
                    <div className="title">{item.title}</div>
                    <div className="subtitle">{item.subtitle}</div>
                    <div className="time">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="icon-btn" title="Sign out" onClick={logout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
        </button>
        <div className="portal-tag">{portalLabel}</div>
      </div>
    </header>
  );
}

export default Topbar;
