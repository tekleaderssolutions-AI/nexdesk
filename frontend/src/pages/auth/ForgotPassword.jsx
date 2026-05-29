import { useState } from 'react';
import { Link } from 'react-router-dom';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-2xl rounded-3xl bg-slate-900/95 p-8 shadow-2xl shadow-black/20 sm:p-10">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold text-white">Reset your password</h2>
        <p className="mt-2 text-slate-400">Enter your email to receive a frontend password recovery simulation.</p>
      </div>
      {submitted ? (
        <div className="rounded-3xl bg-emerald-500/10 p-6 text-emerald-200">
          If the email exists, a reset flow would be sent in a real application.
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-200">
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </label>
          <button className="w-full rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
            Send reset instruction
          </button>
        </form>
      )}
      <div className="mt-8 text-sm text-slate-400">
        Back to <Link to="/login" className="text-sky-300 hover:text-sky-200">sign in</Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
