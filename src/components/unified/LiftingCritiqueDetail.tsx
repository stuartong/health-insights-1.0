import { Dumbbell, Target, TrendingUp, AlertTriangle, MessageCircle, Info, Edit3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useState, useEffect } from 'react';
import { getAllWorkouts, getManualLiftPRs } from '@/db/database';
import { LiftPREditor } from './LiftPREditor';
import type { Workout, PersonalRecord } from '@/types';

interface Props {
  onAskAI: (context: string) => void;
}

// Strength standards as multipliers of bodyweight (for males)
// These are approximate standards from various strength training sources
const STRENGTH_STANDARDS = {
  'bench press': {
    beginner: 0.5,
    novice: 0.75,
    intermediate: 1.0,
    advanced: 1.25,
    elite: 1.5,
    muscles: ['chest', 'triceps', 'front delts'],
  },
  'squat': {
    beginner: 0.75,
    novice: 1.0,
    intermediate: 1.5,
    advanced: 2.0,
    elite: 2.5,
    muscles: ['quads', 'glutes', 'core'],
  },
  'deadlift': {
    beginner: 1.0,
    novice: 1.25,
    intermediate: 1.75,
    advanced: 2.25,
    elite: 3.0,
    muscles: ['posterior chain', 'back', 'grip'],
  },
  'overhead press': {
    beginner: 0.35,
    novice: 0.5,
    intermediate: 0.65,
    advanced: 0.85,
    elite: 1.1,
    muscles: ['shoulders', 'triceps', 'core'],
  },
  'barbell row': {
    beginner: 0.4,
    novice: 0.6,
    intermediate: 0.8,
    advanced: 1.0,
    elite: 1.25,
    muscles: ['back', 'biceps', 'rear delts'],
  },
};

type Level = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

function getLevel(ratio: number, standards: { beginner: number; novice: number; intermediate: number; advanced: number; elite: number }): Level {
  if (ratio >= standards.elite) return 'elite';
  if (ratio >= standards.advanced) return 'advanced';
  if (ratio >= standards.intermediate) return 'intermediate';
  if (ratio >= standards.novice) return 'novice';
  return 'beginner';
}

function getPercentile(ratio: number, standards: { beginner: number; novice: number; intermediate: number; advanced: number; elite: number }): number {
  // Approximate percentile based on level
  if (ratio >= standards.elite) return 95 + Math.min(5, (ratio - standards.elite) / standards.elite * 10);
  if (ratio >= standards.advanced) return 80 + (ratio - standards.advanced) / (standards.elite - standards.advanced) * 15;
  if (ratio >= standards.intermediate) return 50 + (ratio - standards.intermediate) / (standards.advanced - standards.intermediate) * 30;
  if (ratio >= standards.novice) return 25 + (ratio - standards.novice) / (standards.intermediate - standards.novice) * 25;
  return Math.max(5, ratio / standards.novice * 25);
}

