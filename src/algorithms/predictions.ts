/**
 * Performance Prediction Algorithms
 * Race time predictions, 1RM estimations, and goal setting
 */

import type { Workout, LiftingPR, RunningPR } from '@/types';

// ==================== Running Predictions ====================

/**
 * Riegel Formula for race time prediction
 * T2 = T1 × (D2/D1)^1.06
 *
 * Research shows the exponent varies by fitness level:
 * - Elite: ~1.04
 * - Recreational: ~1.06-1.08
 */
export function predictRaceTime(
  knownDistance: number, // meters
  knownTime: number, // seconds
  targetDistance: number, // meters
  fitnessLevel: 'elite' | 'trained' | 'recreational' = 'recreational'
): number {
  const exponents = {
    elite: 1.04,
    trained: 1.06,
    recreational: 1.08,
  };

  const exponent = exponents[fitnessLevel];
  return knownTime * Math.pow(targetDistance / knownDistance, exponent);
}

/**
 * Standard race distances
 */
export const raceDistances = {
  '1K': 1000,
  '5K': 5000,
  '10K': 10000,
  'Half Marathon': 21097.5,
  'Marathon': 42195,
};

/**
 * Predict times for all standard distances based on a known time
 */
export function predictAllRaceTimes(
  knownDistance: number,
  knownTime: number,
  fitnessLevel: 'elite' | 'trained' | 'recreational' = 'recreational'
): Record<string, number> {
  const predictions: Record<string, number> = {};

  for (const [name, distance] of Object.entries(raceDistances)) {
    predictions[name] = predictRaceTime(knownDistance, knownTime, distance, fitnessLevel);
  }

  return predictions;
}

/**
 * Format time in seconds to readable string
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate pace from distance and time
 */
export function calculatePace(distanceMeters: number, timeSeconds: number): number {
  const distanceKm = distanceMeters / 1000;
  return timeSeconds / distanceKm; // seconds per km
}

/**
 * Estimate VO2max from race performance (Jack Daniels VDOT)
 */
export function estimateVO2Max(distanceMeters: number, timeSeconds: number): number {
  const distanceKm = distanceMeters / 1000;
  const timeMinutes = timeSeconds / 60;
  const velocity = distanceKm / timeMinutes; // km/min

  // Simplified VO2max estimation
  // Based on running economy and race duration
  const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  const vo2 = -4.6 + 0.182258 * (velocity * 1000 / 60) +
    0.000104 * Math.pow(velocity * 1000 / 60, 2);

  return vo2 / percentVO2max;
}

/**
 * Calculate training paces based on race performance
 */
export interface TrainingPaces {
  easy: { min: number; max: number }; // seconds per km
  marathon: number;
  threshold: number;
  interval: number;
  repetition: number;
}

export function calculateTrainingPaces(
  raceDistance: number,
  raceTime: number
): TrainingPaces {
  estimateVO2Max(raceDistance, raceTime);

  // Base pace from current fitness
  const basePace = (raceTime / (raceDistance / 1000));

  return {
    easy: {
      min: basePace * 1.25,
      max: basePace * 1.35,
    },
    marathon: basePace * 1.1,
    threshold: basePace * 1.0,
    interval: basePace * 0.9,
    repetition: basePace * 0.85,
  };
}

/**
 * Generate running targets based on current PRs
 */
export function generateRunningTargets(
  currentPRs: RunningPR[],
  weeksToTrain: number = 12
): { distance: string; currentTime: number; targetTime: number; improvement: string }[] {
  const targets: { distance: string; currentTime: number; targetTime: number; improvement: string }[] = [];

  for (const pr of currentPRs) {
    // Estimate realistic improvement based on training duration
    // Typical improvement: 1-3% for well-trained, 5-10% for newer runners
    const improvementPercent = Math.min(10, weeksToTrain * 0.5);
    const targetTime = pr.time * (1 - improvementPercent / 100);

    targets.push({
      distance: pr.distanceLabel,
      currentTime: pr.time,
      targetTime,
      improvement: `${improvementPercent.toFixed(1)}% faster`,
    });
  }

  return targets;
}

// ==================== Lifting Predictions ====================

/**
 * Epley Formula for 1RM estimation
 * 1RM = weight × (1 + reps/30)
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps > 12) return weight * (1 + reps / 30); // Less accurate for high reps
  return weight * (1 + reps / 30);
}

/**
 * Brzycki Formula (alternative)
 * 1RM = weight × (36 / (37 - reps))
 */
export function estimate1RMBrzycki(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps >= 37) return weight; // Formula breaks down
  return weight * (36 / (37 - reps));
}

/**
 * Calculate weight for target reps given 1RM
 */
export function calculateWeightForReps(oneRM: number, targetReps: number): number {
  // Inverse of Epley formula
  return oneRM / (1 + targetReps / 30);
}

/**
 * Strength standards by lift (male, bodyweight-relative)
 */
export const strengthStandards: Record<
  string,
  { novice: number; intermediate: number; advanced: number; elite: number }
