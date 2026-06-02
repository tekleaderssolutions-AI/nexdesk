import { useState, useEffect, useCallback } from 'react';
import {
  getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember,
  getUsers, getTeams,
  getMemberSkills, addMemberSkill, removeMemberSkill,
} from '../../services/adminService';

const ROLES = ['TEAM_LEAD', 'AGENT', 'MANAGER', 'L2_SUPPORT', 'L3_SUPPORT'];
const PROFICIENCIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const emptyForm = { member_role: 'AGENT' };

const roleBadgeClass = {
  TEAM_LEAD: 'bg-purple-50 text-purple-700',
  MANAGER: 'bg-blue-50 text-blue-700',
  AGENT: 'bg-slate-100 text-slate-600',
  L2_SUPPORT: 'bg-amber-50 text-amber-700',
  L3_SUPPORT: 'bg-orange-50 text-orange-700',
};

const profColor = {
  BEGINNER: 'bg-slate-100 text-slate-600',
  INTERMEDIATE: 'bg-blue-50 text-blue-700',
  ADVANCED: 'bg-amber-50 text-amber-700',
  EXPERT: 'bg-emerald-50 text-emerald-700',
};

function SkillsPanel({ memberId }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skillInput, setSkillInput] = useState('');
  const [proficiency, setProficiency] = useState('INTERMEDIATE');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setSkills(await getMemberSkills(memberId));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!skillInput.trim()) { setErr('Enter a skill name'); return; }
    setAdding(true);
    setErr('');
    try {
      await addMemberSkill(memberId, { skill_name: skillInput.trim(), proficiency });
      setSkillInput('');
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (tmsId) => {
    try {
      await removeMemberSkill(tmsId);
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <tr>
      <td colSpan={6} className="px-4 pb-3 pt-0 bg-slate-50">
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Skills</p>
          {loading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {skills.length === 0 && <span className="text-xs text-slate-400">No skills assigned yet.</span>}
              {skills.map((s) => (
                <span key={s.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${profColor[s.proficiency] || 'bg-slate-100 text-slate-600'}`}>
                  {s.skill_name}
                  <span className="opacity-60 text-[10px]">({s.proficiency})</span>
                  <button onClick={() => handleRemove(s.id)} className="ml-0.5 text-current opacity-60 hover:opacity-100 font-bold leading-none">×</button>
                </span>
              ))}
            </div>
          )}
          {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
          <div className="flex gap-2 items-center">
            <input
              className="input-field flex-1 text-xs py-1.5"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. VPN, Azure, SAP..."
            />
            <select
              className="input-field text-xs py-1.5"
              style={{ width: 'auto', minWidth: '130px' }}
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value)}
            >
              {PROFICIENCIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shrink-0"
            >
              {adding ? '...' : '+ Add'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminTeamMembers() {
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [expandedSkills, setExpandedSkills] = useState(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [memberList, userList, teamList] = await Promise.all([
        getTeamMembers(), getUsers(), getTeams(),
      ]);
      setMembers(memberList);
      setUsers(userList);
      setTeams(teamList);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSkills = (id) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelectedUserId('');
    setSelectedTeamId('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ member_role: m.member_role });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateTeamMember(editing.id, { member_role: form.member_role });
      } else {
        if (!selectedUserId) { setError('Please select a user'); setSaving(false); return; }
        if (!selectedTeamId) { setError('Please select a team'); setSaving(false); return; }
        await createTeamMember({ user_id: selectedUserId, team_id: selectedTeamId, member_role: form.member_role });
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`Remove "${m.full_name}" from "${m.team_name}"?`)) return;
    try {
      await deleteTeamMember(m.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Team Members</h2>
            <p className="mt-1 text-sm text-slate-500">Assign users to teams and manage their roles &amp; skills</p>
          </div>
          <button onClick={openCreate} className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
            + Add Member
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-slate-400 text-sm">No team members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-medium">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Team</th>
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <>
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">{m.full_name}</td>
                      <td className="py-3 pr-4 text-slate-500">{m.email}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass[m.member_role] || 'bg-slate-100 text-slate-600'}`}>
                          {m.member_role}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{m.team_name}</td>
                      <td className="py-3 pr-4 text-slate-500">{m.department_name || '—'}</td>
                      <td className="py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => toggleSkills(m.id)}
                            className={`text-xs font-medium hover:underline ${expandedSkills.has(m.id) ? 'text-indigo-600' : 'text-slate-500'}`}>
                            {expandedSkills.has(m.id) ? '▾ Skills' : '▸ Skills'}
                          </button>
                          <button onClick={() => openEdit(m)} className="text-xs text-blue-600 hover:underline">Role</button>
                          <button onClick={() => handleDelete(m)} className="text-xs text-red-500 hover:underline">Remove</button>
                        </div>
                      </td>
                    </tr>
                    {expandedSkills.has(m.id) && <SkillsPanel key={`skills-${m.id}`} memberId={m.id} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editing ? 'Change Role' : 'Add Team Member'}
            </h3>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="space-y-3">
              {!editing && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">User *</label>
                    <select
                      className="input-field"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">— Select user —</option>
                      {users.map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.full_name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Team *</label>
                    <select
                      className="input-field"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                      <option value="">— Select team —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.team_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select className="input-field" value={form.member_role}
                  onChange={(e) => setForm({ ...form, member_role: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                {saving ? 'Saving...' : editing ? 'Update Role' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
