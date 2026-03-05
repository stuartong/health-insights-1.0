import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { exponentialSmoothing, simpleMovingAverage } from '@/algorithms/exponentialSmoothing';
import { format, subDays } from 'date-fns';

type TimeRange = '30d' | '90d' | '180d' | 'all';

export function WeightChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');
  const [showMovingAvg, setShowMovingAvg] = useState(false);

  const { recentWeight } = useHealthStore();
  const { settings, profile } = useSettingsStore();

  const chartData = useMemo(() => {
    if (recentWeight.length === 0) return [];

    // Filter by time range
    const now = new Date();
    let filteredWeight = recentWeight;

    if (timeRange !== 'all') {
      const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 180;
      const cutoff = subDays(now, days);
      filteredWeight = recentWeight.filter((w) => new Date(w.date) >= cutoff);
    }

    // Sort by date ascending
    const sorted = [...filteredWeight].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate smoothed values
    const weights = sorted.map((w) => w.weight);
    const smoothed = exponentialSmoothing(weights, 0.1);
    const movingAvg = simpleMovingAverage(weights, 7);

    // Convert units if needed
    const convertWeight = (kg: number) => {
      if (settings.units.weight === 'lbs') {
        return kg * 2.20462;
      }
      return kg;
    };

    return sorted.map((entry, i) => ({
      date: format(new Date(entry.date), 'MMM d'),
      fullDate: format(new Date(entry.date), 'MMM d, yyyy'),
      raw: convertWeight(entry.weight),
      smoothed: convertWeight(smoothed[i]),
      movingAvg: convertWeight(movingAvg[i]),
    }));
  }, [recentWeight, timeRange, settings.units.weight]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    const allValues = chartData.flatMap((d) => [d.raw, d.smoothed]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1 || 5;

    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData]);

  const goalWeight = profile.weightGoal
    ? settings.units.weight === 'lbs'
      ? profile.weightGoal * 2.20462
      : profile.weightGoal
    : null;

  const unit = settings.units.weight;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['30d', '90d', '180d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === 'all' ? 'All' : range.replace('d', ' days')}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showMovingAvg}
            onChange={(e) => setShowMovingAvg(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show 7-day moving average
        </label>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `${value}`}
              width={45}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <p className="text-sm font-medium text-gray-900">{data.fullDate}</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-600">
                        Raw: <span className="font-medium">{data.raw.toFixed(1)} {unit}</span>
                      </p>
                      <p className="text-sm text-primary-600">
                        Trend: <span className="font-medium">{data.smoothed.toFixed(1)} {unit}</span>
                      </p>
                      {showMovingAvg && (
                        <p className="text-sm text-warning-600">
                          7d Avg: <span className="font-medium">{data.movingAvg.toFixed(1)} {unit}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {/* Goal line */}
            {goalWeight && (
              <ReferenceLine
                y={goalWeight}
                stroke="#22c55e"
                strokeDasharray="5 5"
                label={{
                  value: `Goal: ${goalWeight.toFixed(1)}`,
                  position: 'right',
                  fill: '#22c55e',
                  fontSize: 12,
                }}
              />
            )}

            {/* Raw data points */}
            <Scatter
              dataKey="raw"
              fill="#94a3b8"
              fillOpacity={0.6}
              shape="circle"
              legendType="none"
            />

            {/* Moving average line */}
            {showMovingAvg && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="7-day avg"
              />
            )}

            {/* Smoothed trend line */}
            <Line
              type="monotone"
              dataKey="smoothed"
              stroke="#0ea5e9"
              strokeWidth={2.5}
              dot={false}
              name="Trend"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-gray-600">Raw measurements</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-primary-500 rounded" />
          <span className="text-gray-600">Smoothed trend</span>
        </div>
        {showMovingAvg && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-warning-500 rounded border-dashed" />
            <span className="text-gray-600">7-day average</span>
          </div>
        )}
        {goalWeight && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-success-500 rounded border-dashed" />
            <span className="text-gray-600">Goal</span>
          </div>
        )}
      </div>
    </div>
  );
}
