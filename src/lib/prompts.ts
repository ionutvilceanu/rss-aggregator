import { TopicCandidate, formatTopicSources } from './topicDiscovery';

export const SYSTEM_PROMPT = `Ești redactor sportiv la SportAzi.ro. Scrii în limba română, cu diacritice.

REGULI ABSOLUTE:
- Folosește DOAR faptele din secțiunea SURSE furnizată.
- Dacă o informație lipsește din surse, NU o inventa — omiti sau spui că nu este confirmată.
- Nu include meta-comentarii ("în acest articol", "ca AI", "în concluzie" etc.).
- Ton: jurnalism sportiv clar, captivant, neutru.
- Lungime: 400-600 de cuvinte.
- Structură: lead puternic, 3-5 paragrafe, fără subtitluri markdown.`;

export function buildArticlePrompt(topic: TopicCandidate, dateText?: string): string {
  const today =
    dateText ||
    new Date().toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const sourcesBlock = formatTopicSources(topic);
  const relevanceNote =
    topic.category === 'intl'
      ? 'Subiectul este internațional — explică relevanța pentru fanii sportivi din România.'
      : 'Subiectul este din sportul românesc sau de interes direct pentru publicul din România.';

  return `SUBIECT: ${topic.title}
DATA: ${today}

SURSE (obligatoriu — bazează articolul pe acestea):
${sourcesBlock}

${relevanceNote}

Scrie un articol jurnalistic complet. Nu inventa statistici, scoruri sau citate care nu apar în surse.

Răspunde DOAR cu JSON valid, fără text înainte sau după:
{"title":"titlul articolului","content":"conținutul complet al articolului","summary":"rezumat de 1-2 propoziții"}`;
}

export function buildRetryJsonPrompt(): string {
  return 'Răspunsul anterior nu a fost JSON valid. Răspunde DOAR cu JSON valid în formatul: {"title":"...","content":"...","summary":"..."}';
}

export function buildCustomPrompt(
  userPrompt: string,
  extraContext?: string,
  dateText?: string
): string {
  const today =
    dateText ||
    new Date().toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  let prompt = `DATA: ${today}\n\nCERINȚĂ: ${userPrompt}`;
  if (extraContext) {
    prompt += `\n\nCONTEXT SUPLIMENTAR:\n${extraContext}`;
  }
  prompt += `\n\nRăspunde DOAR cu JSON valid:\n{"title":"titlul articolului","content":"conținutul complet","summary":"rezumat scurt"}`;
  return prompt;
}
