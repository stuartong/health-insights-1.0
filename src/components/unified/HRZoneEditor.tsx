import { useState } from 'react';
import { X, RotateCcw, Save, Heart } from 'lucide-react';
import { StravaHRZone } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stravaZones?: StravaHRZone[];
  maxHR: number;
}

const DEFAULT_ZONE_NAMES = [
  'Zone 1 (Recovery)',
  'Zone 2 (Aerobic)',
  'Zone 3 (Tempo)',
  'Zone 4 (Threshold)',
  'Zone 5 (VO2max)',
];

const DEFAULT_ZONE_COLORS = [
  '#9ca3af', // gray
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
];

export function HRZoneEditor({ isOpen, onClose, stravaZones, maxHR }: Props) {
  const { settings, updateSettings } = useSettingsStore();

  // Initialize with custom zones if they exist, otherwise use Strava zones or defaults
  const initialZones = settings.customHRZones?.length
    ? settings.customHRZones
    : stravaZones?.length
      ? stravaZones
      : getDefaultZones(maxHR);

  const [zones, setZones] = useState<StravaHRZone[]>(initialZones);
  const [useCustom, setUseCustom] = useState(settings.useCustomHRZones ?? false);

  function getDefaultZones(maxHR: number): StravaHRZone[] {
    // Standard 5-zone model based on % of max HR
    return [
      { min: Math.round(maxHR * 0.5), max: Math.round(maxHR * 0.6) },
      { min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7) },
      { min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8) },
      { min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9) },
      { min: Math.round(maxHR * 0.9), max: -1 }, // -1 means no upper limit
    ];
  }

  const handleZoneChange = (index: number, field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0;
    const newZones = [...zones];
    newZones[index] = { ...newZones[index], [field]: numValue };

    // Auto-adjust adjacent zones for continuity
    if (field === 'max' && index < zones.length - 1) {
      newZones[index + 1] = { ...newZones[index + 1], min: numValue };
    }
    if (field === 'min' && index > 0) {
      newZones[index - 1] = { ...newZones[index - 1], max: numValue };
    }

    setZones(newZones);
  };

  const handleSave = () => {
    updateSettings({
      customHRZones: zones,
      useCustomHRZones: useCustom,
    });
    onClose();
  };

  const handleReset = () => {
    if (stravaZones?.length) {
      setZones(stravaZones);
    } else {
      setZones(getDefaultZones(maxHR));
    }
    setUseCustom(false);
  };

  const handleUseStrava = () => {
    setUseCustom(false);
    updateSettings({ useCustomHRZones: false });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Heart size={20} className="text-red-500" />
            <h2 className="text-lg font-semibold">Edit Heart Rate Zones</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Use custom zones</span>
            <button
              onClick={() => setUseCustom(!useCustom)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                useCustom ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  useCustom ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Info */}
          <p className="text-sm text-gray-600">
            {stravaZones?.length
              ? 'Your Strava HR zones are imported. Adjust them here if they don\'t match your actual zones.'
              : `Zones calculated from estimated max HR: ${maxHR} bpm`}
          </p>

          {/* Zone Editor */}
          <div className="space-y-3">
            {zones.map((zone, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-8 rounded"
                  style={{ backgroundColor: DEFAULT_ZONE_COLORS[index] }}
                />
                <span className="text-sm font-medium text-gray-700 w-28">
                  {DEFAULT_ZONE_NAMES[index]}
                </span>
                <input
                  type="number"
                  value={zone.min}
                  onChange={(e) => handleZoneChange(index, 'min', e.target.value)}
                  className="w-16 px-2 py-1 border rounded text-center text-sm"
                  disabled={!useCustom}
                />
                <span className="text-gray-400">-</span>
                {zone.max === -1 ? (
                  <span className="w-16 px-2 py-1 text-center text-sm text-gray-400">max</span>
                ) : (
                  <input
                    type="number"
                    value={zone.max}
                    onChange={(e) => handleZoneChange(index, 'max', e.target.value)}
                    className="w-16 px-2 py-1 border rounded text-center text-sm"
                    disabled={!useCustom}
                  />
                )}
                <span className="text-xs text-gray-500">bpm</span>
              </div>
            ))}
          </div>

          {/* Zone Distribution Preview */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 font-medium mb-2">Recommended Distribution</p>
            <div className="flex h-4 rounded overflow-hidden">
              <div className="bg-gray-400" style={{ width: '35%' }} title="Zone 1: 35%" />
              <div className="bg-blue-500" style={{ width: '45%' }} title="Zone 2: 45%" />
              <div className="bg-green-500" style={{ width: '5%' }} title="Zone 3: 5%" />
              <div className="bg-amber-500" style={{ width: '10%' }} title="Zone 4: 10%" />
              <div className="bg-red-500" style={{ width: '5%' }} title="Zone 5: 5%" />
            </div>
            <p className="text-xs text-blue-600 mt-1">80% easy (Z1-2), 20% hard (Z4-5)</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <div className="flex items-center gap-2">
            {stravaZones && stravaZones.length > 0 && (
              <button
                onClick={handleUseStrava}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Use Strava Zones
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Save size={16} />
              Save Zones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
