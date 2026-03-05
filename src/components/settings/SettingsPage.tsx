import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useHealthStore } from '@/stores/healthStore';
import { generateDemoData } from '@/demo/sampleData';
import {
  Settings,
  User,
  Key,
  Database,
  Trash2,
  CheckCircle,
  Loader2,
  Play,
} from 'lucide-react';
import { isValidClaudeApiKey } from '@/api/claude';

export function SettingsPage() {
  const {
    profile,
    settings,
    apiKeys,
    demoMode,
    updateProfile,
    updateSettings,
    updateAPIKeys,
    setDemoMode,
    resetSettings,
  } = useSettingsStore();

  const { clearAllData, refreshData, setLoading } = useHealthStore();

  const [claudeKey, setClaudeKey] = useState(apiKeys.claudeApiKey || '');
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  const handleSaveClaudeKey = () => {
    if (claudeKey && !isValidClaudeApiKey(claudeKey)) {
      alert('Invalid API key format. Claude keys start with "sk-ant-"');
      return;
    }
    setSaveStatus('saving');
    updateAPIKeys({ claudeApiKey: claudeKey || undefined });
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleGenerateDemo = async () => {
    setIsGeneratingDemo(true);
    setLoading(true, 'Generating demo data...');

    try {
      await generateDemoData(90);
      setDemoMode({ enabled: true });
      await refreshData();
    } catch (error) {
      console.error('Error generating demo data:', error);
    } finally {
      setIsGeneratingDemo(false);
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all health data? This cannot be undone.')) {
      await clearAllData();
      setDemoMode({ enabled: false });
    }
  };

  const handleResetSettings = () => {
    if (confirm('Reset all settings to defaults? This will clear API keys.')) {
      resetSettings();
      setClaudeKey('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      {/* Profile */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <User size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Profile</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Birth Year</label>
              <input
                type="number"
                value={profile.birthYear || ''}
                onChange={(e) => updateProfile({ birthYear: parseInt(e.target.value) || undefined })}
                placeholder="1985"
                min="1920"
                max={new Date().getFullYear()}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for age-adjusted strength standards
              </p>
            </div>
            <div>
              <label className="label">Gender</label>
              <select
                value={profile.gender || ''}
                onChange={(e) => updateProfile({ gender: e.target.value as any || undefined })}
                className="input"
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Used for strength standard comparisons
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Height ({settings.units.height})</label>
              <input
                type="number"
                value={profile.height || ''}
                onChange={(e) => updateProfile({ height: parseFloat(e.target.value) || undefined })}
                placeholder={settings.units.height === 'cm' ? '175' : '5.9'}
                className="input"
              />
            </div>
            <div>
              <label className="label">Goal Weight ({settings.units.weight})</label>
              <input
                type="number"
                value={profile.weightGoal || ''}
                onChange={(e) => updateProfile({ weightGoal: parseFloat(e.target.value) || undefined })}
                placeholder={settings.units.weight === 'kg' ? '70' : '154'}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Units */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Settings size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Units</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Weight</label>
              <select
                value={settings.units.weight}
                onChange={(e) => updateSettings({ units: { ...settings.units, weight: e.target.value as 'kg' | 'lbs' } })}
                className="input"
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lbs">Pounds (lbs)</option>
              </select>
            </div>
            <div>
              <label className="label">Distance</label>
              <select
                value={settings.units.distance}
                onChange={(e) => updateSettings({ units: { ...settings.units, distance: e.target.value as 'km' | 'miles' } })}
                className="input"
              >
                <option value="km">Kilometers (km)</option>
                <option value="miles">Miles</option>
              </select>
            </div>
            <div>
              <label className="label">Height</label>
              <select
                value={settings.units.height}
                onChange={(e) => updateSettings({ units: { ...settings.units, height: e.target.value as 'cm' | 'ft' } })}
                className="input"
              >
                <option value="cm">Centimeters (cm)</option>
                <option value="ft">Feet</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Workout Filters */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Settings size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Workout Filters</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-600 mb-4">
            Exclude certain workout types from analysis and recommendations.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['run', 'cycle', 'swim', 'strength', 'walk', 'hike', 'other'] as const).map((type) => {
              const excluded = settings.excludedWorkoutTypes?.includes(type) || false;
              const labels: Record<string, string> = {
                run: 'Running',
                cycle: 'Cycling',
                swim: 'Swimming',
                strength: 'Strength',
                walk: 'Walking',
                hike: 'Hiking',
                other: 'Other',
              };
              return (
                <label
                  key={type}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    excluded
                      ? 'bg-gray-100 border-gray-300 text-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 hover:border-primary-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={(e) => {
                      const currentExcluded = settings.excludedWorkoutTypes || [];
                      if (e.target.checked) {
                        // Include (remove from excluded)
                        updateSettings({
                          excludedWorkoutTypes: currentExcluded.filter(t => t !== type)
                        });
                      } else {
                        // Exclude (add to excluded)
                        updateSettings({
                          excludedWorkoutTypes: [...currentExcluded, type]
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className={`text-sm font-medium ${excluded ? 'line-through' : ''}`}>
                    {labels[type]}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Unchecked workout types will not appear in weekly summaries, training load, or recommendations.
          </p>
        </div>
      </div>

      {/* API Keys */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Key size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">API Keys</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="label">Claude API Key (for AI Coach)</label>
            <div className="flex gap-2">
              <input
                type={showClaudeKey ? 'text' : 'password'}
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                placeholder="sk-ant-..."
                className="input flex-1"
              />
              <button
                onClick={() => setShowClaudeKey(!showClaudeKey)}
                className="btn btn-secondary"
              >
                {showClaudeKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={handleSaveClaudeKey}
                disabled={saveStatus === 'saving'}
                className="btn btn-primary"
              >
                {saveStatus === 'saving' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : saveStatus === 'saved' ? (
                  <CheckCircle size={18} />
                ) : (
                  'Save'
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
            {claudeKey && isValidClaudeApiKey(claudeKey) && (
              <div className="flex items-center gap-1 text-success-600 text-sm mt-1">
                <CheckCircle size={14} />
                <span>Valid key format</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600">
              Oura and Strava are configured in the{' '}
              <a href="/import" className="text-primary-600 hover:underline">
                Import Data
              </a>{' '}
              section.
            </p>
          </div>
        </div>
      </div>

      {/* Demo Mode */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Play size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Demo Mode</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-600 mb-4">
            Generate realistic sample data to explore all features without connecting real devices.
          </p>

          {demoMode.enabled ? (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-success-700">
                <CheckCircle size={18} />
                <span className="font-medium">Demo mode is active</span>
              </div>
              <p className="text-sm text-success-600 mt-1">
                You're viewing sample data. Clear data to use real data.
              </p>
            </div>
          ) : (
            <button
              onClick={handleGenerateDemo}
              disabled={isGeneratingDemo}
              className="btn btn-secondary w-full"
            >
              {isGeneratingDemo ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating 90 days of data...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Generate Demo Data
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Database size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Data Management</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Clear All Data</p>
              <p className="text-sm text-gray-500">Remove all health data from this browser</p>
            </div>
            <button onClick={handleClearData} className="btn btn-danger">
              <Trash2 size={18} />
              Clear Data
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Reset Settings</p>
              <p className="text-sm text-gray-500">Reset all settings and clear API keys</p>
            </div>
            <button onClick={handleResetSettings} className="btn btn-secondary">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="card p-6 bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-2">Privacy</h3>
        <p className="text-sm text-primary-700">
          All your health data is stored locally in your browser using IndexedDB.
          No data is sent to any server except when using the AI Coach feature,
          which sends relevant context to Claude (Anthropic's API) for generating insights.
          Your API keys are stored locally and never shared.
        </p>
      </div>
    </div>
  );
}
