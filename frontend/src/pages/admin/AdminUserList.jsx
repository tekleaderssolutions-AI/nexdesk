import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUsers, deactivateUser, activateUser } from '../../services/adminService';

export default function AdminUserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      if (isActive) {
        await deactivateUser(userId);
      } else {
        await activateUser(userId);
      }
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = !filterDept || user.department_id === filterDept;
    const matchRole = !filterRole || user.role === filterRole;
    const matchActive =
      filterActive === 'all' ||
      (filterActive === 'active' ? user.is_active : !user.is_active);

    return matchSearch && matchDept && matchRole && matchActive;
  });

  return (
    <div className="space-y-6 page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="mt-1 text-slate-400">Manage organization users and teams</p>
        </div>
        <Link
          to="/admin/users/create"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>+ Create User</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              placeholder="Name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="inp"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="inp"
            >
              <option value="">All Roles</option>
              <option value="USER">User</option>
              <option value="TEAM">Team</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="inp"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <input
              type="text"
              placeholder="Filter by dept..."
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="inp"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-err" style={{ marginTop: 10 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ marginLeft: 8 }}>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            No users found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Role</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Last Login</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.user_id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 500, color: '#1f2937' }}>{user.full_name}</div>
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>{user.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor:
                          user.role === 'ADMIN'
                            ? '#fecaca'
                            : user.role === 'TEAM'
                            ? '#c7d2fe'
                            : '#d1fae5',
                        color:
                          user.role === 'ADMIN'
                            ? '#7f1d1d'
                            : user.role === 'TEAM'
                            ? '#3730a3'
                            : '#065f46',
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor: user.is_active ? '#dcfce7' : '#fee2e2',
                        color: user.is_active ? '#166534' : '#991b1b',
                      }}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link
                        to={`/admin/users/${user.user_id}`}
                        className="btn-link"
                        style={{ fontSize: '12px' }}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleToggleActive(user.user_id, user.is_active)}
                        className="btn-link"
                        style={{ fontSize: '12px', color: user.is_active ? '#dc2626' : '#16a34a' }}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ color: '#9ca3af', fontSize: '14px' }}>
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
}
