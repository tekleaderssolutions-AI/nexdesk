import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRedirectForRole } from '../../utils/roleUtils';
import ChangePasswordModal from '../../components/common/ChangePasswordModal';

function Login() {
  const [portal, setPortal] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const selectPortal = (role) => {
    setPortal(role);
    setError('');
  };

  const togglePw = () => setShowPw((s) => !s);

  const doLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.message || 'Invalid credentials');
        setLoading(false);
        return;
      }

      const dest = getRedirectForRole(result.user.role);
      navigate(dest);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const ssoLogin = (provider) => {
    setError(`SSO (${provider}) not available in this demo.`);
  };

  return (
    <div>
      <div className="view-title">Welcome back</div>
      <div className="view-sub">Sign in to your workspace</div>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Sign in as</div>
      <div className="portal-selector" role="tablist">
        <button type="button" onClick={() => selectPortal('user')} className={`portal-opt ${portal === 'user' ? 'selected' : ''}`} aria-pressed={portal === 'user'}>
          <div className="po-icon" style={{ background: 'rgba(59,111,255,.12)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div className="po-label">User</div>
        </button>
        <button type="button" onClick={() => selectPortal('team')} className={`portal-opt ${portal === 'team' ? 'selected' : ''}`} aria-pressed={portal === 'team'}>
          <div className="po-icon" style={{ background: 'rgba(167,139,250,.1)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="po-label">Team</div>
        </button>
        <button type="button" onClick={() => selectPortal('admin')} className={`portal-opt ${portal === 'admin' ? 'selected' : ''}`} aria-pressed={portal === 'admin'}>
          <div className="po-icon" style={{ background: 'rgba(52,211,153,.1)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M1 12h2M21 12h2M12 1v2M12 21v2"/></svg>
          </div>
          <div className="po-label">Admin</div>
        </button>
      </div>

      {error && (
        <div className="alert alert-err" style={{ marginTop: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ marginLeft: 8 }}>{error}</span>
        </div>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label className="label">Email address</label>
        <div className="inp-wrap">
          <svg className="inp-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <input className="inp has-icon" id="login-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>

      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label className="label" style={{ marginBottom: 0 }}>Password</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn-link" onClick={() => setShowChangePassword(true)} style={{ fontSize: 12 }}>Change password?</button>
            <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: 10 }}>|</span>
            <button type="button" className="btn-link" onClick={() => navigate('/forgot-password')} style={{ fontSize: 12 }}>Forgot password?</button>
          </div>
        </div>
        <div className="inp-wrap">
          <svg className="inp-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input className="inp has-icon" id="login-pw" type={showPw ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="inp-eye" type="button" onClick={togglePw} title="Show/hide password">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      <label className="check-row" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Remember me for 30 days</span>
      </label>

      <button className="btn-primary" onClick={doLogin} id="login-btn" style={{ marginTop: 6 }}>
        <div className="btn-shine" />
        <span id="login-btn-text">{loading ? <span className="spinner" /> : 'Sign In'}</span>
      </button>

      <div className="divider"><span>or continue with</span></div>

      <button className="sso-btn" onClick={() => ssoLogin('google')}>
        <div className="sso-logo">
          {/* Google logo */}
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        </div>
        Continue with Google
      </button>
      <button className="sso-btn" onClick={() => ssoLogin('microsoft')}>
        <div className="sso-logo">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M13 1h10v10H13z"/><path fill="#7fba00" d="M1 13h10v10H1z"/><path fill="#ffb900" d="M13 13h10v10H13z"/></svg>
        </div>
        Continue with Microsoft
      </button>

      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}

export default Login;
