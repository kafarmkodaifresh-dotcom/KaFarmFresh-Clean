/**
 * aiProvider.js
 * 
 * Multi‑AI provider with automatic failover.
 * Priority: Gemini → Groq → GPT → Claude → DeepSeek
 * 
 * Each provider is tried sequentially. If one fails (rate limit, API error, timeout),
 * the system instantly switches to the next available provider.
 * 
 * All providers support vision and text (where available).
 */

// ─── Provider configurations ──────────────────────────────────
const PROVIDERS = [
  {
    name: 'Gemini',
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    // Supports vision + text
  },
  {
    name: 'Groq',
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    // Text only
  },
  {
    name: 'GPT',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    url: 'https://api.openai.com/v1/chat/completions',
    // Supports vision + text (if using gpt-4o)
  },
  {
    name: 'Claude',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    url: 'https://api.anthropic.com/v1/messages',
    // Supports vision + text (if using claude-3.5-sonnet)
  },
  {
    name: 'DeepSeek',
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
    url: 'https://api.deepseek.com/chat/completions',
    // Text only
  },
];

/**
 * Calls a single AI provider with the given prompt and optional image.
 * @param {Object} provider - Provider configuration object.
 * @param {string} prompt - The text prompt.
 * @param {string|null} imageData - Base64 image data (optional).
 * @returns {Promise<string>} The AI response text.
 */
const callProvider = async (provider, prompt, imageData = null) => {
  if (!provider.apiKey) {
    throw new Error(`${provider.name} API key is missing.`);
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  let body;
  let response;

  // ─── Gemini ──────────────────────────────────────────────────
  if (provider.name === 'Gemini') {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    const parts = [{ text: prompt }];
    if (imageData) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageData } });
    }
    body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    });
    response = await fetch(`${provider.url}?key=${provider.apiKey}`, { method: 'POST', headers, body });

  // ─── Groq ────────────────────────────────────────────────────
  } else if (provider.name === 'Groq') {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1200,
    });
    response = await fetch(provider.url, { method: 'POST', headers, body });

  // ─── GPT ─────────────────────────────────────────────────────
  } else if (provider.name === 'GPT') {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    const messages = [{ role: 'user', content: prompt }];
    if (imageData) {
      messages[0].content = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } },
      ];
    }
    body = JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.4,
      max_tokens: 1200,
    });
    response = await fetch(provider.url, { method: 'POST', headers, body });

  // ─── Claude ──────────────────────────────────────────────────
  } else if (provider.name === 'Claude') {
    headers['x-api-key'] = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const content = [{ type: 'text', text: prompt }];
    if (imageData) {
      content.unshift({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData } });
    }
    body = JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1200,
      messages: [{ role: 'user', content }],
    });
    response = await fetch(provider.url, { method: 'POST', headers, body });

  // ─── DeepSeek ───────────────────────────────────────────────
  } else if (provider.name === 'DeepSeek') {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1200,
    });
    response = await fetch(provider.url, { method: 'POST', headers, body });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // ─── Parse response based on provider ──────────────────────
  if (provider.name === 'Gemini') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (provider.name === 'Groq' || provider.name === 'GPT' || provider.name === 'DeepSeek') {
    return data.choices?.[0]?.message?.content || '';
  }
  if (provider.name === 'Claude') {
    return data.content?.[0]?.text || '';
  }

  return '';
};

/**
 * Calls AI providers in sequence until one succeeds.
 * @param {string} prompt - The text prompt.
 * @param {string|null} imageData - Base64 image data (optional).
 * @returns {Promise<Object>} { response, provider }
 */
export const callAI = async (prompt, imageData = null) => {
  for (const provider of PROVIDERS) {
    try {
      const response = await callProvider(provider, prompt, imageData);
      if (response && response.trim().length > 0) {
        console.log(`✅ AI provider used: ${provider.name}`);
        return { response, provider: provider.name };
      }
    } catch (error) {
      console.warn(`⚠️ ${provider.name} failed: ${error.message}. Switching to next provider.`);
    }
  }

  // ─── All providers failed ──────────────────────────────────
  throw new Error('All AI providers are currently unavailable. Please try again later.');
};

export default callAI;
