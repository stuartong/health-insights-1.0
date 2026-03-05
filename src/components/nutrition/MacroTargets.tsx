import { useHealthStore } from '@/stores/healthStore';
import { Beef, Wheat, Droplets } from 'lucide-react';

export function MacroTargets() {
  const { trainingLoad } = useHealthStore();

  const isHighLoad = trainingLoad && trainingLoad.acwr > 1.1;

  return (
    <div className="space-y-6">
      {/* Protein */}
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
          <Beef className="text-red-600" size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">Protein</h4>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-semibold text-red-600">1.6-2.2g per kg</span> bodyweight daily
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <p className="font-medium text-gray-700">Light training</p>
              <p className="text-gray-500">1.6g/kg</p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="font-medium text-gray-700">Heavy training</p>
              <p className="text-gray-500">2.0-2.2g/kg</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Best sources: chicken, fish, eggs, Greek yogurt, legumes, tofu
          </p>
        </div>
      </div>

      {/* Carbohydrates */}
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Wheat className="text-amber-600" size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">Carbohydrates</h4>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-semibold text-amber-600">3-7g per kg</span> based on training volume
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <p className="font-medium text-gray-700">Rest day</p>
              <p className="text-gray-500">3-4g/kg</p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="font-medium text-gray-700">Moderate</p>
              <p className="text-gray-500">4-5g/kg</p>
            </div>
            <div className={`rounded p-2 ${isHighLoad ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
              <p className="font-medium text-gray-700">Heavy</p>
              <p className="text-gray-500">6-7g/kg</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Best sources: oats, rice, potatoes, fruits, whole grains
          </p>
        </div>
      </div>

      {/* Fat */}
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
          <Droplets className="text-yellow-600" size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">Fat</h4>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-semibold text-yellow-600">0.8-1.2g per kg</span> for hormone health
          </p>
          <div className="mt-2 text-xs bg-gray-50 rounded p-2">
            <p className="text-gray-500">
              Don't go below 0.5g/kg - essential for hormone production and vitamin absorption.
              Focus on unsaturated fats from whole food sources.
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Best sources: avocado, nuts, olive oil, fatty fish, eggs
          </p>
        </div>
      </div>

      {/* Hydration note */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-1">Hydration</h4>
        <p className="text-sm text-blue-700">
          Aim for <span className="font-semibold">35-40ml per kg</span> bodyweight daily,
          plus 500-1000ml per hour of exercise. Urine should be pale yellow.
        </p>
      </div>
    </div>
  );
}
