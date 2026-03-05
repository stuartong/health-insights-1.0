import { X, ArrowLeft } from 'lucide-react';
import { RunningCritiqueDetail } from './RunningCritiqueDetail';
import { LiftingCritiqueDetail } from './LiftingCritiqueDetail';
import { TrainingLoadDetail } from './TrainingLoadDetail';
import { SleepDetail } from './SleepDetail';
import { WeightDetail } from './WeightDetail';
import { HRVDetail } from './HRVDetail';
import { WeekDetail } from './WeekDetail';
import { PatternDetail } from './PatternDetail';
import { BenchmarksDetail } from './BenchmarksDetail';

interface Props {
  viewId: string;
  onClose: () => void;
  onAskAI: (context: string) => void;
}

export function DeepDiveModal({ viewId, onClose, onAskAI }: Props) {
  const renderContent = () => {
    switch (viewId) {
      case 'running_critique':
        return <RunningCritiqueDetail onAskAI={onAskAI} />;
      case 'lifting_critique':
        return <LiftingCritiqueDetail onAskAI={onAskAI} />;
      case 'trainingLoad':
        return <TrainingLoadDetail onAskAI={onAskAI} />;
      case 'sleep':
        return <SleepDetail onAskAI={onAskAI} />;
      case 'weight':
        return <WeightDetail onAskAI={onAskAI} />;
      case 'hrv':
        return <HRVDetail onAskAI={onAskAI} />;
      case 'rhr':
        return <HRVDetail onAskAI={onAskAI} />; // RHR shares the HRV detail view since they're related recovery metrics
      case 'week':
        return <WeekDetail onAskAI={onAskAI} />;
      case 'benchmarks':
        return <BenchmarksDetail onAskAI={onAskAI} />;
      // Pattern-based insights
      case 'sleep-performance':
      case 'training-load-warning':
      case 'weight-progress':
        return <PatternDetail patternId={viewId} onAskAI={onAskAI} />;
      default:
        // Try pattern detail for any unknown insight IDs
        if (viewId.includes('-')) {
          return <PatternDetail patternId={viewId} onAskAI={onAskAI} />;
        }
        return (
          <div className="p-8 text-center">
            <p className="text-gray-500">Detail view not available for: {viewId}</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {renderContent()}
      </div>
    </div>
  );
}
