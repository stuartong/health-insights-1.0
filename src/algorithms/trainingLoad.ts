/**
 * Training Load Calculations
 * Combines data from multiple sources to calculate overall training stress
 */

import type { Workout, DailyLoad, WorkoutType } from '@/types';
import { calculateTSS, calculateIntensityFromHR, calculateIntensityFromPace } from './acwr';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';

/**
 * Calculate TSS for a workout based on available data
 */
export function calculateWorkoutTSS(workout: Workout): number {
  let intensity = 0.5; // Default moderate intensity

  // Calculate intensity from heart rate if available
  if (workout.avgHeartRate && workout.maxHeartRate) {
    intensity = calculateIntensityFromHR(workout.avgHeartRate, workout.maxHeartRate);
  }
  // Or from pace for running
  else if (workout.type === 'run' && workout.avgPace) {
    intensity = calculateIntensityFromPace(workout.avgPace);
  }
  // Or estimate from perceived exertion / workout type
  else {
    const typeIntensities: Record<WorkoutType, number> = {
      run: 0.7,
      cycle: 0.6,
      swim: 0.65,
      strength: 0.6,
      walk: 0.3,
      hike: 0.5,
      other: 0.5,
    };
    intensity = typeIntensities[workout.type] || 0.5;
  }

  return calculateTSS(workout.duration, intensity, workout.type);
}

/**
 * Aggregate workouts into daily training loads
 */
export function aggregateDailyLoads(
  workouts: Workout[],
  startDate: Date,
  endDate: Date
): DailyLoad[] {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const workoutsByDay = new Map<string, Workout[]>();
  workouts.forEach((workout) => {
    const dayKey = format(startOfDay(new Date(workout.date)), 'yyyy-MM-dd');
    if (!workoutsByDay.has(dayKey)) {
      workoutsByDay.set(dayKey, []);
    }
    workoutsByDay.get(dayKey)!.push(workout);
  });

  return days.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayWorkouts = workoutsByDay.get(dayKey) || [];

    return {
      date: day,
      tss: dayWorkouts.reduce((sum, w) => sum + (w.tss || calculateWorkoutTSS(w)), 0),
      duration: dayWorkouts.reduce((sum, w) => sum + w.duration, 0),
      workoutCount: dayWorkouts.length,
      types: [...new Set(dayWorkouts.map((w) => w.type))],
    };
  });
}

/**
 * Calculate weekly training summary
 */
export interface WeeklyTrainingSummary {
  weekStart: Date;
  totalTSS: number;
  totalDuration: number; // minutes
  workoutCount: number;
  avgDailyLoad: number;
  runningDistance: number; // meters
  cyclingDistance: number;
  strengthSessions: number;
  longestWorkout: number; // minutes
  hardestWorkout: { name: string; tss: number } | null;
}

export function calculateWeeklySummary(
  workouts: Workout[],
  weekStart: Date
): WeeklyTrainingSummary {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekWorkouts = workouts.filter((w) => {
    const date = new Date(w.date);
    return date >= weekStart && date < weekEnd;
  });

  const totalTSS = weekWorkouts.reduce((sum, w) => sum + (w.tss || calculateWorkoutTSS(w)), 0);
  const totalDuration = weekWorkouts.reduce((sum, w) => sum + w.duration, 0);

  const runningWorkouts = weekWorkouts.filter((w) => w.type === 'run');
  const cyclingWorkouts = weekWorkouts.filter((w) => w.type === 'cycle');
  const strengthWorkouts = weekWorkouts.filter((w) => w.type === 'strength');

  const longestWorkout = Math.max(...weekWorkouts.map((w) => w.duration), 0);

  let hardestWorkout: { name: string; tss: number } | null = null;
  if (weekWorkouts.length > 0) {
    const hardest = weekWorkouts.reduce((max, w) =>
      (w.tss || calculateWorkoutTSS(w)) > (max.tss || calculateWorkoutTSS(max)) ? w : max
    );
    hardestWorkout = {
      name: hardest.name || hardest.type,
      tss: hardest.tss || calculateWorkoutTSS(hardest),
    };
  }

  return {
    weekStart,
    totalTSS,
    totalDuration,
    workoutCount: weekWorkouts.length,
    avgDailyLoad: totalTSS / 7,
    runningDistance: runningWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0),
    cyclingDistance: cyclingWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0),
    strengthSessions: strengthWorkouts.length,
    longestWorkout,
    hardestWorkout,
  };
}

