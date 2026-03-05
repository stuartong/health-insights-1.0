import { Activity, Check, AlertTriangle, XCircle, BarChart3, MessageCircle } from 'lucide-react';

export interface RunningCritique {
  overallGrade: string;
  gradeDescription: string;
  strengths: string[];
  improvements: string[];
  redFlags: string[];
  topPriorities: string[];
  gradeBreakdown?: { category: string; grade: string }[];
  sections: {
    title: string;
    status: 'good' | 'caution' | 'warning';
    summary: string;
    recommendations: string[];
  }[];
}

interface Props {
  critique: RunningCritique;
  onViewDetails: () => void;
  onAskAI: (context: string) => void;
}

export function RunningCritiqueSummary({ critique, onViewDetails, onAskAI }: Props) {
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

  const gradeColor = gradeColors[critique.overallGrade] || 'text-gray-600 bg-gray-100';

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-purple-100/50 border-b border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-purple-600" />
            <span className="text-sm font-semibold text-purple-800">Running Performance Analysis</span>
          </div>
          <div className={`px-3 py-1 rounded-full font-bold text-lg ${gradeColor}`}>
            {critique.overallGrade}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-gray-700 font-medium">{critique.gradeDescription}</p>

        {/* Grade Breakdown */}
        {critique.gradeBreakdown && critique.gradeBreakdown.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {critique.gradeBreakdown.map((item) => (
              <div key={item.category} className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500 mb-0.5">{item.category}</p>
                <p className={`text-lg font-bold ${gradeColors[item.grade]?.split(' ')[0] || 'text-gray-600'}`}>
                  {item.grade}
                </p>
              </div>
            ))}
          </div>
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
            </ul>
          </div>

          {/* Improvements */}
          <div className="bg-white/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700 uppercase">Improve</span>
            </div>
            <ul className="space-y-1">
              {critique.improvements.slice(0, 2).map((s, i) => (
                <li key={i} className="text-xs text-gray-600 line-clamp-1">{s}</li>
              ))}
            </ul>
          </div>

          {/* Red Flags */}
          <div className="bg-white/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <XCircle size={14} className="text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase">Watch Out</span>
            </div>
            <ul className="space-y-1">
              {critique.redFlags.length > 0 ? (
                critique.redFlags.slice(0, 2).map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 line-clamp-1">{s}</li>
                ))
              ) : (
                <li className="text-xs text-gray-400">No major concerns</li>
              )}
            </ul>
          </div>
        </div>

        {/* Top Priority */}
        {critique.topPriorities.length > 0 && (
          <div className="bg-purple-100/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Top Priority</p>
            <p className="text-sm text-purple-900 font-medium">{critique.topPriorities[0]}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-white/40 border-t border-purple-200/50 flex items-center gap-3">
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
        >
          <BarChart3 size={14} />
          View Full Critique
        </button>
        <button
          onClick={() => onAskAI('Create an 8-week improvement plan for my running based on the critique')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Get Improvement Plan
        </button>
      </div>
    </div>
  );
}
