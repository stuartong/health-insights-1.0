import { useState, useEffect } from 'react';
import { X, Dumbbell, Save, Trash2, Plus, Info } from 'lucide-react';
import { getManualLiftPRs, saveManualLiftPR, deleteManualLiftPR } from '@/db/database';
import type { PersonalRecord } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // Called after save to refresh data
  existingLifts: { exercise: string; weight: number; reps: number; est1RM: number; source: 'parsed' | 'manual' }[];
}

const MAJOR_LIFTS = [
  { key: 'bench press', label: 'Bench Press' },
  { key: 'squat', label: 'Squat' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'overhead press', label: 'Overhead Press' },
  { key: 'barbell row', label: 'Barbell Row' },
];

export function LiftPREditor({ isOpen, onClose, onSave, existingLifts }: Props) {
  const [manualPRs, setManualPRs] = useState<PersonalRecord[]>([]);
  const [editingLift, setEditingLift] = useState<string | null>(null);
  const [formWeight, setFormWeight] = useState('');
  const [formReps, setFormReps] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadManualPRs();
    }
  }, [isOpen]);

  const loadManualPRs = async () => {
    const prs = await getManualLiftPRs();
    setManualPRs(prs);
  };

  const getExistingLift = (exercise: string) => {
    return existingLifts.find(l => l.exercise.toLowerCase() === exercise.toLowerCase());
  };

  const getManualPR = (exercise: string) => {
    return manualPRs.find(p => p.category === exercise.toLowerCase());
  };

  const handleEdit = (exercise: string) => {
    const existing = getExistingLift(exercise);
    const manual = getManualPR(exercise);

    if (manual) {
      // If there's a manual override, use that
      setFormWeight(manual.value.toFixed(0)); // est1RM stored as value
      setFormReps('1'); // Manual entries are stored as 1RM
    } else if (existing) {
      setFormWeight(existing.weight.toString());
      setFormReps(existing.reps.toString());
    } else {
      setFormWeight('');
      setFormReps('');
    }
    setEditingLift(exercise);
  };

  const handleSave = async () => {
    if (!editingLift || !formWeight || !formReps) return;

    setSaving(true);
    try {
      await saveManualLiftPR(editingLift, parseFloat(formWeight), parseInt(formReps));
      await loadManualPRs();
      setEditingLift(null);
      setFormWeight('');
      setFormReps('');
      onSave();
    } catch (error) {
      console.error('Error saving lift PR:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exercise: string) => {
    if (!confirm(`Remove manual override for ${exercise}? Parsed data will be used if available.`)) {
      return;
    }

    try {
      await deleteManualLiftPR(exercise);
      await loadManualPRs();
      onSave();
    } catch (error) {
      console.error('Error deleting lift PR:', error);
    }
  };

  const estimate1RM = (weight: number, reps: number): number => {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Dumbbell size={20} className="text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Lift PRs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info */}
        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-start gap-3">
          <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Lift data is parsed from your Strava workout descriptions.
            You can manually override or add lifts that weren't detected.
            Enter the weight and reps from your best set.
          </p>
        </div>

        {/* Lift List */}
        <div className="p-4 space-y-3">
          {MAJOR_LIFTS.map(({ key, label }) => {
            const existing = getExistingLift(key);
            const manual = getManualPR(key);
            const hasData = existing || manual;
            const isEditing = editingLift === key;

            return (
              <div
                key={key}
                className={`border rounded-lg p-4 ${
                  hasData ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{label}</h3>
                  {manual && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Manual Override
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          value={formWeight}
                          onChange={(e) => setFormWeight(e.target.value)}
                          placeholder="100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Reps</label>
                        <input
                          type="number"
                          value={formReps}
                          onChange={(e) => setFormReps(e.target.value)}
                          placeholder="5"
                          min="1"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                    {formWeight && formReps && (
                      <p className="text-sm text-gray-600">
                        Est. 1RM: <span className="font-semibold">{Math.round(estimate1RM(parseFloat(formWeight), parseInt(formReps)))}kg</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving || !formWeight || !formReps}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                      >
                        <Save size={14} />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingLift(null);
                          setFormWeight('');
                          setFormReps('');
                        }}
                        className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      {hasData ? (
                        <div>
                          {manual ? (
                            <p className="text-gray-700">
                              <span className="font-semibold">{Math.round(manual.value)}kg</span>
                              <span className="text-gray-500 text-sm ml-1">(1RM)</span>
                            </p>
                          ) : existing ? (
                            <p className="text-gray-700">
                              <span className="font-semibold">{existing.weight}kg × {existing.reps}</span>
                              <span className="text-gray-500 text-sm ml-1">
                                → ~{Math.round(existing.est1RM)}kg 1RM
                              </span>
                            </p>
                          ) : null}
                          {existing && !manual && (
                            <p className="text-xs text-gray-400">from Strava</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">No data</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(key)}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                        title={hasData ? 'Edit' : 'Add'}
                      >
                        {hasData ? <Dumbbell size={16} /> : <Plus size={16} />}
                      </button>
                      {manual && (
                        <button
                          onClick={() => handleDelete(key)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove manual override"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
