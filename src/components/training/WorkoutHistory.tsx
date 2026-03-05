import { useState } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { formatRelativeDate } from '@/utils/dateUtils';
import { formatDuration, formatDistance, formatPace, formatHeartRate } from '@/utils/formatters';
import { useSettingsStore } from '@/stores/settingsStore';
import { Activity, Timer, MapPin, Heart, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkoutType } from '@/types';

const workoutTypeIcons: Record<WorkoutType, { icon: string; color: string }> = {
  run: { icon: '🏃', color: 'bg-blue-100 text-blue-700' },
  cycle: { icon: '🚴', color: 'bg-green-100 text-green-700' },
  swim: { icon: '🏊', color: 'bg-cyan-100 text-cyan-700' },
  strength: { icon: '🏋️', color: 'bg-purple-100 text-purple-700' },
  walk: { icon: '🚶', color: 'bg-gray-100 text-gray-700' },
  hike: { icon: '🥾', color: 'bg-amber-100 text-amber-700' },
  other: { icon: '💪', color: 'bg-gray-100 text-gray-700' },
};

export function WorkoutHistory() {
  const [showAll, setShowAll] = useState(false);
  const { recentWorkouts } = useHealthStore();
  const { settings } = useSettingsStore();

  const displayedWorkouts = showAll ? recentWorkouts : recentWorkouts.slice(0, 10);

  if (recentWorkouts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="mx-auto mb-2" size={32} />
        <p>No workouts recorded yet</p>
        <p className="text-sm mt-1">Import data from Apple Health or Strava to see your workouts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayedWorkouts.map((workout) => {
        const typeInfo = workoutTypeIcons[workout.type] || workoutTypeIcons.other;
        const distanceUnit = settings.units.distance;

        return (
          <div
            key={workout.id}
            className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {/* Type Icon */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.color}`}
            >
              <span className="text-lg">{typeInfo.icon}</span>
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {workout.name || workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                </span>
                <span className="text-xs text-gray-400 capitalize">
                  {workout.source === 'apple_health' ? 'Apple' : workout.source}
                </span>
              </div>
              <p className="text-sm text-gray-500">{formatRelativeDate(workout.date)}</p>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <Timer size={14} />
                <span>{formatDuration(workout.duration)}</span>
              </div>

              {workout.distance && workout.distance > 0 && (
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin size={14} />
                  <span>{formatDistance(workout.distance, distanceUnit)}</span>
                </div>
              )}

              {workout.avgPace && workout.type === 'run' && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Zap size={14} />
                  <span>{formatPace(workout.avgPace, distanceUnit)}</span>
                </div>
              )}

              {workout.avgHeartRate && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Heart size={14} />
                  <span>{formatHeartRate(workout.avgHeartRate)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Show More/Less */}
      {recentWorkouts.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp size={16} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Show All ({recentWorkouts.length} workouts)
            </>
          )}
        </button>
      )}
    </div>
  );
}
