import { MealAnalysis } from '../types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const ANALYSIS_PROMPT = `You are a professional nutritionist. Analyze this meal photo carefully. Identify all visible food items and estimate realistic portion sizes. Return ONLY a valid JSON object with these exact fields: { "meal_name": string, "foods": string[], "total_calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "sugar_g": number, "sodium_mg": number, "cholesterol_mg": number, "saturated_fat_g": number }. Be as accurate as possible with portion estimates based on standard serving sizes. Do not include any text outside the JSON object.`;

export async function analyzeMealPhoto(base64Image: string): Promise<MealAnalysis> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || '';

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  const parsed = JSON.parse(cleaned) as MealAnalysis;

  // Normalize field name variations
  return {
    meal_name: parsed.meal_name || 'Meal',
    foods: Array.isArray(parsed.foods) ? parsed.foods : [],
    total_calories: Number(parsed.total_calories) || 0,
    protein_g: Number(parsed.protein_g) || 0,
    carbs_g: Number(parsed.carbs_g) || 0,
    fat_g: Number(parsed.fat_g) || 0,
    fiber_g: Number(parsed.fiber_g) || 0,
    sugar_g: Number(parsed.sugar_g) || 0,
    sodium_mg: Number(parsed.sodium_mg) || 0,
    cholesterol_mg: Number(parsed.cholesterol_mg) || 0,
    saturated_fat_g: Number(parsed.saturated_fat_g) || 0,
  };
}