/**
 * Calculate Fitness, Fatigue, and Form (Performance Management Chart)
 * Uses exponential decay to track long-term fitness and short-term fatigue
 */
export interface PerformanceMetrics {
  date: Date;
  fitness: number; // CTL - Chronic Training Load (42-day)
  fatigue: number; // ATL - Acute Training Load (7-day)
  form: number; // TSB - Training Stress Balance (fitness - fatigue)
}

export function calculatePerformanceMetrics(
  dailyLoads: DailyLoad[],
  ctlDecay = 42,
  atlDecay = 7
): PerformanceMetrics[] {
  if (dailyLoads.length === 0) return [];

  const metrics: PerformanceMetrics[] = [];
  let ctl = 0; // Chronic Training Load
  let atl = 0; // Acute Training Load

  const ctlFactor = 2 / (ctlDecay + 1);
  const atlFactor = 2 / (atlDecay + 1);

  for (const load of dailyLoads) {
    ctl = load.tss * ctlFactor + ctl * (1 - ctlFactor);
    atl = load.tss * atlFactor + atl * (1 - atlFactor);

    metrics.push({
      date: load.date,
      fitness: ctl,
      fatigue: atl,
      form: ctl - atl,
    });
  }

  return metrics;
}

/**
 * Suggest optimal training intensity for today
 */
export type TrainingIntensity = 'rest' | 'recovery' | 'easy' | 'moderate' | 'hard' | 'very_hard';

export function suggestTodaysIntensity(
  form: number,
  acwr: number,
  hrvPercentOfBaseline?: number,
  sleepScore?: number
): { intensity: TrainingIntensity; reason: string } {
  // Negative form means accumulated fatigue
  if (form < -25) {
    return {
      intensity: 'rest',
      reason: 'High fatigue accumulation. Rest day recommended.',
    };
  }

  if (acwr > 1.5) {
    return {
      intensity: 'rest',
      reason: 'Training load spike detected. Take a rest day.',
    };
  }

  // Check HRV if available
  if (hrvPercentOfBaseline !== undefined && hrvPercentOfBaseline < 85) {
    return {
      intensity: 'recovery',
      reason: 'HRV below baseline suggests incomplete recovery.',
    };
  }

  // Check sleep if available
  if (sleepScore !== undefined && sleepScore < 60) {
    return {
      intensity: 'easy',
      reason: 'Poor sleep quality. Keep intensity low today.',
    };
  }

  if (form > 15) {
    return {
      intensity: 'hard',
      reason: 'Fresh and recovered. Great day for quality work.',
    };
  }

  if (form > 0) {
    return {
      intensity: 'moderate',
      reason: 'Good recovery balance. Moderate session appropriate.',
    };
  }

  if (form > -15) {
    return {
      intensity: 'easy',
      reason: 'Some accumulated fatigue. Easy aerobic session.',
    };
  }

  return {
    intensity: 'recovery',
    reason: 'Elevated fatigue. Light recovery activity only.',
  };
}

/**
 * Calculate monotony and strain (injury risk factors)
 */
export interface MonotonyMetrics {
  monotony: number; // Lower variation = higher monotony = higher risk
  strain: number; // Weekly load × monotony
  riskLevel: 'low' | 'moderate' | 'high';
}

export function calculateMonotonyAndStrain(dailyLoads: number[]): MonotonyMetrics {
  if (dailyLoads.length < 7) {
    return { monotony: 0, strain: 0, riskLevel: 'low' };
  }

  const weekLoads = dailyLoads.slice(-7);
  const weekTotal = weekLoads.reduce((a, b) => a + b, 0);
  const mean = weekTotal / 7;

  // Calculate standard deviation
  const squaredDiffs = weekLoads.map((load) => Math.pow(load - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / 7;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Monotony = mean / standard deviation
  const monotony = stdDev > 0 ? mean / stdDev : 0;

  // Strain = total weekly load × monotony
  const strain = weekTotal * monotony;

  let riskLevel: 'low' | 'moderate' | 'high' = 'low';
  if (monotony > 2.0 || strain > 4000) {
    riskLevel = 'high';
  } else if (monotony > 1.5 || strain > 3000) {
    riskLevel = 'moderate';
  }

  return { monotony, strain, riskLevel };
}
