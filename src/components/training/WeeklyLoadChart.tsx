import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { subWeeks, startOfWeek, endOfWeek, format } from 'date-fns';
import { formatDuration } from '@/utils/formatters';

export function WeeklyLoadChart() {
  const { recentWorkouts } = useHealthStore();

  const chartData = useMemo(() => {
    const weeks: { start: Date; end: Date; label: string }[] = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      weeks.push({
        start: weekStart,
        end: weekEnd,
        label: format(weekStart, 'MMM d'),
      });
    }

    return weeks.map(({ start, end, label }) => {
      const weekWorkouts = recentWorkouts.filter((w) => {
        const d = new Date(w.date);
        return d >= start && d <= end;
      });

      const totalDuration = weekWorkouts.reduce((sum, w) => sum + w.duration, 0);
      const totalDistance = weekWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0);
      const workoutCount = weekWorkouts.length;

      // Calculate by type
      const byType = weekWorkouts.reduce((acc, w) => {
        acc[w.type] = (acc[w.type] || 0) + w.duration;
        return acc;
      }, {} as Record<string, number>);

      return {
        week: label,
        duration: totalDuration,
        distance: totalDistance,
        workouts: workoutCount,
        run: byType.run || 0,
        cycle: byType.cycle || 0,
        strength: byType.strength || 0,
        other: (byType.swim || 0) + (byType.walk || 0) + (byType.hike || 0) + (byType.other || 0),
      };
    });
  }, [recentWorkouts]);

  // Calculate average for reference
  const avgDuration = chartData.reduce((sum, d) => sum + d.duration, 0) / chartData.length;

  if (recentWorkouts.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No workout data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `${Math.round(value / 60)}h`}
            width={35}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;

              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <p className="text-sm font-medium text-gray-900">Week of {label}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      Total: <span className="font-medium">{formatDuration(data.duration)}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Workouts: <span className="font-medium">{data.workouts}</span>
                    </p>
                    {data.distance > 0 && (
                      <p className="text-sm text-gray-600">
                        Distance: <span className="font-medium">{(data.distance / 1000).toFixed(1)} km</span>
                      </p>
                    )}
                    <div className="pt-1 border-t border-gray-100 mt-1">
                      {data.run > 0 && (
                        <p className="text-xs text-blue-600">Running: {formatDuration(data.run)}</p>
                      )}
                      {data.cycle > 0 && (
                        <p className="text-xs text-green-600">Cycling: {formatDuration(data.cycle)}</p>
                      )}
                      {data.strength > 0 && (
                        <p className="text-xs text-purple-600">Strength: {formatDuration(data.strength)}</p>
                      )}
                      {data.other > 0 && (
                        <p className="text-xs text-gray-600">Other: {formatDuration(data.other)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.duration > avgDuration * 1.2 ? '#f59e0b' : '#0ea5e9'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
