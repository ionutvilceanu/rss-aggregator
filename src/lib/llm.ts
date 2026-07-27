import fetch from 'node-fetch';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const OPENROUTER_DEFAULT_MODELS = [
  'openai/gpt-oss-120b',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
];

function getOpenRouterModels(): string[] {
  const fromEnv = (process.env.LLM_MODEL || '').trim();
  if (fromEnv) {
    const fallbacks = (process.env.LLM_FALLBACK_MODELS || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    return [fromEnv, ...fallbacks.filter((m) => m !== fromEnv)];
  }
  return OPENROUTER_DEFAULT_MODELS;
}

async function openaiCompatibleComplete(
  messages: ChatMessage[],
  options: ChatOptions = {},
  config: {
    apiKey: string;
    apiBase: string;
    defaultModel: string;
    extraHeaders?: Record<string, string>;
    models?: string[];
  }
): Promise<string> {
  const { apiKey, apiBase, defaultModel, extraHeaders = {}, models } = config;
  if (!apiKey) {
    throw new Error('Lipsește cheia API pentru LLM');
  }

  const modelList = models?.length ? models : [options.model || defaultModel];
  const maxAttempts = Number(process.env.LLM_MAX_ATTEMPTS || 3);
  let lastError: Error | undefined;

  for (const model of modelList) {
    const body = {
      model,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? Number(process.env.LLM_MAX_TOKENS || 2000),
    };

    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      const resp = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
        const content = data?.choices?.[0]?.message?.content || '';
        if (content) return content;
        lastError = new Error(`Răspuns gol de la modelul ${model}`);
        break;
      }

      const txt = await resp.text().catch(() => '');
      if (resp.status === 429 || resp.status === 503) {
        const retryAfterHeader = resp.headers.get('retry-after');
        let waitMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : 0;
        if (!waitMs) {
          const m = txt.match(/try again in\s+([0-9]+(?:\.[0-9]+)?)s/i);
          if (m) waitMs = Math.ceil(parseFloat(m[1]) * 1000);
        }
        if (!waitMs) waitMs = 20000;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

      lastError = new Error(`Eroare LLM ${resp.status} ${resp.statusText} (${model}): ${txt}`);
      break;
    }
  }

  throw lastError || new Error('Eroare necunoscută LLM');
}

async function openRouterComplete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.LLM_API_KEY ||
    '';
  const apiBase = (process.env.LLM_API_BASE || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const siteUrl = process.env.OPENROUTER_SITE_URL || 'https://www.sportazi.ro';
  const appName = process.env.OPENROUTER_APP_NAME || 'SportAzi';

  return openaiCompatibleComplete(messages, options, {
    apiKey,
    apiBase,
    defaultModel: 'openai/gpt-oss-120b',
    models: getOpenRouterModels(),
    extraHeaders: {
      'HTTP-Referer': siteUrl,
      'X-Title': appName,
    },
  });
}

async function groqComplete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '';
  const apiBase = (process.env.LLM_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');

  return openaiCompatibleComplete(messages, options, {
    apiKey,
    apiBase,
    defaultModel: process.env.LLM_MODEL || 'qwen/qwen3-32b',
  });
}

async function geminiComplete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Lipsește GOOGLE_GEMINI_API_KEY în variabilele de mediu');
  }

  const model = options.model || process.env.LLM_MODEL || 'gemini-1.5-flash';

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  const nonSystem = messages.filter((m) => m.role !== 'system');
  const contents = nonSystem.map((m, idx) => {
    const text =
      m.role === 'user' && systemText && idx === 0 ? `${systemText}\n\n${m.content}` : m.content;
    return {
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text }],
    };
  });

  const maxOutputTokens = options.maxTokens ?? Number(process.env.LLM_MAX_TOKENS || 2000);
  const temperature = options.temperature ?? 0.5;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${apiKey}`;

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  const maxAttempts = Number(process.env.LLM_MAX_ATTEMPTS || 3);
  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt < maxAttempts) {
    attempt += 1;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await resp.text().catch(() => '');
    if (resp.ok) {
      try {
        const data = JSON.parse(txt) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const candidates = data?.candidates || [];
        const text =
          candidates[0]?.content?.parts?.map((p) => p?.text).join('') ||
          candidates[0]?.content?.parts?.[0]?.text ||
          '';
        return text;
      } catch {
        return txt;
      }
    }
    if (resp.status === 429 || resp.status === 503) {
      const retryAfterHeader = resp.headers.get('retry-after');
      const waitMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : 20000;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }
    lastError = new Error(`Eroare Gemini ${resp.status} ${resp.statusText}: ${txt}`);
    break;
  }
  throw lastError || new Error('Eroare necunoscută Gemini');
}

/**
 * chatComplete cu selecție de provider:
 * - openrouter (default dacă OPENROUTER_API_KEY există)
 * - groq
 * - gemini
 */
export async function chatComplete(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const hasOpenRouter = !!(
    process.env.OPENROUTER_API_KEY ||
    (process.env.LLM_PROVIDER || '').toLowerCase() === 'openrouter' ||
    process.env.LLM_API_BASE?.includes('openrouter')
  );
  const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY;
  const hasGroq = !!(process.env.LLM_API_KEY || process.env.GROQ_API_KEY);

  const preferOpenRouter =
    provider === 'openrouter' || (hasOpenRouter && provider !== 'groq' && provider !== 'gemini');
  const preferGemini = provider === 'gemini';

  if (preferOpenRouter) {
    try {
      return await openRouterComplete(messages, options);
    } catch (e) {
      if (hasGroq && provider !== 'openrouter') {
        return await groqComplete(messages, options);
      }
      if (hasGemini) {
        return await geminiComplete(messages, options);
      }
      throw e;
    }
  }

  if (preferGemini) {
    try {
      return await geminiComplete(messages, options);
    } catch (e) {
      if (hasOpenRouter) return await openRouterComplete(messages, options);
      if (hasGroq) return await groqComplete(messages, options);
      throw e;
    }
  }

  try {
    return await groqComplete(messages, options);
  } catch (e) {
    if (hasOpenRouter) return await openRouterComplete(messages, options);
    if (hasGemini) return await geminiComplete(messages, options);
    throw e;
  }
}
