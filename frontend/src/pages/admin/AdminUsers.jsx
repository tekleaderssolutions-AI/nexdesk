import { useAuth } from '../../context/AuthContext';

function AdminUsers() {
  const { teamMembers } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Admin users</h2>
        <p className="mt-2 text-slate-500">Manage the team member accounts and review role assignments.</p>
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

export default AdminUsers;
