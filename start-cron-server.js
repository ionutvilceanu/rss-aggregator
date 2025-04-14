// start-cron-server.js
// Un script simplu pentru a rula doar serviciul de cron separat de aplicația Next.js

const cron = require('node-cron');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

console.log(`Serviciu cron pornit la: ${new Date().toISOString()}`);

// Configurați URL-ul aplicației Next.js
const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
console.log(`Se va conecta la aplicația Next.js la adresa: ${appUrl}`);

// Rulează la fiecare minut pentru testare
cron.schedule('* * * * *', async () => {
    console.log(`[CRON] Rulare job programat la ${new Date().toISOString()}`);
    
    try {
        // Apelăm endpoint-ul de generare știri
        const response = await fetch(`${appUrl}/api/cronGenerateNews`, {
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

// Rulăm job-ul o dată la pornire
console.log('Rulare inițială a job-ului...');
setTimeout(async () => {
    try {
        console.log(`[INIȚIAL] Rulare job la ${new Date().toISOString()}`);
        const response = await fetch(`${appUrl}/api/cronGenerateNews`, {
            method: 'GET'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('[INIȚIAL] Job finalizat cu succes');
        } else {
            console.error('[INIȚIAL] Eroare la rularea job-ului:', data.error);
        }
    } catch (error) {
        console.error('[INIȚIAL] Eroare la apelarea API-ului:', error.message);
        console.error('[INIȚIAL] Verificați că aplicația Next.js rulează la adresa', appUrl);
    }
}, 1000);

console.log('Serviciul de cron a fost pornit și va rula în fundal');
console.log('Apăsați Ctrl+C pentru a opri serviciul de cron');

// Menținem procesul activ
process.stdin.resume(); 