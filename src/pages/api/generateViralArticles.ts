import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureArticlesTable, generateArticlesFromTopics } from '../../lib/articleGenerator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  const count = Number.isFinite(req.body?.count) ? Number(req.body.count) : 5;
  const forceRefresh = req.body?.forceRefresh === true;

  try {
    await ensureArticlesTable();
    const result = await generateArticlesFromTopics({ count, forceRefresh });

    return res.status(200).json({
      message: `S-au generat ${result.articles.length} articole virale sport`,
      articles: result.articles,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Eroare la generarea articolelor virale:', error);
    return res.status(500).json({ error: 'Eroare la generarea articolelor virale' });
  }
}
