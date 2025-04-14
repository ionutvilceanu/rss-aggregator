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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  // Parametru pentru a forța preluarea celor mai recente știri ignorând verificările de duplicare
  const forceRefresh = req.body.forceRefresh === true;
  
  // Opțional: Acceptăm o dată specifică pentru generare (pentru override)
  const customDate = req.body.customDate ? new Date(req.body.customDate) : null;
  
  // Parametru pentru a activa căutările web
  const enableWebSearch = req.body.enableWebSearch === true;
  
  try {
    // Verificăm mai întâi dacă tabela există
    try {
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
      
      // Adăugăm coloana is_manual dacă tabela există deja și nu are coloana
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name='articles'
          ) AND NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name='articles' AND column_name='is_manual'
          ) THEN
            ALTER TABLE articles ADD COLUMN is_manual BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.error('Eroare la verificarea/crearea tabelei:', err);
      return res.status(500).json({ 
        error: 'Eroare la inițializarea bazei de date. Vă rugăm încercați din nou.' 
      });
    }

    // Preluăm feed-urile în paralel
    console.log('Preluare feed-uri RSS cu timestamp pentru evitarea cache-ului...');
    const parser = new Parser({
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    // Adăugăm un timestamp la URL-uri pentru a evita cache-ul
    const timestamp = new Date().getTime();
    const feedPromises = RSS_FEEDS.map((feed) => {
      const feedUrl = feed.includes('?') ? `${feed}&_t=${timestamp}` : `${feed}?_t=${timestamp}`;
      console.log(`Preluare din: ${feedUrl}`);
      return parser.parseURL(feedUrl).catch(error => {
        console.error(`Eroare la preluarea feed-ului ${feed}:`, error);
        return { items: [] }; // Întoarce un obiect gol în caz de eroare
      });
    });
    
    const feeds = await Promise.all(feedPromises);

    // Combinăm toate articolele într-un singur array
    const allRssArticles = feeds.flatMap((feed) =>
      feed.items ? feed.items.map((item) => ({
        title: item.title || '',
        content: item.contentSnippet || item.content || '',
        source_url: item.link || '',
        image_url: item.enclosure?.url || '',
        pub_date: new Date(item.pubDate || new Date()),
      })) : []
    );

    console.log(`Total articole preluate din RSS: ${allRssArticles.length}`);

    if (allRssArticles.length === 0) {
      return res.status(200).json({
        message: 'Nu s-au găsit articole în sursele RSS.',
        articles: []
      });
    }

    // Sortăm articolele descrescător după dată și luăm ultimele 5
    const sortedArticles = allRssArticles.sort((a, b) => 
      b.pub_date.getTime() - a.pub_date.getTime()
    );
    
    const latestArticles = sortedArticles.slice(0, 10);
    console.log(`Ultimele 10 articole selectate pentru procesare.`);

    // Dacă forceRefresh este true, procesăm toate articolele recente fără a verifica duplicatele
    let articlesToProcess = latestArticles;
    
    if (!forceRefresh) {
      // Verificăm dacă aceste articole au fost deja procesate
      articlesToProcess = [];
      
      for (const article of latestArticles) {
        // Verificăm dacă articolul a fost deja procesat
        const encodedUrl = encodeURIComponent(article.source_url);
        const checkResult = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM articles WHERE source_url = $1) AS exists",
          [`regenerated-from-url:${encodedUrl}`]
        );
        
        if (!checkResult.rows[0].exists) {
          articlesToProcess.push(article);
        }
      }
    }

    if (articlesToProcess.length === 0) {
      return res.status(200).json({
        message: forceRefresh 
          ? 'Nu s-au găsit articole noi în sursele RSS.' 
          : 'Toate articolele recente din RSS au fost deja procesate. Folosiți forceRefresh=true pentru a le regenera.',
        articles: []
      });
    }

    console.log(`Vor fi procesate ${articlesToProcess.length} articole ${forceRefresh ? '(cu forțare)' : 'noi'} din RSS.`);

    // Traducem articolele înainte de a le procesa cu AI
    const translatedArticles = await Promise.all(
      articlesToProcess.map(async (article) => ({
        ...article,
        title: await translateText(article.title, 'ro'),
        content: await translateText(article.content, 'ro')
      }))
    );

    // Procesează fiecare articol și generează o nouă versiune
    const generatedArticles = await Promise.all(
      translatedArticles.map(async (article) => {
        try {
          // Generează un nou articol folosind API-ul OpenRouter cu modelul DeepSeek
          const generatedArticle = await generateArticleWithLlama(article, customDate, enableWebSearch);
          
          // Salvează noul articol în baza de date
          const insertResult = await pool.query(
            `INSERT INTO articles 
             (title, content, image_url, source_url, pub_date, is_manual) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, true)
             RETURNING *`,
            [
              generatedArticle.title,
              generatedArticle.content,
              article.image_url, // Folosim aceeași imagine
              `regenerated-from-url:${encodeURIComponent(article.source_url)}`, // Referință la articolul original
            ]
          );
          
          return insertResult.rows[0];
        } catch (error) {
          console.error(`Eroare la procesarea articolului "${article.title}":`, error);
          return null;
        }
      })
    );

    // Filtrează articolele care nu au fost generate cu succes
    const successfulArticles = generatedArticles.filter(Boolean);
    
    res.status(200).json({
      message: `S-au generat cu succes ${successfulArticles.length} articole din ${articlesToProcess.length}`,
      articles: successfulArticles
    });
  } catch (error) {
    console.error('Eroare la generarea știrilor:', error);
    res.status(500).json({ error: 'Eroare la generarea știrilor' });
  }
}

