import { useMemo } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { getRecoveryRecommendation } from '@/algorithms/acwr';
import { suggestTodaysIntensity, type TrainingIntensity } from '@/algorithms/trainingLoad';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, Zap, Moon, Heart, Activity } from 'lucide-react';

export function RecoveryStatus() {
  const { trainingLoad, recentSleep, recentHRV } = useHealthStore();

  const recoveryData = useMemo(() => {
    const latestSleep = recentSleep[0];
    const latestHRV = recentHRV[0];

    // Calculate HRV baseline (average of last 7 days)
    const hrvBaseline = recentHRV.length >= 7
      ? recentHRV.slice(0, 7).reduce((sum, h) => sum + h.value, 0) / 7
      : null;

    const hrvPercent = hrvBaseline && latestHRV
      ? (latestHRV.value / hrvBaseline) * 100
      : undefined;

    // Get HRV trend
    let hrvTrend: 'up' | 'down' | 'stable' = 'stable';
    if (recentHRV.length >= 3) {
      const recent = recentHRV.slice(0, 3).reduce((sum, h) => sum + h.value, 0) / 3;
      const older = recentHRV.slice(3, 7).reduce((sum, h) => sum + h.value, 0) / Math.min(4, recentHRV.length - 3);
      if (recent > older * 1.05) hrvTrend = 'up';
      else if (recent < older * 0.95) hrvTrend = 'down';
    }

    // Calculate form if we have training load
    const form = trainingLoad
      ? trainingLoad.fitnessLevel - trainingLoad.fatigueLevel
      : 0;

    // Get intensity suggestion
    const intensitySuggestion = suggestTodaysIntensity(
      form,
      trainingLoad?.acwr || 1,
      hrvPercent,
      latestSleep?.score
    );

    // Get recovery recommendation
    const recommendation = trainingLoad
      ? getRecoveryRecommendation(
          trainingLoad.acwr,
          trainingLoad.riskZone,
          hrvTrend,
          latestSleep?.score
        )
      : 'Add workout data to get recovery recommendations.';

    // Calculate overall readiness score
    let readinessScore = 50;
    if (latestSleep?.score) readinessScore += (latestSleep.score - 70) * 0.3;
    if (hrvPercent) readinessScore += (hrvPercent - 100) * 0.2;
    if (trainingLoad) {
      if (trainingLoad.riskZone === 'optimal') readinessScore += 10;
      else if (trainingLoad.riskZone === 'danger') readinessScore -= 20;
      else if (trainingLoad.riskZone === 'overreaching') readinessScore -= 10;
    }
    readinessScore = Math.max(0, Math.min(100, readinessScore));

    return {
      latestSleep,
      latestHRV,
      hrvBaseline,
      hrvPercent,
      hrvTrend,
      form,
      intensitySuggestion,
      recommendation,
      readinessScore,
    };
  }, [trainingLoad, recentSleep, recentHRV]);

  const getIntensityColor = (intensity: TrainingIntensity): string => {
    switch (intensity) {
      case 'rest':
        return 'text-gray-500 bg-gray-100';
      case 'recovery':
        return 'text-blue-500 bg-blue-100';
      case 'easy':
        return 'text-green-500 bg-green-100';
      case 'moderate':
        return 'text-yellow-500 bg-yellow-100';
      case 'hard':
        return 'text-orange-500 bg-orange-100';
      case 'very_hard':
        return 'text-red-500 bg-red-100';
    }
  };

  const getBatteryIcon = (score: number) => {
    if (score >= 75) return <BatteryFull className="text-success-500" size={32} />;
    if (score >= 50) return <BatteryMedium className="text-warning-500" size={32} />;
    if (score >= 25) return <BatteryLow className="text-orange-500" size={32} />;
    return <Battery className="text-danger-500" size={32} />;
  };

  return (
    <div className="space-y-6">
      {/* Readiness Score */}
      <div className="flex items-center gap-6">
        {getBatteryIcon(recoveryData.readinessScore)}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Recovery Readiness</span>
            <span className="text-lg font-bold text-gray-900">
              {recoveryData.readinessScore.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                recoveryData.readinessScore >= 70
                  ? 'bg-success-500'
                  : recoveryData.readinessScore >= 40
                  ? 'bg-warning-500'
                  : 'bg-danger-500'
              }`}
              style={{ width: `${recoveryData.readinessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Today's Suggestion */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="text-primary-500" size={20} />
          <span className="font-medium text-gray-900">Today's Training</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getIntensityColor(
              recoveryData.intensitySuggestion.intensity
            )}`}
          >
            {recoveryData.intensitySuggestion.intensity.replace('_', ' ')}
          </span>
        </div>
        <p className="text-sm text-gray-600">{recoveryData.intensitySuggestion.reason}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <Moon className="mx-auto text-purple-500 mb-1" size={20} />
          <p className="text-lg font-bold text-gray-900">
            {recoveryData.latestSleep
              ? `${Math.floor(recoveryData.latestSleep.duration / 60)}h ${Math.round(
                  recoveryData.latestSleep.duration % 60
                )}m`
              : '--'}
          </p>
          <p className="text-xs text-gray-500">Last Night</p>
          {recoveryData.latestSleep?.score && (
            <p className="text-xs text-purple-600 mt-1">
              Score: {recoveryData.latestSleep.score}
            </p>
          )}
        </div>

        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <Heart className="mx-auto text-danger-500 mb-1" size={20} />
          <p className="text-lg font-bold text-gray-900">
            {recoveryData.latestHRV ? `${Math.round(recoveryData.latestHRV.value)}` : '--'}
          </p>
          <p className="text-xs text-gray-500">HRV (ms)</p>
          {recoveryData.hrvPercent && (
            <p
              className={`text-xs mt-1 ${
                recoveryData.hrvPercent >= 100 ? 'text-success-600' : 'text-warning-600'
              }`}
            >
              {recoveryData.hrvPercent >= 100 ? '+' : ''}
              {(recoveryData.hrvPercent - 100).toFixed(0)}% vs avg
            </p>
          )}
        </div>

        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <Activity className="mx-auto text-primary-500 mb-1" size={20} />
          <p className="text-lg font-bold text-gray-900">
            {trainingLoad ? trainingLoad.formLevel.toFixed(0) : '--'}
          </p>
          <p className="text-xs text-gray-500">Form</p>
          <p className="text-xs text-gray-400 mt-1">
            {recoveryData.form > 10
              ? 'Fresh'
              : recoveryData.form > 0
              ? 'Good'
              : recoveryData.form > -10
              ? 'Tired'
              : 'Fatigued'}
          </p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-700">{recoveryData.recommendation}</p>
      </div>
    </div>
  );
}
