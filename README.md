# 🏆 SportAzi.ro - Portal Sportiv Ultra Modern

## 🚀 Despre Proiect

SportAzi.ro este un agregator de știri sportive cu design ultra modern, creat special pentru pasionații de sport din România. Aplicația oferă o experiență vizuală excepțională și funcționalități avansate pentru consumul de conținut sportiv.

## ✨ Funcționalități Principale

### 🎨 Design Ultra Modern
- **Header Hero** cu gradient animat și efecte vizuale
- **Live Indicator** cu animații pulse pentru știri în timp real
- **Breaking News Ticker** cu scroll automat
- **Cards moderne** cu hover effects și animații fluide
- **Featured Stories** cu layout special pentru știrile importante
- **Responsive design** optimizat pentru toate dispozitivele

### 📱 Funcționalități Avansate
- **Ceas în timp real** în header
- **Categorii vizuale** cu iconițe și badge-uri
- **Preview conținut** pentru articolele featured
- **Statistici engagement** simulate (views, comments)
- **Formatare inteligentă** a datelor (ieri, acum X zile)
- **Loading states** animate și moderne

### 🔧 Tehnologii Utilizate
- **Next.js 15** - Framework React modern
- **TypeScript** - Type safety
- **Styled JSX** - CSS-in-JS pentru stilizare
- **PostgreSQL** - Baza de date
- **RSS Parsing** - Agregare conținut
- **AI Integration** - Generare conținut cu Groq/Gemini

## 🎯 Experiența Utilizatorului

### 📊 Layout Inteligent
- **Grid adaptiv** care se ajustează automat
- **Featured section** pentru știrile de top (primele 3)
- **Regular articles** în grid responsive
- **Load more** cu animații și feedback vizual

### 🎨 Elemente Vizuale
- **Gradienți moderni** și culori vibrante
- **Blur effects** și backdrop filters
- **Hover animations** cu transformări 3D
- **Iconițe emoji** pentru o experiență friendly
- **Typography** cu font-uri premium (Poppins, Roboto)

### 📱 Responsive Design
- **Desktop**: Layout complet cu toate funcționalitățile
- **Tablet**: Grid adaptat și navigare optimizată
- **Mobile**: Layout vertical cu menu hamburger

## 🚀 Instalare și Configurare

### Prerequisite
```bash
Node.js 18+
PostgreSQL 14+
npm sau yarn
```

### Pași de instalare
```bash
# Clonează repository-ul
git clone [repository-url]
cd rss-aggregator

# Instalează dependențele
npm install

# Configurează variabilele de mediu
cp .env.example .env.local

# Pornește aplicația în modul development
npm run dev
```

### Variabile de Mediu Necesare
```env
# API Keys
GOOGLE_GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
FOOTBALL_DATA_TOKEN=your_football_data_token

# Database
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sportazi_db

# Security
CRON_SECRET=your_secure_secret
```

## 📈 Funcționalități Avansate

### 🤖 AI Integration
- **Generare conținut** cu Groq LLaMA și Google Gemini
- **Procesare RSS** inteligentă cu traducere automată
- **Extragere entități** (echipe, jucători, competiții)
- **Îmbogățire conținut** cu date factuale din Football-Data.org

### 📊 Managementul Conținutului
- **Admin Panel** complet pentru gestionarea articolelor
- **Generator Reels** pentru TikTok cu AI voiceover
- **Import RSS** automat din surse multiple
- **Căutare web** integrată pentru context adițional

### 🎥 Generator Reels TikTok
- **Canvas processing** pentru imagini
- **AI Voiceover** în română cu diacritice
- **Efecte vizuale** multiple (fade, zoom, slide)
- **Export video** optimizat pentru social media

## 🎨 Ghid de Stil

### Paleta de Culori
```css
--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
--accent-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
--success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)
--dark-gradient: linear-gradient(135deg, #2c3e50 0%, #34495e 100%)
```

### Tipografie
- **Headings**: Poppins (700-900 weight)
- **Body**: Poppins (400-600 weight)
- **Monospace**: Roboto (pentru timp/date)

### Animații
- **Hover effects**: translateY(-8px) cu shadow
- **Loading**: Spinner cu gradient borders
- **Transitions**: cubic-bezier(0.175, 0.885, 0.32, 1.275)

## 📱 API Endpoints

### Publice
- `GET /api/fetchRSS` - Lista articolelor cu paginare
- `GET /api/article/[id]` - Detalii articol specific

### Admin (protejate)
- `POST /api/generateNews` - Generare știri cu AI
- `POST /api/importRSS` - Import manual RSS
- `DELETE /api/article/delete` - Ștergere articol
- `POST /api/generateReels` - Creare reels TikTok

## 🔐 Securitate

- **Autentificare** bazată pe cookie-uri
- **API Keys** securizate în variabile de mediu
- **Rate limiting** pentru API-urile externe
- **Validare input** pentru toate formularele
- **CORS** configurat pentru production

## 🚀 Deployment

### Vercel (Recomandat)
```bash
# Build pentru production
npm run build

# Deploy pe Vercel
vercel --prod
```

### Docker
```bash
# Build imagine
docker build -t sportazi .

# Run container
docker run -p 3000:3000 sportazi
```

## 📊 Performance

### Optimizări Implementate
- **Image optimization** cu Next.js Image
- **Lazy loading** pentru articole
- **Caching** pentru API-uri externe
- **Preload fonts** pentru performanță
- **Minification** CSS și JS

### Metrici Țintă
- **LCP**: < 2.5s
- **FID**: < 100ms
- **CLS**: < 0.1
- **Lighthouse Score**: 90+

## 🤝 Contribuții

Contribuțiile sunt binevenite! Te rugăm să:

1. Fork repository-ul
2. Creează o branch nouă (`git checkout -b feature/amazing-feature`)
3. Commit schimbările (`git commit -m 'Add amazing feature'`)
4. Push pe branch (`git push origin feature/amazing-feature`)
5. Deschide un Pull Request

## 📄 Licență

Acest proiect este licențiat sub MIT License - vezi fișierul [LICENSE](LICENSE) pentru detalii.

## 🎯 Roadmap Viitor

### Q1 2025
- [ ] **PWA Support** cu offline functionality
- [ ] **Push Notifications** pentru breaking news
- [ ] **Dark Mode** toggle
- [ ] **Personalizare** feed-uri pe categorii

### Q2 2025
- [ ] **Comments System** cu moderare
- [ ] **Social Sharing** optimizat
- [ ] **Newsletter** integration
- [ ] **Analytics** dashboard

### Q3 2025
- [ ] **Mobile App** (React Native)
- [ ] **Live Streaming** integration
- [ ] **Podcast** support
- [ ] **Multi-language** support

---

**SportAzi.ro** - Știrile sportive care contează! 🏆

*Dezvoltat cu ❤️ pentru comunitatea sportivă din România*
