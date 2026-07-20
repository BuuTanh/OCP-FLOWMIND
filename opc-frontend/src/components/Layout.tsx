import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileBarChart, GitBranch, BarChart2,
  ShieldAlert, Settings, Bell, BookOpen, SearchCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationPanel } from './NotificationPanel';

const NAV_MAIN = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { to: '/pipeline', label: 'Thẩm định hợp đồng', icon: GitBranch },
  { to: '/research', label: 'Nghiên cứu đối tác', icon: SearchCheck },
  { to: '/financial', label: 'Tài chính', icon: BarChart2 },
  { to: '/risks', label: 'Rủi ro & Cảnh báo', icon: ShieldAlert, badge: true },
  { to: '/reports', label: 'Báo cáo', icon: FileBarChart },
];

const NAV_UTILITY = [
  { to: '/guide', label: 'Hướng dẫn', icon: BookOpen },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tổng quan điều hành',
  '/pipeline': 'Thẩm định và khuyến nghị hợp đồng',
  '/research': 'Nghiên cứu thông tin đối tác',
  '/financial': 'Phân tích tài chính',
  '/risks': 'Rủi ro & Cảnh báo',
  '/reports': 'Báo cáo tổng hợp',
  '/guide': 'Hướng dẫn sử dụng & Kiến thức hệ thống',
  '/settings': 'Cài đặt hệ thống',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { notifications } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();

  const unread = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => !n.read && n.type === 'crisis').length;
  const title = PAGE_TITLES[location.pathname] || 'OPC FlowMind';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <aside className="no-print w-56 shrink-0 flex flex-col h-full" style={{ backgroundColor: '#1e40af' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-white font-bold text-base leading-tight">OPC FlowMind</div>
          <div className="text-blue-200 text-xs mt-0.5 font-medium">Trung tâm tham mưu quyết định</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto flex flex-col gap-0.5">
          {NAV_MAIN.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={isActive ? 'text-white' : 'text-blue-200'} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && criticalCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                      {criticalCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-2 border-t border-white/10" />

          {NAV_UTILITY.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={isActive ? 'text-white' : 'text-blue-200'} />
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-blue-200 text-xs">MIS Talent 2026</div>
          <div className="text-blue-300 text-xs mt-0.5">Đây Là Tam Ca</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="no-print h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
          <h1 className="text-base font-semibold text-slate-800">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors relative"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-800 flex items-center justify-center text-white text-xs font-bold select-none">
              NA
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