> = {
  squat: { novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.25 },
  deadlift: { novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
  bench: { novice: 0.5, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
  ohp: { novice: 0.35, intermediate: 0.65, advanced: 1.0, elite: 1.35 },
  row: { novice: 0.5, intermediate: 0.85, advanced: 1.2, elite: 1.5 },
};

/**
 * Get strength level for a lift
 */
export function getStrengthLevel(
  lift: string,
  oneRM: number,
  bodyweight: number
): 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite' {
  const standards = strengthStandards[lift.toLowerCase()];
  if (!standards) return 'novice';

  const ratio = oneRM / bodyweight;

  if (ratio >= standards.elite) return 'elite';
  if (ratio >= standards.advanced) return 'advanced';
  if (ratio >= standards.intermediate) return 'intermediate';
  if (ratio >= standards.novice) return 'novice';
  return 'beginner';
}

/**
 * Calculate Wilks Score (strength relative to bodyweight)
 */
export function calculateWilksScore(
  total: number, // squat + bench + deadlift
  bodyweight: number,
  isMale: boolean = true
): number {
  // Wilks coefficients
  const coefficients = isMale
    ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
    : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 4.731582e-5, f: -9.054e-8 };

  const { a, b, c, d, e, f } = coefficients;
  const bw = bodyweight;

  const coefficient = 500 / (a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4 + f * bw ** 5);

  return total * coefficient;
}

/**
 * Generate lifting targets based on current PRs
 */
export function generateLiftingTargets(
  currentPRs: LiftingPR[],
  bodyweight: number,
  weeksToTrain: number = 12
): { exercise: string; current1RM: number; target1RM: number; targetLevel: string }[] {
  const targets: { exercise: string; current1RM: number; target1RM: number; targetLevel: string }[] = [];

  for (const pr of currentPRs) {
    const currentLevel = getStrengthLevel(pr.exercise, pr.estimated1RM, bodyweight);
    const standards = strengthStandards[pr.exercise.toLowerCase()];

    if (!standards) continue;

    // Target next level
    let targetRatio: number;
    let targetLevel: string;

    if (currentLevel === 'beginner') {
      targetRatio = standards.novice;
      targetLevel = 'novice';
    } else if (currentLevel === 'novice') {
      targetRatio = standards.intermediate;
      targetLevel = 'intermediate';
    } else if (currentLevel === 'intermediate') {
      targetRatio = standards.advanced;
      targetLevel = 'advanced';
    } else if (currentLevel === 'advanced') {
      targetRatio = standards.elite;
      targetLevel = 'elite';
    } else {
      // Already elite
      targetRatio = pr.estimated1RM / bodyweight * 1.05;
      targetLevel = 'elite+';
    }

    // Cap realistic progress
    const maxGainPercent = weeksToTrain * 1.5; // ~1.5% per week max
    const uncappedTarget = targetRatio * bodyweight;
    const cappedTarget = pr.estimated1RM * (1 + maxGainPercent / 100);

    targets.push({
      exercise: pr.exercise,
      current1RM: pr.estimated1RM,
      target1RM: Math.min(uncappedTarget, cappedTarget),
      targetLevel,
    });
  }

  return targets;
}

/**
 * Calculate progressive overload suggestions
 */
export interface ProgressionSuggestion {
  exercise: string;
  currentWeight: number;
  currentReps: number;
  nextWeight: number;
  nextReps: number;
  method: 'add_weight' | 'add_reps' | 'add_sets';
}

export function suggestProgression(
  exercise: string,
  lastWeight: number,
  lastReps: number,
  targetReps: number = 5
): ProgressionSuggestion {
  // If hit target reps + buffer, increase weight
  if (lastReps >= targetReps + 2) {
    const increment = exercise.toLowerCase().includes('squat') ||
      exercise.toLowerCase().includes('deadlift')
      ? 2.5
      : 1.25;

    return {
      exercise,
      currentWeight: lastWeight,
      currentReps: lastReps,
      nextWeight: lastWeight + increment,
      nextReps: targetReps,
      method: 'add_weight',
    };
  }

  // Otherwise, try to add reps
  return {
    exercise,
    currentWeight: lastWeight,
    currentReps: lastReps,
    nextWeight: lastWeight,
    nextReps: lastReps + 1,
    method: 'add_reps',
  };
}

// ==================== Personal Records ====================

/**
 * Extract PRs from workout history
 */
export function extractRunningPRs(workouts: Workout[]): RunningPR[] {
  const prs: Map<string, RunningPR> = new Map();

  const distanceCategories = [
    { label: '1K', min: 950, max: 1100 },
    { label: '5K', min: 4800, max: 5200 },
    { label: '10K', min: 9800, max: 10500 },
    { label: 'Half Marathon', min: 20000, max: 22000 },
    { label: 'Marathon', min: 40000, max: 44000 },
  ];

  for (const workout of workouts) {
    if (workout.type !== 'run' || !workout.distance || !workout.duration) continue;

    for (const category of distanceCategories) {
      if (workout.distance >= category.min && workout.distance <= category.max) {
        const existing = prs.get(category.label);
        const time = workout.duration * 60; // convert to seconds

        // Normalize to exact distance
        const normalizedTime = time * (raceDistances[category.label as keyof typeof raceDistances] / workout.distance);

        if (!existing || normalizedTime < existing.time) {
          prs.set(category.label, {
            distance: raceDistances[category.label as keyof typeof raceDistances],
            distanceLabel: category.label,
            time: normalizedTime,
            pace: normalizedTime / (raceDistances[category.label as keyof typeof raceDistances] / 1000),
            date: new Date(workout.date),
            workoutId: workout.id,
          });
        }
      }
    }
  }

  return Array.from(prs.values()).sort((a, b) => a.distance - b.distance);
}
