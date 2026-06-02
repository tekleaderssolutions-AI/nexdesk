import { useState, useEffect } from 'react';
import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment, getOrganizations,
} from '../../services/adminService';

const emptyForm = { department_name: '', is_active: true };

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [orgInput, setOrgInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [depts, orgList] = await Promise.all([getDepartments(), getOrganizations()]);
      setDepartments(depts);
      setOrgs(orgList);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const orgName = (id) => orgs.find((o) => o.id === id)?.org_name || '—';

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOrgInput('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({ department_name: dept.department_name, is_active: dept.is_active });
    setOrgInput(dept.organization_id ? orgName(dept.organization_id) : '');
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.department_name.trim()) { setError('Department name is required'); return; }
    const matchedOrg = orgs.find((o) => o.org_name.toLowerCase() === orgInput.toLowerCase().trim());
    const payload = { ...form, organization_id: matchedOrg?.id || null };
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateDepartment(editing.id, payload);
      } else {
        await createDepartment(payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept) => {
    if (!confirm(`Delete department "${dept.department_name}"?`)) return;
    try {
      await deleteDepartment(dept.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleToggleActive = async (dept) => {
    try {
      await updateDepartment(dept.id, { is_active: !dept.is_active });
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
            <h2 className="text-xl font-semibold text-slate-900">Departments</h2>
            <p className="mt-1 text-sm text-slate-500">Manage departments within organizations</p>
          </div>
          <button onClick={openCreate} className="btn-primary">+ Add Department</button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : departments.length === 0 ? (
          <p className="text-slate-400 text-sm">No departments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-medium">
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Organization</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{dept.department_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{orgName(dept.organization_id)}</td>
                    <td className="py-3 pr-4">
                      <button onClick={() => handleToggleActive(dept)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer border-0 ${dept.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => openEdit(dept)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(dept)} className="text-xs text-red-500 hover:underline">Delete</button>
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
              {editing ? 'Edit Department' : 'Add Department'}
            </h3>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department Name *</label>
                <input className="input-field" value={form.department_name}
                  onChange={(e) => setForm({ ...form, department_name: e.target.value })}
                  placeholder="e.g. IT Support" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Organization</label>
                <input
                  className="input-field"
                  value={orgInput}
                  onChange={(e) => setOrgInput(e.target.value)}
                  placeholder="e.g. Tekleaders"
                />
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="dept-active" checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  <label htmlFor="dept-active" className="text-sm text-slate-700">Active</label>
                </div>
              )}
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
