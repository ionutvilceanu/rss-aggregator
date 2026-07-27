import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureArticlesTable, generateArticlesFromTopics } from '../../lib/articleGenerator';

/**
 * Cron job: generează știri sport la fiecare oră.
 * Configurație cron recomandată: 45 * * * *
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log(`[CRON] Rulare job programat la ${new Date().toISOString()}`);

    await ensureArticlesTable();
    const result = await generateArticlesFromTopics({
      count: 3,
      forceRefresh: true,
    });

    console.log(`[CRON] Job finalizat. Articole generate: ${result.articles.length}`);

    return res.status(200).json({
      success: true,
      message: `Cron job rulat cu succes la ${new Date().toISOString()}`,
      articlesGenerated: result.articles.length,
      skipped: result.skipped,
      errors: result.errors,
      articles: result.articles,
    });
  } catch (error) {
    console.error('[CRON] Eroare la rularea job-ului:', error);
    return res.status(500).json({
      success: false,
      message: 'Eroare la rularea cron job-ului',
      error: error instanceof Error ? error.message : 'Eroare necunoscută',
    });
  }
}
