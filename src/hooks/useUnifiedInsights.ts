import { useMemo, useState, useEffect } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getAllWorkouts, getManualLiftPRs } from '@/db/database';
import { format, subDays, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import type { TodayRecommendation } from '@/components/unified/TodayCoachingCard';
import type { QuickStats } from '@/components/unified/QuickHealthSnapshot';
import type { Insight } from '@/components/unified/InsightCard';
import type { RunningCritique } from '@/components/unified/RunningCritiqueSummary';
import type { LiftingCritique, LiftBenchmark } from '@/components/unified/LiftingCritiqueSummary';
import type { WeeklySummaryData } from '@/components/unified/WeeklySummary';
import type { Workout, PersonalRecord } from '@/types';

interface RunCategoryBreakdown {
  category: string;
  count: number;
  totalKm: number;
  avgPace: number; // seconds per km
  color: string;
}

interface RunningStats {
  gradeBreakdown: { category: string; grade: string }[];
  volumeStatus: 'good' | 'caution' | 'warning';
  weeklyVolume: { week: string; km: number }[];
  volumeInsights: { good: string[]; improve: string[] };
  volumeRecommendation: string;
  // HR zones as primary intensity metric
  hrStatus: 'good' | 'caution' | 'warning';
  hrZones: { zone: string; hrRange: string; percent: number; color: string }[];
  hrInsights: string[];
  hrRecommendation: string;
  maxHR: number;
  // Run categories from descriptions
  runCategories: RunCategoryBreakdown[];
  categoryInsights: string[];
  trainingBalance: 'good' | 'caution' | 'warning';
  // Recovery
  recoveryStatus: 'good' | 'caution' | 'warning';
  sleepVsPace: { sleep: number; pace: number }[];
  recoveryIssues: { underslept: number; lowHrv: number; backToBack: number };
  recoveryRecommendation: string;
  injuryRisk: {
    level: 'good' | 'caution' | 'warning';
    factors: { text: string; status: 'good' | 'caution' | 'warning' }[];
  };
  injuryRecommendation: string;
}

export function useUnifiedInsights() {
  const {
    recentWorkouts: storeWorkouts,
    recentSleep,
    recentWeight,
    recentHRV,
    trainingLoad,
    isLoading,
  } = useHealthStore();

  const { apiKeys, settings } = useSettingsStore();
  // Use custom HR zones if enabled, otherwise use Strava zones
  const stravaHRZones = settings.useCustomHRZones && settings.customHRZones?.length
    ? settings.customHRZones
    : apiKeys.stravaHRZones;
  const excludedTypes = settings.excludedWorkoutTypes || [];

  // Fetch ALL workouts for PR calculations (strength benchmarks should use all-time data)
  const [allHistoricalWorkouts, setAllHistoricalWorkouts] = useState<Workout[]>([]);
  const [manualLiftPRs, setManualLiftPRs] = useState<PersonalRecord[]>([]);

  useEffect(() => {
    getAllWorkouts().then(setAllHistoricalWorkouts).catch(console.error);
    getManualLiftPRs().then(setManualLiftPRs).catch(console.error);
  }, [storeWorkouts]); // Re-fetch when store workouts change

  // Filter out excluded workout types
  const recentWorkouts = useMemo(() => {
    return storeWorkouts.filter(w => !excludedTypes.includes(w.type));
  }, [storeWorkouts, excludedTypes]);

  // Alias for consistency
  const weightEntries = recentWeight;
  const hrvReadings = recentHRV;
  const trainingLoadMetrics = trainingLoad;
  const dailyLoads = recentWorkouts.map(w => ({ date: w.date, tss: w.tss || 0 }));

  const todayRecommendation = useMemo((): TodayRecommendation | null => {
    if (recentWorkouts.length === 0 && recentSleep.length === 0) {
      return null;
    }

    const lastSleep = recentSleep[0];
    const acwr = trainingLoadMetrics?.acwr || 1;
    const sleepHours = lastSleep ? lastSleep.duration / 60 : 7;

    // === HRV Analysis ===
    // IMPORTANT: Don't mix HRV sources - Oura and Apple Health have different baselines
    // Check if we have Oura HRV data - if so, use ONLY Oura data
    const ouraHRVReadings = hrvReadings.filter(h => h.source === 'oura');
    const hasOuraHRV = ouraHRVReadings.length >= 3; // Need at least 3 days for meaningful comparison

    // Also check sleep records for Oura data (HRV is often embedded in sleep)
    const ouraSleepRecords = recentSleep.filter(s => s.source === 'oura' && s.hrv);
    const hasOuraSleepHRV = ouraSleepRecords.length >= 3;

    // Use Oura-only data if available, otherwise fall back to Apple Health
    const hrvSourceReadings = (hasOuraHRV || hasOuraSleepHRV)
      ? ouraHRVReadings
      : hrvReadings.filter(h => h.source === 'apple_health');

    // Get last HRV from preferred source
    const lastHRV = hasOuraSleepHRV
      ? ouraSleepRecords[0]?.hrv
      : (hasOuraHRV ? ouraHRVReadings[0]?.value : (lastSleep?.hrv || hrvReadings[0]?.value || null));

    // Calculate average from same source
    const recentHRVValues = hasOuraSleepHRV
      ? ouraSleepRecords.slice(0, 14).map(s => s.hrv).filter((v): v is number => v != null)
      : hrvSourceReadings.slice(0, 14).map(h => h.value);

    const avgHRV = recentHRVValues.length > 0
      ? recentHRVValues.reduce((sum, v) => sum + v, 0) / recentHRVValues.length
      : null;

    // HRV trend: compare last 3 days to previous 7 days (from same source)
    const last3DaysHRV = hasOuraSleepHRV
      ? ouraSleepRecords.slice(0, 3).map(s => s.hrv).filter((v): v is number => v != null)
      : hrvSourceReadings.slice(0, 3).map(h => h.value);
    const prev7DaysHRV = hasOuraSleepHRV
      ? ouraSleepRecords.slice(3, 10).map(s => s.hrv).filter((v): v is number => v != null)
      : hrvSourceReadings.slice(3, 10).map(h => h.value);

    const avg3Day = last3DaysHRV.length > 0 ? last3DaysHRV.reduce((s, v) => s + v, 0) / last3DaysHRV.length : null;
    const avg7Day = prev7DaysHRV.length > 0 ? prev7DaysHRV.reduce((s, v) => s + v, 0) / prev7DaysHRV.length : null;

    let hrvStatus: 'good' | 'caution' | 'warning' | 'unknown' = 'unknown';
    let hrvTrendPercent = 0;
    if (lastHRV && avgHRV) {
      const hrvDeviation = (lastHRV - avgHRV) / avgHRV;
      if (hrvDeviation >= 0.05) hrvStatus = 'good'; // 5%+ above baseline
      else if (hrvDeviation >= -0.10) hrvStatus = 'caution'; // within 10% below
      else hrvStatus = 'warning'; // >10% below baseline
    }
    if (avg3Day && avg7Day) {
      hrvTrendPercent = ((avg3Day - avg7Day) / avg7Day) * 100;
    }

    // === Resting HR Analysis ===
    // Also use same source as HRV for consistency
    const rhrSourceSleep = hasOuraSleepHRV ? ouraSleepRecords : recentSleep;
    const lastRHR = rhrSourceSleep[0]?.restingHR || null;
    const recentRHRValues = rhrSourceSleep.slice(0, 14)
      .map(s => s.restingHR)
      .filter((v): v is number => v !== undefined && v !== null);
    const avgRHR = recentRHRValues.length > 0
      ? recentRHRValues.reduce((sum, v) => sum + v, 0) / recentRHRValues.length
      : null;

    // RHR trend: compare last 3 days to previous 7 days
    const last3DaysRHR = rhrSourceSleep.slice(0, 3).map(s => s.restingHR).filter((v): v is number => v != null);
    const prev7DaysRHR = rhrSourceSleep.slice(3, 10).map(s => s.restingHR).filter((v): v is number => v != null);
    const avgRHR3Day = last3DaysRHR.length > 0 ? last3DaysRHR.reduce((s, v) => s + v, 0) / last3DaysRHR.length : null;
    const avgRHR7Day = prev7DaysRHR.length > 0 ? prev7DaysRHR.reduce((s, v) => s + v, 0) / prev7DaysRHR.length : null;

    let rhrStatus: 'good' | 'caution' | 'warning' | 'unknown' = 'unknown';
    let rhrTrendBPM = 0;
    if (lastRHR && avgRHR) {
      const rhrDeviation = lastRHR - avgRHR;
      if (rhrDeviation <= -2) rhrStatus = 'good'; // 2+ bpm below baseline (well recovered)
      else if (rhrDeviation <= 3) rhrStatus = 'caution'; // within 3 bpm above
      else rhrStatus = 'warning'; // >3 bpm above baseline (stressed/fatigued)
    }
    if (avgRHR3Day && avgRHR7Day) {
      rhrTrendBPM = avgRHR3Day - avgRHR7Day;
    }

    // === Combined Recovery Score ===
    // Weight factors: HRV trend is most predictive, then RHR, then sleep
    let recoveryScore = 50; // Baseline neutral
    const recoveryFactors: string[] = [];

    // Sleep contribution (0-25 points)
    if (sleepHours >= 8) { recoveryScore += 25; recoveryFactors.push(`excellent sleep (${sleepHours.toFixed(1)}hrs)`); }
    else if (sleepHours >= 7) { recoveryScore += 15; recoveryFactors.push(`good sleep (${sleepHours.toFixed(1)}hrs)`); }
    else if (sleepHours >= 6) { recoveryScore += 5; }
    else { recoveryScore -= 15; recoveryFactors.push(`poor sleep (${sleepHours.toFixed(1)}hrs)`); }

    // HRV contribution (0-30 points) - most important
    if (hrvStatus === 'good') { recoveryScore += 30; recoveryFactors.push('HRV above baseline'); }
    else if (hrvStatus === 'caution') { recoveryScore += 10; }
    else if (hrvStatus === 'warning') { recoveryScore -= 20; recoveryFactors.push(`HRV ${Math.round((lastHRV! - avgHRV!) / avgHRV! * 100)}% below baseline`); }

    // HRV trend contribution
    if (hrvTrendPercent > 5) { recoveryScore += 10; recoveryFactors.push('HRV trending up'); }
    else if (hrvTrendPercent < -10) { recoveryScore -= 10; recoveryFactors.push('HRV trending down'); }

    // RHR contribution (0-20 points)
    if (rhrStatus === 'good') { recoveryScore += 20; recoveryFactors.push(`RHR low (${lastRHR} bpm)`); }
    else if (rhrStatus === 'caution') { recoveryScore += 5; }
    else if (rhrStatus === 'warning') { recoveryScore -= 15; recoveryFactors.push(`RHR elevated (+${Math.round(lastRHR! - avgRHR!)} bpm)`); }

    // RHR trend contribution
    if (rhrTrendBPM < -2) { recoveryScore += 5; }
    else if (rhrTrendBPM > 3) { recoveryScore -= 10; recoveryFactors.push('RHR trending up'); }

    // ACWR contribution
    if (acwr > 1.5) { recoveryScore -= 25; recoveryFactors.push(`ACWR danger zone (${acwr.toFixed(2)})`); }
    else if (acwr > 1.3) { recoveryScore -= 10; recoveryFactors.push(`elevated training load`); }
    else if (acwr < 0.8) { recoveryScore += 5; }

    // Clamp score
    recoveryScore = Math.max(0, Math.min(100, recoveryScore));

    // Determine recommendation based on multiple factors
    let status: 'good' | 'caution' | 'warning' = 'good';
    let title = 'Ready for a Moderate Workout';
    let subtitle = '';
    let reasoning = '';
    const doList: string[] = [];
    const avoidList: string[] = [];

    // Analyze workout patterns to determine training style
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run');
    const strengthWorkouts = recentWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    );

    // More inclusive detection: user "does both" if they have any of each type
    const doesLifting = strengthWorkouts.length >= 1;
    const doesRunning = runWorkouts.length >= 1;
    const doesBoth = doesLifting && doesRunning;

    // Build recovery summary for reasoning
    const buildRecoverySummary = (): string => {
      const parts: string[] = [];
      parts.push(`Sleep: ${sleepHours.toFixed(1)}hrs`);
      if (lastHRV && avgHRV) {
        const diff = Math.round((lastHRV - avgHRV) / avgHRV * 100);
        parts.push(`HRV: ${lastHRV}ms (${diff >= 0 ? '+' : ''}${diff}% vs avg)`);
      }
      if (lastRHR && avgRHR) {
        const diff = Math.round(lastRHR - avgRHR);
        parts.push(`RHR: ${lastRHR}bpm (${diff >= 0 ? '+' : ''}${diff} vs avg)`);
      }
      parts.push(`ACWR: ${acwr.toFixed(2)}`);
      return parts.join(' | ');
    };

    // === Decision Logic Using Recovery Score ===

    // Critical warning conditions (override everything)
    if (acwr > 1.5) {
      status = 'warning';
      title = 'Rest Day Recommended';
      subtitle = 'Training load spike detected';
      reasoning = `${buildRecoverySummary()}. ACWR is in the danger zone (>1.5), significantly increasing injury risk.`;
      doList.push('Complete rest or very light walking');
      doList.push('Focus on sleep and nutrition');
      doList.push('Light mobility work or foam rolling');
      avoidList.push('Any running or high-intensity cardio');
      avoidList.push('Heavy lifting - CNS needs recovery');
    }
    // Poor recovery markers
    else if (recoveryScore < 30) {
      status = 'warning';
      title = 'Recovery Day Needed';
      subtitle = recoveryFactors.slice(0, 2).join(' + ');
      reasoning = `${buildRecoverySummary()}. Multiple recovery markers indicate your body needs rest.`;
      doList.push('Light yoga or stretching');
      doList.push('20-30 minute easy walk');
      doList.push('Focus on nutrition and hydration');
      avoidList.push('Any intense training');
      avoidList.push('Heavy lifting or hard cardio');
    }
    // Moderate recovery - easy day
    else if (recoveryScore < 50) {
      status = 'caution';
      title = 'Easy Day Only';
      subtitle = recoveryFactors.slice(0, 2).join(' + ') || 'Recovery not optimal';
      reasoning = `${buildRecoverySummary()}. Recovery markers suggest keeping intensity low.`;
      if (doesBoth) {
        doList.push('Easy Zone 2 run or light accessory work');
        doList.push('Reduce intensity by 15-20%');
        avoidList.push('Heavy compounds, intervals, or tempo work');
      } else if (doesLifting) {
        doList.push('Light accessory work or technique practice');
        doList.push('Reduce working weights by 15-20%');
        avoidList.push('Heavy compound lifts or training to failure');
      } else {
        doList.push('Easy run under 30 minutes in Zone 2');
        avoidList.push('Intervals, tempo, or long runs');
      }
    }
    // Good recovery - normal training
    else if (recoveryScore < 70) {
      status = 'good';
      title = 'Ready for Normal Training';
      subtitle = 'Adequately recovered';
      reasoning = `${buildRecoverySummary()}. Recovery is adequate for your planned training.`;
      if (doesBoth) {
        doList.push('Normal lifting session or moderate run');
        doList.push('Stick to your planned workout');
        avoidList.push('Adding extra volume beyond your plan');
      } else if (doesLifting) {
        doList.push('Normal lifting session at working weights');
        doList.push('Follow your program as planned');
        avoidList.push('Spontaneous PR attempts');
      } else {
        doList.push('Moderate run as planned');
        doList.push('Tempo or steady-state work is fine');
        avoidList.push('Spontaneous race efforts');
      }
    }
    // Excellent recovery - push it
    else {
      status = 'good';
      title = 'Great Day for Quality Work';
      subtitle = 'Excellent recovery';
      reasoning = `${buildRecoverySummary()}. All recovery markers are positive - you're primed for a strong session.`;

      // Check if undertrained and can build
      if (acwr < 0.8) {
        title = 'Time to Build Volume';
        subtitle = 'Well recovered, training load low';
        reasoning = `${buildRecoverySummary()}. Great recovery with low recent training - ideal time to add volume.`;
        if (doesBoth) {
          doList.push('Add an extra session this week (run or lift)');
          doList.push('Increase lifting volume: add sets or weight');
          doList.push('Increase run duration by 10%');
          avoidList.push('Jumping straight to 1RM or race-pace efforts');
        } else if (doesLifting) {
          doList.push('Add an extra lifting session this week');
          doList.push('Increase sets or add accessory work');
          doList.push('Try adding 5% to your working weights');
          avoidList.push('Jumping straight to 1RM attempts');
        } else {
          doList.push('Add an extra easy run this week');
          doList.push('Consider increasing run duration by 10%');
          avoidList.push('Jumping straight to high intensity');
        }
      } else if (doesBoth) {
        doList.push('Heavy lifting: push for PRs on compounds');
        doList.push('Quality run: intervals, tempo, or long run');
        doList.push('This is a good day to test yourself');
        avoidList.push('Wasting this recovery on an easy day');
      } else if (doesLifting) {
        doList.push('Heavy compound lifts at full intensity');
        doList.push('Push for rep PRs or add weight');
        doList.push('Great day to test a new max');
        avoidList.push('Skipping your planned session');
      } else {
        doList.push('Tempo run or intervals');
        doList.push('Long run if scheduled');
        doList.push('Strength training');
        avoidList.push('Skipping your planned workout');
      }
    }

    return { title, subtitle, reasoning, doList, avoidList, status };
  }, [recentWorkouts, recentSleep, hrvReadings, trainingLoadMetrics]);

  const quickStats = useMemo((): QuickStats => {
    // Sleep
    const lastSleep = recentSleep[0];
    const prevSleep = recentSleep[1];
    const sleepTrend = lastSleep && prevSleep
      ? lastSleep.duration > prevSleep.duration ? 'up' : lastSleep.duration < prevSleep.duration ? 'down' : 'stable'
      : 'stable';

    // HRV - Use Oura-only data if available (matching todayRecommendation logic)
    const ouraHRVReadings = hrvReadings.filter(h => h.source === 'oura');
    const ouraSleepWithHRV = recentSleep.filter(s => s.source === 'oura' && s.hrv);
    const hasOuraHRV = ouraHRVReadings.length >= 3 || ouraSleepWithHRV.length >= 3;

    // Prefer Oura sleep HRV, then Oura HRV readings, then any HRV
    let hrvSource: 'oura' | 'apple_health' | undefined;
    let lastHRVValue: number | null = null;
    let hrvSparklineData: number[] = [];

    if (ouraSleepWithHRV.length > 0) {
      hrvSource = 'oura';
      lastHRVValue = ouraSleepWithHRV[0]?.hrv || null;
      hrvSparklineData = ouraSleepWithHRV.slice(0, 7).reverse().map(s => s.hrv!).filter(Boolean);
    } else if (ouraHRVReadings.length > 0) {
      hrvSource = 'oura';
      lastHRVValue = ouraHRVReadings[0]?.value || null;
      hrvSparklineData = ouraHRVReadings.slice(0, 7).reverse().map(h => h.value);
    } else if (hrvReadings.length > 0) {
      hrvSource = hrvReadings[0]?.source as 'apple_health' | undefined;
      lastHRVValue = hrvReadings[0]?.value || null;
      hrvSparklineData = hrvReadings.slice(0, 7).reverse().map(h => h.value);
    }

    const avgHRV = hrvSparklineData.length > 0
      ? hrvSparklineData.reduce((sum, v) => sum + v, 0) / hrvSparklineData.length
      : 0;
    const hrvTrend = lastHRVValue && avgHRV
      ? (lastHRVValue > avgHRV ? 'up' : lastHRVValue < avgHRV * 0.9 ? 'down' : 'stable')
      : 'stable';

    // RHR - Use same source as HRV for consistency
    const rhrSourceSleep = hasOuraHRV ? ouraSleepWithHRV : recentSleep;
    const lastRHR = rhrSourceSleep[0]?.restingHR || null;
    const rhrSparklineData = rhrSourceSleep.slice(0, 7)
      .reverse()
      .map(s => s.restingHR)
      .filter((v): v is number => v != null);
    const avgRHR = rhrSparklineData.length > 0
      ? rhrSparklineData.reduce((sum, v) => sum + v, 0) / rhrSparklineData.length
      : 0;
    const rhrTrend = lastRHR && avgRHR
      ? (lastRHR < avgRHR - 1 ? 'down' : lastRHR > avgRHR + 2 ? 'up' : 'stable') // Lower RHR is better, so down = good
      : 'stable';

    // ACWR
    const acwr = trainingLoadMetrics?.acwr || 0;
    const loadTrend = trainingLoadMetrics?.trend === 'increasing' ? 'up' : trainingLoadMetrics?.trend === 'decreasing' ? 'down' : 'stable';
    // For ACWR sparkline, we'd need historical ACWR values - use TSS as proxy for now
    const acwrSparklineData = dailyLoads.slice(-7).map(d => d.tss);

    // Weight
    const lastWeight = weightEntries[0];
    const weekAgoWeight = weightEntries.find((_, i) => i >= 7);
    const weightChange = lastWeight && weekAgoWeight ? lastWeight.weight - weekAgoWeight.weight : 0;
    const weightTrend = weightChange < -0.1 ? 'down' : weightChange > 0.1 ? 'up' : 'stable';

    return {
      sleep: lastSleep ? {
        value: lastSleep.duration / 60,
        unit: 'hrs',
        trend: sleepTrend,
        status: lastSleep.duration / 60 >= 7 ? 'good' : lastSleep.duration / 60 >= 6 ? 'caution' : 'warning',
        sparklineData: recentSleep.slice(0, 7).reverse().map(s => s.duration / 60),
      } : null,
      hrv: lastHRVValue ? {
        value: lastHRVValue,
        trend: hrvTrend,
        status: lastHRVValue >= avgHRV * 0.9 ? 'good' : lastHRVValue >= avgHRV * 0.8 ? 'caution' : 'warning',
        sparklineData: hrvSparklineData,
        source: hrvSource,
      } : null,
      rhr: lastRHR ? {
        value: lastRHR,
        unit: 'bpm',
        trend: rhrTrend,
        // For RHR, lower is generally better, so flip the status logic
        status: lastRHR <= avgRHR - 1 ? 'good' : lastRHR <= avgRHR + 3 ? 'caution' : 'warning',
        sparklineData: rhrSparklineData,
        source: hasOuraHRV ? 'oura' : undefined,
      } : null,
      trainingLoad: trainingLoadMetrics ? {
        value: acwr,
        trend: loadTrend,
        status: acwr >= 0.8 && acwr <= 1.3 ? 'good' : acwr <= 1.5 ? 'caution' : 'warning',
        sparklineData: acwrSparklineData,
      } : null,
      weight: lastWeight ? {
        value: lastWeight.weight,
        unit: 'kg',
        trend: weightTrend,
        trendValue: `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)}kg/wk`,
        status: 'good',
        sparklineData: weightEntries.slice(0, 7).reverse().map(w => w.weight),
      } : null,
    };
  }, [recentSleep, hrvReadings, trainingLoadMetrics, weightEntries, dailyLoads]);

  const insights = useMemo((): Insight[] => {
    const result: Insight[] = [];

    // Analyze workout types
    const runWorkoutsForInsights = recentWorkouts.filter(w => w.type === 'run' && w.avgPace);
    const strengthWorkoutsForInsights = recentWorkouts.filter(w =>
      w.type === 'strength' || (w.exercises && w.exercises.length > 0)
    );

    // === RUNNING PATTERN ANALYSIS ===
    if (runWorkoutsForInsights.length >= 5) {
      // Group runs by category
      const easyRuns = runWorkoutsForInsights.filter(w => w.runCategory === 'easy' || w.runCategory === 'recovery');
      const longRuns = runWorkoutsForInsights.filter(w => w.runCategory === 'long');
      const tempoRuns = runWorkoutsForInsights.filter(w => w.runCategory === 'tempo' || w.runCategory === 'interval');

      // 1. Easy Run Pace Progression (compare recent vs older easy runs)
      if (easyRuns.length >= 6) {
        const sortedEasy = [...easyRuns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const recentEasy = sortedEasy.slice(0, 3);
        const olderEasy = sortedEasy.slice(-3);

        const avgRecentPace = recentEasy.reduce((s, r) => s + (r.avgPace || 0), 0) / recentEasy.length;
        const avgOlderPace = olderEasy.reduce((s, r) => s + (r.avgPace || 0), 0) / olderEasy.length;
        const paceDiff = avgOlderPace - avgRecentPace; // Positive = getting faster

        if (Math.abs(paceDiff) >= 5) { // At least 5 sec/km difference
          const fasterOrSlower = paceDiff > 0 ? 'faster' : 'slower';
          const formatPace = (p: number) => `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`;

          result.push({
            id: 'easy-run-progression',
            type: paceDiff > 0 ? 'pattern' : 'warning',
            title: `Easy Runs Getting ${paceDiff > 0 ? 'Faster' : 'Slower'}`,
            description: `Your recent easy runs average ${formatPace(avgRecentPace)}/km compared to ${formatPace(avgOlderPace)}/km earlier. ${
              paceDiff > 0
                ? 'Your aerobic fitness is improving - great sign of adaptation!'
                : 'This could indicate fatigue or running easy runs too hard initially. Check your effort levels.'
            }`,
            status: paceDiff > 0 ? 'good' : 'caution',
            metrics: [
              { label: 'Recent easy pace', value: `${formatPace(avgRecentPace)}/km`, status: paceDiff > 0 ? 'good' : 'caution' },
              { label: 'Earlier easy pace', value: `${formatPace(avgOlderPace)}/km`, status: 'good' },
              { label: 'Change', value: `${Math.abs(Math.round(paceDiff))}s ${fasterOrSlower}`, status: paceDiff > 0 ? 'good' : 'caution' },
            ],
          });
        }
      }

      // 2. Long Run Analysis
      if (longRuns.length >= 3) {
        const sortedLong = [...longRuns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const longestRun = [...longRuns].sort((a, b) => (b.distance || 0) - (a.distance || 0))[0];
        const avgLongDistance = longRuns.reduce((s, r) => s + (r.distance || 0), 0) / longRuns.length / 1000;

        // Check if long runs are progressing
        const recentLong = sortedLong.slice(0, 2);
        const olderLong = sortedLong.slice(-2);
        const recentAvgDist = recentLong.reduce((s, r) => s + (r.distance || 0), 0) / recentLong.length / 1000;
        const olderAvgDist = olderLong.reduce((s, r) => s + (r.distance || 0), 0) / olderLong.length / 1000;

        result.push({
          id: 'long-run-analysis',
          type: 'pattern',
          title: 'Long Run Progress',
          description: `You've done ${longRuns.length} long runs averaging ${avgLongDistance.toFixed(1)}km. Longest: ${((longestRun.distance || 0) / 1000).toFixed(1)}km. ${
            recentAvgDist > olderAvgDist
              ? `Distance is building well (+${(recentAvgDist - olderAvgDist).toFixed(1)}km avg).`
              : recentAvgDist < olderAvgDist * 0.9
              ? 'Recent long runs are shorter - consider rebuilding distance gradually.'
              : 'Distance is consistent - consider adding 10% when ready.'
          }`,
          status: 'good',
          metrics: [
            { label: 'Long runs', value: `${longRuns.length}`, status: 'good' },
            { label: 'Avg distance', value: `${avgLongDistance.toFixed(1)}km`, status: 'good' },
            { label: 'Longest', value: `${((longestRun.distance || 0) / 1000).toFixed(1)}km`, status: 'good' },
          ],
        });
      }

      // 3. Run Type Distribution
      const totalRuns = runWorkoutsForInsights.length;
      const easyPercent = (easyRuns.length / totalRuns) * 100;
      const tempoPercent = (tempoRuns.length / totalRuns) * 100;
      const longPercent = (longRuns.length / totalRuns) * 100;

      if (easyRuns.length > 0 || tempoRuns.length > 0 || longRuns.length > 0) {
        const hasGoodMix = easyPercent >= 60 && tempoPercent > 0 && longPercent > 0;
        const tooMuchHard = tempoPercent > 30;
        const noSpeedWork = tempoPercent === 0 && runWorkoutsForInsights.length >= 8;

        if (!hasGoodMix || tooMuchHard || noSpeedWork) {
          result.push({
            id: 'run-type-balance',
            type: tooMuchHard ? 'warning' : 'pattern',
            title: 'Training Mix Analysis',
            description: tooMuchHard
              ? `${tempoPercent.toFixed(0)}% of runs are hard efforts. Aim for 80/20 (easy/hard) to avoid burnout and maximize adaptation.`
              : noSpeedWork
              ? `No tempo or interval runs detected. Adding 1 quality session per week can significantly improve race performance.`
              : `Good variety: ${easyRuns.length} easy, ${tempoRuns.length} tempo/interval, ${longRuns.length} long runs. Keep this balanced approach.`,
            status: tooMuchHard ? 'caution' : 'good',
            metrics: [
              { label: 'Easy', value: `${easyRuns.length} (${easyPercent.toFixed(0)}%)`, status: easyPercent >= 70 ? 'good' : 'caution' },
              { label: 'Hard', value: `${tempoRuns.length} (${tempoPercent.toFixed(0)}%)`, status: tempoPercent <= 20 ? 'good' : 'caution' },
              { label: 'Long', value: `${longRuns.length} (${longPercent.toFixed(0)}%)`, status: 'good' },
            ],
          });
        }
      }

      // 4. Sleep Impact with Actual Pace Data
      if (recentSleep.length >= 5) {
        const runsWithSleep = runWorkoutsForInsights.map(w => {
          const sleepBefore = recentSleep.find(s =>
            format(new Date(s.date), 'yyyy-MM-dd') === format(subDays(new Date(w.date), 1), 'yyyy-MM-dd')
          );
          return { run: w, sleep: sleepBefore };
        }).filter(x => x.sleep && x.run.avgPace);

        if (runsWithSleep.length >= 5) {
          const goodSleepRuns = runsWithSleep.filter(x => (x.sleep?.duration || 0) >= 7 * 60);
          const poorSleepRuns = runsWithSleep.filter(x => (x.sleep?.duration || 0) < 6.5 * 60);

          if (goodSleepRuns.length >= 2 && poorSleepRuns.length >= 2) {
            const avgPaceGoodSleep = goodSleepRuns.reduce((s, x) => s + (x.run.avgPace || 0), 0) / goodSleepRuns.length;
            const avgPacePoorSleep = poorSleepRuns.reduce((s, x) => s + (x.run.avgPace || 0), 0) / poorSleepRuns.length;
            const paceDiff = avgPacePoorSleep - avgPaceGoodSleep;

            if (paceDiff > 3) { // More than 3 sec/km difference
              const formatPace = (p: number) => `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`;
              result.push({
                id: 'sleep-performance',
                type: 'pattern',
                title: 'Sleep Directly Impacts Your Pace',
                description: `After 7+ hours sleep, you average ${formatPace(avgPaceGoodSleep)}/km. After <6.5 hours, you're ${Math.round(paceDiff)} seconds slower at ${formatPace(avgPacePoorSleep)}/km. Sleep is your free speed boost.`,
                chartType: 'scatter',
                metrics: [
                  { label: '7+ hrs sleep pace', value: `${formatPace(avgPaceGoodSleep)}/km`, status: 'good' },
                  { label: '<6.5 hrs pace', value: `${formatPace(avgPacePoorSleep)}/km`, status: 'caution' },
                  { label: 'Sleep bonus', value: `${Math.round(paceDiff)}s faster`, status: 'good' },
                ],
              });
            }
          }
        }
      }

      // 5. Weekly Mileage Trend
      const fourWeeksAgo = subDays(new Date(), 28);
      const recentRuns = runWorkoutsForInsights.filter(w => new Date(w.date) >= fourWeeksAgo);
      if (recentRuns.length >= 4) {
        // Group by week
        const weeklyKm: number[] = [0, 0, 0, 0];
        recentRuns.forEach(r => {
          const weeksAgo = Math.floor(differenceInDays(new Date(), new Date(r.date)) / 7);
          if (weeksAgo < 4) {
            weeklyKm[3 - weeksAgo] += (r.distance || 0) / 1000;
          }
        });

        const avgWeekly = weeklyKm.reduce((s, k) => s + k, 0) / 4;
        const trend = weeklyKm[3] - weeklyKm[0]; // Recent week vs 4 weeks ago

        if (avgWeekly > 0 && Math.abs(trend) > avgWeekly * 0.2) {
          result.push({
            id: 'weekly-mileage-trend',
            type: trend > 0 ? 'pattern' : 'warning',
            title: `Weekly Mileage ${trend > 0 ? 'Building' : 'Dropping'}`,
            description: trend > 0
              ? `Volume up from ${weeklyKm[0].toFixed(0)}km to ${weeklyKm[3].toFixed(0)}km/week over 4 weeks. ${trend > avgWeekly * 0.3 ? 'Watch for overtraining signs.' : 'Good progression!'}`
              : `Volume down from ${weeklyKm[0].toFixed(0)}km to ${weeklyKm[3].toFixed(0)}km/week. ${Math.abs(trend) > avgWeekly * 0.4 ? 'Significant drop - planned rest or falling off?' : 'Minor reduction - could be a recovery phase.'}`,
            status: trend > 0 ? 'good' : 'caution',
            metrics: [
              { label: '4 weeks ago', value: `${weeklyKm[0].toFixed(0)}km`, status: 'good' },
              { label: 'This week', value: `${weeklyKm[3].toFixed(0)}km`, status: trend > 0 ? 'good' : 'caution' },
              { label: 'Avg', value: `${avgWeekly.toFixed(0)}km/wk`, status: 'good' },
            ],
          });
        }
      }
    }

    // Strength training insights (lifting frequency is now on the strength card)
    if (strengthWorkoutsForInsights.length >= 3) {
      // Sleep impact on lifting
      if (recentSleep.length >= 5) {
        const liftAfterPoorSleep = strengthWorkoutsForInsights.filter(w => {
          const sleepBefore = recentSleep.find(s =>
            format(s.date, 'yyyy-MM-dd') === format(subDays(new Date(w.date), 1), 'yyyy-MM-dd')
          );
          return sleepBefore && sleepBefore.duration < 6 * 60;
        }).length;

        if (liftAfterPoorSleep >= 2) {
          result.push({
            id: 'sleep-lifting',
            type: 'warning',
            title: 'Sleep Impacting Strength Sessions',
            description: `${liftAfterPoorSleep} lifting sessions followed <6 hours of sleep. Poor sleep reduces strength output by 10-20% and impairs muscle recovery.`,
            status: 'caution',
            metrics: [
              { label: 'Affected sessions', value: `${liftAfterPoorSleep}`, status: 'caution' },
            ],
          });
        }
      }

      // Check for volume balance across exercises
      const exerciseCounts = new Map<string, number>();
      strengthWorkoutsForInsights.forEach(w => {
        w.exercises?.forEach(ex => {
          const normalized = ex.exercise.toLowerCase();
          exerciseCounts.set(normalized, (exerciseCounts.get(normalized) || 0) + 1);
        });
      });

      if (exerciseCounts.size >= 3) {
        const pushExercises = ['bench press', 'bench', 'overhead press', 'ohp', 'push up', 'dip'];
        const pullExercises = ['row', 'pull up', 'pullup', 'chin up', 'lat pulldown', 'deadlift'];

        let pushCount = 0;
        let pullCount = 0;
        exerciseCounts.forEach((count, exercise) => {
          if (pushExercises.some(p => exercise.includes(p))) pushCount += count;
          if (pullExercises.some(p => exercise.includes(p))) pullCount += count;
        });

        if (pushCount > 0 && pullCount > 0) {
          const ratio = pushCount / pullCount;
          if (ratio > 1.5) {
            result.push({
              id: 'push-pull-imbalance',
              type: 'warning',
              title: 'Push/Pull Imbalance Detected',
              description: `You're doing ${Math.round(ratio * 100)}% more pushing than pulling exercises. Balance reduces injury risk and improves posture.`,
              status: 'caution',
              metrics: [
                { label: 'Push sets', value: `${pushCount}`, status: 'caution' },
                { label: 'Pull sets', value: `${pullCount}`, status: 'caution' },
              ],
            });
          }
        }
      }

      // HRV impact on lifting sessions
      if (hrvReadings.length >= 5) {
        const liftWithHRV = strengthWorkoutsForInsights.map(w => {
          const dayHRV = hrvReadings.find(h =>
            format(new Date(h.date), 'yyyy-MM-dd') === format(new Date(w.date), 'yyyy-MM-dd')
          );
          return { workout: w, hrv: dayHRV?.value || null };
        }).filter(pair => pair.hrv !== null);

        if (liftWithHRV.length >= 3) {
          const avgHRVOnLiftDays = liftWithHRV.reduce((sum, p) => sum + (p.hrv || 0), 0) / liftWithHRV.length;
          const overallAvgHRV = hrvReadings.slice(0, 14).reduce((sum, h) => sum + h.value, 0) / Math.min(14, hrvReadings.length);

          // Lifting when HRV is low
          const lowHRVLifts = liftWithHRV.filter(p => (p.hrv || 0) < overallAvgHRV * 0.85);
          if (lowHRVLifts.length >= 2) {
            result.push({
              id: 'hrv-lifting',
              type: 'warning',
              title: 'Lifting on Low HRV Days',
              description: `${lowHRVLifts.length} of your recent lifting sessions were on days when HRV was 15%+ below your baseline. Consider lighter loads or focusing on technique when HRV is suppressed.`,
              status: 'caution',
              metrics: [
                { label: 'Low HRV lifts', value: `${lowHRVLifts.length}/${liftWithHRV.length}`, status: 'caution' },
                { label: 'Avg lift day HRV', value: `${avgHRVOnLiftDays.toFixed(0)}ms`, status: avgHRVOnLiftDays < overallAvgHRV * 0.9 ? 'caution' : 'good' },
              ],
            });
          }
        }
      }

      // Volume trend analysis (are they progressing?)
      if (strengthWorkoutsForInsights.length >= 8) {
        // Split recent vs older sessions (first half vs second half)
        const midpoint = Math.floor(strengthWorkoutsForInsights.length / 2);
        const recentSessions = strengthWorkoutsForInsights.slice(0, midpoint);
        const olderSessions = strengthWorkoutsForInsights.slice(midpoint);

        const calcTotalVolume = (sessions: typeof strengthWorkoutsForInsights) =>
          sessions.reduce((sum, w) =>
            sum + (w.exercises?.reduce((s, ex) => s + (ex.weight * ex.reps), 0) || 0), 0);

        const recentVolume = calcTotalVolume(recentSessions) / recentSessions.length;
        const olderVolume = calcTotalVolume(olderSessions) / olderSessions.length;

        if (olderVolume > 0) {
          const volumeChange = ((recentVolume - olderVolume) / olderVolume) * 100;

          if (Math.abs(volumeChange) > 10) {
            result.push({
              id: 'volume-progression',
              type: volumeChange > 0 ? 'progress' : 'warning',
              title: volumeChange > 0 ? 'Volume Progressing Well' : 'Training Volume Declining',
              description: volumeChange > 0
                ? `Your average session volume is up ${volumeChange.toFixed(0)}% compared to earlier sessions. Great progressive overload!`
                : `Your average session volume is down ${Math.abs(volumeChange).toFixed(0)}%. This could indicate fatigue, deload, or reduced intensity.`,
              status: volumeChange > 0 ? 'good' : 'caution',
              metrics: [
                { label: 'Volume change', value: `${volumeChange >= 0 ? '+' : ''}${volumeChange.toFixed(0)}%`, status: volumeChange > 0 ? 'good' : 'caution' },
              ],
            });
          }
        }
      }

      // Recovery between hard sessions
      const sortedStrength = [...strengthWorkoutsForInsights].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      if (sortedStrength.length >= 4) {
        let backToBackCount = 0;
        for (let i = 0; i < sortedStrength.length - 1; i++) {
          const daysDiff = differenceInDays(
            new Date(sortedStrength[i].date),
            new Date(sortedStrength[i + 1].date)
          );
          if (daysDiff <= 1) backToBackCount++;
        }

        const backToBackPercent = (backToBackCount / (sortedStrength.length - 1)) * 100;
        if (backToBackPercent >= 40) {
          result.push({
            id: 'recovery-spacing',
            type: 'warning',
            title: 'Consider More Recovery Time',
            description: `${backToBackPercent.toFixed(0)}% of your lifting sessions are back-to-back days. Muscles need 48-72 hours to recover and grow. Consider alternating muscle groups or adding rest days.`,
            status: 'caution',
            metrics: [
              { label: 'Back-to-back', value: `${backToBackCount} pairs`, status: 'caution' },
            ],
          });
        }
      }
    }

    // Combined training insight for hybrid athletes
    if (runWorkoutsForInsights.length >= 3 && strengthWorkoutsForInsights.length >= 3) {
      result.push({
        id: 'hybrid-training',
        type: 'progress',
        title: 'Balanced Training Approach',
        description: `Nice hybrid approach with ${runWorkoutsForInsights.length} runs and ${strengthWorkoutsForInsights.length} lifting sessions recently. Running and lifting complement each other when balanced well.`,
        status: 'good',
        metrics: [
          { label: 'Runs', value: `${runWorkoutsForInsights.length}`, status: 'good' },
          { label: 'Lifting', value: `${strengthWorkoutsForInsights.length}`, status: 'good' },
        ],
      });
    }

    // Training load warning
    if (trainingLoadMetrics && trainingLoadMetrics.acwr > 1.3) {
      result.push({
        id: 'training-load-warning',
        type: 'warning',
        title: 'Training Load Elevated',
        description: `Your ACWR is ${trainingLoadMetrics.acwr.toFixed(2)}, which increases injury risk. Consider reducing intensity this week.`,
        status: trainingLoadMetrics.acwr > 1.5 ? 'warning' : 'caution',
        metrics: [
          { label: 'ACWR', value: trainingLoadMetrics.acwr.toFixed(2), status: trainingLoadMetrics.acwr > 1.5 ? 'warning' : 'caution' },
          { label: 'Risk Zone', value: trainingLoadMetrics.riskZone, status: trainingLoadMetrics.riskZone === 'danger' ? 'warning' : 'caution' },
        ],
      });
    }

    // === PERFORMANCE vs RECOVERY PATTERNS ===
    // Correlate actual workout outcomes with recovery metrics

    // Get HRV data (prefer Oura)
    const ouraHRVData = hrvReadings.filter(h => h.source === 'oura');
    const ouraSleepHRV = recentSleep.filter(s => s.source === 'oura' && s.hrv);
    const useOuraHRV = ouraSleepHRV.length > 0 || ouraHRVData.length > 0;

    // Build HRV lookup by date
    const hrvByDate = new Map<string, number>();
    if (useOuraHRV) {
      ouraSleepHRV.forEach(s => {
        if (s.hrv) hrvByDate.set(format(new Date(s.date), 'yyyy-MM-dd'), s.hrv);
      });
      ouraHRVData.forEach(h => {
        const key = format(new Date(h.date), 'yyyy-MM-dd');
        if (!hrvByDate.has(key)) hrvByDate.set(key, h.value);
      });
    } else {
      hrvReadings.forEach(h => {
        hrvByDate.set(format(new Date(h.date), 'yyyy-MM-dd'), h.value);
      });
    }

    const avgHRVBaseline = hrvByDate.size > 0
      ? Array.from(hrvByDate.values()).reduce((s, v) => s + v, 0) / hrvByDate.size
      : 0;

    // Build sleep lookup by date
    const sleepByDate = new Map<string, number>();
    recentSleep.forEach(s => {
      sleepByDate.set(format(new Date(s.date), 'yyyy-MM-dd'), s.duration / 60);
    });

    // 1. HRV vs Running Performance
    if (runWorkoutsForInsights.length >= 5 && hrvByDate.size >= 5) {
      const runsWithHRV = runWorkoutsForInsights.map(w => {
        const dateKey = format(new Date(w.date), 'yyyy-MM-dd');
        const hrv = hrvByDate.get(dateKey);
        return { run: w, hrv };
      }).filter(x => x.hrv && x.run.avgPace);

      if (runsWithHRV.length >= 5) {
        const highHRVRuns = runsWithHRV.filter(x => (x.hrv || 0) >= avgHRVBaseline);
        const lowHRVRuns = runsWithHRV.filter(x => (x.hrv || 0) < avgHRVBaseline * 0.9);

        if (highHRVRuns.length >= 2 && lowHRVRuns.length >= 2) {
          const avgPaceHighHRV = highHRVRuns.reduce((s, x) => s + (x.run.avgPace || 0), 0) / highHRVRuns.length;
          const avgPaceLowHRV = lowHRVRuns.reduce((s, x) => s + (x.run.avgPace || 0), 0) / lowHRVRuns.length;
          const paceDiff = avgPaceLowHRV - avgPaceHighHRV; // Positive = faster when HRV high

          if (paceDiff > 5) { // More than 5 sec/km difference
            const formatPace = (p: number) => `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`;
            result.push({
              id: 'hrv-run-performance',
              type: 'pattern',
              title: 'HRV Predicts Your Running Performance',
              description: `When HRV is at/above baseline, you run ${formatPace(avgPaceHighHRV)}/km. When HRV is 10%+ below, you're ${Math.round(paceDiff)}s slower at ${formatPace(avgPaceLowHRV)}/km. High HRV days are your speed days.`,
              status: 'good',
              metrics: [
                { label: 'High HRV pace', value: `${formatPace(avgPaceHighHRV)}/km`, status: 'good' },
                { label: 'Low HRV pace', value: `${formatPace(avgPaceLowHRV)}/km`, status: 'caution' },
                { label: 'Samples', value: `${runsWithHRV.length} runs`, status: 'good' },
              ],
            });
          }
        }
      }
    }

    // 2. Sleep Duration vs Workout Duration/Completion
    if (recentWorkouts.length >= 8 && sleepByDate.size >= 5) {
      const workoutsWithSleep = recentWorkouts.map(w => {
        const prevDateKey = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
        const sleep = sleepByDate.get(prevDateKey);
        return { workout: w, sleep };
      }).filter(x => x.sleep);

      if (workoutsWithSleep.length >= 6) {
        const goodSleepWorkouts = workoutsWithSleep.filter(x => (x.sleep || 0) >= 7);
        const poorSleepWorkouts = workoutsWithSleep.filter(x => (x.sleep || 0) < 6.5);

        if (goodSleepWorkouts.length >= 2 && poorSleepWorkouts.length >= 2) {
          const avgDurationGoodSleep = goodSleepWorkouts.reduce((s, x) => s + x.workout.duration, 0) / goodSleepWorkouts.length;
          const avgDurationPoorSleep = poorSleepWorkouts.reduce((s, x) => s + x.workout.duration, 0) / poorSleepWorkouts.length;
          const durationDiff = avgDurationGoodSleep - avgDurationPoorSleep;

          if (Math.abs(durationDiff) > 10) { // More than 10 min difference
            result.push({
              id: 'sleep-workout-duration',
              type: 'pattern',
              title: durationDiff > 0 ? 'Better Sleep = Longer Workouts' : 'Poor Sleep Doesn\'t Stop You',
              description: durationDiff > 0
                ? `After 7+ hours sleep, your workouts average ${avgDurationGoodSleep.toFixed(0)} min. After <6.5 hours, only ${avgDurationPoorSleep.toFixed(0)} min. You train ${Math.round(durationDiff)} minutes longer when well-rested.`
                : `Interestingly, you still complete substantial workouts even after poor sleep. But check if quality/intensity suffers.`,
              status: durationDiff > 0 ? 'good' : 'caution',
              metrics: [
                { label: '7+ hrs sleep', value: `${avgDurationGoodSleep.toFixed(0)}min avg`, status: 'good' },
                { label: '<6.5 hrs sleep', value: `${avgDurationPoorSleep.toFixed(0)}min avg`, status: 'caution' },
              ],
            });
          }
        }
      }
    }

    // 3. ACWR Zone vs Performance
    if (runWorkoutsForInsights.length >= 8 && trainingLoadMetrics) {
      // Group runs by the ACWR at the time (approximated by looking at surrounding load)
      // For simplicity, compare runs from high vs low load periods
      const sortedRuns = [...runWorkoutsForInsights].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Split into earlier (lower chronic load built up) vs later periods
      const midpoint = Math.floor(sortedRuns.length / 2);
      const earlierRuns = sortedRuns.slice(0, midpoint).filter(r => r.avgPace);
      const laterRuns = sortedRuns.slice(midpoint).filter(r => r.avgPace);

      if (earlierRuns.length >= 3 && laterRuns.length >= 3) {
        // Compare same run types if possible
        const earlierEasy = earlierRuns.filter(r => r.runCategory === 'easy' || !r.runCategory);
        const laterEasy = laterRuns.filter(r => r.runCategory === 'easy' || !r.runCategory);

        if (earlierEasy.length >= 2 && laterEasy.length >= 2) {
          const avgPaceEarlier = earlierEasy.reduce((s, r) => s + (r.avgPace || 0), 0) / earlierEasy.length;
          const avgPaceLater = laterEasy.reduce((s, r) => s + (r.avgPace || 0), 0) / laterEasy.length;
          const improvement = avgPaceEarlier - avgPaceLater; // Positive = getting faster

          if (Math.abs(improvement) > 8) { // More than 8 sec/km change
            const formatPace = (p: number) => `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`;
            result.push({
              id: 'fitness-progression',
              type: improvement > 0 ? 'pattern' : 'warning',
              title: improvement > 0 ? 'Fitness Building Over Time' : 'Recent Runs Slower',
              description: improvement > 0
                ? `Your easy pace has improved from ${formatPace(avgPaceEarlier)}/km to ${formatPace(avgPaceLater)}/km (${Math.round(improvement)}s faster). Training is paying off!`
                : `Recent easy runs are ${Math.round(Math.abs(improvement))}s/km slower than earlier (${formatPace(avgPaceLater)} vs ${formatPace(avgPaceEarlier)}). Could be accumulated fatigue - check recovery metrics.`,
              status: improvement > 0 ? 'good' : 'caution',
              metrics: [
                { label: 'Earlier pace', value: `${formatPace(avgPaceEarlier)}/km`, status: 'good' },
                { label: 'Recent pace', value: `${formatPace(avgPaceLater)}/km`, status: improvement > 0 ? 'good' : 'caution' },
              ],
            });
          }
        }
      }
    }

    // 4. Lifting Performance vs Recovery
    if (strengthWorkoutsForInsights.length >= 5 && (hrvByDate.size >= 3 || sleepByDate.size >= 3)) {
      const liftsWithRecovery = strengthWorkoutsForInsights.map(w => {
        const dateKey = format(new Date(w.date), 'yyyy-MM-dd');
        const prevDateKey = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
        const hrv = hrvByDate.get(dateKey);
        const sleep = sleepByDate.get(prevDateKey);
        const totalVolume = w.exercises?.reduce((s, ex) => s + (ex.weight * ex.reps), 0) || 0;
        return { workout: w, hrv, sleep, volume: totalVolume };
      }).filter(x => x.volume > 0 && (x.hrv || x.sleep));

      if (liftsWithRecovery.length >= 4) {
        // Compare high vs low recovery sessions
        const wellRecovered = liftsWithRecovery.filter(x =>
          (x.hrv && x.hrv >= avgHRVBaseline * 0.95) || (x.sleep && x.sleep >= 7)
        );
        const poorlyRecovered = liftsWithRecovery.filter(x =>
          (x.hrv && x.hrv < avgHRVBaseline * 0.85) || (x.sleep && x.sleep < 6)
        );

        if (wellRecovered.length >= 2 && poorlyRecovered.length >= 2) {
          const avgVolumeGood = wellRecovered.reduce((s, x) => s + x.volume, 0) / wellRecovered.length;
          const avgVolumePoor = poorlyRecovered.reduce((s, x) => s + x.volume, 0) / poorlyRecovered.length;
          const volumeDiff = ((avgVolumeGood - avgVolumePoor) / avgVolumePoor) * 100;

          if (Math.abs(volumeDiff) > 15) { // More than 15% difference
            result.push({
              id: 'recovery-lifting-volume',
              type: 'pattern',
              title: volumeDiff > 0 ? 'Recovery Boosts Lifting Volume' : 'You Push Through Fatigue',
              description: volumeDiff > 0
                ? `When well-recovered (good HRV/sleep), you lift ${volumeDiff.toFixed(0)}% more total volume per session. Recovery directly impacts your strength output.`
                : `You maintain lifting volume even when recovery metrics are low. Monitor for overtraining signs.`,
              status: volumeDiff > 0 ? 'good' : 'caution',
              metrics: [
                { label: 'Recovered volume', value: `${(avgVolumeGood / 1000).toFixed(1)}k kg`, status: 'good' },
                { label: 'Fatigued volume', value: `${(avgVolumePoor / 1000).toFixed(1)}k kg`, status: 'caution' },
              ],
            });
          }
        }
      }
    }

    // 5. Best workout conditions (when do PRs happen?)
    if (recentWorkouts.length >= 10) {
      // Find workouts with high relative performance
      const runsWithContext = runWorkoutsForInsights.map(w => {
        const prevDateKey = format(subDays(new Date(w.date), 1), 'yyyy-MM-dd');
        const dateKey = format(new Date(w.date), 'yyyy-MM-dd');
        return {
          run: w,
          sleep: sleepByDate.get(prevDateKey),
          hrv: hrvByDate.get(dateKey),
        };
      }).filter(x => x.run.avgPace && (x.sleep || x.hrv));

      if (runsWithContext.length >= 6) {
        // Find fastest 20% of runs
        const sortedByPace = [...runsWithContext].sort((a, b) => (a.run.avgPace || 999) - (b.run.avgPace || 999));
        const fastestRuns = sortedByPace.slice(0, Math.max(2, Math.floor(sortedByPace.length * 0.2)));
        const otherRuns = sortedByPace.slice(Math.floor(sortedByPace.length * 0.2));

        const avgSleepFastest = fastestRuns.filter(x => x.sleep).reduce((s, x) => s + (x.sleep || 0), 0) / fastestRuns.filter(x => x.sleep).length || 0;
        const avgSleepOther = otherRuns.filter(x => x.sleep).reduce((s, x) => s + (x.sleep || 0), 0) / otherRuns.filter(x => x.sleep).length || 0;

        const avgHRVFastest = fastestRuns.filter(x => x.hrv).reduce((s, x) => s + (x.hrv || 0), 0) / fastestRuns.filter(x => x.hrv).length || 0;
        const avgHRVOther = otherRuns.filter(x => x.hrv).reduce((s, x) => s + (x.hrv || 0), 0) / otherRuns.filter(x => x.hrv).length || 0;

        if ((avgSleepFastest > avgSleepOther + 0.3) || (avgHRVFastest > avgHRVOther * 1.05)) {
          const conditions: string[] = [];
          if (avgSleepFastest > avgSleepOther + 0.3) {
            conditions.push(`${avgSleepFastest.toFixed(1)}hrs sleep (vs ${avgSleepOther.toFixed(1)}hrs avg)`);
          }
          if (avgHRVFastest > avgHRVOther * 1.05) {
            conditions.push(`HRV ${avgHRVFastest.toFixed(0)}ms (vs ${avgHRVOther.toFixed(0)}ms avg)`);
          }

          result.push({
            id: 'pr-conditions',
            type: 'pattern',
            title: 'Your Fastest Runs Share Common Factors',
            description: `Your top ${fastestRuns.length} fastest runs happened with: ${conditions.join(' and ')}. These are your optimal performance conditions.`,
            status: 'good',
            metrics: [
              { label: 'Fast run sleep', value: `${avgSleepFastest.toFixed(1)}hrs`, status: 'good' },
              { label: 'Fast run HRV', value: `${avgHRVFastest.toFixed(0)}ms`, status: 'good' },
            ],
          });
        }
      }
    }

    // Weight progress
    if (weightEntries.length >= 14) {
      const twoWeeksAgo = weightEntries[13]?.weight || weightEntries[weightEntries.length - 1]?.weight;
      const current = weightEntries[0]?.weight;
      const change = current - twoWeeksAgo;

      if (Math.abs(change) > 0.5) {
        const isLifter = strengthWorkoutsForInsights.length >= runWorkoutsForInsights.length;
        result.push({
          id: 'weight-progress',
          type: 'progress',
          title: change < 0 ? 'Weight Trending Down' : 'Weight Trending Up',
          description: change < 0
            ? `You've lost ${Math.abs(change).toFixed(1)}kg over the past 2 weeks. ${isLifter ? 'If bulking, consider increasing calories. If cutting, great progress!' : 'Great progress!'}`
            : `Weight is up ${change.toFixed(1)}kg. ${isLifter ? 'Could be muscle gain from your lifting. Track strength PRs to confirm.' : 'Could be water retention, muscle gain, or worth reviewing nutrition.'}`,
          status: change < 0 ? 'good' : 'caution',
          chartType: 'line',
          chartData: weightEntries.slice(0, 14).reverse().map((w, i) => ({ x: i, y: w.weight })),
        });
      }
    }

    return result;
  }, [recentWorkouts, recentSleep, trainingLoadMetrics, weightEntries]);

  const runningCritique = useMemo((): RunningCritique | null => {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run');
    if (runWorkouts.length < 5) return null;

    // Analyze running patterns
    const totalKm = runWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
    const weeklyAvgKm = totalKm / Math.max(1, Math.ceil(runWorkouts.length / 3));

    // Determine grade based on various factors
    const consistencyScore = runWorkouts.length >= 12 ? 'A' : runWorkouts.length >= 8 ? 'B' : 'C';
    const volumeScore = weeklyAvgKm >= 40 ? 'A' : weeklyAvgKm >= 25 ? 'B' : 'C';

    // HR-based intensity check - use Strava zones if available
    const critiqueRunsWithHR = runWorkouts.filter(w => w.avgHeartRate);

    // Get zone 2 max HR from Strava zones or estimate
    let z2MaxHR: number;
    if (stravaHRZones && stravaHRZones.length >= 2) {
      z2MaxHR = stravaHRZones[1]?.max === -1 ? 999 : stravaHRZones[1]?.max || 150;
    } else {
      const observedMaxHR = critiqueRunsWithHR.length > 0 ? Math.max(...critiqueRunsWithHR.map(w => w.maxHeartRate || 0)) : 185;
      const critiqueMaxHR = observedMaxHR > 150 ? observedMaxHR : 185;
      z2MaxHR = Math.round(critiqueMaxHR * 0.70);
    }

    // Count easy runs (Zone 1-2)
    const easyHRRuns = critiqueRunsWithHR.filter(w => (w.avgHeartRate || 0) < z2MaxHR);
    const easyPercent = critiqueRunsWithHR.length > 0 ? (easyHRRuns.length / critiqueRunsWithHR.length) * 100 : 50;
    const intensityScore = easyPercent >= 70 ? 'A' : easyPercent >= 50 ? 'B' : 'C';

    const overallGrade = [consistencyScore, volumeScore, intensityScore].includes('C') ? 'B-' :
                         [consistencyScore, volumeScore, intensityScore].every(s => s === 'A') ? 'A' : 'B+';

    // Calculate recovery score based on sleep before runs (matching detail view)
    const undersleptRuns = runWorkouts.filter(w => {
      const sleepBefore = recentSleep.find(s =>
        format(new Date(s.date), 'yyyy-MM-dd') === format(subDays(new Date(w.date), 1), 'yyyy-MM-dd')
      );
      return sleepBefore && sleepBefore.duration < 7 * 60; // Less than 7 hours
    }).length;
    const undersleptPercent = runWorkouts.length > 0 ? undersleptRuns / runWorkouts.length : 0;
    const recoveryScore = undersleptPercent < 0.2 ? 'A' : undersleptPercent < 0.3 ? 'B' : 'D';

    return {
      overallGrade,
      gradeDescription: overallGrade.startsWith('A')
        ? 'Excellent running habits with room for optimization'
        : overallGrade.startsWith('B')
        ? 'Good foundation, but some areas need attention'
        : 'Several areas need improvement for better results',
      gradeBreakdown: [
        { category: 'Consistency', grade: consistencyScore },
        { category: 'Volume', grade: volumeScore },
        { category: 'Intensity', grade: intensityScore },
        { category: 'Recovery', grade: recoveryScore },
      ],
      strengths: [
        runWorkouts.length >= 8 ? 'Consistent running frequency' : null,
        weeklyAvgKm >= 25 ? `Good weekly volume (${weeklyAvgKm.toFixed(0)}km/week)` : null,
        easyPercent >= 60 ? 'Good aerobic base - majority easy runs' : null,
      ].filter(Boolean) as string[],
      improvements: [
        easyPercent < 70 ? `More runs should be in Zone 1-2 (HR <${z2MaxHR} bpm)` : null,
        weeklyAvgKm < 30 ? 'Consider gradually increasing weekly volume' : null,
        'Add structured speed work 1x per week',
      ].filter(Boolean) as string[],
      redFlags: [
        trainingLoadMetrics && trainingLoadMetrics.acwr > 1.4 ? 'Training load is elevated - injury risk' : null,
        easyPercent < 50 ? 'Most runs too intense - risking burnout' : null,
      ].filter(Boolean) as string[],
      topPriorities: [
        `Keep easy runs in Zone 2 (HR <${z2MaxHR} bpm)`,
        'Respect recovery - skip hard runs when HRV is low',
        'Add one threshold/tempo run per week',
      ],
      sections: [],
    };
  }, [recentWorkouts, trainingLoadMetrics, stravaHRZones, hrvReadings]);

  const runningStats = useMemo((): RunningStats | null => {
    const runWorkouts = recentWorkouts.filter(w => w.type === 'run');
    if (runWorkouts.length < 5) return null;

    const totalKm = runWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
    const weeklyAvgKm = totalKm / Math.max(1, Math.ceil(differenceInDays(new Date(), runWorkouts[runWorkouts.length - 1]?.date || new Date()) / 7));

    // Weekly volume data - use Monday as week start to match common convention
    const weeklyVolume: { week: string; km: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Sunday
      // Ensure date comparison works by converting to timestamps
      const weekRuns = runWorkouts.filter(w => {
        const wDate = new Date(w.date).getTime();
        return wDate >= weekStart.getTime() && wDate <= weekEnd.getTime();
      });
      const km = weekRuns.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
      weeklyVolume.unshift({ week: format(weekStart, 'MMM d'), km });
    }

    // Calculate HR zones - use Strava zones if available, otherwise estimate
    const runsWithHR = runWorkouts.filter(w => w.avgHeartRate);

    // Zone labels and colors
    const zoneLabels = ['Zone 1 (Recovery)', 'Zone 2 (Aerobic)', 'Zone 3 (Tempo)', 'Zone 4 (Threshold)', 'Zone 5 (VO2max)'];
    const zoneColors = ['#94a3b8', '#22c55e', '#eab308', '#f97316', '#ef4444'];

    // Get zone boundaries from Strava or calculate from max HR
    let zoneBoundaries: { min: number; max: number }[];
    let maxHR: number;

    if (stravaHRZones && stravaHRZones.length >= 5) {
      // Use Strava zones directly
      zoneBoundaries = stravaHRZones.slice(0, 5).map(z => ({
        min: z.min,
        max: z.max === -1 ? 999 : z.max,
      }));
      // Max HR is the upper bound of zone 5 (or estimate from zone 4 max)
      maxHR = stravaHRZones[4]?.max === -1
        ? Math.round(stravaHRZones[3]?.max * 1.11) // Zone 4 max is typically ~90% of max HR
        : stravaHRZones[4]?.max || 185;
      console.log('Using Strava HR zones:', stravaHRZones);
    } else {
      // Fallback: estimate from observed max HR
      const observedMaxHR = runsWithHR.length > 0
        ? Math.max(...runsWithHR.map(w => w.maxHeartRate || 0))
        : 0;
      maxHR = observedMaxHR > 150 ? observedMaxHR : 185;

      // Standard 5-zone model based on % of max HR
      zoneBoundaries = [
        { min: Math.round(maxHR * 0.50), max: Math.round(maxHR * 0.60) },
        { min: Math.round(maxHR * 0.60), max: Math.round(maxHR * 0.70) },
        { min: Math.round(maxHR * 0.70), max: Math.round(maxHR * 0.80) },
        { min: Math.round(maxHR * 0.80), max: Math.round(maxHR * 0.90) },
        { min: Math.round(maxHR * 0.90), max: maxHR },
      ];
      console.log('Using estimated HR zones (no Strava zones):', zoneBoundaries);
    }

    let hrZones: { zone: string; hrRange: string; percent: number; color: string }[];
    if (runsWithHR.length > 0) {
      const zoneCounts = [0, 0, 0, 0, 0];
      runsWithHR.forEach(w => {
        const hr = w.avgHeartRate || 0;
        // Find which zone this HR falls into
        for (let i = 0; i < 5; i++) {
          if (hr >= zoneBoundaries[i].min && hr < zoneBoundaries[i].max) {
            zoneCounts[i]++;
            break;
          }
          // If HR is above zone 5, count it in zone 5
          if (i === 4 && hr >= zoneBoundaries[i].min) {
            zoneCounts[i]++;
          }
        }
      });
      const total = runsWithHR.length;
      hrZones = zoneBoundaries.map((bounds, i) => ({
        zone: zoneLabels[i],
        hrRange: `${bounds.min}-${bounds.max === 999 ? maxHR : bounds.max} bpm`,
        percent: Math.round((zoneCounts[i] / total) * 100),
        color: zoneColors[i],
      }));
    } else {
      // No HR data available
      hrZones = zoneBoundaries.map((bounds, i) => ({
        zone: zoneLabels[i],
        hrRange: `${bounds.min}-${bounds.max === 999 ? maxHR : bounds.max} bpm`,
        percent: 0,
        color: zoneColors[i],
      }));
    }

    // Determine HR status - ideal is 80% in Zone 1-2
    const easyZonePercent = hrZones[0].percent + hrZones[1].percent;
    const hrStatus: 'good' | 'caution' | 'warning' =
      easyZonePercent >= 70 ? 'good' : easyZonePercent >= 50 ? 'caution' : 'warning';

    // HR-based insights
    const hrInsights: string[] = [];
    if (runsWithHR.length === 0) {
      hrInsights.push('No heart rate data available - consider using a HR monitor');
    } else {
      if (easyZonePercent < 70) {
        hrInsights.push(`Only ${easyZonePercent}% of runs in Zone 1-2 (target: 80%)`);
      }
      if (hrZones[2].percent + hrZones[3].percent > 40) {
        hrInsights.push('Too much time in Zone 3-4 "gray zone" - polarize your training');
      }
      if (easyZonePercent >= 70) {
        hrInsights.push('Good aerobic base building with majority easy runs');
      }
    }

    // Analyze run categories from descriptions
    const categoryColors: Record<string, string> = {
      easy: '#22c55e',
      long: '#3b82f6',
      tempo: '#f59e0b',
      interval: '#ef4444',
      race: '#8b5cf6',
      recovery: '#94a3b8',
      fartlek: '#ec4899',
      hills: '#f97316',
      unknown: '#6b7280',
    };

    const categoryLabels: Record<string, string> = {
      easy: 'Easy',
      long: 'Long Run',
      tempo: 'Tempo',
      interval: 'Intervals',
      race: 'Race',
      recovery: 'Recovery',
      fartlek: 'Fartlek',
      hills: 'Hills',
      unknown: 'General',
    };

    // Group runs by category
    const categoryMap = new Map<string, { count: number; totalKm: number; totalPace: number }>();
    runWorkouts.forEach(w => {
      const cat = w.runCategory || 'unknown';
      const existing = categoryMap.get(cat) || { count: 0, totalKm: 0, totalPace: 0 };
      categoryMap.set(cat, {
        count: existing.count + 1,
        totalKm: existing.totalKm + (w.distance || 0) / 1000,
        totalPace: existing.totalPace + (w.avgPace || 0),
      });
    });

    const runCategories: RunCategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([cat, data]) => ({
        category: categoryLabels[cat] || cat,
        count: data.count,
        totalKm: data.totalKm,
        avgPace: data.count > 0 ? data.totalPace / data.count : 0,
        color: categoryColors[cat] || '#6b7280',
      }))
      .sort((a, b) => b.count - a.count);

    // Analyze training balance
    const easyRuns = runWorkouts.filter(w => w.runCategory === 'easy' || w.runCategory === 'recovery').length;
    const hardRuns = runWorkouts.filter(w => ['tempo', 'interval', 'race', 'hills', 'fartlek'].includes(w.runCategory || '')).length;
    const longRuns = runWorkouts.filter(w => w.runCategory === 'long').length;
    const totalCategorized = easyRuns + hardRuns + longRuns;
    const unknownRuns = runWorkouts.filter(w => !w.runCategory || w.runCategory === 'unknown').length;

    const categoryInsights: string[] = [];
    let trainingBalance: 'good' | 'caution' | 'warning' = 'good';

    if (unknownRuns > runWorkouts.length * 0.5) {
      categoryInsights.push('Add run type to Strava descriptions (easy, tempo, long, etc.) for better analysis');
    } else if (totalCategorized > 3) {
      const easyPercent = (easyRuns / totalCategorized) * 100;
      const hardPercent = (hardRuns / totalCategorized) * 100;

      if (easyPercent >= 70) {
        categoryInsights.push(`Good balance: ${Math.round(easyPercent)}% easy runs (target: 80%)`);
      } else if (easyPercent >= 50) {
        categoryInsights.push(`Moderate balance: ${Math.round(easyPercent)}% easy, consider more easy runs`);
        trainingBalance = 'caution';
      } else {
        categoryInsights.push(`Too much intensity: only ${Math.round(easyPercent)}% easy runs`);
        trainingBalance = 'warning';
      }

      if (hardPercent > 30) {
        categoryInsights.push(`${Math.round(hardPercent)}% hard runs - risk of overtraining`);
        trainingBalance = 'warning';
      }

      if (longRuns === 0 && runWorkouts.length > 5) {
        categoryInsights.push('No long runs detected - consider adding one per week');
      }
    }

    // Sleep vs pace correlation
    const sleepVsPace = runWorkouts.slice(0, 20).map(w => {
      const sleepBefore = recentSleep.find(s =>
        format(s.date, 'yyyy-MM-dd') === format(subDays(w.date, 1), 'yyyy-MM-dd')
      );
      return {
        sleep: sleepBefore ? sleepBefore.duration / 60 : 7,
        pace: w.avgPace || 300,
      };
    });

    // Recovery issues
    const undersleptRuns = runWorkouts.filter(w => {
      const sleepBefore = recentSleep.find(s =>
        format(s.date, 'yyyy-MM-dd') === format(subDays(w.date, 1), 'yyyy-MM-dd')
      );
      return sleepBefore && sleepBefore.duration < 7 * 60;
    }).length;

    // Calculate intensity grade based on HR zone distribution (reuse easyZonePercent from above)
    const intensityGrade = easyZonePercent >= 70 ? 'A' : easyZonePercent >= 50 ? 'B' : 'C';

    return {
      gradeBreakdown: [
        { category: 'Consistency', grade: runWorkouts.length >= 12 ? 'A' : 'B' },
        { category: 'Volume', grade: weeklyAvgKm >= 30 ? 'B+' : 'C+' },
        { category: 'Intensity', grade: intensityGrade },
        { category: 'Recovery', grade: undersleptRuns < runWorkouts.length * 0.3 ? 'B' : 'D' },
      ],
      volumeStatus: weeklyAvgKm >= 25 ? 'good' : 'caution',
      weeklyVolume,
      volumeInsights: {
        good: [`Averaging ${weeklyAvgKm.toFixed(1)}km/week over ${runWorkouts.length} runs`],
        improve: weeklyAvgKm < 30 ? ['Consider gradually increasing to 30-35km/week'] : [],
      },
      volumeRecommendation: 'Add 5-10% volume per week for 3 weeks, then deload.',
      hrStatus,
      hrZones,
      hrInsights,
      hrRecommendation: `Keep ${Math.round(maxHR * 0.60)}-${Math.round(maxHR * 0.70)} bpm (Zone 2) as your target for easy runs.`,
      maxHR,
      recoveryStatus: undersleptRuns > runWorkouts.length * 0.3 ? 'warning' : 'caution',
      sleepVsPace,
      recoveryIssues: {
        underslept: Math.round((undersleptRuns / runWorkouts.length) * 100),
        // Calculate low HRV runs from actual data
        lowHrv: hrvReadings.length > 0 ? (() => {
          const avgHRV = hrvReadings.reduce((sum, h) => sum + h.value, 0) / hrvReadings.length;
          const lowHrvRuns = runWorkouts.filter(w => {
            const hrvBefore = hrvReadings.find(h =>
              format(h.date, 'yyyy-MM-dd') === format(subDays(w.date, 1), 'yyyy-MM-dd')
            );
            return hrvBefore && hrvBefore.value < avgHRV * 0.85;
          }).length;
          return Math.round((lowHrvRuns / runWorkouts.length) * 100);
        })() : 0,
        // Calculate back-to-back hard runs
        backToBack: (() => {
          let count = 0;
          const sortedRuns = [...runWorkouts].sort((a, b) => a.date.getTime() - b.date.getTime());
          for (let i = 1; i < sortedRuns.length; i++) {
            const daysDiff = differenceInDays(sortedRuns[i].date, sortedRuns[i-1].date);
            const prevHard = (sortedRuns[i-1].avgPace || 999) < 300; // < 5:00/km
            const currHard = (sortedRuns[i].avgPace || 999) < 300;
            if (daysDiff === 1 && prevHard && currHard) count++;
          }
          return runWorkouts.length > 1 ? Math.round((count / (runWorkouts.length - 1)) * 100) : 0;
        })(),
      },
      recoveryRecommendation: 'Check HRV + sleep before hard workouts. Skip intensity when compromised.',
      injuryRisk: {
        level: trainingLoadMetrics && trainingLoadMetrics.acwr > 1.3 ? 'warning' : 'caution',
        factors: [
          { text: `ACWR: ${trainingLoadMetrics?.acwr.toFixed(2) || 'N/A'}`, status: trainingLoadMetrics && trainingLoadMetrics.acwr > 1.3 ? 'warning' : 'good' },
          { text: `${undersleptRuns} runs while fatigued`, status: undersleptRuns > 5 ? 'warning' : 'good' },
        ],
      },
      injuryRecommendation: 'Take a recovery week to reduce injury risk.',
      // Run categories from descriptions
      runCategories,
      categoryInsights,
      trainingBalance,
    };
  }, [recentWorkouts, recentSleep, trainingLoadMetrics, stravaHRZones]);

  const weeklySummary = useMemo((): WeeklySummaryData | null => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Use timestamps for reliable date comparison (IndexedDB dates may be strings)
    const weekStartTime = weekStart.getTime();
    const weekEndTime = weekEnd.getTime();

    const weekWorkouts = recentWorkouts.filter(w => {
      const wTime = new Date(w.date).getTime();
      return wTime >= weekStartTime && wTime <= weekEndTime;
    });
    const weekSleep = recentSleep.filter(s => {
      const sTime = new Date(s.date).getTime();
      return sTime >= weekStartTime && sTime <= weekEndTime;
    });

    const types: { type: string; count: number }[] = [];
    weekWorkouts.forEach(w => {
      const existing = types.find(t => t.type === w.type);
      if (existing) existing.count++;
      else types.push({ type: w.type, count: 1 });
    });

    const avgSleep = weekSleep.length > 0
      ? weekSleep.reduce((sum, s) => sum + s.duration, 0) / weekSleep.length / 60
      : 0;

    const avgHRV = hrvReadings.filter(h => h.date >= weekStart && h.date <= weekEnd)
      .reduce((sum, h, _, arr) => sum + h.value / arr.length, 0);

    const latestWeight = weightEntries.find(w => w.date >= weekStart);
    const prevWeekWeight = weightEntries.find(w => w.date < weekStart);
    const weightChange = latestWeight && prevWeekWeight ? latestWeight.weight - prevWeekWeight.weight : 0;

    const loadStatus = trainingLoadMetrics
      ? trainingLoadMetrics.acwr < 0.8 ? 'deload'
        : trainingLoadMetrics.acwr <= 1.3 ? 'optimal'
        : trainingLoadMetrics.acwr <= 1.5 ? 'building'
        : 'overreaching'
      : 'optimal';

    const overallStatus: 'good' | 'caution' | 'warning' =
      loadStatus === 'overreaching' ? 'warning' :
      avgSleep < 6.5 || loadStatus === 'building' ? 'caution' : 'good';

    const statusMessage =
      overallStatus === 'good' ? 'Good training week, well recovered' :
      overallStatus === 'caution' ? 'Training progressing, monitor recovery' :
      'High load detected, prioritize rest';

    return {
      weekStart,
      weekEnd,
      workouts: {
        count: weekWorkouts.length,
        types,
        totalDistance: weekWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0),
        totalDuration: weekWorkouts.reduce((sum, w) => sum + w.duration, 0),
      },
      avgSleep,
      avgHRV,
      weightChange,
      trainingLoadStatus: loadStatus,
      overallStatus,
      statusMessage,
    };
  }, [recentWorkouts, recentSleep, hrvReadings, weightEntries, trainingLoadMetrics]);

  // Strength standards as multipliers of bodyweight
  const STRENGTH_STANDARDS = {
    'bench press': { beginner: 0.5, novice: 0.75, intermediate: 1.0, advanced: 1.25, elite: 1.5 },
    'squat': { beginner: 0.75, novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
    'deadlift': { beginner: 1.0, novice: 1.25, intermediate: 1.75, advanced: 2.25, elite: 3.0 },
    'overhead press': { beginner: 0.35, novice: 0.5, intermediate: 0.65, advanced: 0.85, elite: 1.1 },
    'barbell row': { beginner: 0.4, novice: 0.6, intermediate: 0.8, advanced: 1.0, elite: 1.25 },
  };

  // Get user profile for age-adjusted standards
  const { profile } = useSettingsStore.getState();

  const liftingCritique = useMemo((): LiftingCritique | null => {
    // Use ALL historical workouts for finding PRs (not just recent)
    const strengthWorkouts = allHistoricalWorkouts.filter(w => w.exercises && w.exercises.length > 0);

    // Need at least 1 workout with exercises
    if (strengthWorkouts.length < 1) {
      console.log('Lifting critique: No workouts with exercises found');
      return null;
    }

    const bodyweight = weightEntries[0]?.weight || null;

    // Calculate age from birthYear
    const currentYear = new Date().getFullYear();
    const age = profile.birthYear ? currentYear - profile.birthYear : null;

    if (!bodyweight) {
      console.log('Lifting critique: No bodyweight data found');
      // Calculate frequency even without bodyweight
      const fourWeeksAgo = subDays(new Date(), 28);
      const recentStrengthWorkouts = strengthWorkouts.filter(w =>
        new Date(w.date).getTime() >= fourWeeksAgo.getTime()
      );
      const uniqueLiftDays = new Set(recentStrengthWorkouts.map(w =>
        format(new Date(w.date), 'yyyy-MM-dd')
      ));
      // Return a partial critique explaining what's needed
      return {
        overallGrade: '?',
        gradeDescription: 'Add bodyweight data to see strength analysis relative to your weight',
        bodyweight: null,
        age,
        benchmarks: [],
        strengths: [],
        weaknesses: ['Import weight data from Apple Health or add manual entries'],
        recommendations: ['Add bodyweight data to unlock full analysis'],
        muscleImbalances: [],
        topPriority: 'Add bodyweight data to see how your lifts compare to standards',
        weeklyFrequency: uniqueLiftDays.size / 4,
        totalSessions: strengthWorkouts.length,
      };
    }

    console.log('Lifting critique: Found', strengthWorkouts.length, 'workouts with exercises, bodyweight:', bodyweight, 'age:', age);

    // Age coefficient for strength standards (based on IPF Masters coefficients)
    // Peak strength is around 23-40, declines after
    const getAgeCoefficient = (age: number | null): number => {
      if (!age) return 1.0;
      if (age < 23) return 1.0; // Youth/junior - use standard
      if (age <= 40) return 1.0; // Prime years
      if (age <= 45) return 1.034;
      if (age <= 50) return 1.075;
      if (age <= 55) return 1.123;
      if (age <= 60) return 1.180;
      if (age <= 65) return 1.246;
      if (age <= 70) return 1.322;
      if (age <= 75) return 1.410;
      if (age <= 80) return 1.510;
      return 1.625; // 80+
    };

    const ageCoefficient = getAgeCoefficient(age);

    // Normalize exercise names
    const normalizeExercise = (name: string): string => {
      const n = name.toLowerCase().trim();
      const variations: Record<string, string> = {
        'bench press': 'bench press', 'benchpress': 'bench press', 'bench': 'bench press',
        'squat': 'squat', 'back squat': 'squat', 'barbell squat': 'squat',
        'deadlift': 'deadlift', 'dead lift': 'deadlift', 'dl': 'deadlift', 'deadlifts': 'deadlift',
        'overhead press': 'overhead press', 'ohp': 'overhead press', 'shoulder press': 'overhead press',
        'barbell row': 'barbell row', 'bent over row': 'barbell row', 'row': 'barbell row', 'rows': 'barbell row',
      };
      for (const [variant, canonical] of Object.entries(variations)) {
        if (n.includes(variant)) return canonical;
      }
      return n;
    };

    // Estimate 1RM
    const estimate1RM = (weight: number, reps: number): number => {
      if (reps === 1) return weight;
      return weight * (1 + reps / 30);
    };

    // Get level from ratio (can use age-adjusted ratio)
    const getLevel = (ratio: number, standards: { beginner: number; novice: number; intermediate: number; advanced: number; elite: number }): 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite' => {
      if (ratio >= standards.elite) return 'elite';
      if (ratio >= standards.advanced) return 'advanced';
      if (ratio >= standards.intermediate) return 'intermediate';
      if (ratio >= standards.novice) return 'novice';
      return 'beginner';
    };

    // Get percentile from ratio
    const getPercentile = (ratio: number, standards: { beginner: number; novice: number; intermediate: number; advanced: number; elite: number }): number => {
      if (ratio >= standards.elite) return 95;
      if (ratio >= standards.advanced) return 80;
      if (ratio >= standards.intermediate) return 50;
      if (ratio >= standards.novice) return 25;
      return Math.max(5, ratio / standards.novice * 25);
    };

    // Find best lifts from parsed Strava data
    const liftPRs = new Map<string, { weight: number; reps: number; est1RM: number }>();
    strengthWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const key = normalizeExercise(ex.exercise);
        const est1RM = estimate1RM(ex.weight, ex.reps);
        const existing = liftPRs.get(key);
        if (!existing || est1RM > existing.est1RM) {
          liftPRs.set(key, { weight: ex.weight, reps: ex.reps, est1RM });
        }
      });
    });

    // Apply manual PR overrides (these take priority)
    manualLiftPRs.forEach(pr => {
      const key = pr.category.toLowerCase();
      // Only override if manual PR is higher OR no parsed data exists
      const existing = liftPRs.get(key);
      if (!existing || pr.value >= existing.est1RM) {
        liftPRs.set(key, {
          weight: pr.value, // Manual PRs store est1RM as value
          reps: 1,
          est1RM: pr.value,
        });
      }
    });

    // Build benchmarks
    const benchmarks: LiftBenchmark[] = [];
    const majorLifts = ['bench press', 'squat', 'deadlift', 'overhead press', 'barbell row'];

    majorLifts.forEach(lift => {
      const pr = liftPRs.get(lift);
      const standards = STRENGTH_STANDARDS[lift as keyof typeof STRENGTH_STANDARDS];
      if (pr && standards) {
        const ratio = pr.est1RM / bodyweight;

        // Raw percentile (compared to peak-age lifters)
        const rawPercentile = getPercentile(ratio, standards);

        // Age-adjusted: multiply ratio by age coefficient to compare fairly
        const ageAdjustedRatio = ratio * ageCoefficient;
        const ageAdjustedPercentile = age && age > 40 ? getPercentile(ageAdjustedRatio, standards) : rawPercentile;

        // Use age-adjusted for level determination if over 40
        const effectiveRatio = age && age > 40 ? ageAdjustedRatio : ratio;
        const level = getLevel(effectiveRatio, standards);

        let recommendation = '';
        if (level === 'beginner') recommendation = `Focus on form. Target ${Math.round(standards.novice * bodyweight)}kg.`;
        else if (level === 'novice') recommendation = `Good start. Target ${Math.round(standards.intermediate * bodyweight)}kg.`;
        else if (level === 'intermediate') recommendation = `Solid. Target ${Math.round(standards.advanced * bodyweight)}kg.`;
        else if (level === 'advanced') recommendation = `Strong! Target ${Math.round(standards.elite * bodyweight)}kg.`;
        else recommendation = 'Elite level! Maintain and prevent injury.';

        benchmarks.push({
          exercise: lift.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          currentMax: pr.weight,
          reps: pr.reps,
          est1RM: Math.round(pr.est1RM),
          bodyweightRatio: ratio,
          level,
          percentile: rawPercentile,
          ageAdjustedPercentile: age && age > 40 ? ageAdjustedPercentile : undefined,
          recommendation,
        });
      }
    });

    if (benchmarks.length === 0) return null;

    // Sort by effective percentile (weakest first) - use age-adjusted if available
    benchmarks.sort((a, b) => {
      const aPerc = a.ageAdjustedPercentile ?? a.percentile;
      const bPerc = b.ageAdjustedPercentile ?? b.percentile;
      return aPerc - bPerc;
    });

    // Calculate overall grade using age-adjusted percentiles if available
    const avgPercentile = benchmarks.reduce((sum, b) => sum + (b.ageAdjustedPercentile ?? b.percentile), 0) / benchmarks.length;
    let overallGrade = 'C';
    if (avgPercentile >= 90) overallGrade = 'A';
    else if (avgPercentile >= 75) overallGrade = 'B+';
    else if (avgPercentile >= 60) overallGrade = 'B';
    else if (avgPercentile >= 45) overallGrade = 'B-';
    else if (avgPercentile >= 35) overallGrade = 'C+';
    else if (avgPercentile >= 25) overallGrade = 'C';

    // Find strengths and weaknesses using effective percentile
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    benchmarks.forEach(b => {
      const effectivePerc = b.ageAdjustedPercentile ?? b.percentile;
      if (effectivePerc >= 60) strengths.push(`${b.exercise}: ${b.level} level (${b.bodyweightRatio.toFixed(2)}x BW)`);
      if (effectivePerc < 40) weaknesses.push(`${b.exercise} is below average - focus on ${b.exercise.toLowerCase().includes('press') ? 'chest/shoulders' : b.exercise.toLowerCase().includes('row') ? 'back' : 'legs'}`);
    });

    // Check for imbalances
    const muscleImbalances: { area: string; issue: string }[] = [];
    const benchPR = liftPRs.get('bench press');
    const rowPR = liftPRs.get('barbell row');
    if (benchPR && rowPR) {
      const benchRatio = benchPR.est1RM / bodyweight;
      const rowRatio = rowPR.est1RM / bodyweight;
      if (benchRatio > rowRatio * 1.3) {
        muscleImbalances.push({ area: 'Push/Pull', issue: 'Bench stronger than row - add more back work' });
      }
    }

    const squatPR = liftPRs.get('squat');
    const deadliftPR = liftPRs.get('deadlift');
    if (squatPR && deadliftPR) {
      const squatRatio = squatPR.est1RM / bodyweight;
      const deadliftRatio = deadliftPR.est1RM / bodyweight;
      if (deadliftRatio > squatRatio * 1.5) {
        muscleImbalances.push({ area: 'Legs', issue: 'Deadlift much stronger than squat - work on quads' });
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (weaknesses.length > 0) {
      recommendations.push(`Priority: Improve ${benchmarks[0].exercise}`);
    }
    if (muscleImbalances.length > 0) {
      recommendations.push(`Fix imbalance: ${muscleImbalances[0].issue}`);
    }

    const topPriority = weaknesses.length > 0
      ? `Focus on ${benchmarks[0].exercise} - currently at ${benchmarks[0].level} level`
      : strengths.length > 0
      ? 'Maintain your strong lifts and work on consistency'
      : 'Build more lift data for analysis';

    // Calculate lifting frequency using last 4 weeks of data (more accurate than full history)
    const fourWeeksAgo = subDays(new Date(), 28);
    const recentStrengthWorkouts = strengthWorkouts.filter(w =>
      new Date(w.date).getTime() >= fourWeeksAgo.getTime()
    );
    const uniqueLiftDays = new Set(recentStrengthWorkouts.map(w =>
      format(new Date(w.date), 'yyyy-MM-dd')
    ));
    const weeklyFrequency = uniqueLiftDays.size / 4; // sessions per week over 4 weeks
    const totalSessions = strengthWorkouts.length;

    // Build grade description with age context
    let gradeDescription = avgPercentile >= 60
      ? 'Above average strength across major lifts'
      : avgPercentile >= 40
      ? 'Developing strength with room to grow'
      : 'Building foundation - focus on progressive overload';

    if (age && age > 40) {
      gradeDescription += ` (age-adjusted for ${age} years old)`;
    }

    return {
      overallGrade,
      gradeDescription,
      bodyweight,
      age,
      benchmarks,
      strengths,
      weaknesses,
      recommendations,
      muscleImbalances,
      topPriority,
      weeklyFrequency,
      totalSessions,
    };
  }, [allHistoricalWorkouts, weightEntries, profile.birthYear, manualLiftPRs]);

  return {
    todayRecommendation,
    quickStats,
    insights,
    weeklySummary,
    runningCritique,
    runningStats,
    liftingCritique,
    isLoading,
  };
}
