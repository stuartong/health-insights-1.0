/**
 * Demo Data Generator
 * Creates realistic sample health data for testing and demonstration
 */

import type { Workout, SleepRecord, WeightEntry, HRVReading, Insight, WorkoutType } from '@/types';
import { db } from '@/db/database';
import { subDays, addHours } from 'date-fns';
import { calculateWorkoutTSS } from '@/algorithms/trainingLoad';

function generateId(): string {
  return `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate workouts with realistic patterns
function generateWorkouts(days: number): Workout[] {
  const workouts: Workout[] = [];
  const now = new Date();

  // Typical weekly pattern: 4-6 workouts per week
  for (let d = 0; d < days; d++) {
    const date = subDays(now, d);
    const dayOfWeek = date.getDay();

    // Skip some rest days (typically 1-2 per week)
    if (dayOfWeek === 0 && Math.random() < 0.7) continue; // Sunday often rest
    if (dayOfWeek === 5 && Math.random() < 0.4) continue; // Friday sometimes rest

    // Determine workout type based on day
    let type: WorkoutType;
    let duration: number;
    let distance: number | undefined;
    let avgPace: number | undefined;
    let avgHeartRate: number | undefined;

    if (dayOfWeek === 6) {
      // Saturday - long run
      type = 'run';
      duration = randomBetween(60, 120);
      distance = randomBetween(12000, 22000);
      avgPace = randomBetween(320, 380); // 5:20-6:20/km
      avgHeartRate = randomInt(145, 165);
    } else if (dayOfWeek === 2 || dayOfWeek === 4) {
      // Tuesday/Thursday - strength or intervals
      if (Math.random() < 0.5) {
        type = 'strength';
        duration = randomBetween(45, 75);
        avgHeartRate = randomInt(110, 140);
      } else {
        type = 'run';
        duration = randomBetween(35, 50);
        distance = randomBetween(6000, 10000);
        avgPace = randomBetween(280, 340); // faster - intervals
        avgHeartRate = randomInt(155, 175);
      }
    } else if (dayOfWeek === 1 || dayOfWeek === 3) {
      // Monday/Wednesday - easy run or cross-training
      if (Math.random() < 0.7) {
        type = 'run';
        duration = randomBetween(30, 50);
        distance = randomBetween(5000, 9000);
        avgPace = randomBetween(340, 400); // easy pace
        avgHeartRate = randomInt(130, 150);
      } else {
        type = 'cycle';
        duration = randomBetween(45, 90);
        distance = randomBetween(15000, 35000);
        avgHeartRate = randomInt(120, 145);
      }
    } else {
      // Other days - varied
      type = randomChoice(['run', 'strength', 'cycle', 'walk']);
      duration = randomBetween(30, 60);
      if (type === 'run') {
        distance = randomBetween(4000, 8000);
        avgPace = randomBetween(320, 380);
        avgHeartRate = randomInt(135, 155);
      } else if (type === 'cycle') {
        distance = randomBetween(10000, 25000);
        avgHeartRate = randomInt(115, 140);
      }
    }

    const workout: Workout = {
      id: generateId(),
      source: 'apple_health',
      type,
      name: getWorkoutName(type, duration),
      date: addHours(date, randomInt(6, 19)), // Between 6am and 7pm
      duration,
      distance,
      avgPace,
      avgHeartRate,
      maxHeartRate: avgHeartRate ? avgHeartRate + randomInt(15, 30) : undefined,
      calories: Math.round(duration * randomBetween(8, 12)),
    };

    workout.tss = calculateWorkoutTSS(workout);
    workouts.push(workout);
  }

  return workouts;
}

function getWorkoutName(type: WorkoutType, duration: number): string {
  const names: Record<WorkoutType, string[]> = {
    run: duration > 70 ? ['Long Run', 'Weekend Long Run'] : duration < 40 ? ['Easy Run', 'Recovery Run'] : ['Tempo Run', 'Steady Run', 'Morning Run'],
    cycle: ['Road Ride', 'Indoor Cycling', 'Recovery Ride'],
    swim: ['Pool Swim', 'Open Water Swim'],
    strength: ['Strength Training', 'Gym Session', 'Weight Training'],
    walk: ['Morning Walk', 'Evening Walk'],
    hike: ['Trail Hike', 'Mountain Hike'],
    other: ['Cross Training', 'Mobility Work'],
  };
  return randomChoice(names[type]);
}

// Generate sleep records with realistic patterns
function generateSleepRecords(days: number): SleepRecord[] {
  const records: SleepRecord[] = [];
  const now = new Date();
  let sleepQualityTrend = 75; // Base sleep quality

  for (let d = 0; d < days; d++) {
    const date = subDays(now, d);
    const dayOfWeek = date.getDay();

    // Weekend sleep tends to be longer but sometimes later/worse quality
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Base duration with some variation
    let baseDuration = isWeekend ? randomBetween(420, 540) : randomBetween(360, 480); // 6-9 hours

    // Add some random variation day to day
    const variation = randomBetween(-30, 30);
    const duration = Math.max(300, baseDuration + variation);

    // Calculate sleep stages
    const deepSleep = duration * randomBetween(0.15, 0.25);
    const remSleep = duration * randomBetween(0.2, 0.28);
    const lightSleep = duration - deepSleep - remSleep - randomBetween(10, 30);
    const awake = randomBetween(10, 40);

    // Efficiency
    const totalInBed = duration + awake;
    const efficiency = (duration / totalInBed) * 100;

    // HRV during sleep (tends to be lower when fatigued)
    const hrv = randomBetween(35, 65) + (sleepQualityTrend / 10);

    // Sleep score
    const score = Math.min(100, Math.max(40,
      sleepQualityTrend + randomBetween(-15, 15) + (duration > 420 ? 5 : -5)
    ));

    // Slowly drift sleep quality trend
    sleepQualityTrend = Math.max(50, Math.min(90, sleepQualityTrend + randomBetween(-3, 3)));

    records.push({
      id: generateId(),
      source: 'oura',
      date,
      duration,
      efficiency: Math.round(efficiency),
      deepSleep: Math.round(deepSleep),
      remSleep: Math.round(remSleep),
      lightSleep: Math.round(lightSleep),
      awake: Math.round(awake),
      hrv: Math.round(hrv),
      restingHR: randomInt(48, 58),
      score: Math.round(score),
    });
  }

  return records;
}

// Generate weight entries with realistic trends
function generateWeightEntries(days: number): WeightEntry[] {
  const entries: WeightEntry[] = [];
  const now = new Date();

  // Starting weight and trend
  let weight = randomBetween(72, 82);
  const weeklyChange = randomBetween(-0.3, 0.1); // Slight downward trend

  for (let d = days - 1; d >= 0; d--) {
    const date = subDays(now, d);

    // Daily fluctuation (water, food, etc)
    const dailyFluctuation = randomBetween(-0.8, 0.8);

    // Weekly trend
    weight += weeklyChange / 7;

    // Skip some days (not everyone weighs daily)
    if (Math.random() < 0.3) continue;

    entries.push({
      id: generateId(),
      source: 'apple_health',
      date,
      weight: Math.round((weight + dailyFluctuation) * 10) / 10,
    });
  }

  return entries;
}

// Generate HRV readings
function generateHRVReadings(days: number): HRVReading[] {
  const readings: HRVReading[] = [];
  const now = new Date();
  let baselineHRV = randomBetween(45, 60);

  for (let d = 0; d < days; d++) {
    const date = subDays(now, d);

    // HRV varies based on recovery, stress, etc
    const variation = randomBetween(-10, 10);

    // Slowly drift baseline
    baselineHRV = Math.max(35, Math.min(70, baselineHRV + randomBetween(-1, 1)));

    readings.push({
      id: generateId(),
      source: 'oura',
      date,
      value: Math.round(baselineHRV + variation),
      context: 'morning',
    });
  }

  return readings;
}

// Generate insights
function generateInsights(): Insight[] {
  const insights: Insight[] = [
    {
      id: generateId(),
      date: subDays(new Date(), 1),
      category: 'training',
      title: 'Training Load Optimal',
      description: 'Your ACWR is in the sweet spot at 1.1. Great balance between training and recovery.',
      severity: 'success',
      actionable: 'Continue with planned training this week.',
    },
    {
      id: generateId(),
      date: subDays(new Date(), 2),
      category: 'recovery',
      title: 'HRV Trend Positive',
      description: 'Your HRV has increased 8% over the past week, indicating good recovery.',
      severity: 'success',
    },
    {
      id: generateId(),
      date: subDays(new Date(), 3),
      category: 'correlation',
      title: 'Sleep & Performance Link',
      description: 'Your best runs come after nights with 7.5+ hours of sleep.',
      severity: 'info',
      actionable: 'Prioritize sleep before hard training days.',
    },
    {
      id: generateId(),
      date: subDays(new Date(), 4),
      category: 'weight',
      title: 'Weight Trend Stable',
      description: 'Your weight has been stable for the past 2 weeks, down 0.5kg from last month.',
      severity: 'info',
    },
  ];

  return insights;
}

// Main function to generate all demo data
export async function generateDemoData(days: number = 90): Promise<void> {
  console.log(`Generating ${days} days of demo data...`);

  const workouts = generateWorkouts(days);
  const sleepRecords = generateSleepRecords(days);
  const weightEntries = generateWeightEntries(days);
  const hrvReadings = generateHRVReadings(days);
  const insights = generateInsights();

  // Clear existing data first
  await db.workouts.clear();
  await db.sleepRecords.clear();
  await db.weightEntries.clear();
  await db.hrvReadings.clear();
  await db.insights.clear();

  // Bulk insert
  await db.workouts.bulkAdd(workouts);
  await db.sleepRecords.bulkAdd(sleepRecords);
  await db.weightEntries.bulkAdd(weightEntries);
  await db.hrvReadings.bulkAdd(hrvReadings);
  await db.insights.bulkAdd(insights);

  console.log('Demo data generated:', {
    workouts: workouts.length,
    sleepRecords: sleepRecords.length,
    weightEntries: weightEntries.length,
    hrvReadings: hrvReadings.length,
    insights: insights.length,
  });
}
