import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { subDays, format, startOfDay, eachDayOfInterval } from 'date-fns';
import { calculateWorkoutTSS } from '@/algorithms/trainingLoad';
import { calculateACWR } from '@/algorithms/acwr';

export function ACWRChart() {
  const { recentWorkouts } = useHealthStore();

  const chartData = useMemo(() => {
    if (recentWorkouts.length === 0) return [];

    const today = startOfDay(new Date());
    const start = subDays(today, 42); // Need 42 days for proper ACWR calculation
    const days = eachDayOfInterval({ start, end: today });

    // Calculate daily TSS
    const dailyTSS = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayWorkouts = recentWorkouts.filter(
        (w) => format(new Date(w.date), 'yyyy-MM-dd') === dayStr
      );
      return dayWorkouts.reduce((sum, w) => sum + (w.tss || calculateWorkoutTSS(w)), 0);
    });

    // Calculate rolling ACWR for each day
    return days.slice(28).map((day, i) => {
      const relevantTSS = dailyTSS.slice(i, i + 28);
      const acwr = calculateACWR(relevantTSS);

      return {
        date: format(day, 'MMM d'),
        fullDate: format(day, 'MMM d, yyyy'),
        acwr: Math.min(2.5, Math.max(0, acwr)), // Clamp for visualization
        actualAcwr: acwr,
      };
    });
  }, [recentWorkouts]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No workout data available for ACWR calculation
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="acwrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          {/* Risk zones */}
          <ReferenceArea y1={0} y2={0.8} fill="#fef3c7" fillOpacity={0.5} />
          <ReferenceArea y1={0.8} y2={1.3} fill="#dcfce7" fillOpacity={0.5} />
          <ReferenceArea y1={1.3} y2={1.5} fill="#ffedd5" fillOpacity={0.5} />
          <ReferenceArea y1={1.5} y2={2.5} fill="#fee2e2" fillOpacity={0.5} />

          {/* Reference lines */}
          <ReferenceLine y={0.8} stroke="#f59e0b" strokeDasharray="3 3" />
          <ReferenceLine y={1.0} stroke="#22c55e" strokeDasharray="3 3" />
          <ReferenceLine y={1.3} stroke="#22c55e" strokeDasharray="3 3" />
          <ReferenceLine y={1.5} stroke="#ef4444" strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 2]}
            ticks={[0, 0.5, 0.8, 1.0, 1.3, 1.5, 2.0]}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={35}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              const acwr = data.actualAcwr;

              let zone = 'Optimal';
              let zoneColor = '#22c55e';
              if (acwr < 0.8) {
                zone = 'Undertrained';
                zoneColor = '#f59e0b';
              } else if (acwr > 1.5) {
                zone = 'Danger';
                zoneColor = '#ef4444';
              } else if (acwr > 1.3) {
                zone = 'Overreaching';
                zoneColor = '#f97316';
              }

              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{data.fullDate}</p>
                  <p className="text-lg font-bold text-primary-600 mt-1">
                    ACWR: {acwr.toFixed(2)}
                  </p>
                  <p className="text-sm mt-1" style={{ color: zoneColor }}>
                    {zone}
                  </p>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="acwr"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#acwrGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning-200" />
          <span className="text-gray-600">&lt;0.8 Undertrained</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success-200" />
          <span className="text-gray-600">0.8-1.3 Optimal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-200" />
          <span className="text-gray-600">1.3-1.5 Overreaching</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-danger-200" />
          <span className="text-gray-600">&gt;1.5 Danger</span>
        </div>
      </div>
    </div>
  );
}
