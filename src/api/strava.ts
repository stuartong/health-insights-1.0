/**
 * Strava API Client
 * Uses OAuth2 for authentication
 * API docs: https://developers.strava.com/docs/reference/
 */

import type { Workout, WorkoutType, RunCategory } from '@/types';
import { subDays } from 'date-fns';
import { parseWorkoutDescription } from './claude';

// Use proxy server to avoid CORS issues
const STRAVA_API_BASE = 'http://localhost:3001/api/strava';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'http://localhost:3001/api/strava-token';

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  suffer_score?: number;
  average_cadence?: number;
  average_watts?: number;
  description?: string;
}

interface StravaActivityDetail extends StravaActivity {
  description: string;
  best_efforts?: StravaBestEffort[];
}

interface StravaBestEffort {
  id: number;
  name: string; // "400m", "1/2 mile", "1k", "1 mile", "2 mile", "5k", "10k", "15k", "10 mile", "Half-Marathon", "Marathon"
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  start_date: string;
  distance: number; // meters
  pr_rank: number | null; // 1, 2, 3 for top 3 efforts, null otherwise
}

import type { StravaRunningPR } from '@/types';

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

export interface StravaHRZone {
  min: number;
  max: number;  // -1 means no upper limit
}

interface StravaZonesResponse {
  heart_rate: {
    custom_zones: boolean;
    zones: StravaHRZone[];
  };
}

