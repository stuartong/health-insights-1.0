import { Lightbulb, AlertTriangle, TrendingUp, Activity, BarChart3, MessageCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, Tooltip } from 'recharts';

export interface Insight {
  id: string;
  type: 'pattern' | 'warning' | 'progress' | 'running_critique';
  title: string;
  subtitle?: string;
  description: string;
  status?: 'good' | 'caution' | 'warning';
  metrics?: { label: string; value: string; status?: 'good' | 'caution' | 'warning' }[];
  chartData?: { x: number; y: number }[];
  chartType?: 'scatter' | 'line' | 'bar';
  strengths?: string[];
  improvements?: string[];
  redFlags?: string[];
  grade?: string;
}

interface Props {
  insight: Insight;
  onViewDetails: (id: string) => void;
  onAskAI: (context: string) => void;
}

export function InsightCard({ insight, onViewDetails, onAskAI }: Props) {
  const typeConfig = {
    pattern: {
      icon: Lightbulb,
      label: 'Performance Pattern',
      colors: 'bg-blue-50 border-blue-200 text-blue-700',
      iconColor: 'text-blue-500',
    },
    warning: {
      icon: AlertTriangle,
      label: 'Attention Needed',
      colors: 'bg-amber-50 border-amber-200 text-amber-700',
      iconColor: 'text-amber-500',
    },
    progress: {
      icon: TrendingUp,
      label: 'Progress Update',
      colors: 'bg-green-50 border-green-200 text-green-700',
      iconColor: 'text-green-500',
    },
    running_critique: {
      icon: Activity,
      label: 'Running Analysis',
      colors: 'bg-purple-50 border-purple-200 text-purple-700',
      iconColor: 'text-purple-500',
    },
  };

  const config = typeConfig[insight.type];
  const Icon = config.icon;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${config.colors}`}>
        <div className="flex items-center gap-2">
          <Icon size={16} className={config.iconColor} />
          <span className="text-xs font-semibold uppercase tracking-wider">{config.label}</span>
          {insight.grade && (
            <span className="ml-auto text-sm font-bold">{insight.grade}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
        {insight.subtitle && (
          <p className="text-sm text-gray-500 mb-2">{insight.subtitle}</p>
        )}

        {/* Mini Chart */}
        {insight.chartData && insight.chartData.length > 0 && (
          <div className="h-24 my-3 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              {insight.chartType === 'scatter' ? (
                <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="x" hide />
                  <YAxis dataKey="y" hide />
                  <Tooltip />
                  <Scatter data={insight.chartData} fill="#6366f1" />
                </ScatterChart>
              ) : (
                <LineChart data={insight.chartData}>
                  <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Metrics */}
        {insight.metrics && insight.metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 my-3">
            {insight.metrics.map((metric, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">{metric.label}</p>
                <p className={`text-sm font-semibold ${
                  metric.status === 'good' ? 'text-green-600' :
                  metric.status === 'warning' ? 'text-red-600' :
                  'text-gray-900'
                }`}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed">{insight.description}</p>

        {/* Running Critique Summary */}
        {insight.type === 'running_critique' && (
          <div className="mt-3 space-y-2">
            {insight.strengths && insight.strengths.length > 0 && (
              <div className="text-sm">
                <span className="text-green-600 font-medium">Strengths: </span>
                <span className="text-gray-600">{insight.strengths[0]}</span>
              </div>
            )}
            {insight.improvements && insight.improvements.length > 0 && (
              <div className="text-sm">
                <span className="text-yellow-600 font-medium">Improve: </span>
                <span className="text-gray-600">{insight.improvements[0]}</span>
              </div>
            )}
            {insight.redFlags && insight.redFlags.length > 0 && (
              <div className="text-sm">
                <span className="text-red-600 font-medium">Watch out: </span>
                <span className="text-gray-600">{insight.redFlags[0]}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
        <button
          onClick={() => onViewDetails(insight.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <BarChart3 size={14} />
          View Details
        </button>
        <button
          onClick={() => onAskAI(`Tell me more about: ${insight.title}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Ask AI
        </button>
      </div>
    </div>
  );
}
