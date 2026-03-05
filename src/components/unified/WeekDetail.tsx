import { Calendar, Activity, Dumbbell, MessageCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';

interface Props {
  onAskAI: (context: string) => void;
}

export function WeekDetail({ onAskAI }: Props) {
  const { recentWorkouts, recentSleep, recentHRV } = useHealthStore();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Get this week's data
  const weekWorkouts = recentWorkouts.filter(w => {
    const d = new Date(w.date);
    return d >= weekStart && d <= weekEnd;
  });
  const weekSleep = recentSleep.filter(s => {
    const d = new Date(s.date);
    return d >= weekStart && d <= weekEnd;
  });
  const weekHRV = recentHRV.filter(h => {
    const d = new Date(h.date);
    return d >= weekStart && d <= weekEnd;
  });

  // Daily breakdown for chart
  const dailyData = daysInWeek.map(day => {
    const dayWorkouts = weekWorkouts.filter(w => isSameDay(new Date(w.date), day));
    const daySleep = weekSleep.find(s => isSameDay(new Date(s.date), day));
    const dayHRV = weekHRV.find(h => isSameDay(new Date(h.date), day));

    const runKm = dayWorkouts.filter(w => w.type === 'run').reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
    const strengthMins = dayWorkouts.filter(w => w.type === 'strength').reduce((sum, w) => sum + w.duration, 0);
    const otherMins = dayWorkouts.filter(w => !['run', 'strength'].includes(w.type)).reduce((sum, w) => sum + w.duration, 0);

    return {
      day: format(day, 'EEE'),
      fullDate: format(day, 'MMM d'),
      runKm,
      strengthMins,
      otherMins,
      sleep: daySleep ? daySleep.duration / 60 : 0,
      hrv: dayHRV?.value || 0,
      workoutCount: dayWorkouts.length,
    };
  });

  // Workout type breakdown
  const workoutTypes = new Map<string, { count: number; duration: number; distance: number }>();
  weekWorkouts.forEach(w => {
    const existing = workoutTypes.get(w.type) || { count: 0, duration: 0, distance: 0 };
    workoutTypes.set(w.type, {
      count: existing.count + 1,
      duration: existing.duration + w.duration,
      distance: existing.distance + (w.distance || 0),
    });
  });

  const typeBreakdown = Array.from(workoutTypes.entries()).map(([type, data]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count: data.count,
    duration: data.duration,
    distance: data.distance / 1000,
  }));

  const pieColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  // Calculate totals
  const totalWorkouts = weekWorkouts.length;
  const totalRunKm = weekWorkouts.filter(w => w.type === 'run').reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
  const totalDuration = weekWorkouts.reduce((sum, w) => sum + w.duration, 0);
  const avgSleep = weekSleep.length > 0 ? weekSleep.reduce((sum, s) => sum + s.duration, 0) / weekSleep.length / 60 : 0;
  const avgHRV = weekHRV.length > 0 ? weekHRV.reduce((sum, h) => sum + h.value, 0) / weekHRV.length : 0;

  // Strength training details
  const strengthWorkouts = weekWorkouts.filter(w => w.type === 'strength');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <Calendar size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Week Overview</h1>
          <span className="text-gray-500">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Workouts</p>
            <p className="text-3xl font-bold text-gray-900">{totalWorkouts}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Run Distance</p>
            <p className="text-3xl font-bold text-blue-600">{totalRunKm.toFixed(1)}</p>
            <p className="text-xs text-gray-500">km</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Active Time</p>
            <p className="text-3xl font-bold text-green-600">{Math.round(totalDuration)}</p>
            <p className="text-xs text-gray-500">minutes</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Avg Sleep</p>
            <p className={`text-3xl font-bold ${avgSleep >= 7 ? 'text-green-600' : avgSleep >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {avgSleep.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">hrs</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Avg HRV</p>
            <p className="text-3xl font-bold text-rose-600">{avgHRV.toFixed(0)}</p>
            <p className="text-xs text-gray-500">ms</p>
          </div>
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'runKm') return [`${value.toFixed(1)} km`, 'Running'];
                  if (name === 'strengthMins') return [`${value} min`, 'Strength'];
                  if (name === 'otherMins') return [`${value} min`, 'Other'];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar dataKey="runKm" name="Running (km)" fill="#6366f1" />
              <Bar dataKey="strengthMins" name="Strength (min)" fill="#22c55e" />
              <Bar dataKey="otherMins" name="Other (min)" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sleep & HRV Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recovery Metrics</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={[0, 10]} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="sleep" name="Sleep (hrs)" fill="#8b5cf6" />
              <Bar yAxisId="right" dataKey="hrv" name="HRV (ms)" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Workout Type Breakdown */}
      {typeBreakdown.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Workout Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeBreakdown}
                    dataKey="duration"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                  >
                    {typeBreakdown.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} min`, 'Duration']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {typeBreakdown.map((t, i) => (
                <div key={t.type} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                    <span className="font-medium text-gray-900">{t.type}</span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <span>{t.count} sessions</span>
                    {t.distance > 0 && <span className="ml-2">• {t.distance.toFixed(1)} km</span>}
                    <span className="ml-2">• {t.duration} min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strength Training Summary */}
      {strengthWorkouts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell size={20} className="text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Strength Training This Week</h2>
          </div>
          <div className="space-y-3">
            {strengthWorkouts.map(w => (
              <div key={w.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{w.name || 'Strength Training'}</span>
                  <span className="text-sm text-gray-500">{format(new Date(w.date), 'EEE, MMM d')}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {w.duration} min
                  {w.calories && <span className="ml-2">• {w.calories} kcal</span>}
                </div>
                {w.exercises && w.exercises.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {w.exercises.map((ex, i) => (
                      <div key={i} className="ml-2">
                        • {ex.exercise}: {ex.weight}kg × {ex.reps} reps
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Workouts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Workouts This Week</h2>
        {weekWorkouts.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No workouts recorded this week</p>
        ) : (
          <div className="space-y-2">
            {weekWorkouts.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity size={18} className="text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{w.name || w.type}</p>
                    <p className="text-sm text-gray-500">{format(new Date(w.date), 'EEE, MMM d')}</p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-600">
                  {w.distance && <span>{(w.distance / 1000).toFixed(2)} km</span>}
                  <span className="ml-2">{w.duration} min</span>
                  {w.avgHeartRate && <span className="ml-2">• {w.avgHeartRate} bpm avg</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <button
          onClick={() => onAskAI('Based on this week\'s training, what should I focus on next week?')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Plan Next Week
        </button>
      </div>
    </div>
  );
}
