/**
 * Acute:Chronic Workload Ratio (ACWR) Algorithm
 * Used for injury risk assessment and training load management
 *
 * ACWR = Acute Load / Chronic Load
 *
 * Where:
 * - Acute Load = sum of training stress over the last 7 days
 * - Chronic Load = average daily training stress over the last 28 days
 *
 * Risk Zones:
 * - < 0.8: Undertrained (detraining risk, low fitness)
 * - 0.8 - 1.3: Optimal (sweet spot for training)
 * - 1.3 - 1.5: Overreaching (increased injury risk)
 * - > 1.5: Danger zone (high injury risk)
 */

export type RiskZone = 'undertrained' | 'optimal' | 'overreaching' | 'danger';
export type LoadTrend = 'increasing' | 'stable' | 'decreasing';

/**
 * Calculate ACWR from daily training stress values
 * @param dailyLoads Array of daily TSS values (should be 28 days)
 * @returns ACWR value
 */
export function calculateACWR(dailyLoads: number[]): number {
  if (dailyLoads.length < 7) return 0;

  // Ensure we have at least 28 days, pad with zeros if needed
  const paddedLoads = [...Array(Math.max(0, 28 - dailyLoads.length)).fill(0), ...dailyLoads].slice(-28);

  // Acute load: sum of last 7 days
  const acuteLoad = paddedLoads.slice(-7).reduce((a, b) => a + b, 0);

  // Chronic load: average daily load over 28 days
  const chronicLoad = paddedLoads.reduce((a, b) => a + b, 0) / 28;

  if (chronicLoad === 0) return acuteLoad > 0 ? 2.0 : 0;

  // ACWR = weekly acute load / (chronic daily average * 7)
  return acuteLoad / (chronicLoad * 7);
}

/**
 * Calculate ACWR using Exponentially Weighted Moving Average (EWMA)
 * More sophisticated version that weights recent data more heavily
 */
export function calculateEWMAACWR(dailyLoads: number[], acuteLambda = 0.875, chronicLambda = 0.964): number {
  if (dailyLoads.length < 7) return 0;

  let acuteEWMA = 0;
  let chronicEWMA = 0;

  for (let i = 0; i < dailyLoads.length; i++) {
    if (i === 0) {
      acuteEWMA = dailyLoads[i];
      chronicEWMA = dailyLoads[i];
    } else {
      acuteEWMA = dailyLoads[i] * (1 - acuteLambda) + acuteEWMA * acuteLambda;
      chronicEWMA = dailyLoads[i] * (1 - chronicLambda) + chronicEWMA * chronicLambda;
    }
  }

  if (chronicEWMA === 0) return 0;
  return acuteEWMA / chronicEWMA;
}

/**
 * Determine risk zone based on ACWR value
 */
export function calculateRiskZone(acwr: number): RiskZone {
  if (acwr < 0.8) return 'undertrained';
  if (acwr <= 1.3) return 'optimal';
  if (acwr <= 1.5) return 'overreaching';
  return 'danger';
}

/**
 * Get risk zone color for UI
 */
export function getRiskZoneColor(zone: RiskZone): string {
  switch (zone) {
    case 'undertrained':
      return '#f59e0b'; // warning/yellow
    case 'optimal':
      return '#22c55e'; // success/green
    case 'overreaching':
      return '#f97316'; // orange
    case 'danger':
      return '#ef4444'; // danger/red
  }
}

/**
 * Get risk zone description
 */
export function getRiskZoneDescription(zone: RiskZone): string {
  switch (zone) {
    case 'undertrained':
      return 'Training load is low. Consider increasing volume to maintain fitness.';
    case 'optimal':
      return 'Training load is well balanced. Good for sustainable progress.';
    case 'overreaching':
      return 'Training load is elevated. Monitor for fatigue and consider recovery.';
    case 'danger':
      return 'Training load spike detected. High injury risk. Rest recommended.';
  }
}

/**
 * Calculate load trend over recent period
 */
export function calculateTrend(dailyLoads: number[]): LoadTrend {
  if (dailyLoads.length < 14) return 'stable';

  const firstWeek = dailyLoads.slice(-14, -7).reduce((a, b) => a + b, 0);
  const secondWeek = dailyLoads.slice(-7).reduce((a, b) => a + b, 0);

  const change = (secondWeek - firstWeek) / (firstWeek || 1);

  if (change > 0.1) return 'increasing';
  if (change < -0.1) return 'decreasing';
  return 'stable';
}

/**
 * Calculate Training Stress Score (TSS) for a workout
 * Simplified version based on duration and intensity
 */
export function calculateTSS(
  durationMinutes: number,
  intensity: number, // 0-1 scale
  type: 'run' | 'cycle' | 'swim' | 'strength' | 'walk' | 'hike' | 'other'
): number {
  // Base TSS per minute by activity type
  const baseRates: Record<string, number> = {
    run: 1.2,
    cycle: 0.8,
    swim: 1.0,
    strength: 0.6,
    walk: 0.3,
    hike: 0.5,
    other: 0.5,
  };

  const baseRate = baseRates[type] || 0.5;
  const intensityFactor = 0.5 + intensity * 1.5; // Range from 0.5 to 2.0

  return durationMinutes * baseRate * intensityFactor;
}

/**
 * Calculate intensity from heart rate
 */
export function calculateIntensityFromHR(
  avgHR: number,
  maxHR: number,
  restingHR: number = 60
): number {
  // Heart Rate Reserve method
  const hrReserve = maxHR - restingHR;
  const intensity = (avgHR - restingHR) / hrReserve;
  return Math.max(0, Math.min(1, intensity));
}

/**
 * Calculate intensity from pace (for running)
 */
export function calculateIntensityFromPace(
  paceSecondsPerKm: number,
  thresholdPace: number = 300 // 5:00/km default threshold
): number {
  // Faster pace = higher intensity
  const intensity = thresholdPace / paceSecondsPerKm;
  return Math.max(0, Math.min(1, intensity));
}

/**
 * Generate recovery recommendation based on metrics
 */
export function getRecoveryRecommendation(
  _acwr: number,
  zone: RiskZone,
  hrvTrend: 'up' | 'down' | 'stable',
  sleepScore?: number
): string {
  if (zone === 'danger') {
    return 'Take a rest day or do very light recovery activity only.';
  }

  if (zone === 'overreaching') {
    if (hrvTrend === 'down' || (sleepScore && sleepScore < 70)) {
      return 'Consider a rest day or light aerobic workout. HRV/sleep suggest fatigue.';
    }
    return 'Do an easy recovery session. Avoid high intensity.';
  }

  if (zone === 'optimal') {
    if (hrvTrend === 'up' && (!sleepScore || sleepScore > 75)) {
      return 'Good recovery indicators. Ready for a quality session.';
    }
    return 'Continue training as planned. Recovery looks adequate.';
  }

  // Undertrained
  return 'Training load is low. Good opportunity for a harder session if recovery permits.';
}

/**
 * Detect if a deload week is needed
 */
export function needsDeloadWeek(
  weeklyLoads: number[], // Last 4-6 weeks of total weekly load
  acwr: number
): boolean {
  if (weeklyLoads.length < 3) return false;

  // Check if we've had 3+ progressive weeks
  let progressiveWeeks = 0;
  for (let i = 1; i < weeklyLoads.length; i++) {
    if (weeklyLoads[i] > weeklyLoads[i - 1] * 1.05) {
      progressiveWeeks++;
    }
  }

  // Deload after 3-4 progressive weeks or if ACWR is high
  return progressiveWeeks >= 3 || acwr > 1.4;
}
