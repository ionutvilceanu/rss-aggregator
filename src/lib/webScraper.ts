import axios from 'axios';
import * as cheerio from 'cheerio';

// Funcție principală pentru extragerea conținutului unui articol de pe orice site
export async function scrapeArticle(url: string): Promise<{ title: string; content: string; images: string[] }> {
  try {
    console.log(`Începe scraping pentru URL: ${url}`);
    
    // Obținem conținutul paginii
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ro,en-US;q=0.7,en;q=0.3',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    });
    
    // Parsăm HTML-ul
    const $ = cheerio.load(response.data);
    
    // Determinăm tipul de site și aplicăm strategia potrivită
    const domain = new URL(url).hostname;
    console.log(`Domeniu detectat: ${domain}`);
    
    // Strategii specifice pentru site-uri populare
    if (domain.includes('digisport.ro')) {
      return scrapeDigiSport($, url);
    } else if (domain.includes('gazzetta.it')) {
      return scrapeGazzetta($, url);
    } else if (domain.includes('marca.com')) {
      return scrapeMarca($, url);
    } else if (domain.includes('mundodeportivo.com')) {
      return scrapeMundoDeportivo($, url);
    } else {
      // Strategie generică pentru site-uri nespecifice
      return scrapeGeneric($, url);
    }
  } catch (error) {
    console.error(`Eroare la scraping pentru ${url}:`, error);
    throw error;
  }
}

// Funcție pentru scraping DigiSport
function scrapeDigiSport($: cheerio.CheerioAPI, url: string): { title: string; content: string; images: string[] } {
  const title = $('h1.article-title').text().trim();
  const images: string[] = [];
  
  // Colectăm imaginile
  $('.article-content img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src) images.push(src);
  });
  
  // Extragem conținutul
  let content = '';
  $('.article-content p').each((_, paragraph) => {
    content += $(paragraph).text().trim() + '\n\n';
  });
  
  return { title, content, images };
}

// Funcție pentru scraping Gazzetta
function scrapeGazzetta($: cheerio.CheerioAPI, url: string): { title: string; content: string; images: string[] } {
  const title = $('h1.titulo, h1[itemprop="headline"]').text().trim();
  const images: string[] = [];
  
  // Colectăm imaginile
  $('figure img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src) images.push(src);
  });
  
  // Extragem conținutul
  let content = '';
  $('.article-body p, .body-article p').each((_, paragraph) => {
    content += $(paragraph).text().trim() + '\n\n';
  });
  
  return { title, content, images };
}

// Funcție pentru scraping Marca
function scrapeMarca($: cheerio.CheerioAPI, url: string): { title: string; content: string; images: string[] } {
  const title = $('h1.title-article').text().trim();
  const images: string[] = [];
  
  // Colectăm imaginile
  $('.multimedia-item img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src) images.push(src);
  });
  
  // Extragem conținutul
  let content = '';
  $('.article-body p').each((_, paragraph) => {
    content += $(paragraph).text().trim() + '\n\n';
  });
  
  return { title, content, images };
}

// Funcție pentru scraping Mundo Deportivo
function scrapeMundoDeportivo($: cheerio.CheerioAPI, url: string): { title: string; content: string; images: string[] } {
  const title = $('h1.title').text().trim();
  const images: string[] = [];
  
  // Colectăm imaginile
  $('.article-main img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src) images.push(src);
  });
  
  // Extragem conținutul
  let content = '';
  $('.article-body p').each((_, paragraph) => {
    content += $(paragraph).text().trim() + '\n\n';
  });
  
  return { title, content, images };
}

// Strategie generică pentru site-uri nespecifice
function scrapeGeneric($: cheerio.CheerioAPI, url: string): { title: string; content: string; images: string[] } {
  // Încercăm să extragem titlul - încercăm mai multe selectoare comune
  let title = $('h1').first().text().trim();
  if (!title) {
    title = $('article h1, .article-title, .entry-title, .post-title, .headline').first().text().trim();
  }
  
  const images: string[] = [];
  
  // Încercăm să găsim conținutul principal al articolului
  let contentContainer = $('article, .article, .post, .entry, .content, .article-content, .post-content, main');
  
  // Colectăm imaginile
  contentContainer.find('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src && src.startsWith('http')) images.push(src);
  });
  
  // Extragem conținutul
  let content = '';
  contentContainer.find('p').each((_, paragraph) => {
    const text = $(paragraph).text().trim();
    if (text && text.length > 20) { // Filtram paragrafe prea scurte
      content += text + '\n\n';
    }
  });
  
  // Dacă nu am reușit să extragem conținut, încercăm alte abordări
  if (content.length < 100) {
    $('p').each((_, paragraph) => {
      const text = $(paragraph).text().trim();
      if (text && text.length > 30) { // Filtram paragrafe prea scurte
        content += text + '\n\n';
      }
    });
  }
  
  return { title, content, images };
} 