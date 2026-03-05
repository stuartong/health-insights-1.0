/**
 * Utility functions for formatting values
 */

export function formatNumber(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

export function formatPercent(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export function formatDurationLong(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${hours}h ${mins}m`;
}

export function formatTimeFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatPace(secondsPerKm: number, unit: 'km' | 'mi' | 'miles' = 'km'): string {
  let pace = secondsPerKm;
  const isMiles = unit === 'mi' || unit === 'miles';
  if (isMiles) {
    pace = secondsPerKm * 1.60934;
  }
  const minutes = Math.floor(pace / 60);
  const seconds = Math.round(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/${isMiles ? 'mi' : 'km'}`;
}

export function formatDistance(meters: number, unit: 'km' | 'mi' | 'miles' = 'km'): string {
  const isMiles = unit === 'mi' || unit === 'miles';
  if (isMiles) {
    const miles = meters / 1609.34;
    return `${miles.toFixed(2)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

export function formatWeight(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  if (unit === 'lbs') {
    const lbs = kg * 2.20462;
    return `${lbs.toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}

export function formatWeightChange(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  const sign = kg > 0 ? '+' : '';
  if (unit === 'lbs') {
    const lbs = kg * 2.20462;
    return `${sign}${lbs.toFixed(1)} lbs`;
  }
  return `${sign}${kg.toFixed(1)} kg`;
}

export function formatCalories(cal: number): string {
  if (cal >= 1000) {
    return `${(cal / 1000).toFixed(1)}k`;
  }
  return `${Math.round(cal)}`;
}

export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

export function formatHRV(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

export function formatElevation(meters: number, unit: 'km' | 'mi' | 'miles' = 'km'): string {
  const isMiles = unit === 'mi' || unit === 'miles';
  if (isMiles) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }
  return `${Math.round(meters)} m`;
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatACWR(value: number): string {
  return value.toFixed(2);
}

export function formatTSS(value: number): string {
  return Math.round(value).toString();
}

export function formatScore(value: number): string {
  return Math.round(value).toString();
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

export function formatList(items: string[], limit: number = 3): string {
  if (items.length <= limit) {
    return items.join(', ');
  }
  const shown = items.slice(0, limit);
  const remaining = items.length - limit;
  return `${shown.join(', ')} +${remaining} more`;
}
