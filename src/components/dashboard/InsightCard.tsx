import type { Insight } from '@/types';
import { useHealthStore } from '@/stores/healthStore';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';
import { formatRelativeDate } from '@/utils/dateUtils';

interface InsightCardProps {
  insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const { dismissInsight } = useHealthStore();

  const getIcon = () => {
    switch (insight.severity) {
      case 'success':
        return <CheckCircle className="text-success-500" size={18} />;
      case 'warning':
        return <AlertTriangle className="text-warning-500" size={18} />;
      case 'danger':
        return <XCircle className="text-danger-500" size={18} />;
      default:
        return <Info className="text-primary-500" size={18} />;
    }
  };

  const getBorderColor = () => {
    switch (insight.severity) {
      case 'success':
        return 'border-l-success-500';
      case 'warning':
        return 'border-l-warning-500';
      case 'danger':
        return 'border-l-danger-500';
      default:
        return 'border-l-primary-500';
    }
  };

  return (
    <div className={`insight-card border-l-4 ${getBorderColor()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-gray-900 truncate">{insight.title}</p>
            <button
              onClick={() => dismissInsight(insight.id)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
          {insight.actionable && (
            <p className="text-sm text-primary-600 mt-2">{insight.actionable}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">{formatRelativeDate(insight.date)}</p>
        </div>
      </div>
    </div>
  );
}
