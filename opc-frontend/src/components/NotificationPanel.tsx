import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Notification } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

function NotifIcon({ type }: { type: Notification['type'] }) {
  if (type === 'crisis') return <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />;
  if (type === 'warning') return <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />;
  return <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export function NotificationPanel({ open, onClose }: Props) {
  const { notifications, markRead } = useApp();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed right-4 top-14 z-40 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Thông báo</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-0.5">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">Không có thông báo</div>
          )}
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`px-4 py-3 cursor-pointer hover:bg-slate-50 flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
            >
              <NotifIcon type={n.type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 leading-tight">{n.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</div>
                <div className="text-xs text-slate-400 mt-1">{timeAgo(n.timestamp)}</div>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-brand-600 mt-1 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
