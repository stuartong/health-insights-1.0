/**
 * Streaming Apple Health XML Parser
 *
 * Processes large Apple Health export files without loading them entirely into memory.
 * Uses the File API's stream() method to read in chunks and parse line-by-line.
 * Only keeps records from the last N days to minimize memory usage.
 */

import type { Workout, SleepRecord, WeightEntry, HRVReading } from '@/types';

// Default to 90 days of data
const DEFAULT_MAX_DAYS_BACK = 90;

interface ParseProgress {
  stage: string;
  percent: number;
  recordsFound: {
    workouts: number;
    sleep: number;
    weight: number;
    hrv: number;
  };
  bytesProcessed: number;
  totalBytes: number;
}

interface ParseResult {
  workouts: Workout[];
  sleepRecords: SleepRecord[];
  weightEntries: WeightEntry[];
  hrvReadings: HRVReading[];
}

type ProgressCallback = (progress: ParseProgress) => void;

/**
 * Parse Apple Health date format to Date object
 */
function parseAppleDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Apple format: "2024-01-15 08:30:00 -0500" or "2024-01-15 08:30:00 +0000"
  return new Date(dateStr.replace(' ', 'T').replace(' ', ''));
}

/**
 * Map Apple workout types to our simplified types
 */
function mapWorkoutType(appleType: string): Workout['type'] {
  const typeMap: Record<string, Workout['type']> = {
    HKWorkoutActivityTypeRunning: 'run',
    HKWorkoutActivityTypeCycling: 'cycle',
    HKWorkoutActivityTypeSwimming: 'swim',
    HKWorkoutActivityTypeTraditionalStrengthTraining: 'strength',
    HKWorkoutActivityTypeFunctionalStrengthTraining: 'strength',
    HKWorkoutActivityTypeWalking: 'walk',
    HKWorkoutActivityTypeHiking: 'hike',
    HKWorkoutActivityTypeCrossTraining: 'strength',
    HKWorkoutActivityTypeElliptical: 'other',
    HKWorkoutActivityTypeRowing: 'other',
    HKWorkoutActivityTypeYoga: 'other',
  };
  return typeMap[appleType] || 'other';
}

/**
 * Extract attribute value from XML string
 */
