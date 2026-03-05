/**
 * Correlation Analysis Engine
 * Finds patterns and relationships between health metrics
 */

import type { Correlation, Insight, Workout, SleepRecord, WeightEntry, HRVReading } from '@/types';
import { format, subDays } from 'date-fns';

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const sumX = xSlice.reduce((a, b) => a + b, 0);
  const sumY = ySlice.reduce((a, b) => a + b, 0);
  const sumXY = xSlice.reduce((acc, xi, i) => acc + xi * ySlice[i], 0);
  const sumX2 = xSlice.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = ySlice.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Determine correlation significance
 */
export function getSignificance(r: number): 'strong' | 'moderate' | 'weak' | 'none' {
  const absR = Math.abs(r);
  if (absR >= 0.7) return 'strong';
  if (absR >= 0.4) return 'moderate';
  if (absR >= 0.2) return 'weak';
  return 'none';
}

/**
 * Calculate approximate p-value (simplified)
 */
export function approximatePValue(r: number, n: number): number {
  if (n < 3) return 1;

  // t-statistic
  const t = r * Math.sqrt((n - 2) / (1 - r * r));

  // Simplified p-value approximation
  const absT = Math.abs(t);
  if (absT > 3.5) return 0.001;
  if (absT > 2.5) return 0.01;
  if (absT > 2.0) return 0.05;
  if (absT > 1.5) return 0.1;
  return 0.5;
}

interface MetricDataPoint {
  date: string;
  value: number;
}

/**
 * Align data by date for correlation analysis
 */
export function alignDataByDate(
  data1: MetricDataPoint[],
  data2: MetricDataPoint[]
): { aligned1: number[]; aligned2: number[] } {
  const dateMap2 = new Map(data2.map((d) => [d.date, d.value]));

  const aligned1: number[] = [];
  const aligned2: number[] = [];

  for (const point of data1) {
    const value2 = dateMap2.get(point.date);
    if (value2 !== undefined) {
      aligned1.push(point.value);
      aligned2.push(value2);
    }
  }

  return { aligned1, aligned2 };
}

/**
 * Find correlations between sleep and workout performance
 */
export function analyzeSleepWorkoutCorrelation(
  sleepRecords: SleepRecord[],
  workouts: Workout[]
): Correlation[] {
  const correlations: Correlation[] = [];

  // Group by date
  const sleepByDate = new Map<string, SleepRecord>();
  sleepRecords.forEach((s) => {
    const date = format(new Date(s.date), 'yyyy-MM-dd');
    sleepByDate.set(date, s);
  });

  // For each workout, get previous night's sleep
  const sleepWorkoutPairs: { sleep: SleepRecord; workout: Workout }[] = [];
  workouts.forEach((w) => {
        const prevDate = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
    const sleep = sleepByDate.get(prevDate);
    if (sleep) {
      sleepWorkoutPairs.push({ sleep, workout: w });
    }
  });

  if (sleepWorkoutPairs.length < 5) return correlations;

  // Sleep duration vs workout duration
  const sleepDurations = sleepWorkoutPairs.map((p) => p.sleep.duration / 60);
  const workoutDurations = sleepWorkoutPairs.map((p) => p.workout.duration);
  const durationCorr = pearsonCorrelation(sleepDurations, workoutDurations);

  if (Math.abs(durationCorr) > 0.2) {
    correlations.push({
      id: 'sleep_duration_workout_duration',
      metric1: 'Sleep Duration',
      metric2: 'Workout Duration',
      coefficient: durationCorr,
      pValue: approximatePValue(durationCorr, sleepWorkoutPairs.length),
      sampleSize: sleepWorkoutPairs.length,
      description: durationCorr > 0
        ? 'Longer sleep tends to be followed by longer workouts'
        : 'Longer sleep tends to be followed by shorter workouts',
      significance: getSignificance(durationCorr),
    });
  }

  // Sleep quality vs workout intensity (if we have HR data)
  const pairsWithHR = sleepWorkoutPairs.filter((p) => p.workout.avgHeartRate && p.sleep.score);
  if (pairsWithHR.length >= 5) {
    const sleepScores = pairsWithHR.map((p) => p.sleep.score!);
    const avgHRs = pairsWithHR.map((p) => p.workout.avgHeartRate!);
    const hrCorr = pearsonCorrelation(sleepScores, avgHRs);

    if (Math.abs(hrCorr) > 0.2) {
      correlations.push({
        id: 'sleep_score_workout_intensity',
        metric1: 'Sleep Score',
        metric2: 'Workout Intensity (Avg HR)',
        coefficient: hrCorr,
        pValue: approximatePValue(hrCorr, pairsWithHR.length),
        sampleSize: pairsWithHR.length,
        description: hrCorr > 0
          ? 'Better sleep quality correlates with higher workout intensity'
          : 'Better sleep quality correlates with lower workout intensity',
        significance: getSignificance(hrCorr),
      });
    }
  }

  return correlations;
}

