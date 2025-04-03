# Generarea automată a știrilor cu AI

Acest document descrie funcționalitatea de generare automată a știrilor implementată în aplicația NewsWeek.

## Descriere generală

Funcționalitatea permite generarea automată a unor știri noi, bazate pe articolele existente în baza de date. Sistemul:
1. Selectează ultimele 5 articole din baza de date
2. Pentru fiecare articol, extrage subiectul
3. Generează o nouă știre pe același subiect folosind AI
4. Salvează noua știre în baza de date ca un articol manual

## Tehnologii utilizate

- **Model LLM**: Llama3 70B (prin Groq API)
- **Frecvență**: La cerere (manual) sau automată (via cron job)
- **Format de ieșire**: Articole în stil jurnalistic

## Configurare

### 1. Obținerea unei chei API Groq

1. Creați-vă un cont pe [Groq](https://console.groq.com/)
2. Obțineți o cheie API din dashboard
3. Adăugați cheia în fișierul `.env.local`:

```
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Configurare cron job pentru generare periodică (opțional)

Pentru generarea automată la intervale regulate, puteți configura un cron job care să apeleze endpoint-ul API.

1. Adăugați o cheie de securitate pentru cron în `.env.local`:

```
CRON_API_KEY=secure_cron_key_here
```

2. Configurați un cron job folosind un serviciu precum crontab (Linux), Windows Task Scheduler, sau servicii web precum Vercel Cron:

```bash
# Exemple de comenzi cron (rulează zilnic la ora 3 dimineața)
0 3 * * * curl -X POST "https://your-site.com/api/cronGenerateNews?apiKey=secure_cron_key_here"
```

## Utilizare manuală

1. Accesați panoul de administrare: `/admin`
2. Faceți clic pe butonul "Generare Știri AI" din navbar sau pe butonul verde din pagină
3. În pagina de generare a știrilor, apăsați butonul "Generează Știri Noi"
4. Așteptați procesarea și veți vedea rezultatele afișate pe ecran

## Personalizări

### Modificarea numărului de articole generate

Pentru a modifica numărul de articole de bază utilizate pentru generare (implicit 5), editați fișierele:
- `src/pages/api/generateNews.ts`
- `src/pages/api/cronGenerateNews.ts`

Modificați valoarea `LIMIT 5` în interogarea SQL:

```typescript
const result = await pool.query<Article>(
  'SELECT * FROM articles ORDER BY pub_date DESC LIMIT 5' // Modificați 5 la numărul dorit
);
```

### Ajustarea promptului

Promptul utilizat pentru generarea articolelor poate fi ajustat în funcțiile `generateArticleWithLlama` din fișierele:
- `src/pages/api/generateNews.ts`
- `src/pages/api/cronGenerateNews.ts`

## Troubleshooting

### Erori de timeout

Dacă întâmpinați erori de timeout în timpul generării, este posibil ca API-ul Groq să fie ocupat. Soluții:
- Încercați din nou mai târziu
- Reduceți numărul de articole generate simultan
- Măriți timeout-ul pentru API route în Next.js (în `next.config.js`)

### Erori de API Groq

Verificați:
- Cheia API este corectă
- Aveți credit suficient în contul Groq
- Modelul solicitat (`llama3-70b-8192`) este disponibil

## Costurile de utilizare

Serviciul Groq oferă anumite requeste gratuite, dar verificați politica lor de prețuri actuală pentru utilizare extinsă. 