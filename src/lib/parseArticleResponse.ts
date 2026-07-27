export type ParsedArticle = {
  title: string;
  content: string;
  summary?: string;
};

function extractJsonString(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return null;
}

function tryParseJson(jsonStr: string): ParsedArticle | null {
  try {
    const parsed = JSON.parse(jsonStr) as {
      title?: string;
      content?: string;
      summary?: string;
    };
    if (!parsed.title || !parsed.content) return null;
    return {
      title: parsed.title.trim(),
      content: parsed.content.trim(),
      summary: parsed.summary?.trim(),
    };
  } catch {
    return null;
  }
}

function regexFallback(text: string): ParsedArticle | null {
  const titleMatch = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const contentMatch = text.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
    text.match(/"content"\s*:\s*"([\s\S]*?)"\s*,\s*"summary"/);
  if (!titleMatch || !contentMatch) return null;

  const unescape = (s: string) =>
    s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  return {
    title: unescape(titleMatch[1]).trim(),
    content: unescape(contentMatch[1]).trim(),
  };
}

export function parseArticleResponse(text: string): ParsedArticle | null {
  const jsonStr = extractJsonString(text);
  if (!jsonStr) return null;

  const parsed = tryParseJson(jsonStr) || regexFallback(jsonStr);
  if (!parsed) return null;

  if (parsed.title.length < 10 || parsed.content.length < 200) {
    return null;
  }

  return parsed;
}

export function parseLegacyFormat(text: string): ParsedArticle | null {
  const titleMatch =
    text.match(/TITLU:\s*([^\n\r]+)/i) ||
    text.match(/===TITLU===\s*([^\n\r]+)/i);
  const contentMatch =
    text.match(/CONȚINUT:\s*([\s\S]+)/i) ||
    text.match(/===CONȚINUT===\s*([\s\S]+)/i);

  if (!titleMatch || !contentMatch) return null;

  const title = titleMatch[1].trim().replace(/###/g, '');
  const content = contentMatch[1].trim().replace(/###/g, '');

  if (title.length < 10 || content.length < 200) return null;
  return { title, content };
}

export function parseAnyArticleResponse(text: string): ParsedArticle | null {
  return parseArticleResponse(text) || parseLegacyFormat(text);
}
