import { useState } from 'react';
import { Activity, Check, AlertTriangle, XCircle, MessageCircle, Target, Heart, Clock, Zap, Layers, Settings2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, Cell, PieChart, Pie } from 'recharts';
import { useUnifiedInsights } from '@/hooks/useUnifiedInsights';
import { useSettingsStore } from '@/stores/settingsStore';
import { HRZoneEditor } from './HRZoneEditor';

interface Props {
  onAskAI: (context: string) => void;
}

export function RunningCritiqueDetail({ onAskAI }: Props) {
  const { runningCritique, runningStats } = useUnifiedInsights();
  const { apiKeys } = useSettingsStore();
  const [showZoneEditor, setShowZoneEditor] = useState(false);

  if (!runningCritique || !runningStats) {
    return (
      <div className="text-center py-12">
        <Activity size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Running Data Yet</h2>
        <p className="text-gray-500">Import your running data to get a detailed performance critique</p>
      </div>
    );
  }

  const gradeColors: Record<string, string> = {
    'A+': 'text-green-600', 'A': 'text-green-600', 'A-': 'text-green-600',
    'B+': 'text-blue-600', 'B': 'text-blue-600', 'B-': 'text-blue-600',
    'C+': 'text-yellow-600', 'C': 'text-yellow-600', 'C-': 'text-yellow-600',
    'D': 'text-orange-600', 'F': 'text-red-600',
  };

  const Section = ({ title, icon: Icon, status, children }: {
    title: string;
    icon: React.ElementType;
    status: 'good' | 'caution' | 'warning';
    children: React.ReactNode;
  }) => {
    const statusColors = {
      good: 'border-green-200 bg-green-50',
      caution: 'border-yellow-200 bg-yellow-50',
      warning: 'border-red-200 bg-red-50',
    };

    return (
      <div className={`rounded-xl border-2 ${statusColors[status]} overflow-hidden`}>
        <div className="px-4 py-3 bg-white/50 border-b border-gray-200/50">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-gray-600" />
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
        </div>
        <div className="p-4 bg-white/30">{children}</div>
      </div>
    );
  };

  const Recommendation = ({ text }: { text: string }) => (
    <div className="flex items-start gap-2 p-3 bg-primary-50 rounded-lg mt-3">
      <Target size={16} className="text-primary-600 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-primary-800"><strong>Recommendation:</strong> {text}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Activity size={24} />
              <span className="font-semibold">Detailed Running Analysis</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Overall Grade: <span className={gradeColors[runningCritique.overallGrade]}>{runningCritique.overallGrade}</span>
            </h1>
            <p className="text-gray-700">{runningCritique.gradeDescription}</p>
          </div>
          <button
            onClick={() => onAskAI('Create my personalized 8-week running improvement plan')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <MessageCircle size={16} />
            Get Improvement Plan
          </button>
        </div>

        {/* Grade Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {runningStats.gradeBreakdown.map((item) => (
            <div key={item.category} className="bg-white/60 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{item.category}</p>
              <p className={`text-xl font-bold ${gradeColors[item.grade]}`}>{item.grade}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 1: Training Volume */}
      <Section title="Training Volume & Consistency" icon={Activity} status={runningStats.volumeStatus}>
        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={runningStats.weeklyVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="km" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {runningStats.volumeInsights.good.map((text, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{text}</span>
            </div>
          ))}
          {runningStats.volumeInsights.improve.map((text, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{text}</span>
            </div>
          ))}
        </div>

        <Recommendation text={runningStats.volumeRecommendation} />
      </Section>

      {/* Section 2: Heart Rate Zones (Primary Intensity Metric) */}
      <Section title="Heart Rate Zone Distribution" icon={Heart} status={runningStats.hrStatus}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              Based on {apiKeys.stravaHRZones?.length ? 'Strava zones' : 'estimated max HR'}: <span className="font-semibold">{runningStats.maxHR} bpm</span>
            </p>
            <button
              onClick={() => setShowZoneEditor(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              <Settings2 size={14} />
              Edit Zones
            </button>
          </div>

          {/* HR Zone breakdown with ranges */}
          <div className="space-y-3">
            {runningStats.hrZones.map((zone) => (
              <div key={zone.zone} className="flex items-center gap-3">
                <div className="w-36 text-xs">
                  <div className="font-medium text-gray-700">{zone.zone}</div>
                  <div className="text-gray-500">{zone.hrRange}</div>
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(zone.percent, 2)}%`, backgroundColor: zone.color }}
                  />
                </div>
                <span className="w-12 text-sm font-semibold text-right">{zone.percent}%</span>
              </div>
            ))}
          </div>

          {/* Target distribution */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Target:</strong> 80% of runs in Zone 1-2 (easy/aerobic), 20% in Zone 4-5 (hard).
              Minimize Zone 3 "gray zone" training.
            </p>
          </div>
        </div>

        {/* HR Insights */}
        <div className="space-y-2 mb-4">
          {runningStats.hrInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{insight}</span>
            </div>
          ))}
        </div>

        <Recommendation text={runningStats.hrRecommendation} />
      </Section>

      {/* Section 3: HR Zone Chart */}
      <Section title="Runs by Heart Rate Zone" icon={Zap} status={runningStats.hrStatus}>
        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={runningStats.hrZones} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} unit="%" />
              <YAxis dataKey="zone" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(value) => [`${value}%`, 'Runs']} />
              <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                {runningStats.hrZones.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {runningStats.hrInsights.map((text, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{text}</span>
            </div>
          ))}
        </div>

        <Recommendation text={runningStats.hrRecommendation} />
      </Section>

      {/* Section 4: Run Types & Training Balance */}
      <Section title="Run Types & Training Balance" icon={Layers} status={runningStats.trainingBalance}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {/* Pie Chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={runningStats.runCategories}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {runningStats.runCategories.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} runs`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category List */}
          <div className="space-y-2">
            {runningStats.runCategories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="font-medium text-gray-700">{cat.category}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">{cat.count}</span> runs • {cat.totalKm.toFixed(1)}km
                  {cat.avgPace > 0 && ` • ${Math.floor(cat.avgPace / 60)}:${String(Math.round(cat.avgPace % 60)).padStart(2, '0')}/km`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Insights */}
        <div className="space-y-2 mb-4">
          {runningStats.categoryInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {runningStats.trainingBalance === 'good' ? (
                <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
              ) : runningStats.trainingBalance === 'caution' ? (
                <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-gray-700">{insight}</span>
            </div>
          ))}
        </div>

        {/* Training Balance Target */}
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
          <strong>Target Distribution:</strong> 80% easy/recovery runs, 10-15% tempo/threshold, 5-10% intervals/speed work.
          Include one long run per week for endurance development.
        </div>

        <Recommendation text="Add run type to your Strava activity name or description (e.g., 'Easy run', 'Tempo', '6x800m intervals') for better training analysis." />
      </Section>

      {/* Section 5: Recovery & Adaptation */}
      <Section title="Recovery & Adaptation" icon={Clock} status={runningStats.recoveryStatus}>
        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sleep" name="Sleep (hrs)" tick={{ fontSize: 12 }} />
              <YAxis dataKey="pace" name="Pace (s/km)" tick={{ fontSize: 12 }} reversed />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={runningStats.sleepVsPace} fill="#6366f1" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{runningStats.recoveryIssues.underslept}%</p>
            <p className="text-xs text-red-700">Runs after {'<'}7hrs sleep</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{runningStats.recoveryIssues.lowHrv}%</p>
            <p className="text-xs text-yellow-700">Runs when HRV low</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{runningStats.recoveryIssues.backToBack}%</p>
            <p className="text-xs text-orange-700">Back-to-back hard runs</p>
          </div>
        </div>

        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <XCircle size={16} className="inline mr-2" />
          <strong>Major Issue:</strong> You're frequently running while under-recovered. This limits adaptation and increases injury risk.
        </div>

        <Recommendation text={runningStats.recoveryRecommendation} />
      </Section>

      {/* Section 6: Injury Risk */}
      <Section title="Injury Risk Assessment" icon={AlertTriangle} status={runningStats.injuryRisk.level}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-gray-900">Current Risk Level</span>
          <span className={`text-xl font-bold px-4 py-1 rounded-full ${
            runningStats.injuryRisk.level === 'warning' ? 'bg-red-100 text-red-700' :
            runningStats.injuryRisk.level === 'caution' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {runningStats.injuryRisk.level === 'warning' ? 'HIGH' :
             runningStats.injuryRisk.level === 'caution' ? 'MODERATE' : 'LOW'}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          {runningStats.injuryRisk.factors.map((factor, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm ${
              factor.status === 'good' ? 'text-green-700' :
              factor.status === 'caution' ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {factor.status === 'good' ? <Check size={16} className="mt-0.5 flex-shrink-0" /> :
               <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
              <span>{factor.text}</span>
            </div>
          ))}
        </div>

        <Recommendation text={runningStats.injuryRecommendation} />
      </Section>

      {/* Top Priorities */}
      <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl p-6 border-2 border-primary-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target size={20} className="text-primary-600" />
          Top 3 Priorities (Do These First)
        </h3>
        <div className="space-y-4">
          {runningCritique.topPriorities.map((priority, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-gray-700 pt-1">{priority}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => onAskAI('Create a detailed action plan for these top 3 priorities')}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
        >
          <MessageCircle size={18} />
          Create My Action Plan
        </button>
      </div>

      {/* HR Zone Editor Modal */}
      <HRZoneEditor
        isOpen={showZoneEditor}
        onClose={() => setShowZoneEditor(false)}
        stravaZones={apiKeys.stravaHRZones}
        maxHR={runningStats.maxHR}
      />
    </div>
  );
}
