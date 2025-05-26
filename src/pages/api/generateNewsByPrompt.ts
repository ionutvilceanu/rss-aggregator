import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import { searchWeb } from '../../lib/webSearch';

interface PromptRequest {
  prompt: string;
  title?: string;
  enableWebSearch?: boolean;
  searchQueries?: string[];
  imageUrl?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  const { 
    prompt, 
    title, 
    enableWebSearch = false,
    searchQueries = [],
    imageUrl = ''
  } = req.body as PromptRequest;

  if (!prompt) {
    return res.status(400).json({ error: 'Promptul este obligatoriu.' });
  }

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

    // Efectuăm căutări web dacă este activată opțiunea
    let webSearchResults = "";
    if (enableWebSearch && searchQueries.length > 0) {
      webSearchResults = await performTargetedSearches(searchQueries);
    }

    // Generăm articolul folosind promptul furnizat și rezultatele căutării
    const generatedArticle = await generateArticleFromPrompt(prompt, webSearchResults, title);

    // Salvăm articolul în baza de date
    const insertResult = await pool.query(
      `INSERT INTO articles 
       (title, content, image_url, source_url, pub_date, is_manual) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, true)
       RETURNING *`,
      [
        generatedArticle.title,
        generatedArticle.content,
        imageUrl,
        `prompt-generated-article:${new Date().toISOString()}`, // Identificator unic
      ]
    );

    const savedArticle = insertResult.rows[0];
    
    res.status(200).json({
      message: `Articolul a fost generat cu succes.`,
      article: savedArticle
    });
  } catch (error) {
    console.error('Eroare la generarea articolului:', error);
    res.status(500).json({ error: 'Eroare la generarea articolului' });
  }
}

// Funcție pentru efectuarea căutărilor web specifice (preluată din generateNews.ts)
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

// Funcție pentru generarea articolului folosind promptul furnizat
async function generateArticleFromPrompt(
  userPrompt: string,
  searchResults: string = "",
  customTitle?: string
): Promise<{ title: string; content: string }> {
  try {
    console.log("Generăm articolul din promptul furnizat...");
    
    // Construim promptul final care include rezultatele căutării dacă există
    const finalPrompt = `${userPrompt}

${searchResults ? `INFORMAȚII ADIȚIONALE DIN CĂUTARE WEB:
${searchResults}` : ''}

RĂSPUNDE FOLOSIND EXACT URMĂTORUL FORMAT:

===TITLU===
[Scrie aici un titlu captivant]

===CONȚINUT===
[Scrie aici conținutul articolului]`;

    // API key pentru Groq
    const apiKey = process.env.GROQ_API_KEY || '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';
    
    // Facem cererea către Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-r1-distill-llama-70b',  // Același model ca în generateNews.ts
        messages: [
          {
            role: 'system',
            content: 'Ești un jurnalist sportiv de actualitate care raportează evenimente sportive recente și știri de ultimă oră din data publicării lor. Consideri informațiile ca fiind actuale și la zi. Ești expert în contextualizarea știrilor și integrarea informațiilor din surse multiple.'
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.5,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Răspuns complet de la Groq:', errorText);
      throw new Error(`Eroare la generarea articolului: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let generatedText = data.choices[0]?.message?.content || '';
    
    // Extragem titlul și conținutul din răspuns
    let title = '';
    let content = '';

    const titleMatch = generatedText.match(/===TITLU===\s*([\s\S]*?)(?=\s*===CONȚINUT===|$)/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else if (customTitle) {
      title = customTitle;
    } else {
      title = 'Articol generat din prompt';
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
    console.error('Eroare la generarea articolului din prompt:', error);
    throw error;
  }
} 