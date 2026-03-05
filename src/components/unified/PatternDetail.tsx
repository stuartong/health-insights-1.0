import { Lightbulb, AlertTriangle, Scale, MessageCircle, Dumbbell, Moon, Activity, TrendingUp, Heart, Trophy, Timer, Zap } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, BarChart, Bar, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { useHealthStore } from '@/stores/healthStore';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

interface Props {
  patternId: string;
  onAskAI: (context: string) => void;
}

export function PatternDetail({ patternId, onAskAI }: Props) {
  const { recentWorkouts, recentSleep, recentWeight, trainingLoad } = useHealthStore();

  // Sleep vs Performance pattern
  if (patternId === 'sleep-performance') {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run' && w.avgPace);

    const sleepVsPace = runWorkouts.slice(0, 30).map(w => {
      const sleepBefore = recentSleep.find(s =>
        format(new Date(s.date), 'yyyy-MM-dd') === format(subDays(new Date(w.date), 1), 'yyyy-MM-dd')
      );
      return {
        sleep: sleepBefore ? sleepBefore.duration / 60 : null,
        pace: w.avgPace ? w.avgPace / 60 : null, // Convert to min/km
        date: format(new Date(w.date), 'MMM d'),
        paceLabel: w.avgPace ? `${Math.floor(w.avgPace / 60)}:${String(Math.round(w.avgPace % 60)).padStart(2, '0')}` : null,
      };
    }).filter(d => d.sleep !== null && d.pace !== null);

    const goodSleepRuns = sleepVsPace.filter(d => (d.sleep || 0) >= 7);
    const poorSleepRuns = sleepVsPace.filter(d => (d.sleep || 0) < 7);

    const avgPaceGoodSleep = goodSleepRuns.length > 0
      ? goodSleepRuns.reduce((sum, d) => sum + (d.pace || 0), 0) / goodSleepRuns.length
      : 0;
    const avgPacePoorSleep = poorSleepRuns.length > 0
      ? poorSleepRuns.reduce((sum, d) => sum + (d.pace || 0), 0) / poorSleepRuns.length
      : 0;

    const paceDiff = avgPacePoorSleep - avgPaceGoodSleep; // Positive = faster with good sleep

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Sleep vs Running Performance</h1>
          </div>
          <p className="text-gray-600">
            Analysis of how your sleep duration affects your running pace
          </p>
        </div>

        {/* Key Finding */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Finding</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Pace (7+ hrs sleep)</p>
              <p className="text-2xl font-bold text-green-600">
                {avgPaceGoodSleep > 0 ? `${Math.floor(avgPaceGoodSleep)}:${String(Math.round((avgPaceGoodSleep % 1) * 60)).padStart(2, '0')}` : '--'}
              </p>
              <p className="text-xs text-gray-500">/km ({goodSleepRuns.length} runs)</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Pace ({'<'}7 hrs sleep)</p>
              <p className="text-2xl font-bold text-red-600">
                {avgPacePoorSleep > 0 ? `${Math.floor(avgPacePoorSleep)}:${String(Math.round((avgPacePoorSleep % 1) * 60)).padStart(2, '0')}` : '--'}
              </p>
              <p className="text-xs text-gray-500">/km ({poorSleepRuns.length} runs)</p>
            </div>
          </div>
          {paceDiff > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-blue-800 font-medium">
                You run ~{Math.round(paceDiff * 60)} seconds/km faster after 7+ hours of sleep
              </p>
            </div>
          )}
        </div>

        {/* Scatter Plot */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sleep vs Pace Correlation</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="sleep"
                  name="Sleep"
                  unit=" hrs"
                  domain={[5, 9]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Sleep (hours)', position: 'bottom', offset: 0 }}
                />
                <YAxis
                  type="number"
                  dataKey="pace"
                  name="Pace"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 12 }}
                  reversed
                  label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Pace') {
                      const mins = Math.floor(value);
                      const secs = Math.round((value - mins) * 60);
                      return [`${mins}:${String(secs).padStart(2, '0')} /km`, name];
                    }
                    return [`${value.toFixed(1)} hrs`, name];
                  }}
                />
                <Scatter data={sleepVsPace} fill="#6366f1" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <p className="text-primary-800 mb-4">
            Prioritizing 7+ hours of sleep could be your easiest performance gain.
          </p>
          <button
            onClick={() => onAskAI('How can I improve my sleep to run faster?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Sleep Tips
          </button>
        </div>
      </div>
    );
  }

  // Training load warning
  if (patternId === 'training-load-warning' && trainingLoad) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={24} className="text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">Training Load Warning</h1>
          </div>
          <p className="text-gray-600">
            Your acute:chronic workload ratio indicates elevated injury risk
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Current ACWR</p>
              <p className="text-4xl font-bold text-red-600">{trainingLoad.acwr.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Target: 0.8 - 1.3</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Risk Zone</p>
              <p className="text-2xl font-bold text-gray-900 capitalize">{trainingLoad.riskZone}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>Reduce training intensity for the next 3-5 days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>Replace hard sessions with easy aerobic work</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>Prioritize sleep and recovery nutrition</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>Monitor for signs of overtraining: persistent fatigue, poor sleep, elevated resting HR</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Create a recovery plan for my elevated training load')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Recovery Plan
          </button>
        </div>
      </div>
    );
  }

  // Weight progress
  if (patternId === 'weight-progress') {
    const chartData = recentWeight.slice(0, 30).reverse().map(w => ({
      date: format(new Date(w.date), 'MMM d'),
      weight: w.weight,
    }));

    const current = recentWeight[0]?.weight || 0;
    const twoWeeksAgo = recentWeight[13]?.weight || current;
    const change = current - twoWeeksAgo;

    return (
      <div className="space-y-6">
        <div className={`bg-gradient-to-br ${change < 0 ? 'from-green-50 to-emerald-50 border-green-200' : 'from-amber-50 to-orange-50 border-amber-200'} rounded-xl p-6 border`}>
          <div className="flex items-center gap-3 mb-4">
            <Scale size={24} className={change < 0 ? 'text-green-600' : 'text-amber-600'} />
            <h1 className="text-2xl font-bold text-gray-900">Weight Progress</h1>
          </div>
          <p className="text-gray-600">
            {change < 0 ? 'Your weight is trending down' : 'Your weight is trending up'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Current</p>
              <p className="text-3xl font-bold text-gray-900">{current.toFixed(1)}</p>
              <p className="text-xs text-gray-500">kg</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">2 Weeks Ago</p>
              <p className="text-3xl font-bold text-gray-900">{twoWeeksAgo.toFixed(1)}</p>
              <p className="text-xs text-gray-500">kg</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${change < 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
              <p className="text-sm text-gray-500 mb-1">Change</p>
              <p className={`text-3xl font-bold ${change < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">kg</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Analyze my weight trend and give me advice')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Weight Advice
          </button>
        </div>
      </div>
    );
  }

  // Lifting frequency patterns
  if (patternId === 'lifting-frequency-low' || patternId === 'lifting-frequency-good') {
    const strengthWorkouts = recentWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    );

    // Build weekly frequency chart
    const weeklyData: { week: string; sessions: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekSessions = strengthWorkouts.filter(w => {
        const wDate = new Date(w.date);
        return wDate >= weekStart && wDate <= weekEnd;
      }).length;
      weeklyData.push({
        week: format(weekStart, 'MMM d'),
        sessions: weekSessions,
      });
    }

    const totalSessions = strengthWorkouts.length;
    const weeksSpan = Math.max(1, weeklyData.length);
    const avgFrequency = totalSessions / weeksSpan;

    // Get exercise breakdown
    const exerciseCounts = new Map<string, number>();
    strengthWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const name = ex.exercise.toLowerCase();
        exerciseCounts.set(name, (exerciseCounts.get(name) || 0) + 1);
      });
    });
    const topExercises = Array.from(exerciseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const isLow = patternId === 'lifting-frequency-low';

    return (
      <div className="space-y-6">
        <div className={`bg-gradient-to-br ${isLow ? 'from-amber-50 to-orange-50 border-amber-200' : 'from-green-50 to-emerald-50 border-green-200'} rounded-xl p-6 border`}>
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell size={24} className={isLow ? 'text-amber-600' : 'text-green-600'} />
            <h1 className="text-2xl font-bold text-gray-900">Lifting Frequency Analysis</h1>
          </div>
          <p className="text-gray-600">
            {isLow
              ? 'Your lifting frequency is below optimal for strength gains'
              : 'Great consistency with your strength training'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Sessions</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Average per Week</p>
              <p className={`text-4xl font-bold ${isLow ? 'text-amber-600' : 'text-green-600'}`}>
                {avgFrequency.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-1">sessions</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Optimal Range</p>
              <p className="text-4xl font-bold text-gray-900">2-4</p>
              <p className="text-xs text-gray-500 mt-1">sessions/week</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                <Tooltip />
                <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.sessions >= 2 ? '#22c55e' : entry.sessions >= 1 ? '#eab308' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {topExercises.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Frequent Exercises</h2>
            <div className="space-y-3">
              {topExercises.map(([exercise, count]) => (
                <div key={exercise} className="flex items-center justify-between">
                  <span className="text-gray-700 capitalize">{exercise}</span>
                  <span className="text-sm font-medium text-gray-500">{count} sets</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
          <ul className="space-y-2 text-gray-600">
            {isLow ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>Aim for 2-4 lifting sessions per week for optimal strength gains</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>Each major muscle group needs stimulus 2x per week</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>Even 2 full-body sessions beats 1 longer session</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>Great consistency! This frequency supports muscle growth</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>Focus on progressive overload - add weight or reps each session</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>Ensure adequate protein intake (1.6-2.2g per kg bodyweight)</span>
                </li>
              </>
            )}
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Create a weekly lifting schedule based on my current frequency')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Lifting Schedule
          </button>
        </div>
      </div>
    );
  }

  // Sleep impact on lifting
  if (patternId === 'sleep-lifting') {
    const strengthWorkouts = recentWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    );

    const sleepImpact = strengthWorkouts.slice(0, 20).map(w => {
      const sleepBefore = recentSleep.find(s =>
        format(new Date(s.date), 'yyyy-MM-dd') === format(subDays(new Date(w.date), 1), 'yyyy-MM-dd')
      );
      return {
        date: format(new Date(w.date), 'MMM d'),
        sleep: sleepBefore ? sleepBefore.duration / 60 : null,
        exerciseCount: w.exercises?.length || 0,
      };
    }).filter(d => d.sleep !== null);

    const poorSleepSessions = sleepImpact.filter(d => (d.sleep || 0) < 6).length;
    const goodSleepSessions = sleepImpact.filter(d => (d.sleep || 0) >= 7).length;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <Moon size={24} className="text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Sleep Impact on Strength Training</h1>
          </div>
          <p className="text-gray-600">
            How your sleep affects your lifting sessions
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Finding</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Sessions after {'<'}6 hrs</p>
              <p className="text-3xl font-bold text-red-600">{poorSleepSessions}</p>
              <p className="text-xs text-gray-500">lifting sessions</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Sessions after 7+ hrs</p>
              <p className="text-3xl font-bold text-green-600">{goodSleepSessions}</p>
              <p className="text-xs text-gray-500">lifting sessions</p>
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-amber-800 text-sm">
              Poor sleep reduces strength output by 10-20% and impairs muscle protein synthesis.
              Growth hormone release (critical for muscle repair) happens primarily during deep sleep.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sleep Before Lifting Sessions</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepImpact}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 10]} label={{ value: 'Sleep (hrs)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)} hrs`, 'Sleep']} />
                <Bar dataKey="sleep" radius={[4, 4, 0, 0]}>
                  {sleepImpact.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={(entry.sleep || 0) >= 7 ? '#22c55e' : (entry.sleep || 0) >= 6 ? '#eab308' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>Aim for 7-9 hours before heavy lifting days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>If sleep was poor, reduce intensity by 10-15% or focus on technique</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>Schedule heavy compound lifts on well-rested days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>Poor sleep + heavy deadlifts = injury risk</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How can I optimize my sleep for better strength gains?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Sleep Optimization Tips
          </button>
        </div>
      </div>
    );
  }

  // Push/pull imbalance
  if (patternId === 'push-pull-imbalance') {
    const strengthWorkouts = recentWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    );

    const pushExercises = ['bench press', 'bench', 'overhead press', 'ohp', 'push up', 'dip', 'shoulder press', 'incline'];
    const pullExercises = ['row', 'pull up', 'pullup', 'chin up', 'lat pulldown', 'deadlift', 'face pull', 'curl'];

    let pushCount = 0;
    let pullCount = 0;
    const exerciseBreakdown: { name: string; count: number; type: 'push' | 'pull' | 'other' }[] = [];

    strengthWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const name = ex.exercise.toLowerCase();
        let type: 'push' | 'pull' | 'other' = 'other';
        if (pushExercises.some(p => name.includes(p))) {
          pushCount++;
          type = 'push';
        } else if (pullExercises.some(p => name.includes(p))) {
          pullCount++;
          type = 'pull';
        }
        const existing = exerciseBreakdown.find(e => e.name === name);
        if (existing) existing.count++;
        else exerciseBreakdown.push({ name, count: 1, type });
      });
    });

    const ratio = pullCount > 0 ? (pushCount / pullCount).toFixed(1) : 'N/A';
    const topPush = exerciseBreakdown.filter(e => e.type === 'push').sort((a, b) => b.count - a.count).slice(0, 3);
    const topPull = exerciseBreakdown.filter(e => e.type === 'pull').sort((a, b) => b.count - a.count).slice(0, 3);

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={24} className="text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">Push/Pull Imbalance</h1>
          </div>
          <p className="text-gray-600">
            Your training has more pushing than pulling movements
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Exercise Balance</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Push Sets</p>
              <p className="text-3xl font-bold text-blue-600">{pushCount}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Pull Sets</p>
              <p className="text-3xl font-bold text-green-600">{pullCount}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Push:Pull</p>
              <p className="text-3xl font-bold text-amber-600">{ratio}:1</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-600 text-sm">
              Ideal ratio is 1:1 or even 1:1.5 (more pulling) for shoulder health
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 text-blue-600">Top Push Exercises</h3>
            {topPush.length > 0 ? (
              <ul className="space-y-2">
                {topPush.map(ex => (
                  <li key={ex.name} className="flex justify-between text-sm">
                    <span className="capitalize">{ex.name}</span>
                    <span className="text-gray-500">{ex.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No push exercises logged</p>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 text-green-600">Top Pull Exercises</h3>
            {topPull.length > 0 ? (
              <ul className="space-y-2">
                {topPull.map(ex => (
                  <li key={ex.name} className="flex justify-between text-sm">
                    <span className="capitalize">{ex.name}</span>
                    <span className="text-gray-500">{ex.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No pull exercises logged</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Balance</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Add rows, pull-ups, or face pulls to each session</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>For every bench press set, do a row set</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Face pulls help counter rounded shoulders from pushing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Imbalance can lead to shoulder impingement over time</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Create a balanced push/pull program for me')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Balanced Program
          </button>
        </div>
      </div>
    );
  }

  // Hybrid training
  if (patternId === 'hybrid-training') {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run');
    const strengthWorkouts = recentWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    );

    const totalRunKm = runWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
    const totalLiftSets = strengthWorkouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0);

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={24} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Hybrid Training Analysis</h1>
          </div>
          <p className="text-gray-600">
            You're combining running and strength training effectively
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Training Mix</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Running</p>
              <p className="text-3xl font-bold text-blue-600">{runWorkouts.length}</p>
              <p className="text-xs text-gray-500">runs ({totalRunKm.toFixed(0)} km)</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Strength</p>
              <p className="text-3xl font-bold text-green-600">{strengthWorkouts.length}</p>
              <p className="text-xs text-gray-500">sessions ({totalLiftSets} sets)</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hybrid Training Tips</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Lift before running on same-day sessions (if doing both)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Allow 6+ hours between hard sessions when possible</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Don't do heavy legs day before a hard run or race</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Protein needs are higher for hybrid athletes (1.8-2.2g/kg)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Running doesn't kill gains if nutrition and recovery are adequate</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Create a weekly hybrid training schedule for running and lifting')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Hybrid Schedule
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RUNNING PATTERNS
  // ==========================================================================

  // Easy run progression analysis
  if (patternId === 'easy-run-progression') {
    const easyRuns = recentWorkouts
      .filter(w => w.type === 'run' && (w.runCategory === 'easy' || w.runCategory === 'recovery') && w.avgPace)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData = easyRuns.slice(-20).map(r => ({
      date: format(new Date(r.date), 'MMM d'),
      pace: r.avgPace ? r.avgPace / 60 : 0,
      paceStr: r.avgPace ? `${Math.floor(r.avgPace / 60)}:${String(Math.round(r.avgPace % 60)).padStart(2, '0')}` : '',
    }));

    const firstHalfAvg = chartData.slice(0, Math.floor(chartData.length / 2)).reduce((s, d) => s + d.pace, 0) / Math.max(1, Math.floor(chartData.length / 2));
    const secondHalfAvg = chartData.slice(Math.floor(chartData.length / 2)).reduce((s, d) => s + d.pace, 0) / Math.max(1, chartData.length - Math.floor(chartData.length / 2));
    const improvement = firstHalfAvg - secondHalfAvg;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Easy Run Progression</h1>
          </div>
          <p className="text-gray-600">
            Tracking your aerobic fitness through easy-pace runs
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pace Trend</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Easy Runs</p>
              <p className="text-3xl font-bold text-gray-900">{easyRuns.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Pace</p>
              <p className="text-3xl font-bold text-gray-900">
                {chartData.length > 0 ? `${Math.floor(chartData.reduce((s, d) => s + d.pace, 0) / chartData.length)}:${String(Math.round((chartData.reduce((s, d) => s + d.pace, 0) / chartData.length % 1) * 60)).padStart(2, '0')}` : '--'}
              </p>
              <p className="text-xs text-gray-500">/km</p>
            </div>
            <div className={`rounded-lg p-4 text-center ${improvement > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
              <p className="text-sm text-gray-500 mb-1">Improvement</p>
              <p className={`text-3xl font-bold ${improvement > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {improvement > 0 ? `${Math.round(improvement * 60)}s` : '--'}
              </p>
              <p className="text-xs text-gray-500">faster /km</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis reversed domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')} /km`, 'Pace']} />
                <Line type="monotone" dataKey="pace" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Why Easy Pace Matters</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Easy runs build your aerobic base - the foundation of endurance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Same effort, faster pace = improving fitness</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>80% of your running should be at easy pace</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Analyze my easy run pace progression and suggest how to improve aerobic fitness')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Aerobic Training Tips
          </button>
        </div>
      </div>
    );
  }

  // Long run analysis
  if (patternId === 'long-run-analysis') {
    const longRuns = recentWorkouts
      .filter(w => w.type === 'run' && w.runCategory === 'long' && w.distance)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData = longRuns.slice(-12).map(r => ({
      date: format(new Date(r.date), 'MMM d'),
      distance: (r.distance || 0) / 1000,
      duration: r.duration,
    }));

    const avgDistance = chartData.reduce((s, d) => s + d.distance, 0) / Math.max(1, chartData.length);
    const maxDistance = Math.max(...chartData.map(d => d.distance), 0);
    const recentTrend = chartData.length >= 4 ?
      chartData.slice(-2).reduce((s, d) => s + d.distance, 0) / 2 - chartData.slice(0, 2).reduce((s, d) => s + d.distance, 0) / 2 : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
          <div className="flex items-center gap-3 mb-4">
            <Timer size={24} className="text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Long Run Analysis</h1>
          </div>
          <p className="text-gray-600">
            Building endurance through progressive long runs
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Long Runs</p>
              <p className="text-3xl font-bold text-gray-900">{longRuns.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Distance</p>
              <p className="text-3xl font-bold text-gray-900">{avgDistance.toFixed(1)}</p>
              <p className="text-xs text-gray-500">km</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Longest</p>
              <p className="text-3xl font-bold text-indigo-600">{maxDistance.toFixed(1)}</p>
              <p className="text-xs text-gray-500">km</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} km`, 'Distance']} />
                <Bar dataKey="distance" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {recentTrend !== 0 && (
            <div className={`mt-4 p-3 rounded-lg ${recentTrend > 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
              <p className={recentTrend > 0 ? 'text-green-700' : 'text-amber-700'}>
                {recentTrend > 0
                  ? `Your long runs are getting longer (+${recentTrend.toFixed(1)}km average)`
                  : `Long run distance has decreased recently (${recentTrend.toFixed(1)}km)`}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Long Run Guidelines</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">•</span>
              <span>Increase distance by max 10% per week</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">•</span>
              <span>Every 3-4 weeks, do a shorter "cutback" long run</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">•</span>
              <span>Practice race nutrition on long runs over 90min</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Create a long run progression plan based on my current fitness')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Long Run Plan
          </button>
        </div>
      </div>
    );
  }

  // Run type balance
  if (patternId === 'run-type-balance') {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run');

    const categoryCount: Record<string, number> = {};
    runWorkouts.forEach(r => {
      const cat = r.runCategory || 'unknown';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const total = runWorkouts.length;
    const categoryData = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const easyPercent = ((categoryCount.easy || 0) + (categoryCount.recovery || 0)) / Math.max(1, total) * 100;
    const hardPercent = ((categoryCount.tempo || 0) + (categoryCount.interval || 0) + (categoryCount.race || 0)) / Math.max(1, total) * 100;

    const colors: Record<string, string> = {
      Easy: '#22c55e',
      Recovery: '#86efac',
      Long: '#6366f1',
      Tempo: '#f59e0b',
      Interval: '#ef4444',
      Race: '#ec4899',
      Fartlek: '#8b5cf6',
      Hills: '#14b8a6',
      Unknown: '#9ca3af',
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={24} className="text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">Run Type Distribution</h1>
          </div>
          <p className="text-gray-600">
            Balance of easy vs hard running in your training
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`rounded-lg p-4 text-center ${easyPercent >= 70 ? 'bg-green-50' : easyPercent >= 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-500 mb-1">Easy/Recovery</p>
              <p className={`text-3xl font-bold ${easyPercent >= 70 ? 'text-green-600' : easyPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {easyPercent.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">Target: 80%</p>
            </div>
            <div className={`rounded-lg p-4 text-center ${hardPercent <= 20 ? 'bg-green-50' : hardPercent <= 40 ? 'bg-amber-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-500 mb-1">Hard Sessions</p>
              <p className={`text-3xl font-bold ${hardPercent <= 20 ? 'text-green-600' : hardPercent <= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {hardPercent.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">Target: 20%</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v: number) => [`${v} runs`, 'Count']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[entry.category] || '#9ca3af'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">The 80/20 Rule</h2>
          <p className="text-gray-600 mb-3">
            Research shows elite runners do ~80% of their training at easy effort and only ~20% hard.
          </p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>Easy runs build aerobic capacity without excessive fatigue</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>Hard sessions should be truly hard - don't go medium</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>Too much intensity leads to overtraining and injury</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How should I balance my run types for optimal training?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Training Balance Tips
          </button>
        </div>
      </div>
    );
  }

  // Weekly mileage trend
  if (patternId === 'weekly-mileage-trend') {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run' && w.distance);

    const weeklyData: { week: string; distance: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekRuns = runWorkouts.filter(w => {
        const d = new Date(w.date);
        return d >= weekStart && d <= weekEnd;
      });
      const totalKm = weekRuns.reduce((s, r) => s + (r.distance || 0), 0) / 1000;
      weeklyData.push({
        week: format(weekStart, 'MMM d'),
        distance: totalKm,
      });
    }

    const avgMileage = weeklyData.reduce((s, w) => s + w.distance, 0) / weeklyData.length;
    const currentWeek = weeklyData[weeklyData.length - 1]?.distance || 0;
    const lastWeek = weeklyData[weeklyData.length - 2]?.distance || 0;
    const weekChange = currentWeek - lastWeek;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Weekly Mileage Trend</h1>
          </div>
          <p className="text-gray-600">
            Tracking your running volume week over week
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">This Week</p>
              <p className="text-3xl font-bold text-gray-900">{currentWeek.toFixed(1)}</p>
              <p className="text-xs text-gray-500">km</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Weekly</p>
              <p className="text-3xl font-bold text-gray-900">{avgMileage.toFixed(1)}</p>
              <p className="text-xs text-gray-500">km</p>
            </div>
            <div className={`rounded-lg p-4 text-center ${weekChange > 0 ? 'bg-green-50' : weekChange < 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <p className="text-sm text-gray-500 mb-1">vs Last Week</p>
              <p className={`text-3xl font-bold ${weekChange > 0 ? 'text-green-600' : weekChange < 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {weekChange >= 0 ? '+' : ''}{weekChange.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">km</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} km`, 'Distance']} />
                <Area type="monotone" dataKey="distance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Volume Guidelines</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Increase weekly mileage by max 10% per week</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Every 3-4 weeks, reduce volume 20-30% for recovery</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Consistency matters more than peak weeks</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Create a mileage progression plan based on my current volume')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Volume Plan
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RECOVERY PATTERNS
  // ==========================================================================

  // HRV vs Run Performance
  if (patternId === 'hrv-run-performance') {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run' && w.avgPace);

    const hrvVsPace = runWorkouts.slice(0, 20).map(w => {
      const dateBefore = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
      const hrvBefore = recentSleep.find(s =>
        format(new Date(s.date), 'yyyy-MM-dd') === dateBefore && s.hrv
      )?.hrv;
      return {
        date: format(new Date(w.date), 'MMM d'),
        hrv: hrvBefore || null,
        pace: w.avgPace ? w.avgPace / 60 : null,
      };
    }).filter(d => d.hrv && d.pace);

    const highHRVRuns = hrvVsPace.filter(d => (d.hrv || 0) >= 50);
    const lowHRVRuns = hrvVsPace.filter(d => (d.hrv || 0) < 40);
    const avgPaceHighHRV = highHRVRuns.length > 0 ? highHRVRuns.reduce((s, d) => s + (d.pace || 0), 0) / highHRVRuns.length : 0;
    const avgPaceLowHRV = lowHRVRuns.length > 0 ? lowHRVRuns.reduce((s, d) => s + (d.pace || 0), 0) / lowHRVRuns.length : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-6 border border-rose-200">
          <div className="flex items-center gap-3 mb-4">
            <Heart size={24} className="text-rose-600" />
            <h1 className="text-2xl font-bold text-gray-900">HRV vs Running Performance</h1>
          </div>
          <p className="text-gray-600">
            How your heart rate variability affects your running
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by HRV Level</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">High HRV Days (50+)</p>
              <p className="text-2xl font-bold text-green-600">
                {avgPaceHighHRV > 0 ? `${Math.floor(avgPaceHighHRV)}:${String(Math.round((avgPaceHighHRV % 1) * 60)).padStart(2, '0')}` : '--'}
              </p>
              <p className="text-xs text-gray-500">/km avg ({highHRVRuns.length} runs)</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Low HRV Days ({'<'}40)</p>
              <p className="text-2xl font-bold text-red-600">
                {avgPaceLowHRV > 0 ? `${Math.floor(avgPaceLowHRV)}:${String(Math.round((avgPaceLowHRV % 1) * 60)).padStart(2, '0')}` : '--'}
              </p>
              <p className="text-xs text-gray-500">/km avg ({lowHRVRuns.length} runs)</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="hrv" name="HRV" unit="ms" domain={['auto', 'auto']} />
                <YAxis type="number" dataKey="pace" name="Pace" reversed domain={['auto', 'auto']} />
                <Tooltip formatter={(v: number, name: string) => name === 'Pace' ? [`${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')} /km`, 'Pace'] : [`${v} ms`, 'HRV']} />
                <Scatter data={hrvVsPace} fill="#e11d48" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Using HRV for Training</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">•</span>
              <span>High HRV = good recovery, ready for hard sessions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">•</span>
              <span>Low HRV = keep it easy or take a rest day</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">•</span>
              <span>Track your personal baseline - absolute numbers vary greatly</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How should I use HRV to guide my running training?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get HRV Training Tips
          </button>
        </div>
      </div>
    );
  }

  // HRV vs Lifting
  if (patternId === 'hrv-lifting') {
    const liftWorkouts = recentWorkouts.filter(w => w.type === 'strength' || (w.exercises && w.exercises.length > 0));

    const hrvVsVolume = liftWorkouts.slice(0, 20).map(w => {
      const dateBefore = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
      const hrvBefore = recentSleep.find(s =>
        format(new Date(s.date), 'yyyy-MM-dd') === dateBefore && s.hrv
      )?.hrv;
      const volume = w.exercises?.reduce((s, e) => s + (e.weight * e.reps), 0) || 0;
      return {
        date: format(new Date(w.date), 'MMM d'),
        hrv: hrvBefore || null,
        volume,
        sets: w.exercises?.length || 0,
      };
    }).filter(d => d.hrv);

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-xl p-6 border border-rose-200">
          <div className="flex items-center gap-3 mb-4">
            <Heart size={24} className="text-rose-600" />
            <h1 className="text-2xl font-bold text-gray-900">HRV vs Lifting Performance</h1>
          </div>
          <p className="text-gray-600">
            How recovery status affects your strength training
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">HRV Before Lifting Sessions</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hrvVsVolume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="hrv" orientation="left" domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="volume" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="volume" dataKey="volume" fill="#f97316" fillOpacity={0.5} name="Volume (kg)" />
                <Line yAxisId="hrv" type="monotone" dataKey="hrv" stroke="#e11d48" strokeWidth={2} name="HRV (ms)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recovery-Aware Lifting</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">•</span>
              <span>High HRV = push for PRs and heavy singles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">•</span>
              <span>Low HRV = reduce intensity by 10-15%, focus on technique</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5">•</span>
              <span>Very low HRV = mobility work or complete rest</span>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How should I adjust my lifting based on HRV?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Recovery-Based Lifting Tips
          </button>
        </div>
      </div>
    );
  }

  // Sleep vs Workout Duration
  if (patternId === 'sleep-workout-duration') {
    const workoutsWithSleep = recentWorkouts.slice(0, 30).map(w => {
      const dateBefore = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
      const sleepBefore = recentSleep.find(s =>
        format(new Date(s.date), 'yyyy-MM-dd') === dateBefore
      );
      return {
        date: format(new Date(w.date), 'MMM d'),
        sleep: sleepBefore ? sleepBefore.duration / 60 : null,
        duration: w.duration,
        type: w.type,
      };
    }).filter(d => d.sleep);

    const goodSleep = workoutsWithSleep.filter(d => (d.sleep || 0) >= 7);
    const poorSleep = workoutsWithSleep.filter(d => (d.sleep || 0) < 6);
    const avgDurationGood = goodSleep.length > 0 ? goodSleep.reduce((s, d) => s + d.duration, 0) / goodSleep.length : 0;
    const avgDurationPoor = poorSleep.length > 0 ? poorSleep.reduce((s, d) => s + d.duration, 0) / poorSleep.length : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <Moon size={24} className="text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Sleep vs Workout Duration</h1>
          </div>
          <p className="text-gray-600">
            How sleep affects your training capacity
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">After 7+ hrs Sleep</p>
              <p className="text-3xl font-bold text-green-600">{avgDurationGood.toFixed(0)}</p>
              <p className="text-xs text-gray-500">min avg workout ({goodSleep.length})</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">After {'<'}6 hrs Sleep</p>
              <p className="text-3xl font-bold text-red-600">{avgDurationPoor.toFixed(0)}</p>
              <p className="text-xs text-gray-500">min avg workout ({poorSleep.length})</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="sleep" name="Sleep" unit=" hrs" domain={[4, 10]} />
                <YAxis type="number" dataKey="duration" name="Duration" unit=" min" domain={['auto', 'auto']} />
                <Tooltip />
                <Scatter data={workoutsWithSleep} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How can I optimize sleep to train longer and harder?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Sleep Optimization Tips
          </button>
        </div>
      </div>
    );
  }

  // Volume progression
  if (patternId === 'volume-progression') {
    const liftWorkouts = recentWorkouts.filter(w => w.type === 'strength' || (w.exercises && w.exercises.length > 0));

    const weeklyVolume: { week: string; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekWorkouts = liftWorkouts.filter(w => {
        const d = new Date(w.date);
        return d >= weekStart && d <= weekEnd;
      });
      const totalVolume = weekWorkouts.reduce((s, w) =>
        s + (w.exercises?.reduce((es, e) => es + (e.weight * e.reps), 0) || 0), 0);
      weeklyVolume.push({
        week: format(weekStart, 'MMM d'),
        volume: totalVolume,
      });
    }

    const avgVolume = weeklyVolume.reduce((s, w) => s + w.volume, 0) / weeklyVolume.length;
    const currentVolume = weeklyVolume[weeklyVolume.length - 1]?.volume || 0;
    const volumeChange = weeklyVolume.length >= 2 ? currentVolume - weeklyVolume[weeklyVolume.length - 2].volume : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp size={24} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Lifting Volume Progression</h1>
          </div>
          <p className="text-gray-600">
            Tracking your total training volume over time
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{(currentVolume / 1000).toFixed(1)}t</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Weekly</p>
              <p className="text-2xl font-bold text-gray-900">{(avgVolume / 1000).toFixed(1)}t</p>
            </div>
            <div className={`rounded-lg p-4 text-center ${volumeChange > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
              <p className="text-sm text-gray-500 mb-1">vs Last Week</p>
              <p className={`text-2xl font-bold ${volumeChange > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {volumeChange >= 0 ? '+' : ''}{(volumeChange / 1000).toFixed(1)}t
              </p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}t`} />
                <Tooltip formatter={(v: number) => [`${(v / 1000).toFixed(1)} tonnes`, 'Volume']} />
                <Area type="monotone" dataKey="volume" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How should I progress my lifting volume for muscle growth?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Volume Progression Plan
          </button>
        </div>
      </div>
    );
  }

  // Recovery spacing
  if (patternId === 'recovery-spacing') {
    const workouts = [...recentWorkouts]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const restDays: { after: string; days: number }[] = [];
    for (let i = 1; i < Math.min(30, workouts.length); i++) {
      const curr = new Date(workouts[i].date);
      const prev = new Date(workouts[i - 1].date);
      const daysBetween = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)) - 1;
      if (daysBetween >= 0) {
        restDays.push({
          after: format(prev, 'MMM d'),
          days: daysBetween,
        });
      }
    }

    const avgRestDays = restDays.length > 0 ? restDays.reduce((s, r) => s + r.days, 0) / restDays.length : 0;
    const backToBack = restDays.filter(r => r.days === 0).length;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-200">
          <div className="flex items-center gap-3 mb-4">
            <Zap size={24} className="text-cyan-600" />
            <h1 className="text-2xl font-bold text-gray-900">Recovery Spacing</h1>
          </div>
          <p className="text-gray-600">
            Analyzing rest between your training sessions
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Rest Days</p>
              <p className="text-3xl font-bold text-gray-900">{avgRestDays.toFixed(1)}</p>
              <p className="text-xs text-gray-500">between sessions</p>
            </div>
            <div className={`rounded-lg p-4 text-center ${backToBack > 10 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className="text-sm text-gray-500 mb-1">Back-to-Back</p>
              <p className={`text-3xl font-bold ${backToBack > 10 ? 'text-amber-600' : 'text-green-600'}`}>{backToBack}</p>
              <p className="text-xs text-gray-500">consecutive days</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={restDays.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="after" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                <Tooltip formatter={(v: number) => [`${v} rest days`, 'Recovery']} />
                <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                  {restDays.slice(-20).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.days >= 2 ? '#22c55e' : entry.days >= 1 ? '#eab308' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Am I getting enough recovery between workouts?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Recovery Advice
          </button>
        </div>
      </div>
    );
  }

  // Recovery vs Lifting Volume
  if (patternId === 'recovery-lifting-volume') {
    const liftWorkouts = recentWorkouts.filter(w => w.type === 'strength' || (w.exercises && w.exercises.length > 0));

    const recoveryVsVolume = liftWorkouts.slice(0, 20).map(w => {
      const dateBefore = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
      const sleepBefore = recentSleep.find(s => format(new Date(s.date), 'yyyy-MM-dd') === dateBefore);
      const volume = w.exercises?.reduce((s, e) => s + (e.weight * e.reps), 0) || 0;
      return {
        date: format(new Date(w.date), 'MMM d'),
        sleep: sleepBefore ? sleepBefore.duration / 60 : null,
        hrv: sleepBefore?.hrv || null,
        volume: volume / 1000,
      };
    }).filter(d => d.sleep || d.hrv);

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-6 border border-violet-200">
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell size={24} className="text-violet-600" />
            <h1 className="text-2xl font-bold text-gray-900">Recovery vs Lifting Volume</h1>
          </div>
          <p className="text-gray-600">
            How recovery metrics correlate with your training output
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={recoveryVsVolume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="sleep" orientation="left" domain={[0, 10]} />
                <YAxis yAxisId="volume" orientation="right" />
                <Tooltip />
                <Bar yAxisId="volume" dataKey="volume" fill="#8b5cf6" fillOpacity={0.5} name="Volume (tonnes)" />
                <Line yAxisId="sleep" type="monotone" dataKey="sleep" stroke="#22c55e" strokeWidth={2} name="Sleep (hrs)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('How should I adjust my lifting volume based on recovery?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Volume Adjustment Tips
          </button>
        </div>
      </div>
    );
  }

  // PR Conditions
  if (patternId === 'pr-conditions') {
    // Analyze what conditions led to PRs
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center gap-3 mb-4">
            <Trophy size={24} className="text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">PR Conditions Analysis</h1>
          </div>
          <p className="text-gray-600">
            Understanding what conditions help you set personal records
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Optimal PR Conditions</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Moon size={16} className="text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Sleep 7+ hours</p>
                <p className="text-sm">Adequate sleep is essential for peak performance</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Heart size={16} className="text-rose-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">HRV above baseline</p>
                <p className="text-sm">High HRV indicates good recovery and readiness</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">ACWR 0.8-1.2</p>
                <p className="text-sm">Optimal training load for peak performance</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Zap size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Rest day before</p>
                <p className="text-sm">Fresh legs/muscles for maximum effort</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('What conditions should I create for my next PR attempt?')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Plan My Next PR
          </button>
        </div>
      </div>
    );
  }

  // Fitness progression
  if (patternId === 'fitness-progression') {
    const runWorkouts = recentWorkouts
      .filter(w => w.type === 'run' && w.distance && w.duration)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const fitnessData = runWorkouts.slice(-30).map(r => ({
      date: format(new Date(r.date), 'MMM d'),
      avgPace: r.avgPace ? r.avgPace / 60 : 0,
      distance: (r.distance || 0) / 1000,
    }));

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp size={24} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Fitness Progression</h1>
          </div>
          <p className="text-gray-600">
            Tracking your overall fitness improvements
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Running Performance Over Time</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fitnessData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis reversed domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')} /km`, 'Pace']} />
                <Line type="monotone" dataKey="avgPace" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <button
            onClick={() => onAskAI('Analyze my fitness progression and suggest next steps')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Fitness Analysis
          </button>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="text-center py-12">
      <Lightbulb size={48} className="mx-auto text-gray-300 mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Pattern Analysis</h2>
      <p className="text-gray-500">Detailed analysis for this pattern is not yet available.</p>
      <p className="text-sm text-gray-400 mt-2">Pattern ID: {patternId}</p>
    </div>
  );
}
