import { Trophy, Dumbbell, Timer, TrendingUp, MessageCircle, ChevronRight } from 'lucide-react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { getAllWorkouts } from '@/db/database';
import type { Workout } from '@/types';

interface Props {
  onViewDetails: () => void;
  onAskAI: (context: string) => void;
}

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

  if (variations[normalized]) {
    return variations[normalized];
  }

  for (const [variant, canonical] of Object.entries(variations)) {
    if (normalized.includes(variant) || variant.includes(normalized)) {
      return canonical;
    }
  }

  return normalized;
}

function formatExerciseName(name: string): string {
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function BenchmarksSummary({ onViewDetails, onAskAI }: Props) {
  const { recentWorkouts } = useHealthStore();
  const { apiKeys } = useSettingsStore();
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);

  // Fetch ALL workouts for strength PRs
  useEffect(() => {
    getAllWorkouts().then(workouts => {
      setAllWorkouts(workouts);
    }).catch(err => {
      console.error('Error fetching all workouts:', err);
    });
  }, [recentWorkouts]); // Re-fetch when recentWorkouts changes (new sync)

  // Use Strava PRs directly from API (all-time bests)
  const stravaPRs = apiKeys.stravaRunningPRs || [];

  // Common race distances we want to display (Strava uses these exact names)
  const raceDistances = ['1k', '1 mile', '5k', '10k', 'Half-Marathon', 'Marathon'];

  // Convert Strava PRs to display format - filter to common race distances
  const runningPRs = stravaPRs
    .filter(pr => raceDistances.some(d => pr.distance.toLowerCase() === d.toLowerCase()))
    .map(pr => ({
      distance: pr.distance,
      time: pr.time,
      pace: pr.time / (pr.distanceMeters / 1000),
      date: new Date(pr.date),
    }))
    .sort((a, b) => a.time - b.time) // Sort by time (shorter distances first)
    .slice(0, 4); // Show top 4

  // Get strength benchmarks from ALL workouts with exercises (not limited to strength type)
  // Users might log lifts in CrossTraining, Workout, or other activity types
  const strengthWorkouts = allWorkouts.filter(w =>
    w.exercises && w.exercises.length > 0
  );

  // Estimate 1RM using Epley formula (same as BenchmarksDetail)
  const estimate1RM = (weight: number, reps: number): number => {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  };

  // Aggregate by exercise, then by session, find best session max
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

  // Get best PR per exercise (highest est1RM)
  const strengthBenchmarks = Array.from(liftsByExercise.entries())
    .map(([exercise, sessionMap]) => {
      // Find best session (highest est1RM in any session)
      let best = { weight: 0, reps: 0, date: new Date(), est1RM: 0 };
      sessionMap.forEach(lifts => {
        const sessionBest = lifts.reduce((max, lift) =>
          lift.est1RM > max.est1RM ? lift : max
        );
        if (sessionBest.est1RM > best.est1RM) {
          best = sessionBest;
        }
      });
      return {
        exercise: formatExerciseName(exercise),
        weight: best.weight,
        reps: best.reps,
        date: best.date,
        est1RM: Math.round(best.est1RM),
      };
    })
    .filter(pr => pr.weight > 0)
    .sort((a, b) => b.est1RM - a.est1RM) // Sort by estimated 1RM
    .slice(0, 4); // Top 4 lifts

  const hasData = runningPRs.length > 0 || strengthBenchmarks.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={20} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Benchmarks</h2>
        </div>
        <div className="text-center py-6">
          <Trophy size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">
            Complete races or log strength workouts to track your benchmarks
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Add lift data in Strava activity descriptions (e.g., "Squat 3x5 100kg")
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            <span className="font-semibold text-gray-900">Personal Bests</span>
          </div>
          <button
            onClick={onViewDetails}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            View All
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Running PRs */}
        {runningPRs.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={16} className="text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Running PRs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {runningPRs.map(pr => (
                <div key={pr.distance} className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium mb-1">{pr.distance}</p>
                  <p className="text-lg font-bold text-gray-900">{formatTime(pr.time)}</p>
                  <p className="text-xs text-gray-500">{formatPace(pr.pace)}/km</p>
                  <p className="text-xs text-gray-400 mt-1">{format(pr.date, 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strength Benchmarks */}
        {strengthBenchmarks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell size={16} className="text-green-500" />
              <span className="text-sm font-medium text-gray-700">Strength PRs</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {strengthBenchmarks.map(lift => (
                <div key={lift.exercise} className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600 font-medium mb-1">{lift.exercise}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {lift.weight}kg
                    <span className="text-sm font-normal text-gray-500 ml-1">× {lift.reps}</span>
                  </p>
                  <p className="text-xs text-gray-400">{format(lift.date, 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onAskAI('Based on my PRs, what should I focus on to improve?')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <MessageCircle size={14} />
            Get Training Tips
          </button>
          {runningPRs.length > 0 && (
            <button
              onClick={() => onAskAI('Predict my race times based on my current PRs')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <TrendingUp size={14} />
              Race Predictions
            </button>
          )}
          {strengthBenchmarks.length > 0 && (
            <button
              onClick={() => onAskAI('Analyze my strength benchmarks and suggest a program to improve my weak points')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Dumbbell size={14} />
              Strength Program
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
