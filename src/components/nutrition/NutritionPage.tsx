import { useMemo } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { FuelingTimeline } from './FuelingTimeline';
import { MacroTargets } from './MacroTargets';
import { Apple, Beef, Wheat, Droplets, Zap } from 'lucide-react';
import { isToday, isTomorrow } from 'date-fns';

export function NutritionPage() {
  const { recentWorkouts, trainingLoad, weightTrend } = useHealthStore();
  useSettingsStore();

  const nutritionData = useMemo(() => {
    // Get today's and tomorrow's workouts
    const upcomingWorkouts = recentWorkouts.filter((w) => {
      const d = new Date(w.date);
      return isToday(d) || isTomorrow(d);
    });

    // Calculate base requirements
    const bodyweightKg = weightTrend?.current || 75;

    // Protein: 1.6-2.2g/kg depending on training load
    const proteinMultiplier = trainingLoad && trainingLoad.acwr > 1.2 ? 2.0 : 1.8;
    const proteinTarget = bodyweightKg * proteinMultiplier;

    // Carbs: vary based on training day
    const isHighTrainingDay = upcomingWorkouts.some((w) => w.duration > 60);
    const carbsPerKg = isHighTrainingDay ? 5 : 3;
    const carbsTarget = bodyweightKg * carbsPerKg;

    // Fat: ~1g/kg baseline
    const fatTarget = bodyweightKg * 1;

    // Calories
    const caloriesTarget = proteinTarget * 4 + carbsTarget * 4 + fatTarget * 9;

    // Today's training load
    const todayWorkouts = recentWorkouts.filter((w) => isToday(new Date(w.date)));
    const todayDuration = todayWorkouts.reduce((sum, w) => sum + w.duration, 0);

    return {
      bodyweightKg,
      proteinTarget,
      carbsTarget,
      fatTarget,
      caloriesTarget,
      isHighTrainingDay,
      upcomingWorkouts,
      todayDuration,
    };
  }, [recentWorkouts, trainingLoad, weightTrend]);

  const formatMacro = (grams: number) => `${Math.round(grams)}g`;

  return (
    <div className="space-y-6">
      {/* Daily Targets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-warning-500" size={20} />
            <span className="text-sm text-gray-500">Calories</span>
          </div>
          <p className="metric-value">{Math.round(nutritionData.caloriesTarget)}</p>
          <p className="text-xs text-gray-400 mt-1">kcal target</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Beef className="text-danger-500" size={20} />
            <span className="text-sm text-gray-500">Protein</span>
          </div>
          <p className="metric-value">{formatMacro(nutritionData.proteinTarget)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {(nutritionData.proteinTarget / nutritionData.bodyweightKg).toFixed(1)}g/kg
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Wheat className="text-warning-500" size={20} />
            <span className="text-sm text-gray-500">Carbs</span>
          </div>
          <p className="metric-value">{formatMacro(nutritionData.carbsTarget)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {nutritionData.isHighTrainingDay ? 'High training day' : 'Rest/light day'}
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="text-yellow-500" size={20} />
            <span className="text-sm text-gray-500">Fat</span>
          </div>
          <p className="metric-value">{formatMacro(nutritionData.fatTarget)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {(nutritionData.fatTarget / nutritionData.bodyweightKg).toFixed(1)}g/kg
          </p>
        </div>
      </div>

      {/* Training Day Status */}
      <div className={`card p-4 border-l-4 ${nutritionData.isHighTrainingDay ? 'border-l-warning-500 bg-warning-50' : 'border-l-primary-500 bg-primary-50'}`}>
        <div className="flex items-center gap-3">
          {nutritionData.isHighTrainingDay ? (
            <>
              <Zap className="text-warning-600" size={24} />
              <div>
                <p className="font-medium text-warning-800">High Training Day</p>
                <p className="text-sm text-warning-700">
                  Prioritize carbohydrates for energy and recovery. Aim for carb-rich meals around workouts.
                </p>
              </div>
            </>
          ) : (
            <>
              <Apple className="text-primary-600" size={24} />
              <div>
                <p className="font-medium text-primary-800">Rest / Light Day</p>
                <p className="text-sm text-primary-700">
                  Focus on protein and vegetables. Moderate carbs to support recovery without excess.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fueling Timeline */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Fueling Timeline</h3>
          <p className="text-sm text-gray-500">Nutrition timing for optimal performance</p>
        </div>
        <div className="card-body">
          <FuelingTimeline
            workouts={nutritionData.upcomingWorkouts}
            bodyweightKg={nutritionData.bodyweightKg}
          />
        </div>
      </div>

      {/* Macro Guide */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Macro Guidelines</h3>
        </div>
        <div className="card-body">
          <MacroTargets />
        </div>
      </div>

      {/* Quick Tips */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Quick Fueling Tips</h3>
        </div>
        <div className="card-body">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Pre-Workout (2-3h before)</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 30-60g carbs from easy-to-digest sources</li>
                <li>• 15-20g protein</li>
                <li>• Low fat and fiber to avoid GI distress</li>
                <li>• Examples: oatmeal + banana, toast + eggs</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">During Long Workouts (&gt;90min)</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 30-60g carbs per hour</li>
                <li>• 500-1000ml fluid per hour</li>
                <li>• Electrolytes for sessions &gt;60min</li>
                <li>• Examples: gels, sports drink, banana</li>
              </ul>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 mb-2">Post-Workout (within 30min)</h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• 20-40g protein for muscle repair</li>
                <li>• 0.5-1g carbs per kg bodyweight</li>
                <li>• Rehydrate: 1.5L per kg lost</li>
                <li>• Examples: protein shake + fruit, chicken + rice</li>
              </ul>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Daily Protein Timing</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Spread intake across 4-5 meals</li>
                <li>• 20-40g protein per meal</li>
                <li>• Include protein at every meal</li>
                <li>• Don't skip post-workout protein</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
