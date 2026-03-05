import { useMemo } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format, subDays, endOfWeek, eachWeekOfInterval } from 'date-fns';

export function WeightStats() {
  const { recentWeight } = useHealthStore();
  const { settings } = useSettingsStore();

  const stats = useMemo(() => {
    if (recentWeight.length === 0) return null;

    const sorted = [...recentWeight].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const weights = sorted.map((w) => w.weight);

    // Basic stats
    const current = weights[weights.length - 1];
    const highest = Math.max(...weights);
    const lowest = Math.min(...weights);
    const average = weights.reduce((a, b) => a + b, 0) / weights.length;

    // Weekly averages
    const now = new Date();
    const threeMonthsAgo = subDays(now, 90);
    const weeks = eachWeekOfInterval({ start: threeMonthsAgo, end: now }, { weekStartsOn: 1 });

    const weeklyAverages = weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekWeights = sorted.filter((w) => {
        const d = new Date(w.date);
        return d >= weekStart && d <= weekEnd;
      });

      if (weekWeights.length === 0) return null;

      const avg = weekWeights.reduce((sum, w) => sum + w.weight, 0) / weekWeights.length;
      return {
        week: format(weekStart, 'MMM d'),
        average: avg,
        count: weekWeights.length,
      };
    }).filter(Boolean);

    // Calculate all-time change
    const firstWeight = weights[0];
    const totalChange = current - firstWeight;
    const daysCovered = Math.ceil(
      (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      current,
      highest,
      lowest,
      average,
      totalChange,
      daysCovered,
      totalEntries: weights.length,
      weeklyAverages,
    };
  }, [recentWeight]);

  if (!stats) return null;

  const convertWeight = (kg: number) => {
    if (settings.units.weight === 'lbs') {
      return kg * 2.20462;
    }
    return kg;
  };

  const unit = settings.units.weight;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">
            {convertWeight(stats.highest).toFixed(1)}
          </p>
          <p className="text-sm text-gray-500">Highest ({unit})</p>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">
            {convertWeight(stats.lowest).toFixed(1)}
          </p>
          <p className="text-sm text-gray-500">Lowest ({unit})</p>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">
            {convertWeight(stats.average).toFixed(1)}
          </p>
          <p className="text-sm text-gray-500">Average ({unit})</p>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className={`text-2xl font-bold ${stats.totalChange > 0 ? 'text-warning-600' : stats.totalChange < 0 ? 'text-success-600' : 'text-gray-900'}`}>
            {stats.totalChange > 0 ? '+' : ''}{convertWeight(stats.totalChange).toFixed(1)}
          </p>
          <p className="text-sm text-gray-500">Total Change ({unit})</p>
        </div>
      </div>

      {/* Tracking Summary */}
      <div className="bg-primary-50 rounded-lg p-4">
        <p className="text-sm text-primary-700">
          You have <span className="font-semibold">{stats.totalEntries} weight entries</span> over{' '}
          <span className="font-semibold">{stats.daysCovered} days</span>.
          {stats.daysCovered > 0 && (
            <>
              {' '}That's an average of{' '}
              <span className="font-semibold">
                {(stats.totalEntries / (stats.daysCovered / 7)).toFixed(1)} entries per week
              </span>.
            </>
          )}
        </p>
      </div>

      {/* Weekly Averages Table */}
      {stats.weeklyAverages.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Weekly Averages</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Week</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Avg Weight</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Change</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Entries</th>
                </tr>
              </thead>
              <tbody>
                {stats.weeklyAverages.slice(-8).map((week, i, arr) => {
                  const prevWeek = i > 0 ? arr[i - 1] : null;
                  const change = prevWeek ? week!.average - prevWeek.average : 0;

                  return (
                    <tr key={week!.week} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{week!.week}</td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {convertWeight(week!.average).toFixed(1)} {unit}
                      </td>
                      <td className={`py-2 text-right ${change > 0 ? 'text-warning-600' : change < 0 ? 'text-success-600' : 'text-gray-500'}`}>
                        {change !== 0 ? (
                          <>
                            {change > 0 ? '+' : ''}{convertWeight(change).toFixed(1)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-500">{week!.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
