import { getNutritionSuggestions, clearSuggestionsCache } from '../../lib/claude';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodLog, UserProfile } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const MOCK_PROFILE: UserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  goal: 'lose_weight',
  activity_level: 'active',
  daily_calorie_target: 1800,
  protein_target_pct: 30,
  carbs_target_pct: 40,
  fat_target_pct: 30,
  notification_enabled: false,
  notification_time: '19:00',
  created_at: new Date().toISOString(),
};

const MOCK_LOGS: FoodLog[] = [
  {
    id: 'log-1',
    user_id: 'user-1',
    meal_name: 'Oatmeal',
    foods_detected: ['oats', 'banana'],
    calories: 350,
    protein_g: 10,
    carbs_g: 60,
    fat_g: 5,
    fiber_g: 6,
    sugar_g: 12,
    sodium_mg: 80,
    cholesterol_mg: 0,
    saturated_fat_g: 1,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

const MOCK_SUGGESTION_TEXT = '**Overall Assessment**\nYou are doing great!\n\n📚 References\n- USDA https://www.dietaryguidelines.gov';

function mockFetchSuccess() {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ text: MOCK_SUGGESTION_TEXT }],
      }),
  });
}

describe('getNutritionSuggestions', () => {
  beforeEach(async () => {
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = 'test-anthropic-key';
    await AsyncStorage.clear();
    // clearAllMocks resets call counts without wiping AsyncStorage mock implementations
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  });

  describe('API key validation', () => {
    it('throws when Anthropic API key is missing', async () => {
      delete process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      await expect(getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE)).rejects.toThrow(
        'Anthropic API key not configured'
      );
    });
  });

  describe('fresh fetch', () => {
    it('fetches suggestions from Anthropic API when cache is empty', async () => {
      mockFetchSuccess();
      const result = await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      expect(result).toBe(MOCK_SUGGESTION_TEXT);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('sends a POST request to the Anthropic API', async () => {
      mockFetchSuccess();
      await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('includes the API key in request headers', async () => {
      mockFetchSuccess();
      await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers['x-api-key']).toBe('test-anthropic-key');
    });

    it('includes user profile in the request body', async () => {
      mockFetchSuccess();
      await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      const userMessage = body.messages[0].content;
      expect(userMessage).toContain('Test User');
      expect(userMessage).toContain('1800');
    });

    it('caches the result in AsyncStorage', async () => {
      mockFetchSuccess();
      await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      const cached = await AsyncStorage.getItem('claude_suggestions_cache_v2');
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached!);
      expect(parsed.text).toBe(MOCK_SUGGESTION_TEXT);
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it('throws on Anthropic API error response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Internal server error' } }),
      });
      await expect(getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE)).rejects.toThrow(
        'Internal server error'
      );
    });
  });

  describe('cache behaviour', () => {
    it('returns cached suggestions when cache is fresh', async () => {
      const cachedData = { text: 'Cached suggestion', timestamp: Date.now() };
      await AsyncStorage.setItem('claude_suggestions_cache_v2', JSON.stringify(cachedData));

      global.fetch = jest.fn();
      const result = await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      expect(result).toBe('Cached suggestion');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches fresh suggestions when cache is expired (>24h)', async () => {
      const expiredData = {
        text: 'Old suggestion',
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      };
      await AsyncStorage.setItem('claude_suggestions_cache_v2', JSON.stringify(expiredData));

      mockFetchSuccess();
      const result = await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      expect(result).toBe(MOCK_SUGGESTION_TEXT);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const cachedData = { text: 'Cached suggestion', timestamp: Date.now() };
      await AsyncStorage.setItem('claude_suggestions_cache_v2', JSON.stringify(cachedData));

      mockFetchSuccess();
      const result = await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE, true);
      expect(result).toBe(MOCK_SUGGESTION_TEXT);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetches when cache key is missing (old v1 cache has no effect)', async () => {
      // Simulates a user who had the old cache key — should still fetch fresh
      const oldCacheData = { text: 'Old v1 suggestion', timestamp: Date.now() };
      await AsyncStorage.setItem('claude_suggestions_cache', JSON.stringify(oldCacheData));

      global.fetch = jest.fn();
      mockFetchSuccess();
      const result = await getNutritionSuggestions(MOCK_LOGS, MOCK_PROFILE);
      expect(result).toBe(MOCK_SUGGESTION_TEXT);
    });
  });

  describe('clearSuggestionsCache', () => {
    it('removes the cache entry from AsyncStorage', async () => {
      await AsyncStorage.setItem('claude_suggestions_cache_v2', JSON.stringify({ text: 'test', timestamp: Date.now() }));
      await clearSuggestionsCache();
      const result = await AsyncStorage.getItem('claude_suggestions_cache_v2');
      expect(result).toBeNull();
    });
  });
});
