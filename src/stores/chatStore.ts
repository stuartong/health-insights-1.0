import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, HealthContext } from '@/types';
import { db } from '@/db/database';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<ChatMessage>;
  loadMessages: () => Promise<void>;
  clearMessages: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,
      error: null,

      addMessage: async (messageData) => {
        const message: ChatMessage = {
          id: generateId(),
          timestamp: new Date(),
          ...messageData,
        };

        await db.chatMessages.put(message);
        set((state) => ({
          messages: [...state.messages, message],
        }));

        return message;
      },

      loadMessages: async () => {
        try {
          const messages = await db.chatMessages
            .orderBy('timestamp')
            .toArray();
          set({ messages });
        } catch (error) {
          console.error('Error loading chat messages:', error);
        }
      },

      clearMessages: async () => {
        await db.chatMessages.clear();
        set({ messages: [] });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'chat-store',
      partialize: () => ({}), // Don't persist messages in localStorage, use IndexedDB
    }
  )
);

// Suggested questions for the AI chat
export const suggestedQuestions = [
  {
    category: 'Training',
    questions: [
      'Should I do my long run today or tomorrow based on my recovery?',
      'Am I overtraining? What does my ACWR suggest?',
      'What type of workout should I do today?',
      'How should I adjust my training based on my recent sleep?',
    ],
  },
  {
    category: 'Recovery',
    questions: [
      'How is my recovery trending this week?',
      'Why might my HRV be lower than usual?',
      'Should I take a rest day based on my recent data?',
      'What can I do to improve my sleep quality?',
    ],
  },
  {
    category: 'Performance',
    questions: [
      "What's my realistic 10K target for 3 months from now?",
      'How has my running pace improved over the past month?',
      'Why has my squat progress stalled?',
      'What are my strengths and weaknesses based on my data?',
    ],
  },
  {
    category: 'Nutrition',
    questions: [
      'Am I eating enough protein for my training load?',
      'How should I fuel for my long run tomorrow?',
      'What should my carb intake be on high training days?',
      'How is my weight trend compared to my training volume?',
    ],
  },
];

// Build context for AI prompts
export function buildHealthContext(data: {
  recentWorkouts?: any[];
  recentSleep?: any[];
  weightTrend?: any;
  trainingLoad?: any;
  recentHRV?: any[];
}): HealthContext {
  const context: HealthContext = {};

  if (data.recentWorkouts?.length) {
    context.recentWorkouts = data.recentWorkouts.slice(0, 7);
  }

  if (data.recentSleep?.length) {
    context.recentSleep = data.recentSleep.slice(0, 7);
  }

  if (data.weightTrend) {
    context.weightTrend = data.weightTrend;
  }

  if (data.trainingLoad) {
    context.trainingLoad = data.trainingLoad;
  }

  if (data.recentHRV?.length || data.recentSleep?.length) {
    const latestHRV = data.recentHRV?.[0];
    const latestSleep = data.recentSleep?.[0];
    context.todayMetrics = {
      hrv: latestHRV?.value,
      restingHR: latestSleep?.restingHR,
      sleepScore: latestSleep?.score,
    };
  }

  return context;
}
