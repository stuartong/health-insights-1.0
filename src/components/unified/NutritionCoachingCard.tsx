import { useState, useMemo } from 'react';
import { Utensils, Flame, Beef, Wheat, Droplets, ChevronDown, ChevronUp, MessageCircle, Info } from 'lucide-react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format, subDays } from 'date-fns';
import type { Workout } from '@/types';

interface Props {
  onAskAI: (context: string) => void;
}

// =============================================================================
// DATA SOURCE PRIORITY
// =============================================================================
// When multiple data sources track the same activity, we prioritize:
// 1. Strava - Most accurate for outdoor activities (GPS, power meters)
// 2. Oura/Whoop - Best for recovery metrics (HRV, sleep, readiness)
// 3. Apple Health - Fallback, may have duplicates from watch + phone
// 4. Manual - User-entered data, always respected
// =============================================================================

/**
 * Determines the priority of a data source for workout deduplication.
 * Higher number = higher priority (will be kept over lower priority sources).
 */
function getSourcePriority(source: string): number {
  switch (source) {
    case 'strava': return 4;      // Best for workout tracking (GPS, sensors)
    case 'manual': return 3;      // User explicitly entered, respect it
    case 'oura': return 2;        // Good for recovery, limited workout data
    case 'apple_health': return 1; // Often duplicates Strava/other sources
    default: return 0;
  }
}

/**
 * Deduplicates workouts that may be recorded by multiple sources.
 *
 * Example: A morning run might be recorded by:
 * - Apple Watch → Apple Health
 * - Strava app → Strava
 * - Both sync to this app, creating duplicate entries
 *
 * We identify duplicates by matching:
 * - Same date (day)
 * - Same workout type
 * - Similar duration (within 10% or 5 minutes)
 *
 * When duplicates are found, we keep the highest priority source.
 */
function deduplicateWorkouts(workouts: Workout[]): Workout[] {
  // Group workouts by date and type
  const groupedByDateType = new Map<string, Workout[]>();

  for (const workout of workouts) {
    const dateStr = format(new Date(workout.date), 'yyyy-MM-dd');
    const key = `${dateStr}|${workout.type}`;

    if (!groupedByDateType.has(key)) {
      groupedByDateType.set(key, []);
    }
    groupedByDateType.get(key)!.push(workout);
  }

  const deduplicated: Workout[] = [];

  for (const [, group] of groupedByDateType) {
    if (group.length === 1) {
      // No potential duplicates, keep it
      deduplicated.push(group[0]);
      continue;
    }

    // Multiple workouts of same type on same day - check for duplicates
    const processed = new Set<string>();

    for (const workout of group) {
      if (processed.has(workout.id)) continue;

      // Find potential duplicates (similar duration)
      const duplicates = group.filter(w => {
        if (w.id === workout.id || processed.has(w.id)) return false;

        // Duration similarity check: within 10% or 5 minutes
        const durationDiff = Math.abs(w.duration - workout.duration);
        const durationPercent = durationDiff / Math.max(w.duration, workout.duration);
        const isSimilarDuration = durationPercent < 0.1 || durationDiff < 5;

        // Distance similarity check (if both have distance): within 10% or 500m
        if (w.distance && workout.distance) {
          const distanceDiff = Math.abs(w.distance - workout.distance);
          const distancePercent = distanceDiff / Math.max(w.distance, workout.distance);
          const isSimilarDistance = distancePercent < 0.1 || distanceDiff < 500;
          return isSimilarDuration && isSimilarDistance;
        }

        return isSimilarDuration;
      });

      if (duplicates.length === 0) {
        // No duplicates found, this is a unique workout
        deduplicated.push(workout);
        processed.add(workout.id);
      } else {
        // Found duplicates - keep the highest priority source
        const allVersions = [workout, ...duplicates];
        allVersions.sort((a, b) => getSourcePriority(b.source) - getSourcePriority(a.source));

        deduplicated.push(allVersions[0]); // Keep highest priority
        allVersions.forEach(w => processed.add(w.id)); // Mark all as processed
      }
    }
  }

  return deduplicated;
}

