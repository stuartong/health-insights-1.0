import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ClaudeClient } from '@/api/claude';
import { useHealthStore } from '@/stores/healthStore';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  initialContext?: string;
  onContextClear: () => void;
}

const QUICK_QUESTIONS = [
  'Should I work out today?',
  'Critique my running this week',
  'Why is my weight up?',
  'Am I overtraining?',
  'What should I eat before my run?',
  "Why am I running slower lately?",
];

export function FloatingChat({ isOpen, onToggle, initialContext, onContextClear }: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, addMessage, clearMessages } = useChatStore();
  const { apiKeys } = useSettingsStore();
  const { recentWorkouts, recentSleep, recentWeight, trainingLoad } = useHealthStore();

  // Auto-fill input from context
  useEffect(() => {
    if (initialContext && isOpen) {
      setInput(initialContext);
      onContextClear();
    }
  }, [initialContext, isOpen, onContextClear]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const context: string[] = [];

    // Recent workouts
    if (recentWorkouts.length > 0) {
      const recent = recentWorkouts.slice(0, 7);
      context.push(`Recent workouts (last 7): ${recent.map(w =>
        `${w.type} on ${w.date.toLocaleDateString()} - ${w.duration}min${w.distance ? `, ${(w.distance/1000).toFixed(1)}km` : ''}`
      ).join('; ')}`);
    }

    // Recent sleep
    if (recentSleep.length > 0) {
      const recent = recentSleep.slice(0, 7);
      const avgSleep = recent.reduce((sum, s) => sum + s.duration, 0) / recent.length / 60;
      context.push(`Average sleep (last 7 days): ${avgSleep.toFixed(1)} hours`);
    }

    // Training load
    if (trainingLoad) {
      context.push(`Training load: ACWR ${trainingLoad.acwr.toFixed(2)} (${trainingLoad.riskZone})`);
    }

    // Weight
    if (recentWeight.length > 0) {
      const latest = recentWeight[recentWeight.length - 1];
      context.push(`Current weight: ${latest.weight.toFixed(1)}kg`);
    }

    return context.join('\n');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userMessage });
    setIsLoading(true);

    try {
      if (!apiKeys.claudeApiKey) {
        addMessage({
          role: 'assistant',
          content: 'Please add your Claude API key in Settings to enable AI chat.',
        });
        return;
      }

      const client = new ClaudeClient(apiKeys.claudeApiKey);
      const contextStr = buildContext();

      // Build a simple context for the message
      const fullMessage = contextStr
        ? `Based on my health data:\n${contextStr}\n\nMy question: ${userMessage}`
        : userMessage;

      const response = await client.sendMessage(fullMessage);

      addMessage({ role: 'assistant', content: response });
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
      >
        <MessageCircle size={24} />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[600px] sm:max-h-[80vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col z-50 sm:border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-primary-600 sm:rounded-t-2xl">
        <div className="flex items-center gap-2 text-white">
          <Sparkles size={20} />
          <span className="font-semibold">AI Coach</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto text-primary-300 mb-3" />
            <p className="text-gray-600 mb-4">Ask me anything about your training, recovery, or health!</p>

            {/* Quick Questions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Quick Questions</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(q)}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <div
              key={i}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask your AI coach..."
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-full transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear chat history
          </button>
        )}
      </div>
    </div>
  );
}
