import { AlertTriangle, Lightbulb, Activity, Dumbbell, Moon, Heart, TrendingUp, ChevronRight, MessageCircle } from 'lucide-react';
import type { Insight } from './InsightCard';

interface Props {
  insights: Insight[];
  onViewDetails: (id: string) => void;
  onAskAI: (context: string) => void;
}

export function TrainingPatternsCard({ insights, onViewDetails, onAskAI }: Props) {
  if (insights.length === 0) return null;

  const warnings = insights.filter(i => i.type === 'warning');
  const patterns = insights.filter(i => i.type === 'pattern');

  const getInsightIcon = (id: string) => {
    if (id.includes('sleep') || id.includes('recovery')) return Moon;
    if (id.includes('hrv') || id.includes('heart')) return Heart;
    if (id.includes('lift') || id.includes('volume') || id.includes('push') || id.includes('pull')) return Dumbbell;
    if (id.includes('run') || id.includes('training')) return Activity;
    return TrendingUp;
  };

  const InsightRow = ({ insight, isWarning }: { insight: Insight; isWarning: boolean }) => {
    const Icon = getInsightIcon(insight.id);

    return (
      <button
        onClick={() => onViewDetails(insight.id)}
        className={`w-full p-3 hover:bg-gray-50 rounded-lg transition-colors text-left group ${
          isWarning ? 'border-l-2 border-amber-400' : 'border-l-2 border-blue-400'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
            isWarning ? 'bg-amber-100' : 'bg-blue-100'
          }`}>
            <Icon size={16} className={isWarning ? 'text-amber-600' : 'text-blue-600'} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">{insight.title}</span>
              {isWarning && (
                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{insight.description}</p>

            {/* Metrics row */}
            {insight.metrics && insight.metrics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {insight.metrics.map((metric, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      metric.status === 'good' ? 'bg-green-100 text-green-700' :
                      metric.status === 'warning' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {metric.label}: {metric.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-1" />
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-blue-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-600" />
            <span className="text-sm font-semibold text-gray-800">Training Patterns & Alerts</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {warnings.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                {warnings.length} alert{warnings.length > 1 ? 's' : ''}
              </span>
            )}
            {patterns.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                {patterns.length} pattern{patterns.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-4 py-2 bg-amber-50/50">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Needs Attention</span>
          </div>
          <div className="px-2 py-1">
            {warnings.map((insight) => (
              <InsightRow key={insight.id} insight={insight} isWarning={true} />
            ))}
          </div>
        </div>
      )}

      {/* Patterns Section */}
      {patterns.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-blue-50/50">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Discovered Patterns</span>
          </div>
          <div className="px-2 py-1">
            {patterns.map((insight) => (
              <InsightRow key={insight.id} insight={insight} isWarning={false} />
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => onAskAI('Analyze my training patterns and give me actionable recommendations')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Get Personalized Advice
        </button>
      </div>
    </div>
  );
}
