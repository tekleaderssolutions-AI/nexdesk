import { useAuth } from '../../context/AuthContext';

function AdminTeams() {
  const { teamMembers } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Team management</h2>
        <p className="mt-2 text-slate-500">Define departments and team assignments for incident response.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="font-semibold text-slate-900">{member.firstName} {member.lastName}</div>
              <div className="mt-2 text-sm text-slate-500">{member.email}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-slate-600">
                <span className="rounded-full bg-white px-3 py-2">{member.department}</span>
                <span className="rounded-full bg-white px-3 py-2">{member.assignedZone}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminTeams;
