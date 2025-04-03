# RSS Aggregator

O aplicație de agregare a știrilor din diverse surse RSS, cu funcționalități de generare automată de conținut folosind AI.

## Funcționalități

- Agregarea știrilor din surse RSS (Gazzetta, Marca, Mundo Deportivo, DigiSport)
- Traducerea automată a știrilor în limba română
- Generarea de articole noi pe baza știrilor agregate folosind AI (Llama prin Groq API)
- Interfață administrativă pentru gestionarea conținutului

## Configurare

### 1. Instalare dependențe

```bash
npm install
```

### 2. Configurare variabile de mediu

Creați un fișier `.env.local` cu următorul conținut:

```
# Cheia API pentru Groq
GROQ_API_KEY=your_groq_api_key_here

# Cheia API pentru cron jobs
CRON_API_KEY=secure_cron_key_here

# Configurări bază de date
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=icsoft.go.ro
DB_PORT=5432
DB_NAME=newDB
```

### 3. Pornirea aplicației în mod dezvoltare

```bash
npm run dev
```

## Utilizare

### Importul știrilor din RSS

Aplicația poate importa știri din următoarele surse RSS:
- Gazzetta dello Sport
- Marca
- Mundo Deportivo
- DigiSport

Există două moduri de a importa știri:

1. **Manual**: Din interfața de administrare, folosind butonul "Importă RSS"
2. **Automat**: Configurând un cronjob care apelează endpoint-ul `/api/cronImportRSS` la intervale regulate

### Generarea știrilor cu AI

Aplicația poate genera automat articole noi pe baza știrilor importate, folosind:
- Modelul Llama 3 (70B) prin API-ul Groq
- Un prompt jurnalistic care asigură un conținut de calitate
- Fiecare subiect este procesat o singură dată pentru a evita duplicatele

Pentru a genera articole noi:
1. Din interfața de administrare, folosiți butonul "Generare Știri AI"
2. Configurați un cronjob care apelează endpoint-ul `/api/cronGenerateNews` la intervale regulate

## Configurarea cronjob-urilor

Pentru a automatiza importul și generarea de știri, puteți configura cronjob-uri folosind exemplele de mai jos:

```bash
# Import știri noi din RSS la fiecare 3 ore
0 */3 * * * curl -X POST "https://your-site.com/api/cronImportRSS?apiKey=secure_cron_key_here"

# Generarea știrilor noi o dată pe zi (la ora 2 dimineața)
0 2 * * * curl -X POST "https://your-site.com/api/cronGenerateNews?apiKey=secure_cron_key_here"
```

## Contribuții

Contribuțiile sunt binevenite. Pentru modificări majore, vă rugăm să deschideți mai întâi o problemă pentru a discuta ce doriți să schimbați.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