/**
 * Find correlations between HRV and performance
 */
export function analyzeHRVPerformanceCorrelation(
  hrvReadings: HRVReading[],
  workouts: Workout[]
): Correlation[] {
  const correlations: Correlation[] = [];

  // Group HRV by date
  const hrvByDate = new Map<string, number>();
  hrvReadings.forEach((h) => {
    const date = format(new Date(h.date), 'yyyy-MM-dd');
    // Keep the morning/highest reading
    const existing = hrvByDate.get(date);
    if (!existing || h.value > existing) {
      hrvByDate.set(date, h.value);
    }
  });

  // For each workout, get same-day HRV
  const pairs: { hrv: number; workout: Workout }[] = [];
  workouts.forEach((w) => {
    const date = format(new Date(w.date), 'yyyy-MM-dd');
    const hrv = hrvByDate.get(date);
    if (hrv) {
      pairs.push({ hrv, workout: w });
    }
  });

  if (pairs.length < 5) return correlations;

  // HRV vs workout performance (pace for runs)
  const runPairs = pairs.filter((p) => p.workout.type === 'run' && p.workout.avgPace);
  if (runPairs.length >= 5) {
    const hrvValues = runPairs.map((p) => p.hrv);
    // Invert pace so higher is better
    const paceValues = runPairs.map((p) => 1000 / p.workout.avgPace!);
    const paceCorr = pearsonCorrelation(hrvValues, paceValues);

    if (Math.abs(paceCorr) > 0.2) {
      correlations.push({
        id: 'hrv_running_pace',
        metric1: 'Morning HRV',
        metric2: 'Running Pace',
        coefficient: paceCorr,
        pValue: approximatePValue(paceCorr, runPairs.length),
        sampleSize: runPairs.length,
        description: paceCorr > 0
          ? 'Higher HRV correlates with faster running pace'
          : 'Higher HRV correlates with slower running pace',
        significance: getSignificance(paceCorr),
      });
    }
  }

  return correlations;
}

/**
 * Analyze weight trends vs training patterns
 */
export function analyzeWeightTrainingCorrelation(
  weightEntries: WeightEntry[],
  workouts: Workout[]
): Correlation[] {
  const correlations: Correlation[] = [];

  if (weightEntries.length < 14 || workouts.length < 7) return correlations;

  // Calculate weekly weight change and weekly training volume
  const weeklyData: { weightChange: number; trainingMinutes: number }[] = [];

  for (let i = 7; i < weightEntries.length; i++) {
    const currentWeight = weightEntries[i].weight;
    const prevWeight = weightEntries[i - 7]?.weight;
    if (!prevWeight) continue;

    const weekStart = subDays(new Date(weightEntries[i].date), 7);
    const weekEnd = new Date(weightEntries[i].date);

    const weekWorkouts = workouts.filter((w) => {
      const d = new Date(w.date);
      return d >= weekStart && d <= weekEnd;
    });

    weeklyData.push({
      weightChange: currentWeight - prevWeight,
      trainingMinutes: weekWorkouts.reduce((sum, w) => sum + w.duration, 0),
    });
  }

  if (weeklyData.length >= 4) {
    const weightChanges = weeklyData.map((d) => d.weightChange);
    const trainingVolumes = weeklyData.map((d) => d.trainingMinutes);
    const corr = pearsonCorrelation(weightChanges, trainingVolumes);

    if (Math.abs(corr) > 0.2) {
      correlations.push({
        id: 'weight_change_training_volume',
        metric1: 'Weekly Weight Change',
        metric2: 'Weekly Training Volume',
        coefficient: corr,
        pValue: approximatePValue(corr, weeklyData.length),
        sampleSize: weeklyData.length,
        description: corr < 0
          ? 'Higher training volume correlates with weight loss'
          : 'Higher training volume correlates with weight gain (possible muscle gain)',
        significance: getSignificance(corr),
      });
    }
  }

  return correlations;
}

