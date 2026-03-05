import { Dumbbell, Check, AlertTriangle, XCircle, BarChart3, MessageCircle } from 'lucide-react';

export interface LiftBenchmark {
  exercise: string;
  currentMax: number; // kg
  reps: number; // reps at currentMax
  est1RM: number; // kg
  bodyweightRatio: number; // est1RM / bodyweight
  level: 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';
  percentile: number; // 0-100
  ageAdjustedPercentile?: number; // age-adjusted percentile
  recommendation: string;
}

export interface LiftingCritique {
  overallGrade: string;
  gradeDescription: string;
  bodyweight: number | null;
  age: number | null; // for age-adjusted standards
  benchmarks: LiftBenchmark[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  muscleImbalances: { area: string; issue: string }[];
  topPriority: string;
  // Training stats
  weeklyFrequency: number; // sessions per week (last 4 weeks)
  totalSessions: number; // total sessions in period
}

interface Props {
  critique: LiftingCritique;
  onViewDetails: () => void;
  onAskAI: (context: string) => void;
}

export function LiftingCritiqueSummary({ critique, onViewDetails, onAskAI }: Props) {
  const gradeColors: Record<string, string> = {
    'A+': 'text-green-600 bg-green-100',
    'A': 'text-green-600 bg-green-100',
    'A-': 'text-green-600 bg-green-100',
    'B+': 'text-blue-600 bg-blue-100',
    'B': 'text-blue-600 bg-blue-100',
    'B-': 'text-blue-600 bg-blue-100',
    'C+': 'text-yellow-600 bg-yellow-100',
    'C': 'text-yellow-600 bg-yellow-100',
    'C-': 'text-yellow-600 bg-yellow-100',
    'D': 'text-orange-600 bg-orange-100',
    'F': 'text-red-600 bg-red-100',
  };

  const levelColors: Record<string, string> = {
    beginner: 'bg-gray-100 text-gray-600',
    novice: 'bg-blue-100 text-blue-600',
    intermediate: 'bg-green-100 text-green-600',
    advanced: 'bg-purple-100 text-purple-600',
    elite: 'bg-amber-100 text-amber-600',
  };

  const gradeColor = gradeColors[critique.overallGrade] || 'text-gray-600 bg-gray-100';

  // Show top 4 benchmarks
  const topBenchmarks = critique.benchmarks.slice(0, 4);
  const needsBodyweight = !critique.bodyweight && critique.benchmarks.length === 0;

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-green-100/50 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="text-green-600" />
            <span className="text-sm font-semibold text-green-800">Strength Performance Analysis</span>
            {critique.weeklyFrequency > 0 && (
              <span className="text-xs text-green-600 bg-green-200/50 px-2 py-0.5 rounded-full">
                {critique.weeklyFrequency.toFixed(1)}x/week
              </span>
            )}
          </div>
          <div className={`px-3 py-1 rounded-full font-bold text-lg ${gradeColor}`}>
            {critique.overallGrade}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-gray-700 font-medium">{critique.gradeDescription}</p>

        {/* Training Frequency Stats */}
        {critique.totalSessions > 0 && (
          <div className="flex items-center gap-4 bg-white/60 rounded-lg p-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-semibold">Training Frequency (4 weeks)</p>
              <p className="text-lg font-bold text-gray-900">
                {critique.weeklyFrequency.toFixed(1)} <span className="text-sm font-normal text-gray-600">sessions/week</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{critique.totalSessions} sessions</p>
              <p className={`text-xs font-medium ${
                critique.weeklyFrequency >= 3 ? 'text-green-600' :
                critique.weeklyFrequency >= 2 ? 'text-yellow-600' : 'text-orange-600'
              }`}>
                {critique.weeklyFrequency >= 3 ? 'Optimal for gains' :
                 critique.weeklyFrequency >= 2 ? 'Maintenance level' : 'Consider more sessions'}
              </p>
            </div>
          </div>
        )}

        {/* Missing bodyweight notice */}
        {needsBodyweight && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 text-sm">
              <strong>Bodyweight needed:</strong> Import weight data from Apple Health or add manual weight entries
              to see how your lifts compare to bodyweight-based strength standards.
            </p>
          </div>
        )}

        {/* Lift Benchmarks */}
        {topBenchmarks.length > 0 && (
          <>
            <p className="text-xs text-gray-500 -mb-2">
              Est. 1RM shown (calculated from your logged lifts)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {topBenchmarks.map((lift) => (
                <div key={lift.exercise} className="bg-white/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 font-medium mb-1">{lift.exercise}</p>
                  <p className="text-lg font-bold text-gray-900" title="Estimated 1 Rep Max">
                    ~{lift.est1RM}kg
                  </p>
                  <p className="text-xs text-gray-400" title="Actual lift recorded">
                    from {lift.currentMax}kg × {lift.reps}
                  </p>
                  <p className="text-xs text-gray-500">{lift.bodyweightRatio.toFixed(2)}x BW</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full capitalize ${levelColors[lift.level]}`}>
                    {lift.level}
                    {lift.ageAdjustedPercentile && ' *'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Quick Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Strengths */}
          <div className="bg-white/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Check size={14} className="text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase">Strengths</span>
            </div>
            <ul className="space-y-1">
              {critique.strengths.slice(0, 2).map((s, i) => (
                <li key={i} className="text-xs text-gray-600 line-clamp-1">{s}</li>
              ))}
              {critique.strengths.length === 0 && (
                <li className="text-xs text-gray-400">Build more data</li>
              )}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="bg-white/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700 uppercase">Weak Points</span>
            </div>
            <ul className="space-y-1">
              {critique.weaknesses.slice(0, 2).map((s, i) => (
                <li key={i} className="text-xs text-gray-600 line-clamp-1">{s}</li>
              ))}
              {critique.weaknesses.length === 0 && (
                <li className="text-xs text-gray-400">Looking balanced</li>
              )}
            </ul>
          </div>

          {/* Imbalances */}
          <div className="bg-white/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <XCircle size={14} className="text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase">Imbalances</span>
            </div>
            <ul className="space-y-1">
              {critique.muscleImbalances.length > 0 ? (
                critique.muscleImbalances.slice(0, 2).map((imb, i) => (
                  <li key={i} className="text-xs text-gray-600 line-clamp-1">{imb.area}</li>
                ))
              ) : (
                <li className="text-xs text-gray-400">No major imbalances</li>
              )}
            </ul>
          </div>
        </div>

        {/* Top Priority */}
        {critique.topPriority && (
          <div className="bg-green-100/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Top Priority</p>
            <p className="text-sm text-green-900 font-medium">{critique.topPriority}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-white/40 border-t border-green-200/50 flex items-center gap-3">
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
        >
          <BarChart3 size={14} />
          View Full Analysis
        </button>
        <button
          onClick={() => onAskAI('Create a strength training program to improve my weak lifts based on my benchmarks')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Get Training Program
        </button>
      </div>
    </div>
  );
}
