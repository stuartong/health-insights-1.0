/**
 * Claude API Client for AI-Powered Insights
 * Uses the Anthropic API for generating health coaching insights
 */

import type { HealthContext, ChatMessage } from '@/types';
import { formatDuration, formatWeight, formatPace, formatHRV } from '@/utils/formatters';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const SYSTEM_PROMPT = `You are an expert health and fitness coach with deep knowledge of:
- Exercise physiology and training principles
- Sleep science and recovery optimization
- Sports nutrition and fueling strategies
- Data-driven training methodology (ACWR, HRV, etc.)

Your role is to analyze the user's health and fitness data and provide personalized, actionable coaching advice. Be specific, practical, and supportive. Reference their actual data when making recommendations.

Guidelines:
- Be concise but thorough - aim for 2-4 paragraphs
- Use bullet points for actionable recommendations
- Reference specific numbers from their data
- Explain the "why" behind recommendations
- Be encouraging but honest about areas for improvement
- Consider the whole picture (training load, sleep, recovery, nutrition)
- Flag any concerning patterns (overtraining, poor recovery, etc.)

Do NOT:
- Give medical advice or diagnose conditions
- Recommend specific supplements or medications
- Make claims about guaranteed results
- Ignore context or give generic advice`;

export class ClaudeClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Format health context into a readable summary for the AI
   */
  private formatContext(context: HealthContext): string {
    const sections: string[] = [];

    if (context.todayMetrics) {
      const metrics = context.todayMetrics;
      const lines = ['**Today\'s Metrics:**'];
      if (metrics.hrv) lines.push(`- HRV: ${formatHRV(metrics.hrv)}`);
      if (metrics.restingHR) lines.push(`- Resting HR: ${metrics.restingHR} bpm`);
      if (metrics.sleepScore) lines.push(`- Sleep Score: ${metrics.sleepScore}/100`);
      if (metrics.readinessScore) lines.push(`- Readiness Score: ${metrics.readinessScore}/100`);
      if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.trainingLoad) {
      const load = context.trainingLoad;
      sections.push(`**Training Load:**
- ACWR: ${load.acwr.toFixed(2)} (${load.riskZone})
- Acute Load (7-day): ${load.acuteLoad.toFixed(0)} TSS
- Chronic Load (28-day avg): ${load.chronicLoad.toFixed(0)} TSS/day
- Trend: ${load.trend}
- Fitness Level: ${load.fitnessLevel.toFixed(0)}/100
- Fatigue Level: ${load.fatigueLevel.toFixed(0)}/100
- Form: ${load.formLevel.toFixed(0)}`);
    }

    if (context.weightTrend) {
      const weight = context.weightTrend;
      sections.push(`**Weight Trend:**
- Current: ${formatWeight(weight.current, 'kg')}
- Week Change: ${weight.weekChange > 0 ? '+' : ''}${weight.weekChange.toFixed(1)} kg
- Trend: ${weight.trendDirection}`);
    }

    if (context.recentSleep && context.recentSleep.length > 0) {
      const avgDuration = context.recentSleep.reduce((sum, s) => sum + s.duration, 0) / context.recentSleep.length;
      const avgEfficiency = context.recentSleep
        .filter(s => s.efficiency)
        .reduce((sum, s) => sum + (s.efficiency || 0), 0) / context.recentSleep.filter(s => s.efficiency).length;

      sections.push(`**Recent Sleep (last ${context.recentSleep.length} nights):**
- Average Duration: ${formatDuration(avgDuration)}
- Average Efficiency: ${avgEfficiency ? avgEfficiency.toFixed(0) + '%' : 'N/A'}
- Last Night: ${formatDuration(context.recentSleep[0].duration)}${context.recentSleep[0].score ? ` (Score: ${context.recentSleep[0].score})` : ''}`);
    }

    if (context.recentWorkouts && context.recentWorkouts.length > 0) {
      const workoutLines = context.recentWorkouts.slice(0, 5).map(w => {
        let line = `- ${w.type}: ${formatDuration(w.duration)}`;
        if (w.distance) line += `, ${(w.distance / 1000).toFixed(1)}km`;
        if (w.avgPace && w.type === 'run') line += ` @ ${formatPace(w.avgPace, 'km')}`;
        return line;
      });

      sections.push(`**Recent Workouts:**\n${workoutLines.join('\n')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(
    userMessage: string,
    context?: HealthContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    // Build messages array
    const messages: ClaudeMessage[] = [];

    // Add conversation history (last 10 messages to stay within token limits)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Build the current user message with context
    let fullUserMessage = userMessage;
    if (context) {
      const contextStr = this.formatContext(context);
      if (contextStr) {
        fullUserMessage = `Here's my current health data:\n\n${contextStr}\n\n---\n\nMy question: ${userMessage}`;
      }
    }

    messages.push({
      role: 'user',
      content: fullUserMessage,
    });

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid Claude API key. Please check your settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data: ClaudeResponse = await response.json();

    if (!data.content || data.content.length === 0) {
      throw new Error('Empty response from Claude');
    }

    return data.content[0].text;
  }

  /**
   * Generate a weekly insights report
   */
  async generateWeeklyReport(context: HealthContext): Promise<string> {
    const prompt = `Please provide a comprehensive weekly health and fitness summary based on my data. Include:

1. **Training Summary**: Overview of training volume, intensity, and any patterns
2. **Recovery Status**: Analysis of sleep, HRV, and overall recovery
3. **Key Wins**: Positive trends or achievements from the week
4. **Areas to Watch**: Any concerning patterns or things to be mindful of
5. **Next Week Recommendations**: Specific, actionable suggestions for the coming week

Be specific and reference my actual data in your analysis.`;

    return this.sendMessage(prompt, context);
  }

  /**
   * Get a quick training recommendation for today
   */
  async getTodayRecommendation(context: HealthContext): Promise<string> {
    const prompt = `Based on my current metrics (HRV, sleep, training load), what type of workout should I do today? Give me a specific recommendation with reasoning. Keep it concise - 2-3 paragraphs max.`;

    return this.sendMessage(prompt, context);
  }

  /**
   * Analyze a specific pattern or concern
   */
  async analyzePattern(pattern: string, context: HealthContext): Promise<string> {
    return this.sendMessage(pattern, context);
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Validate Claude API key format
 */
export function isValidClaudeApiKey(key: string): boolean {
  return key.startsWith('sk-ant-') && key.length > 40;
}

/**
 * Parsed workout data from description
 */
export interface ParsedWorkoutData {
  // Run-specific
  runCategory?: 'easy' | 'long' | 'tempo' | 'interval' | 'race' | 'recovery' | 'fartlek' | 'hills' | 'unknown';
  plannedPace?: string;
  intervals?: string;
  // Strength-specific
  exercises?: Array<{
    exercise: string;
    weight: number;
    reps: number;
    sets?: number;
  }>;
}

/**
 * Parse workout description using Claude API
 * This is more flexible than regex-based parsing
 */
export async function parseWorkoutDescription(
  apiKey: string,
  workoutType: string,
  name: string,
  description: string
): Promise<ParsedWorkoutData> {
  const prompt = workoutType === 'run'
    ? `Analyze this running workout name and description. Extract:
- runCategory: one of "easy", "long", "tempo", "interval", "race", "recovery", "fartlek", "hills", or "unknown"
- plannedPace: if a target pace is mentioned (e.g., "5:30/km")
- intervals: if intervals are mentioned (e.g., "6x800m", "4x1km")

Workout name: "${name}"
Description: "${description}"

Respond ONLY with valid JSON, no explanation:
{"runCategory": "...", "plannedPace": "...", "intervals": "..."}`
    : `Analyze this strength/cross-training workout description. Extract all exercises with their weight, reps, and sets.

Common formats people use:
- "Squat 3x5 100kg"
- "Bench Press: 80kg x 5 x 3"
- "Deadlift 140kg 5 reps"
- "4x8 OHP @ 50kg"
- "Back squat 3 sets of 5 at 100kg"

Workout name: "${name}"
Description: "${description}"

Respond ONLY with valid JSON array, no explanation. Weight in kg, use 0 if not specified:
{"exercises": [{"exercise": "Exercise Name", "weight": 100, "reps": 5, "sets": 3}]}`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn('Claude API error parsing workout:', response.status);
      return {};
    }

    const data: ClaudeResponse = await response.json();
    const text = data.content[0]?.text || '{}';

    // Extract JSON from response (in case there's any extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {};
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (error) {
    console.warn('Error parsing workout with Claude:', error);
    return {};
  }
}
