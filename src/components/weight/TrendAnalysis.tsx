import { useMemo } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { exponentialSmoothing, detectPlateau, daysToGoal, calculateTrendRate } from '@/algorithms/exponentialSmoothing';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckCircle } from 'lucide-react';

export function TrendAnalysis() {
  const { recentWeight } = useHealthStore();
  const { settings, profile } = useSettingsStore();

  const analysis = useMemo(() => {
    if (recentWeight.length < 7) {
      return null;
    }

    const sorted = [...recentWeight].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const weights = sorted.map((w) => w.weight);
    const smoothed = exponentialSmoothing(weights, 0.1);

    // Calculate weekly change rate
    const weekAgoIndex = Math.max(0, weights.length - 7);
    const weeklyChange = smoothed[smoothed.length - 1] - smoothed[weekAgoIndex];
    const dailyChange = weeklyChange / 7;

    // Detect plateau
    const isOnPlateau = detectPlateau(weights, 14, 0.3);

    // Calculate trend rate
    const trendInfo = calculateTrendRate(smoothed, 14);

    // Days to goal
    let daysToReachGoal: number | null = null;
    if (profile.weightGoal) {
      daysToReachGoal = daysToGoal(smoothed[smoothed.length - 1], profile.weightGoal, dailyChange);
    }

    // Calculate consistency (variance in daily weights)
    const recentWeights = weights.slice(-14);
    const mean = recentWeights.reduce((a, b) => a + b, 0) / recentWeights.length;
    const variance = recentWeights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / recentWeights.length;
    const consistency = Math.max(0, 100 - variance * 10); // Lower variance = higher consistency

    return {
      currentSmoothed: smoothed[smoothed.length - 1],
      weeklyChange,
      dailyChange,
      isOnPlateau,
      trendDirection: trendInfo.direction,
      trendRate: trendInfo.rate,
      daysToGoal: daysToReachGoal,
      consistency,
    };
  }, [recentWeight, profile.weightGoal]);

  const convertWeight = (kg: number) => {
    if (settings.units.weight === 'lbs') {
      return kg * 2.20462;
    }
    return kg;
  };

  if (!analysis) {
    return (
      <div className="text-center py-6 text-gray-500">
        <p>Need at least 7 days of data for trend analysis</p>
      </div>
    );
  }

  const getTrendIcon = () => {
    switch (analysis.trendDirection) {
      case 'up':
        return <TrendingUp className="text-warning-500" size={24} />;
      case 'down':
        return <TrendingDown className="text-success-500" size={24} />;
      default:
        return <Minus className="text-gray-400" size={24} />;
    }
  };

  const getTrendDescription = () => {
    const weeklyKg = Math.abs(analysis.weeklyChange);
    const weeklyDisplay = convertWeight(weeklyKg).toFixed(1);

    if (analysis.isOnPlateau) {
      return 'Weight has plateaued over the past 2 weeks';
    }

    if (analysis.trendDirection === 'down') {
      return `Losing ~${weeklyDisplay} ${settings.units.weight}/week`;
    }

    if (analysis.trendDirection === 'up') {
      return `Gaining ~${weeklyDisplay} ${settings.units.weight}/week`;
    }

    return 'Weight is stable';
  };

  return (
    <div className="space-y-4">
      {/* Main Trend */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        {getTrendIcon()}
        <div>
          <p className="font-medium text-gray-900">
            {analysis.trendDirection === 'up' ? 'Trending Up' : analysis.trendDirection === 'down' ? 'Trending Down' : 'Stable'}
          </p>
          <p className="text-sm text-gray-600">{getTrendDescription()}</p>
        </div>
      </div>

      {/* Plateau Warning */}
      {analysis.isOnPlateau && (
        <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning-200 rounded-lg">
          <AlertTriangle className="text-warning-500 flex-shrink-0" size={20} />
          <div>
            <p className="font-medium text-warning-800">Plateau Detected</p>
            <p className="text-sm text-warning-700 mt-1">
              Your weight has been stable for 2+ weeks. This is normal! Consider:
            </p>
            <ul className="text-sm text-warning-700 mt-2 list-disc list-inside">
              <li>Adjusting calorie intake</li>
              <li>Varying workout intensity</li>
              <li>Checking sleep and stress levels</li>
            </ul>
          </div>
        </div>
      )}

      {/* Goal Progress */}
      {profile.weightGoal && analysis.daysToGoal !== null && (
        <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <Target className="text-primary-500 flex-shrink-0" size={20} />
          <div>
            <p className="font-medium text-primary-800">Goal Progress</p>
            <p className="text-sm text-primary-700 mt-1">
              At your current rate, you'll reach your goal of {convertWeight(profile.weightGoal).toFixed(1)} {settings.units.weight} in approximately{' '}
              <span className="font-medium">
                {analysis.daysToGoal < 7
                  ? `${Math.round(analysis.daysToGoal)} days`
                  : `${Math.round(analysis.daysToGoal / 7)} weeks`}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Consistency Score */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
        <CheckCircle
          className={analysis.consistency > 70 ? 'text-success-500' : analysis.consistency > 40 ? 'text-warning-500' : 'text-gray-400'}
          size={20}
        />
        <div>
          <p className="font-medium text-gray-900">Tracking Consistency</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  analysis.consistency > 70 ? 'bg-success-500' : analysis.consistency > 40 ? 'bg-warning-500' : 'bg-gray-400'
                }`}
                style={{ width: `${analysis.consistency}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">{analysis.consistency.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {analysis.consistency > 70
              ? 'Great consistency! Keep it up.'
              : analysis.consistency > 40
              ? 'Try to weigh at the same time daily.'
              : 'More consistent tracking will improve accuracy.'}
          </p>
        </div>
      </div>
    </div>
  );
}
