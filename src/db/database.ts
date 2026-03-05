import Dexie, { type EntityTable } from 'dexie';
import type {
  Workout,
  SleepRecord,
  WeightEntry,
  HRVReading,
  HeartRateReading,
  VO2MaxReading,
  PersonalRecord,
  Insight,
  ChatMessage,
} from '@/types';

// Define the database
class HealthDatabase extends Dexie {
  workouts!: EntityTable<Workout, 'id'>;
  sleepRecords!: EntityTable<SleepRecord, 'id'>;
  weightEntries!: EntityTable<WeightEntry, 'id'>;
  hrvReadings!: EntityTable<HRVReading, 'id'>;
  heartRateReadings!: EntityTable<HeartRateReading, 'id'>;
  vo2maxReadings!: EntityTable<VO2MaxReading, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
  insights!: EntityTable<Insight, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;

  constructor() {
    super('HealthInsightsDB');

    this.version(1).stores({
      workouts: 'id, source, type, date, [source+date], [type+date]',
      sleepRecords: 'id, source, date, [source+date]',
      weightEntries: 'id, source, date',
      hrvReadings: 'id, source, date, [source+date]',
      heartRateReadings: 'id, source, date, context',
      vo2maxReadings: 'id, source, date',
      personalRecords: 'id, type, category, date, [type+category]',
      insights: 'id, category, date, severity, dismissed',
      chatMessages: 'id, timestamp',
    });
  }
}

// Create singleton instance
export const db = new HealthDatabase();

// Helper functions for common queries
export async function getWorkoutsInRange(startDate: Date, endDate: Date): Promise<Workout[]> {
  return db.workouts
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getSleepInRange(startDate: Date, endDate: Date): Promise<SleepRecord[]> {
  return db.sleepRecords
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getWeightInRange(startDate: Date, endDate: Date): Promise<WeightEntry[]> {
  return db.weightEntries
    .where('date')
    .between(startDate, endDate, true, true)
    .sortBy('date');
}

export async function getHRVInRange(startDate: Date, endDate: Date): Promise<HRVReading[]> {
  return db.hrvReadings
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getLatestWeight(): Promise<WeightEntry | undefined> {
  const entries = await db.weightEntries.orderBy('date').reverse().limit(1).toArray();
  return entries[0];
}

export async function getLatestHRV(): Promise<HRVReading | undefined> {
  const readings = await db.hrvReadings.orderBy('date').reverse().limit(1).toArray();
  return readings[0];
}

export async function getLatestSleep(): Promise<SleepRecord | undefined> {
  const records = await db.sleepRecords.orderBy('date').reverse().limit(1).toArray();
  return records[0];
}

export async function getPersonalRecords(type?: 'run' | 'lift'): Promise<PersonalRecord[]> {
  if (type) {
    return db.personalRecords.where('type').equals(type).toArray();
  }
  return db.personalRecords.toArray();
}

export async function getRecentInsights(limit = 10): Promise<Insight[]> {
  const insights = await db.insights.toArray();
  return insights
    .filter(i => !i.dismissed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export async function getChatHistory(limit = 50): Promise<ChatMessage[]> {
  return db.chatMessages
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray()
    .then(messages => messages.reverse());
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.workouts.clear(),
    db.sleepRecords.clear(),
    db.weightEntries.clear(),
    db.hrvReadings.clear(),
    db.heartRateReadings.clear(),
    db.vo2maxReadings.clear(),
    db.personalRecords.clear(),
    db.insights.clear(),
    db.chatMessages.clear(),
  ]);
}

export async function clearDataBySource(source: string): Promise<void> {
  await Promise.all([
    db.workouts.where('source').equals(source).delete(),
    db.sleepRecords.where('source').equals(source).delete(),
    db.weightEntries.where('source').equals(source).delete(),
    db.hrvReadings.where('source').equals(source).delete(),
    db.heartRateReadings.where('source').equals(source).delete(),
    db.vo2maxReadings.where('source').equals(source).delete(),
  ]);
}

export async function getDataCounts(): Promise<Record<string, number>> {
  const [workouts, sleep, weight, hrv, insights, chat] = await Promise.all([
    db.workouts.count(),
    db.sleepRecords.count(),
    db.weightEntries.count(),
    db.hrvReadings.count(),
    db.insights.count(),
    db.chatMessages.count(),
  ]);

  return { workouts, sleep, weight, hrv, insights, chat };
}

/**
 * Get ALL workouts for all-time PR calculations
 * Not limited to any date range
 */
export async function getAllWorkouts(): Promise<Workout[]> {
  return db.workouts.toArray();
}

/**
 * Get all workouts of a specific type (for PRs)
 */
export async function getAllWorkoutsByType(type: string): Promise<Workout[]> {
  return db.workouts.where('type').equals(type).toArray();
}

/**
 * Get manual lift PRs
 */
export async function getManualLiftPRs(): Promise<PersonalRecord[]> {
  return db.personalRecords.where('type').equals('lift').toArray();
}

/**
 * Save or update a manual lift PR
 */
export async function saveManualLiftPR(
  exercise: string,
  weight: number,
  reps: number,
  date: Date = new Date()
): Promise<string> {
  const category = exercise.toLowerCase();
  const est1RM = reps === 1 ? weight : weight * (1 + reps / 30);

  // Check if exists
  const existing = await db.personalRecords
    .where('[type+category]')
    .equals(['lift', category])
    .first();

  const id = existing?.id || `manual-lift-${category}-${Date.now()}`;

  await db.personalRecords.put({
    id,
    type: 'lift',
    category,
    value: est1RM, // Store est1RM as value
    date,
    previousValue: existing?.value,
  });

  return id;
}

/**
 * Delete a manual lift PR
 */
export async function deleteManualLiftPR(exercise: string): Promise<void> {
  const category = exercise.toLowerCase();
  await db.personalRecords
    .where('[type+category]')
    .equals(['lift', category])
    .delete();
}
