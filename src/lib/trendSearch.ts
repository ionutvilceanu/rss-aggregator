import fetch from 'node-fetch';
import { load } from 'cheerio';

// Funcție pentru extragerea subiectelor trending din Google Trends România
export async function getRomanianTrends(): Promise<string[]> {
  try {
    console.log('Căutăm subiectele virale din România...');
    
    // Obținem cele mai căutate subiecte din Google Trends România (RSS feed)
    const response = await fetch('https://trends.google.com/trends/trendingsearches/daily/rss?geo=RO');
    
    if (!response.ok) {
      throw new Error(`Eroare la preluarea trend-urilor: ${response.status} ${response.statusText}`);
    }
    
    const xmlData = await response.text();
    const $ = load(xmlData, { xmlMode: true });
    
    // Extragem titlurile din elementele <title> din fiecare <item>
    const trendingTopics: string[] = [];
    
    $('item > title').each((_, elem) => {
      const title = $(elem).text().trim();
      if (title && !title.includes('Daily Search Trends')) {
        trendingTopics.push(title);
      }
    });
    
    console.log(`Am găsit ${trendingTopics.length} subiecte trending în România`);
    return trendingTopics.slice(0, 10); // Returnăm primele 10 trend-uri
    
  } catch (error) {
    console.error('Eroare la preluarea trend-urilor din România:', error);
    return [];
  }
}

// Funcție pentru obținerea subiectelor virale din surse multiple
export async function getViralTopics(count: number = 5): Promise<string[]> {
  try {
    // Încercăm mai întâi să obținem trend-uri din Google
    const googleTrends = await getRomanianTrends();
    
    if (googleTrends.length > 0) {
      // Filtrăm doar subiectele în limba română sau cu relevanță pentru România
      const romanianTopics = googleTrends.filter(topic => {
        // Verificăm dacă subiectul conține diacritice sau cuvinte românești comune
        const hasRomanianChars = /[ăîâșț]/i.test(topic);
        const hasRomanianWords = /\b(și|sau|pentru|din|România|Romanian)\b/i.test(topic);
        
        // Verificăm dacă subiectul este despre personalități, locuri sau evenimente românești
        const isLikelyRomanian = /\b(București|Cluj|Timișoara|Iași|Constanța|Sibiu|Oradea|Craiova|Brașov)\b/i.test(topic);
        
        return hasRomanianChars || hasRomanianWords || isLikelyRomanian;
      });
      
      if (romanianTopics.length > 0) {
        console.log(`Am identificat ${romanianTopics.length} subiecte virale românești`);
        return romanianTopics.slice(0, count);
      }
    }
    
    // Dacă nu găsim suficiente trend-uri românești, folosim o listă de backup
    console.log('Nu s-au putut obține suficiente trend-uri românești, folosim subiecte de backup');
    
    const backupTopics = [
      'Echipa națională de fotbal a României',
      'Inflația în România',
      'Programul Rabla 2023',
      'FCSB în Europa League',
      'Simona Halep revenire tenis',
      'Festivalul Untold Cluj',
      'Alegeri prezidențiale România',
      'Autostrada Transilvania',
      'CFR Cluj rezultate recente',
      'Cazuri COVID-19 România',
    ];
    
    // Amestecăm lista pentru a obține subiecte diferite la fiecare apel
    const shuffledTopics = backupTopics.sort(() => 0.5 - Math.random());
    return shuffledTopics.slice(0, count);
    
  } catch (error) {
    console.error('Eroare la obținerea subiectelor virale:', error);
    
    // În caz de eroare, returnăm câteva subiecte generice
    return [
      'Echipa națională de fotbal a României',
      'Ultimele evenimente din politica românească',
      'Știri economice din România',
      'Evenimente culturale din București',
      'Sport românesc actualități'
    ].slice(0, count);
  }
}

