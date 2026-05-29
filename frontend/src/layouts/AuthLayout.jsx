import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="bg-layer" />
      <div className="grid-bg" />
      <div className="noise" />
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      <div className="side-panel">
        <div className="sp-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
          Enterprise Grade
        </div>
        <div className="sp-headline">
          Support operations,<br />
          <span>intelligently automated.</span>
        </div>
        <div className="sp-sub">
          NexDesk unifies your helpdesk, incident management, and CSAT analytics into one platform your teams will love.
        </div>

        <div className="feature-list">
          <div className="feature-item">
            <div className="feat-icon" style={{ background: 'rgba(59,111,255,.12)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>
            </div>
            <span className="feat-text">AI-powered ticket triage & auto-resolution</span>
          </div>
          <div className="feature-item">
            <div className="feat-icon" style={{ background: 'rgba(52,211,153,.1)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <span className="feat-text">Real-time CSAT analytics & team reporting</span>
          </div>
          <div className="feature-item">
            <div className="feat-icon" style={{ background: 'rgba(167,139,250,.1)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span className="feat-text">Multi-team SLA management & escalation</span>
          </div>
        </div>

        <div className="sp-stats">
          <div className="sp-stat">
            <div className="sp-stat-num">99.9%</div>
            <div className="sp-stat-label">Uptime</div>
          </div>
          <div className="sp-stat">
            <div className="sp-stat-num">4.8★</div>
            <div className="sp-stat-label">Avg CSAT</div>
          </div>
          <div className="sp-stat">
            <div className="sp-stat-num">2.1h</div>
            <div className="sp-stat-label">Avg Res.</div>
          </div>
        </div>
      </div>

      <div className="auth-wrap">
        <div className="logo-row">
          <div className="logo-icon">ND</div>
          <div className="logo-text">NexDesk</div>
        </div>
        <div className="card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
