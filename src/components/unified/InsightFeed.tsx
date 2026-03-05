import { InsightCard, Insight } from './InsightCard';
import { RunningCritiqueSummary, RunningCritique } from './RunningCritiqueSummary';
import { LiftingCritiqueSummary, LiftingCritique } from './LiftingCritiqueSummary';
import { TrainingPatternsCard } from './TrainingPatternsCard';
import { Sparkles } from 'lucide-react';

interface Props {
  insights: Insight[];
  runningCritique: RunningCritique | null;
  liftingCritique: LiftingCritique | null;
  onViewDetails: (id: string) => void;
  onAskAI: (context: string) => void;
}

export function InsightFeed({ insights, runningCritique, liftingCritique, onViewDetails, onAskAI }: Props) {
  // Filter out progress insights (shown in ProgressCard)
  // Separate warnings/patterns for the combined card
  const warningsAndPatterns = insights.filter(i => i.type === 'warning' || i.type === 'pattern');
  const otherInsights = insights.filter(i => i.type !== 'progress' && i.type !== 'warning' && i.type !== 'pattern');

  const critiqueCount = (runningCritique ? 1 : 0) + (liftingCritique ? 1 : 0);
  const totalCount = critiqueCount + (warningsAndPatterns.length > 0 ? 1 : 0) + otherInsights.length;

  if (totalCount === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Sparkles size={32} className="mx-auto text-gray-300 mb-3" />
        <h3 className="font-medium text-gray-900 mb-1">No insights yet</h3>
        <p className="text-sm text-gray-500">
          Import more data to discover patterns and get personalized recommendations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles size={20} className="text-primary-500" />
          Insights & Analysis
        </h2>
        <span className="text-sm text-gray-500">
          {totalCount} insights
        </span>
      </div>

      {/* Running Critique Card */}
      {runningCritique && (
        <RunningCritiqueSummary
          critique={runningCritique}
          onViewDetails={() => onViewDetails('running_critique')}
          onAskAI={onAskAI}
        />
      )}

      {/* Lifting Critique Card */}
      {liftingCritique && (
        <LiftingCritiqueSummary
          critique={liftingCritique}
          onViewDetails={() => onViewDetails('lifting_critique')}
          onAskAI={onAskAI}
        />
      )}

      {/* Combined Warnings & Patterns Card */}
      {warningsAndPatterns.length > 0 && (
        <TrainingPatternsCard
          insights={warningsAndPatterns}
          onViewDetails={onViewDetails}
          onAskAI={onAskAI}
        />
      )}

      {/* Other Insight Cards */}
      {otherInsights.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onViewDetails={onViewDetails}
          onAskAI={onAskAI}
        />
      ))}
    </div>
  );
}
