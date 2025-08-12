import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import Parser from 'rss-parser';
import pool from '../../lib/db';
import { searchSportsNews, searchWeb } from '../../lib/webSearch';
import { generateArticleWithGemini } from '../../lib/geminiAPI';
import { extractTeamNames, findPrimaryTeam, getTeamLeague } from '../../lib/ner';
import { fetchCompetitionStandings, getCompetitionCodeByTeam } from '../../lib/footballData';

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
          // Etapa 1: Generarea întrebărilor de căutare
          const searchQueries = await generateSearchQueries(article.title, article.content);

          // Etapa 2: Efectuarea căutărilor și obținerea rezultatelor
          const searchResults = await performTargetedSearches(searchQueries);

          // Etapa 2.5: Extragerea echipelor și obținerea informațiilor factuale
          const teams = extractTeamNames(article.title + ' ' + article.content);
          const facts: string[] = [];
          
          if (teams.length > 0) {
            console.log('Echipe găsite:', teams);
            
            // Găsește echipa principală
            const primaryTeam = findPrimaryTeam(article.title + ' ' + article.content);
            
            if (primaryTeam) {
              console.log('Echipa principală:', primaryTeam);
              
              // Determină codul competiției
              const competitionCode = getCompetitionCodeByTeam(primaryTeam);
              
              if (competitionCode) {
                try {
                  console.log(`Obțin clasament pentru competiția: ${competitionCode}`);
                  const standings = await fetchCompetitionStandings(competitionCode);
                  
                  if (standings.length > 0) {
                    // Caută echipa în clasament
                    const teamStanding = standings.find(standing => 
                      standing.team.toLowerCase().includes(primaryTeam.toLowerCase()) ||
                      primaryTeam.toLowerCase().includes(standing.team.toLowerCase())
                    );
                    
                    if (teamStanding) {
                      const league = getTeamLeague(primaryTeam) || 'liga europeană';
                      facts.push(`- ${teamStanding.team} se află pe locul ${teamStanding.position} în ${league}, cu ${teamStanding.points} puncte din ${teamStanding.playedGames} meciuri jucate (sursă: Football-Data.org)`);
                      console.log('Informații factuale adăugate:', facts[facts.length - 1]);
                    } else {
                      console.log('Echipa nu a fost găsită în clasament');
                    }
                  }
                } catch (error) {
                  console.error('Eroare la obținerea clasamentului:', error);
                  // Continuă fără informații factuale în caz de eroare
                }
              } else {
                console.log('Nu s-a putut determina codul competiției pentru echipa:', primaryTeam);
              }
            }
          }

          // Etapa 3: Generarea articolului final cu informațiile obținute și datele factuale
          const factualInfo = facts.join('\n');
          const generatedArticle = await generateFinalArticle(article, searchResults, factualInfo, customDate);
          
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

