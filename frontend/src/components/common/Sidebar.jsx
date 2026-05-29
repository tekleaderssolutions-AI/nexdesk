import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Sidebar({ sections, portalLabel, switchLinks }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const initials = user?.firstName?.[0] || 'U';

  return (
    <aside className="sidebar hidden xl:flex">
      <div className="logo-area">
        <div className="logo-row">
          <div className="logo-icon">ND</div>
          <div>
            <div className="logo-text">NexDesk</div>
            <div className="logo-sub">{portalLabel}</div>
          </div>
        </div>
      </div>

      <nav className="px-4 py-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="nav-section">{section.title}</div>
            <div>
              {section.links.map((link) => {
                const active = location.pathname === link.path;
                return (
                  <Link key={link.label} to={link.path} className={`nav-item ${active ? 'active' : ''}`}>
                    {link.icon && <span className="nav-icon">{link.icon}</span>}
                    <span>{link.label}</span>
                    {link.badge && <span className="nav-badge">{link.badge}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {switchLinks?.length ? (
          <div>
            <div className="nav-section">Switch Portal</div>
            {switchLinks.map((link) => (
              <Link key={link.label} to={link.path} className="nav-item">
                {link.icon && <span className="nav-icon">{link.icon}</span>}
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="user-area">
        <div className="user-row">
          <div className="avatar">{initials}</div>
          <div className="user-details">
            <div className="user-name">{user?.firstName} {user?.lastName}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button type="button" className="icon-btn" onClick={logout} title="Sign out">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
