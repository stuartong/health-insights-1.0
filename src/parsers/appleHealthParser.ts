/**
 * Apple Health Export XML Parser
 * Parses the export.xml file from Apple Health app
 *
 * IMPORTANT: Apple Health exports can be very large (100MB+).
 * By default, we only import the last 90 days of data to:
 * - Match the data window from Oura and Strava APIs
 * - Keep IndexedDB storage manageable
 * - Reduce memory usage during parsing
 */

import { XMLParser } from 'fast-xml-parser';
import type { Workout, SleepRecord, WeightEntry, HRVReading, HeartRateReading, VO2MaxReading, WorkoutType } from '@/types';
import { format, subDays } from 'date-fns';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Default number of days to import from Apple Health.
 * Set to 90 to match Oura/Strava data windows.
 * Can be overridden via the maxDaysBack parameter.
 */
const DEFAULT_MAX_DAYS_BACK = 90;

interface AppleHealthRecord {
  '@_type': string;
  '@_sourceName'?: string;
  '@_value'?: string;
  '@_unit'?: string;
  '@_startDate': string;
  '@_endDate'?: string;
  '@_creationDate'?: string;
}

interface AppleHealthWorkout {
  '@_workoutActivityType': string;
  '@_duration': string;
  '@_durationUnit'?: string;
  '@_totalDistance'?: string;
  '@_totalDistanceUnit'?: string;
  '@_totalEnergyBurned'?: string;
  '@_totalEnergyBurnedUnit'?: string;
  '@_startDate': string;
  '@_endDate': string;
  WorkoutStatistics?: Array<{
    '@_type': string;
    '@_sum'?: string;
    '@_average'?: string;
    '@_maximum'?: string;
  }>;
}

interface ParseProgress {
  stage: string;
  percent: number;
}

export type ParseProgressCallback = (progress: ParseProgress) => void;

