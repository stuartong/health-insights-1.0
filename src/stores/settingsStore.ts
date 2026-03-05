import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, UserSettings, APIKeys, DemoDataConfig } from '@/types';

interface SettingsState {
  profile: UserProfile;
  settings: UserSettings;
  apiKeys: APIKeys;
  demoMode: DemoDataConfig;

  // Actions
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateAPIKeys: (keys: Partial<APIKeys>) => void;
  setDemoMode: (config: Partial<DemoDataConfig>) => void;
  clearAPIKeys: () => void;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  units: {
    weight: 'kg',
    distance: 'km',
    height: 'cm',
  },
  dateFormat: 'YYYY-MM-DD',
  firstDayOfWeek: 1,
  darkMode: false,
  excludedWorkoutTypes: ['walk'], // Exclude walks by default
};

const defaultProfile: UserProfile = {};

const defaultAPIKeys: APIKeys = {};

const defaultDemoMode: DemoDataConfig = {
  enabled: false,
  startDate: new Date(),
  daysToGenerate: 90,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      settings: defaultSettings,
      apiKeys: defaultAPIKeys,
      demoMode: defaultDemoMode,

      updateProfile: (profile) => {
        set((state) => ({
          profile: { ...state.profile, ...profile },
        }));
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
            units: {
              ...state.settings.units,
              ...(newSettings.units || {}),
            },
          },
        }));
      },

      updateAPIKeys: (keys) => {
        set((state) => ({
          apiKeys: { ...state.apiKeys, ...keys },
        }));
      },

      setDemoMode: (config) => {
        set((state) => ({
          demoMode: { ...state.demoMode, ...config },
        }));
      },

      clearAPIKeys: () => {
        set({ apiKeys: defaultAPIKeys });
      },

      resetSettings: () => {
        set({
          profile: defaultProfile,
          settings: defaultSettings,
          apiKeys: defaultAPIKeys,
          demoMode: defaultDemoMode,
        });
      },
    }),
    {
      name: 'settings-store',
    }
  )
);

// Utility functions for unit conversion
export function convertWeight(value: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs'): number {
  if (from === to) return value;
  if (from === 'kg' && to === 'lbs') return value * 2.20462;
  return value / 2.20462;
}

export function convertDistance(value: number, from: 'km' | 'miles', to: 'km' | 'miles'): number {
  if (from === to) return value;
  if (from === 'km' && to === 'miles') return value * 0.621371;
  return value / 0.621371;
}

export function convertHeight(value: number, from: 'cm' | 'ft', to: 'cm' | 'ft'): number {
  if (from === to) return value;
  if (from === 'cm' && to === 'ft') return value / 30.48;
  return value * 30.48;
}

export function formatWeight(value: number, unit: 'kg' | 'lbs'): string {
  return `${value.toFixed(1)} ${unit}`;
}

export function formatDistance(meters: number, unit: 'km' | 'miles'): string {
  const km = meters / 1000;
  if (unit === 'miles') {
    return `${(km * 0.621371).toFixed(2)} mi`;
  }
  return `${km.toFixed(2)} km`;
}

export function formatPace(secondsPerKm: number, unit: 'km' | 'miles'): string {
  let pace = secondsPerKm;
  if (unit === 'miles') {
    pace = secondsPerKm * 1.60934;
  }
  const minutes = Math.floor(pace / 60);
  const seconds = Math.round(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /${unit === 'miles' ? 'mi' : 'km'}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
