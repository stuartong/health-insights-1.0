import { Calendar, Activity, Moon, Heart, Scale, Check, AlertTriangle, BarChart3, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

export interface WeeklySummaryData {
  weekStart: Date;
  weekEnd: Date;
  workouts: {
    count: number;
    types: { type: string; count: number }[];
    totalDistance: number;
    totalDuration: number;
  };
  avgSleep: number;
  avgHRV: number;
  weightChange: number;
  trainingLoadStatus: 'optimal' | 'building' | 'overreaching' | 'deload';
  overallStatus: 'good' | 'caution' | 'warning';
  statusMessage: string;
}

interface Props {
  summary: WeeklySummaryData | null;
  onViewDetails: () => void;
  onAskAI: (context: string) => void;
}

export function WeeklySummary({ summary, onViewDetails, onAskAI }: Props) {
  if (!summary) {
    return null;
  }

  const statusConfig = {
    good: {
      icon: Check,
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      iconColor: 'text-green-600',
    },
    caution: {
      icon: AlertTriangle,
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      iconColor: 'text-yellow-600',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      iconColor: 'text-red-600',
    },
  };

  const config = statusConfig[summary.overallStatus];
  const StatusIcon = config.icon;

  const loadStatusLabels: Record<string, { label: string; color: string }> = {
    optimal: { label: 'Optimal', color: 'text-green-600' },
    building: { label: 'Building', color: 'text-blue-600' },
    overreaching: { label: 'High', color: 'text-yellow-600' },
    deload: { label: 'Recovery', color: 'text-purple-600' },
  };

  const loadStatus = loadStatusLabels[summary.trainingLoadStatus] || loadStatusLabels.optimal;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            <span className="font-semibold text-gray-900">This Week</span>
          </div>
          <span className="text-sm text-gray-500">
            {format(summary.weekStart, 'MMM d')} - {format(summary.weekEnd, 'MMM d')}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* Workouts */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Activity size={14} />
              <span className="text-xs">Workouts</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{summary.workouts.count}</p>
            <p className="text-xs text-gray-500">
              {(summary.workouts.totalDistance / 1000).toFixed(1)}km total
            </p>
          </div>

          {/* Sleep */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Moon size={14} />
              <span className="text-xs">Avg Sleep</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{summary.avgSleep.toFixed(1)}</p>
            <p className="text-xs text-gray-500">hrs/night</p>
          </div>

          {/* HRV */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Heart size={14} />
              <span className="text-xs">Avg HRV</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{summary.avgHRV.toFixed(0)}</p>
            <p className="text-xs text-gray-500">ms</p>
          </div>

          {/* Weight */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Scale size={14} />
              <span className="text-xs">Weight</span>
            </div>
            <p className={`text-xl font-bold ${
              summary.weightChange < 0 ? 'text-green-600' :
              summary.weightChange > 0 ? 'text-orange-600' :
              'text-gray-900'
            }`}>
              {summary.weightChange >= 0 ? '+' : ''}{summary.weightChange.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">kg change</p>
          </div>

          {/* Training Load */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Activity size={14} />
              <span className="text-xs">Load</span>
            </div>
            <p className={`text-xl font-bold ${loadStatus.color}`}>
              {loadStatus.label}
            </p>
            <p className="text-xs text-gray-500">training load</p>
          </div>
        </div>

        {/* Status Message */}
        <div className={`mt-4 p-3 rounded-lg ${config.bg} ${config.border} border`}>
          <div className="flex items-center gap-2">
            <StatusIcon size={18} className={config.iconColor} />
            <p className={`text-sm font-medium ${config.text}`}>{summary.statusMessage}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <BarChart3 size={14} />
          View Week Details
        </button>
        <button
          onClick={() => onAskAI('Help me plan next week\'s training based on this week\'s data')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Plan Next Week
        </button>
      </div>
    </div>
  );
}
