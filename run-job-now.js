// run-job-now.js
// Script pentru a rula manual job-ul de generare știri

const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function runJobNow() {
  const hostname = 'localhost';
  const port = process.env.PORT || 3000;
  
  console.log(`[MANUAL] Rulare job la ${new Date().toISOString()}`);
  
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
      console.log('[MANUAL] Job finalizat cu succes:', data.message);
      console.log(`[MANUAL] Articole generate: ${data.result?.articles?.length || 0}`);
    } else {
      console.error('[MANUAL] Eroare la rularea job-ului:', data.error || 'Eroare necunoscută');
    }
  } catch (error) {
    console.error('[MANUAL] Eroare la apelarea API-ului:', error.message);
  }
}

// Rulăm job-ul
runJobNow(); 