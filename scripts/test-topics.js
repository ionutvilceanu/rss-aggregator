require('dotenv').config({ path: '.env.local' });

async function main() {
  // Dynamic import for TS module - use ts-node or compile. Simpler: test feeds via fetch
  const Parser = require('rss-parser');
  const parser = new Parser({ headers: { 'User-Agent': 'SportAziBot/1.0' } });

  const feeds = [
    'https://www.digisport.ro/rss',
    'https://news.google.com/rss/search?q=sport+when:1d&hl=ro&gl=RO&ceid=RO:ro',
  ];

  for (const url of feeds) {
    try {
      const data = await parser.parseURL(url);
      console.log(`OK ${url}: ${data.items?.length || 0} items`);
      if (data.items?.[0]) {
        console.log('  Sample:', data.items[0].title?.slice(0, 80));
      }
    } catch (e) {
      console.error(`FAIL ${url}:`, e.message);
    }
  }
}

main();
