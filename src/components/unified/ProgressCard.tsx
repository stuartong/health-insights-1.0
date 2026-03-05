import { TrendingUp, TrendingDown, Scale, Dumbbell, Activity, Bike, Waves, Mountain, Footprints, ChevronRight, Sparkles } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import type { Insight } from './InsightCard';

interface Props {
  insights: Insight[];
  onViewDetails: (id: string) => void;
}

// Activity-specific icons and colors
const activityConfig: Record<string, { icon: typeof Activity; color: string; bgColor: string; gradient: string }> = {
  weight: { icon: Scale, color: 'text-purple-600', bgColor: 'bg-purple-100', gradient: 'from-purple-500 to-purple-600' },
  run: { icon: Activity, color: 'text-blue-600', bgColor: 'bg-blue-100', gradient: 'from-blue-500 to-blue-600' },
  lift: { icon: Dumbbell, color: 'text-green-600', bgColor: 'bg-green-100', gradient: 'from-green-500 to-green-600' },
  volume: { icon: Dumbbell, color: 'text-green-600', bgColor: 'bg-green-100', gradient: 'from-green-500 to-green-600' },
  cycle: { icon: Bike, color: 'text-orange-600', bgColor: 'bg-orange-100', gradient: 'from-orange-500 to-orange-600' },
  swim: { icon: Waves, color: 'text-cyan-600', bgColor: 'bg-cyan-100', gradient: 'from-cyan-500 to-cyan-600' },
  hike: { icon: Mountain, color: 'text-emerald-600', bgColor: 'bg-emerald-100', gradient: 'from-emerald-500 to-emerald-600' },
  walk: { icon: Footprints, color: 'text-amber-600', bgColor: 'bg-amber-100', gradient: 'from-amber-500 to-amber-600' },
  hybrid: { icon: Sparkles, color: 'text-indigo-600', bgColor: 'bg-indigo-100', gradient: 'from-indigo-500 to-indigo-600' },
  default: { icon: TrendingUp, color: 'text-gray-600', bgColor: 'bg-gray-100', gradient: 'from-gray-500 to-gray-600' },
};

const getActivityConfig = (id: string) => {
  for (const [key, config] of Object.entries(activityConfig)) {
    if (id.toLowerCase().includes(key)) return config;
  }
  return activityConfig.default;
};

export function ProgressCard({ insights, onViewDetails }: Props) {
  // Only show progress-type insights
  const progressInsights = insights.filter(i => i.type === 'progress');

  if (progressInsights.length === 0) {
    return null;
  }

  // Featured insight (first one, shown larger)
  const featured = progressInsights[0];
  const others = progressInsights.slice(1);
  const featuredConfig = getActivityConfig(featured.id);
  const FeaturedIcon = featuredConfig.icon;
  const isPositive = featured.status === 'good';

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-green-600" />
        <h3 className="text-sm font-semibold text-gray-700">Progress Updates</h3>
      </div>

      {/* Featured Progress Card */}
      <button
        onClick={() => onViewDetails(featured.id)}
        className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group"
      >
        <div className="flex">
          {/* Left: Visual indicator */}
          <div className={`w-2 bg-gradient-to-b ${isPositive ? 'from-green-400 to-green-600' : 'from-amber-400 to-amber-600'}`} />

          <div className="flex-1 p-4">
            <div className="flex items-start gap-4">
              {/* Icon with gradient background */}
              <div className={`relative p-3 rounded-xl ${featuredConfig.bgColor} overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${featuredConfig.gradient} opacity-10`} />
                <FeaturedIcon size={24} className={featuredConfig.color} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{featured.title}</h4>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isPositive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {featured.metrics?.[0]?.value || (isPositive ? 'Improving' : 'Needs focus')}
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{featured.description}</p>

                {/* Mini chart */}
                {featured.chartData && featured.chartData.length > 0 && (
                  <div className="h-12 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={featured.chartData}>
                        <defs>
                          <linearGradient id={`gradient-${featured.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#f59e0b'} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#f59e0b'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                        <Area
                          type="monotone"
                          dataKey="y"
                          stroke={isPositive ? '#22c55e' : '#f59e0b'}
                          strokeWidth={2}
                          fill={`url(#gradient-${featured.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <ChevronRight size={20} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </div>
        </div>
      </button>

      {/* Other Progress Items (compact grid) */}
      {others.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {others.map((insight) => {
            const config = getActivityConfig(insight.id);
            const Icon = config.icon;
            const positive = insight.status === 'good';

            return (
              <button
                key={insight.id}
                onClick={() => onViewDetails(insight.id)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                    <Icon size={14} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{insight.title}</p>
                    {insight.metrics?.[0] && (
                      <p className={`text-xs ${positive ? 'text-green-600' : 'text-amber-600'}`}>
                        {insight.metrics[0].value}
                      </p>
                    )}
                  </div>
                  {positive ? (
                    <TrendingUp size={12} className="text-green-500" />
                  ) : (
                    <TrendingDown size={12} className="text-amber-500" />
                  )}
                </div>

                {/* Mini sparkline */}
                {insight.chartData && insight.chartData.length > 0 && (
                  <div className="h-6 mt-2 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={insight.chartData}>
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                        <Area
                          type="monotone"
                          dataKey="y"
                          stroke={positive ? '#22c55e' : '#f59e0b'}
                          strokeWidth={1.5}
                          fill={positive ? '#22c55e' : '#f59e0b'}
                          fillOpacity={0.1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
