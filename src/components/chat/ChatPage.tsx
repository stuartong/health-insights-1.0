import { useState, useRef, useEffect } from 'react';
import { useChatStore, suggestedQuestions, buildHealthContext } from '@/stores/chatStore';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ClaudeClient, isValidClaudeApiKey } from '@/api/claude';
import { ChatMessage } from './ChatMessage';
import { Send, Bot, Loader2, AlertCircle, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ChatPage() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  const { messages, isLoading, error, addMessage, clearMessages, setLoading, setError } = useChatStore();
  const { recentWorkouts, recentSleep, weightTrend, trainingLoad, recentHRV } = useHealthStore();
  const { apiKeys } = useSettingsStore();

  const hasApiKey = apiKeys.claudeApiKey && isValidClaudeApiKey(apiKeys.claudeApiKey);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !hasApiKey) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message
    await addMessage({ role: 'user', content: userMessage });

    setLoading(true);

    try {
      const client = new ClaudeClient(apiKeys.claudeApiKey!);

      // Build context from current health data
      const context = buildHealthContext({
        recentWorkouts,
        recentSleep,
        weightTrend,
        trainingLoad,
        recentHRV,
      });

      // Get AI response
      const response = await client.sendMessage(userMessage, context, messages);

      // Add assistant message
      await addMessage({ role: 'assistant', content: response, context });
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <Bot className="mx-auto mb-4 text-primary-500" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Coach Setup Required</h2>
          <p className="text-gray-600 mb-6">
            To use the AI Coach, you need to add your Claude API key in settings.
            Your API key is stored locally and never sent to any server except Anthropic's API.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="btn btn-primary"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Chat Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Bot className="text-primary-600" size={24} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">AI Health Coach</h2>
            <p className="text-sm text-gray-500">Ask questions about your health data</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="btn btn-ghost text-gray-500"
          >
            <Trash2 size={18} />
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Sparkles className="text-primary-500 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              What would you like to know?
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Ask me anything about your training, recovery, nutrition, or performance.
              I'll analyze your data and provide personalized insights.
            </p>

            {/* Suggested Questions */}
            <div className="w-full max-w-2xl">
              {suggestedQuestions.map((category) => (
                <div key={category.category} className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">{category.category}</p>
                  <div className="flex flex-wrap gap-2">
                    {category.questions.slice(0, 2).map((question) => (
                      <button
                        key={question}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors text-left"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary-600" size={18} />
                </div>
                <p className="text-gray-500">Thinking...</p>
              </div>
            )}

            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-danger-500 flex-shrink-0" size={20} />
                <div>
                  <p className="font-medium text-danger-800">Error</p>
                  <p className="text-sm text-danger-700">{error}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your training, recovery, or nutrition..."
            className="input resize-none pr-12"
            rows={2}
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="btn btn-primary px-6 self-end"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
}
