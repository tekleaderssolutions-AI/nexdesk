import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function ChangePasswordModal({ isOpen, onClose }) {
  const { user, changePassword } = useAuth();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!user && !email) {
      setError('Please enter your account email address.');
      return;
    }
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    // Simulate brief network delay for elegant interaction feel
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const result = await changePassword(currentPassword, newPassword, user ? null : email);
      if (result.success) {
        setSuccess(result.message);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Change Password</h3>
            <p style={styles.subtitle}>Update your credentials to secure your workspace.</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ marginLeft: 8 }}>{error}</span>
          </div>
        )}

        {success && (
          <div style={styles.successAlert}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span style={{ marginLeft: 8 }}>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {!user && (
            <div style={styles.field}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                placeholder="Enter your account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Current Password</label>
            <input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm New Password</label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={loading}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(3, 5, 8, 0.75)',
    backdropFilter: 'blur(12px)',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    animation: 'fadeIn 0.2s ease-out',
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'rgba(8, 12, 22, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
    animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    color: '#ffffff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    margin: 0,
    color: '#ffffff',
  },
  subtitle: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    margin: '4px 0 0 0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    color: '#ffffff',
    padding: '10px 12px',
    fontSize: '13.5px',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.25)',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '12.5px',
    color: '#fca5a5',
    marginBottom: '16px',
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    border: '1px solid rgba(52, 211, 153, 0.25)',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '12.5px',
    color: '#a7f3d0',
    marginBottom: '16px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  cancelBtn: {
    padding: '10px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  submitBtn: {
    padding: '10px 18px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #4f8ef7, #3b6fff)',
    color: '#ffffff',
    fontSize: '12.5px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '120px',
    boxShadow: '0 8px 24px rgba(59, 111, 255, 0.2)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },
};

export default ChangePasswordModal;
