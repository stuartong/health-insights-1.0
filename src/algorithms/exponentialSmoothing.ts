/**
 * Exponential Smoothing Algorithm
 * Used for weight trend calculation (Happy Scale style)
 *
 * The algorithm smooths out daily fluctuations to show the true trend.
 * Formula: S[t] = α * X[t] + (1 - α) * S[t-1]
 *
 * Where:
 * - S[t] = smoothed value at time t
 * - X[t] = raw value at time t
 * - α = smoothing factor (0 < α < 1)
 * - Lower α = smoother curve (more resistant to change)
 * - Higher α = more responsive to recent changes
 */

export function exponentialSmoothing(data: number[], alpha = 0.1): number[] {
  if (data.length === 0) return [];
  if (data.length === 1) return [data[0]];

  const smoothed: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    smoothed[i] = alpha * data[i] + (1 - alpha) * smoothed[i - 1];
  }

  return smoothed;
}

/**
 * Double Exponential Smoothing (Holt's Method)
 * Better for data with trends - accounts for both level and trend
 */
export function doubleExponentialSmoothing(
  data: number[],
  alpha = 0.1,
  beta = 0.1
): { smoothed: number[]; trend: number[] } {
  if (data.length === 0) return { smoothed: [], trend: [] };
  if (data.length === 1) return { smoothed: [data[0]], trend: [0] };

  const smoothed: number[] = [data[0]];
  const trend: number[] = [data[1] - data[0]];

  for (let i = 1; i < data.length; i++) {
    smoothed[i] = alpha * data[i] + (1 - alpha) * (smoothed[i - 1] + trend[i - 1]);
    trend[i] = beta * (smoothed[i] - smoothed[i - 1]) + (1 - beta) * trend[i - 1];
  }

  return { smoothed, trend };
}

/**
 * Simple Moving Average
 * Averages the last N values
 */
export function simpleMovingAverage(data: number[], window: number): number[] {
  if (data.length === 0) return [];
  if (window <= 0) return data;

  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }

  return result;
}

/**
 * Weighted Moving Average
 * More recent values have higher weight
 */
export function weightedMovingAverage(data: number[], window: number): number[] {
  if (data.length === 0) return [];
  if (window <= 0) return data;

  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);

    let weightSum = 0;
    let valueSum = 0;

    for (let j = 0; j < slice.length; j++) {
      const weight = j + 1;
      weightSum += weight;
      valueSum += slice[j] * weight;
    }

    result.push(valueSum / weightSum);
  }

  return result;
}

/**
 * Calculate rate of change (trend direction and magnitude)
 */
export function calculateTrendRate(
  smoothedData: number[],
  window = 7
): { rate: number; direction: 'up' | 'down' | 'stable' } {
  if (smoothedData.length < 2) {
    return { rate: 0, direction: 'stable' };
  }

  const recent = smoothedData.slice(-window);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const rate = (last - first) / first;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (rate > 0.005) direction = 'up';
  else if (rate < -0.005) direction = 'down';

  return { rate, direction };
}

/**
 * Project future weight based on current trend
 */
export function projectWeight(
  currentWeight: number,
  weeklyChange: number,
  weeksAhead: number
): number {
  return currentWeight + weeklyChange * weeksAhead;
}

/**
 * Calculate days to reach goal weight based on current trend
 */
export function daysToGoal(
  currentWeight: number,
  goalWeight: number,
  dailyChange: number
): number | null {
  if (dailyChange === 0) return null;

  const diff = goalWeight - currentWeight;

  // Check if we're moving in the right direction
  if ((diff > 0 && dailyChange < 0) || (diff < 0 && dailyChange > 0)) {
    return null; // Moving away from goal
  }

  return Math.abs(diff / dailyChange);
}

/**
 * Detect weight plateau (minimal change over a period)
 */
export function detectPlateau(
  weights: number[],
  window = 14,
  threshold = 0.5 // kg
): boolean {
  if (weights.length < window) return false;

  const recent = weights.slice(-window);
  const smoothed = exponentialSmoothing(recent, 0.2);
  const first = smoothed[0];
  const last = smoothed[smoothed.length - 1];

  return Math.abs(last - first) < threshold;
}