/**
 * Generate insight cards from correlation analysis
 */
export function generateCorrelationInsights(correlations: Correlation[]): Insight[] {
  const insights: Insight[] = [];

  for (const corr of correlations) {
    if (corr.significance === 'none' || corr.significance === 'weak') continue;

    const insight: Insight = {
      id: `insight_${corr.id}_${Date.now()}`,
      date: new Date(),
      category: 'correlation',
      title: `${corr.metric1} & ${corr.metric2}`,
      description: corr.description,
      severity: corr.significance === 'strong' ? 'success' : 'info',
      metrics: {
        correlation: corr.coefficient.toFixed(2),
        samples: corr.sampleSize,
      },
    };

    // Add actionable advice
    if (corr.id === 'hrv_running_pace' && corr.coefficient > 0.3) {
      insight.actionable = 'Consider checking your HRV before hard sessions to optimize timing.';
    }
    if (corr.id === 'sleep_duration_workout_duration' && corr.coefficient > 0.3) {
      insight.actionable = 'Prioritize 7-8 hours sleep before long training sessions.';
    }
    if (corr.id === 'weight_change_training_volume' && corr.coefficient < -0.3) {
      insight.actionable = 'Maintain training consistency for continued progress.';
    }

    insights.push(insight);
  }

  return insights;
}

/**
 * Find optimal conditions for best performances
 */
export function findOptimalConditions(
  workouts: Workout[],
  sleepRecords: SleepRecord[],
  hrvReadings: HRVReading[]
): { condition: string; value: string; impact: string }[] {
  const conditions: { condition: string; value: string; impact: string }[] = [];

  // Find best runs
  const runs = workouts.filter((w) => w.type === 'run' && w.avgPace && w.distance);
  if (runs.length < 5) return conditions;

  // Sort by pace (best first)
  const sortedRuns = [...runs].sort((a, b) => (a.avgPace || 999) - (b.avgPace || 999));
  const topRuns = sortedRuns.slice(0, Math.max(3, Math.floor(runs.length * 0.2)));
  const bottomRuns = sortedRuns.slice(-Math.max(3, Math.floor(runs.length * 0.2)));

  // Compare sleep before best vs worst runs
  const sleepByDate = new Map(
    sleepRecords.map((s) => [format(subDays(new Date(s.date), 0), 'yyyy-MM-dd'), s])
  );

  const getAvgSleep = (runs: Workout[]) => {
    const sleeps = runs
      .map((r) => sleepByDate.get(format(subDays(new Date(r.date), 1), 'yyyy-MM-dd')))
      .filter(Boolean) as SleepRecord[];
    if (sleeps.length === 0) return null;
    return sleeps.reduce((sum, s) => sum + s.duration, 0) / sleeps.length / 60;
  };

  const topSleep = getAvgSleep(topRuns);
  const bottomSleep = getAvgSleep(bottomRuns);

  if (topSleep && bottomSleep && Math.abs(topSleep - bottomSleep) > 0.5) {
    conditions.push({
      condition: 'Sleep Duration',
      value: `${topSleep.toFixed(1)} hours`,
      impact: `Your best runs come after ${topSleep.toFixed(1)}+ hours of sleep`,
    });
  }

  // Compare HRV before best vs worst runs
  const hrvByDate = new Map(
    hrvReadings.map((h) => [format(new Date(h.date), 'yyyy-MM-dd'), h.value])
  );

  const getAvgHRV = (runs: Workout[]) => {
    const hrvs = runs
      .map((r) => hrvByDate.get(format(new Date(r.date), 'yyyy-MM-dd')))
      .filter((v) => v !== undefined) as number[];
    if (hrvs.length === 0) return null;
    return hrvs.reduce((sum, h) => sum + h, 0) / hrvs.length;
  };

  const topHRV = getAvgHRV(topRuns);
  const bottomHRV = getAvgHRV(bottomRuns);

  if (topHRV && bottomHRV && topHRV > bottomHRV * 1.1) {
    conditions.push({
      condition: 'HRV',
      value: `${topHRV.toFixed(0)} ms`,
      impact: `Your best runs happen when HRV is ${topHRV.toFixed(0)}+ ms`,
    });
  }

  return conditions;
}
