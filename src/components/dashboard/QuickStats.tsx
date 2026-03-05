import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatDuration, formatDistance } from '@/utils/formatters';
import { Activity, Timer, MapPin, Flame, Moon, Heart } from 'lucide-react';

export function QuickStats() {
  const { recentWorkouts, recentSleep, recentHRV } = useHealthStore();
  const { settings } = useSettingsStore();

  // Last 7 days stats
  const last7DaysWorkouts = recentWorkouts.filter((w) => {
    const daysDiff = (Date.now() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });

  const stats = {
    workouts: last7DaysWorkouts.length,
    duration: last7DaysWorkouts.reduce((sum, w) => sum + w.duration, 0),
    distance: last7DaysWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0),
    calories: last7DaysWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0),
    avgSleep: recentSleep.length > 0
      ? recentSleep.slice(0, 7).reduce((sum, s) => sum + s.duration, 0) / Math.min(7, recentSleep.length)
      : 0,
    avgHRV: recentHRV.length > 0
      ? recentHRV.slice(0, 7).reduce((sum, h) => sum + h.value, 0) / Math.min(7, recentHRV.length)
      : 0,
  };

  const unit = settings.units.distance;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Activity className="text-primary-500" size={20} />
        <div>
          <p className="text-lg font-bold text-gray-900">{stats.workouts}</p>
          <p className="text-xs text-gray-500">Workouts</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Timer className="text-blue-500" size={20} />
        <div>
          <p className="text-lg font-bold text-gray-900">{formatDuration(stats.duration)}</p>
          <p className="text-xs text-gray-500">Active Time</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <MapPin className="text-green-500" size={20} />
        <div>
          <p className="text-lg font-bold text-gray-900">{formatDistance(stats.distance, unit)}</p>
          <p className="text-xs text-gray-500">Distance</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Flame className="text-orange-500" size={20} />
        <div>
          <p className="text-lg font-bold text-gray-900">{stats.calories.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Calories</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Moon className="text-purple-500" size={20} />
        <div>
          <p className="text-lg font-bold text-gray-900">
            {stats.avgSleep > 0 ? formatDuration(stats.avgSleep) : '--'}
          </p>
          <p className="text-xs text-gray-500">Avg Sleep</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Heart className="text-danger-500" size={20} />
        <div>
          <p className="text-lg font-bold text-gray-900">
            {stats.avgHRV > 0 ? `${Math.round(stats.avgHRV)} ms` : '--'}
          </p>
          <p className="text-xs text-gray-500">Avg HRV</p>
        </div>
      </div>
    </div>
  );
}
