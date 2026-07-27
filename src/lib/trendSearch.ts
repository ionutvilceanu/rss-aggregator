import { discoverTopics, formatTopicSources } from './topicDiscovery';

/**
 * Wrapper compatibil cu codul vechi.
 * Folosește noul sistem de discovery bazat pe RSS.
 */
export async function getViralTopics(count: number = 5): Promise<string[]> {
  const topics = await discoverTopics(count);
  return topics.map((t) => t.title);
}

export async function getTopicContext(topicTitle: string): Promise<string> {
  const topics = await discoverTopics(20);
  const match = topics.find(
    (t) => t.title.toLowerCase() === topicTitle.toLowerCase()
  );

  if (match) {
    return `INFORMAȚII DESPRE SUBIECTUL: "${topicTitle}"\n\n${formatTopicSources(match)}`;
  }

  return `Subiect: "${topicTitle}"\nNu s-au găsit surse RSS suplimentare pentru acest subiect.`;
}

// Funcțiile vechi de scraping Google HTML au fost eliminate — RSS este sursa principală.
