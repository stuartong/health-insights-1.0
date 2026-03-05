import { useMemo } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  extractRunningPRs,
  predictAllRaceTimes,
  formatTime,
  calculateTrainingPaces,
  raceDistances,
} from '@/algorithms/predictions';
import { formatPace } from '@/utils/formatters';
import { Trophy, Target, TrendingUp, Timer } from 'lucide-react';

export function RunningBenchmarks() {
  const { recentWorkouts } = useHealthStore();
  const { settings } = useSettingsStore();

  const data = useMemo(() => {
    const runWorkouts = recentWorkouts.filter((w) => w.type === 'run' && w.distance && w.duration);
    if (runWorkouts.length === 0) return null;

    const prs = extractRunningPRs(runWorkouts);

    // Get the best PR to use for predictions
    const bestPR = prs.find((pr) => pr.distanceLabel === '5K') || prs[0];

    let predictions: Record<string, number> | null = null;
    let trainingPaces: ReturnType<typeof calculateTrainingPaces> | null = null;

    if (bestPR) {
      predictions = predictAllRaceTimes(
        bestPR.distance,
        bestPR.time,
        'recreational'
      );
      trainingPaces = calculateTrainingPaces(bestPR.distance, bestPR.time);
    }

    return { prs, predictions, trainingPaces, bestPR };
  }, [recentWorkouts]);

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Timer className="mx-auto mb-2" size={32} />
        <p>No running data available</p>
        <p className="text-sm mt-1">Import run data from Apple Health or Strava</p>
      </div>
    );
  }

  const unit = settings.units.distance;

  return (
    <div className="space-y-6">
      {/* Current PRs */}
      <div>
        <h4 className="flex items-center gap-2 font-medium text-gray-900 mb-4">
          <Trophy className="text-yellow-500" size={20} />
          Personal Records
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.prs.map((pr) => (
            <div key={pr.distanceLabel} className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-sm text-gray-600 mb-1">{pr.distanceLabel}</p>
              <p className="text-xl font-bold text-gray-900">{formatTime(pr.time)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPace(pr.pace, unit)}
              </p>
            </div>
          ))}

          {/* Placeholder for distances without PRs */}
          {Object.entries(raceDistances)
            .filter(([label]) => !data.prs.find((pr) => pr.distanceLabel === label))
            .map(([label]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-300">--:--</p>
                <p className="text-xs text-gray-400 mt-1">No data</p>
              </div>
            ))}
        </div>
      </div>

      {/* Race Time Predictions */}
      {data.predictions && data.bestPR && (
        <div>
          <h4 className="flex items-center gap-2 font-medium text-gray-900 mb-4">
            <Target className="text-primary-500" size={20} />
            Race Time Predictions
            <span className="text-xs text-gray-400 font-normal">
              (based on {data.bestPR.distanceLabel} PR)
            </span>
          </h4>
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(data.predictions).map(([distance, time]) => {
                const existingPR = data.prs.find((pr) => pr.distanceLabel === distance);
                const isFaster = existingPR && time < existingPR.time;

                return (
                  <div key={distance} className="text-center">
                    <p className="text-sm text-primary-600 mb-1">{distance}</p>
                    <p className="text-lg font-bold text-primary-900">{formatTime(time)}</p>
                    {existingPR && (
                      <p className={`text-xs mt-1 ${isFaster ? 'text-success-600' : 'text-gray-500'}`}>
                        {isFaster ? '✓ Achievable' : 'Current PR'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Training Paces */}
      {data.trainingPaces && (
        <div>
          <h4 className="flex items-center gap-2 font-medium text-gray-900 mb-4">
            <TrendingUp className="text-success-500" size={20} />
            Suggested Training Paces
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
              <p className="text-xs text-green-600 mb-1">Easy</p>
              <p className="text-sm font-bold text-green-800">
                {formatPace(data.trainingPaces.easy.min, unit)} - {formatPace(data.trainingPaces.easy.max, unit).split('/')[0]}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
              <p className="text-xs text-blue-600 mb-1">Marathon</p>
              <p className="text-sm font-bold text-blue-800">
                {formatPace(data.trainingPaces.marathon, unit)}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 text-center">
              <p className="text-xs text-yellow-600 mb-1">Threshold</p>
              <p className="text-sm font-bold text-yellow-800">
                {formatPace(data.trainingPaces.threshold, unit)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-center">
              <p className="text-xs text-orange-600 mb-1">Interval</p>
              <p className="text-sm font-bold text-orange-800">
                {formatPace(data.trainingPaces.interval, unit)}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
              <p className="text-xs text-red-600 mb-1">Repetition</p>
              <p className="text-sm font-bold text-red-800">
                {formatPace(data.trainingPaces.repetition, unit)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
