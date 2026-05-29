function ChatWindow() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Live assistant</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Team collaboration</h2>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase text-slate-500">Offline</div>
      </div>
      <div className="mt-5 space-y-3 text-sm text-slate-600">
        <div className="rounded-3xl bg-slate-50 p-4">Use this space to draft incident responses and share workflows.</div>
        <div className="rounded-3xl bg-slate-50 p-4">Remember: this is a frontend simulation only.</div>
      </div>
      <div className="mt-5 flex gap-3">
        <input className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder="Write a quick note..." />
        <button className="rounded-3xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Send</button>
      </div>
    </div>
  );
}

export default ChatWindow;
