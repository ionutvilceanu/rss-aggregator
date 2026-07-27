import type { NextApiRequest, NextApiResponse } from 'next';
import { chatComplete } from '../../lib/llm';
import pool from '../../lib/db';
import { searchWeb } from '../../lib/webSearch';
import { SYSTEM_PROMPT, buildCustomPrompt, buildRetryJsonPrompt } from '../../lib/prompts';
import { parseAnyArticleResponse } from '../../lib/parseArticleResponse';
import { DEFAULT_ARTICLE_IMAGE } from '../../lib/articleImages';
import { ensureArticlesTable } from '../../lib/articleGenerator';

interface PromptRequest {
  prompt: string;
  title?: string;
  enableWebSearch?: boolean;
  searchQueries?: string[];
  imageUrl?: string;
}

async function performTargetedSearches(searchQueries: string[]): Promise<string> {
  const searchPromises = searchQueries.map(async (query) => {
    const results = await searchWeb(query, 2);
    return { query, results };
  });

  const allResults = await Promise.all(searchPromises);
  let combined = `REZULTATE CĂUTARE WEB (${new Date().toLocaleDateString('ro-RO')}):\n\n`;

  allResults.forEach((result) => {
    combined += `PENTRU: "${result.query}"\n${result.results}\n---\n\n`;
  });

  return combined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  const {
    prompt,
    title: customTitle,
    enableWebSearch = false,
    searchQueries = [],
    imageUrl = '',
  } = req.body as PromptRequest;

  if (!prompt) {
    return res.status(400).json({ error: 'Promptul este obligatoriu.' });
  }

  try {
    await ensureArticlesTable();

    let extraContext = '';
    if (enableWebSearch && searchQueries.length > 0) {
      extraContext = await performTargetedSearches(searchQueries);
    }

    const userPrompt = buildCustomPrompt(prompt, extraContext || undefined);
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    let text = await chatComplete(messages, { temperature: 0.5, maxTokens: 2000 });
    let parsed = parseAnyArticleResponse(text);

    if (!parsed) {
      text = await chatComplete(
        [
          ...messages,
          { role: 'assistant' as const, content: text },
          { role: 'user' as const, content: buildRetryJsonPrompt() },
        ],
        { temperature: 0.3, maxTokens: 2000 }
      );
      parsed = parseAnyArticleResponse(text);
    }

    if (!parsed) {
      return res.status(500).json({ error: 'Nu s-a putut parsa răspunsul LLM' });
    }

    const finalTitle = customTitle || parsed.title;

    const insertResult = await pool.query(
      `INSERT INTO articles (title, content, image_url, source_url, pub_date, is_manual)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, true) RETURNING *`,
      [finalTitle, parsed.content, imageUrl || DEFAULT_ARTICLE_IMAGE, `prompt:${Date.now()}`]
    );

    return res.status(200).json({
      message: 'Articolul a fost generat cu succes.',
      article: insertResult.rows[0],
    });
  } catch (error) {
    console.error('Eroare la generarea articolului:', error);
    return res.status(500).json({ error: 'Eroare la generarea articolului' });
  }
}
