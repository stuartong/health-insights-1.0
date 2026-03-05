import { useState } from 'react';
import { Scale, Plus, CheckCircle } from 'lucide-react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format } from 'date-fns';

export function ManualWeightEntry() {
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const { addWeightEntry } = useHealthStore();
  const { settings } = useSettingsStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!weight) return;

    let weightKg = parseFloat(weight);
    if (settings.units.weight === 'lbs') {
      weightKg = weightKg / 2.20462;
    }

    await addWeightEntry({
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(date),
      weight: weightKg,
      source: 'manual',
      note: note || undefined,
    });

    setWeight('');
    setNote('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          Add manual weight entries when you don't have automatic sync from a smart scale.
          The app will calculate your smoothed trend line from all entries.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Weight ({settings.units.weight})</label>
            <div className="relative">
              <Scale size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={`e.g., ${settings.units.weight === 'kg' ? '75.5' : '165'}`}
                className="input pl-10"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., After morning workout, Before breakfast"
            className="input"
          />
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-success-50 border border-success-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-success-500" />
              <span className="text-success-700">Weight entry added successfully!</span>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={!weight}>
          <Plus size={18} />
          Add Weight Entry
        </button>
      </form>

      {/* Tips */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h4 className="font-medium text-primary-900 mb-2">Tips for accurate tracking:</h4>
        <ul className="list-disc list-inside text-sm text-primary-700 space-y-1">
          <li>Weigh yourself at the same time each day (morning is best)</li>
          <li>Use the same scale for consistency</li>
          <li>Don't stress about daily fluctuations - focus on the trend</li>
          <li>Weight can vary 1-2 kg/2-4 lbs day-to-day from water retention</li>
        </ul>
      </div>
    </div>
  );
}
