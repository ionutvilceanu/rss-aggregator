import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureArticlesTable, generateArticlesFromTopics } from '../../lib/articleGenerator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  try {
    await ensureArticlesTable();

    const count = Number.isFinite(req.body?.count) ? Number(req.body.count) : undefined;
    const forceRefresh = req.body.forceRefresh === true;
    const customDate = req.body.customDate ? new Date(req.body.customDate) : null;

    const result = await generateArticlesFromTopics({ count, forceRefresh, customDate });

    return res.status(200).json({
      message: `Generate ${result.articles.length} articole sport`,
      articles: result.articles,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Eroare la generarea știrilor:', error);
    return res.status(500).json({
      error: 'Eroare la generarea știrilor',
      details: (error as Error).message,
    });
  }
}
