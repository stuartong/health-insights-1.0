import { Heart, HeartPulse, MessageCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ComposedChart, Area } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { format } from 'date-fns';

interface Props {
  onAskAI: (context: string) => void;
}

export function HRVDetail({ onAskAI }: Props) {
  const { recentHRV, recentSleep } = useHealthStore();

  // Check if we have Oura data - prioritize Oura sleep HRV (most reliable source)
  // Match the same logic as QuickHealthSnapshot for consistency
  const ouraHRVReadings = recentHRV.filter(h => h.source === 'oura');
  const ouraSleepWithHRV = recentSleep.filter(s => s.source === 'oura' && s.hrv);

  // Use Oura if we have ANY Oura data (matching QuickHealthSnapshot)
  const hasOuraData = ouraSleepWithHRV.length > 0 || ouraHRVReadings.length > 0;

  // Build HRV data from preferred source - prioritize sleep HRV as it's measured during rest
  const allHRV: { id: string; source: string; date: Date; value: number; context?: string }[] = [];

  if (hasOuraData) {
    // Prioritize Oura sleep HRV first (most accurate - measured during sleep)
    ouraSleepWithHRV.forEach(s => {
      if (s.hrv) {
        allHRV.push({
          id: `sleep_hrv_${s.id}`,
          source: 'oura',
          date: s.date,
          value: s.hrv,
          context: 'sleep',
        });
      }
    });
    // Then add any standalone Oura HRV readings that don't overlap
    ouraHRVReadings.forEach(h => {
      if (!allHRV.some(existing => format(new Date(existing.date), 'yyyy-MM-dd') === format(new Date(h.date), 'yyyy-MM-dd'))) {
        allHRV.push(h);
      }
    });
  } else {
    // Fall back to Apple Health - same priority: sleep HRV first
    const appleSleepWithHRV = recentSleep.filter(s => s.source === 'apple_health' && s.hrv);
    const appleHRV = recentHRV.filter(h => h.source === 'apple_health');

    appleSleepWithHRV.forEach(s => {
      if (s.hrv) {
        allHRV.push({
          id: `sleep_hrv_${s.id}`,
          source: 'apple_health',
          date: s.date,
          value: s.hrv,
          context: 'sleep',
        });
      }
    });
    appleHRV.forEach(h => {
      if (!allHRV.some(existing => format(new Date(existing.date), 'yyyy-MM-dd') === format(new Date(h.date), 'yyyy-MM-dd'))) {
        allHRV.push(h);
      }
    });
  }

  // Sort by date descending
  const sortedHRV = allHRV.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const dataSource = hasOuraData ? 'Oura' : 'Apple Health';

  if (sortedHRV.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No HRV Data</h2>
        <p className="text-gray-500">Import your HRV data from Oura or Apple Health</p>
      </div>
    );
  }

  // Prepare chart data (last 30 days)
  const chartData = sortedHRV.slice(0, 30).reverse().map(h => ({
    date: format(new Date(h.date), 'MMM d'),
    hrv: h.value,
    fullDate: format(new Date(h.date), 'yyyy-MM-dd'),
  }));

  // Calculate stats
  const values = sortedHRV.slice(0, 30).map(h => h.value);
  const avgHRV = values.reduce((sum, v) => sum + v, 0) / values.length;
  const currentHRV = sortedHRV[0]?.value || 0;
  const week1Avg = sortedHRV.slice(0, 7).reduce((sum, h) => sum + h.value, 0) / Math.min(7, sortedHRV.length);
  const week2Avg = sortedHRV.slice(7, 14).reduce((sum, h) => sum + h.value, 0) / Math.min(7, sortedHRV.slice(7, 14).length) || week1Avg;

  const weekChange = week1Avg - week2Avg;
  const weekChangePercent = ((weekChange / week2Avg) * 100) || 0;

  // Determine trend
  const trend = weekChange > 2 ? 'up' : weekChange < -2 ? 'down' : 'stable';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';

  // Calculate baseline (rolling 30-day average)
  const baseline = avgHRV;

  // Status based on current vs baseline
  const status = currentHRV >= baseline * 0.95 ? 'good' : currentHRV >= baseline * 0.85 ? 'caution' : 'warning';
  const statusColors = {
    good: 'text-green-600 bg-green-100',
    caution: 'text-yellow-600 bg-yellow-100',
    warning: 'text-red-600 bg-red-100',
  };

  // === RHR Data (from same source) ===
  const rhrSourceSleep = hasOuraData ? ouraSleepWithHRV : recentSleep.filter(s => s.source === 'apple_health');
  const rhrData = rhrSourceSleep
    .filter(s => s.restingHR)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rhrChartData = rhrData.slice(0, 30).reverse().map(s => ({
    date: format(new Date(s.date), 'MMM d'),
    rhr: s.restingHR,
  }));

  const currentRHR = rhrData[0]?.restingHR || 0;
  const avgRHR = rhrData.length > 0
    ? rhrData.slice(0, 30).reduce((sum, s) => sum + (s.restingHR || 0), 0) / Math.min(30, rhrData.length)
    : 0;
  const rhrTrend = currentRHR < avgRHR - 1 ? 'down' : currentRHR > avgRHR + 2 ? 'up' : 'stable';
  const RHRTrendIcon = rhrTrend === 'up' ? TrendingUp : rhrTrend === 'down' ? TrendingDown : Minus;
  // For RHR, lower is better so down trend is good
  const rhrTrendColor = rhrTrend === 'down' ? 'text-green-600' : rhrTrend === 'up' ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-6 border border-rose-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Heart size={24} className="text-rose-600" />
            <h1 className="text-2xl font-bold text-gray-900">HRV Analysis</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            hasOuraData ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {dataSource}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Current</p>
            <p className={`text-3xl font-bold ${status === 'good' ? 'text-green-600' : status === 'caution' ? 'text-yellow-600' : 'text-red-600'}`}>
              {currentHRV.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500">ms</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">30-Day Avg</p>
            <p className="text-3xl font-bold text-gray-900">{avgHRV.toFixed(0)}</p>
            <p className="text-xs text-gray-500">ms (baseline)</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">7-Day Avg</p>
            <p className="text-3xl font-bold text-gray-900">{week1Avg.toFixed(0)}</p>
            <p className="text-xs text-gray-500">ms</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Week Trend</p>
            <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
              <TrendIcon size={20} />
              <span className="text-2xl font-bold">
                {weekChangePercent >= 0 ? '+' : ''}{weekChangePercent.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      <div className={`p-4 rounded-xl ${statusColors[status]}`}>
        <p className="font-medium">
          {status === 'good' && 'Your HRV is at or above your baseline - good recovery status.'}
          {status === 'caution' && 'HRV is slightly below baseline. Consider lighter training today.'}
          {status === 'warning' && 'HRV is significantly below baseline. Recovery or rest day recommended.'}
        </p>
      </div>

      {/* HRV Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">HRV Trend (Last 30 Days)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(0)} ms`, 'HRV']}
              />
              <ReferenceLine y={baseline} stroke="#9ca3af" strokeDasharray="5 5" label={{ value: 'Baseline', position: 'right', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="hrv"
                stroke="#e11d48"
                strokeWidth={2}
                dot={{ fill: '#e11d48', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RHR Section */}
      {rhrData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HeartPulse size={20} className="text-rose-500" />
              <h2 className="text-lg font-semibold text-gray-900">Resting Heart Rate</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{currentRHR}</p>
                <p className="text-xs text-gray-500">Current (bpm)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{avgRHR.toFixed(0)}</p>
                <p className="text-xs text-gray-500">Avg (bpm)</p>
              </div>
              <div className={`flex items-center gap-1 ${rhrTrendColor}`}>
                <RHRTrendIcon size={16} />
                <span className="text-sm font-medium">
                  {rhrTrend === 'down' ? 'Good' : rhrTrend === 'up' ? 'Elevated' : 'Stable'}
                </span>
              </div>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rhrChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip formatter={(value: number) => [`${value} bpm`, 'RHR']} />
                <ReferenceLine y={avgRHR} stroke="#9ca3af" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="rhr"
                  fill="#fecdd3"
                  stroke="#e11d48"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p className="text-sm text-gray-500 mt-3">
            Lower RHR generally indicates better cardiovascular fitness. Elevated RHR can signal stress, fatigue, or illness.
          </p>
        </div>
      )}

      {/* Interpretation Guide */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Understanding Your Recovery Metrics</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>HRV (Heart Rate Variability):</strong> Measures variation between heartbeats. Higher HRV = better recovery. Your baseline: {baseline.toFixed(0)} ms.</p>
          <p><strong>RHR (Resting Heart Rate):</strong> Lower is generally better. Elevated RHR often appears before HRV drops - it's an early warning sign.</p>
          <p><strong>When to rest:</strong> Low HRV combined with elevated RHR strongly suggests you need recovery.</p>
          <p><strong>When to train hard:</strong> HRV at/above baseline with stable or low RHR indicates readiness.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <p className="text-primary-800 mb-4">
          {status === 'good'
            ? "Your HRV indicates good recovery. You're ready for quality training."
            : "Consider what might be affecting your HRV: sleep quality, stress, training load, or illness."
          }
        </p>
        <button
          onClick={() => onAskAI('Analyze my HRV trends and recommend how to improve my recovery')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Get Recovery Insights
        </button>
      </div>
    </div>
  );
}
