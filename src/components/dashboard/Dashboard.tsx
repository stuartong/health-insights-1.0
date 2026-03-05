import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { MetricCard } from './MetricCard';
import { InsightCard } from './InsightCard';
import { QuickStats } from './QuickStats';
import { RecentActivity } from './RecentActivity';
import {
  Activity,
  Moon,
  Heart,
  Scale,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { formatDuration, formatWeight, formatHRV } from '@/utils/formatters';
import { getRiskZoneColor } from '@/algorithms/acwr';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const {
    recentWorkouts,
    recentSleep,
    recentHRV,
    weightTrend,
    trainingLoad,
    insights,
    hasAppleHealthData,
    hasOuraData,
    hasStravaData,
  } = useHealthStore();
  const { demoMode } = useSettingsStore();

  const hasAnyData = hasAppleHealthData || hasOuraData || hasStravaData || demoMode.enabled;

  // Calculate quick stats
  const last7DaysWorkouts = recentWorkouts.filter((w) => {
    const daysDiff = (Date.now() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });
  const totalWorkoutMinutes = last7DaysWorkouts.reduce((sum, w) => sum + w.duration, 0);
  const workoutCount = last7DaysWorkouts.length;

  const avgSleep = recentSleep.length > 0
    ? recentSleep.slice(0, 7).reduce((sum, s) => sum + s.duration, 0) / Math.min(7, recentSleep.length)
    : null;

  const latestHRV = recentHRV.length > 0 ? recentHRV[0].value : null;
  const hrvBaseline = recentHRV.length >= 7
    ? recentHRV.slice(0, 7).reduce((sum, h) => sum + h.value, 0) / 7
    : null;

  if (!hasAnyData) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Activity className="mx-auto text-gray-300 mb-4" size={64} />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Health Insights</h2>
        <p className="text-gray-600 mb-6">
          Connect your health data sources to get started with personalized insights and coaching.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/import" className="btn btn-primary">
            Import Your Data
          </Link>
          <Link to="/settings" className="btn btn-secondary">
            Enable Demo Mode
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Activity className="text-primary-500" />}
          label="This Week"
          value={formatDuration(totalWorkoutMinutes)}
          subvalue={`${workoutCount} workouts`}
          trend={workoutCount > 3 ? 'up' : workoutCount > 0 ? 'neutral' : 'down'}
        />

        <MetricCard
          icon={<Moon className="text-purple-500" />}
          label="Avg Sleep"
          value={avgSleep ? formatDuration(avgSleep) : '--'}
          subvalue="last 7 nights"
          trend={avgSleep && avgSleep > 420 ? 'up' : avgSleep && avgSleep > 360 ? 'neutral' : 'down'}
        />

        <MetricCard
          icon={<Heart className="text-danger-500" />}
          label="HRV"
          value={latestHRV ? formatHRV(latestHRV) : '--'}
          subvalue={hrvBaseline ? `Baseline: ${Math.round(hrvBaseline)}ms` : undefined}
          trend={latestHRV && hrvBaseline && latestHRV >= hrvBaseline ? 'up' : 'down'}
        />

        <MetricCard
          icon={<Scale className="text-success-500" />}
          label="Weight"
          value={weightTrend ? formatWeight(weightTrend.current, 'kg') : '--'}
          subvalue={weightTrend ? `${weightTrend.weekChange > 0 ? '+' : ''}${weightTrend.weekChange.toFixed(1)}kg this week` : undefined}
          trend={weightTrend?.trendDirection === 'down' ? 'up' : weightTrend?.trendDirection === 'up' ? 'down' : 'neutral'}
        />
      </div>

      {/* Training Status Card */}
      {trainingLoad && (
        <div
          className="card p-6 border-l-4"
          style={{ borderLeftColor: getRiskZoneColor(trainingLoad.riskZone) }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Zap size={24} style={{ color: getRiskZoneColor(trainingLoad.riskZone) }} />
              <div>
                <p className="font-semibold text-gray-900">
                  Training Load: {trainingLoad.riskZone.charAt(0).toUpperCase() + trainingLoad.riskZone.slice(1)}
                </p>
                <p className="text-sm text-gray-600">
                  ACWR: {trainingLoad.acwr.toFixed(2)} • Trend: {trainingLoad.trend}
                </p>
              </div>
            </div>
            <Link to="/training" className="btn btn-secondary btn-sm">
              View Details
            </Link>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Insights */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Insights</h3>
            <span className="badge badge-info">{insights.length} new</span>
          </div>
          <div className="card-body space-y-3">
            {insights.length > 0 ? (
              insights.slice(0, 4).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <TrendingUp className="mx-auto mb-2" size={24} />
                <p className="text-sm">Insights will appear as patterns are detected</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Weekly Summary</h3>
          </div>
          <div className="card-body">
            <QuickStats />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          <Link to="/training" className="text-sm text-primary-600 hover:text-primary-700">
            View All
          </Link>
        </div>
        <div className="card-body">
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
