/**
 * Oura Ring API Client
 * Uses personal access token for authentication
 * API docs: https://cloud.ouraring.com/docs/
 */

import type { SleepRecord, HRVReading } from '@/types';
import { format, subDays } from 'date-fns';

/**
 * Build API URL for Oura proxy - works on both localhost and deployed site
 * Uses query param approach: /api/oura?path=/sleep&start_date=...
 */
const buildApiUrl = (endpoint: string, params: Record<string, string> = {}) => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(`${base}/api/oura`);
  url.searchParams.set('path', endpoint);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

interface OuraApiResponse<T> {
  data: T[];
  next_token?: string;
}

interface OuraSleepDocument {
  id: string;
  day: string;
  bedtime_start: string;
  bedtime_end: string;
  time_in_bed: number;
  total_sleep_duration: number;
  efficiency: number;
  deep_sleep_duration: number;
  rem_sleep_duration: number;
  light_sleep_duration: number;
  awake_time: number;
  average_hrv: number;
  lowest_heart_rate: number;
}

interface OuraDailySleepDocument {
  id: string;
  day: string;
  score: number;
  contributors: {
    deep_sleep: number;
    efficiency: number;
    latency: number;
    rem_sleep: number;
    restfulness: number;
    timing: number;
    total_sleep: number;
  };
}

interface OuraReadinessDocument {
  id: string;
  day: string;
  score: number;
  temperature_deviation: number;
  contributors: {
    activity_balance: number;
    body_temperature: number;
    hrv_balance: number;
    previous_day_activity: number;
    previous_night: number;
    recovery_index: number;
    resting_heart_rate: number;
    sleep_balance: number;
  };
}


