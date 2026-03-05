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

async function groqComplete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.GROQ_API_KEY ||
    '';
  if (!apiKey) {
    throw new Error('Lipsește LLM_API_KEY (sau GROQ_API_KEY) în variabilele de mediu');
  }

  const model =
    options.model ||
    process.env.LLM_MODEL ||
    'qwen/qwen3-32b';

  const apiBase =
    (process.env.LLM_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.5,
    // Limitem tokens pentru a evita 429 TPM la planul on_demand
    max_tokens: options.maxTokens ?? Number(process.env.LLM_MAX_TOKENS || 1500)
  };

  // Retry cu backoff pentru 429
  const maxAttempts = Number(process.env.LLM_MAX_ATTEMPTS || 3);
  let attempt = 0;
  let lastError: Error | undefined;
  while (attempt < maxAttempts) {
    attempt += 1;
    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (resp.ok) {
      const data = (await resp.json()) as any;
      return data?.choices?.[0]?.message?.content || '';
    }

    const txt = await resp.text().catch(() => '');
    if (resp.status === 429) {
      // Încearcă să respecți Retry-After sau cifra din mesaj
      const retryAfterHeader = resp.headers.get('retry-after');
      let waitMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : 0;
      if (!waitMs) {
        const m = txt.match(/try again in\s+([0-9]+(?:\.[0-9]+)?)s/i);
        if (m) waitMs = Math.ceil(parseFloat(m[1]) * 1000);
      }
      if (!waitMs) waitMs = 25000; // fallback
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }

    lastError = new Error(`Eroare LLM ${resp.status} ${resp.statusText}: ${txt}`);
    break;
  }
  throw lastError || new Error('Eroare necunoscută LLM');
}

async function geminiComplete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Lipsește GOOGLE_GEMINI_API_KEY în variabilele de mediu');
  }

  const model =
    options.model ||
    process.env.LLM_MODEL ||
    // Recomandat pentru free tier: gemini-1.5-flash
    'gemini-1.5-flash';

  // Concatenăm eventualele mesaje de tip system la primul mesaj user
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  const nonSystem = messages.filter((m) => m.role !== 'system');
  const contents = nonSystem.map((m, idx) => {
    const text = m.role === 'user' && systemText && idx === 0
      ? `${systemText}\n\n${m.content}`
      : m.content;
    return {
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text }]
    };
  });

  const maxOutputTokens = options.maxTokens ?? Number(process.env.LLM_MAX_TOKENS || 1500);
  const temperature = options.temperature ?? 0.5;

  // Endpoint oficial (v1beta funcționează stabil pentru generateContent)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${apiKey}`;

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens
    }
  };

  // Retry simplu pentru rate-limit/erori tranzitorii
  const maxAttempts = Number(process.env.LLM_MAX_ATTEMPTS || 3);
  let attempt = 0;
  let lastError: Error | undefined;
  while (attempt < maxAttempts) {
    attempt += 1;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const txt = await resp.text().catch(() => '');
    if (resp.ok) {
      try {
        const data = JSON.parse(txt) as any;
        const candidates = data?.candidates || [];
        const text =
          candidates[0]?.content?.parts?.map((p: any) => p?.text).join('') ||
          candidates[0]?.content?.parts?.[0]?.text ||
          '';
        return text;
      } catch {
        return txt;
      }
    }
    // Retry pe 429/503
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
 * - Dacă LLM_PROVIDER=gemini sau există GOOGLE_GEMINI_API_KEY (și LLM_PROVIDER != 'groq'), folosește Gemini
 * - Altfel folosește Groq (OpenAI-compatible)
 * - La eroare pe provider-ul selectat, dacă există cheia celuilalt provider, încearcă fallback
 */
export async function chatComplete(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY;
  const hasGroq = !!(process.env.LLM_API_KEY || process.env.GROQ_API_KEY);

  const preferGemini = provider === 'gemini' || (hasGemini && provider !== 'groq');

  if (preferGemini) {
    try {
      return await geminiComplete(messages, options);
    } catch (e) {
      if (hasGroq) {
        return await groqComplete(messages, options);
      }
      throw e;
    }
  } else {
    try {
      return await groqComplete(messages, options);
    } catch (e) {
      if (hasGemini) {
        return await geminiComplete(messages, options);
      }
      throw e;
    }
  }
}
