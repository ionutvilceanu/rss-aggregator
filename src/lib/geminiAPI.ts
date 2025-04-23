import axios from 'axios';

/**
 * Generează conținut folosind Google Gemini API
 * @param prompt - Textul prompt pentru generare
 * @param systemContext - Context de sistem (opțional)
 * @param enableWebSearch - Activează căutarea pe web pentru informații actualizate
 * @returns - Obiect cu textul generat
 */
export async function generateWithGemini(
  prompt: string,
  systemContext?: string,
  enableWebSearch: boolean = false
): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY lipsește în configurare');
  }

  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
  
  try {
    // Construim payload-ul pentru cerere
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        stopSequences: []
      }
    };

    // Adăugăm contextul de sistem dacă este furnizat
    if (systemContext) {
      payload.contents.unshift({
        role: 'model',
        parts: [{ text: systemContext }]
      });
    }

    // Adăugăm un timeout de 60 secunde pentru a evita blocarea apelului
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    // Facem cererea la API
    const response = await axios.post(
      `${endpoint}?key=${apiKey}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    ).finally(() => clearTimeout(timeoutId));

    // Extragem textul generat din răspuns
    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates[0] &&
      response.data.candidates[0].content &&
      response.data.candidates[0].content.parts &&
      response.data.candidates[0].content.parts[0]
    ) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('Conținut generat cu succes folosind Google Gemini API');
      return generatedText;
    } else {
      throw new Error('Format de răspuns neașteptat de la Gemini API');
    }
  } catch (error) {
    console.error('Eroare la generarea conținutului cu Gemini:', error);
    throw error;
  }
}

/**
 * Generează un articol folosind Google Gemini
 * @param articleTitle - Titlul original al articolului
 * @param originalContent - Conținutul original al articolului
 * @param sourceDomain - Domeniul sursei articolului
 * @param sourceUrl - URL-ul articolului original
 * @returns - Obiect cu titlul și conținutul articolului generat
 */
export async function generateArticleWithGemini(
  articleTitle: string,
  originalContent: string,
  sourceDomain: string,
  sourceUrl: string
): Promise<{ title: string; content: string }> {
  try {
    // Formatăm data curentă pentru context
    const currentDate = new Date().toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Construim prompt-ul pentru generarea articolului
    const prompt = `
ATENȚIE: EȘTI UN JURNALIST PROFESIONIST CARE VA FI CONCEDIAT DACĂ FOLOSEȘTE INFORMAȚII IPOTETICE! 

REGULILE ABSOLUTE DE JURNALISM:
1. TOT CE SCRII TREBUIE SĂ FIE REAL și VERIFICABIL - nicio informație inventată sau ipotetică
2. TOATE NUMELE, STATISTICILE și CITATELE TREBUIE SĂ FIE REALE, nu exemple sau aproximări
3. CITEAZĂ SURSE CONCRETE - site-uri de știri, conferințe de presă, conturi sociale oficiale
4. FIECARE DECLARAȚIE TREBUIE SĂ FIE DOCUMENTATĂ - niciun citat inventat sau "exemplu de citat"
5. ACEST ARTICOL VA FI PUBLICAT EXACT AȘA CUM ÎL SCRII - nu va fi verificat sau editat

METODOLOGIA OBLIGATORIE DE CERCETARE:
1. CAUTĂ acum pe internet ultimele știri despre acest subiect (meciuri, rezultate, declarații)
2. VERIFICĂ statisticile exacte pe site-urile oficiale (UEFA, FIFA, site-ul clubului)
3. GĂSEȘTE declarații reale din conferințe de presă sau interviuri recente
4. CITEAZĂ minimum 3 surse credibile și actuale
5. VERIFICĂ toate numele și funcțiile persoanelor menționate
6. MENȚIONEAZĂ sursele exacte pentru statistici și citate (fără a scrie "conform unor surse")

STRICT INTERZIS:
- Folosirea termenului "exemplu ipotetic" sau orice variantă
- Fraze de tipul "ar putea spune", "ar fi putut declara", "cum ar fi..."
- Inserarea de instrucțiuni în text (ex: "verificați statisticile actuale")
- Folosirea parantezelor pătrate [...] pentru orice scop
- Inventarea de statistici sau declarații când nu le găsești

ARTICOLUL ORIGINAL:
Titlu: ${articleTitle}
Sursă: ${sourceDomain}
URL: ${sourceUrl}
Data: ${currentDate}

Conținut:
${originalContent}

RĂSPUNDE DOAR CU UN JSON CURAT ȘI VALID, CONFORM FORMATULUI: 
{"title": "Titlul articolului", "content": "Conținutul complet al articolului cu toate statisticile reale și citatele verificabile"}
`;

    // Generăm articolul folosind Gemini
    const generatedResponse = await generateWithGemini(prompt);
    
    // Extragem titlul și conținutul din răspunsul JSON
    try {
      // Prelucrăm răspunsul pentru a obține un JSON valid
      console.log("Prelucrăm răspunsul pentru a extrage JSON valid...");
      
      // Curățăm și identificăm JSON-ul
      let processedResponse = generatedResponse;
      
      // Înlocuim caracterele de control problematice
      processedResponse = processedResponse.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      
      // Extragem doar partea JSON din răspuns (dacă există)
      const jsonMatch = processedResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          // Încercăm să parsăm JSON-ul direct
          console.log("Încercăm să parsăm JSON-ul extras...");
          const parsedResponse = JSON.parse(jsonMatch[0]);
          
          return {
            title: parsedResponse.title || 'Titlu negăsit',
            content: parsedResponse.content || 'Conținut negăsit'
          };
        } catch (jsonError) {
          console.error('Prima încercare de parsare JSON a eșuat:', jsonError);
          
          // Dacă prima încercare eșuează, încercăm să curățăm mai agresiv textul
          console.log("Curățăm mai agresiv JSON-ul și reîncercăm...");
          let cleanedJson = jsonMatch[0]
            .replace(/\\n/g, ' ')  // Înlocuim newline cu spații
            .replace(/\\"/g, '"')  // Gestionăm ghilimelele escape
            .replace(/"/g, '"')    // Înlocuim ghilimelele smart
            .replace(/"/g, '"')    // Alt tip de ghilimele smart
            .replace(/'/g, "'")    // Apostroful smart
            .replace(/[\u2018\u2019]/g, "'") // Alte tipuri de apostrofuri
            .replace(/[\u201C\u201D]/g, '"'); // Alte tipuri de ghilimele
          
          // Reconstruim un JSON valid
          try {
            // Extragem direct title și content cu regex
            const titleMatch = cleanedJson.match(/"title"\s*:\s*"([^"]*)"/);
            const contentMatch = cleanedJson.match(/"content"\s*:\s*"([^"]*)"/);
            
            if (titleMatch && contentMatch) {
              return {
                title: titleMatch[1] || 'Titlu extras cu regex',
                content: contentMatch[1] || 'Conținut extras cu regex'
              };
            } else {
              throw new Error('Nu s-au putut extrage title și content cu regex');
            }
          } catch (regexError) {
            console.error('Extragerea cu regex a eșuat:', regexError);
            
            // Ultima soluție - construim manual răspunsul din textul generat
            const titleStart = processedResponse.indexOf('"title"');
            const contentStart = processedResponse.indexOf('"content"');
            
            if (titleStart > -1 && contentStart > -1) {
              // Preluăm titlul din prima linie ce conține "title"
              const titleLine = processedResponse.substring(titleStart, processedResponse.indexOf('\n', titleStart));
              const titleMatch = titleLine.match(/"title"\s*:\s*"([^"]*)"/);
              
              // Extragem conținutul ca tot ce rămâne după "content"
              let content = processedResponse.substring(contentStart + 10);
              content = content.replace(/^"/, '').replace(/"[^"]*$/, '');
              
              return {
                title: titleMatch ? titleMatch[1] : 'Titlu din articolul original',
                content: content || 'Conținut recuperat parțial'
              };
            }
          }
        }
      }
      
      // Dacă nu putem extrage structura JSON, încercăm să găsim direct title și content
      console.log("Căutăm titlul și conținutul direct în text...");
      const titleRegex = /(?:"title"|title)["']?\s*:?\s*["']([^"']+)["']/i;
      const contentRegex = /(?:"content"|content)["']?\s*:?\s*["']([^"']+)["']/i;
      
      const titleMatch = processedResponse.match(titleRegex);
      const contentMatch = processedResponse.match(contentRegex);
      
      return {
        title: titleMatch ? titleMatch[1] : articleTitle + ' (regenerat)',
        content: contentMatch ? contentMatch[1] : generatedResponse
      };
      
    } catch (error) {
      console.error('Eroare la procesarea răspunsului:', error);
      
      // În caz de eroare totală, returnăm textul brut ca și conținut
      return {
        title: articleTitle + ' (regenerat)',
        content: generatedResponse
      };
    }
  } catch (error) {
    console.error('Eroare la generarea articolului cu Gemini:', error);
    throw error;
  }
} 