// Normalize exercise names
function normalizeExerciseName(name: string): string {
  const normalized = name.toLowerCase().trim();
  const variations: Record<string, string> = {
    'bench press': 'bench press', 'benchpress': 'bench press', 'bench': 'bench press', 'bp': 'bench press',
    'squat': 'squat', 'back squat': 'squat', 'backsquat': 'squat', 'barbell squat': 'squat', 'bs': 'squat',
    'deadlift': 'deadlift', 'dead lift': 'deadlift', 'dl': 'deadlift', 'deadlifts': 'deadlift',
    'overhead press': 'overhead press', 'ohp': 'overhead press', 'shoulder press': 'overhead press', 'military press': 'overhead press',
    'barbell row': 'barbell row', 'bent over row': 'barbell row', 'row': 'barbell row', 'rows': 'barbell row',
  };
  for (const [variant, canonical] of Object.entries(variations)) {
    if (normalized.includes(variant) || variant.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}

function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function LiftingCritiqueDetail({ onAskAI }: Props) {
  const { recentWorkouts, recentWeight, refreshData } = useHealthStore();
  const { profile } = useSettingsStore();
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [manualPRs, setManualPRs] = useState<PersonalRecord[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getAllWorkouts().then(setAllWorkouts).catch(console.error);
    getManualLiftPRs().then(setManualPRs).catch(console.error);
  }, [recentWorkouts, refreshKey]);

  // Get bodyweight from most recent entry
  const bodyweight = recentWeight[0]?.weight || null;

  // Calculate age from birthYear
  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - profile.birthYear : null;

  // Age coefficient for strength standards (based on IPF Masters coefficients)
  const getAgeCoefficient = (age: number | null): number => {
    if (!age) return 1.0;
    if (age < 23) return 1.0;
    if (age <= 40) return 1.0;
    if (age <= 45) return 1.034;
    if (age <= 50) return 1.075;
    if (age <= 55) return 1.123;
    if (age <= 60) return 1.180;
    if (age <= 65) return 1.246;
    if (age <= 70) return 1.322;
    if (age <= 75) return 1.410;
    if (age <= 80) return 1.510;
    return 1.625;
  };

  const ageCoefficient = getAgeCoefficient(age);

  // Get all strength workouts with exercises
  const strengthWorkouts = allWorkouts.filter(w => w.exercises && w.exercises.length > 0);

  // Calculate best lifts for major exercises (from parsed Strava data)
  const liftPRs = new Map<string, { weight: number; reps: number; est1RM: number; date: Date; source: 'parsed' | 'manual' }>();

  strengthWorkouts.forEach(w => {
    w.exercises?.forEach(ex => {
      const key = normalizeExerciseName(ex.exercise);
      const est1RM = estimate1RM(ex.weight, ex.reps);
      const existing = liftPRs.get(key);
      if (!existing || est1RM > existing.est1RM) {
        liftPRs.set(key, {
          weight: ex.weight,
          reps: ex.reps,
          est1RM,
          date: new Date(w.date),
          source: 'parsed',
        });
      }
    });
  });

  // Apply manual overrides (these take priority)
  manualPRs.forEach(pr => {
    const key = pr.category.toLowerCase();
    liftPRs.set(key, {
      weight: pr.value, // Manual PRs store est1RM as value
      reps: 1,
      est1RM: pr.value,
      date: new Date(pr.date),
      source: 'manual',
    });
  });

  // Build benchmarks for major lifts
  const benchmarks: {
    exercise: string;
    currentMax: number;
    reps: number;
    est1RM: number;
    bodyweightRatio: number;
    level: Level;
    percentile: number;
    ageAdjustedPercentile?: number;
    standards: typeof STRENGTH_STANDARDS['bench press'];
    targetNext: number;
    recommendation: string;
    source: 'parsed' | 'manual';
  }[] = [];

  const majorLifts = ['bench press', 'squat', 'deadlift', 'overhead press', 'barbell row'];

  majorLifts.forEach(lift => {
    const pr = liftPRs.get(lift);
    const standards = STRENGTH_STANDARDS[lift as keyof typeof STRENGTH_STANDARDS];

    if (pr && bodyweight && standards) {
      const ratio = pr.est1RM / bodyweight;

      // Raw percentile
      const rawPercentile = getPercentile(ratio, standards);

      // Age-adjusted: multiply ratio by age coefficient
      const ageAdjustedRatio = ratio * ageCoefficient;
      const ageAdjustedPercentile = age && age > 40 ? getPercentile(ageAdjustedRatio, standards) : rawPercentile;

      // Use age-adjusted for level determination if over 40
      const effectiveRatio = age && age > 40 ? ageAdjustedRatio : ratio;
      const level = getLevel(effectiveRatio, standards);

      // Calculate next target
      let targetRatio = standards.novice;
      if (level === 'novice') targetRatio = standards.intermediate;
      else if (level === 'intermediate') targetRatio = standards.advanced;
      else if (level === 'advanced') targetRatio = standards.elite;
      else if (level === 'elite') targetRatio = ratio * 1.05;

      const targetNext = Math.round(targetRatio * bodyweight);

      // Generate recommendation
      let recommendation = '';
      if (level === 'beginner') {
        recommendation = `Focus on form and progressive overload. Target ${targetNext}kg for novice level.`;
      } else if (level === 'novice') {
        recommendation = `Good foundation. Increase frequency to 2x/week and target ${targetNext}kg.`;
      } else if (level === 'intermediate') {
        recommendation = `Solid strength. Consider periodization to reach ${targetNext}kg.`;
      } else if (level === 'advanced') {
        recommendation = `Strong lift! Fine-tune technique for elite level at ${targetNext}kg.`;
      } else {
        recommendation = `Elite level! Maintain and focus on longevity.`;
      }

      benchmarks.push({
        exercise: lift.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        currentMax: pr.weight,
        reps: pr.reps,
        est1RM: Math.round(pr.est1RM),
        bodyweightRatio: ratio,
        level,
        percentile: rawPercentile,
        ageAdjustedPercentile: age && age > 40 ? ageAdjustedPercentile : undefined,
        standards,
        targetNext,
        recommendation,
        source: pr.source,
      });
    }
  });

  // Prepare data for editor
  const existingLiftsForEditor = Array.from(liftPRs.entries()).map(([key, pr]) => ({
    exercise: key,
    weight: pr.weight,
    reps: pr.reps,
    est1RM: pr.est1RM,
    source: pr.source,
  }));

  // Sort by effective percentile (weakest first for improvement focus)
  benchmarks.sort((a, b) => {
    const aPerc = a.ageAdjustedPercentile ?? a.percentile;
    const bPerc = b.ageAdjustedPercentile ?? b.percentile;
    return aPerc - bPerc;
  });

  // Calculate overall grade using age-adjusted percentiles
  let overallGrade = 'C';
  if (benchmarks.length > 0) {
    const avgPercentile = benchmarks.reduce((sum, b) => sum + (b.ageAdjustedPercentile ?? b.percentile), 0) / benchmarks.length;
    if (avgPercentile >= 90) overallGrade = 'A';
    else if (avgPercentile >= 75) overallGrade = 'B+';
    else if (avgPercentile >= 60) overallGrade = 'B';
    else if (avgPercentile >= 45) overallGrade = 'B-';
    else if (avgPercentile >= 35) overallGrade = 'C+';
    else if (avgPercentile >= 25) overallGrade = 'C';
    else overallGrade = 'C-';
  }

  // Identify weaknesses using effective percentile
  const weakLifts = benchmarks.filter(b => (b.ageAdjustedPercentile ?? b.percentile) < 40);

  // Identify muscle imbalances
  const imbalances: { area: string; issue: string; fix: string }[] = [];

  const benchPR = liftPRs.get('bench press');
  const rowPR = liftPRs.get('barbell row');
  if (benchPR && rowPR && bodyweight) {
    const benchRatio = benchPR.est1RM / bodyweight;
    const rowRatio = rowPR.est1RM / bodyweight;
    if (benchRatio > rowRatio * 1.3) {
      imbalances.push({
        area: 'Push/Pull',
        issue: 'Bench significantly stronger than rows',
        fix: 'Add more rowing volume. Aim for 1:1 push-to-pull ratio.',
      });
    }
  }

  const squatPR = liftPRs.get('squat');
  const deadliftPR = liftPRs.get('deadlift');
  if (squatPR && deadliftPR && bodyweight) {
    const squatRatio = squatPR.est1RM / bodyweight;
    const deadliftRatio = deadliftPR.est1RM / bodyweight;
    if (deadliftRatio > squatRatio * 1.5) {
      imbalances.push({
        area: 'Lower Body',
        issue: 'Deadlift much stronger than squat',
        fix: 'May indicate quad weakness. Add front squats and leg press.',
      });
    }
    if (squatRatio > deadliftRatio) {
      imbalances.push({
        area: 'Lower Body',
        issue: 'Squat stronger than deadlift (unusual)',
        fix: 'Focus on hip hinge mechanics and posterior chain work.',
      });
    }
  }

  const ohpPR = liftPRs.get('overhead press');
  if (benchPR && ohpPR && bodyweight) {
    const benchRatio = benchPR.est1RM / bodyweight;
    const ohpRatio = ohpPR.est1RM / bodyweight;
    if (benchRatio > ohpRatio * 2) {
      imbalances.push({
        area: 'Shoulder Strength',
        issue: 'Overhead press lagging behind bench',
        fix: 'Add more overhead pressing volume and lateral raises.',
      });
    }
  }

  const levelColors: Record<string, string> = {
    beginner: 'bg-gray-100 text-gray-700 border-gray-300',
    novice: 'bg-blue-100 text-blue-700 border-blue-300',
    intermediate: 'bg-green-100 text-green-700 border-green-300',
    advanced: 'bg-purple-100 text-purple-700 border-purple-300',
    elite: 'bg-amber-100 text-amber-700 border-amber-300',
  };

  const barColors: Record<string, string> = {
    beginner: '#9ca3af',
    novice: '#3b82f6',
    intermediate: '#22c55e',
    advanced: '#a855f7',
    elite: '#f59e0b',
  };

  if (!bodyweight) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell size={24} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Strength Analysis</h1>
          </div>
          <p className="text-gray-600">
            Bodyweight required for strength standards comparison
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2" />
          <p className="text-amber-800 font-medium">No bodyweight data found</p>
          <p className="text-amber-600 text-sm mt-1">
            Import weight data from Apple Health or add manual entries to see strength benchmarks relative to bodyweight.
          </p>
        </div>
      </div>
    );
  }

  if (benchmarks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell size={24} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Strength Analysis</h1>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <Dumbbell size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-600 font-medium">No major lift data found</p>
          <p className="text-gray-500 text-sm mt-1">
            Add compound lifts (squat, bench, deadlift, OHP, rows) to your Strava descriptions to see analysis.
          </p>
        </div>
      </div>
    );
  }

  // Chart data - use age-adjusted percentile if available
  const chartData = benchmarks.map(b => ({
    name: b.exercise.replace(' Press', '').replace('Barbell ', ''),
    percentile: Math.round(b.ageAdjustedPercentile ?? b.percentile),
    rawPercentile: Math.round(b.percentile),
    level: b.level,
    ratio: b.bodyweightRatio.toFixed(2),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell size={24} className="text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Strength Performance Analysis</h1>
              <p className="text-gray-600">
                Compared to bodyweight-based standards at {bodyweight}kg
                {age && age > 40 && (
                  <span className="ml-1 text-green-600">(age-adjusted for {age} years)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
              title="Edit or add lift PRs"
            >
              <Edit3 size={14} />
              Edit Lifts
            </button>
            <div className={`px-4 py-2 rounded-full font-bold text-2xl ${
              overallGrade.startsWith('A') ? 'bg-green-100 text-green-700' :
              overallGrade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {overallGrade}
            </div>
          </div>
        </div>
      </div>

      {/* Age Adjustment Info */}
      {age && age > 40 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-800 font-medium">Age-Adjusted Standards</p>
            <p className="text-blue-700 text-sm mt-1">
              Your lifts are compared using a {((ageCoefficient - 1) * 100).toFixed(1)}% age bonus
              (based on IPF Masters coefficients). This accounts for natural strength decline after 40.
            </p>
          </div>
        </div>
      )}

      {!age && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Info size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">Add Birth Year for Age-Adjusted Standards</p>
            <p className="text-amber-700 text-sm mt-1">
              Go to Settings → Profile to add your birth year. If you're over 40, your percentiles will be
              adjusted using IPF Masters coefficients for fairer comparison.
            </p>
          </div>
        </div>
      )}

      {/* Percentile Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Strength Percentiles</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={75} />
              <Tooltip
                formatter={(value: number) => [`${value}th percentile`, 'Strength Level']}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.name === label);
                  return item ? `${label}: ${item.ratio}x BW (${item.level})` : label;
                }}
              />
              <ReferenceLine x={50} stroke="#9ca3af" strokeDasharray="3 3" />
              <Bar dataKey="percentile" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={barColors[entry.level]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs">
          {Object.entries(levelColors).map(([level, colors]) => (
            <div key={level} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${colors.split(' ')[0]}`} />
              <span className="capitalize text-gray-600">{level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Lift Cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lift Breakdown</h2>
        <div className="space-y-4">
          {benchmarks.map((lift) => {
            const effectivePercentile = lift.ageAdjustedPercentile ?? lift.percentile;
            return (
            <div key={lift.exercise} className={`border rounded-lg p-4 ${levelColors[lift.level]}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{lift.exercise}</h3>
                  <p className="text-sm opacity-75">
                    {lift.currentMax}kg × {lift.reps} rep{lift.reps > 1 ? 's' : ''} → Est. 1RM: {lift.est1RM}kg ({lift.bodyweightRatio.toFixed(2)}x BW)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">{Math.round(effectivePercentile)}%</span>
                  {lift.ageAdjustedPercentile && (
                    <p className="text-xs opacity-60">raw: {Math.round(lift.percentile)}%</p>
                  )}
                  <p className="text-sm capitalize">{lift.level}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Target size={14} className="flex-shrink-0" />
                <p className="text-sm">{lift.recommendation}</p>
              </div>
              {effectivePercentile < 50 && (
                <div className="mt-2 text-sm bg-white/50 rounded p-2">
                  <span className="font-medium">Next target: </span>
                  {lift.targetNext}kg ({(lift.targetNext / bodyweight).toFixed(2)}x BW)
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>

      {/* Muscle Imbalances */}
      {imbalances.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Muscle Imbalances Detected</h2>
          </div>
          <div className="space-y-3">
            {imbalances.map((imb, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-medium text-amber-800">{imb.area}: {imb.issue}</p>
                <p className="text-sm text-amber-700 mt-1">{imb.fix}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak Points & Priorities */}
      {weakLifts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">Priority Areas for Improvement</h2>
          </div>
          <div className="space-y-2">
            {weakLifts.map((lift, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-gray-900">{lift.exercise}</p>
                  <p className="text-sm text-gray-600">{lift.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standards Reference */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Strength Standards (as multiple of bodyweight)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">Exercise</th>
                <th className="py-2 px-2 text-center">Beginner</th>
                <th className="py-2 px-2 text-center">Novice</th>
                <th className="py-2 px-2 text-center">Intermediate</th>
                <th className="py-2 px-2 text-center">Advanced</th>
                <th className="py-2 px-2 text-center">Elite</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(STRENGTH_STANDARDS).map(([lift, standards]) => (
                <tr key={lift} className="border-t border-gray-200">
                  <td className="py-2 pr-4 font-medium capitalize">{lift}</td>
                  <td className="py-2 px-2 text-center">{standards.beginner}x</td>
                  <td className="py-2 px-2 text-center">{standards.novice}x</td>
                  <td className="py-2 px-2 text-center">{standards.intermediate}x</td>
                  <td className="py-2 px-2 text-center">{standards.advanced}x</td>
                  <td className="py-2 px-2 text-center">{standards.elite}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Standards are approximate and based on male lifters. Female lifters typically achieve ~60-70% of these ratios.
        </p>
      </div>

      {/* AI Action */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <button
          onClick={() => onAskAI(`Based on my lift benchmarks (${benchmarks.map(b => `${b.exercise}: ${b.est1RM}kg at ${b.bodyweightRatio.toFixed(2)}x BW`).join(', ')}), create a program to improve my weak points`)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Get Personalized Strength Program
        </button>
      </div>

      {/* Lift PR Editor Modal */}
      <LiftPREditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={() => {
          setRefreshKey(k => k + 1);
          refreshData();
        }}
        existingLifts={existingLiftsForEditor}
      />
    </div>
  );
}
