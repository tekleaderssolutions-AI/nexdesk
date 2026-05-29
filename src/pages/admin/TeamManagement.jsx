import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function TeamManagement() {
  const { teamMembers, createTeamMember } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', department: 'Support Operations', assignedZone: 'Incident Queue' });
  const [message, setMessage] = useState('');

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleCreate = (event) => {
    event.preventDefault();
    const result = createTeamMember(form);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setMessage(`Team member invited with temporary password: ${result.teamMember.password}`);
    setForm({ firstName: '', lastName: '', email: '', department: 'Support Operations', assignedZone: 'Incident Queue' });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Team Management</h2>
        <p className="mt-2 text-slate-500">Create and manage team members for the incident response workflow.</p>
        {message ? <div className="mt-5 rounded-3xl bg-slate-100 p-4 text-sm text-slate-700">{message}</div> : null}
        <form onSubmit={handleCreate} className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            First Name
            <input
              type="text"
              value={form.firstName}
              onChange={handleChange('firstName')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Last Name
            <input
              type="text"
              value={form.lastName}
              onChange={handleChange('lastName')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700 lg:col-span-2">
            Email
            <input
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Department
            <select
              value={form.department}
              onChange={handleChange('department')}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <option>Support Operations</option>
              <option>Workflow Intelligence</option>
              <option>Incident Response</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Assignment zone
            <select
              value={form.assignedZone}
              onChange={handleChange('assignedZone')}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <option>Incident Queue</option>
              <option>Response Queue</option>
              <option>Monitoring Zone</option>
            </select>
          </label>
          <button className="lg:col-span-2 rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
            Invite team member
          </button>
        </form>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Team member roster</h2>
        <div className="mt-6 space-y-4">
          {teamMembers.map((member) => (
            <div key={member.id} className="rounded-3xl border border-slate-200 p-5 sm:flex sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-slate-900">{member.firstName} {member.lastName}</div>
                <div className="text-sm text-slate-500">{member.email}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                <span className="rounded-full bg-slate-100 px-3 py-2">{member.department}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">{member.assignedZone}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default TeamManagement;
