import { WeightChart } from './WeightChart';
import { WeightEntry } from './WeightEntry';
import { TrendAnalysis } from './TrendAnalysis';
import { WeightStats } from './WeightStats';
import { useHealthStore } from '@/stores/healthStore';
import { Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function WeightPage() {
  const { recentWeight, weightTrend } = useHealthStore();

  const getTrendIcon = () => {
    if (!weightTrend) return <Minus className="text-gray-400" />;
    switch (weightTrend.trendDirection) {
      case 'up':
        return <TrendingUp className="text-warning-500" />;
      case 'down':
        return <TrendingDown className="text-success-500" />;
      default:
        return <Minus className="text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Scale size={20} className="text-primary-500" />
            {getTrendIcon()}
          </div>
          <p className="metric-value">
            {weightTrend ? `${weightTrend.current.toFixed(1)} kg` : '-- kg'}
          </p>
          <p className="metric-label">Current Weight</p>
        </div>

        <div className="metric-card">
          <p className="metric-value">
            {weightTrend ? `${weightTrend.smoothed.toFixed(1)} kg` : '-- kg'}
          </p>
          <p className="metric-label">Smoothed Trend</p>
          <p className="text-xs text-gray-400 mt-1">Filters daily noise</p>
        </div>

        <div className="metric-card">
          <p className={`metric-value ${weightTrend?.weekChange && weightTrend.weekChange > 0 ? 'text-warning-600' : weightTrend?.weekChange && weightTrend.weekChange < 0 ? 'text-success-600' : ''}`}>
            {weightTrend ? `${weightTrend.weekChange > 0 ? '+' : ''}${weightTrend.weekChange.toFixed(1)} kg` : '-- kg'}
          </p>
          <p className="metric-label">7-Day Change</p>
        </div>

        <div className="metric-card">
          <p className={`metric-value ${weightTrend?.monthChange && weightTrend.monthChange > 0 ? 'text-warning-600' : weightTrend?.monthChange && weightTrend.monthChange < 0 ? 'text-success-600' : ''}`}>
            {weightTrend ? `${weightTrend.monthChange > 0 ? '+' : ''}${weightTrend.monthChange.toFixed(1)} kg` : '-- kg'}
          </p>
          <p className="metric-label">30-Day Change</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Weight Trend</h3>
          <p className="text-sm text-gray-500">Raw measurements with smoothed trend line</p>
        </div>
        <div className="card-body">
          {recentWeight.length > 0 ? (
            <WeightChart />
          ) : (
            <div className="empty-state">
              <Scale className="empty-state-icon" />
              <p className="empty-state-title">No weight data yet</p>
              <p className="empty-state-description">
                Import data from Apple Health or add manual entries to see your weight trend
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Entry */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Add Weight</h3>
          </div>
          <div className="card-body">
            <WeightEntry />
          </div>
        </div>

        {/* Trend Analysis */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Analysis</h3>
          </div>
          <div className="card-body">
            <TrendAnalysis />
          </div>
        </div>
      </div>

      {/* Stats Table */}
      {recentWeight.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Statistics</h3>
          </div>
          <div className="card-body">
            <WeightStats />
          </div>
        </div>
      )}
    </div>
  );
}
