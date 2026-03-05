import { useState } from 'react';
import { Moon, Heart, Activity, Scale, TrendingUp, TrendingDown, Minus, ChevronRight, HeartPulse } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';

export interface QuickStat {
  value: number | string;
  unit?: string;
  trend: 'up' | 'down' | 'stable';
  trendValue?: string;
  status: 'good' | 'caution' | 'warning';
  sparklineData?: number[];
  source?: string; // e.g., 'oura', 'apple_health'
}

export interface QuickStats {
  sleep: QuickStat | null;
  hrv: QuickStat | null;
  rhr: QuickStat | null; // Resting Heart Rate
  trainingLoad: QuickStat | null;
  weight: QuickStat | null;
}

interface Props {
  stats: QuickStats;
  onMetricClick: (metric: string) => void;
}

export function QuickHealthSnapshot({ stats, onMetricClick }: Props) {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  const metrics = [
    {
      id: 'sleep',
      label: 'Sleep',
      icon: Moon,
      data: stats.sleep,
      format: (v: number | string) => typeof v === 'number' ? `${v.toFixed(1)}hrs` : v,
    },
    {
      id: 'hrv',
      label: stats.hrv?.source === 'oura' ? 'HRV (Oura)' : 'HRV',
      icon: Heart,
      data: stats.hrv,
      format: (v: number | string) => typeof v === 'number' ? `${v.toFixed(0)}ms` : v,
    },
    {
      id: 'rhr',
      label: stats.rhr?.source === 'oura' ? 'RHR (Oura)' : 'RHR',
      icon: HeartPulse,
      data: stats.rhr,
      format: (v: number | string) => typeof v === 'number' ? `${v.toFixed(0)}bpm` : v,
    },
    {
      id: 'trainingLoad',
      label: 'ACWR',
      icon: Activity,
      data: stats.trainingLoad,
      format: (v: number | string) => typeof v === 'number' ? v.toFixed(2) : v,
    },
    {
      id: 'weight',
      label: 'Weight',
      icon: Scale,
      data: stats.weight,
      format: (v: number | string) => typeof v === 'number' ? `${v.toFixed(1)}kg` : v,
    },
  ];

  const getStatusColor = (status: 'good' | 'caution' | 'warning') => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'caution':
        return 'text-yellow-600';
      case 'warning':
        return 'text-red-600';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      case 'stable':
        return Minus;
    }
  };

  const getSparklineColor = (status: 'good' | 'caution' | 'warning') => {
    switch (status) {
      case 'good':
        return '#22c55e';
      case 'caution':
        return '#eab308';
      case 'warning':
        return '#ef4444';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 5 metrics: 2 cols on mobile (with last one spanning), 5 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-gray-100">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.data ? getTrendIcon(metric.data.trend) : Minus;
          const isHovered = hoveredMetric === metric.id;

          if (!metric.data) {
            return (
              <div key={metric.id} className="p-4 text-center opacity-50">
                <Icon size={18} className="mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">{metric.label}</p>
                <p className="text-sm text-gray-400">No data</p>
              </div>
            );
          }

          return (
            <button
              key={metric.id}
              onClick={() => onMetricClick(metric.id)}
              onMouseEnter={() => setHoveredMetric(metric.id)}
              onMouseLeave={() => setHoveredMetric(null)}
              className="p-4 text-left hover:bg-gray-50 transition-colors relative group"
            >
              {/* Sparkline Background */}
              {metric.data.sparklineData && metric.data.sparklineData.length > 0 && (
                <div className="absolute inset-0 opacity-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metric.data.sparklineData.map((v, i) => ({ v, i }))}>
                      <YAxis domain={['dataMin', 'dataMax']} hide />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={getSparklineColor(metric.data.status)}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Content */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={14} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">{metric.label}</span>
                  </div>
                  <div className={`flex items-center gap-0.5 ${getStatusColor(metric.data.status)}`}>
                    <TrendIcon size={12} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-bold ${getStatusColor(metric.data.status)}`}>
                    {metric.format(metric.data.value)}
                  </span>
                  {metric.data.trendValue && (
                    <span className="text-xs text-gray-500">{metric.data.trendValue}</span>
                  )}
                </div>
              </div>

              {/* Expand indicator */}
              <ChevronRight
                size={14}
                className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 transition-opacity ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
