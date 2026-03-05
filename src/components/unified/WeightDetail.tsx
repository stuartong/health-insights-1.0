import { Scale, MessageCircle, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { format } from 'date-fns';

interface Props {
  onAskAI: (context: string) => void;
}

export function WeightDetail({ onAskAI }: Props) {
  const { recentWeight, weightTrend } = useHealthStore();

  // Alias for cleaner code - recentWeight is sorted oldest first, so reverse for display
  const weightEntries = [...recentWeight].reverse();

  if (weightEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <Scale size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Weight Data</h2>
        <p className="text-gray-500">Import weight data or add manual entries</p>
      </div>
    );
  }

  // Calculate smoothed weights for chart using exponential smoothing
  const chartEntries = weightEntries.slice(0, 30).reverse();
  let smoothedValue = chartEntries[0]?.weight || 0;
  const chartData = chartEntries.map((w) => {
    smoothedValue = 0.1 * w.weight + 0.9 * smoothedValue;
    return {
      date: format(w.date, 'MMM d'),
      weight: w.weight,
      smoothed: smoothedValue,
    };
  });

  const currentWeight = weightEntries[0].weight;
  const smoothedWeight = weightTrend?.smoothed || currentWeight;
  const weekAgo = weightEntries.find((_, i) => i >= 7);
  const weekChange = weekAgo ? currentWeight - weekAgo.weight : 0;

  const TrendIcon = weekChange < -0.1 ? TrendingDown : weekChange > 0.1 ? TrendingUp : Minus;
  const trendColor = weekChange < -0.1 ? 'text-green-600' : weekChange > 0.1 ? 'text-orange-600' : 'text-gray-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
        <div className="flex items-center gap-3 mb-4">
          <Scale size={24} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">Weight Tracking</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Current</p>
            <p className="text-3xl font-bold text-gray-900">{currentWeight.toFixed(1)}</p>
            <p className="text-xs text-gray-500">kg</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">True Trend</p>
            <p className="text-3xl font-bold text-emerald-600">{smoothedWeight.toFixed(1)}</p>
            <p className="text-xs text-gray-500">kg (smoothed)</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">This Week</p>
            <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
              <TrendIcon size={20} />
              <p className="text-2xl font-bold">{weekChange >= 0 ? '+' : ''}{weekChange.toFixed(1)}</p>
            </div>
            <p className="text-xs text-gray-500">kg</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Entries</p>
            <p className="text-3xl font-bold text-gray-900">{weightEntries.length}</p>
            <p className="text-xs text-gray-500">total</p>
          </div>
        </div>
      </div>

      {/* Weight Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Weight Trend (Last 30 Days)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Scatter dataKey="weight" fill="#94a3b8" name="Daily Weight" />
              <Line type="monotone" dataKey="smoothed" stroke="#10b981" strokeWidth={3} dot={false} name="Trend" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Gray dots = daily weigh-ins. Green line = exponentially smoothed trend (filters out daily fluctuations).
        </p>
      </div>

      {/* Explanation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Understanding Your Weight</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Daily fluctuations are normal.</strong> Your weight can vary 1-2kg day to day based on:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Water retention (sodium, carbs, exercise)</li>
            <li>Food in digestive system</li>
            <li>Hormonal changes</li>
            <li>Time of day</li>
          </ul>
          <p>
            <strong>Focus on the trend line</strong>, not individual weigh-ins. The smoothed trend shows your true progress.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <p className="text-primary-800 mb-4">
          {weekChange < -0.3
            ? "Good progress! You're trending down this week."
            : weekChange > 0.3
            ? "Weight is up slightly. This could be water retention - check your sodium and carb intake."
            : "Weight is stable. If trying to lose, consider a small caloric deficit."
          }
        </p>
        <button
          onClick={() => onAskAI('Analyze my weight trend and give me nutrition advice')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Get Nutrition Advice
        </button>
      </div>
    </div>
  );
}
