import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  subvalue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricCard({ icon, label, value, subvalue, trend }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={16} className="text-success-500" />;
      case 'down':
        return <TrendingDown size={16} className="text-danger-500" />;
      default:
        return <Minus size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8">{icon}</div>
        {trend && getTrendIcon()}
      </div>
      <p className="metric-value">{value}</p>
      <p className="metric-label">{label}</p>
      {subvalue && <p className="text-xs text-gray-400 mt-1">{subvalue}</p>}
    </div>
  );
}
