import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import { getViralTopics, getTopicContext } from '../../lib/trendSearch';

interface ViralArticleRequest {
  count?: number;
  forceRefresh?: boolean;
  topics?: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  const { 
    count = 5, 
    forceRefresh = false,
    topics: customTopics 
  } = req.body as ViralArticleRequest;

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
          is_manual BOOLEAN DEFAULT FALSE,
          is_viral BOOLEAN DEFAULT FALSE
        )
      `);
      
      // Adăugăm coloana is_viral dacă tabela există deja și nu are coloana
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name='articles'
          ) AND NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name='articles' AND column_name='is_viral'
          ) THEN
            ALTER TABLE articles ADD COLUMN is_viral BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.error('Eroare la verificarea/crearea tabelei:', err);
      return res.status(500).json({ 
        error: 'Eroare la inițializarea bazei de date. Vă rugăm încercați din nou.' 
      });
    }

    // Obținem subiectele virale din România sau folosim lista personalizată furnizată
    const viralTopics = customTopics && customTopics.length > 0 
      ? customTopics.slice(0, count)
      : await getViralTopics(count);

    if (viralTopics.length === 0) {
      return res.status(200).json({
        message: 'Nu s-au putut identifica subiecte virale. Încercați din nou mai târziu.',
        articles: []
      });
    }

    console.log(`S-au identificat ${viralTopics.length} subiecte virale pentru generare de articole:`, viralTopics);

    // Verificăm dacă există deja articole pentru aceste subiecte (dacă nu forțăm reîmprospătarea)
    let topicsToProcess = [...viralTopics];
    
    if (!forceRefresh) {
      for (const topic of viralTopics) {
        // Verificăm dacă există deja un articol pentru acest subiect viral
        const checkResult = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM articles WHERE source_url = $1 AND created_at > NOW() - INTERVAL '2 days') AS exists",
          [`viral-topic:${encodeURIComponent(topic)}`]
        );
        
        if (checkResult.rows[0].exists) {
          // Eliminăm subiectul din lista de procesare
          topicsToProcess = topicsToProcess.filter(t => t !== topic);
        }
      }
    }

    if (topicsToProcess.length === 0) {
      return res.status(200).json({
        message: forceRefresh 
          ? 'Nu s-au găsit subiecte virale pentru generare.' 
          : 'Toate subiectele virale identificate au fost deja procesate recent. Folosiți forceRefresh=true pentru a le regenera.',
        articles: []
      });
    }

    console.log(`Se vor genera articole pentru ${topicsToProcess.length} subiecte virale ${forceRefresh ? '(cu forțare)' : 'noi'}.`);

    // Procesează fiecare subiect și generează un articol
    const generatedArticles = await Promise.all(
      topicsToProcess.map(async (topic) => {
        try {
          // Etapa 1: Obținem informații de context despre subiect
          console.log(`Obținem informații despre subiectul viral: "${topic}"`);
          const topicContext = await getTopicContext(topic);
          
          // Etapa 2: Generăm articolul folosind informațiile de context
          console.log(`Generăm articolul pentru subiectul viral: "${topic}"`);
          const generatedArticle = await generateArticleFromTopic(topic, topicContext);
          
          // Salvăm noul articol în baza de date
          const insertResult = await pool.query(
            `INSERT INTO articles 
             (title, content, image_url, source_url, pub_date, is_manual, is_viral) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, true, true)
             RETURNING *`,
            [
              generatedArticle.title,
              generatedArticle.content,
              generatedArticle.imageUrl || null,
              `viral-topic:${encodeURIComponent(topic)}`, // Referință la subiectul viral
            ]
          );
          
          return insertResult.rows[0];
        } catch (error) {
          console.error(`Eroare la procesarea subiectului viral "${topic}":`, error);
          return null;
        }
      })
    );

    // Filtrează articolele care nu au fost generate cu succes
    const successfulArticles = generatedArticles.filter(Boolean);
    
    res.status(200).json({
      message: `S-au generat cu succes ${successfulArticles.length} articole din ${topicsToProcess.length} subiecte virale`,
      topics: viralTopics,
      articles: successfulArticles
    });
  } catch (error) {
    console.error('Eroare la generarea articolelor virale:', error);
    res.status(500).json({ error: 'Eroare la generarea articolelor virale' });
  }
}

// Funcție pentru analiza subiectului și generarea articolului
async function generateArticleFromTopic(
  topic: string,
  topicContext: string
): Promise<{ title: string; content: string; imageUrl?: string }> {
  try {
    console.log(`Generăm articol pentru subiectul viral: "${topic}"`);
    
    // Construim prompt-ul pentru LLM
    const finalPrompt = `Ești un jurnalist profesionist specializat în actualități din România. Sarcina ta este să scrii un articol complet despre un subiect viral din România.

