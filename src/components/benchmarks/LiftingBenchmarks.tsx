import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  estimate1RM,
  getStrengthLevel,
  strengthStandards,
  calculateWilksScore,
} from '@/algorithms/predictions';
import { formatWeight } from '@/utils/formatters';
import { Trophy, Target, Plus, Calculator } from 'lucide-react';

interface LiftEntry {
  exercise: string;
  weight: number;
  reps: number;
}

const mainLifts = ['Squat', 'Deadlift', 'Bench', 'OHP', 'Row'];

export function LiftingBenchmarks() {
  const { settings, profile } = useSettingsStore();
  const [lifts, setLifts] = useState<LiftEntry[]>([]);
  const [newLift, setNewLift] = useState<LiftEntry>({ exercise: 'Squat', weight: 0, reps: 5 });

  const addLift = () => {
    if (newLift.weight > 0) {
      setLifts([...lifts, { ...newLift }]);
      setNewLift({ exercise: newLift.exercise, weight: 0, reps: 5 });
    }
  };

  const bodyweight = profile.height && profile.gender
    ? profile.gender === 'male' ? 80 : 65
    : 75;

  const unit = settings.units.weight;

  // Calculate stats for entered lifts
  const liftStats = lifts.reduce((acc, lift) => {
    const key = lift.exercise.toLowerCase();
    const estimated1RM = estimate1RM(lift.weight, lift.reps);

    if (!acc[key] || estimated1RM > acc[key].estimated1RM) {
      acc[key] = {
        exercise: lift.exercise,
        weight: lift.weight,
        reps: lift.reps,
        estimated1RM,
        level: getStrengthLevel(key, estimated1RM, bodyweight),
      };
    }

    return acc;
  }, {} as Record<string, { exercise: string; weight: number; reps: number; estimated1RM: number; level: string }>);

  // Calculate total and Wilks
  const total = ['squat', 'bench', 'deadlift'].reduce((sum, lift) => {
    return sum + (liftStats[lift]?.estimated1RM || 0);
  }, 0);

  const wilksScore = total > 0 ? calculateWilksScore(total, bodyweight, profile.gender !== 'female') : 0;

  const convertWeight = (kg: number) => {
    if (unit === 'lbs') return kg * 2.20462;
    return kg;
  };

  return (
    <div className="space-y-6">
      {/* Add Lift Form */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="flex items-center gap-2 font-medium text-gray-900 mb-4">
          <Calculator size={18} />
          1RM Calculator
        </h4>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Exercise</label>
            <select
              value={newLift.exercise}
              onChange={(e) => setNewLift({ ...newLift, exercise: e.target.value })}
              className="input"
            >
              {mainLifts.map((lift) => (
                <option key={lift} value={lift}>{lift}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="label">Weight ({unit})</label>
            <input
              type="number"
              value={newLift.weight || ''}
              onChange={(e) => setNewLift({ ...newLift, weight: parseFloat(e.target.value) || 0 })}
              placeholder="100"
              className="input"
            />
          </div>
          <div className="w-20">
            <label className="label">Reps</label>
            <input
              type="number"
              value={newLift.reps}
              onChange={(e) => setNewLift({ ...newLift, reps: parseInt(e.target.value) || 1 })}
              min="1"
              max="12"
              className="input"
            />
          </div>
          <button onClick={addLift} className="btn btn-primary">
            <Plus size={18} />
            Add
          </button>
        </div>
        {newLift.weight > 0 && (
          <p className="text-sm text-primary-600 mt-2">
            Estimated 1RM: <span className="font-bold">{formatWeight(convertWeight(estimate1RM(newLift.weight, newLift.reps)), unit)}</span>
          </p>
        )}
      </div>

      {/* Current Stats */}
      {Object.keys(liftStats).length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 font-medium text-gray-900 mb-4">
            <Trophy className="text-yellow-500" size={20} />
            Your Lifts
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.values(liftStats).map((lift) => (
              <div key={lift.exercise} className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">{lift.exercise}</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatWeight(convertWeight(lift.estimated1RM), unit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Est. 1RM from {formatWeight(convertWeight(lift.weight), unit)} x {lift.reps}
                </p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                  lift.level === 'elite' ? 'bg-purple-100 text-purple-700' :
                  lift.level === 'advanced' ? 'bg-blue-100 text-blue-700' :
                  lift.level === 'intermediate' ? 'bg-green-100 text-green-700' :
                  lift.level === 'novice' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {lift.level.charAt(0).toUpperCase() + lift.level.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Powerlifting Total & Wilks */}
      {total > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
          <h4 className="font-medium text-purple-900 mb-3">Powerlifting Metrics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-purple-600">Total (S+B+D)</p>
              <p className="text-2xl font-bold text-purple-900">{formatWeight(convertWeight(total), unit)}</p>
            </div>
            <div>
              <p className="text-sm text-purple-600">Wilks Score</p>
              <p className="text-2xl font-bold text-purple-900">{wilksScore.toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Strength Standards Reference */}
      <div>
        <h4 className="flex items-center gap-2 font-medium text-gray-900 mb-4">
          <Target className="text-primary-500" size={20} />
          Strength Standards
          <span className="text-xs text-gray-400 font-normal">(multiplier of bodyweight)</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Lift</th>
                <th className="text-center py-2 text-gray-500 font-medium">Novice</th>
                <th className="text-center py-2 text-gray-500 font-medium">Intermediate</th>
                <th className="text-center py-2 text-gray-500 font-medium">Advanced</th>
                <th className="text-center py-2 text-gray-500 font-medium">Elite</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(strengthStandards).map(([lift, standards]) => (
                <tr key={lift} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-900 capitalize">{lift}</td>
                  <td className="py-2 text-center text-gray-600">{standards.novice}x</td>
                  <td className="py-2 text-center text-gray-600">{standards.intermediate}x</td>
                  <td className="py-2 text-center text-gray-600">{standards.advanced}x</td>
                  <td className="py-2 text-center text-gray-600">{standards.elite}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          * Based on {bodyweight}kg bodyweight. Standards are general guidelines for male lifters.
        </p>
      </div>
    </div>
  );
}
