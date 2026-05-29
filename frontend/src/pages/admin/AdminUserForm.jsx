import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createUser, updateUser, getUserById, resetPassword, getDepartments } from '../../services/adminService';

export default function AdminUserForm() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const isEdit = !!userId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [departments, setDepartments] = useState([]);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'USER',
    department_id: '',
    organization_id: '',
  });

  useEffect(() => {
    loadDepartments();
    if (isEdit) {
      loadUser();
    }
  }, [userId]);

  const loadDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await getUserById(userId);
      setForm({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || '',
        role: data.role,
        department_id: data.department_id || '',
        organization_id: data.organization_id || '',
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isEdit) {
        await updateUser(userId, {
          full_name: form.full_name,
          phone: form.phone || null,
          role: form.role,
          department_id: form.department_id || null,
        });
        setSuccessMsg('User updated successfully');
      } else {
        const result = await createUser({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
          department_id: form.department_id || null,
          organization_id: form.organization_id || null,
        });
        setTempPassword(result.temporary_password || '');
        setSuccessMsg('User created successfully');
        setTimeout(() => navigate('/admin/users'), 2000);
      }
    } catch (err) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setSaving(true);
      const result = await resetPassword(userId);
      setTempPassword(result.temporary_password);
      setSuccessMsg('Password reset successfully. New temporary password generated.');
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 page">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page">
      <div>
        <h1 className="text-3xl font-bold text-white">{isEdit ? 'Edit User' : 'Create User'}</h1>
        <p className="mt-1 text-slate-400">
          {isEdit ? 'Update user information' : 'Add a new user to the organization'}
        </p>
      </div>

      <div className="card">
        {error && (
          <div className="alert alert-err" style={{ marginBottom: '16px' }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ marginLeft: 8 }}>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success" style={{ marginBottom: '16px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ marginLeft: 8 }}>{successMsg}</span>
          </div>
        )}

        {tempPassword && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
              color: '#92400e',
              fontSize: '14px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Temporary Password</div>
            <div style={{ fontFamily: 'monospace', marginBottom: '8px' }}>
              {showPassword ? tempPassword : '•'.repeat(tempPassword.length)}
            </div>
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: 'none',
                border: 'none',
                color: '#d97706',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label">Full Name *</label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                placeholder="John Doe"
                className="inp"
              />
            </div>

            <div className="field">
              <label className="label">Email *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                disabled={isEdit}
                required
                placeholder="john@example.com"
                className="inp"
              />
            </div>

            <div className="field">
              <label className="label">Phone</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+1 (555) 000-0000"
                className="inp"
              />
            </div>

            <div className="field">
              <label className="label">Role *</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className="inp"
              >
                <option value="USER">User</option>
                <option value="TEAM">Team</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="field">
              <label className="label">Department</label>
              <select
                name="department_id"
                value={form.department_id}
                onChange={handleChange}
                className="inp"
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.department_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={saving}
                className="btn"
                style={{ backgroundColor: '#ff6b6b', color: 'white' }}
              >
                Reset Password
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="btn"
              style={{ backgroundColor: '#6b7280', color: 'white' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
