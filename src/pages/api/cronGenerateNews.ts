import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';
import pool from '../../lib/db';
import { searchSportsNews } from '../../lib/webSearch';

interface Article {
  id?: number;
  title: string;
  content: string;
  image_url?: string;
  source_url: string;
  pub_date: Date;
  created_at?: Date;
  is_manual?: boolean;
}

// Feed-urile pe care vrei să le agregi
const RSS_FEEDS = [
  'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml',
  'https://e00-marca.uecdn.es/rss/portada.xml',
  'https://www.mundodeportivo.com/rss/home.xml',
  'https://www.digisport.ro/rss'
];

// Funcția de traducere folosind Google Translate API
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text) return '';

  try {
    const response = await fetch('https://translate-pa.googleapis.com/v1/translateHtml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json+protobuf',
        'X-Goog-API-Key': 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520'
      },
      body: JSON.stringify([[[text], 'auto', targetLang], 'wt_lib']),
    });

    if (!response.ok) {
      console.error('Eroare traducere, status:', response.status);
      return text;
    }

    const data = await response.json();
    return (data[0] && data[0][0]) || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Dacă apare o eroare, returnează textul original
  }
}

// Funcție pentru a genera un nou articol folosind API-ul OpenRouter cu modelul DeepSeek
async function generateArticleWithLlama(
  article: Article, 
  customDate: Date | null = null,
  enableWebSearch: boolean = true // Forțat la true pentru a obliga căutarea web
): Promise<{ title: string; content: string }> {
  try {
    // Forțăm căutarea web să fie mereu activată
    enableWebSearch = true;
    
    // Data actuală sau personalizată pentru context temporal
    const currentDate = customDate || new Date();
    const formattedDate = currentDate.toLocaleDateString('ro-RO', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    // Calculăm timpul trecut de la publicarea articolului original
    const pubDate = new Date(article.pub_date);
    const timeDiff = currentDate.getTime() - pubDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    let temporalContext = "";
    if (daysDiff === 0) {
      temporalContext = "Acest articol a fost publicat astăzi.";
    } else if (daysDiff === 1) {
      temporalContext = "Acest articol a fost publicat ieri.";
    } else if (daysDiff < 0) {
      // Cazul când data articolului este în viitor față de data curentă/personalizată
      temporalContext = `Acest articol este programat să fie publicat în ${Math.abs(daysDiff)} zile.`;
    } else {
      temporalContext = `Acest articol a fost publicat acum ${daysDiff} zile.`;
    }

    // Extrage domeniul din URL-ul sursei
    let sourceDomain = "";
    try {
      const urlObj = new URL(article.source_url);
      sourceDomain = urlObj.hostname.replace('www.', '');
    } catch (e) {
      sourceDomain = "sursa originală";
    }
    
    // Rezultate căutare web pentru context adițional - FORȚAT ACTIV
    let webSearchResults = "";
    console.log(`Efectuez căutare web pentru articolul: "${article.title}"`);
    webSearchResults = await searchSportsNews(article.title);
    
    // Construim prompt-ul pentru LLM
    const prompt = `Ești un jurnalist profesionist specializat în știri sportive actuale la data de ${formattedDate}.

Rescrie următoarea știre recentă, punând accent pe ACTUALITATEA informațiilor și păstrând toate datele și evenimentele recente.

Titlul original: "${article.title}"

Conținutul original: 
"""
${article.content}
"""

Data publicării originale: ${pubDate.toLocaleDateString('ro-RO')}
Context temporal: ${temporalContext}
Sursa originală: ${sourceDomain}
URL sursă: ${article.source_url}

INFORMAȚII ACTUALE DIN CĂUTARE WEB (${formattedDate}):
${webSearchResults || "Nu s-au găsit informații suplimentare din căutarea web."}

INSTRUCȚIUNI IMPORTANTE:
1. Această știre este RECENTĂ - tratează informațiile ca fiind de ACTUALITATE
2. Menține TOATE referințele temporale din articolul original (ieri, azi, mâine, data exactă)
3. Nu modifica datele, scorurile sau statisticile menționate în articolul original
4. Păstrează toate numele, echipele și competițiile exacte din articolul original
5. Extinde știrea cu informații de context relevante și actuale
6. Evidențiază când s-a întâmplat evenimentul folosind expresii clare de timp (ex: "ieri, 15 octombrie")
7. Menționează explicit că este o știre recentă și actuală (din ziua publicării originale)
8. FOLOSEȘTE OBLIGATORIU informațiile din căutarea web pentru a completa cu context și date recente
9. Structurează articolul cu titlu captivant, introducere, cuprins și concluzie
10. Incluzi în final și o referință că știrea este din data originală de publicare

Răspunsul tău trebuie să conțină:
TITLU: [Titlu captivant care subliniază actualitatea știrii]
CONȚINUT: [Articolul rescris păstrând caracterul actual al informațiilor, minim 500 cuvinte]`;

    // API key pentru OpenRouter cu modelul DeepSeek
    const apiKey = process.env.OPENROUTER_API_KEY || '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';
    
    console.log("Folosim OpenRouter cu modelul DeepSeek pentru generarea articolului...");
    
    // Facem cererea către OpenRouter API
    console.log("Începem cererea către OpenRouter API...");
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://rss-aggregator.vercel.app/', // Înlocuiește cu domeniul tău
        'X-Title': 'RSS Aggregator' // Numele aplicației tale
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',  // Specificăm modelul DeepSeek
        messages: [
          {
            role: 'system',
            content: 'Ești un jurnalist sportiv de actualitate care raportează evenimente sportive recente și știri de ultimă oră din data publicării lor. Consideri informațiile ca fiind actuale și la zi. Ești expert în contextualizarea știrilor și integrarea informațiilor din surse multiple.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Răspuns complet de la OpenRouter:', errorText);
      throw new Error(`Eroare în API-ul OpenRouter: ${response.status} ${response.statusText}. Detalii: ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || '';

    // Extragem titlul și conținutul din răspuns
    let title = '';
    let content = '';

    const titleMatch = generatedText.match(/TITLU:\s*(.*?)(?=\n|$)/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else {
      title = `O analiză nouă: ${article.title}`;
    }

    const contentMatch = generatedText.match(/CONȚINUT:\s*([\s\S]*)/);
    if (contentMatch && contentMatch[1]) {
      content = contentMatch[1].trim();
    } else {
      content = generatedText;
    }

    return { title, content };
  } catch (error) {
    console.error('Eroare la generarea articolului cu DeepSeek prin OpenRouter:', error);
    throw error;
  }
}

/**
 * Endpoint special pentru a fi apelat de un cron job la minutul 45 al fiecărei ore
 * Acest API este proiectat să fie accesat de un serviciu de cron precum:
 * - Vercel Cron Jobs
 * - GitHub Actions
 * - sau prin instrucțiuni cron standard
 *
 * Configurație cron: 45 * * * * (la minutul 45 al fiecărei ore)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Am eliminat verificarea de autorizare - API-ul este acum public
  // Atenție: Într-un mediu de producție real, ar trebui să implementați măsuri de securitate

  try {
    console.log(`[CRON] Rulare job programat la ${new Date().toISOString()}`);
    
    // Construim corpul cererii pentru generateNews cu opțiunile dorite
    const requestBody = {
      forceRefresh: true, // Forțăm refresh pentru a genera noi articole
      enableWebSearch: true, // Activăm căutările web pentru context adițional
      // Nu setăm customDate pentru a folosi data curentă
    };
    
    // Apelăm API-ul generateNews prin cerere POST internă
    const response = await fetch(`${getBaseUrl(req)}/api/generateNews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Eroare la apelarea API-ului generateNews: ${response.status}. Detalii: ${errorText}`);
    }
    
    const result = await response.json();
    
    // Logăm rezultatul pentru monitorizare
    console.log(`[CRON] Job finalizat cu succes. Articole generate: ${result.articles?.length || 0}`);
    
    // Returnăm rezultatul către cron job
    return res.status(200).json({
      success: true,
      message: `Cron job rulat cu succes la ${new Date().toISOString()}`,
      result
    });
    
  } catch (error) {
    console.error('[CRON] Eroare la rularea job-ului:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Eroare la rularea cron job-ului',
      error: error instanceof Error ? error.message : 'Eroare necunoscută'
    });
  }
}

/**
 * Funcție helper pentru a determina URL-ul de bază al aplicației
 */
function getBaseUrl(req: NextApiRequest): string {
  // În producție, folosim URL-ul configurat sau construim din header-uri
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  
  // Încercăm să reconstruim URL-ul din header-urile cererii
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http:' : 'https:';
  
  return `${protocol}//${host}`;
} 