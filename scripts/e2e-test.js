require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ping(base) {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${base}/api/article/all`);
      if (r.ok) return true;
    } catch (_) {}
    await wait(1000);
  }
  throw new Error('Serverul nu a răspuns la timp');
}

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:3001';
  await ping(base);

  // 1) Test LLM endpoint: generate by prompt (nu scrie în DB)
  const promptRes = await fetch(`${base}/api/generateNewsByPrompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userPrompt: 'Scrie un paragraf scurt de test despre un rezultat sportiv ipotetic, doar 3-4 fraze.'
    })
  });
  const promptJson = await promptRes.json();
  console.log('generateNewsByPrompt status:', promptRes.status, 'title:', (promptJson?.title || '').slice(0, 80));

  // 2) Test generare virală (scrie în DB)
  const topic = `Test viral automat ${new Date().toISOString()}`;
  const viralRes = await fetch(`${base}/api/generateViralArticles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 1, forceRefresh: true, topics: [topic] })
  });
  const viralJson = await viralRes.json();
  console.log('generateViralArticles status:', viralRes.status, 'generated:', viralJson?.articles?.length || 0);

  // 3) Confirmare citire DB
  const listRes = await fetch(`${base}/api/article/all`);
  const listJson = await listRes.json();
  console.log('articles in DB:', Array.isArray(listJson) ? listJson.length : 'unknown');
  if (Array.isArray(listJson) && listJson.length > 0) {
    console.log('latest article:', listJson[0].title?.slice(0, 80));
  }
}

run().catch((e) => {
  console.error('Eroare E2E:', e.message);
  process.exitCode = 1;
});

