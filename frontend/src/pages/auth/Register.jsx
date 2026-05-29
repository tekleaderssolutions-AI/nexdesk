import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const result = register(form);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setSuccess('Registration successful. Redirecting to login...');
    setTimeout(() => navigate('/login'), 1200);
  };

  return (
    <div className="max-w-2xl rounded-3xl bg-slate-900/95 p-8 shadow-2xl shadow-black/20 sm:p-10">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold text-white">Register your user account</h2>
        <p className="mt-2 text-slate-400">Only customer users can self-register in Phase 1.</p>
      </div>

      {error ? <div className="mb-5 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {success ? <div className="mb-5 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div> : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-200">
            First Name
            <input
              type="text"
              value={form.firstName}
              onChange={handleChange('firstName')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-200">
            Last Name
            <input
              type="text"
              value={form.lastName}
              onChange={handleChange('lastName')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-200">
          Business email
          <input
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            required
            className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-200">
            Password
            <input
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-200">
            Confirm Password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              required
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </label>
        </div>

        <button className="w-full rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
          Create account
        </button>
      </form>
    </div>
  );
}

export default Register;
