import https from 'https';

/**
 * Serviciu pentru căutarea de informații actuale pe web folosind Bing Search API
 */
export async function searchWeb(searchQuery: string, count: number = 5): Promise<string> {
  // Cheia API pentru Bing Search (ar trebui să fie în variabilele de mediu)
  const subscriptionKey = process.env.BING_SEARCH_API_KEY || 'BING_SEARCH_API_KEY';
  
  if (!subscriptionKey || subscriptionKey === 'BING_SEARCH_API_KEY') {
    console.warn('Atenție: BING_SEARCH_API_KEY nu este configurat. Se returnează informații generice.');
    return `Nu s-a putut efectua căutarea web pentru "${searchQuery}" deoarece API-ul Bing Search nu este configurat.`;
  }

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const options = {
        hostname: 'api.bing.microsoft.com',
        path: `/v7.0/search?q=${encodeURIComponent(searchQuery)}&count=${count}&freshness=Day`,
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey
        }
      };

      https.get(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Căutare web eșuată: ${res.statusCode} ${res.statusMessage}`));
            return;
          }

          try {
            const response = JSON.parse(body);
            const webPages = response.webPages?.value || [];
            
            if (webPages.length === 0) {
              resolve(`Nu s-au găsit rezultate pentru căutarea "${searchQuery}".`);
              return;
            }

            // Formatăm rezultatele sub formă de text
            let resultText = `Informații actuale despre "${searchQuery}" (căutare web):\n\n`;
            
            webPages.forEach((page: any, index: number) => {
              resultText += `${index + 1}. ${page.name}\n`;
              resultText += `   ${page.snippet}\n`;
              resultText += `   Sursă: ${page.url}\n\n`;
            });

            resolve(resultText);
          } catch (error: any) {
            reject(new Error(`Eroare la parsarea răspunsului: ${error.message}`));
          }
        });
      }).on('error', (err) => {
        reject(new Error(`Eroare la cererea HTTP: ${err.message}`));
      });
    });

    return result;
  } catch (error: any) {
    console.error('Eroare la căutarea web:', error);
    return `Eroare la căutarea web pentru "${searchQuery}": ${error.message}`;
  }
}

/**
 * Funcție pentru efectuarea unei căutări web despre o știre sportivă specifică
 * pentru a obține informații actuale și context
 */
export async function searchSportsNews(title: string): Promise<string> {
  // Eliminăm orice text între paranteze și curățăm titlul
  const cleanTitle = title.replace(/\([^)]*\)/g, '').trim();
  
  // Construim căutarea pentru știri sportive recente
  const searchQuery = `${cleanTitle} actualitate știri sport`;
  
  return await searchWeb(searchQuery, 3);
} 