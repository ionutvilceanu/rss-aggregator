# RSS Aggregator - Platformă de Știri cu AI

O platformă modernă de agregare și generare de știri folosind inteligența artificială, optimizată pentru deployment pe platforme serverless.

## 🚀 Funcționalități

- **Agregare RSS**: Colectează automat știri din multiple surse RSS
- **Generare AI**: Creează articole originale folosind AI
- **Articole Virale**: Identifică și generează conținut viral bazat pe trending topics
- **Generare Reels**: Creează video reels cu voiceover pentru social media
- **Dashboard Admin**: Interfață completă de administrare
- **Optimizat Serverless**: Compatibil cu Vercel, Netlify și alte platforme

## 📋 Cerințe

- Node.js 18+
- PostgreSQL database
- API Keys pentru servicii externe (opțional)

## 🛠️ Instalare

```bash
# Clonează repository-ul
git clone <repository-url>
cd rss-aggregator

# Instalează dependențele
npm install

# Configurează variabilele de mediu
cp .env.example .env.local
```

## ⚙️ Configurare

Creează un fișier `.env.local` cu următoarele variabile:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rss_aggregator

# OpenAI (pentru generarea de articole)
OPENAI_API_KEY=your_openai_api_key

# VoiceRSS (pentru voiceover)
VOICE_RSS_API_KEY=your_voicerss_api_key

# Azure Speech (opțional, pentru voiceover avansat)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=westeurope

# Autentificare
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD=your_admin_password
```

## 🚀 Deployment

### Vercel (Recomandat)

1. **Pregătire pentru deployment:**
   ```bash
   npm run build
   ```

2. **Deploy pe Vercel:**
   ```bash
   npx vercel --prod
   ```

3. **Configurează variabilele de mediu în Vercel Dashboard**

### Limitări pe Platforme Serverless

Din cauza limitărilor platformelor serverless, următoarele funcționalități sunt adaptate:

#### ✅ Funcționalități Disponibile:
- Agregare RSS și generare articole AI
- Generare articole virale
- Dashboard admin complet
- API-uri pentru toate funcționalitățile de bază
- Voiceover prin VoiceRSS API

#### ⚠️ Funcționalități Adaptate:
- **Generare Video**: Disponibilă doar în browser prin MediaRecorder API
- **Combinare Audio-Video**: Se face client-side folosind Canvas și MediaRecorder
- **Voiceover**: Folosește doar VoiceRSS API (nu Azure Speech cu fișiere locale)

#### 🔧 Alternative pentru Funcționalități Avansate:

**Pentru Generare Video Serverless:**
```javascript
// Folosește MediaRecorder în browser
const stream = canvas.captureStream();
const mediaRecorder = new MediaRecorder(stream);
```

**Pentru Combinare Audio-Video:**
```javascript
// Client-side cu MediaRecorder
import { combineVideoAudio } from '@/lib/mediaUtils';
const combinedBlob = await combineVideoAudio(videoBlob, audioBlob);
```

## 📁 Structura Proiectului

```
src/
├── components/          # Componente React
├── lib/                # Utilitare și funcții helper
│   ├── trendSearch.ts  # Identificare trending topics
│   └── mediaUtils.ts   # Utilitare media pentru browser
├── pages/
│   ├── admin/          # Pagini admin
│   │   ├── generate-viral-articles.tsx
│   │   └── generate-reels.tsx
│   └── api/            # API routes (optimizate serverless)
│       ├── generateViralArticles.ts
│       ├── generate-voiceover.ts
│       ├── generate-video.ts
│       └── combine-audio-video.ts
└── styles/             # Stiluri CSS
```

## 🔧 Dezvoltare Locală

```bash
# Pornește serverul de dezvoltare
npm run dev

# Pornește cron jobs (opțional)
npm run dev:cron

# Linting
npm run lint

# Build pentru producție
npm run build
```

## 📊 API Endpoints

### Articole Virale
```
POST /api/generateViralArticles
Body: { count: 5, topics?: string[] }
```

### Voiceover
```
POST /api/generate-voiceover
Body: { text: string, lang: 'ro'|'en', gender: 'male'|'female', service: 'voicerss' }
```

### Generare Video (Browser-only)
```
POST /api/generate-video
Response: { error: 'Not available on serverless', alternatives: [...] }
```

## 🎯 Funcționalități Principale

### 1. Articole Virale
- Identifică automat trending topics din România
- Cercetează fiecare topic pe web
- Generează articole originale și captivante
- Salvează în baza de date cu flag pentru conținut viral

### 2. Generare Reels
- Interfață pentru crearea de video reels
- Voiceover automat pentru titlurile articolelor
- Sincronizare audio-video în browser
- Export în format video standard

### 3. Dashboard Admin
- Gestionare feed-uri RSS
- Generare articole AI
- Monitorizare și statistici
- Configurare și setări

## 🔒 Securitate

- Autentificare JWT pentru admin
- Validare input pentru toate API-urile
- Rate limiting pentru API-uri publice
- Sanitizare conținut HTML

## 🐛 Debugging

Pentru debugging în dezvoltare:

```bash
# Verifică logs în timp real
npm run dev

# Pentru probleme cu database
npx prisma studio

# Pentru probleme cu build
npm run build -- --debug
```

## 📝 Contribuții

1. Fork repository-ul
2. Creează o branch pentru feature (`git checkout -b feature/AmazingFeature`)
3. Commit modificările (`git commit -m 'Add some AmazingFeature'`)
4. Push pe branch (`git push origin feature/AmazingFeature`)
5. Deschide un Pull Request

## 📄 Licență

Acest proiect este licențiat sub MIT License - vezi fișierul [LICENSE](LICENSE) pentru detalii.

## 🆘 Suport

Pentru probleme și întrebări:
- Deschide un issue pe GitHub
- Verifică documentația API
- Consultă secțiunea de troubleshooting

---

**Nota**: Această aplicație este optimizată pentru platforme serverless. Pentru funcționalități avansate de procesare video, consideră folosirea unui server dedicat sau servicii externe specializate.
