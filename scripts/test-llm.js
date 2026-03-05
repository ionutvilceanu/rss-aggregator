require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function main() {
  const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
  const apiBase = (process.env.LLM_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL || 'qwen/qwen3-32b';
  if (!apiKey) throw new Error('Missing LLM_API_KEY/GROQ_API_KEY');

  const body = {
    model,
    messages: [
      { role: 'system', content: 'Ești un asistent care răspunde concis în română.' },
      { role: 'user', content: 'Spune „ok” dacă funcționezi.' }
    ],
    temperature: 0.2,
    max_tokens: 16
  };

  const resp = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  console.log('LLM răspuns brut:', text);
}

main().catch((e) => {
  console.error('Eroare LLM:', e.message);
  process.exitCode = 1;
});

