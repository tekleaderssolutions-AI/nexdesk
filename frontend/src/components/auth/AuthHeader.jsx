function AuthHeader({ title, description }) {
  return (
    <div className="mb-8 text-center sm:text-left">
      <h1 className="text-4xl font-semibold text-white">{title}</h1>
      <p className="mt-3 text-slate-400">{description}</p>
    </div>
  );
}

export default AuthHeader;
