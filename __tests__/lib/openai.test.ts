import { analyzeMealPhoto } from '../../lib/openai';

const VALID_ANALYSIS = {
  meal_name: 'Grilled Chicken Salad',
  foods: ['chicken breast', 'lettuce', 'tomato', 'cucumber'],
  total_calories: 350,
  protein_g: 35,
  carbs_g: 20,
  fat_g: 12,
  fiber_g: 4,
  sugar_g: 6,
  sodium_mg: 450,
  cholesterol_mg: 80,
  saturated_fat_g: 2,
};

function mockFetchOk(body: object) {
  return jest.fn().mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify(body) } }] }),
  });
}

function mockFetchError(status: number, message: string) {
  return jest.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  });
}

describe('analyzeMealPhoto', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  describe('API key validation', () => {
    it('throws when API key is missing', async () => {
      delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      await expect(analyzeMealPhoto('base64data')).rejects.toThrow('OpenAI API key not configured');
    });
  });

  describe('successful analysis', () => {
    it('returns parsed meal analysis with all fields', async () => {
      global.fetch = mockFetchOk(VALID_ANALYSIS);
      const result = await analyzeMealPhoto('base64data');
      expect(result.meal_name).toBe('Grilled Chicken Salad');
      expect(result.total_calories).toBe(350);
      expect(result.protein_g).toBe(35);
      expect(result.carbs_g).toBe(20);
      expect(result.fat_g).toBe(12);
      expect(result.fiber_g).toBe(4);
      expect(result.sugar_g).toBe(6);
      expect(result.sodium_mg).toBe(450);
      expect(result.cholesterol_mg).toBe(80);
      expect(result.saturated_fat_g).toBe(2);
      expect(result.foods).toEqual(['chicken breast', 'lettuce', 'tomato', 'cucumber']);
    });

    it('sends a POST request to the OpenAI API', async () => {
      global.fetch = mockFetchOk(VALID_ANALYSIS);
      await analyzeMealPhoto('mybase64');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('includes the base64 image in the request body', async () => {
      global.fetch = mockFetchOk(VALID_ANALYSIS);
      await analyzeMealPhoto('mybase64');
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      const imageContent = body.messages[0].content.find((c: any) => c.type === 'image_url');
      expect(imageContent.image_url.url).toContain('mybase64');
    });

    it('strips markdown code fences from response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '```json\n' + JSON.stringify(VALID_ANALYSIS) + '\n```' } }],
        }),
      });
      const result = await analyzeMealPhoto('base64data');
      expect(result.meal_name).toBe('Grilled Chicken Salad');
    });

    it('strips plain code fences from response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '```\n' + JSON.stringify(VALID_ANALYSIS) + '\n```' } }],
        }),
      });
      const result = await analyzeMealPhoto('base64data');
      expect(result.meal_name).toBe('Grilled Chicken Salad');
    });
  });

  describe('default value handling', () => {
    it('defaults meal_name to "Meal" when missing', async () => {
      global.fetch = mockFetchOk({ ...VALID_ANALYSIS, meal_name: '' });
      const result = await analyzeMealPhoto('base64');
      expect(result.meal_name).toBe('Meal');
    });

    it('defaults foods to empty array when not an array', async () => {
      global.fetch = mockFetchOk({ ...VALID_ANALYSIS, foods: 'chicken' });
      const result = await analyzeMealPhoto('base64');
      expect(result.foods).toEqual([]);
    });

    it('defaults numeric fields to 0 when missing', async () => {
      global.fetch = mockFetchOk({ meal_name: 'Snack', foods: [] });
      const result = await analyzeMealPhoto('base64');
      expect(result.total_calories).toBe(0);
      expect(result.protein_g).toBe(0);
      expect(result.carbs_g).toBe(0);
      expect(result.fat_g).toBe(0);
      expect(result.fiber_g).toBe(0);
      expect(result.sugar_g).toBe(0);
      expect(result.sodium_mg).toBe(0);
      expect(result.cholesterol_mg).toBe(0);
      expect(result.saturated_fat_g).toBe(0);
    });

    it('coerces string numbers to actual numbers', async () => {
      global.fetch = mockFetchOk({ ...VALID_ANALYSIS, total_calories: '350', protein_g: '35.5' });
      const result = await analyzeMealPhoto('base64');
      expect(result.total_calories).toBe(350);
      expect(result.protein_g).toBe(35.5);
    });
  });

  describe('request configuration', () => {
    it('uses gpt-4o-mini for faster analysis', async () => {
      global.fetch = mockFetchOk(VALID_ANALYSIS);
      await analyzeMealPhoto('base64data');
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini');
    });

    it('uses detail:auto to reduce token usage', async () => {
      global.fetch = mockFetchOk(VALID_ANALYSIS);
      await analyzeMealPhoto('base64data');
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      const imageContent = body.messages[0].content.find((c: any) => c.type === 'image_url');
      expect(imageContent.image_url.detail).toBe('auto');
    });

    it('caps response at 500 tokens', async () => {
      global.fetch = mockFetchOk(VALID_ANALYSIS);
      await analyzeMealPhoto('base64data');
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.max_tokens).toBe(500);
    });
  });

  describe('error handling', () => {
    it('throws on 429 rate limit error', async () => {
      global.fetch = mockFetchError(429, 'Rate limit exceeded');
      await expect(analyzeMealPhoto('base64')).rejects.toThrow('Rate limit exceeded');
    });

    it('throws on 401 unauthorized error', async () => {
      global.fetch = mockFetchError(401, 'Invalid API key');
      await expect(analyzeMealPhoto('base64')).rejects.toThrow('Invalid API key');
    });

    it('throws on 500 server error', async () => {
      global.fetch = mockFetchError(500, 'Internal server error');
      await expect(analyzeMealPhoto('base64')).rejects.toThrow('Internal server error');
    });

    it('throws descriptive error when JSON response is malformed', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'not valid json {{' } }] }),
      });
      await expect(analyzeMealPhoto('base64')).rejects.toThrow('Could not read the meal analysis response');
    });

    it('throws timeout error when request is aborted after 20 seconds', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn().mockImplementationOnce((_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
      );

      const promise = analyzeMealPhoto('base64');
      jest.advanceTimersByTime(20001);
      await expect(promise).rejects.toThrow('Analysis timed out');
      jest.useRealTimers();
    });

    it('clears the timeout when fetch resolves quickly', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      global.fetch = mockFetchOk(VALID_ANALYSIS);

      await analyzeMealPhoto('base64');
      expect(clearTimeoutSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