// =============================================================================
// NUTRITION CALCULATION CONSTANTS
// =============================================================================

/**
 * Activity multipliers for TDEE calculation (Harris-Benedict scale).
 * These multiply BMR to estimate total daily energy expenditure.
 *
 * Research basis: Harris-Benedict equation refinements
 * - Sedentary: Little to no exercise, desk job
 * - Lightly Active: Light exercise 1-3 days/week
 * - Moderately Active: Moderate exercise 3-5 days/week
 * - Very Active: Hard exercise 6-7 days/week
 * - Extra Active: Very hard exercise, physical job, training 2x/day
 */
const ACTIVITY_MULTIPLIERS = {
  sedentary: { multiplier: 1.2, minMinutes: 0, minSessions: 0 },
  lightlyActive: { multiplier: 1.375, minMinutes: 90, minSessions: 2 },
  moderatelyActive: { multiplier: 1.55, minMinutes: 180, minSessions: 4 },
  veryActive: { multiplier: 1.725, minMinutes: 300, minSessions: 5 },
  extraActive: { multiplier: 1.9, minMinutes: 420, minSessions: 6 },
} as const;

/**
 * Protein recommendations based on training type (grams per kg bodyweight).
 *
 * Research basis:
 * - ISSN Position Stand on Protein (2017)
 * - Morton et al. (2018) Meta-analysis on protein for muscle
 *
 * Ranges:
 * - Sedentary/Light: 0.8-1.2 g/kg (RDA minimum is 0.8)
 * - General Fitness: 1.4-1.6 g/kg
 * - Endurance Athletes: 1.6-1.8 g/kg (higher for recovery, less for hypertrophy)
 * - Strength Athletes: 1.8-2.2 g/kg (muscle protein synthesis optimization)
 * - Hybrid Athletes: 1.8-2.0 g/kg (balance both needs)
 * - Weight Loss: +0.2-0.3 g/kg (preserve muscle in deficit)
 * - Age 50+: +0.2 g/kg (reduced anabolic sensitivity)
 */
const PROTEIN_RECOMMENDATIONS: Record<string, { perKg: number; rationale: string }> = {
  sedentary: { perKg: 1.2, rationale: 'general health' },
  lightActivity: { perKg: 1.4, rationale: 'light activity' },
  generalFitness: { perKg: 1.6, rationale: 'general fitness' },
  endurance: { perKg: 1.8, rationale: 'endurance training' },
  hybrid: { perKg: 2.0, rationale: 'hybrid training (running + lifting)' },
  strength: { perKg: 2.2, rationale: 'strength-focused training' },
};

/**
 * Macronutrient calorie values.
 * - Protein: 4 calories per gram
 * - Carbohydrates: 4 calories per gram
 * - Fat: 9 calories per gram
 * - Alcohol: 7 calories per gram (not tracked here)
 */
const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Target fat percentage of total calories.
 *
 * Research basis: Acceptable Macronutrient Distribution Range (AMDR)
 * - Fat should be 20-35% of total calories
 * - We use 25% as a balanced default
 * - Athletes may go slightly lower (20-25%) to prioritize carbs
 * - Higher fat (30%+) can work for low-carb approaches
 */
const FAT_PERCENTAGE = 0.25;

/**
 * Hydration recommendations.
 *
 * Base: 30-35ml per kg bodyweight (we use 33ml)
 * Exercise: Additional 500ml per hour of activity
 *
 * Example: 75kg person training 1hr = 2.5L base + 0.5L exercise = 3L
 */
const HYDRATION = {
  mlPerKg: 33,
  mlPerHourExercise: 500,
} as const;

/**
 * Fiber recommendations (grams per day).
 * Based on Academy of Nutrition and Dietetics guidelines.
 * - Men: 38g/day
 * - Women: 25g/day
 */
