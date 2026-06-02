import { useState, useEffect } from 'react';
import {
  getTeamsWithStats, createTeam, updateTeam, deleteTeam, getDepartments,
} from '../../services/adminService';

const emptyForm = { team_name: '', is_active: true };

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deptInput, setDeptInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [teamList, deptList] = await Promise.all([getTeamsWithStats(), getDepartments()]);
      setTeams(teamList);
      setDepartments(deptList);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDeptInput('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (team) => {
    setEditing(team);
    setForm({ team_name: team.team_name, is_active: team.is_active });
    setDeptInput(team.department_name || '');
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.team_name.trim()) { setError('Team name is required'); return; }
    const matchedDept = departments.find(
      (d) => d.department_name.toLowerCase() === deptInput.toLowerCase().trim()
    );
    const payload = { ...form, department_id: matchedDept?.id || null };
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateTeam(editing.id, payload);
      } else {
        await createTeam(payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team) => {
    if (!confirm(`Delete team "${team.team_name}"?`)) return;
    try {
      await deleteTeam(team.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleToggleActive = async (team) => {
    try {
      await updateTeam(team.id, { is_active: !team.is_active });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const slaColor = (pct) => {
    if (pct === null || pct === undefined) return 'text-slate-400';
    if (pct >= 90) return 'text-emerald-500';
    if (pct >= 75) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Team Management</h2>
            <p className="mt-1 text-sm text-slate-500">Roles, permissions &amp; workload</p>
          </div>
          <button onClick={openCreate} className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
            + Add Team
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : teams.length === 0 ? (
          <p className="text-slate-400 text-sm">No teams found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div key={team.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-0 shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{team.team_name}</h3>
                  <button
                    onClick={() => handleToggleActive(team)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer border-0 shrink-0 ml-2 ${team.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {team.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {/* Stats rows */}
                <div className="divide-y divide-slate-100 mb-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Members</span>
                    <span className="text-sm font-bold text-slate-900">{team.member_count}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Open Tickets</span>
                    <span className="text-sm font-bold text-slate-900">{team.open_tickets}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Avg Resolution</span>
                    <span className="text-sm font-bold text-slate-900">
                      {team.avg_resolution_hours != null ? `${team.avg_resolution_hours}h` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">SLA</span>
                    <span className={`text-sm font-bold ${slaColor(team.sla_percentage)}`}>
                      {team.sla_percentage != null ? `${team.sla_percentage}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => openEdit(team)}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => handleDelete(team)}
                    className="flex-1 rounded-xl border border-red-100 bg-white py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editing ? 'Edit Team' : 'Add Team'}
            </h3>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Team Name *</label>
                <input className="input-field" value={form.team_name}
                  onChange={(e) => setForm({ ...form, team_name: e.target.value })}
                  placeholder="e.g. Network Team" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <input
                  className="input-field"
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  placeholder="e.g. IT Support"
                />
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="team-active" checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  <label htmlFor="team-active" className="text-sm text-slate-700">Active</label>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
