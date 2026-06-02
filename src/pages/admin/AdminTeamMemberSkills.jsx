import { useState, useEffect } from 'react';
import {
  getTeamMemberSkills, createTeamMemberSkill, updateTeamMemberSkill, deleteTeamMemberSkill,
  getTeamMembers, getSkills,
} from '../../services/adminService';

const PROFICIENCIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const emptyForm = { team_member_id: '', skill_id: '', proficiency: 'INTERMEDIATE' };

const proficiencyColor = {
  BEGINNER: 'bg-slate-100 text-slate-600',
  INTERMEDIATE: 'bg-blue-50 text-blue-700',
  ADVANCED: 'bg-amber-50 text-amber-700',
  EXPERT: 'bg-emerald-50 text-emerald-700',
};

export default function AdminTeamMemberSkills() {
  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [aList, mList, sList] = await Promise.all([
        getTeamMemberSkills(), getTeamMembers(), getSkills(),
      ]);
      setAssignments(aList);
      setMembers(mList);
      setSkills(sList);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ team_member_id: a.team_member_id, skill_id: a.skill_id, proficiency: a.proficiency });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.team_member_id || !form.skill_id) { setError('Member and Skill are required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateTeamMemberSkill(editing.id, { proficiency: form.proficiency });
      } else {
        await createTeamMemberSkill(form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    if (!confirm(`Remove skill "${a.skill_name}" from "${a.full_name}"?`)) return;
    try {
      await deleteTeamMemberSkill(a.id);
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
            <h2 className="text-xl font-semibold text-slate-900">Team Member Skills</h2>
            <p className="mt-1 text-sm text-slate-500">Assign skills and proficiency levels to team members</p>
          </div>
          <button onClick={openCreate} className="btn-primary">+ Assign Skill</button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : assignments.length === 0 ? (
          <p className="text-slate-400 text-sm">No skill assignments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-medium">
                  <th className="pb-3 pr-4">Team Member</th>
                  <th className="pb-3 pr-4">Skill</th>
                  <th className="pb-3 pr-4">Proficiency</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{a.full_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{a.skill_name}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${proficiencyColor[a.proficiency] || 'bg-slate-100 text-slate-600'}`}>
                        {a.proficiency}
                      </span>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(a)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </td>
                  </tr>
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
              {editing ? 'Update Proficiency' : 'Assign Skill'}
            </h3>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="space-y-3">
              {!editing && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Team Member *</label>
                    <select className="input-field" value={form.team_member_id}
                      onChange={(e) => setForm({ ...form, team_member_id: e.target.value })}>
                      <option value="">— Select Member —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name} ({m.team_name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Skill *</label>
                    <select className="input-field" value={form.skill_id}
                      onChange={(e) => setForm({ ...form, skill_id: e.target.value })}>
                      <option value="">— Select Skill —</option>
                      {skills.filter((s) => s.is_active).map((s) => (
                        <option key={s.id} value={s.id}>{s.skill_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Proficiency</label>
                <select className="input-field" value={form.proficiency}
                  onChange={(e) => setForm({ ...form, proficiency: e.target.value })}>
                  {PROFICIENCIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
