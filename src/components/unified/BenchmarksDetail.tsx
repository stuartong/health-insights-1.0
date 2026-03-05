import { Trophy, Dumbbell, Timer, MessageCircle, Target } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { getAllWorkouts } from '@/db/database';
import type { Workout } from '@/types';

interface Props {
  onAskAI: (context: string) => void;
}

// Standard distances for race predictions
const STANDARD_DISTANCES = [
  { meters: 1000, label: '1K' },
  { meters: 1609, label: '1 Mile' },
  { meters: 5000, label: '5K' },
  { meters: 10000, label: '10K' },
  { meters: 21097, label: 'Half Marathon' },
  { meters: 42195, label: 'Marathon' },
];

function formatPace(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Riegel formula for race prediction
function predictTime(knownTime: number, knownDist: number, targetDist: number): number {
  return knownTime * Math.pow(targetDist / knownDist, 1.06);
}

// Estimate 1RM using Epley formula
function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Normalize exercise names to handle variations
function normalizeExerciseName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove trailing 's' for plurals
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && !normalized.endsWith('press')) {
    normalized = normalized.slice(0, -1);
  }

  // Common variations mapping
  const variations: Record<string, string> = {
    'deadlift': 'deadlift',
    'dead lift': 'deadlift',
    'dl': 'deadlift',
    'bench press': 'bench press',
    'benchpress': 'bench press',
    'bench': 'bench press',
    'bp': 'bench press',
    'squat': 'squat',
    'back squat': 'squat',
    'barbell squat': 'squat',
    'overhead press': 'overhead press',
    'ohp': 'overhead press',
    'shoulder press': 'overhead press',
    'military press': 'overhead press',
    'press': 'overhead press',
    'barbell row': 'barbell row',
    'bent over row': 'barbell row',
    'row': 'barbell row',
    'pullup': 'pull-up',
    'pull up': 'pull-up',
    'pull-up': 'pull-up',
    'chin up': 'chin-up',
    'chinup': 'chin-up',
    'chin-up': 'chin-up',
    'romanian deadlift': 'romanian deadlift',
    'rdl': 'romanian deadlift',
    'front squat': 'front squat',
    'hip thrust': 'hip thrust',
    'lunge': 'lunge',
    'leg press': 'leg press',
    'lat pulldown': 'lat pulldown',
    'cable row': 'cable row',
    'dumbbell row': 'dumbbell row',
    'db row': 'dumbbell row',
  };

  // Check for exact match first
  if (variations[normalized]) {
    return variations[normalized];
  }

  // Check for partial matches
  for (const [variant, canonical] of Object.entries(variations)) {
    if (normalized.includes(variant) || variant.includes(normalized)) {
      return canonical;
    }
  }

  return normalized;
}

