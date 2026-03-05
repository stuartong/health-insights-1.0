import { useState } from 'react';
import { RunningBenchmarks } from './RunningBenchmarks';
import { LiftingBenchmarks } from './LiftingBenchmarks';
import { PRTracker } from './PRTracker';
import { useHealthStore } from '@/stores/healthStore';
import { Timer, Dumbbell } from 'lucide-react';

type TabId = 'running' | 'lifting';

export function BenchmarksPage() {
  const [activeTab, setActiveTab] = useState<TabId>('running');
  const { recentWorkouts } = useHealthStore();

  const runCount = recentWorkouts.filter((w) => w.type === 'run').length;
  const liftCount = recentWorkouts.filter((w) => w.type === 'strength').length;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('running')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'running'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Timer size={18} />
              Running
              {runCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {runCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('lifting')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'lifting'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Dumbbell size={18} />
              Lifting
              {liftCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {liftCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'running' && <RunningBenchmarks />}
          {activeTab === 'lifting' && <LiftingBenchmarks />}
        </div>
      </div>

      {/* PR History */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Personal Records</h3>
          <p className="text-sm text-gray-500">Your best performances over time</p>
        </div>
        <div className="card-body">
          <PRTracker type={activeTab === 'running' ? 'run' : 'lift'} />
        </div>
      </div>
    </div>
  );
}