SUBIECT VIRAL: "${topic}"

INFORMAȚII DE CONTEXT:
${topicContext}

CERINȚE PENTRU ARTICOL:
- Scrie un articol informativ, obiectiv și captivant despre acest subiect viral din România
- Folosește informațiile din context dar organizează-le într-o formă jurnalistică profesională
- Structurează articolul cu un titlu captivant, introducere, cuprins și concluzie
- Articolul trebuie să aibă între 600-1000 de cuvinte
- Menționează sursele informațiilor atunci când este relevant
- Folosește un limbaj accesibil și profesionist în limba română
- Include citate relevante din surse dacă există
- Folosește diacritice românești corect
- Păstrează un ton neutru și obiectiv, specific jurnalismului de calitate

RĂSPUNDE FOLOSIND EXACT URMĂTORUL FORMAT:

===TITLU===
[Scrie aici un titlu captivant]

===CONȚINUT===
[Scrie aici conținutul articolului]

===IMAGINE===
[Descrie aici o imagine sugestivă pentru acest articol] (opțional)`;

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
        model: 'llama-3.3-70b-versatile',  // Model puternic pentru generare de calitate
        messages: [
          {
            role: 'system',
            content: 'Ești un jurnalist expert specializat în actualități din România. Scrii articole profesionale, informative și captivante despre subiecte de interes național. Folosești un stil jurnalistic de calitate, cu structură clară și informații verificate. Articolele tale sunt obiective, bine documentate și respectă principiile jurnalismului profesionist.'
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.6,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Răspuns complet de la Groq:', errorText);
      throw new Error(`Eroare la generarea articolului: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || '';
    
    console.log('Răspuns primit de la API:', generatedText.substring(0, 200));
    
    // Extragem titlul, conținutul și sugestia de imagine din răspuns
    let title = '';
    let content = '';
    const imageUrl = '';

    const titleMatch = generatedText.match(/===TITLU===\s*([\s\S]*?)(?=\s*===CONȚINUT===|$)/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else {
      title = `${topic} - Subiect Viral în România`;
    }

    const contentMatch = generatedText.match(/===CONȚINUT===\s*([\s\S]*?)(?=\s*===IMAGINE===|$)/);
    if (contentMatch && contentMatch[1]) {
      content = contentMatch[1].trim();
    } else {
      // Dacă nu găsim formatul, folosim tot textul generat
      content = generatedText.replace(/===TITLU===[\s\S]*?===CONȚINUT===\s*/g, '').trim();
    }

    // Funcție pentru curățarea oricăror meta-comentarii
    function cleanMetaComments(text: string): string {
      return text
        // Eliminăm orice instrucțiuni care au fost copiate în răspuns
        .replace(/TITLU:|CONȚINUT:|RĂSPUNDE FOLOSIND|CERINȚE PENTRU|SUBIECT VIRAL:|INFORMAȚII DE CONTEXT:|CONTEXT:/g, '')
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
    return { title, content, imageUrl };
  } catch (error) {
    console.error('Eroare la generarea articolului din subiect viral:', error);
    throw error;
  }
} 