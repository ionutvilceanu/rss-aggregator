import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';
import pool from '../../lib/db';
import { scrapeArticle } from '../../lib/webScraper';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  // Parametru pentru a forța preluarea celor mai recente știri ignorând verificările de duplicare
  const forceRefresh = req.body.forceRefresh === true;
  
  // Opțional: Limita de articole de procesat (implicit 5)
  const limit = req.body.limit ? parseInt(req.body.limit) : 5;
  
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

    // Sortăm articolele descrescător după dată și luăm cele mai recente
    const sortedArticles = allRssArticles.sort((a, b) => 
      b.pub_date.getTime() - a.pub_date.getTime()
    );
    
    const latestArticles = sortedArticles.slice(0, limit);
    console.log(`Ultimele ${limit} articole selectate pentru scraping.`);

    // Dacă forceRefresh este true, procesăm toate articolele fără a verifica duplicatele
    let articlesToProcess = latestArticles;
    
    if (!forceRefresh) {
      // Verificăm dacă aceste articole au fost deja procesate
      articlesToProcess = [];
      
      for (const article of latestArticles) {
        // Verificăm dacă articolul a fost deja procesat
        const checkResult = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM articles WHERE source_url = $1) AS exists",
          [article.source_url]
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

    // Procesăm articolele secvențial pentru a evita supraîncărcarea serverelor cu request-uri
    const scrapedArticles = [];
    
    for (const article of articlesToProcess) {
      try {
        if (!article.source_url) {
          console.warn('Articol fără URL sursă, se ignoră:', article.title);
          continue;
        }
        
        console.log(`Scraping articol de la: ${article.source_url}`);
        
        // Efectuăm scraping pentru acest articol
        const scrapedData = await scrapeArticle(article.source_url);
        
        // Folosim titlul original doar dacă titlul scrapat este gol
        const title = scrapedData.title || article.title;
        
        // Folosim conținutul scrapat care este mai detaliat
        const content = scrapedData.content;
        
        // Pentru imagine, preferăm prima imagine din scraping dacă există
        const image_url = (scrapedData.images && scrapedData.images.length > 0) 
          ? scrapedData.images[0] 
          : article.image_url;
        
        if (!content || content.length < 100) {
          console.warn(`Conținut insuficient pentru articolul ${article.source_url}, se ignoră.`);
          continue;
        }
        
        // Salvează articolul în baza de date
        const insertResult = await pool.query(
          `INSERT INTO articles 
           (title, content, image_url, source_url, pub_date, is_manual) 
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING *`,
          [
            title,
            content,
            image_url,
            article.source_url,
            article.pub_date
          ]
        );
        
        scrapedArticles.push(insertResult.rows[0]);
        
        // Adăugăm un delay pentru a nu supraîncărca serverele
        console.log("Așteptăm 2 secunde înainte de a procesa următorul articol...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Eroare la procesarea articolului "${article.title}":`, error);
      }
    }
    
    res.status(200).json({
      message: `S-au extras cu succes ${scrapedArticles.length} articole din ${articlesToProcess.length}`,
      articles: scrapedArticles
    });
  } catch (error) {
    console.error('Eroare la extragerea articolelor:', error);
    res.status(500).json({ error: 'Eroare la extragerea articolelor' });
  }
} 