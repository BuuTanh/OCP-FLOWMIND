type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'ok' | 'warning' | 'info' | 'KY' | 'KY_CO_DIEU_KIEN' | 'KHONG_KY' | 'CHUA_DU_DATA' | 'CHUA_DU_DU_LIEU';

const colorMap: Record<Severity, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-gray-100 text-gray-600 border-gray-200',
  ok: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  KY: 'bg-green-100 text-green-700 border-green-200',
  KY_CO_DIEU_KIEN: 'bg-amber-100 text-amber-700 border-amber-200',
  KHONG_KY: 'bg-red-100 text-red-700 border-red-200',
  CHUA_DU_DATA: 'bg-gray-100 text-gray-600 border-gray-200',
  CHUA_DU_DU_LIEU: 'bg-gray-100 text-gray-600 border-gray-200',
};

const labelMap: Partial<Record<Severity, string>> = {
  Critical: 'Nghiêm trọng',
  High: 'Cao',
  Medium: 'Trung bình',
  Low: 'Thấp',
  ok: 'Đạt',
  warning: 'Cần lưu ý',
  info: 'Thông tin',
  KY: 'KÝ',
  KY_CO_DIEU_KIEN: 'KÝ CÓ ĐK',
  KHONG_KY: 'KHÔNG KÝ',
  CHUA_DU_DATA: 'CHƯA ĐỦ DL',
  CHUA_DU_DU_LIEU: 'CHƯA ĐỦ DL',
};

interface Props {
  value: Severity;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ value, size = 'sm', className = '' }: Props) {
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm font-semibold' : size === 'md' ? 'px-2.5 py-1 text-xs font-medium' : 'px-2 py-0.5 text-xs font-medium';
  const colors = colorMap[value] || 'bg-gray-100 text-gray-600 border-gray-200';
  const label = labelMap[value] || value;

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClass} ${colors} ${className}`}>
      {label}
    </span>
  );
}
