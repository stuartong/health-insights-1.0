import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatTime } from '@/algorithms/predictions';
import { formatRelativeDate } from '@/utils/dateUtils';
import { formatWeight } from '@/utils/formatters';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';

interface PRTrackerProps {
  type: 'run' | 'lift';
}

export function PRTracker({ type }: PRTrackerProps) {
  const { personalRecords } = useHealthStore();
  const { settings } = useSettingsStore();

  const filteredRecords = personalRecords.filter((pr) => pr.type === type);

  if (filteredRecords.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Trophy className="mx-auto mb-2 text-gray-300" size={32} />
        <p>No personal records yet</p>
        <p className="text-sm mt-1">
          {type === 'run'
            ? 'Complete some runs to track your PRs'
            : 'Add your lift numbers to track progress'}
        </p>
      </div>
    );
  }

  // Group by category
  const groupedRecords = filteredRecords.reduce((acc, pr) => {
    if (!acc[pr.category]) {
      acc[pr.category] = [];
    }
    acc[pr.category].push(pr);
    return acc;
  }, {} as Record<string, typeof filteredRecords>);

  const unit = settings.units.weight;

  return (
    <div className="space-y-6">
      {Object.entries(groupedRecords).map(([category, records]) => {
        // Sort by date, most recent first
        const sorted = [...records].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const best = sorted.reduce((best, current) =>
          type === 'run'
            ? current.value < best.value ? current : best
            : current.value > best.value ? current : best
        , sorted[0]);

        return (
          <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Category Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="text-yellow-500" size={18} />
                <span className="font-medium text-gray-900">{category}</span>
              </div>
              <div className="text-sm text-gray-500">
                Best: {type === 'run'
                  ? formatTime(best.value)
                  : formatWeight(best.value * (unit === 'lbs' ? 2.20462 : 1), unit)}
              </div>
            </div>

            {/* Records List */}
            <div className="divide-y divide-gray-100">
              {sorted.slice(0, 5).map((record, index) => {
                const isBest = record.id === best.id;
                const improvement = record.improvement;

                return (
                  <div
                    key={record.id}
                    className={`px-4 py-3 flex items-center justify-between ${isBest ? 'bg-yellow-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isBest ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">
                          {type === 'run'
                            ? formatTime(record.value)
                            : formatWeight(record.value * (unit === 'lbs' ? 2.20462 : 1), unit)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} />
                          {formatRelativeDate(record.date)}
                        </div>
                      </div>
                    </div>

                    {improvement !== undefined && improvement > 0 && (
                      <div className="flex items-center gap-1 text-success-600 text-sm">
                        <TrendingUp size={14} />
                        <span>{improvement.toFixed(1)}% PR</span>
                      </div>
                    )}

                    {isBest && (
                      <span className="badge badge-warning">Current Best</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
