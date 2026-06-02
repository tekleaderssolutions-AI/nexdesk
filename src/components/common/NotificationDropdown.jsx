import { useEffect, useRef, useState } from 'react';
import { fetchNotifications, markNotificationsRead } from '../../services/ticketService';

function NotificationDropdown() {
  const [open, setOpen]                 = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]           = useState(false);
  const ref                             = useRef(null);

  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    setLoading(true);
    fetchNotifications().then((r) => {
      if (r.success) setNotifications(r.notifications);
      setLoading(false);
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      markNotificationsRead().then(() =>
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      );
    }
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative inline-flex items-center gap-2 rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
      >
        Alerts
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-96 rounded-3xl bg-white py-3 shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Notifications</span>
            {notifications.length > 0 && (
              <span className="text-xs text-slate-400">{notifications.length} total</span>
            )}
          </div>

          {loading ? (
            <div className="px-4 py-4 text-sm text-slate-400">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-400">No notifications yet.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1 px-3 pt-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-2xl p-3 text-sm ${n.is_read ? 'bg-slate-50 text-slate-600' : 'bg-sky-50 text-slate-800'}`}
                >
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-xs whitespace-pre-line text-slate-500">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
