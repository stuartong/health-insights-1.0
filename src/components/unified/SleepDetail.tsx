import { Moon, MessageCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { format } from 'date-fns';

interface Props {
  onAskAI: (context: string) => void;
}

export function SleepDetail({ onAskAI }: Props) {
  const { recentSleep } = useHealthStore();

  if (recentSleep.length === 0) {
    return (
      <div className="text-center py-12">
        <Moon size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Sleep Data</h2>
        <p className="text-gray-500">Import your sleep data from Oura or Apple Health</p>
      </div>
    );
  }

  const chartData = recentSleep.slice(0, 14).reverse().map((s) => ({
    date: format(s.date, 'MMM d'),
    duration: s.duration / 60,
    deep: (s.deepSleep || 0) / 60,
    rem: (s.remSleep || 0) / 60,
    light: (s.lightSleep || 0) / 60,
    efficiency: s.efficiency || 0,
  }));

  const avgSleep = recentSleep.slice(0, 7).reduce((sum, s) => sum + s.duration, 0) / Math.min(7, recentSleep.length) / 60;
  const avgEfficiency = recentSleep.slice(0, 7).reduce((sum, s) => sum + (s.efficiency || 0), 0) / Math.min(7, recentSleep.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
        <div className="flex items-center gap-3 mb-4">
          <Moon size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Sleep Analysis</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Avg Sleep</p>
            <p className={`text-3xl font-bold ${avgSleep >= 7 ? 'text-green-600' : avgSleep >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {avgSleep.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">hrs/night</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Efficiency</p>
            <p className={`text-3xl font-bold ${avgEfficiency >= 85 ? 'text-green-600' : avgEfficiency >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
              {avgEfficiency.toFixed(0)}%
            </p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Last Night</p>
            <p className="text-3xl font-bold text-gray-900">
              {(recentSleep[0].duration / 60).toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">hours</p>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">HRV</p>
            <p className="text-3xl font-bold text-gray-900">
              {recentSleep[0].hrv?.toFixed(0) || '--'}
            </p>
            <p className="text-xs text-gray-500">ms</p>
          </div>
        </div>
      </div>

      {/* Sleep Duration Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sleep Duration (Last 14 Days)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 10]} />
              <Tooltip />
              <Area type="monotone" dataKey="duration" fill="#a5b4fc" stroke="#6366f1" name="Total Sleep (hrs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sleep Stages */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sleep Stages</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="deep" stackId="a" fill="#4f46e5" name="Deep" />
              <Bar dataKey="rem" stackId="a" fill="#8b5cf6" name="REM" />
              <Bar dataKey="light" stackId="a" fill="#c4b5fd" name="Light" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <p className="text-primary-800 mb-4">
          {avgSleep >= 7
            ? "Good sleep consistency! Keep maintaining your sleep schedule."
            : "Your sleep average is below 7 hours. Prioritize earlier bedtimes."
          }
        </p>
        <button
          onClick={() => onAskAI('How can I improve my sleep quality based on my data?')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          Get Sleep Tips
        </button>
      </div>
    </div>
  );
}
