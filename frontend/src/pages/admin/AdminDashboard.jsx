import { useAuth } from '../../context/AuthContext';

function AdminDashboard() {
  const { teamMembers, csatRecords } = useAuth();
  const averageRating = csatRecords.length
    ? (csatRecords.reduce((sum, item) => sum + item.rating, 0) / csatRecords.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 page">
      <section className="grid gap-5 md:grid-cols-3">
        <div className="stat">
          <div className="stat-title">Team members</div>
          <div className="stat-value">{teamMembers.length}</div>
          <div className="stat-subtitle">Active support staff</div>
        </div>
        <div className="stat">
          <div className="stat-title">CSAT average</div>
          <div className="stat-value">{averageRating}</div>
          <div className="stat-subtitle">Customer satisfaction score</div>
        </div>
        <div className="stat">
          <div className="stat-title">Workflow streams</div>
          <div className="stat-value">7</div>
          <div className="stat-subtitle">Live automation paths</div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold text-white">Executive metrics</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Low satisfaction alerts', value: '4' },
            { label: 'Pending approvals', value: '12' },
            { label: 'Open incidents', value: '18' },
          ].map((item) => (
            <div key={item.label} className="card">
              <div className="text-sm text-slate-400">{item.label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
