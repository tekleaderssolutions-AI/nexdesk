import { useState, useEffect } from 'react';
import { getSkills, createSkill, updateSkill, deleteSkill } from '../../services/adminService';

const emptyForm = { skill_name: '', description: '', is_active: true };

export default function AdminSkills() {
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
      setSkills(await getSkills());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (skill) => {
    setEditing(skill);
    setForm({ skill_name: skill.skill_name, description: skill.description || '', is_active: skill.is_active });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.skill_name.trim()) { setError('Skill name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateSkill(editing.id, form);
      } else {
        await createSkill(form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (skill) => {
    if (!confirm(`Delete skill "${skill.skill_name}"?`)) return;
    try {
      await deleteSkill(skill.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleToggleActive = async (skill) => {
    try {
      await updateSkill(skill.id, { is_active: !skill.is_active });
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
            <h2 className="text-xl font-semibold text-slate-900">Skills</h2>
            <p className="mt-1 text-sm text-slate-500">Define skills that can be assigned to team members</p>
          </div>
          <button onClick={openCreate} className="btn-primary">+ Add Skill</button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : skills.length === 0 ? (
          <p className="text-slate-400 text-sm">No skills defined yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-medium">
                  <th className="pb-3 pr-4">Skill</th>
                  <th className="pb-3 pr-4">Description</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {skills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{skill.skill_name}</td>
                    <td className="py-3 pr-4 text-slate-500 max-w-xs truncate">{skill.description || '—'}</td>
                    <td className="py-3 pr-4">
                      <button onClick={() => handleToggleActive(skill)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer border-0 ${skill.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {skill.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => openEdit(skill)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(skill)} className="text-xs text-red-500 hover:underline">Delete</button>
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
              {editing ? 'Edit Skill' : 'Add Skill'}
            </h3>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Skill Name *</label>
                <input className="input-field" value={form.skill_name}
                  onChange={(e) => setForm({ ...form, skill_name: e.target.value })} placeholder="e.g. VPN, Azure, SAP" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea className="input-field" rows={3} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this skill" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="skill-active" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label htmlFor="skill-active" className="text-sm text-slate-700">Active</label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
