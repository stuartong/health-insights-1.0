import { useLocation } from 'react-router-dom';
import { Bell, RefreshCw } from 'lucide-react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format } from 'date-fns';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/weight': 'Weight Tracking',
  '/training': 'Training Load',
  '/benchmarks': 'Performance Benchmarks',
  '/nutrition': 'Nutrition Coach',
  '/chat': 'AI Coach',
  '/import': 'Import Data',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const { isLoading, loadingMessage, refreshData, insights } = useHealthStore();
  const { demoMode } = useSettingsStore();

  const title = pageTitles[location.pathname] || 'Health Insights';
  const unreadInsights = insights.filter(i => !i.dismissed).length;

  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {demoMode.enabled && (
          <span className="px-2 py-1 text-xs font-medium bg-warning-100 text-warning-600 rounded">
            Demo Mode
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw size={16} className="animate-spin" />
            <span>{loadingMessage || 'Loading...'}</span>
          </div>
        )}

        <span className="text-sm text-gray-500">
          {format(new Date(), 'EEEE, MMMM d')}
        </span>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>

        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} />
          {unreadInsights > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-danger-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadInsights > 9 ? '9+' : unreadInsights}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