// Format exercise name for display
function formatExerciseName(name: string): string {
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function BenchmarksDetail({ onAskAI }: Props) {
  const { recentWorkouts } = useHealthStore();
  const { apiKeys } = useSettingsStore();
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch ALL workouts for strength PRs
  useEffect(() => {
    getAllWorkouts().then(workouts => {
      setAllWorkouts(workouts);
      setIsLoading(false);
    }).catch(err => {
      console.error('Error fetching all workouts:', err);
      setIsLoading(false);
    });
  }, [recentWorkouts]); // Re-fetch when recentWorkouts changes (new sync)

  // Use Strava PRs directly from API (all-time bests)
  const stravaPRs = apiKeys.stravaRunningPRs || [];

  // Convert Strava PRs to display format
  const runningPRs = stravaPRs.map(pr => ({
    distance: pr.distance,
    meters: pr.distanceMeters,
    time: pr.time,
    pace: pr.time / (pr.distanceMeters / 1000),
    date: new Date(pr.date),
    activityId: pr.activityId,
  })).sort((a, b) => a.meters - b.meters);

  // Generate race predictions from best PR
  const predictions: { distance: string; predicted: string; pace: string }[] = [];
  if (runningPRs.length > 0) {
    // Use the most recent PR for predictions
    const basePR = runningPRs.find(pr => pr.meters >= 5000) || runningPRs[0];

    for (const dist of STANDARD_DISTANCES) {
      if (dist.meters !== basePR.meters) {
        const predictedSeconds = predictTime(basePR.time, basePR.meters, dist.meters);
        const predictedPace = predictedSeconds / (dist.meters / 1000);
        predictions.push({
          distance: dist.label,
          predicted: formatTime(predictedSeconds),
          pace: formatPace(predictedPace),
        });
      }
    }
  }

  // Get strength data from ALL workouts that have exercises (not limited to "strength" type)
  // Users might log lifts in CrossTraining, Workout, or other activity types
  const strengthWorkouts = allWorkouts.filter(w =>
    w.exercises && w.exercises.length > 0
  );

  // Aggregate all lifts with normalized exercise names - group by session (day)
  const liftsByExercise = new Map<string, Map<string, { weight: number; reps: number; date: Date; est1RM: number }[]>>();

  strengthWorkouts.forEach(w => {
    const sessionDate = format(new Date(w.date), 'yyyy-MM-dd');
    w.exercises?.forEach(ex => {
      const key = normalizeExerciseName(ex.exercise);
      if (!liftsByExercise.has(key)) {
        liftsByExercise.set(key, new Map());
      }
      const exerciseMap = liftsByExercise.get(key)!;
      if (!exerciseMap.has(sessionDate)) {
        exerciseMap.set(sessionDate, []);
      }
      exerciseMap.get(sessionDate)!.push({
        weight: ex.weight,
        reps: ex.reps,
        date: new Date(w.date),
        est1RM: estimate1RM(ex.weight, ex.reps),
      });
    });
  });

  // Get PRs and build progression data - one point per session showing max weight that day
  const strengthPRs = Array.from(liftsByExercise.entries())
    .map(([exercise, sessionMap]) => {
      // Convert sessions to array with max weight per session
      const sessions = Array.from(sessionMap.entries())
        .map(([dateStr, lifts]) => {
          const maxLift = lifts.reduce((max, lift) =>
            lift.weight > max.weight ? lift : max
          );
          const maxEst1RM = lifts.reduce((max, lift) =>
            lift.est1RM > max.est1RM ? lift : max
          );
          return {
            date: new Date(dateStr),
            maxWeight: maxLift.weight,
            maxReps: maxLift.reps,
            maxEst1RM: Math.round(maxEst1RM.est1RM),
            setCount: lifts.length,
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      // Find all-time best
      const best = sessions.reduce((max, s) =>
        s.maxEst1RM > max.maxEst1RM ? s : max
      );

      // Build progression chart data - running max over time
      let runningMax = 0;
      const history = sessions.map(s => {
        runningMax = Math.max(runningMax, s.maxWeight);
        return {
          date: format(s.date, 'MMM d'),
          sessionMax: s.maxWeight,
          runningMax,
          sets: s.setCount,
        };
      });

      const totalSets = sessions.reduce((sum, s) => sum + s.setCount, 0);

      return {
        exercise: formatExerciseName(exercise),
        weight: best.maxWeight,
        reps: best.maxReps,
        est1RM: best.maxEst1RM,
        date: best.date,
        totalSets,
        sessionCount: sessions.length,
        history,
      };
    })
    .filter(pr => pr.totalSets >= 1)
    .sort((a, b) => b.est1RM - a.est1RM);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        <span className="ml-3 text-gray-600">Loading all-time PRs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
        <div className="flex items-center gap-3 mb-2">
          <Trophy size={24} className="text-amber-600" />
          <h1 className="text-2xl font-bold text-gray-900">All-Time Personal Bests</h1>
        </div>
        <p className="text-gray-600">Track your all-time best performances and predict future races</p>
      </div>

      {/* Running PRs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Timer size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">Running Personal Records</h2>
        </div>

        {runningPRs.length === 0 ? (
          <div className="text-center py-8">
            <Timer size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No running PRs found</p>
            <p className="text-gray-400 text-sm mt-1">
              Sync your Strava data to import your best efforts for 5K, 10K, etc.
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Go to Settings → Data Import → Strava → Sync Data & PRs
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {runningPRs.map(pr => (
                <div key={pr.distance} className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 font-semibold mb-2">{pr.distance}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatTime(pr.time)}</p>
                  <p className="text-sm text-gray-600">{formatPace(pr.pace)}/km</p>
                  <p className="text-xs text-gray-400 mt-2">{format(pr.date, 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Race Predictions */}
      {predictions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={20} className="text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900">Race Predictions</h2>
            <span className="text-xs text-gray-500">(Riegel formula)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {predictions.map(pred => (
              <div key={pred.distance} className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-sm text-purple-600 font-medium mb-1">{pred.distance}</p>
                <p className="text-xl font-bold text-gray-900">{pred.predicted}</p>
                <p className="text-xs text-gray-500">{pred.pace}/km</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Predictions based on your {runningPRs[0]?.distance} PR. Actual times depend on course, conditions, and pacing.
          </p>
        </div>
      )}

      {/* Strength PRs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Dumbbell size={20} className="text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900">Strength Benchmarks</h2>
        </div>

        {strengthPRs.length === 0 ? (
          <div className="text-center py-8">
            <Dumbbell size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No strength data recorded yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Add lift data to Strava descriptions (e.g., "Squat 3x5 100kg")
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {strengthPRs.slice(0, 6).map(lift => (
              <div key={lift.exercise} className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{lift.exercise}</p>
                    <p className="text-xs text-gray-500">{lift.sessionCount} sessions • {lift.totalSets} total sets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{lift.weight}kg</p>
                    <p className="text-xs text-gray-500">
                      {lift.reps} reps • Est. 1RM: {lift.est1RM}kg
                    </p>
                    <p className="text-xs text-gray-400">PR on {format(lift.date, 'MMM d, yyyy')}</p>
                  </div>
                </div>

                {/* Max weight progression chart - one point per session */}
                {lift.history.length >= 2 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">Weight Progression (max per session)</p>
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lift.history}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} width={35} />
                          <Tooltip
                            formatter={(v: number, name: string) => [
                              `${v}kg`,
                              name === 'runningMax' ? 'All-Time Max' : 'Session Max'
                            ]}
                            labelFormatter={(label) => `Session: ${label}`}
                          />
                          <Line
                            type="stepAfter"
                            dataKey="runningMax"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={false}
                            name="All-Time Max"
                          />
                          <Line
                            type="monotone"
                            dataKey="sessionMax"
                            stroke="#86efac"
                            strokeWidth={1}
                            dot={{ r: 4, fill: '#86efac', strokeWidth: 1, stroke: '#22c55e' }}
                            name="Session Max"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {strengthPRs.length > 6 && (
              <p className="text-sm text-gray-500 text-center">
                + {strengthPRs.length - 6} more exercises
              </p>
            )}
          </div>
        )}
      </div>

      {/* How to Add Data */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">How to Track Lift Data</h3>
        <p className="text-sm text-gray-600 mb-3">
          Add your lifts to Strava activity descriptions using these formats:
        </p>
        <div className="bg-white rounded-lg p-3 font-mono text-sm text-gray-700 space-y-1">
          <p>Squat 3x5 100kg</p>
          <p>Bench Press: 80kg x 5 x 3</p>
          <p>Deadlift 140kg 5 reps</p>
          <p>OHP 4x8 @ 50kg</p>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Re-sync Strava to import lift data from activity descriptions.
        </p>
      </div>

      {/* Actions */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <button
          onClick={() => onAskAI('Based on my current PRs, create a training plan to improve my weaknesses')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Get Personalized Training Plan
        </button>
      </div>
    </div>
  );
}
