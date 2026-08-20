const STORAGE_KEY = 'calobit_gemini_api_key';
const USAGE_KEY = 'calobit_ai_usage';
const FREE_MONTHLY_USES = 15;

export const AI_QUOTA_MSG =
  "You've used this month's 15 free AI actions. Add your own free Gemini key in Settings (takes 2 minutes) to keep using AI, or wait until next month.";
const AI_RATE_MSG =
  'Free AI is temporarily rate-limited. Try again in a little while, or add your own free Gemini key in Settings for unlimited AI.';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDevUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
    if (raw && raw.month === currentMonth()) return Number(raw.count) || 0;
  } catch {}
  return 0;
}

/** Free shared-key AI actions remaining this month. Honor-system count. */
export function getFreeUsesLeft() {
  return Math.max(0, FREE_MONTHLY_USES - getDevUsage());
}

function recordDevUse() {
  localStorage.setItem(USAGE_KEY, JSON.stringify({ month: currentMonth(), count: getDevUsage() + 1 }));
}

/** The user's own key saved in Settings — never the shared one. */
export function getUserApiKey() {
  const customKey = localStorage.getItem(STORAGE_KEY);
  return customKey && customKey.trim().length > 0 ? customKey.trim() : '';
}

/**
 * Which key to send to Google for a call: the user's own key always wins;
 * otherwise the shared key is used while the free monthly allowance lasts.
 */
function resolveApiKey(override = null) {
  const userKey = override || getUserApiKey();
  if (userKey) return { apiKey: userKey, shared: false };
  if (getFreeUsesLeft() > 0) {
    const shared = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (shared) return { apiKey: shared, shared: true };
  }
  return { apiKey: '', shared: true };
}

export function getGeminiApiKey() {
  const customKey = localStorage.getItem(STORAGE_KEY);
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function saveGeminiApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function callGeminiAPI(prompt, systemInstruction = '', apiKeyOverride = null) {
  const { apiKey, shared: usingSharedKey } = resolveApiKey(apiKeyOverride);
  if (!apiKey) {
    throw new Error(AI_QUOTA_MSG);
  }

  // gemini-2.5-flash — fast and included in the free tier of a personal key.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: systemInstruction ? `${systemInstruction}\n\nUser Prompt: ${prompt}` : prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error(AI_RATE_MSG);
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error?.message) {
        msg = errJson.error.message;
      }
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('No content returned from Gemini AI.');
  }

  if (usingSharedKey) recordDevUse();
  return JSON.parse(rawText);
}

/**
 * AI Food Search: returns matching foods with macros per 100g
 */
export async function searchFoodAI(query, category = 'all') {
  const systemInstruction = `You are a nutrition database AI expert. The user is searching for food items matching a query.
Return a JSON array of up to 8 food items matching the query/category.
Format each item as an object:
{
  "name": "Food Name",
  "category": "desi|protein|fast_food|italian|asian|middle_eastern|fruits|vegetables|staples|nuts|dairy|beverages|other",
  "caloriesPer100g": number (integer),
  "proteinPer100g": number (float/int),
  "carbsPer100g": number (float/int),
  "fatPer100g": number (float/int)
}`;

  const prompt = `Search query: "${query}". Category filter: "${category}". Provide accurate nutrition per 100g.`;
  return await callGeminiAPI(prompt, systemInstruction);
}

/**
 * Natural Language AI Meal Logger: Parses meal text into estimated macros and items
 */
export async function parseMealAI(mealDescription) {
  const systemInstruction = `You are an AI nutrition log assistant. Analyze the user's natural language meal description and compute total macros and individual items.
Return a JSON object strictly matching this format:
{
  "meal_name": "Short summary of meal",
  "type": "breakfast|lunch|dinner|snack",
  "totalCalories": number (integer),
  "totalProtein": number (float/int),
  "totalCarbs": number (float/int),
  "totalFat": number (float/int),
  "items": [
    {
      "name": "Item description with portion",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ]
}`;

  const prompt = `Analyze this meal: "${mealDescription}"`;
  return await callGeminiAPI(prompt, systemInstruction);
}

/**
 * AI Nutrition-Panel Reader: parses a photo of a nutrition facts table
 * into per-100g macros (the same shape as a local food item, so the
 * existing scaleFoodNutrition / logMeal flow applies unchanged).
 *
 * When the label shows per-serving values, the AI converts them to per 100g.
 */
export async function parseNutritionPanel(base64Image, mimeType = 'image/jpeg') {
  const { apiKey, shared: usingSharedKey } = resolveApiKey();
  if (!apiKey) {
    throw new Error(AI_QUOTA_MSG);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `You are a nutrition label OCR expert. The user photographed a packaged food's nutrition facts panel.
Carefully read the label. Convert anything given per serving to per 100g using the serving size shown on the label.
Return a JSON object exactly matching this format:
{
  "name": "Product name as printed on the label",
  "caloriesPer100g": number (integer),
  "proteinPer100g": number (float/int, grams per 100g),
  "carbsPer100g": number (float/int, grams per 100g),
  "fatPer100g": number (float/int, grams per 100g)
}
If a value is not visible, use 0. Only return the JSON object.`;

  const prompt = `Nutrition facts panel photo. Extract calories, protein, carbs and fat per 100g:\n\n${systemInstruction}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Image } },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error(AI_RATE_MSG);
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error?.message) {
        msg = errJson.error.message;
      }
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('No content returned from Gemini AI.');
  }

  const parsed = JSON.parse(rawText);
  if (usingSharedKey) recordDevUse();
  const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  return {
    name: parsed.name || 'Scanned food',
    caloriesPer100g: Math.round(Number(parsed.caloriesPer100g) || 0),
    proteinPer100g: round1(parsed.proteinPer100g),
    carbsPer100g: round1(parsed.carbsPer100g),
    fatPer100g: round1(parsed.fatPer100g),
  };
}

/**
 * AI Health Insights / Advice
 */
export async function getAIAdvice(meals, goals, profile) {
  const systemInstruction = `You are a friendly AI health and nutrition coach. Give a 2-3 sentence personalized encouragement and actionable tip based on the user's logged meals today and target goals.
Return a JSON object: { "advice": "string" }`;

  const prompt = `User profile: ${JSON.stringify(profile)}. Daily Goals: ${JSON.stringify(goals)}. Today's Meals logged: ${JSON.stringify(meals)}.`;
  return await callGeminiAPI(prompt, systemInstruction);
}
