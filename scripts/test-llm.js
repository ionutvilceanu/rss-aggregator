require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function main() {
  const provider = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  const apiKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.GROQ_API_KEY;
  const apiBase = (
    process.env.LLM_API_BASE || 'https://openrouter.ai/api/v1'
  ).replace(/\/+$/, '');
  const model = process.env.LLM_MODEL || 'openai/gpt-oss-120b';

  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY / LLM_API_KEY');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === 'openrouter' || apiBase.includes('openrouter')) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL || 'https://www.sportazi.ro';
    headers['X-Title'] = process.env.OPENROUTER_APP_NAME || 'SportAzi';
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: 'Ești un asistent care răspunde concis în română.' },
      { role: 'user', content: 'Spune „ok” dacă funcționezi.' },
    ],
    temperature: 0.2,
    max_tokens: 16,
  };

  console.log(`Test LLM: provider=${provider}, model=${model}, base=${apiBase}`);

  const resp = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  console.log('LLM OK:', text);
}

main().catch((e) => {
  console.error('Eroare LLM:', e.message);
  process.exitCode = 1;
});
