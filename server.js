// server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cron = require('node-cron');
const fetch = require('node-fetch');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Pregătim aplicația Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Încărcăm variabilele de mediu
require('dotenv').config({ path: '.env.local' });

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Parsăm URL-ul cererii
      const parsedUrl = parse(req.url, true);
      
      // Lăsăm Next.js să gestioneze cererea
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Server gata pe http://${hostname}:${port}`);
    
    // Configurăm cron job-ul să ruleze la FIECARE MINUT pentru testare
    console.log('> Configurare cron job pentru rulare la FIECARE MINUT (pentru testare)');
    
    // Expresia '* * * * *' rulează la fiecare minut (pentru testare)
    cron.schedule('* * * * *', async () => {
      console.log(`[CRON] Rulare job programat la ${new Date().toISOString()}`);
      
      try {
        // Apelăm endpoint-ul de generare știri (fără secret)
        const response = await fetch(`http://${hostname}:${port}/api/cronGenerateNews`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('[CRON] Job finalizat cu succes:', data.message);
          console.log(`[CRON] Articole generate: ${data.result?.articles?.length || 0}`);
        } else {
          console.error('[CRON] Eroare la rularea job-ului:', data.error || 'Eroare necunoscută');
        }
      } catch (error) {
        console.error('[CRON] Eroare la apelarea API-ului:', error.message);
      }
    });
    
    // Rulăm job-ul imediat la pornirea serverului
    console.log('> Rulare inițială a job-ului la pornirea serverului...');
    setTimeout(async () => {
      try {
        console.log(`[INIȚIAL] Rulare job la pornirea serverului: ${new Date().toISOString()}`);
        const response = await fetch(`http://${hostname}:${port}/api/cronGenerateNews`, {
          method: 'GET'
        });
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('[INIȚIAL] Job finalizat cu succes:', data.message);
        } else {
          console.error('[INIȚIAL] Eroare la rularea job-ului:', data.error);
        }
      } catch (error) {
        console.error('[INIȚIAL] Eroare la apelarea API-ului:', error.message);
      }
    }, 5000); // Rulăm după 5 secunde
  });
}); 