// ==================== Core Data Types ====================

export type DataSource = 'apple_health' | 'oura' | 'strava' | 'manual';
export type WorkoutType = 'run' | 'cycle' | 'swim' | 'strength' | 'walk' | 'hike' | 'other';

export type RunCategory = 'easy' | 'long' | 'tempo' | 'interval' | 'race' | 'recovery' | 'fartlek' | 'hills' | 'unknown';

export interface Workout {
  id: string;
  source: DataSource;
  type: WorkoutType;
  name?: string;
  date: Date;
  duration: number; // minutes
  distance?: number; // meters
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPace?: number; // seconds per km
  elevationGain?: number; // meters
  tss?: number; // training stress score
  exercises?: LiftSet[];
  // Run-specific context from description
  runCategory?: RunCategory;
  description?: string;
  plannedPace?: string; // e.g., "5:30/km" from description
  intervals?: string; // e.g., "6x800m" from description
}

export interface LiftSet {
  exercise: string;
  weight: number; // kg
  reps: number;
  rpe?: number; // 1-10
  setNumber?: number;
}

export interface SleepRecord {
  id: string;
  source: DataSource;
  date: Date;
  bedtime?: Date;
  wakeTime?: Date;
  duration: number; // minutes
  efficiency?: number; // percentage 0-100
  deepSleep?: number; // minutes
  remSleep?: number; // minutes
  lightSleep?: number; // minutes
  awake?: number; // minutes
  hrv?: number; // ms
  restingHR?: number; // bpm
  score?: number; // 0-100 overall score
}

export interface WeightEntry {
  id: string;
  date: Date;
  weight: number; // kg
  source: DataSource;
  bodyFat?: number; // percentage
  note?: string;
}

export interface HRVReading {
  id: string;
  source: DataSource;
  date: Date;
  value: number; // ms (RMSSD)
  context?: 'morning' | 'sleep' | 'workout' | 'recovery';
}

export interface HeartRateReading {
  id: string;
  source: DataSource;
  date: Date;
  value: number; // bpm
  context?: 'resting' | 'active' | 'workout';
}

export interface VO2MaxReading {
  id: string;
  source: DataSource;
  date: Date;
  value: number; // ml/kg/min
}

// ==================== Performance Records ====================

export interface PersonalRecord {
  id: string;
  type: 'run' | 'lift';
  category: string; // '5K', '10K', 'squat_1rm', 'bench_5rm', etc.
  value: number; // seconds for runs, kg for lifts
  date: Date;
  workoutId?: string;
  previousValue?: number;
  improvement?: number; // percentage
}

export interface RunningPR {
  distance: number; // meters
  distanceLabel: string; // '5K', '10K', etc.
  time: number; // seconds
  pace: number; // seconds per km
  date: Date;
  workoutId?: string;
}

export interface LiftingPR {
  exercise: string;
  repMax: number; // 1, 5, 10, etc.
  weight: number; // kg
  estimated1RM: number; // kg
  date: Date;
  workoutId?: string;
}

// ==================== Training Load ====================

export interface DailyLoad {
  date: Date;
  tss: number; // total training stress
  duration: number; // minutes
  workoutCount: number;
  types: WorkoutType[];
}

export interface TrainingLoadMetrics {
  acuteLoad: number; // 7-day
  chronicLoad: number; // 28-day
  acwr: number; // Acute:Chronic Workload Ratio
  riskZone: 'undertrained' | 'optimal' | 'overreaching' | 'danger';
  trend: 'increasing' | 'stable' | 'decreasing';
  fatigueLevel: number; // 0-100
  fitnessLevel: number; // 0-100
  formLevel: number; // fitness - fatigue
}

// ==================== Insights ====================

export type InsightCategory = 'training' | 'recovery' | 'nutrition' | 'weight' | 'correlation' | 'performance';
export type InsightSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface Insight {
  id: string;
  date: Date;
  category: InsightCategory;
  title: string;
  description: string;
  severity: InsightSeverity;
  actionable?: string;
  metrics?: Record<string, number | string>;
  dismissed?: boolean;
}

export interface Correlation {
  id: string;
  metric1: string;
  metric2: string;
  coefficient: number; // -1 to 1
  pValue: number;
  sampleSize: number;
  description: string;
  significance: 'strong' | 'moderate' | 'weak' | 'none';
}

// ==================== Nutrition ====================

export interface NutritionTargets {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  fiber: number; // grams
}

export interface FuelingRecommendation {
  id: string;
  type: 'pre' | 'during' | 'post';
  timing: string; // "2 hours before", "immediately after", etc.
  carbs: number; // grams
  protein: number; // grams
  description: string;
  workoutId?: string;
}

// ==================== User Settings ====================

export interface UserProfile {
  name?: string;
  birthYear?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number; // cm
  weightGoal?: number; // kg
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
}

export interface StravaHRZone {
  min: number;
  max: number;  // -1 means no upper limit
}

export interface UserSettings {
  units: {
    weight: 'kg' | 'lbs';
    distance: 'km' | 'miles';
    height: 'cm' | 'ft';
  };
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  firstDayOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
  darkMode: boolean;
  excludedWorkoutTypes: WorkoutType[]; // Workout types to exclude from analysis
  customHRZones?: StravaHRZone[]; // Custom HR zones to override Strava
  useCustomHRZones?: boolean; // Whether to use custom zones instead of Strava
}

export interface StravaRunningPR {
  distance: string; // "5k", "10k", "Half-Marathon", etc.
  distanceMeters: number;
  time: number; // seconds
  date: string; // ISO date string
  activityId?: number;
}

export interface APIKeys {
  ouraToken?: string;
  stravaClientId?: string;
  stravaClientSecret?: string;
  stravaAccessToken?: string;
  stravaRefreshToken?: string;
  stravaTokenExpiry?: number;
  stravaHRZones?: StravaHRZone[];
  stravaRunningPRs?: StravaRunningPR[];
  claudeApiKey?: string;
}

// ==================== Chat ====================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: HealthContext;
}

export interface HealthContext {
  recentWorkouts?: Workout[];
  recentSleep?: SleepRecord[];
  weightTrend?: { current: number; weekChange: number; trendDirection: string };
  trainingLoad?: TrainingLoadMetrics;
  todayMetrics?: {
    hrv?: number;
    restingHR?: number;
    sleepScore?: number;
    readinessScore?: number;
  };
}

// ==================== Oura API Types ====================

export interface OuraSleepData {
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
  score: number;
}

export interface OuraReadinessData {
  id: string;
  day: string;
  score: number;
  temperature_deviation: number;
  activity_balance: number;
  body_temperature: number;
  hrv_balance: number;
  recovery_index: number;
  resting_heart_rate: number;
  sleep_balance: number;
}

// ==================== Strava API Types ====================

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
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
}

// ==================== Demo Data ====================

export interface DemoDataConfig {
  enabled: boolean;
  startDate: Date;
  daysToGenerate: number;
}
