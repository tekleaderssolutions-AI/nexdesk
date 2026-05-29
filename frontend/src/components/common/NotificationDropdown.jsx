function NotificationDropdown() {
  return (
    <div className="relative inline-block text-left">
      <button className="inline-flex w-full justify-center rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">
        Alerts
      </button>
      <div className="absolute right-0 z-10 mt-2 w-80 rounded-3xl bg-white py-3 shadow-xl ring-1 ring-slate-200">
        <div className="px-4 py-3 text-sm text-slate-500">You have 3 pending notifications.</div>
        <div className="space-y-2 px-4">
          <div className="rounded-3xl bg-slate-50 p-3 text-sm text-slate-700">Ticket TCK-1001 requires follow-up.</div>
          <div className="rounded-3xl bg-slate-50 p-3 text-sm text-slate-700">Low satisfaction alert triggered.</div>
          <div className="rounded-3xl bg-slate-50 p-3 text-sm text-slate-700">Team queue backlog has grown.</div>
        </div>
      </div>
    </div>
  );
}

export default NotificationDropdown;