// Funcție pentru analiza articolului și generarea de query-uri de căutare
async function generateSearchQueries(title: string, content: string): Promise<string[]> {
  try {
    console.log(`Analizăm articolul "${title}" pentru a determina căutările necesare...`);
    
    // Verificăm dacă avem suficient conținut pentru analiză
    if (!title || !content || content.length < 10) {
      console.log("Conținut insuficient pentru analiză, generăm query-uri de bază");
      return [
        `${title} statistici echipe loturi actuale`,
        `${title} ultimele rezultate meciuri recente`,
        `${title} clasament competiție actuală`
      ];
    }
    
    // Construim prompt-ul pentru analiza inițială - mai detaliat și specific pentru sport
    const analysisPrompt = `Ești un analist sportiv profesionist și cercetător cu experiență în jurnalismul sportiv.

Analizează următorul articol sportiv și identifică 4-5 cereri de căutare specifice care ar îmbunătăți considerabil articolul.

Titlul articolului: "${title}"

Conținutul articolului: 
"""
${content}
"""

INSTRUCȚIUNI IMPORTANTE:

1. Identifică EXPLICIT numele echipelor, jucătorilor și competițiilor menționate în articol
2. Pentru fiecare entitate identificată, generează query-uri de căutare super specifice
3. Include întotdeauna query-uri pentru: lotul actual al echipelor, ultimele rezultate, clasament actual, statistici relevante
4. Formulează query-urile în română, folosind termeni utilizați în România (ex: "lot" în loc de "roster", "etapă" în loc de "matchday")
5. Personalizează căutările la contextul specific al articolului (transferuri, accidentări, schimbări antrenori etc)

Răspunde DOAR cu lista de cereri de căutare, una pe linie, fără numerotare sau explicații.
Fiecare cerere trebuie să fie foarte specifică și să conțină nume exacte, competiție și context clar.`;

    // API key pentru Groq
    const apiKey = process.env.GROQ_API_KEY || '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';
    
    // Facem cererea către Groq API pentru analiza inițială - folosind modelul mai avansat
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct', 
        messages: [
          {
            role: 'system',
            content: 'Ești un analist sportiv și cercetător expert care identifică cu precizie entitățile sportive (echipe, jucători, competiții) și generează query-uri de căutare ultra-specifice pentru a îmbunătăți articolele sportive.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      throw new Error(`Eroare la analiza articolului: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const searchText = data.choices[0]?.message?.content || '';
    
    console.log(`Răspuns brut de la API: "${searchText.substring(0, 150)}..."`);
    
    // Transformăm textul în array de query-uri, cu filtrare mai eficientă
    let searchQueries = searchText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => 
        line.length > 8 && 
        !line.startsWith('#') && 
        !line.startsWith('-') &&
        !line.match(/^[0-9]\./) && // Eliminăm linii care încep cu numere urmate de punct
        !line.match(/^Cerere|^Query|^Căutare/) // Eliminăm linii care încep cu cuvinte metadata
      );
      
    // Verificăm dacă avem rezultate valide
    if (searchQueries.length === 0) {
      console.log("Nu s-au generat query-uri valide din răspuns, folosim query-uri implicite");
      
      // Extragem potențiale entități din titlu pentru query-uri implicite mai relevante
      const titleWords = title.split(' ');
      const potentialEntities = titleWords.filter(word => word.length > 3 && word[0] === word[0].toUpperCase());
      const entityQuery = potentialEntities.length > 0 ? potentialEntities.join(' ') : title;
      
      // Query-uri implicite în caz că nu avem rezultate
      searchQueries = [
        `${entityQuery} lot actual jucători`, 
        `${title} ultimele 5 rezultate`, 
        `${title} clasament actual competiție`,
        `${title} statistici recente meciuri`
      ];
    }
    
    // Limităm la maxim 5 query-uri
    searchQueries = searchQueries.slice(0, 5);
      
    console.log(`Generate ${searchQueries.length} cereri de căutare pentru articol:`, searchQueries);
    return searchQueries;
  } catch (error) {
    console.error('Eroare la generarea query-urilor de căutare:', error);
    // În caz de eroare, returnăm mai multe query-uri de căutare implicite bazate pe titlu
    
    // Încercăm să extragem potențiale entități din titlu
    const titleWords = title.split(' ');
    const potentialEntities = titleWords.filter(word => word.length > 3 && word[0] === word[0].toUpperCase());
    const entityQuery = potentialEntities.length > 0 ? potentialEntities.join(' ') : title;
    
    const defaultQueries = [
      `${entityQuery} lot actual jucători echipă`, 
      `${title} ultimele rezultate meciuri`, 
      `${title} clasament actualizat`,
      `${title} statistici importante sportive`
    ];
    console.log(`Folosim ${defaultQueries.length} query-uri implicite:`, defaultQueries);
    return defaultQueries;
  }
}

// Funcție pentru efectuarea căutărilor web specifice
async function performTargetedSearches(searchQueries: string[]): Promise<string> {
  try {
    console.log(`Efectuăm ${searchQueries.length} căutări web specifice...`);
    
    // Executăm toate căutările în paralel pentru eficiență
    const searchPromises = searchQueries.map(async (query, index) => {
      // Folosim funcția searchWeb care acceptă un număr ca al doilea parametru
      console.log(`Căutare #${index + 1}: "${query}"`);
      const results = await searchWeb(query, 2); // Limităm la 2 rezultate per query
      return {
        query,
        results
      };
    });
    
    const allResults = await Promise.all(searchPromises);
    
    // Combinăm și structurăm rezultatele
    let combinedResults = `REZULTATE CĂUTARE WEB (${new Date().toLocaleDateString('ro-RO')}):\n\n`;
    
    allResults.forEach(result => {
      combinedResults += `PENTRU CEREREA: "${result.query}"\n`;
      combinedResults += `${result.results}\n`;
      combinedResults += `---\n\n`;
    });
    
    console.log(`Am obținut ${combinedResults.length} caractere de informații din căutările web.`);
    return combinedResults;
  } catch (error: unknown) {
    console.error('Eroare la efectuarea căutărilor web:', error);
    const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
    return `Nu s-au putut efectua căutările web din cauza unei erori: ${errorMessage}`;
  }
}

// Funcție pentru generarea articolului final cu informațiile obținute
async function generateFinalArticle(
  article: Article,
  searchResults: string,
  factualInfo: string = '',
  customDate: Date | null = null
): Promise<{ title: string; content: string }> {
  try {
    // Data actuală sau personalizată pentru context temporal
    const currentDate = customDate || new Date();
    const formattedDate = currentDate.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Construiește prompt-ul pentru LLM
    const prompt = `Ești un jurnalist profesionist specializat în știri sportive și generale. Trebuie să creezi un articol complet și bine documentat în limba română.

ARTICOL ORIGINAL:
Titlu: ${article.title}
Conținut: ${article.content}

${factualInfo ? `INFORMAȚII FACTUALE:
${factualInfo}

` : ''}INFORMAȚII SUPLIMENTARE:
${searchResults}

CERINȚE:
1. Creează un titlu captivant și informativ în română
2. Scrie un articol complet de 400-600 cuvinte în română
3. Folosește informațiile suplimentare pentru a îmbogăți conținutul
${factualInfo ? '4. Integrează informațiile factuale în mod natural în articol și citează sursa (Football-Data.org) când folosești aceste date\n' : ''}5. Păstrează un ton jurnalistic profesionist
6. Structurează articolul cu paragrafe clare
7. Data de referință pentru context temporal: ${formattedDate}

Returnează doar titlul și conținutul articolului, fără alte comentarii.`;

    // API key pentru Groq
    const apiKey = process.env.GROQ_API_KEY || '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';
    
    console.log("Generăm articolul final cu informațiile obținute...");
    
    // Facem cererea către Groq API pentru generarea articolului final
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',  // Model complet pentru generarea finală
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
        temperature: 0.5,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Răspuns complet de la Groq:', errorText);
      throw new Error(`Eroare la generarea articolului final: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || '';
    
    // Extragem titlul și conținutul din răspuns folosind delimitatorii specifici
    let title = '';
    let content = '';

    const titleMatch = generatedText.match(
      /(?:===TITLU===\s*|TITLU:\s*)(.*?)(?=\r?\n|$)/i
    );
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else {
      // fallback: prima linie din răspuns
      title = generatedText.split(/\r?\n/)[0].trim();
    }

    const contentMatch = generatedText.match(/===CONȚINUT===\s*([\s\S]*)/);
    if (contentMatch && contentMatch[1]) {
      content = contentMatch[1].trim();
    } else {
      content = generatedText; // Dacă nu găsim formatul, folosim tot textul generat
    }

    // Funcție pentru curățarea oricăror meta-comentarii
    function cleanMetaComments(text: string): string {
      return text
        // Eliminăm orice instrucțiuni care au fost copiate în răspuns
        .replace(/TITLU:|CONȚINUT:|RĂSPUNDE FOLOSIND|CERINȚE PENTRU|ARTICOL ORIGINAL:|INFORMAȚII ADIȚIONALE:|CONTEXT:/g, '')
        // Eliminăm linii care descriu procesul sau strategia
        .replace(/(?:Acum|Apoi|Voi|Trebuie să|O să|Hai să|Pentru a|În primul rând|În continuare|Următorul pas)[^.!?:;]*(?:scriu|explic|analizez|dezvolt|prezint|descriu|structurez|menționez|redactez|creez|includ)[^.!?]*\./gi, '')
        // Eliminăm explicații despre cum să construiască articolul
        .replace(/(?:articolul|textul|conținutul)[^.!?]*(?:trebuie|ar trebui|va fi|este|poate fi)[^.!?]*(?:structurat|scris|redactat|formulat|captivant|profesional|clar)[^.!?]*\./gi, '')
        // Eliminăm comentarii despre citări sau surse
        .replace(/(?:voi|trebuie să|este important să)[^.!?]*cit[aăe][^.!?]*surs[aăe][^.!?]*\./gi, '')
        // Eliminăm orice text care menționează explicații meta sau stilul de scriuere
        .replace(/[^.!?]*(?:meta comentarii|explic cum|cum scriu|procesul de creație|stilul de scriere)[^.!?]*\./gi, '')
        // Eliminăm referințe la instrucțiunile primite
        .replace(/[^.!?]*(?:conform instrucțiunilor|așa cum s-a cerut|după cum mi s-a solicitat)[^.!?]*\./gi, '')
        // Eliminăm orice text între paranteze care par a fi meta comentarii
        .replace(/\([^)]*(?:articol|titlu|conținut|text)[^)]*(?:profesional|jurnalistic|captivant|sportiv)[^)]*\)/gi, '')
        // Eliminăm texte cu "Let me" sau "I'll"
        .replace(/(?:Let me|I'll|I will|I need to|I should)[^.!?]*\./gi, '')
        // Eliminăm marcaje markdown
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/#+\s+/g, '')
        // Eliminăm texte cu "I'm" sau "I am"
        .replace(/(?:I'm|I am)[^.!?]*\./gi, '')
        // Eliminăm texte de verificare
        .replace(/(?:I'll check|Let me verify|I'll make sure|I'll ensure)[^.!?]*\./gi, '')
        // Eliminăm linii cu "TITLU:" în ele 
        .replace(/.*TITLU:.*\n?/g, '')
        // Curățăm spații multiple și linii goale
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    // Curățăm textul
    title = cleanMetaComments(title);
    content = cleanMetaComments(content);
    
    // Verificăm dacă conținutul începe cu titlul și îl eliminăm dacă e cazul
    if (content.startsWith(title)) {
      content = content.substring(title.length).trim();
    }
    
    // Verificăm și eliminăm orice formă de "Conținut:" din text
    content = content.replace(/^(?:Conținut|CONȚINUT):\s*/i, '');
    
    // Eliminăm orice structuri JSON neprelucrate sau sintaxă specifică formatării
    content = content
      .replace(/boxed\{[`'"]*\}json\s*\{/g, '') 
      .replace(/"\s*,\s*"content"\s*:\s*"/g, '')
      .replace(/oxed\{[`'"]*\}json\s*\{/g, '')
      .replace(/"\s*\}\s*$/g, '')
      .replace(/"title"\s*:\s*"/g, '')
      .replace(/\\n\\n/g, '\n\n')
      // Eliminăm marcajele editoriale comune
      .replace(/\n*(Introducere|Cuprins|Context|Detalii despre|Reacții|Perspective|Concluzie):\n*/gi, '\n\n')
      // Eliminăm referințele la surse în format markdown
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      // Adăugăm întotdeauna un paragraf nou după titluri
      .replace(/([.!?]\s*)([A-Z])/g, '$1\n\n$2');
      
    // Mai facem o verificare finală pentru meta-comentarii
    title = title.replace(/(?:și urmat de|fără explicații sau|trebuie să)[^.!?]*/gi, '').trim();
    
    console.log(`Articol generat cu succes: "${title}" (${content.length} caractere)`);
    return { title, content };
  } catch (error) {
    console.error('Eroare la generarea articolului final:', error);
    throw error;
  }
}

// Păstrăm și funcția originală ca backup în caz că noua implementare eșuează
async function generateArticleWithGroq(
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
      console.log(`Efectuez căutare web avansată pentru articolul: "${article.title}"`);
      // Transmitem și conținutul articolului pentru o căutare mai precisă
      webSearchResults = await searchSportsNews(article.title, article.content);
    }
    
    // Construim prompt-ul pentru LLM
    const prompt = `Ești un jurnalist profesionist specializat în știri sportive actuale la data de ${formattedDate}.

Rescrie următoarea știre recentă, punând accent pe ACTUALITATEA informațiilor și păstrând toate datele și evenimentele recente.

Titlul original: "${article.title}"

Conținutul original: 
"""
${article.content.replace(/###/g, '')}
"""

Data publicării originale: ${pubDate.toLocaleDateString('ro-RO')}
Context temporal: ${temporalContext}
Sursa originală: ${sourceDomain}
URL sursă: ${article.source_url}

${webSearchResults ? `${webSearchResults}` : ''}

INSTRUCȚIUNI IMPORTANTE:
1. Această știre este RECENTĂ - tratează informațiile ca fiind de ACTUALITATE
2. Menține TOATE referințele temporale din articolul original (ieri, azi, mâine, data exactă)
3. Nu modifica datele, scorurile sau statisticile menționate în articolul original
4. Păstrează toate numele, echipele și competițiile exacte din articolul original
5. Extinde știrea cu informații de context relevante și actuale
6. Evidențiază când s-a întâmplat evenimentul folosind expresii clare de timp (ex: "ieri, 15 octombrie")
7. Fă cercetare adițională DOAR pentru a completa cu detalii contextuale, nu pentru a modifica faptele
8. Structurează articolul cu titlu captivant, introducere, cuprins și concluzie
9. Incluzi în final și o referință că știrea este din data originală de publicare
10. IMPORTANT: NU folosi simboluri precum "###" în text
${webSearchResults ? '11. FOLOSEȘTE informațiile din căutarea web pentru a actualiza și completa articolul cu detalii recente și relevante.' : ''}

Răspunsul tău(un articol gata de publicat care va ajunge la vizitatorii finali ai celei mai bune redactii sportive din Romania) trebuie să conțină:
TITLU: [Titlu captivant care subliniază actualitatea știrii]
CONȚINUT: [Articolul rescris păstrând caracterul actual al informațiilor, minim 500 cuvinte]
IMPORTANT: NU trebuie sa imi dai strategia ta de scriere a articolului, doar sa imi scrii articolul gata de publicat.`;

    // API key pentru Groq
    const apiKey = process.env.GROQ_API_KEY || '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';
    
    console.log("Folosim Groq cu modelul LLama 3 pentru generarea articolului...");
    
    // Facem cererea către Groq API
    console.log("Începem cererea către Groq API...");
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-saba-24b',  
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
        temperature: 0.5,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Răspuns complet de la Groq:', errorText);
      throw new Error(`Eroare în API-ul Groq: ${response.status} ${response.statusText}. Detalii: ${errorText}`);
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

    // Eliminăm toate simbolurile "###" din conținut
    content = content.replace(/###/g, '');
    title = title.replace(/###/g, '');
    
    // Eliminăm orice structuri JSON neprelucrate sau sintaxă specifică formatării
    content = content
      .replace(/boxed\{[`'"]*\}json\s*\{/g, '') // Eliminăm prefixul boxed{``}json {
      .replace(/"\s*,\s*"content"\s*:\s*"/g, '') // Eliminăm separatorul între titlu și conținut
      .replace(/oxed\{[`'"]*\}json\s*\{/g, '') // Captăm varianta cu 'oxed' (dacă boxed e tăiat)
      .replace(/"\s*\}\s*$/g, '') // Eliminăm închiderea JSON
      .replace(/"title"\s*:\s*"/g, '') // Eliminăm marcajul de titlu
      .replace(/\\n\\n/g, '\n\n'); // Înlocuim escape sequences
    
    // Curățăm titlul de asemenea
    title = title
      .replace(/boxed\{[`'"]*\}json\s*\{/g, '')
      .replace(/"\s*,\s*"content"\s*:\s*"/g, '')
      .replace(/oxed\{[`'"]*\}json\s*\{/g, '')
      .replace(/"\s*\}\s*$/g, '')
      .replace(/"title"\s*:\s*"/g, '')
      .replace(/\\n\\n/g, '\n\n');
    
    return { title, content };
  } catch (error) {
    console.error('Eroare la generarea articolului cu Groq:', error);
    throw error;
  }
} 