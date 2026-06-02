import { useState, useEffect } from 'react';
import {
  getOrganizations, createOrganization, updateOrganization, deleteOrganization,
} from '../../services/adminService';

const PLAN_TYPES = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'TRIAL', 'BLOCKED'];

const emptyForm = { org_name: '', domain: '', plan_type: 'ENTERPRISE', is_active: true };

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setOrgs(await getOrganizations());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (org) => {
    setEditing(org);
    setForm({ org_name: org.org_name, domain: org.domain || '', plan_type: org.plan_type || 'ENTERPRISE', is_active: org.is_active });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.org_name.trim()) { setError('Organization name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateOrganization(editing.id, form);
      } else {
        await createOrganization(form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (org) => {
    if (!confirm(`Delete organization "${org.org_name}"? This cannot be undone.`)) return;
    try {
      await deleteOrganization(org.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleToggleActive = async (org) => {
    try {
      await updateOrganization(org.id, { is_active: !org.is_active });
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
            <h2 className="text-xl font-semibold text-slate-900">Organizations</h2>
            <p className="mt-1 text-sm text-slate-500">Manage all registered organizations</p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            + Add Organization
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : orgs.length === 0 ? (
          <p className="text-slate-400 text-sm">No organizations found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-medium">
                  <th className="pb-3 pr-4">Organization</th>
                  <th className="pb-3 pr-4">Domain</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{org.org_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{org.domain || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {org.plan_type || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <button onClick={() => handleToggleActive(org)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer border-0 ${org.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => openEdit(org)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(org)} className="text-xs text-red-500 hover:underline">Delete</button>
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
              {editing ? 'Edit Organization' : 'Add Organization'}
            </h3>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Organization Name *</label>
                <input className="input-field" value={form.org_name}
                  onChange={(e) => setForm({ ...form, org_name: e.target.value })} placeholder="e.g. Tekleaders" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Domain</label>
                <input className="input-field" value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="e.g. tekleaders.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Type</label>
                <select className="input-field" value={form.plan_type}
                  onChange={(e) => setForm({ ...form, plan_type: e.target.value })}>
                  {PLAN_TYPES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="org-active" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label htmlFor="org-active" className="text-sm text-slate-700">Active</label>
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
