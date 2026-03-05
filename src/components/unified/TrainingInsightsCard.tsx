import { Activity, Dumbbell, TrendingUp, AlertTriangle, Check, BarChart3, MessageCircle } from 'lucide-react';
import type { RunningCritique } from './RunningCritiqueSummary';
import type { LiftingCritique } from './LiftingCritiqueSummary';

interface Props {
  runningCritique: RunningCritique | null;
  liftingCritique: LiftingCritique | null;
  onViewRunningDetails: () => void;
  onViewLiftingDetails: () => void;
  onAskAI: (context: string) => void;
}

export function TrainingInsightsCard({
  runningCritique,
  liftingCritique,
  onViewRunningDetails,
  onViewLiftingDetails,
  onAskAI,
}: Props) {
  if (!runningCritique && !liftingCritique) {
    return null;
  }

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

  const hasBoth = runningCritique && liftingCritique;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-100 to-green-100 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-700" />
            <span className="text-sm font-semibold text-gray-800">Training Analysis</span>
          </div>
          {hasBoth && (
            <span className="text-xs text-gray-500">Hybrid Athlete</span>
          )}
        </div>
      </div>

      <div className={`grid ${hasBoth ? 'grid-cols-2 divide-x divide-gray-100' : 'grid-cols-1'}`}>
        {/* Running Section */}
        {runningCritique && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">Running</span>
              </div>
              <div className={`px-2 py-0.5 rounded-full font-bold text-sm ${gradeColors[runningCritique.overallGrade] || 'text-gray-600 bg-gray-100'}`}>
                {runningCritique.overallGrade}
              </div>
            </div>

            {/* Grade Breakdown Mini */}
            {runningCritique.gradeBreakdown && (
              <div className="grid grid-cols-4 gap-1">
                {runningCritique.gradeBreakdown.map((item) => (
                  <div key={item.category} className="text-center">
                    <p className="text-[10px] text-gray-400 truncate">{item.category}</p>
                    <p className={`text-xs font-bold ${gradeColors[item.grade]?.split(' ')[0] || 'text-gray-600'}`}>
                      {item.grade}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Key Points */}
            <div className="space-y-1">
              {runningCritique.strengths.slice(0, 1).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <Check size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 line-clamp-1">{s}</span>
                </div>
              ))}
              {runningCritique.improvements.slice(0, 1).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <AlertTriangle size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 line-clamp-1">{s}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onViewRunningDetails}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <BarChart3 size={12} />
              View Details
            </button>
          </div>
        )}

        {/* Lifting Section */}
        {liftingCritique && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell size={16} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">Lifting</span>
                {liftingCritique.weeklyFrequency > 0 && (
                  <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                    {liftingCritique.weeklyFrequency.toFixed(1)}x/wk
                  </span>
                )}
              </div>
              <div className={`px-2 py-0.5 rounded-full font-bold text-sm ${gradeColors[liftingCritique.overallGrade] || 'text-gray-600 bg-gray-100'}`}>
                {liftingCritique.overallGrade}
              </div>
            </div>

            {/* Top Lifts Mini */}
            {liftingCritique.benchmarks.length > 0 && (
              <div className="grid grid-cols-2 gap-1">
                {liftingCritique.benchmarks.slice(0, 4).map((lift) => (
                  <div key={lift.exercise} className="text-center bg-gray-50 rounded p-1">
                    <p className="text-[10px] text-gray-400 truncate">{lift.exercise}</p>
                    <p className="text-xs font-bold text-gray-800">~{lift.est1RM}kg</p>
                  </div>
                ))}
              </div>
            )}

            {/* Key Points */}
            <div className="space-y-1">
              {liftingCritique.strengths.slice(0, 1).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <Check size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 line-clamp-1">{s}</span>
                </div>
              ))}
              {liftingCritique.weaknesses.slice(0, 1).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <AlertTriangle size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 line-clamp-1">{s}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onViewLiftingDetails}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <BarChart3 size={12} />
              View Details
            </button>
          </div>
        )}
      </div>

      {/* Combined Action */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => onAskAI('Create a balanced training plan combining my running and lifting goals')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Get Training Plan
        </button>
      </div>
    </div>
  );
}
