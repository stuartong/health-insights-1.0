import { useState } from 'react';
import { Plus, CheckCircle } from 'lucide-react';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format } from 'date-fns';

export function WeightEntry() {
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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
    });

    setWeight('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Weight ({settings.units.weight})</label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={settings.units.weight === 'kg' ? '75.0' : '165.0'}
            className="input"
            required
          />
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

      {success && (
        <div className="flex items-center gap-2 text-success-600">
          <CheckCircle size={16} />
          <span className="text-sm">Weight added!</span>
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={!weight}>
        <Plus size={18} />
        Add Entry
      </button>
    </form>
  );
}
