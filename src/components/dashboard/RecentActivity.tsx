import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatRelativeDate } from '@/utils/dateUtils';
import { formatDuration, formatDistance, formatPace } from '@/utils/formatters';
import type { WorkoutType } from '@/types';

const workoutEmojis: Record<WorkoutType, string> = {
  run: '🏃',
  cycle: '🚴',
  swim: '🏊',
  strength: '🏋️',
  walk: '🚶',
  hike: '🥾',
  other: '💪',
};

export function RecentActivity() {
  const { recentWorkouts, recentSleep } = useHealthStore();
  const { settings } = useSettingsStore();

  // Combine and sort recent activity
  const activities = [
    ...recentWorkouts.slice(0, 5).map((w) => ({
      id: w.id,
      type: 'workout' as const,
      date: w.date,
      data: w,
    })),
    ...recentSleep.slice(0, 3).map((s) => ({
      id: s.id,
      type: 'sleep' as const,
      date: s.date,
      data: s,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No recent activity</p>
        <p className="text-sm mt-1">Import data to see your activity feed</p>
      </div>
    );
  }

  const unit = settings.units.distance;

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        if (activity.type === 'workout') {
          const workout = activity.data;
          return (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-2xl">{workoutEmojis[workout.type]}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {workout.name || workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                </p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{formatDuration(workout.duration)}</span>
                  {workout.distance && <span>{formatDistance(workout.distance, unit)}</span>}
                  {workout.avgPace && workout.type === 'run' && (
                    <span>{formatPace(workout.avgPace, unit)}</span>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-400">{formatRelativeDate(activity.date)}</span>
            </div>
          );
        } else {
          const sleep = activity.data;
          return (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg"
            >
              <span className="text-2xl">😴</span>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Sleep</p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{formatDuration(sleep.duration)}</span>
                  {sleep.efficiency && <span>{sleep.efficiency.toFixed(0)}% efficiency</span>}
                  {sleep.score && <span>Score: {sleep.score}</span>}
                </div>
              </div>
              <span className="text-sm text-gray-400">{formatRelativeDate(activity.date)}</span>
            </div>
          );
        }
      })}
    </div>
  );
}
