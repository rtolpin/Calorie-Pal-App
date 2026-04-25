import { MealAnalysis } from '../types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const ANALYSIS_PROMPT = `You are a professional nutritionist and food scientist with expertise in visual portion estimation. Analyze this meal photo with special attention to depth, volume, and container size.

Follow this estimation process:
1. CONTAINER/PLATE: Identify the vessel (small bowl ~350ml, medium bowl ~600ml, large bowl ~900ml, dinner plate ~26cm, side plate ~20cm, cup, glass, takeout box, etc.)
2. FILL LEVEL: Estimate how full the container is (quarter, half, three-quarters, full, heaped)
3. DEPTH/HEIGHT: Assess the height of the food — a mounded plate of pasta holds far more than a flat one
4. DENSITY: Consider whether it is a dense food (meat, rice, cheese) or light food (salad, broth)
5. EACH COMPONENT: Identify every visible food and estimate its weight in grams based on the above cues

Use these reference anchors:
- A heaped medium bowl of pasta ≈ 300–400g cooked (450–600 kcal)
- A large takeout container of rice ≈ 400–500g (500–650 kcal)
- A dinner plate with generous protein serving ≈ 150–200g meat
- A small side bowl of sauce or soup ≈ 150–200ml
- A standard handful of nuts ≈ 30g
- Adjust upward significantly for large containers, heaped portions, or dense foods

Return ONLY a valid JSON object with these exact fields: { "meal_name": string, "foods": string[], "total_calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "sugar_g": number, "sodium_mg": number, "cholesterol_mg": number, "saturated_fat_g": number }. Do not include any text outside the JSON object.`;

export async function analyzeMealPhoto(base64Image: string): Promise<MealAnalysis> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'auto',
                },
              },
              {
                type: 'text',
                text: ANALYSIS_PROMPT,
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('Analysis timed out. Please try again.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || '';

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let parsed: MealAnalysis;
  try {
    parsed = JSON.parse(cleaned) as MealAnalysis;
  } catch {
    throw new Error('Could not read the meal analysis response. Please try again.');
  }

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