// Funcție pentru căutarea de știri recente despre un subiect
export async function searchRecentNews(topic: string, count: number = 3): Promise<string> {
  try {
    console.log(`Căutăm știri recente despre: "${topic}"`);
    
    // Adăugăm explicit "România" în căutare pentru a obține rezultate mai relevante
    const searchQuery = `${topic} România știri recente`;
    
    // URL-ul pentru căutare Google cu parametrii
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=nws`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Eroare la căutarea de știri: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Extragem rezultatele știrilor
    const newsResults: { title: string; snippet: string; source: string; url: string }[] = [];
    
    $('.SoaBEf').each((_, elem) => {
      const titleElement = $(elem).find('.mCBkyc');
      const snippetElement = $(elem).find('.GI74Re');
      const sourceElement = $(elem).find('.NUnG9d');
      const linkElement = $(elem).find('a.WlydOe');
      
      const title = titleElement.text().trim();
      const snippet = snippetElement.text().trim();
      const source = sourceElement.text().trim();
      const url = linkElement.attr('href') || '';
      
      if (title && snippet) {
        newsResults.push({ title, snippet, source, url });
      }
    });
    
    // Limitarea la numărul dorit de rezultate
    const limitedResults = newsResults.slice(0, count);
    
    // Formatarea rezultatelor pentru a fi utilizate de AI
    let formattedResults = `ȘTIRI RECENTE DESPRE "${topic}":\n\n`;
    
    if (limitedResults.length === 0) {
      formattedResults += `Nu s-au găsit știri recente relevante despre acest subiect.\n`;
    } else {
      limitedResults.forEach((result, index) => {
        formattedResults += `ȘTIRE #${index + 1}:\n`;
        formattedResults += `Titlu: ${result.title}\n`;
        formattedResults += `Sursă: ${result.source}\n`;
        formattedResults += `Descriere: ${result.snippet}\n`;
        formattedResults += `URL: ${result.url}\n\n`;
      });
    }
    
    console.log(`Am găsit ${limitedResults.length} știri recente despre "${topic}"`);
    return formattedResults;
    
  } catch (error) {
    console.error(`Eroare la căutarea de știri despre "${topic}":`, error);
    return `Nu s-au putut căuta știri despre "${topic}" din cauza unei erori.`;
  }
}

// Funcție pentru căutarea de informații de context despre un subiect
export async function getTopicContext(topic: string): Promise<string> {
  try {
    console.log(`Căutăm informații de context despre: "${topic}"`);
    
    // Căutăm atât știri cât și informații generale
    const newsResults = await searchRecentNews(topic, 3);
    
    // Căutăm informații adiționale (Google search general)
    const searchQuery = `${topic} România context informații`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Eroare la căutarea de context: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Extragem informații din Featured Snippets și Knowledge Graph
    let contextInfo = '';
    
    // Extrage featured snippet dacă există
    const featuredSnippet = $('.hgKElc').text().trim();
    if (featuredSnippet) {
      contextInfo += `REZUMAT GOOGLE:\n${featuredSnippet}\n\n`;
    }
    
    // Extrage knowledge graph dacă există
    const knowledgeTitle = $('.qrShPb span').text().trim();
    const knowledgeDesc = $('.kno-rdesc span').text().trim();
    
    if (knowledgeTitle || knowledgeDesc) {
      contextInfo += `INFORMAȚII DE BAZĂ:\n`;
      if (knowledgeTitle) contextInfo += `${knowledgeTitle}\n`;
      if (knowledgeDesc) contextInfo += `${knowledgeDesc}\n\n`;
    }
    
    // Combinăm toate informațiile
    let combinedInfo = `INFORMAȚII DESPRE SUBIECTUL: "${topic}"\n\n`;
    
    if (contextInfo) {
      combinedInfo += `CONTEXT GENERAL:\n${contextInfo}\n`;
    }
    
    combinedInfo += newsResults;
    
    console.log(`Am obținut informații de context despre "${topic}"`);
    return combinedInfo;
    
  } catch (error) {
    console.error(`Eroare la obținerea contextului pentru "${topic}":`, error);
    return `Nu s-au putut obține informații de context despre "${topic}" din cauza unei erori.`;
  }
} 