function generateId(): string {
  return `oura_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export class OuraClient {
  private token: string;

  constructor(personalAccessToken: string) {
    this.token = personalAccessToken;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = buildApiUrl(endpoint, params);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Oura API token. Please check your personal access token.');
      }
      throw new Error(`Oura API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetch<OuraApiResponse<OuraDailySleepDocument>>('/daily_sleep', {
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
      });
      return true;
    } catch {
      return false;
    }
  }

  async fetchSleepData(startDate: Date, endDate: Date): Promise<SleepRecord[]> {
    const sleepResponse = await this.fetch<OuraApiResponse<OuraSleepDocument>>('/sleep', {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    });

    const dailySleepResponse = await this.fetch<OuraApiResponse<OuraDailySleepDocument>>('/daily_sleep', {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    });

    // Map daily scores by day
    const scoresByDay = new Map<string, number>();
    for (const daily of dailySleepResponse.data) {
      scoresByDay.set(daily.day, daily.score);
    }

    // Oura can return multiple sleep sessions per day (main sleep + naps)
    // Aggregate all sessions for the same day to get total sleep
    const sleepByDay = new Map<string, OuraSleepDocument[]>();
    for (const sleep of sleepResponse.data) {
      if (!sleepByDay.has(sleep.day)) {
        sleepByDay.set(sleep.day, []);
      }
      sleepByDay.get(sleep.day)!.push(sleep);
    }

    const results: SleepRecord[] = [];
    for (const [day, sessions] of sleepByDay.entries()) {
      // Find the main sleep session (longest duration)
      const mainSleep = sessions.reduce((longest, s) =>
        s.total_sleep_duration > longest.total_sleep_duration ? s : longest
      );

      // Sum up all sleep for the day
      const totalSleepDuration = sessions.reduce((sum, s) => sum + s.total_sleep_duration, 0);
      const totalDeepSleep = sessions.reduce((sum, s) => sum + s.deep_sleep_duration, 0);
      const totalRemSleep = sessions.reduce((sum, s) => sum + s.rem_sleep_duration, 0);
      const totalLightSleep = sessions.reduce((sum, s) => sum + s.light_sleep_duration, 0);
      const totalAwake = sessions.reduce((sum, s) => sum + s.awake_time, 0);

      // Use main sleep's bedtime/waketime and average metrics
      const avgEfficiency = sessions.reduce((sum, s) => sum + s.efficiency, 0) / sessions.length;
      const avgHRV = sessions.filter(s => s.average_hrv > 0).reduce((sum, s) => sum + s.average_hrv, 0) /
                     Math.max(1, sessions.filter(s => s.average_hrv > 0).length);
      const lowestHR = Math.min(...sessions.filter(s => s.lowest_heart_rate > 0).map(s => s.lowest_heart_rate));

      results.push({
        id: generateId(),
        source: 'oura' as const,
        date: new Date(day),
        bedtime: mainSleep.bedtime_start ? new Date(mainSleep.bedtime_start) : undefined,
        wakeTime: mainSleep.bedtime_end ? new Date(mainSleep.bedtime_end) : undefined,
        duration: totalSleepDuration / 60, // Convert seconds to minutes
        efficiency: avgEfficiency,
        deepSleep: totalDeepSleep / 60,
        remSleep: totalRemSleep / 60,
        lightSleep: totalLightSleep / 60,
        awake: totalAwake / 60,
        hrv: avgHRV > 0 ? avgHRV : undefined,
        restingHR: lowestHR > 0 && lowestHR !== Infinity ? lowestHR : undefined,
        score: scoresByDay.get(day),
      });
    }

    return results;
  }

  async fetchReadinessData(startDate: Date, endDate: Date): Promise<{
    readinessScores: Map<string, number>;
    hrvReadings: HRVReading[];
  }> {
    const response = await this.fetch<OuraApiResponse<OuraReadinessDocument>>('/daily_readiness', {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    });

    const readinessScores = new Map<string, number>();
    const hrvReadings: HRVReading[] = [];

    for (const readiness of response.data) {
      readinessScores.set(readiness.day, readiness.score);

      // HRV balance can be used as a proxy for HRV reading
      if (readiness.contributors.hrv_balance) {
        hrvReadings.push({
          id: generateId(),
          source: 'oura',
          date: new Date(readiness.day),
          value: readiness.contributors.hrv_balance,
          context: 'morning',
        });
      }
    }

    return { readinessScores, hrvReadings };
  }

  async fetchHeartRateData(startDate: Date, endDate: Date): Promise<HRVReading[]> {
    // Oura v2 API provides HRV through sleep data primarily
    // This method is for additional HRV readings if available
    const sleepData = await this.fetchSleepData(startDate, endDate);

    return sleepData
      .filter((sleep) => sleep.hrv !== undefined)
      .map((sleep) => ({
        id: generateId(),
        source: 'oura' as const,
        date: sleep.date,
        value: sleep.hrv!,
        context: 'sleep' as const,
      }));
  }

  async fetchAllData(daysBack: number = 30): Promise<{
    sleepRecords: SleepRecord[];
    hrvReadings: HRVReading[];
    readinessScores: Map<string, number>;
  }> {
    const endDate = new Date();
    const startDate = subDays(endDate, daysBack);

    const [sleepRecords, readinessData, additionalHRV] = await Promise.all([
      this.fetchSleepData(startDate, endDate),
      this.fetchReadinessData(startDate, endDate),
      this.fetchHeartRateData(startDate, endDate),
    ]);

    // Merge HRV readings from different sources
    const hrvMap = new Map<string, HRVReading>();
    for (const hrv of [...readinessData.hrvReadings, ...additionalHRV]) {
      const key = format(hrv.date, 'yyyy-MM-dd');
      // Keep the reading with higher value (likely more accurate)
      const existing = hrvMap.get(key);
      if (!existing || hrv.value > existing.value) {
        hrvMap.set(key, hrv);
      }
    }

    return {
      sleepRecords,
      hrvReadings: Array.from(hrvMap.values()),
      readinessScores: readinessData.readinessScores,
    };
  }
}

// Validate token format
export function isValidOuraToken(token: string): boolean {
  // Oura personal access tokens are typically long alphanumeric strings
  return token.length > 20 && /^[A-Za-z0-9_-]+$/.test(token);
}
