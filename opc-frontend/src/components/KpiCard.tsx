import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  className?: string;
}

export function KpiCard({ label, value, sub, icon: Icon, iconColor = 'text-brand-600', trend, trendLabel, className = '' }: Props) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        {Icon && (
          <span className={`${iconColor} p-2 bg-slate-50 rounded-lg`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
      {trend && trendLabel && (
        <div className={`text-xs font-medium flex items-center gap-1 ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
        </div>
      )}
    </div>
  );
}