function generateId(): string {
  return `ah_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseAppleDate(dateStr: string): Date {
  // Apple Health uses format like "2024-01-15 08:30:00 -0500"
  return new Date(dateStr.replace(' ', 'T').replace(' ', ''));
}

function mapWorkoutType(appleType: string): WorkoutType {
  const typeMap: Record<string, WorkoutType> = {
    HKWorkoutActivityTypeRunning: 'run',
    HKWorkoutActivityTypeCycling: 'cycle',
    HKWorkoutActivityTypeSwimming: 'swim',
    HKWorkoutActivityTypeTraditionalStrengthTraining: 'strength',
    HKWorkoutActivityTypeFunctionalStrengthTraining: 'strength',
    HKWorkoutActivityTypeWalking: 'walk',
    HKWorkoutActivityTypeHiking: 'hike',
  };
  return typeMap[appleType] || 'other';
}

export interface ParseOptions {
  /** Maximum number of days back to import. Default: 90 days. Set to 0 for all data. */
  maxDaysBack?: number;
  /** Progress callback */
  onProgress?: ParseProgressCallback;
}

export async function parseAppleHealthExport(
  file: File,
  optionsOrProgress?: ParseOptions | ParseProgressCallback
): Promise<{
  workouts: Workout[];
  sleepRecords: SleepRecord[];
  weightEntries: WeightEntry[];
  hrvReadings: HRVReading[];
  heartRateReadings: HeartRateReading[];
  vo2maxReadings: VO2MaxReading[];
  stats: { totalRecords: number; filteredRecords: number; cutoffDate: Date };
}> {
  // Handle both old callback signature and new options object
  const options: ParseOptions = typeof optionsOrProgress === 'function'
    ? { onProgress: optionsOrProgress }
    : optionsOrProgress || {};

  options.onProgress?.({ stage: 'Reading file', percent: 0 });
  const text = await file.text();
  return parseAppleHealthExportFromText(text, options);
}

export async function parseAppleHealthExportFromText(
  text: string,
  optionsOrProgress?: ParseOptions | ParseProgressCallback
): Promise<{
  workouts: Workout[];
  sleepRecords: SleepRecord[];
  weightEntries: WeightEntry[];
  hrvReadings: HRVReading[];
  heartRateReadings: HeartRateReading[];
  vo2maxReadings: VO2MaxReading[];
  stats: { totalRecords: number; filteredRecords: number; cutoffDate: Date };
}> {
  // Handle both old callback signature and new options object
  const options: ParseOptions = typeof optionsOrProgress === 'function'
    ? { onProgress: optionsOrProgress }
    : optionsOrProgress || {};

  const { onProgress, maxDaysBack = DEFAULT_MAX_DAYS_BACK } = options;

  onProgress?.({ stage: 'Parsing XML', percent: 10 });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (tagName) => ['Record', 'Workout', 'WorkoutStatistics'].includes(tagName),
  });

  const parsed = parser.parse(text);
  const healthData = parsed.HealthData;

  if (!healthData) {
    throw new Error('Invalid Apple Health export file');
  }

  const records: AppleHealthRecord[] = healthData.Record || [];
  const workoutsRaw: AppleHealthWorkout[] = healthData.Workout || [];

  // Calculate cutoff date for filtering
  // If maxDaysBack is 0, include all data (cutoff far in the past)
  const cutoffDate = maxDaysBack > 0
    ? subDays(new Date(), maxDaysBack)
    : new Date(0); // Unix epoch = include everything

  const totalRecords = records.length + workoutsRaw.length;
  let filteredRecords = 0;

  onProgress?.({ stage: `Processing records (last ${maxDaysBack} days)`, percent: 30 });

  const workouts: Workout[] = [];
  const sleepRecords: SleepRecord[] = [];
  const weightEntries: WeightEntry[] = [];
  const hrvReadings: HRVReading[] = [];
  const heartRateReadings: HeartRateReading[] = [];
  const vo2maxReadings: VO2MaxReading[] = [];

  // Process workouts
  onProgress?.({ stage: 'Processing workouts', percent: 40 });

  for (const w of workoutsRaw) {
    const workoutDate = parseAppleDate(w['@_startDate']);

    // Skip workouts older than cutoff date
    if (workoutDate < cutoffDate) {
      continue;
    }

    filteredRecords++;

    const workout: Workout = {
      id: generateId(),
      source: 'apple_health',
      type: mapWorkoutType(w['@_workoutActivityType']),
      name: w['@_workoutActivityType'].replace('HKWorkoutActivityType', ''),
      date: workoutDate,
      duration: parseFloat(w['@_duration']) || 0,
    };

    if (w['@_totalDistance']) {
      const distanceValue = parseFloat(w['@_totalDistance']);
      const distanceUnit = w['@_totalDistanceUnit'] || 'km';
      // Convert to meters based on unit
      if (distanceUnit === 'mi') {
        workout.distance = distanceValue * 1609.34; // Convert miles to meters
      } else {
        workout.distance = distanceValue * 1000; // Assume km, convert to meters
      }
    }

    if (w['@_totalEnergyBurned']) {
      workout.calories = parseFloat(w['@_totalEnergyBurned']);
    }

    // Extract heart rate stats from workout statistics
    if (w.WorkoutStatistics) {
      for (const stat of w.WorkoutStatistics) {
        if (stat['@_type'] === 'HKQuantityTypeIdentifierHeartRate') {
          if (stat['@_average']) {
            workout.avgHeartRate = parseFloat(stat['@_average']);
          }
          if (stat['@_maximum']) {
            workout.maxHeartRate = parseFloat(stat['@_maximum']);
          }
        }
      }
    }

    // Calculate pace for runs
    if (workout.type === 'run' && workout.distance && workout.duration) {
      workout.avgPace = (workout.duration * 60) / (workout.distance / 1000); // seconds per km
    }

    workouts.push(workout);
  }

  // Process health records
  onProgress?.({ stage: 'Processing health records', percent: 60 });

  const sleepMap = new Map<string, SleepRecord>();

  for (const record of records) {
    const date = parseAppleDate(record['@_startDate']);

    // Skip records older than cutoff date
    if (date < cutoffDate) {
      continue;
    }

    filteredRecords++;

    const type = record['@_type'];
    const value = parseFloat(record['@_value'] || '0');

    switch (type) {
      case 'HKQuantityTypeIdentifierBodyMass':
        weightEntries.push({
          id: generateId(),
          source: 'apple_health',
          date,
          weight: value,
        });
        break;

      case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
        hrvReadings.push({
          id: generateId(),
          source: 'apple_health',
          date,
          value,
        });
        break;

      case 'HKQuantityTypeIdentifierRestingHeartRate':
        heartRateReadings.push({
          id: generateId(),
          source: 'apple_health',
          date,
          value,
          context: 'resting',
        });
        break;

      case 'HKQuantityTypeIdentifierVO2Max':
        vo2maxReadings.push({
          id: generateId(),
          source: 'apple_health',
          date,
          value,
        });
        break;

      case 'HKCategoryTypeIdentifierSleepAnalysis':
        // Sleep records need special handling - aggregate by date
        const sleepDateKey = format(date, 'yyyy-MM-dd');
        if (!sleepMap.has(sleepDateKey)) {
          sleepMap.set(sleepDateKey, {
            id: generateId(),
            source: 'apple_health',
            date,
            duration: 0,
          });
        }
        const sleepRecord = sleepMap.get(sleepDateKey)!;
        const endDate = record['@_endDate'] ? parseAppleDate(record['@_endDate']) : date;
        const durationMins = (endDate.getTime() - date.getTime()) / 1000 / 60;

        // Apple uses values like HKCategoryValueSleepAnalysisInBed, HKCategoryValueSleepAnalysisAsleep
        const sleepValue = record['@_value'] || '';
        if (sleepValue.includes('Asleep') || sleepValue.includes('Core') || sleepValue.includes('Deep') || sleepValue.includes('REM')) {
          sleepRecord.duration += durationMins;

          if (sleepValue.includes('Deep')) {
            sleepRecord.deepSleep = (sleepRecord.deepSleep || 0) + durationMins;
          } else if (sleepValue.includes('REM')) {
            sleepRecord.remSleep = (sleepRecord.remSleep || 0) + durationMins;
          } else {
            sleepRecord.lightSleep = (sleepRecord.lightSleep || 0) + durationMins;
          }
        } else if (sleepValue.includes('Awake')) {
          sleepRecord.awake = (sleepRecord.awake || 0) + durationMins;
        }
        break;
    }
  }

  // Convert sleep map to array and calculate efficiency
  for (const sleep of sleepMap.values()) {
    if (sleep.duration > 0) {
      const totalInBed = sleep.duration + (sleep.awake || 0);
      sleep.efficiency = totalInBed > 0 ? (sleep.duration / totalInBed) * 100 : undefined;
      sleepRecords.push(sleep);
    }
  }

  onProgress?.({ stage: 'Complete', percent: 100 });

  return {
    workouts: workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    sleepRecords: sleepRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    weightEntries: weightEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    hrvReadings: hrvReadings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    heartRateReadings,
    vo2maxReadings,
    stats: {
      totalRecords,
      filteredRecords,
      cutoffDate,
    },
  };
}

// Utility to estimate file parsing time
export function estimateParseTime(fileSizeBytes: number): string {
  const mbSize = fileSizeBytes / 1024 / 1024;
  const estimatedSeconds = Math.ceil(mbSize * 2); // ~2 seconds per MB

  if (estimatedSeconds < 60) {
    return `~${estimatedSeconds} seconds`;
  }
  return `~${Math.ceil(estimatedSeconds / 60)} minutes`;
}
