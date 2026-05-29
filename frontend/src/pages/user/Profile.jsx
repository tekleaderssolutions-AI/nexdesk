import { useAuth } from '../../context/AuthContext';

function Profile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white p-8 shadow-panel">
      <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
      <p className="mt-2 text-slate-500">Review your user profile and membership details.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-3xl bg-slate-50 p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Name</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{user.firstName} {user.lastName}</div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Email</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{user.email}</div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Role</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{user.role}</div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Department</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{user.department || 'Customer Success'}</div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
