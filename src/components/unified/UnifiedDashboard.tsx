import { useState } from 'react';
import { TodayCoachingCard } from './TodayCoachingCard';
import { QuickHealthSnapshot } from './QuickHealthSnapshot';
import { ProgressCard } from './ProgressCard';
import { InsightFeed } from './InsightFeed';
import { NutritionCoachingCard } from './NutritionCoachingCard';
import { WeeklySummary } from './WeeklySummary';
import { FloatingChat } from './FloatingChat';
import { DeepDiveModal } from './DeepDiveModal';
import { BenchmarksSummary } from './BenchmarksSummary';
import { useUnifiedInsights } from '@/hooks/useUnifiedInsights';
import { Settings, Database } from 'lucide-react';
import { Link } from 'react-router-dom';

export function UnifiedDashboard() {
  const [deepDiveView, setDeepDiveView] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string>('');

  const {
    todayRecommendation,
    quickStats,
    insights,
    weeklySummary,
    runningCritique,
    liftingCritique,
    isLoading,
  } = useUnifiedInsights();

  const handleAskAI = (context: string) => {
    setChatContext(context);
    setChatOpen(true);
  };

  const handleViewDetails = (viewId: string) => {
    setDeepDiveView(viewId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Health Insights</h1>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/import"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Data Import"
            >
              <Database size={20} />
            </Link>
            <Link
              to="/settings"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero: Today's Coaching Card */}
            <TodayCoachingCard
              recommendation={todayRecommendation}
              onAskAI={() => handleAskAI('Explain today\'s recommendation in more detail')}
            />

            {/* Quick Health Snapshot */}
            <QuickHealthSnapshot
              stats={quickStats}
              onMetricClick={(metric) => handleViewDetails(metric)}
            />

            {/* Progress Updates (moved from insights) */}
            <ProgressCard
              insights={insights}
              onViewDetails={handleViewDetails}
            />

            {/* Insight Feed */}
            <InsightFeed
              insights={insights}
              runningCritique={runningCritique}
              liftingCritique={liftingCritique}
              onViewDetails={handleViewDetails}
              onAskAI={handleAskAI}
            />

            {/* Nutrition Coaching */}
            <NutritionCoachingCard onAskAI={handleAskAI} />

            {/* Benchmarks Summary */}
            <BenchmarksSummary
              onViewDetails={() => handleViewDetails('benchmarks')}
              onAskAI={handleAskAI}
            />

            {/* Weekly Summary */}
            <WeeklySummary
              summary={weeklySummary}
              onViewDetails={() => handleViewDetails('week')}
              onAskAI={() => handleAskAI('Help me plan next week\'s training')}
            />
          </div>
        )}
      </main>

      {/* Floating Chat Button */}
      <FloatingChat
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        initialContext={chatContext}
        onContextClear={() => setChatContext('')}
      />

      {/* Deep Dive Modal */}
      {deepDiveView && (
        <DeepDiveModal
          viewId={deepDiveView}
          onClose={() => setDeepDiveView(null)}
          onAskAI={handleAskAI}
        />
      )}
    </div>
  );
}