function getAttr(xml: string, name: string): string | undefined {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Generate unique ID
 */
let idCounter = 0;
function generateId(): string {
  return `ah_stream_${Date.now()}_${++idCounter}`;
}

/**
 * Stream and parse an Apple Health export.xml file
 *
 * @param file - The File object to parse
 * @param onProgress - Callback for progress updates
 * @param maxDaysBack - Only include records from the last N days (default 90)
 */
export async function parseAppleHealthStream(
  file: File,
  onProgress?: ProgressCallback,
  maxDaysBack: number = DEFAULT_MAX_DAYS_BACK
): Promise<ParseResult> {
  const totalBytes = file.size;
  let bytesProcessed = 0;

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDaysBack);

  // Results containers
  const workouts: Workout[] = [];
  const weightEntries: WeightEntry[] = [];
  const hrvReadings: HRVReading[] = [];
  const sleepMap = new Map<string, SleepRecord>();

  // Stats for skipped records
  let skippedOldRecords = 0;
  let lastProgressUpdate = Date.now();

  // Helper to check if date is within window
  const isWithinWindow = (date: Date) => date >= cutoffDate;

  // Helper to report progress (throttled to avoid too many updates)
  const reportProgress = (stage: string, force = false) => {
    const now = Date.now();
    if (force || now - lastProgressUpdate > 100) { // Update at most every 100ms
      lastProgressUpdate = now;
      onProgress?.({
        stage,
        percent: Math.round((bytesProcessed / totalBytes) * 100),
        recordsFound: {
          workouts: workouts.length,
          sleep: sleepMap.size,
          weight: weightEntries.length,
          hrv: hrvReadings.length,
        },
        bytesProcessed,
        totalBytes,
      });
    }
  };

  // Get readable stream from file
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let lineBuffer = '';

  try {
    reportProgress('Starting to read file...', true);

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true });
      bytesProcessed += value.byteLength;
      buffer += chunk;

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        lineBuffer += line;

        // Check if we have a complete element (ends with /> or contains </)
        if (lineBuffer.includes('/>') || lineBuffer.includes('</')) {
          // Process Workout elements
          if (lineBuffer.includes('<Workout ')) {
            const workoutType = getAttr(lineBuffer, 'workoutActivityType');
            const startDate = getAttr(lineBuffer, 'startDate');

            if (workoutType && startDate) {
              const date = parseAppleDate(startDate);

              if (isWithinWindow(date)) {
                const duration = parseFloat(getAttr(lineBuffer, 'duration') || '0');
                const distance = getAttr(lineBuffer, 'totalDistance');
                const calories = getAttr(lineBuffer, 'totalEnergyBurned');

                workouts.push({
                  id: generateId(),
                  source: 'apple_health',
                  type: mapWorkoutType(workoutType),
                  name: workoutType.replace('HKWorkoutActivityType', ''),
                  date,
                  duration: duration / 60, // Convert seconds to minutes
                  distance: distance ? parseFloat(distance) * 1000 : undefined, // km to meters
                  calories: calories ? parseFloat(calories) : undefined,
                });
              } else {
                skippedOldRecords++;
              }
            }
          }
          // Process Record elements
          else if (lineBuffer.includes('<Record ')) {
            const type = getAttr(lineBuffer, 'type');
            const startDate = getAttr(lineBuffer, 'startDate');
            const value = getAttr(lineBuffer, 'value');

            if (type && startDate) {
              const date = parseAppleDate(startDate);

              // Weight
              if (type === 'HKQuantityTypeIdentifierBodyMass') {
                const weightVal = parseFloat(value || '0');
                if (weightVal > 0 && isWithinWindow(date)) {
                  weightEntries.push({
                    id: generateId(),
                    source: 'apple_health',
                    date,
                    weight: weightVal,
                  });
                } else if (weightVal > 0) {
                  skippedOldRecords++;
                }
              }
              // HRV
              else if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
                const hrvVal = parseFloat(value || '0');
                if (hrvVal > 0 && isWithinWindow(date)) {
                  hrvReadings.push({
                    id: generateId(),
                    source: 'apple_health',
                    date,
                    value: hrvVal,
                  });
                } else if (hrvVal > 0) {
                  skippedOldRecords++;
                }
              }
              // Sleep
              else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
                if (!isWithinWindow(date)) {
                  skippedOldRecords++;
                } else {
                  const sleepValue = getAttr(lineBuffer, 'value');
                  const endDateStr = getAttr(lineBuffer, 'endDate');
                  const endDate = endDateStr ? parseAppleDate(endDateStr) : date;
                  const durationMins = (endDate.getTime() - date.getTime()) / (1000 * 60);

                  // Group by date
                  const sleepDateKey = date.toISOString().split('T')[0];

                  if (!sleepMap.has(sleepDateKey)) {
                    sleepMap.set(sleepDateKey, {
                      id: generateId(),
                      source: 'apple_health',
                      date,
                      duration: 0,
                      efficiency: undefined,
                      deepSleep: undefined,
                      remSleep: undefined,
                      lightSleep: undefined,
                      awake: 0,
                    });
                  }

                  const sleepRecord = sleepMap.get(sleepDateKey)!;

                  // Categorize sleep stages based on value
                  // HKCategoryValueSleepAnalysisAsleepCore, AsleepDeep, AsleepREM, Awake, InBed
                  if (sleepValue?.includes('Awake') || sleepValue?.includes('InBed')) {
                    sleepRecord.awake = (sleepRecord.awake || 0) + durationMins;
                  } else if (sleepValue?.includes('Deep')) {
                    sleepRecord.deepSleep = (sleepRecord.deepSleep || 0) + durationMins;
                    sleepRecord.duration += durationMins;
                  } else if (sleepValue?.includes('REM')) {
                    sleepRecord.remSleep = (sleepRecord.remSleep || 0) + durationMins;
                    sleepRecord.duration += durationMins;
                  } else if (sleepValue?.includes('Core') || sleepValue?.includes('Asleep')) {
                    sleepRecord.lightSleep = (sleepRecord.lightSleep || 0) + durationMins;
                    sleepRecord.duration += durationMins;
                  } else {
                    // Generic sleep
                    sleepRecord.duration += durationMins;
                  }
                }
              }
            }
          }

          // Clear line buffer after processing
          lineBuffer = '';
        }

        // Report progress
        reportProgress(`Processing... ${Math.round((bytesProcessed / totalBytes) * 100)}%`);
      }
    }

    // Process any remaining buffer
    if (buffer.length > 0) {
      lineBuffer += buffer;
      // Process final line buffer if it contains useful data
      // (Same logic as above, but typically the file ends cleanly)
    }

    reportProgress('Finalizing...', true);

    // Finalize sleep records - calculate efficiency
    const sleepRecords: SleepRecord[] = [];
    for (const sleep of sleepMap.values()) {
      if (sleep.duration > 0) {
        const totalInBed = sleep.duration + (sleep.awake || 0);
        sleep.efficiency = totalInBed > 0 ? (sleep.duration / totalInBed) * 100 : undefined;
        sleepRecords.push(sleep);
      }
    }

    // Sort all results by date (newest first)
    const sortByDate = <T extends { date: Date }>(a: T, b: T) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();

    console.log(`Streaming parse complete. Skipped ${skippedOldRecords} records older than ${maxDaysBack} days.`);
    console.log(`Kept: ${workouts.length} workouts, ${sleepRecords.length} sleep, ${weightEntries.length} weight, ${hrvReadings.length} HRV`);

    reportProgress('Complete!', true);

    return {
      workouts: workouts.sort(sortByDate),
      sleepRecords: sleepRecords.sort(sortByDate),
      weightEntries: weightEntries.sort(sortByDate),
      hrvReadings: hrvReadings.sort(sortByDate),
    };

  } finally {
    reader.releaseLock();
  }
}

/**
 * Estimate parse time based on file size
 * Streaming is slower than loading into memory, but handles any size
 */
export function estimateStreamParseTime(fileSize: number): string {
  // Rough estimate: ~50MB/second on modern hardware
  const seconds = fileSize / (50 * 1024 * 1024);

  if (seconds < 60) {
    return `~${Math.max(1, Math.round(seconds))} seconds`;
  } else if (seconds < 3600) {
    return `~${Math.round(seconds / 60)} minutes`;
  } else {
    return `~${(seconds / 3600).toFixed(1)} hours`;
  }
}
