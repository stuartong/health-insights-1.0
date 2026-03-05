import type { Workout } from '@/types';
import { format, addHours, subHours, isToday, isTomorrow } from 'date-fns';
import { Clock, Utensils, Zap } from 'lucide-react';

interface FuelingTimelineProps {
  workouts: Workout[];
  bodyweightKg: number;
}

export function FuelingTimeline({ workouts, bodyweightKg }: FuelingTimelineProps) {
  if (workouts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Utensils className="mx-auto mb-2" size={32} />
        <p>No upcoming workouts scheduled</p>
        <p className="text-sm mt-1">Add workouts to get fueling recommendations</p>
      </div>
    );
  }

  // Sort workouts by date
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-6">
      {sorted.map((workout) => {
        const workoutDate = new Date(workout.date);
        const isLongWorkout = workout.duration > 90;
        const dayLabel = isToday(workoutDate) ? 'Today' : isTomorrow(workoutDate) ? 'Tomorrow' : format(workoutDate, 'EEEE');

        // Calculate fueling windows
        const preWorkout2h = subHours(workoutDate, 2);
        const preWorkout30m = subHours(workoutDate, 0.5);
        const postWorkout = addHours(workoutDate, workout.duration / 60);

        const carbsNeeded = isLongWorkout ? 45 : 30;
        const proteinNeeded = 25;
        const postCarbsNeeded = Math.round(bodyweightKg * 0.8);
        const postProteinNeeded = 30;

        return (
          <div key={workout.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Workout Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="text-primary-500" size={18} />
                  <span className="font-medium text-gray-900">
                    {workout.name || workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {dayLabel} @ {format(workoutDate, 'h:mm a')} • {workout.duration}min
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                {/* Pre-workout (2h before) */}
                <div className="relative flex gap-4 pb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center z-10">
                    <Clock size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {format(preWorkout2h, 'h:mm a')} - Pre-Workout Meal
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {carbsNeeded}-{carbsNeeded + 15}g carbs + {proteinNeeded}g protein
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ideas: oatmeal + banana, toast + eggs, rice + chicken
                    </p>
                  </div>
                </div>

                {/* Pre-workout (30min before) */}
                <div className="relative flex gap-4 pb-4">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center z-10">
                    <Zap size={16} className="text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {format(preWorkout30m, 'h:mm a')} - Quick Energy
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      15-25g fast carbs if needed
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ideas: banana, energy gel, sports drink
                    </p>
                  </div>
                </div>

                {/* Workout */}
                <div className="relative flex gap-4 pb-4">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center z-10">
                    <span className="text-lg">💪</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {format(workoutDate, 'h:mm a')} - Workout
                    </p>
                    {isLongWorkout ? (
                      <>
                        <p className="text-sm text-gray-600 mt-1">
                          During: 30-60g carbs/hour + 500ml+ fluid
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Long workout - bring fuel and hydration
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600 mt-1">
                        Stay hydrated - water is usually sufficient
                      </p>
                    )}
                  </div>
                </div>

                {/* Post-workout */}
                <div className="relative flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center z-10">
                    <Utensils size={16} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      ~{format(postWorkout, 'h:mm a')} - Recovery Window
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {postProteinNeeded}g protein + {postCarbsNeeded}g carbs within 30min
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ideas: protein shake + fruit, chocolate milk, recovery meal
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
