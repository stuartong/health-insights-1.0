import { useState } from 'react';
import { AppleHealthUpload } from './AppleHealthUpload';
import { OuraConnect } from './OuraConnect';
import { StravaConnect } from './StravaConnect';
import { ManualWeightEntry } from './ManualWeightEntry';
import { useHealthStore } from '@/stores/healthStore';
import { Apple, Watch, Bike, Scale, Database, CheckCircle, XCircle } from 'lucide-react';

type TabId = 'apple' | 'oura' | 'strava' | 'manual';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'apple',
    label: 'Apple Health',
    icon: <Apple size={20} />,
    description: 'Import workouts, sleep, weight, and HRV from Apple Health export',
  },
  {
    id: 'oura',
    label: 'Oura Ring',
    icon: <Watch size={20} />,
    description: 'Connect your Oura Ring for sleep, readiness, and HRV data',
  },
  {
    id: 'strava',
    label: 'Strava',
    icon: <Bike size={20} />,
    description: 'Sync your workouts and activities from Strava',
  },
  {
    id: 'manual',
    label: 'Manual Entry',
    icon: <Scale size={20} />,
    description: 'Manually add weight measurements and workout data',
  },
];

export function DataImportPage() {
  const [activeTab, setActiveTab] = useState<TabId>('apple');
  const { hasAppleHealthData, hasOuraData, hasStravaData } = useHealthStore();

  const getStatusIcon = (tabId: TabId) => {
    const hasData = {
      apple: hasAppleHealthData,
      oura: hasOuraData,
      strava: hasStravaData,
      manual: false,
    };

    if (hasData[tabId]) {
      return <CheckCircle size={16} className="text-success-500" />;
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Import Your Data</h2>
        <p className="text-gray-600 mt-1">
          Connect your health data sources to get personalized insights and coaching
        </p>
      </div>

      {/* Data Sources Overview */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Connected Sources</h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${hasAppleHealthData ? 'border-success-300 bg-success-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <Apple size={24} className={hasAppleHealthData ? 'text-success-600' : 'text-gray-400'} />
              {hasAppleHealthData ? (
                <CheckCircle size={20} className="text-success-500" />
              ) : (
                <XCircle size={20} className="text-gray-300" />
              )}
            </div>
            <p className="font-medium text-gray-900">Apple Health</p>
            <p className="text-sm text-gray-500">
              {hasAppleHealthData ? 'Connected' : 'Not connected'}
            </p>
          </div>

          <div className={`p-4 rounded-lg border ${hasOuraData ? 'border-success-300 bg-success-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <Watch size={24} className={hasOuraData ? 'text-success-600' : 'text-gray-400'} />
              {hasOuraData ? (
                <CheckCircle size={20} className="text-success-500" />
              ) : (
                <XCircle size={20} className="text-gray-300" />
              )}
            </div>
            <p className="font-medium text-gray-900">Oura Ring</p>
            <p className="text-sm text-gray-500">
              {hasOuraData ? 'Connected' : 'Not connected'}
            </p>
          </div>

          <div className={`p-4 rounded-lg border ${hasStravaData ? 'border-success-300 bg-success-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <Bike size={24} className={hasStravaData ? 'text-success-600' : 'text-gray-400'} />
              {hasStravaData ? (
                <CheckCircle size={20} className="text-success-500" />
              ) : (
                <XCircle size={20} className="text-gray-300" />
              )}
            </div>
            <p className="font-medium text-gray-900">Strava</p>
            <p className="text-sm text-gray-500">
              {hasStravaData ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {getStatusIcon(tab.id)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            {tabs.find((t) => t.id === activeTab)?.description}
          </p>

          {activeTab === 'apple' && <AppleHealthUpload />}
          {activeTab === 'oura' && <OuraConnect />}
          {activeTab === 'strava' && <StravaConnect />}
          {activeTab === 'manual' && <ManualWeightEntry />}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="card p-6 bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-2">Privacy First</h3>
        <p className="text-sm text-primary-700">
          All your health data stays in your browser using IndexedDB storage.
          No data is sent to any server except when you use the AI Coach feature,
          which sends relevant context to the Claude API for personalized insights.
        </p>
      </div>
    </div>
  );
}
