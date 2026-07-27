import crypto from 'crypto';
import pool from './db';
import { chatComplete } from './llm';
import { discoverTopics, TopicCandidate } from './topicDiscovery';
import { SYSTEM_PROMPT, buildArticlePrompt, buildRetryJsonPrompt } from './prompts';
import { parseAnyArticleResponse } from './parseArticleResponse';
import { resolveArticleImage } from './articleImages';

export type GenerateArticlesOptions = {
  count?: number;
  customDate?: Date | null;
  forceRefresh?: boolean;
};

export type GenerateArticlesResult = {
  articles: Record<string, unknown>[];
  skipped: string[];
  errors: string[];
};

function topicSourceUrl(topic: TopicCandidate): string {
  const hash = crypto.createHash('md5').update(topic.title).digest('hex').slice(0, 12);
  return `openrouter:topic:${hash}`;
}

async function isDuplicate(topic: TopicCandidate, forceRefresh: boolean): Promise<boolean> {
  if (forceRefresh) return false;

  const sourceUrl = topicSourceUrl(topic);
  const byUrl = await pool.query(
    `SELECT id FROM articles WHERE source_url = $1 AND created_at > NOW() - INTERVAL '48 hours' LIMIT 1`,
    [sourceUrl]
  );
  if (byUrl.rows.length > 0) return true;

  const byTitle = await pool.query(
    `SELECT id FROM articles WHERE LOWER(title) = LOWER($1) AND created_at > NOW() - INTERVAL '48 hours' LIMIT 1`,
    [topic.title]
  );
  return byTitle.rows.length > 0;
}

async function generateOneArticle(
  topic: TopicCandidate,
  customDate?: Date | null
): Promise<Record<string, unknown> | null> {
  const dateText = (customDate || new Date()).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildArticlePrompt(topic, dateText) },
  ];

  let text = await chatComplete(messages, { temperature: 0.6, maxTokens: 2000 });
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
    throw new Error(`Nu s-a putut parsa răspunsul LLM pentru "${topic.title}"`);
  }

  const imageUrl = await resolveArticleImage(topic.sources, parsed.title);

  const insert = await pool.query(
    `INSERT INTO articles (title, content, image_url, source_url, pub_date, is_manual)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false) RETURNING *`,
    [parsed.title, parsed.content, imageUrl, topicSourceUrl(topic)]
  );

  return insert.rows[0];
}

export async function generateArticlesFromTopics(
  options: GenerateArticlesOptions = {}
): Promise<GenerateArticlesResult> {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const defaultCount = isProduction ? 3 : 5;
  const count = Math.max(1, Math.min(10, options.count ?? defaultCount));
  const buffer = count * 2;

  const topics = await discoverTopics(buffer);
  const articles: Record<string, unknown>[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const topic of topics) {
    if (articles.length >= count) break;

    try {
      const duplicate = await isDuplicate(topic, options.forceRefresh === true);
      if (duplicate) {
        skipped.push(topic.title);
        continue;
      }

      const article = await generateOneArticle(topic, options.customDate);
      if (article) {
        articles.push(article);
        console.log(`Articol generat: "${topic.title}"`);
      }

      await new Promise((r) => setTimeout(r, Number(process.env.LLM_ARTICLE_DELAY_MS || 3000)));
    } catch (error) {
      const msg = (error as Error).message;
      console.error(`Eroare la "${topic.title}":`, msg);
      errors.push(`${topic.title}: ${msg}`);
    }
  }

  return { articles, skipped, errors };
}

export async function ensureArticlesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      source_url TEXT NOT NULL,
      pub_date TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_manual BOOLEAN DEFAULT FALSE
    )
  `);
}
