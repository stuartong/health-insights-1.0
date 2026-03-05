import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Workout,
  SleepRecord,
  WeightEntry,
  HRVReading,
  TrainingLoadMetrics,
  PersonalRecord,
  Insight,
  DailyLoad,
} from '@/types';
import { db } from '@/db/database';
import { subDays, startOfDay, format } from 'date-fns';
import { calculateACWR, calculateRiskZone, calculateTrend } from '@/algorithms/acwr';
import { exponentialSmoothing } from '@/algorithms/exponentialSmoothing';

interface HealthState {
  // Loading states
  isLoading: boolean;
  loadingMessage: string;

  // Cached data for quick access (recent data)
  recentWorkouts: Workout[];
  recentSleep: SleepRecord[];
  recentWeight: WeightEntry[];
  recentHRV: HRVReading[];
  personalRecords: PersonalRecord[];
  insights: Insight[];

  // Computed metrics
  trainingLoad: TrainingLoadMetrics | null;
  weightTrend: {
    current: number;
    smoothed: number;
    weekChange: number;
    monthChange: number;
    trendDirection: 'up' | 'down' | 'stable';
  } | null;

  // Data availability flags
  hasAppleHealthData: boolean;
  hasOuraData: boolean;
  hasStravaData: boolean;

  // Actions
  setLoading: (loading: boolean, message?: string) => void;
  refreshData: () => Promise<void>;
  addWorkout: (workout: Workout) => Promise<void>;
  addWorkouts: (workouts: Workout[]) => Promise<void>;
  addSleepRecord: (record: SleepRecord) => Promise<void>;
  addSleepRecords: (records: SleepRecord[]) => Promise<void>;
  addWeightEntry: (entry: WeightEntry) => Promise<void>;
  addWeightEntries: (entries: WeightEntry[]) => Promise<void>;
  addHRVReading: (reading: HRVReading) => Promise<void>;
  addHRVReadings: (readings: HRVReading[]) => Promise<void>;
  addInsight: (insight: Insight) => Promise<void>;
  dismissInsight: (id: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  clearDataBySource: (source: string) => Promise<void>;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isLoading: false,
      loadingMessage: '',
      recentWorkouts: [],
      recentSleep: [],
      recentWeight: [],
      recentHRV: [],
      personalRecords: [],
      insights: [],
      trainingLoad: null,
      weightTrend: null,
      hasAppleHealthData: false,
      hasOuraData: false,
      hasStravaData: false,

      setLoading: (loading, message = '') => {
        set({ isLoading: loading, loadingMessage: message });
      },

      refreshData: async () => {
        const ninetyDaysAgo = subDays(new Date(), 90);
        const today = new Date();

        try {
          // Fetch recent data from IndexedDB - use 90 days to match Strava import window
          const [workouts, sleep, weight, hrv, records, recentInsights] = await Promise.all([
            db.workouts.where('date').above(ninetyDaysAgo).toArray(),
            db.sleepRecords.where('date').above(ninetyDaysAgo).toArray(),
            db.weightEntries.where('date').above(ninetyDaysAgo).sortBy('date'),
            db.hrvReadings.where('date').above(ninetyDaysAgo).toArray(),
            db.personalRecords.toArray(),
            db.insights.toArray().then(all => all.filter(i => !i.dismissed)),
          ]);

          // Check data sources
          const hasAppleHealth = workouts.some(w => w.source === 'apple_health') ||
            sleep.some(s => s.source === 'apple_health') ||
            weight.some(w => w.source === 'apple_health');
          const hasOura = sleep.some(s => s.source === 'oura') ||
            hrv.some(h => h.source === 'oura');
          const hasStrava = workouts.some(w => w.source === 'strava');

          // Calculate training load metrics
          let trainingLoad: TrainingLoadMetrics | null = null;
          if (workouts.length > 0) {
            // Get daily loads for the past 28 days
            const dailyLoads: DailyLoad[] = [];
            for (let i = 0; i < 28; i++) {
              const date = startOfDay(subDays(today, i));
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayWorkouts = workouts.filter(
                w => format(new Date(w.date), 'yyyy-MM-dd') === dateStr
              );

              dailyLoads.unshift({
                date,
                tss: dayWorkouts.reduce((sum, w) => sum + (w.tss || w.duration * 0.5), 0),
                duration: dayWorkouts.reduce((sum, w) => sum + w.duration, 0),
                workoutCount: dayWorkouts.length,
                types: [...new Set(dayWorkouts.map(w => w.type))],
              });
            }

            const tssValues = dailyLoads.map(d => d.tss);
            const acwr = calculateACWR(tssValues);
            const riskZone = calculateRiskZone(acwr);
            const trend = calculateTrend(tssValues);

            trainingLoad = {
              acuteLoad: tssValues.slice(-7).reduce((a, b) => a + b, 0),
              chronicLoad: tssValues.reduce((a, b) => a + b, 0) / 28,
              acwr,
              riskZone,
              trend,
              fatigueLevel: Math.min(100, acwr * 50),
              fitnessLevel: Math.min(100, (tssValues.reduce((a, b) => a + b, 0) / 28) * 2),
              formLevel: 0,
            };
            trainingLoad.formLevel = trainingLoad.fitnessLevel - trainingLoad.fatigueLevel;
          }

          // Calculate weight trend
          let weightTrend = null;
          if (weight.length > 0) {
            const weights = weight.map(w => w.weight);
            const smoothed = exponentialSmoothing(weights, 0.1);
            const current = weights[weights.length - 1];
            const smoothedCurrent = smoothed[smoothed.length - 1];

            // Week change
            const weekAgo = weight.filter(
              w => new Date(w.date) <= subDays(today, 7)
            );
            const weekAgoWeight = weekAgo.length > 0 ? weekAgo[weekAgo.length - 1].weight : current;

            // Month change
            const monthAgo = weight.filter(
              w => new Date(w.date) <= subDays(today, 30)
            );
            const monthAgoWeight = monthAgo.length > 0 ? monthAgo[monthAgo.length - 1].weight : current;

            const weekChange = current - weekAgoWeight;
            const monthChange = current - monthAgoWeight;

            weightTrend = {
              current,
              smoothed: smoothedCurrent,
              weekChange,
              monthChange,
              trendDirection: (weekChange > 0.2 ? 'up' : weekChange < -0.2 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
            };
          }

          // Filter out aggregate/summary activities (Move Total, etc.)
          const filteredWorkouts = workouts.filter(w => {
            const name = (w.name || '').toLowerCase();
            // Exclude Apple Health aggregate activities
            if (name.includes('move total') || name.includes('exercise total') || name.includes('stand total')) {
              return false;
            }
            return true;
          });

          // Deduplicate workouts - same workout can appear from multiple sources
          // Group by DAY only (not type) - the same workout might have different types across sources
          const workoutsByDay = new Map<string, Workout[]>();

          for (const w of filteredWorkouts) {
            const key = format(new Date(w.date), 'yyyy-MM-dd');
            if (!workoutsByDay.has(key)) {
              workoutsByDay.set(key, []);
            }
            workoutsByDay.get(key)!.push(w);
          }

          const dedupedWorkouts: Workout[] = [];
          for (const group of workoutsByDay.values()) {
            // Sort: Strava first, then by distance/duration descending
            group.sort((a, b) => {
              if (a.source === 'strava' && b.source !== 'strava') return -1;
              if (b.source === 'strava' && a.source !== 'strava') return 1;
              // Sort by distance if available, otherwise by duration
              if (a.distance || b.distance) {
                return (b.distance || 0) - (a.distance || 0);
              }
              return (b.duration || 0) - (a.duration || 0);
            });

            // Keep workouts that are significantly different
            // Compare by duration AND distance to catch duplicates across different workout types
            // Use more lenient thresholds since Apple Health and Strava can measure differently
            const kept: Workout[] = [];
            for (const w of group) {
              const isDuplicate = kept.some(k => {
                // Same type gets stricter comparison (likely same activity)
                const sameType = k.type === w.type;
                // Different sources with same type = very likely duplicate
                const crossSource = k.source !== w.source && sameType;

                // Thresholds: 30% for same type cross-source, 25% otherwise
                const durationThreshold = crossSource ? 0.35 : 0.25;
                const distanceThreshold = crossSource ? 0.35 : 0.25;

                // Check if durations are similar
                const durationDiff = Math.abs(k.duration - w.duration) / Math.max(k.duration, w.duration, 1);
                const similarDuration = durationDiff < durationThreshold;

                // If both have distance, also check distance
                if (k.distance && w.distance) {
                  const distDiff = Math.abs(k.distance - w.distance) / Math.max(k.distance, w.distance);
                  const similarDistance = distDiff < distanceThreshold;
                  // Duplicate if both duration AND distance are similar
                  return similarDuration && similarDistance;
                }

                // For non-distance workouts (strength, etc.), just check duration
                // But be more lenient for same-type workouts
                return similarDuration;
              });
              if (!isDuplicate) {
                kept.push(w);
              }
            }
            dedupedWorkouts.push(...kept);
          }

          // Deduplicate sleep records by date - keep the LONGEST sleep per day
          // Oura can return multiple sleep sessions (main sleep + naps)
          const sleepMap = new Map<string, SleepRecord>();
          for (const s of sleep) {
            const key = format(new Date(s.date), 'yyyy-MM-dd');
            const existing = sleepMap.get(key);
            if (!existing) {
              sleepMap.set(key, s);
            } else {
              // Keep the longer duration sleep (main sleep vs nap)
              // If durations are similar (within 10%), prefer Oura over Apple Health
              const durationDiff = Math.abs(s.duration - existing.duration);
              const maxDuration = Math.max(s.duration, existing.duration);
              const similarDuration = durationDiff / maxDuration < 0.1;

              if (s.duration > existing.duration) {
                // New record has longer sleep - use it
                sleepMap.set(key, s);
              } else if (similarDuration && s.source === 'oura' && existing.source !== 'oura') {
                // Similar duration, prefer Oura
                sleepMap.set(key, s);
              }
            }
          }
          const dedupedSleep = Array.from(sleepMap.values());

          // Deduplicate HRV readings - use ONLY one source to prevent mixing baselines
          // Oura and Apple Health HRV have different measurement methods and baselines
          const ouraHRV = hrv.filter(h => h.source === 'oura');
          const hasOuraHRV = ouraHRV.length > 0;

          // Also check sleep records for embedded Oura HRV
          const ouraSleepHRV = dedupedSleep.filter(s => s.source === 'oura' && s.hrv);
          const hasOuraSleepHRV = ouraSleepHRV.length > 0;

          // Use single source: Oura if available, otherwise Apple Health
          const hrvSource = hasOuraHRV || hasOuraSleepHRV ? ouraHRV : hrv.filter(h => h.source === 'apple_health');

          // Deduplicate by date within the chosen source
          const hrvMap = new Map<string, HRVReading>();
          for (const h of hrvSource) {
            const key = format(new Date(h.date), 'yyyy-MM-dd');
            if (!hrvMap.has(key)) {
              hrvMap.set(key, h);
            }
          }
          const dedupedHRV = Array.from(hrvMap.values());

          set({
            recentWorkouts: dedupedWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            recentSleep: dedupedSleep.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            recentWeight: weight,
            recentHRV: dedupedHRV.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            personalRecords: records,
            insights: recentInsights.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            trainingLoad,
            weightTrend,
            hasAppleHealthData: hasAppleHealth,
            hasOuraData: hasOura,
            hasStravaData: hasStrava,
          });
        } catch (error) {
          console.error('Error refreshing health data:', error);
        }
      },

      addWorkout: async (workout) => {
        await db.workouts.put(workout);
        await get().refreshData();
      },

      addWorkouts: async (workouts) => {
        await db.workouts.bulkPut(workouts);
        await get().refreshData();
      },

      addSleepRecord: async (record) => {
        await db.sleepRecords.put(record);
        await get().refreshData();
      },

      addSleepRecords: async (records) => {
        await db.sleepRecords.bulkPut(records);
        await get().refreshData();
      },

      addWeightEntry: async (entry) => {
        await db.weightEntries.put(entry);
        await get().refreshData();
      },

      addWeightEntries: async (entries) => {
        await db.weightEntries.bulkPut(entries);
        await get().refreshData();
      },

      addHRVReading: async (reading) => {
        await db.hrvReadings.put(reading);
        await get().refreshData();
      },

      addHRVReadings: async (readings) => {
        await db.hrvReadings.bulkPut(readings);
        await get().refreshData();
      },

      addInsight: async (insight) => {
        await db.insights.put(insight);
        const allInsights = await db.insights.toArray();
        const insights = allInsights.filter(i => !i.dismissed);
        set({ insights: insights.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
      },

      dismissInsight: async (id) => {
        await db.insights.update(id, { dismissed: true });
        const allInsights = await db.insights.toArray();
        const insights = allInsights.filter(i => !i.dismissed);
        set({ insights: insights.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
      },

      clearAllData: async () => {
        await db.workouts.clear();
        await db.sleepRecords.clear();
        await db.weightEntries.clear();
        await db.hrvReadings.clear();
        await db.heartRateReadings.clear();
        await db.vo2maxReadings.clear();
        await db.personalRecords.clear();
        await db.insights.clear();

        set({
          recentWorkouts: [],
          recentSleep: [],
          recentWeight: [],
          recentHRV: [],
          personalRecords: [],
          insights: [],
          trainingLoad: null,
          weightTrend: null,
          hasAppleHealthData: false,
          hasOuraData: false,
          hasStravaData: false,
        });
      },

      clearDataBySource: async (source) => {
        await Promise.all([
          db.workouts.where('source').equals(source).delete(),
          db.sleepRecords.where('source').equals(source).delete(),
          db.weightEntries.where('source').equals(source).delete(),
          db.hrvReadings.where('source').equals(source).delete(),
          db.heartRateReadings.where('source').equals(source).delete(),
          db.vo2maxReadings.where('source').equals(source).delete(),
        ]);
        await get().refreshData();
      },
    }),
    {
      name: 'health-store',
      partialize: (state) => ({
        hasAppleHealthData: state.hasAppleHealthData,
        hasOuraData: state.hasOuraData,
        hasStravaData: state.hasStravaData,
      }),
    }
  )
);
