import { useState } from 'react';
import { Target, ChevronDown, ChevronUp, MessageCircle, Check, X } from 'lucide-react';

export interface TodayRecommendation {
  title: string;
  subtitle: string;
  reasoning: string;
  doList: string[];
  avoidList: string[];
  status: 'good' | 'caution' | 'warning';
}

interface Props {
  recommendation: TodayRecommendation | null;
  onAskAI: () => void;
}

export function TodayCoachingCard({ recommendation, onAskAI }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!recommendation) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <Target size={24} />
          <div>
            <p className="font-medium">No recommendation yet</p>
            <p className="text-sm">Import your health data to get personalized coaching</p>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    good: {
      bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      title: 'text-green-900',
      badge: 'bg-green-100 text-green-700',
    },
    caution: {
      bg: 'bg-gradient-to-br from-yellow-50 to-amber-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-600',
      title: 'text-yellow-900',
      badge: 'bg-yellow-100 text-yellow-700',
    },
    warning: {
      bg: 'bg-gradient-to-br from-red-50 to-orange-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      title: 'text-red-900',
      badge: 'bg-red-100 text-red-700',
    },
  };

  const colors = statusColors[recommendation.status];

  return (
    <div className={`rounded-2xl shadow-sm border ${colors.bg} ${colors.border} overflow-hidden`}>
      {/* Header */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl bg-white/60 ${colors.icon}`}>
              <Target size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Today's Recommendation
              </p>
              <h2 className={`text-xl sm:text-2xl font-bold ${colors.title}`}>
                {recommendation.title}
              </h2>
              {recommendation.subtitle && (
                <p className="text-gray-600 mt-1">{recommendation.subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <div className="mt-4 p-4 bg-white/50 rounded-xl">
          <p className="text-gray-700 text-sm leading-relaxed">
            <span className="font-medium">Why: </span>
            {recommendation.reasoning}
          </p>
        </div>

        {/* Quick Do/Avoid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recommendation.doList.length > 0 && (
            <div className="flex items-start gap-2">
              <Check size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">{recommendation.doList[0]}</p>
            </div>
          )}
          {recommendation.avoidList.length > 0 && (
            <div className="flex items-start gap-2">
              <X size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">{recommendation.avoidList[0]}</p>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Details */}
      {(recommendation.doList.length > 1 || recommendation.avoidList.length > 1) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/30 hover:bg-white/50 transition-colors border-t border-gray-200/50"
          >
            {expanded ? (
              <>
                <ChevronUp size={16} />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show More Details
              </>
            )}
          </button>

          {expanded && (
            <div className="px-6 pb-5 space-y-4 bg-white/30">
              {recommendation.doList.length > 1 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-2">
                    Recommended
                  </p>
                  <ul className="space-y-2">
                    {recommendation.doList.slice(1).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {recommendation.avoidList.length > 1 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-2">
                    Avoid
                  </p>
                  <ul className="space-y-2">
                    {recommendation.avoidList.slice(1).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <X size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="px-6 py-4 bg-white/40 border-t border-gray-200/50 flex items-center justify-between gap-3">
        <button
          onClick={onAskAI}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Ask AI Why
        </button>
        <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
          Got It
        </button>
      </div>
    </div>
  );
}