function generateId(): string {
  return `strava_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function mapStravaType(stravaType: string): WorkoutType {
  const typeMap: Record<string, WorkoutType> = {
    Run: 'run',
    TrailRun: 'run',
    VirtualRun: 'run',
    Ride: 'cycle',
    VirtualRide: 'cycle',
    MountainBikeRide: 'cycle',
    GravelRide: 'cycle',
    EBikeRide: 'cycle',
    Swim: 'swim',
    Walk: 'walk',
    Hike: 'hike',
    WeightTraining: 'strength',
    Crossfit: 'strength',
    CrossTraining: 'strength',
    Workout: 'strength',
    HIIT: 'strength',
    Elliptical: 'other',
    StairStepper: 'other',
    Rowing: 'other',
    Yoga: 'other',
  };
  return typeMap[stravaType] || 'other';
}

// Parse lift data from activity description
// Supports formats like:
// - "Squat 3x5 100kg"
// - "Bench Press: 80kg x 5 x 3"
// - "Deadlift 140kg 5 reps"
// - "OHP 4x8 @ 50kg"
interface ParsedLift {
  exercise: string;
  weight: number;
  reps: number;
  sets?: number;
}

// Parse run description to extract category and context
interface ParsedRunContext {
  category: RunCategory;
  plannedPace?: string;
  intervals?: string;
}

function parseRunDescription(name: string, description: string): ParsedRunContext {
  const text = `${name} ${description}`.toLowerCase();

  // Check for interval/speed work
  const intervalPatterns = [
    /(\d+)\s*x\s*(\d+)\s*m/i,  // "6x800m", "4 x 400 m"
    /(\d+)\s*x\s*(\d+)\s*k/i,  // "3x1k"
    /intervals?/i,
    /repeats?/i,
    /speed\s*work/i,
    /track/i,
    /vo2/i,
  ];

  for (const pattern of intervalPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        category: 'interval',
        intervals: match[0],
      };
    }
  }

  // Check for tempo/threshold
  if (/tempo/i.test(text) || /threshold/i.test(text) || /lt\s*run/i.test(text) || /cruise/i.test(text)) {
    // Try to extract pace
    const paceMatch = text.match(/(\d+[:\.]?\d*)\s*(?:\/km|min\/km|pace)/i);
    return {
      category: 'tempo',
      plannedPace: paceMatch ? paceMatch[1] : undefined,
    };
  }

  // Check for long run
  if (/long\s*run/i.test(text) || /lsd/i.test(text) || /endurance/i.test(text)) {
    return { category: 'long' };
  }

  // Check for easy/recovery
  if (/easy/i.test(text) || /recovery/i.test(text) || /shake\s*out/i.test(text) || /jog/i.test(text)) {
    return { category: 'easy' };
  }

  // Check for race
  if (/race/i.test(text) || /parkrun/i.test(text) || /5k\s*race/i.test(text) || /10k\s*race/i.test(text) ||
      /half\s*marathon/i.test(text) || /marathon/i.test(text) || /pb/i.test(text) || /pr\b/i.test(text)) {
    return { category: 'race' };
  }

  // Check for hills
  if (/hill/i.test(text) || /incline/i.test(text) || /climb/i.test(text)) {
    return { category: 'hills' };
  }

  // Check for fartlek
  if (/fartlek/i.test(text)) {
    return { category: 'fartlek' };
  }

  // Default to unknown - will be inferred from HR/pace if needed
  return { category: 'unknown' };
}

function parseLiftData(description: string): ParsedLift[] {
  if (!description) return [];

  const lifts: ParsedLift[] = [];
  const lines = description.split(/[\n,;]/);

  // Common exercise name patterns
  const exercisePatterns = [
    'squat', 'bench', 'deadlift', 'press', 'row', 'curl', 'pull',
    'ohp', 'rdl', 'lunge', 'fly', 'raise', 'extension', 'pushdown',
    'dip', 'chin', 'pullup', 'pull-up', 'push-up', 'pushup',
  ];

  for (const line of lines) {
    const cleanLine = line.trim().toLowerCase();
    if (!cleanLine) continue;

    // Check if line contains an exercise
    const hasExercise = exercisePatterns.some(p => cleanLine.includes(p));
    if (!hasExercise) continue;

    // Try to parse various formats

    // Format: "Exercise SetsxReps Weight" (e.g., "Squat 3x5 100kg")
    let match = cleanLine.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)\s+(\d+(?:\.\d+)?)\s*(?:kg|lbs?)?$/i);
    if (match) {
      lifts.push({
        exercise: match[1].trim(),
        sets: parseInt(match[2]),
        reps: parseInt(match[3]),
        weight: parseFloat(match[4]),
      });
      continue;
    }

    // Format: "Exercise: Weight x Reps x Sets" (e.g., "Bench: 80kg x 5 x 3")
    match = cleanLine.match(/^(.+?)[:]\s*(\d+(?:\.\d+)?)\s*(?:kg|lbs?)?\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i);
    if (match) {
      lifts.push({
        exercise: match[1].trim(),
        weight: parseFloat(match[2]),
        reps: parseInt(match[3]),
        sets: parseInt(match[4]),
      });
      continue;
    }

    // Format: "Exercise Weight Reps reps" (e.g., "Deadlift 140kg 5 reps")
    match = cleanLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:kg|lbs?)?\s+(\d+)\s*(?:reps?|x)?/i);
    if (match) {
      lifts.push({
        exercise: match[1].trim(),
        weight: parseFloat(match[2]),
        reps: parseInt(match[3]),
      });
      continue;
    }

    // Format: "Exercise SetsxReps @ Weight" (e.g., "OHP 4x8 @ 50kg")
    match = cleanLine.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)\s*[@]\s*(\d+(?:\.\d+)?)\s*(?:kg|lbs?)?/i);
    if (match) {
      lifts.push({
        exercise: match[1].trim(),
        sets: parseInt(match[2]),
        reps: parseInt(match[3]),
        weight: parseFloat(match[4]),
      });
      continue;
    }

    // Simpler format: just "Exercise Weight" for any line with a weight
    match = cleanLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:kg|lbs?)$/i);
    if (match && hasExercise) {
      lifts.push({
        exercise: match[1].trim(),
        weight: parseFloat(match[2]),
        reps: 1, // Assume 1RM if no reps specified
      });
    }
  }

  return lifts;
}

export class StravaClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null;
  private refreshToken: string | null;
  private tokenExpiry: number | null;

  constructor(
    clientId: string,
    clientSecret: string,
    accessToken?: string,
    refreshToken?: string,
    tokenExpiry?: number
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken || null;
    this.refreshToken = refreshToken || null;
    this.tokenExpiry = tokenExpiry || null;
  }

  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'activity:read_all,profile:read_all',
      approval_prompt: 'auto',
    });

    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data: StravaTokenResponse = await response.json();

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = data.expires_at;

    return data;
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data: StravaTokenResponse = await response.json();

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = data.expires_at;
  }

  /**
   * Check if token needs refresh and refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Strava');
    }

    if (this.tokenExpiry && Date.now() / 1000 > this.tokenExpiry - 300) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Make an authenticated API request
   */
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureValidToken();

    const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Strava authentication failed. Please reconnect.');
      }
      throw new Error(`Strava API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test connection by fetching athlete profile
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.fetch('/athlete');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch a single activity's details (includes description)
   */
  async fetchActivityDetail(activityId: number): Promise<StravaActivityDetail> {
    return this.fetch<StravaActivityDetail>(`/activities/${activityId}`);
  }

  /**
   * Collection of best efforts found during activity sync
   * We collect these as we fetch activity details, then return the best for each distance
   */
  private bestEfforts = new Map<string, StravaRunningPR>();

  /**
   * Get the collected running PRs (best effort for each distance)
   */
  getRunningPRs(): StravaRunningPR[] {
    return Array.from(this.bestEfforts.values());
  }

  /**
   * Clear collected PRs (call before a fresh sync)
   */
  clearRunningPRs(): void {
    this.bestEfforts.clear();
  }

  /**
   * Process best efforts from an activity detail response
   */
  private processBestEfforts(activityId: number, bestEfforts: StravaBestEffort[]): void {
    for (const effort of bestEfforts) {
      const existing = this.bestEfforts.get(effort.name);
      if (!existing || effort.elapsed_time < existing.time) {
        this.bestEfforts.set(effort.name, {
          distance: effort.name,
          distanceMeters: effort.distance,
          time: effort.elapsed_time,
          date: new Date(effort.start_date).toISOString(),
          activityId: activityId,
        });
      }
    }
  }

  /**
   * Fetch activities
   * @param claudeApiKey Optional Claude API key for LLM-based description parsing
   */
  async fetchActivities(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    perPage: number = 100,
    fetchDetails: boolean = false,
    claudeApiKey?: string
  ): Promise<Workout[]> {
    const activities = await this.fetch<StravaActivity[]>(
      `/athlete/activities?after=${Math.floor(startDate.getTime() / 1000)}&before=${Math.floor(endDate.getTime() / 1000)}&page=${page}&per_page=${perPage}`
    );

    const workouts: Workout[] = [];

    for (const activity of activities) {
      const workout: Workout = {
        id: generateId(),
        source: 'strava',
        type: mapStravaType(activity.type),
        name: activity.name,
        date: new Date(activity.start_date_local),
        duration: activity.moving_time / 60, // Convert seconds to minutes
        distance: activity.distance, // Already in meters
        calories: activity.calories,
        avgHeartRate: activity.average_heartrate,
        maxHeartRate: activity.max_heartrate,
        elevationGain: activity.total_elevation_gain,
      };

      // Calculate pace for runs
      if (workout.type === 'run' && workout.distance && workout.duration) {
        workout.avgPace = (workout.duration * 60) / (workout.distance / 1000); // seconds per km
      }

      // Fetch details for workouts that might have useful data in description
      // This includes runs (for category), strength (for lifts), and other workout types
      if (fetchDetails) {
        // Fetch details for most workout types - descriptions often contain useful info
        const typesToSkip = ['Walk', 'Hike']; // These rarely have relevant description data
        const shouldFetchDetail = !typesToSkip.includes(activity.type);

        if (shouldFetchDetail) {
          try {
            const detail = await this.fetchActivityDetail(activity.id);

            // Store the description
            if (detail.description) {
              workout.description = detail.description;
            }

            // Parse lift data from ANY workout with a description (not just strength)
            // Users often log lifts in CrossTraining, Workout, or even "other" activity types
            if (detail.description) {
              // Try regex parsing first
              const lifts = parseLiftData(detail.description);
              if (lifts.length > 0) {
                workout.exercises = lifts.map(lift => ({
                  exercise: lift.exercise,
                  weight: lift.weight,
                  reps: lift.reps,
                  setNumber: lift.sets,
                }));
                // If we found lift data, mark this as strength workout
                if (workout.type === 'other') {
                  workout.type = 'strength';
                }
              } else if (claudeApiKey && workout.type !== 'run') {
                // Fallback to LLM parsing if regex found nothing (skip runs)
                try {
                  const llmParsed = await parseWorkoutDescription(
                    claudeApiKey,
                    'strength',
                    activity.name,
                    detail.description
                  );
                  if (llmParsed.exercises && llmParsed.exercises.length > 0) {
                    workout.exercises = llmParsed.exercises.map(ex => ({
                      exercise: ex.exercise,
                      weight: ex.weight,
                      reps: ex.reps,
                      setNumber: ex.sets,
                    }));
                    // If we found lift data, mark this as strength workout
                    if (workout.type === 'other') {
                      workout.type = 'strength';
                    }
                  }
                } catch (llmError) {
                  console.warn('LLM parsing failed:', llmError);
                }
              }
            }

            // Parse run context from name and description
            if (workout.type === 'run') {
              // Try regex parsing first
              const runContext = parseRunDescription(activity.name, detail.description || '');
              if (runContext.category !== 'unknown') {
                workout.runCategory = runContext.category;
                workout.plannedPace = runContext.plannedPace;
                workout.intervals = runContext.intervals;
              } else if (claudeApiKey && detail.description) {
                // Fallback to LLM parsing for unknown categories
                try {
                  const llmParsed = await parseWorkoutDescription(
                    claudeApiKey,
                    'run',
                    activity.name,
                    detail.description
                  );
                  if (llmParsed.runCategory && llmParsed.runCategory !== 'unknown') {
                    workout.runCategory = llmParsed.runCategory;
                    workout.plannedPace = llmParsed.plannedPace;
                    workout.intervals = llmParsed.intervals;
                  }
                } catch (llmError) {
                  console.warn('LLM parsing failed:', llmError);
                }
              } else {
                workout.runCategory = runContext.category;
              }

              // Collect best efforts for running PRs
              if (detail.best_efforts && detail.best_efforts.length > 0) {
                this.processBestEfforts(activity.id, detail.best_efforts);
              }
            }
          } catch (e) {
            console.warn(`Could not fetch details for activity ${activity.id}:`, e);
          }
        }
      }

      // If no category was set from description, try to infer from name alone
      if (workout.type === 'run' && !workout.runCategory) {
        const runContext = parseRunDescription(activity.name, '');
        workout.runCategory = runContext.category;
      }

      workouts.push(workout);
    }

    return workouts;
  }

  /**
   * Fetch all activities with pagination
   * @param daysBack Number of days to fetch
   * @param fetchStrengthDetails If true, fetch details for strength workouts to get lift data from description
   * @param claudeApiKey Optional Claude API key for LLM-based description parsing
   */
  async fetchAllActivities(daysBack: number = 90, fetchStrengthDetails: boolean = true, claudeApiKey?: string): Promise<Workout[]> {
    const endDate = new Date();
    const startDate = subDays(endDate, daysBack);

    const allWorkouts: Workout[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const workouts = await this.fetchActivities(startDate, endDate, page, perPage, fetchStrengthDetails, claudeApiKey);
      allWorkouts.push(...workouts);

      if (workouts.length < perPage) {
        break;
      }
      page++;
    }

    return allWorkouts;
  }

  /**
   * Fetch athlete's HR zones from Strava settings
   */
  async fetchAthleteZones(): Promise<StravaHRZone[]> {
    const response = await this.fetch<StravaZonesResponse>('/athlete/zones');
    return response.heart_rate.zones;
  }

  /**
   * Get current token info for storage
   */
  getTokenInfo(): {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
  } {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenExpiry: this.tokenExpiry,
    };
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

/**
 * Parse OAuth callback URL for authorization code
 */
export function parseStravaCallback(url: string): { code?: string; error?: string } {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const error = urlObj.searchParams.get('error');

  return {
    code: code || undefined,
    error: error || undefined,
  };
}

/**
 * Get the Strava OAuth redirect URI dynamically based on current location.
 * Works for both localhost development and production (Vercel, etc.)
 */
export function getStravaRedirectUri(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/import`;
  }
  // Fallback for SSR or non-browser environments
  return 'http://localhost:5173/import';
}