// Funcție pentru a genera un nou articol folosind API-ul OpenRouter cu modelul DeepSeek
async function generateArticleWithLlama(
  article: Article, 
  customDate: Date | null = null,
  enableWebSearch: boolean = false
): Promise<{ title: string; content: string }> {
  try {
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
    
    // Rezultate căutare web pentru context adițional
    let webSearchResults = "";
    if (enableWebSearch) {
      console.log(`Efectuez căutare web pentru articolul: "${article.title}"`);
      webSearchResults = await searchSportsNews(article.title);
    }
    
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

${webSearchResults ? `INFORMAȚII ACTUALE DIN CĂUTARE WEB (${formattedDate}):\n${webSearchResults}\n` : ''}

INSTRUCȚIUNI IMPORTANTE:
1. Această știre este RECENTĂ - tratează informațiile ca fiind de ACTUALITATE
2. Menține TOATE referințele temporale din articolul original (ieri, azi, mâine, data exactă)
3. Nu modifica datele, scorurile sau statisticile menționate în articolul original
4. Păstrează toate numele, echipele și competițiile exacte din articolul original
5. Extinde știrea cu informații de context relevante și actuale
6. Evidențiază când s-a întâmplat evenimentul folosind expresii clare de timp (ex: "ieri, 15 octombrie")
7. Menționează explicit că este o știre recentă și actuală (din ziua publicării originale)
8. Fă cercetare adițională DOAR pentru a completa cu detalii contextuale, nu pentru a modifica faptele
9. Structurează articolul cu titlu captivant, introducere, cuprins și concluzie
10. Incluzi în final și o referință că știrea este din data originală de publicare
${webSearchResults ? '11. FOLOSEȘTE informațiile actuale din căutarea web pentru a completa cu context și date recente.' : ''}

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
      // Dacă nu găsim formatul, folosim titlul original cu un prefix
      title = `O analiză nouă: ${article.title}`;
    }

    const contentMatch = generatedText.match(/CONȚINUT:\s*([\s\S]*)/);
    if (contentMatch && contentMatch[1]) {
      content = contentMatch[1].trim();
    } else {
      // Dacă nu găsim formatul, folosim tot textul generat
      content = generatedText;
    }

    return { title, content };
  } catch (error) {
    console.error('Eroare la generarea articolului cu DeepSeek prin OpenRouter:', error);
    throw error;
  }
} 