const FIBER = {
  male: 38,
  female: 25,
} as const;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NutritionCoachingCard({ onAskAI }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { recentWorkouts, recentWeight, trainingLoad, recentSleep } = useHealthStore();
  const { profile } = useSettingsStore();

  // ---------------------------------------------------------------------------
  // DATA SOURCE DETECTION
  // ---------------------------------------------------------------------------
  // Check if we have data from dedicated sleep trackers (Oura, Whoop).
  // These provide more accurate recovery/readiness data than Apple Watch.
  // This affects how we interpret training readiness and calorie adjustments.
  // ---------------------------------------------------------------------------

  const sleepTrackerSource = useMemo(() => {
    // Check for dedicated sleep trackers (Oura now, Whoop in future)
    // We cast source to string for future-proofing when Whoop is added
    const hasOuraData = recentSleep.some(s => s.source === 'oura');
    const hasWhoopData = recentSleep.some(s => (s.source as string) === 'whoop');

    if (hasOuraData) return 'oura';
    if (hasWhoopData) return 'whoop';
    return 'apple_health'; // Fallback
  }, [recentSleep]);

  const dataSourceLabel = useMemo(() => {
    switch (sleepTrackerSource) {
      case 'oura': return 'Oura';
      case 'whoop': return 'WHOOP';
      default: return 'Apple Watch';
    }
  }, [sleepTrackerSource]);

  // ---------------------------------------------------------------------------
  // WORKOUT DEDUPLICATION
  // ---------------------------------------------------------------------------
  // Get unique workouts from the last 7 days, removing duplicates that may
  // exist from multiple data sources tracking the same activity.
  // ---------------------------------------------------------------------------

  const last7DaysWorkouts = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);

    // Filter to last 7 days
    const recentOnly = recentWorkouts.filter(w => {
      const workoutDate = new Date(w.date);
      return workoutDate >= sevenDaysAgo;
    });

    // Remove duplicates (e.g., same run tracked by both Strava and Apple Watch)
    return deduplicateWorkouts(recentOnly);
  }, [recentWorkouts]);

  // ---------------------------------------------------------------------------
  // USER PROFILE DATA
  // ---------------------------------------------------------------------------
  // Extract user metrics, falling back to reasonable defaults.
  // These are used for BMR and macro calculations.
  // ---------------------------------------------------------------------------

  // Weight: Use most recent measurement, or profile goal, or default 75kg
  const currentWeight = recentWeight[0]?.weight || profile?.weightGoal || 75;

  // Age: Calculate from birth year, default to 30 if not set
  const currentYear = new Date().getFullYear();
  const age = profile?.birthYear ? currentYear - profile.birthYear : 30;

  // Gender: Used for BMR formula differences. Default to male if not specified.
  const isMale = profile?.gender !== 'female';

  // Height: Used for BMR calculation. Default to 175cm if not set.
  const height = profile?.height || 175;

  // ---------------------------------------------------------------------------
  // BMR CALCULATION (Basal Metabolic Rate)
  // ---------------------------------------------------------------------------
  // Using Mifflin-St Jeor equation (1990) - most accurate for modern populations.
  //
  // Formula:
  // - Men:   BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5
  // - Women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161
  //
  // This represents calories burned at complete rest (just to stay alive).
  // Alternatives considered:
  // - Harris-Benedict (1919): Older, tends to overestimate
  // - Katch-McArdle: Requires body fat %, which we may not have
  // ---------------------------------------------------------------------------

  const bmr = useMemo(() => {
    const base = 10 * currentWeight + 6.25 * height - 5 * age;
    return isMale ? base + 5 : base - 161;
  }, [currentWeight, height, age, isMale]);

  // ---------------------------------------------------------------------------
  // TRAINING ANALYSIS
  // ---------------------------------------------------------------------------
  // Analyze recent training to determine:
  // 1. Activity level (for TDEE multiplier)
  // 2. Training type balance (strength vs cardio vs hybrid)
  // This informs both calorie and protein recommendations.
  // ---------------------------------------------------------------------------

  const trainingAnalysis = useMemo(() => {
    // Calculate total training time and sessions
    const weeklyTrainingMinutes = last7DaysWorkouts.reduce((sum, w) => sum + w.duration, 0);
    const weeklyTrainingSessions = last7DaysWorkouts.length;

    // Categorize workouts by type
    const strengthWorkouts = last7DaysWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    ).length;

    const cardioWorkouts = last7DaysWorkouts.filter(w =>
      w.type === 'run' || w.type === 'cycle' || w.type === 'swim'
    ).length;

    // Determine training focus
    // Hybrid: Doing significant amounts of both strength AND cardio
    const isHybrid = strengthWorkouts >= 2 && cardioWorkouts >= 2;
    const isStrengthFocused = !isHybrid && strengthWorkouts >= cardioWorkouts && strengthWorkouts >= 2;
    const isEnduranceFocused = !isHybrid && cardioWorkouts > strengthWorkouts && cardioWorkouts >= 3;

    // Determine activity level based on training volume
    // We check both minutes and sessions to handle different training styles:
    // - High-frequency short sessions (e.g., daily 30min)
    // - Lower-frequency long sessions (e.g., 3x 90min)
    let activityLevel: keyof typeof ACTIVITY_MULTIPLIERS = 'sedentary';

    if (weeklyTrainingMinutes >= ACTIVITY_MULTIPLIERS.extraActive.minMinutes ||
        weeklyTrainingSessions >= ACTIVITY_MULTIPLIERS.extraActive.minSessions) {
      activityLevel = 'extraActive';
    } else if (weeklyTrainingMinutes >= ACTIVITY_MULTIPLIERS.veryActive.minMinutes ||
               weeklyTrainingSessions >= ACTIVITY_MULTIPLIERS.veryActive.minSessions) {
      activityLevel = 'veryActive';
    } else if (weeklyTrainingMinutes >= ACTIVITY_MULTIPLIERS.moderatelyActive.minMinutes ||
               weeklyTrainingSessions >= ACTIVITY_MULTIPLIERS.moderatelyActive.minSessions) {
      activityLevel = 'moderatelyActive';
    } else if (weeklyTrainingMinutes >= ACTIVITY_MULTIPLIERS.lightlyActive.minMinutes ||
               weeklyTrainingSessions >= ACTIVITY_MULTIPLIERS.lightlyActive.minSessions) {
      activityLevel = 'lightlyActive';
    }

    return {
      weeklyTrainingMinutes,
      weeklyTrainingSessions,
      strengthWorkouts,
      cardioWorkouts,
      isHybrid,
      isStrengthFocused,
      isEnduranceFocused,
      activityLevel,
      activityMultiplier: ACTIVITY_MULTIPLIERS[activityLevel].multiplier,
    };
  }, [last7DaysWorkouts]);

  // Format activity level for display
  const activityLevelDisplay = useMemo(() => {
    switch (trainingAnalysis.activityLevel) {
      case 'extraActive': return 'Extra Active';
      case 'veryActive': return 'Very Active';
      case 'moderatelyActive': return 'Moderately Active';
      case 'lightlyActive': return 'Lightly Active';
      default: return 'Sedentary';
    }
  }, [trainingAnalysis.activityLevel]);

  // ---------------------------------------------------------------------------
  // TDEE CALCULATION (Total Daily Energy Expenditure)
  // ---------------------------------------------------------------------------
  // TDEE = BMR × Activity Multiplier
  // This is the estimated calories burned per day including all activity.
  // ---------------------------------------------------------------------------

  const tdee = Math.round(bmr * trainingAnalysis.activityMultiplier);

  // ---------------------------------------------------------------------------
  // PROTEIN RECOMMENDATIONS
  // ---------------------------------------------------------------------------
  // Protein needs vary based on:
  // 1. Training type (strength athletes need more than sedentary)
  // 2. Training frequency (more training = more recovery needs)
  // 3. Age (older adults need more due to anabolic resistance)
  // 4. Goals (fat loss may benefit from higher protein)
  // ---------------------------------------------------------------------------

  const proteinRecommendation = useMemo(() => {
    let recommendation = PROTEIN_RECOMMENDATIONS.generalFitness;

    // Determine base recommendation from training type
    if (trainingAnalysis.weeklyTrainingSessions <= 1) {
      recommendation = PROTEIN_RECOMMENDATIONS.sedentary;
    } else if (trainingAnalysis.weeklyTrainingSessions <= 2) {
      recommendation = PROTEIN_RECOMMENDATIONS.lightActivity;
    } else if (trainingAnalysis.isHybrid) {
      // Hybrid athletes need protein for both muscle maintenance and recovery
      recommendation = PROTEIN_RECOMMENDATIONS.hybrid;
    } else if (trainingAnalysis.isStrengthFocused && trainingAnalysis.strengthWorkouts >= 3) {
      // Heavy strength training maximizes protein needs for muscle protein synthesis
      recommendation = PROTEIN_RECOMMENDATIONS.strength;
    } else if (trainingAnalysis.isEnduranceFocused && trainingAnalysis.cardioWorkouts >= 4) {
      // Endurance athletes need protein for recovery but less than strength athletes
      recommendation = PROTEIN_RECOMMENDATIONS.endurance;
    }

    let perKg = recommendation.perKg;
    let rationale = recommendation.rationale;

    // Age adjustment: Adults 50+ have reduced anabolic sensitivity
    // They need ~20% more protein to achieve the same muscle protein synthesis
    if (age >= 50) {
      perKg += 0.2;
      rationale += ' + age-adjusted';
    }

    return { perKg, rationale };
  }, [trainingAnalysis, age]);

  const dailyProtein = Math.round(currentWeight * proteinRecommendation.perKg);

  // ---------------------------------------------------------------------------
  // MACRO DISTRIBUTION
  // ---------------------------------------------------------------------------
  // After setting protein, we allocate remaining calories to carbs and fat.
  //
  // Strategy:
  // 1. Protein: Set based on training needs (above)
  // 2. Fat: Fixed at 25% of total calories (healthy minimum, supports hormones)
  // 3. Carbs: Remainder (typically 45-55% for active individuals)
  //
  // This approach prioritizes protein, ensures adequate fat, and lets carbs
  // flex based on overall calorie needs.
  // ---------------------------------------------------------------------------

  const macros = useMemo(() => {
    const proteinCals = dailyProtein * CALORIES_PER_GRAM.protein;
    const fatCals = tdee * FAT_PERCENTAGE;
    const carbCals = tdee - proteinCals - fatCals;

    return {
      protein: dailyProtein,
      proteinCals,
      proteinPercent: Math.round((proteinCals / tdee) * 100),
      fat: Math.round(fatCals / CALORIES_PER_GRAM.fat),
      fatCals,
      fatPercent: Math.round(FAT_PERCENTAGE * 100),
      carbs: Math.round(carbCals / CALORIES_PER_GRAM.carbs),
      carbCals,
      carbPercent: Math.round((carbCals / tdee) * 100),
    };
  }, [dailyProtein, tdee]);

  // ---------------------------------------------------------------------------
  // TRAINING DAY DETECTION
  // ---------------------------------------------------------------------------
  // Check if today has a workout for timing-specific recommendations.
  // ---------------------------------------------------------------------------

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayWorkout = useMemo(() => {
    return last7DaysWorkouts.find(w =>
      format(new Date(w.date), 'yyyy-MM-dd') === todayStr
    );
  }, [last7DaysWorkouts, todayStr]);

  const isTrainingDay = !!todayWorkout;

  // ---------------------------------------------------------------------------
  // ACWR-BASED CALORIE ADJUSTMENT
  // ---------------------------------------------------------------------------
  // ACWR (Acute:Chronic Workload Ratio) indicates training load trends.
  //
  // - ACWR > 1.3: Training load is spiking, need extra calories for recovery
  // - ACWR 0.8-1.3: Sweet spot, maintain normal intake
  // - ACWR < 0.8: Detraining/rest period, slightly reduce intake
  //
  // We use this from the health store's pre-calculated training load.
  // If using Oura/Whoop, we might have readiness scores that override this.
  // ---------------------------------------------------------------------------

  const acwrAdjustment = useMemo(() => {
    const acwr = trainingLoad?.acwr || 1;

    // High load periods need extra fuel for recovery
    if (acwr > 1.3) {
      return {
        calories: 200,
        reason: 'High training load - extra fuel for recovery',
        acwr,
      };
    }

    // Low load periods can slightly reduce intake
    // But don't go too aggressive to avoid metabolic adaptation
    if (acwr < 0.8) {
      return {
        calories: -100,
        reason: 'Lower training load - reduced energy needs',
        acwr,
      };
    }

    // Optimal range, no adjustment needed
    return { calories: 0, reason: '', acwr };
  }, [trainingLoad?.acwr]);

  const adjustedTdee = tdee + acwrAdjustment.calories;

  // ---------------------------------------------------------------------------
  // HYDRATION RECOMMENDATION
  // ---------------------------------------------------------------------------
  // Base: 33ml per kg bodyweight (covers sedentary needs)
  // Exercise: Additional 500ml per hour of activity
  //
  // We average the weekly exercise time to get daily additional needs.
  // ---------------------------------------------------------------------------

  const dailyHydration = useMemo(() => {
    const baseHydration = currentWeight * HYDRATION.mlPerKg / 1000; // Convert to liters
    const avgDailyExerciseMinutes = trainingAnalysis.weeklyTrainingMinutes / 7;
    const exerciseHydration = (avgDailyExerciseMinutes / 60) * HYDRATION.mlPerHourExercise / 1000;

    return (baseHydration + exerciseHydration).toFixed(1);
  }, [currentWeight, trainingAnalysis.weeklyTrainingMinutes]);

  // ---------------------------------------------------------------------------
  // FIBER RECOMMENDATION
  // ---------------------------------------------------------------------------
  // Based on gender following Academy of Nutrition and Dietetics guidelines.
  // ---------------------------------------------------------------------------

  const dailyFiber = isMale ? FIBER.male : FIBER.female;

  // ---------------------------------------------------------------------------
  // EMPTY STATE
  // ---------------------------------------------------------------------------
  // If we don't have weight data, we can't make meaningful recommendations.
  // ---------------------------------------------------------------------------

  if (!currentWeight && !profile?.weightGoal) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Utensils size={20} className="text-orange-500" />
          <h3 className="font-semibold text-gray-900">Nutrition Coaching</h3>
        </div>
        <p className="text-sm text-gray-500">
          Import weight data or set your weight goal in Settings to get personalized nutrition recommendations.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-sm border border-orange-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-orange-100/50 border-b border-orange-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils size={18} className="text-orange-600" />
            <span className="text-sm font-semibold text-orange-800">Daily Nutrition Targets</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Show data source if using dedicated tracker */}
            {sleepTrackerSource !== 'apple_health' && (
              <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                {dataSourceLabel}
              </span>
            )}
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              {activityLevelDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4">
        {/* Calories */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Flame size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{adjustedTdee}</p>
              <p className="text-xs text-gray-500">calories/day</p>
            </div>
          </div>
          {acwrAdjustment.calories !== 0 && (
            <div className={`text-xs px-2 py-1 rounded-full ${
              acwrAdjustment.calories > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {acwrAdjustment.calories > 0 ? '+' : ''}{acwrAdjustment.calories} (ACWR {acwrAdjustment.acwr.toFixed(2)})
            </div>
          )}
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Protein */}
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <Beef size={16} className="mx-auto text-rose-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{macros.protein}g</p>
            <p className="text-xs text-gray-500">Protein</p>
            <p className="text-[10px] text-gray-400">{proteinRecommendation.perKg}g/kg</p>
          </div>
          {/* Carbs */}
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <Wheat size={16} className="mx-auto text-amber-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{macros.carbs}g</p>
            <p className="text-xs text-gray-500">Carbs</p>
            <p className="text-[10px] text-gray-400">{macros.carbPercent}%</p>
          </div>
          {/* Fat */}
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <Droplets size={16} className="mx-auto text-yellow-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{macros.fat}g</p>
            <p className="text-xs text-gray-500">Fat</p>
            <p className="text-[10px] text-gray-400">{macros.fatPercent}%</p>
          </div>
        </div>

        {/* Context Info */}
        <div className="bg-white/40 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-orange-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600">
              <strong>Protein target:</strong> {macros.protein}g based on {proteinRecommendation.rationale}.
              {isTrainingDay && todayWorkout && (
                <span className="block mt-1">
                  <strong>Today:</strong> {todayWorkout.type === 'run' ? 'Running' : todayWorkout.type === 'strength' ? 'Lifting' : 'Training'} day - prioritize {todayWorkout.type === 'run' ? 'carbs before, protein after' : 'protein around your workout'}.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-sm text-orange-600 hover:text-orange-700 py-1"
        >
          {expanded ? 'Hide details' : 'Show details'}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-orange-200/50 space-y-3">
            {/* Calculation breakdown */}
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>BMR:</strong> {Math.round(bmr)} cal (Mifflin-St Jeor)</p>
              <p>
                <strong>Activity:</strong> ×{trainingAnalysis.activityMultiplier}
                ({trainingAnalysis.weeklyTrainingSessions} sessions, {trainingAnalysis.weeklyTrainingMinutes}min this week)
              </p>
              <p><strong>TDEE:</strong> {tdee} cal</p>
              {acwrAdjustment.calories !== 0 && (
                <p>
                  <strong>Adjustment:</strong> {acwrAdjustment.calories > 0 ? '+' : ''}{acwrAdjustment.calories}
                  ({acwrAdjustment.reason})
                </p>
              )}
            </div>

            {/* Additional targets */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-gray-900">{dailyHydration}L</p>
                <p className="text-xs text-gray-500">Water/day</p>
              </div>
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-gray-900">{dailyFiber}g</p>
                <p className="text-xs text-gray-500">Fiber/day</p>
              </div>
            </div>

            {/* Meal timing tips */}
            <div className="bg-orange-100/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Timing Tips</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• <strong>Pre-workout (2-3hrs):</strong> Complex carbs + moderate protein</li>
                <li>• <strong>Post-workout (within 1hr):</strong> 30-40g protein + fast carbs</li>
                <li>• <strong>Before bed:</strong> Casein protein or cottage cheese for overnight recovery</li>
              </ul>
            </div>

            {/* Training type specific advice */}
            {trainingAnalysis.isHybrid && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Hybrid Athlete Note</p>
                <p className="text-xs text-gray-600">
                  Running + lifting requires higher protein ({PROTEIN_RECOMMENDATIONS.hybrid.perKg}g/kg) and smart carb timing.
                  Prioritize carbs around runs, protein around lifts.
                </p>
              </div>
            )}

            {/* Data sources note */}
            <div className="text-[10px] text-gray-400 text-center pt-2">
              Training data from {last7DaysWorkouts.length} unique workouts (duplicates removed)
              {sleepTrackerSource !== 'apple_health' && ` • Recovery data from ${dataSourceLabel}`}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-white/40 border-t border-orange-200/50">
        <button
          onClick={() => onAskAI(
            `Create a meal plan for me based on my targets: ${adjustedTdee} calories, ` +
            `${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat. ` +
            `I'm ${age} years old, ${currentWeight}kg, and do ` +
            `${trainingAnalysis.isHybrid ? 'hybrid running + lifting' :
              trainingAnalysis.isStrengthFocused ? 'strength training' : 'cardio/running'}.`
          )}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-orange-700 hover:text-orange-800 hover:bg-orange-100 rounded-lg transition-colors"
        >
          <MessageCircle size={14} />
          Get Personalized Meal Plan
        </button>
      </div>
    </div>
  );
}
