import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodLog, UserProfile } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SUGGESTIONS_CACHE_KEY = 'claude_suggestions_cache_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const SYSTEM_PROMPT = `You are CaloriePal, a friendly, encouraging, and expert nutritionist assistant. Analyze the user's food journal data and provide specific, actionable, and personalized nutrition suggestions. Be warm, positive, and non-judgmental. Use simple language. Tailor all advice to their stated goal. Use emoji to make responses feel friendly and approachable. Format your response with clear sections using bold headers and bullet points.

At the end of your response, include a **📚 References** section citing 3–5 authoritative sources that support your recommendations. Choose relevant sources from well-known health authorities such as:
- USDA Dietary Guidelines for Americans (https://www.dietaryguidelines.gov)
- NIH Office of Dietary Supplements (https://ods.od.nih.gov)
- CDC Nutrition (https://www.cdc.gov/nutrition)
- Academy of Nutrition and Dietetics (https://www.eatright.org)
- Harvard T.H. Chan School of Public Health – The Nutrition Source (https://www.hsph.harvard.edu/nutritionsource)
- NIH National Heart, Lung, and Blood Institute (https://www.nhlbi.nih.gov)
Format each reference as a bullet point with the source name followed by the full URL.`;

function buildUserPrompt(logs: FoodLog[], profile: UserProfile): string {
  const goalLabel = {
    lose_weight: 'Lose Weight',
    maintain: 'Maintain Weight',
    gain_muscle: 'Gain Muscle',
  }[profile.goal || 'maintain'];

  const recentLogs = logs.slice(0, 30).map((log) => ({
    date: log.logged_at,
    meal: log.meal_name,
    calories: log.calories,
    protein_g: log.protein_g,
    carbs_g: log.carbs_g,
    fat_g: log.fat_g,
    fiber_g: log.fiber_g,
    foods: log.foods_detected,
  }));

  return `Here is my nutrition data for the past 14 days:

**My Profile:**
- Name: ${profile.name}
- Goal: ${goalLabel}
- Daily Calorie Target: ${profile.daily_calorie_target} calories
- Macro Targets: ${profile.protein_target_pct}% Protein / ${profile.carbs_target_pct}% Carbs / ${profile.fat_target_pct}% Fat

**Recent Food Logs (${recentLogs.length} entries):**
${JSON.stringify(recentLogs, null, 2)}

Please analyze my eating patterns and provide:
1. Overall assessment of how I'm tracking toward my goal
2. Specific, actionable suggestions for improvement
3. Food-specific swap recommendations based on what I actually eat
4. A sample 3-day meal plan tailored to my goal
5. Any nutritional gaps or concerns to address

Be specific and reference my actual food choices when possible.`;
}

interface CachedSuggestions {
  text: string;
  timestamp: number;
}

export async function getNutritionSuggestions(
  logs: FoodLog[],
  profile: UserProfile,
  forceRefresh = false
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured');

  if (!forceRefresh) {
    const cached = await AsyncStorage.getItem(SUGGESTIONS_CACHE_KEY);
    if (cached) {
      const { text, timestamp } = JSON.parse(cached) as CachedSuggestions;
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        return text;
      }
    }
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(logs, profile),
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text || '';

  await AsyncStorage.setItem(
    SUGGESTIONS_CACHE_KEY,
    JSON.stringify({ text, timestamp: Date.now() } as CachedSuggestions)
  );

  return text;
}

export async function clearSuggestionsCache(): Promise<void> {
  await AsyncStorage.removeItem(SUGGESTIONS_CACHE_KEY);
}
