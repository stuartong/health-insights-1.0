import { ACWRChart } from './ACWRChart';
import { RecoveryStatus } from './RecoveryStatus';
import { WorkoutHistory } from './WorkoutHistory';
import { WeeklyLoadChart } from './WeeklyLoadChart';
import { useHealthStore } from '@/stores/healthStore';
import { Activity, Zap, Heart, Moon } from 'lucide-react';
import { getRiskZoneColor, getRiskZoneDescription } from '@/algorithms/acwr';
import { formatDuration } from '@/utils/formatters';

export function TrainingPage() {
  const { trainingLoad, recentWorkouts, recentSleep, recentHRV } = useHealthStore();

  // Calculate recent stats
  const last7DaysWorkouts = recentWorkouts.filter((w) => {
    const daysDiff = (Date.now() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });

  const totalDuration = last7DaysWorkouts.reduce((sum, w) => sum + w.duration, 0);
  const totalDistance = last7DaysWorkouts
    .filter((w) => w.distance)
    .reduce((sum, w) => sum + (w.distance || 0), 0);

  const avgSleep = recentSleep.length > 0
    ? recentSleep.slice(0, 7).reduce((sum, s) => sum + s.duration, 0) / Math.min(7, recentSleep.length)
    : null;

  const latestHRV = recentHRV.length > 0 ? recentHRV[0].value : null;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={20} className="text-primary-500" />
            <span className="text-sm text-gray-500">ACWR</span>
          </div>
          <p className="metric-value">
            {trainingLoad ? trainingLoad.acwr.toFixed(2) : '--'}
          </p>
          {trainingLoad && (
            <span
              className="badge mt-1"
              style={{
                backgroundColor: `${getRiskZoneColor(trainingLoad.riskZone)}20`,
                color: getRiskZoneColor(trainingLoad.riskZone),
              }}
            >
              {trainingLoad.riskZone}
            </span>
          )}
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={20} className="text-success-500" />
            <span className="text-sm text-gray-500">7-Day Volume</span>
          </div>
          <p className="metric-value">{formatDuration(totalDuration)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {last7DaysWorkouts.length} workouts • {(totalDistance / 1000).toFixed(1)}km
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Moon size={20} className="text-purple-500" />
            <span className="text-sm text-gray-500">Avg Sleep</span>
          </div>
          <p className="metric-value">
            {avgSleep ? formatDuration(avgSleep) : '--'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Last 7 nights</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={20} className="text-danger-500" />
            <span className="text-sm text-gray-500">Latest HRV</span>
          </div>
          <p className="metric-value">
            {latestHRV ? `${Math.round(latestHRV)} ms` : '--'}
          </p>
          <p className="text-xs text-gray-400 mt-1">RMSSD</p>
        </div>
      </div>

      {/* ACWR Description */}
      {trainingLoad && (
        <div
          className="card p-4 border-l-4"
          style={{ borderLeftColor: getRiskZoneColor(trainingLoad.riskZone) }}
        >
          <p className="text-sm text-gray-700">
            {getRiskZoneDescription(trainingLoad.riskZone)}
          </p>
        </div>
      )}

      {/* Recovery Status */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Recovery Status</h3>
          <p className="text-sm text-gray-500">Today's readiness for training</p>
        </div>
        <div className="card-body">
          <RecoveryStatus />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACWR Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Training Load History</h3>
            <p className="text-sm text-gray-500">Acute:Chronic Workload Ratio over time</p>
          </div>
          <div className="card-body">
            <ACWRChart />
          </div>
        </div>

        {/* Weekly Load */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Weekly Volume</h3>
            <p className="text-sm text-gray-500">Training duration by week</p>
          </div>
          <div className="card-body">
            <WeeklyLoadChart />
          </div>
        </div>
      </div>

      {/* Workout History */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Recent Workouts</h3>
        </div>
        <div className="card-body">
          <WorkoutHistory />
        </div>
      </div>
    </div>
  );
}
