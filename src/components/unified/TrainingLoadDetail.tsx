import { Activity, AlertTriangle, Check, MessageCircle } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar, Line, ReferenceArea, ReferenceLine } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

interface Props {
  onAskAI: (context: string) => void;
}

// Calculate TSS if not provided - estimate from duration and intensity
function estimateTSS(workout: { duration: number; avgHeartRate?: number; type: string }): number {
  const baseTSS = workout.duration * 0.5; // Base: 0.5 TSS per minute

  // Adjust by workout type
  const typeMultiplier: Record<string, number> = {
    run: 1.2,
    cycle: 1.0,
    swim: 1.1,
    strength: 0.8,
    walk: 0.4,
    hike: 0.9,
    other: 0.7,
  };

  // Adjust by heart rate if available (higher HR = more stress)
  let hrMultiplier = 1.0;
  if (workout.avgHeartRate) {
    if (workout.avgHeartRate > 160) hrMultiplier = 1.4;
    else if (workout.avgHeartRate > 140) hrMultiplier = 1.2;
    else if (workout.avgHeartRate > 120) hrMultiplier = 1.0;
    else hrMultiplier = 0.8;
  }

  return baseTSS * (typeMultiplier[workout.type] || 1) * hrMultiplier;
}

export function TrainingLoadDetail({ onAskAI }: Props) {
  const { trainingLoad, recentWorkouts } = useHealthStore();

  if (!trainingLoad) {
    return (
      <div className="text-center py-12">
        <Activity size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Training Data</h2>
        <p className="text-gray-500">Import your workout data to see training load analysis</p>
      </div>
    );
  }

  // Build daily loads for last 28 days
  const today = new Date();
  const dailyLoads: { date: Date; tss: number; workoutCount: number }[] = [];

  for (let i = 27; i >= 0; i--) {
    const day = startOfDay(subDays(today, i));
    const dayWorkouts = recentWorkouts.filter(w => isSameDay(new Date(w.date), day));
    const dayTSS = dayWorkouts.reduce((sum, w) => sum + (w.tss || estimateTSS(w)), 0);
    dailyLoads.push({
      date: day,
      tss: dayTSS,
      workoutCount: dayWorkouts.length,
    });
  }

  const riskZoneColors: Record<string, string> = {
    undertrained: 'text-blue-600 bg-blue-100',
    optimal: 'text-green-600 bg-green-100',
    overreaching: 'text-yellow-600 bg-yellow-100',
    danger: 'text-red-600 bg-red-100',
  };

  // Prepare chart data with rolling averages and ACWR
  const chartData = dailyLoads.map((load, i) => {
    // Calculate 7-day sum (acute load)
    const acuteStart = Math.max(0, i - 6);
    const acuteLoads = dailyLoads.slice(acuteStart, i + 1);
    const acuteSum = acuteLoads.reduce((sum, l) => sum + l.tss, 0);

    // Calculate 28-day average (chronic load)
    const chronicLoads = dailyLoads.slice(0, i + 1);
    const chronicAvg = chronicLoads.reduce((sum, l) => sum + l.tss, 0) / chronicLoads.length;

    // Calculate ACWR (acute sum / (chronic avg * 7))
    const acwr = chronicAvg > 0 ? acuteSum / (chronicAvg * 7) : 0;

    return {
      date: format(load.date, 'MMM d'),
      tss: Math.round(load.tss),
      acute: Math.round(acuteSum),
      chronic: Math.round(chronicAvg * 7), // Weekly equivalent for comparison
      acwr: parseFloat(acwr.toFixed(2)),
      workouts: load.workoutCount,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Training Load Analysis</h1>
          </div>
          <div className={`px-4 py-2 rounded-full font-semibold ${riskZoneColors[trainingLoad.riskZone]}`}>
            {trainingLoad.riskZone.charAt(0).toUpperCase() + trainingLoad.riskZone.slice(1)}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">ACWR</p>
            <p className={`text-3xl font-bold ${
              trainingLoad.acwr < 0.8 ? 'text-blue-600' :
              trainingLoad.acwr <= 1.3 ? 'text-green-600' :
              trainingLoad.acwr <= 1.5 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {trainingLoad.acwr.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Acute Load</p>
            <p className="text-3xl font-bold text-gray-900">{trainingLoad.acuteLoad.toFixed(0)}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Chronic Load</p>
            <p className="text-3xl font-bold text-gray-900">{trainingLoad.chronicLoad.toFixed(0)}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Trend</p>
            <p className={`text-3xl font-bold ${
              trainingLoad.trend === 'increasing' ? 'text-yellow-600' :
              trainingLoad.trend === 'decreasing' ? 'text-blue-600' :
              'text-green-600'
            }`}>
              {trainingLoad.trend.charAt(0).toUpperCase() + trainingLoad.trend.slice(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Combined Training Load & ACWR Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Training Stress & ACWR (Last 28 Days)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={3} />
              {/* Left Y-axis for TSS */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                label={{ value: 'TSS', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              {/* Right Y-axis for ACWR */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                domain={[0, 2]}
                ticks={[0, 0.8, 1.0, 1.3, 1.5, 2.0]}
                label={{ value: 'ACWR', angle: 90, position: 'insideRight', fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    tss: 'Daily TSS',
                    acwr: 'ACWR',
                  };
                  if (name === 'acwr') return [value.toFixed(2), labels[name]];
                  return [Math.round(value), labels[name] || name];
                }}
              />
              {/* ACWR zone reference areas - rendered first so they're behind */}
              <ReferenceArea yAxisId="right" y1={0} y2={0.8} fill="#3b82f6" fillOpacity={0.1} />
              <ReferenceArea yAxisId="right" y1={0.8} y2={1.3} fill="#22c55e" fillOpacity={0.15} />
              <ReferenceArea yAxisId="right" y1={1.3} y2={1.5} fill="#eab308" fillOpacity={0.15} />
              <ReferenceArea yAxisId="right" y1={1.5} y2={2} fill="#ef4444" fillOpacity={0.15} />
              {/* Reference lines for zone boundaries */}
              <ReferenceLine yAxisId="right" y={0.8} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine yAxisId="right" y={1.3} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine yAxisId="right" y={1.5} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              {/* Daily TSS bars */}
              <Bar yAxisId="left" dataKey="tss" fill="#a5b4fc" radius={[2, 2, 0, 0]} name="Daily TSS" />
              {/* ACWR line with color based on zone */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acwr"
                stroke="#6366f1"
                strokeWidth={3}
                dot={(props: { cx: number; cy: number; payload: { acwr: number }; index: number }) => {
                  const { cx, cy, payload } = props;
                  const acwr = payload.acwr;
                  let fill = '#22c55e'; // optimal
                  if (acwr < 0.8) fill = '#3b82f6'; // undertrained
                  else if (acwr > 1.5) fill = '#ef4444'; // danger
                  else if (acwr > 1.3) fill = '#eab308'; // overreaching
                  return (
                    <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={1} key={`dot-${props.index}`} />
                  );
                }}
                name="ACWR"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 bg-indigo-300 rounded" />
            <span className="text-gray-600">Daily TSS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-1 bg-indigo-500 rounded" />
            <span className="text-gray-600">ACWR</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-200 rounded" />
            <span className="text-gray-600">{'<0.8'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-200 rounded" />
            <span className="text-gray-600">0.8-1.3</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-200 rounded" />
            <span className="text-gray-600">1.3-1.5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-200 rounded" />
            <span className="text-gray-600">{'>1.5'}</span>
          </div>
        </div>
      </div>

      {/* Risk Zones Explanation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ACWR Risk Zones</h2>
        <div className="space-y-3">
          <div className={`p-3 rounded-lg flex items-center justify-between ${trainingLoad.acwr < 0.8 ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-50'}`}>
            <div>
              <p className="font-medium text-blue-700">{'< 0.8'} - Undertrained</p>
              <p className="text-sm text-gray-600">Low training load, detraining risk</p>
            </div>
            {trainingLoad.acwr < 0.8 && <Check className="text-blue-600" />}
          </div>
          <div className={`p-3 rounded-lg flex items-center justify-between ${trainingLoad.acwr >= 0.8 && trainingLoad.acwr <= 1.3 ? 'bg-green-100 ring-2 ring-green-500' : 'bg-gray-50'}`}>
            <div>
              <p className="font-medium text-green-700">0.8 - 1.3 - Optimal</p>
              <p className="text-sm text-gray-600">Sweet spot for training adaptation</p>
            </div>
            {trainingLoad.acwr >= 0.8 && trainingLoad.acwr <= 1.3 && <Check className="text-green-600" />}
          </div>
          <div className={`p-3 rounded-lg flex items-center justify-between ${trainingLoad.acwr > 1.3 && trainingLoad.acwr <= 1.5 ? 'bg-yellow-100 ring-2 ring-yellow-500' : 'bg-gray-50'}`}>
            <div>
              <p className="font-medium text-yellow-700">1.3 - 1.5 - Overreaching</p>
              <p className="text-sm text-gray-600">Increased injury risk, monitor closely</p>
            </div>
            {trainingLoad.acwr > 1.3 && trainingLoad.acwr <= 1.5 && <AlertTriangle className="text-yellow-600" />}
          </div>
          <div className={`p-3 rounded-lg flex items-center justify-between ${trainingLoad.acwr > 1.5 ? 'bg-red-100 ring-2 ring-red-500' : 'bg-gray-50'}`}>
            <div>
              <p className="font-medium text-red-700">{'> 1.5'} - Danger Zone</p>
              <p className="text-sm text-gray-600">High injury risk, rest recommended</p>
            </div>
            {trainingLoad.acwr > 1.5 && <AlertTriangle className="text-red-600" />}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <p className="text-primary-800">
          {trainingLoad.riskZone === 'danger'
            ? 'Your training load is very high. Take a rest day or very easy recovery session to reduce injury risk.'
            : trainingLoad.riskZone === 'overreaching'
            ? 'Training load is elevated. Consider reducing intensity this week and focusing on recovery.'
            : trainingLoad.riskZone === 'undertrained'
            ? 'Your recent training load is low. Good opportunity to gradually increase volume or intensity.'
            : 'Training load is in the optimal zone. Continue with your planned training.'}
        </p>
        <button
          onClick={() => onAskAI('Create a recovery plan based on my current training load')}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Get Recovery Plan
        </button>
      </div>
    </div>
  );
}
