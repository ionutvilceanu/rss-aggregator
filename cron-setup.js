const cron = require('node-cron');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Încărcăm variabilele de mediu
dotenv.config();

// Definim URL-ul aplicației
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'your_cron_secret_key';

// Configurăm job-ul pentru a rula la minutul 45 al fiecărei ore
cron.schedule('45 * * * *', async () => {
  console.log(`[CRON] Rulare job programat la ${new Date().toISOString()}`);
  
  try {
    // Apelăm endpoint-ul de generare știri
    const response = await fetch(`${APP_URL}/api/cronGenerateNews?cronSecret=${CRON_SECRET}`, {
      method: 'GET',
      headers: {
        'x-cron-auth': CRON_SECRET,
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

console.log('Cron job configurat pentru a rula la minutul 45 al fiecărei ore'); 