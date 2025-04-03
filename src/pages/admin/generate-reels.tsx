import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';

interface Article {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  source_url?: string;
  pub_date: string;
  is_manual?: boolean;
}

// Funcție utilitară pentru curățarea titlurilor
function cleanTitle(title: string): string {
  if (!title) return '';
  
  // Elimină ** și alte caractere speciale de la începutul titlului
  let cleanedTitle = title.replace(/^\*\*+\s*/, '');
  
  // Elimină ghilimelele HTML entities (&quot;)
  cleanedTitle = cleanedTitle.replace(/&quot;/g, '"');
  
  // Elimină caracterele HTML entities
  cleanedTitle = cleanedTitle.replace(/&amp;/g, '&');
  cleanedTitle = cleanedTitle.replace(/&lt;/g, '<');
  cleanedTitle = cleanedTitle.replace(/&gt;/g, '>');
  
  return cleanedTitle.trim();
}

export default function GenerateReels() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [reelImage, setReelImage] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  // Stiluri pentru pagină
  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  };

  const headerStyle = {
    backgroundColor: '#0042FF',
    color: 'white',
    padding: '1rem 0',
  };

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
  };

  const logoStyle = {
    fontSize: '1.5rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '1.5rem',
  };

  const navLinkStyle = {
    color: 'white',
    textDecoration: 'none',
  };

  const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  };

  const articleCardStyle = {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    margin: '10px 0',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  };

  const selectedArticleCardStyle = {
    ...articleCardStyle,
    borderColor: '#0070f3',
    backgroundColor: '#f0f7ff',
  };

  const reelContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
  };

  const handleLogout = async () => {
    if (confirm('Ești sigur că vrei să te deloghezi?')) {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          // Redirecționează către pagina de login după delogare
          router.push('/login');
        }
      } catch (err) {
        console.error('Eroare la delogare:', err);
      }
    }
  };

  // Încarcă articolele
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/fetchRSS?page=1&limit=50');
        const data = await response.json();
        
        // Afișăm în consolă pentru debugging
        console.log('Date primite de la server:', data);
        console.log('Număr total articole:', data.articles.length);
        
        // Filtrează articolele pentru reel
        // Pentru imagini, folosim fie image_url (dacă există), fie imaginea implicită pentru articolele manuale
        const articlesForReels = data.articles.map((article: Article) => {
          // Curățăm titlul
          article.title = cleanTitle(article.title);
          
          // Adăugăm o imagine implicită pentru articolele fără imagine
          if (!article.image_url || article.image_url.trim() === '') {
            if (article.is_manual) {
              // Pentru articolele manuale, folosim o imagine implicită
              article.image_url = 'https://via.placeholder.com/1080x1920/0042FF/FFFFFF?text=AiSport';
            } else if (article.source_url && article.source_url.includes('digisport')) {
              // Pentru DigiSport, încercăm să folosim imaginea lor dacă este disponibilă
              article.image_url = 'https://s.iw.ro/gateway/g/ZmlsZVNvdXJjZT1odHRwJTNBJTJGJTJG/c3RvcmFnZTA3dHJhbnNjb2Rlci5yY3Mt/cmRzLnJvJTJGc3RvcmFnZSUyRjIwMjIl/MkYwNyUyRjA3JTJGMTUxNzE5MV8xNTE3/MTkxX2RpZ2lzcG9ydC1nb2xhLWxvZ28t/Z2VuZXJpYy0xOTIweDEwODAuanBn/Jm1heF93aWR0aD0xMjgw/digisport-gola-logo-generic-1920x1080.jpg';
            } else if (article.source_url && article.source_url.includes('gazzetta')) {
              // Pentru Gazzetta
              article.image_url = 'https://via.placeholder.com/1080x1920/00CCBB/FFFFFF?text=Gazzetta+Sport';
            } else {
              // Pentru alte surse
              article.image_url = 'https://via.placeholder.com/1080x1920/FF4400/FFFFFF?text=Sport+News';
            }
          }
          return article;
        });
        
        // Acum afișăm toate articolele, pentru că toate au o imagine (fie originală, fie implicită)
        setArticles(articlesForReels);
        
        console.log('Articole pentru reeluri:', articlesForReels.length);
      } catch (err) {
        console.error('Eroare la încărcarea articolelor:', err);
        setError('Eroare la încărcarea articolelor. Încearcă din nou.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // Generează un reel pentru articolul selectat
  const generateReel = async () => {
    if (!selectedArticle) {
      setError('Selectează un articol pentru a genera un reel.');
      return;
    }

    if (!selectedArticle.image_url) {
      setError('Articolul selectat nu are o imagine asociată. Alege alt articol sau contactează administratorul.');
      return;
    }

    setGenerating(true);
    setError(null);
    
    // Afișăm un mesaj în consolă pentru debugging
    console.log('Se începe generarea reelului pentru articolul:', cleanTitle(selectedArticle.title));
    console.log('URL imagine original:', selectedArticle.image_url);

    try {
      // Încarcă imaginea
      const img = document.createElement('img') as HTMLImageElement;
      img.crossOrigin = 'anonymous'; // Încercăm să permitem CORS, dar nu va funcționa pentru toate imaginile
      
      // Detectăm dacă e un URL extern sau unul generat intern
      let imageUrl = selectedArticle.image_url;
      
      // Verificăm dacă URL-ul imaginii este de la un provider extern și folosim proxy-ul nostru
      if (imageUrl && (imageUrl.includes('http://') || imageUrl.includes('https://'))) {
        try {
          // Pentru imagini externe, folosim proxy-ul nostru pentru a evita CORS
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
          console.log('Folosim proxy pentru imaginea externă:', proxyUrl);
          imageUrl = proxyUrl;
        } catch (error) {
          console.error('Eroare la crearea URL-ului de proxy:', error);
          // Folosim o imagine placeholder în caz de eroare
          imageUrl = `https://via.placeholder.com/1080x1920/0042FF/FFFFFF?text=${encodeURIComponent('AiSport - ' + cleanTitle(selectedArticle.title).substring(0, 20))}`;
        }
      } else if (!imageUrl || imageUrl.trim() === '') {
        // Dacă nu avem imagine, folosim un placeholder
        imageUrl = `https://via.placeholder.com/1080x1920/0042FF/FFFFFF?text=${encodeURIComponent('AiSport - ' + cleanTitle(selectedArticle.title).substring(0, 20))}`;
      }
      
      img.src = imageUrl;
      console.log('Se încarcă imaginea de la:', imageUrl);

      // Definim handler-ul pentru încărcarea cu succes a imaginii
      img.onload = () => {
        console.log('Imagine încărcată cu succes, dimensiuni:', img.width, 'x', img.height);
        
        // Configurează canvas-ul pentru reel
        const canvas = canvasRef.current;
        if (!canvas) {
          setError('Eroare internă: canvas-ul nu este disponibil');
          setGenerating(false);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Eroare internă: contextul canvas-ului nu este disponibil');
          setGenerating(false);
          return;
        }

        // Dimensiunile reelului (raport 9:16 ca pe TikTok)
        const width = 1080;
        const height = 1920;
        canvas.width = width;
        canvas.height = height;

        // Calculează dimensiunile imaginii pentru a acoperi întregul canvas,
        // păstrând raportul de aspect
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        
        let renderWidth, renderHeight, offsetX, offsetY;
        
        if (imgRatio > canvasRatio) {
          // Imaginea e mai lată decât canvas-ul
          renderHeight = height;
          renderWidth = height * imgRatio;
          offsetX = (width - renderWidth) / 2;
          offsetY = 0;
        } else {
          // Imaginea e mai înaltă decât canvas-ul
          renderWidth = width;
          renderHeight = width / imgRatio;
          offsetX = 0;
          offsetY = (height - renderHeight) / 2;
        }

        // Umple background-ul cu negru
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        // Desenează imaginea
        try {
          ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
        } catch (err) {
          console.error('Eroare la desenarea imaginii în canvas:', err);
          setError('Eroare la procesarea imaginii. Vă rugăm încercați cu alt articol sau contactați administratorul.');
          setGenerating(false);
          return;
        }

        // Adaugă un overlay semi-transparent
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);

        // Pregătește textul
        const rawText = customText || selectedArticle.title;
        const text = cleanTitle(rawText);
        
        // Stilizează și poziționează textul
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Font mare pentru textul principal
        ctx.font = 'bold 80px Arial';
        
        // Împarte textul în linii pentru a se încadra în lățimea canvas-ului
        const maxLineWidth = width * 0.8;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxLineWidth) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // Desenează liniile de text
        const lineHeight = 100;
        const totalTextHeight = lines.length * lineHeight;
        let textY = (height - totalTextHeight) / 2;
        
        lines.forEach(line => {
          ctx.fillText(line, width / 2, textY);
          textY += lineHeight;
        });
        
        // Adaugă logo-ul sau marca de apă
        ctx.font = '40px Arial';
        ctx.fillText('AiSport', width / 2, height - 100);
        
        // Convertește canvas-ul în URL de imagine
        try {
          setReelImage(canvas.toDataURL('image/jpeg', 0.9));
        } catch (err) {
          console.error('Eroare la convertirea canvas-ului în imagine:', err);
          setError('Eroare la generarea imaginii finale. Probabil imaginea originală nu poate fi procesată din cauza restricțiilor CORS.');
          setGenerating(false);
          return;
        }
        
        setGenerating(false);
      };

      // Definim handler-ul pentru erori de încărcare
      img.onerror = () => {
        console.error('Eroare la încărcarea imaginii:', imageUrl);
        setError(`Eroare la încărcarea imaginii pentru articolul: ${cleanTitle(selectedArticle.title)}

Acest lucru se poate întâmpla din următoarele motive:
1. URL-ul imaginii nu mai este valid
2. Site-ul sursei nu permite accesul la imagine
3. Imaginea are restricții CORS

Încearcă alt articol sau contactează administratorul.`);
        setGenerating(false);
      };

    } catch (err) {
      console.error('Eroare la generarea reel-ului:', err);
      setError('Eroare la generarea reel-ului. Încearcă din nou.');
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!reelImage) return;
    
    const link = document.createElement('a');
    link.href = reelImage;
    link.download = `reel-${selectedArticle?.id || 'newsweek'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <Head>
        <title>Generator Reeluri | NewsWeek</title>
        <meta name="description" content="Generator de reeluri din știri" />
      </Head>

      <header style={headerStyle}>
        <nav style={navStyle}>
          <div style={logoStyle}>Panou Administrare</div>
          <div style={navLinksStyle}>
            <Link href="/" style={navLinkStyle}>
              Acasă
            </Link>
            <Link href="/admin" style={navLinkStyle}>
              Dashboard
            </Link>
            <Link href="/admin/create-article" style={navLinkStyle}>
              Creare articol
            </Link>
            <Link href="/admin/generate-news" style={navLinkStyle}>
              Generare știri
            </Link>
            <button 
              onClick={handleLogout} 
              style={{
                ...navLinkStyle, 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: '4px',
                backgroundColor: '#e53e3e'
              }}
            >
              Delogare
            </button>
          </div>
        </nav>
      </header>

      <main style={containerStyle}>
        <h1>Generator Reeluri TikTok</h1>
        
        {error && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#b91c1c', 
            padding: '15px', 
            borderRadius: '4px',
            marginBottom: '20px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Eroare:</div>
            {error}
            
            {error.includes('Eroare la încărcarea imaginii') && (
              <div style={{ marginTop: '15px', fontSize: '0.9em', backgroundColor: '#fff1f2', padding: '10px', borderRadius: '4px' }}>
                <strong>Informație:</strong> Serviciul nostru folosește un proxy pentru a încărca imagini de la surse externe. 
                Uneori, acest lucru poate eșua din cauza blocării sau a restricțiilor CORS impuse de site-urile sursă.
                <br/><br/>
                Poți încerca:
                <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                  <li>Selectează un alt articol</li>
                  <li>Reîncarcă pagina și încearcă din nou</li>
                  <li>Dacă articolul e important, salvează imaginea local pe calculatorul tău și apoi urcă-o manual în sistem</li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '30px' }}>
          {/* Secțiunea de selectare a articolelor */}
          <div style={{ width: '50%' }}>
            <h2>Selectează un articol</h2>
            
            {loading ? (
              <p>Se încarcă articolele...</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {articles.length === 0 ? (
                  <div>
                    <p>Nu s-au găsit articole pentru reeluri.</p>
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                      Aceasta poate fi din următoarele motive:
                      <ul>
                        <li>Nu există articole în baza de date</li>
                        <li>Server-ul nu a răspuns corect la cererea de date</li>
                        <li>A apărut o eroare la procesarea articolelor</li>
                      </ul>
                      Încearcă să adaugi articole noi sau să reîmprospătezi pagina.
                    </p>
                  </div>
                ) : (
                  articles.map(article => (
                    <div 
                      key={article.id}
                      style={selectedArticle?.id === article.id ? selectedArticleCardStyle : articleCardStyle}
                      onClick={() => {
                        setSelectedArticle(article);
                        setCustomText(cleanTitle(article.title)); // Precompletează textul custom cu titlul curat
                        setReelImage(null); // Resetează imaginea reel-ului când se schimbă articolul
                      }}
                    >
                      <h3>{cleanTitle(article.title)}</h3>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        {new Date(article.pub_date).toLocaleDateString('ro-RO')}
                      </p>
                      {article.image_url && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ position: 'relative', width: '100%', height: '100px', overflow: 'hidden', borderRadius: '4px' }}>
                            <img 
                              src={article.image_url.includes('http') 
                                ? `/api/proxy-image?url=${encodeURIComponent(article.image_url)}` 
                                : article.image_url}
                              alt={article.title}
                              style={{ 
                                width: '100%', 
                                height: '100px',
                                objectFit: 'cover',
                                objectPosition: 'center'
                              }}
                              onError={(e) => {
                                // Înlocuiește imaginea cu un placeholder în caz de eroare
                                const target = e.target as HTMLImageElement;
                                target.onerror = null; // Previne bucle infinite
                                target.src = `https://via.placeholder.com/300x100/0042FF/FFFFFF?text=${encodeURIComponent('AiSport - Imagine lipsă')}`;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Secțiunea de generare și previzualizare a reel-ului */}
          <div style={{ width: '50%' }}>
            <h2>Generare Reel</h2>
            
            {selectedArticle ? (
              <div style={reelContainerStyle}>
                <div>
                  <label htmlFor="customText" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Text Personalizat:
                  </label>
                  <textarea
                    id="customText"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      minHeight: '100px',
                      resize: 'vertical'
                    }}
                    placeholder="Introdu textul care va apărea pe reel..."
                  />
                </div>
                
                <button 
                  onClick={generateReel}
                  style={generating ? disabledButtonStyle : buttonStyle}
                  disabled={generating}
                >
                  {generating ? 'Se generează...' : 'Generează Reel'}
                </button>
                
                {reelImage && (
                  <div style={{ textAlign: 'center' }}>
                    <h3>Previzualizare:</h3>
                    <div style={{ 
                      maxWidth: '100%', 
                      maxHeight: '600px',
                      overflow: 'hidden',
                      margin: '10px 0',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}>
                      <img 
                        src={reelImage} 
                        alt="Reel generat" 
                        style={{ 
                          maxWidth: '100%',
                          height: 'auto'
                        }} 
                      />
                    </div>
                    
                    <button
                      onClick={handleDownload}
                      style={{
                        ...buttonStyle,
                        backgroundColor: '#10b981',
                        margin: '10px 0'
                      }}
                    >
                      Descarcă Reel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p>Selectează un articol din lista din stânga pentru a genera un reel.</p>
            )}
          </div>
        </div>
        
        {/* Canvas ascuns folosit pentru generarea imaginii */}
        <canvas 
          ref={canvasRef} 
          style={{ display: 'none' }}
        />
      </main>
    </div>
  );
} 