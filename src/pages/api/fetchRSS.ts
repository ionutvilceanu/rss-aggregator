import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';
import pool from '../../lib/db';

const parser = new Parser();

// Feed-urile pe care vrei să le agregi
const RSS_FEEDS = [
  'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml',
  'https://e00-marca.uecdn.es/rss/portada.xml',
  'https://www.mundodeportivo.com/rss/home.xml'
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
  try {
    // Parametri de paginare
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;

    // 1. Create the articles table if it doesn't exist (păstrăm asta pentru prima execuție)
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

    // 2. Preluăm feed-urile în paralel
    const feedPromises = RSS_FEEDS.map((feed) => parser.parseURL(feed));
    const feeds = await Promise.all(feedPromises);

    // 3. Combinăm toate articolele într-un singur array
    const articles = feeds.flatMap((feed) =>
      feed.items.map((item) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        image: item.enclosure?.url || '',
        content: item.contentSnippet || item.content || '',
        is_manual: false // Toate articolele din feed nu sunt manuale
      }))
    );

    // 4. Sortăm articolele din feed descrescător după dată
    const sortedFeedArticles = articles.sort((a, b) => {
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    // Obținem numărul total de articole pentru paginare (doar din feed-uri)
    const totalFeedArticles = sortedFeedArticles.length;

    // 5. Preluăm articolele manuale din baza de date - acestea vor fi primele
    const manualArticlesResult = await pool.query(
      `SELECT id, title, content, image_url as image, source_url as link, 
       pub_date as "pubDate", is_manual 
       FROM articles WHERE is_manual = true ORDER BY pub_date DESC`
    );
    
    const manualArticles = manualArticlesResult.rows.map(article => ({
      ...article,
      pubDate: article.pubDate.toISOString()
    }));
    
    // 6. Combinăm articolele manuale cu cele din feed, asigurându-ne că cele manuale sunt primele
    const allArticlesSorted = [
      ...manualArticles,
      ...sortedFeedArticles
    ];
    
    // Calculăm totalul și aplicăm paginarea după combinarea articolelor
    const totalArticles = allArticlesSorted.length;
    const paginatedArticles = allArticlesSorted.slice(skip, skip + limit);

    // 7. Traducem titlul și conținutul pentru fiecare articol din feed (doar cele paginate)
    const articlesToTranslate = paginatedArticles.filter(article => !article.is_manual);
    const translatedFeedArticles = await Promise.all(
      articlesToTranslate.map(async (article) => {
        const translatedTitle = await translateText(article.title, 'ro');
        const translatedContent = await translateText(article.content, 'ro');
        return {
          ...article,
          title: translatedTitle,
          content: translatedContent,
        };
      })
    );

    // 8. Combinăm articolele traduse cu cele manuale care nu necesită traducere
    const finalArticles = paginatedArticles.map(article => {
      if (article.is_manual) return article;
      // Găsim varianta tradusă a articolului
      const translated = translatedFeedArticles.find(ta => ta.link === article.link);
      return translated || article;
    });

    // 9. Verificăm doar dacă articolele din feed există deja în baza de date pentru ID-uri
    const articlesWithIds = await Promise.all(
      finalArticles.map(async (article) => {
        // Dacă articolul are deja un id, îl păstrăm așa cum este
        if (article.id) return article;
        
        try {
          // Verificăm dacă articolul există deja
          const checkResult = await pool.query(
            'SELECT id, is_manual FROM articles WHERE source_url = $1',
            [article.link]
          );
          
          if (checkResult.rows.length > 0) {
            // Articolul există deja, returnăm ID-ul existent
            return { 
              ...article, 
              id: checkResult.rows[0].id
            };
          }
          
          // Articolul nu există încă, îl returnăm așa cum este
          return article;
        } catch (error) {
          console.error('Error checking article:', error);
          return article;
        }
      })
    );

    // 10. Răspundem cu articolele combinate și informații de paginare
    res.status(200).json({
      articles: articlesWithIds,
      pagination: {
        total: totalArticles,
        page,
        limit,
        pages: Math.ceil(totalArticles / limit)
      }
    });
  } catch (error) {
    console.error('Eroare la preluarea feed-urilor RSS:', error);
    res.status(500).json({ error: 'Eroare la preluarea feed-urilor RSS' });
  }
}
