import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Cookies from 'js-cookie';

interface Article {
  id: number;
  title: string;
  pub_date: string;
  image: string;
  content: string;
  source?: string;
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

const ArticleCard = ({ article, onSelect, isSelected }: { article: Article; onSelect: () => void; isSelected: boolean }) => {
  const [imageError, setImageError] = useState(false);

  // Funcție pentru curățarea titlurilor articolelor
  const cleanTitle = (title: string) => {
    return title.replace(/^\*\*/, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
  };

  // Determină sursa imaginii bazată pe URL
  let imgSrc = article.image;
  
  // Dacă imaginea este URL extern, folosește proxy-ul
  if (imgSrc && (imgSrc.startsWith('http://') || imgSrc.startsWith('https://'))) {
    imgSrc = `/api/proxy-image?url=${encodeURIComponent(imgSrc)}`;
  }

  return (
    <div 
      className={`border rounded-lg p-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
      onClick={onSelect}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold mb-2">{cleanTitle(article.title)}</h3>
        <p className="text-sm text-gray-500 mb-2">{new Date(article.pub_date).toLocaleDateString('ro-RO')}</p>
        
        {article.source && <p className="text-xs text-gray-400 mb-2">Sursa: {article.source}</p>}
        
        {imgSrc && !imageError && (
          <div className="relative h-32 mt-auto overflow-hidden rounded">
            <img 
              src={imgSrc} 
              alt={article.title}
              className="object-cover w-full h-full"
              onError={() => setImageError(true)}
            />
          </div>
        )}
        
        {imageError && (
          <div className="relative h-32 mt-auto bg-gray-100 flex items-center justify-center rounded">
            <p className="text-sm text-gray-500">Imagine indisponibilă</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function GenerateReels() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [reelImage, setReelImage] = useState<string | null>(null);
  const [reelVideo, setReelVideo] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoEffect, setVideoEffect] = useState('fade');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  // Stiluri pentru pagină
  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  };

  const headerStyle = {
    padding: '1rem 0',
    borderBottom: '1px solid #f0f0f0',
    marginBottom: '1rem',
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
    color: '#333',
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '1.5rem',
  };

  const navLinkStyle = {
    color: '#333',
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
        // Pentru imagini, folosim fie image (dacă există), fie imaginea implicită pentru articolele manuale
        const articlesForReels = data.articles.map((article: Article) => {
          // Curățăm titlul
          article.title = cleanTitle(article.title);
          
          // Adăugăm o imagine implicită pentru articolele fără imagine
          if (!article.image || article.image.trim() === '') {
            if (article.source && article.source.includes('digisport')) {
              // Pentru DigiSport, încercăm să folosim imaginea lor dacă este disponibilă
              article.image = 'https://s.iw.ro/gateway/g/ZmlsZVNvdXJjZT1odHRwJTNBJTJGJTJG/c3RvcmFnZTA3dHJhbnNjb2Rlci5yY3Mt/cmRzLnJvJTJGc3RvcmFnZSUyRjIwMjIl/MkYwNyUyRjA3JTJGMTUxNzE5MV8xNTE3/MTkxX2RpZ2lzcG9ydC1nb2xhLWxvZ28t/Z2VuZXJpYy0xOTIweDEwODAuanBn/Jm1heF93aWR0aD0xMjgw/digisport-gola-logo-generic-1920x1080.jpg';
            } else if (article.source && article.source.includes('gazzetta')) {
              // Pentru Gazzetta
              article.image = 'https://via.placeholder.com/1080x1920/00CCBB/FFFFFF?text=Gazzetta+Sport';
            } else {
              // Pentru alte surse
              article.image = 'https://via.placeholder.com/1080x1920/FF4400/FFFFFF?text=Sport+News';
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

  // Funcție pentru a crea un reel simplu colorat când toate imaginile eșuează
  const createSimpleColorReel = (canvas: HTMLCanvasElement | null, article: Article | null, customText: string) => {
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

    // Dimensiunile reelului
    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // Gradient complex pentru fundal
    const gradient = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, width);
    gradient.addColorStop(0, '#0042FF');
    gradient.addColorStop(1, '#001C6D');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Adaugă text
    const text = customText || (article ? article.title : 'AiSport News');
    
    // Font mai modern și profesional
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    
    // Adaugă umbră pentru text pentru lizibilitate mai bună
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Împarte textul în linii pentru a se potrivi pe canvas
    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    const lines = wrapText(text, width - 100);
    const lineHeight = 85;
    const totalTextHeight = lines.length * lineHeight;
    
    // Poziționează textul în centrul canvas-ului
    let y = (height - totalTextHeight) / 2;
    lines.forEach(line => {
      ctx.fillText(line, width / 2, y);
      y += lineHeight;
    });

    // Logo AiSport
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.fillText('AiSport', width / 2, height - 100);
    
    // Adaugă un banner decorativ la partea de sus
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 80, width, 10);
    
    // Adaugă un banner decorativ la partea de jos
    ctx.fillRect(0, height - 150, width, 10);

    // Sursă articol
    if (article && article.source) {
      ctx.font = '32px Arial, sans-serif';
      ctx.fillText('Sursa: ' + article.source, width / 2, height - 60);
    }

    // Transformă canvas în URL de imagine
    const reelImageUrl = canvas.toDataURL('image/jpeg', 0.9);
    setReelImage(reelImageUrl);
    setGenerating(false);
  };

  // Procesează imaginea pentru a crea reel-ul
  const procesareReelCuImagine = (defaultImg: HTMLImageElement) => {
    try {
      // Setăm canvas-ul
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

      // Calculează dimensiunile pentru a acoperi întregul canvas
      // păstrând raportul de aspect
      const imgRatio = defaultImg.width / defaultImg.height;
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
      
      try {
        ctx.drawImage(defaultImg, offsetX, offsetY, renderWidth, renderHeight);
        
        // Adaugă un gradient overlay pentru design mai profesional
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Adaugă și un mic overlay color brand
        ctx.fillStyle = 'rgba(0, 66, 255, 0.3)'; // Albastru brand subtil
        ctx.fillRect(0, 0, width, height);
        
        // Adaugă un banner decorativ la partea de sus
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(0, 80, width, 10);
        
        // Adaugă un banner decorativ la partea de jos
        ctx.fillRect(0, height - 150, width, 10);
        
        // Adaugă textul articolului
        const text = customText || (selectedArticle ? selectedArticle.title : 'AiSport News');
        
        // Font modern și profesional
        ctx.font = 'bold 72px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        
        // Adaugă umbră pentru text pentru lizibilitate mai bună pe fundal de imagine
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Împarte textul în linii pentru a se potrivi pe canvas
        const wrapText = (text: string, maxWidth: number) => {
          const words = text.split(' ');
          const lines = [];
          let currentLine = words[0];

          for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
              currentLine += ' ' + word;
            } else {
              lines.push(currentLine);
              currentLine = word;
            }
          }
          lines.push(currentLine);
          return lines;
        };

        const lines = wrapText(text, width - 100);
        const lineHeight = 85;
        const totalTextHeight = lines.length * lineHeight;
        
        // Poziționează textul în centrul canvas-ului
        let y = (height - totalTextHeight) / 2;
        lines.forEach(line => {
          ctx.fillText(line, width / 2, y);
          y += lineHeight;
        });

        // Logo AiSport
        ctx.font = 'bold 48px Arial, sans-serif';
        ctx.fillText('AiSport', width / 2, height - 100);
        
        // Sursă articol dacă există
        if (selectedArticle && selectedArticle.source) {
          ctx.font = '32px Arial, sans-serif';
          ctx.fillText('Sursa: ' + selectedArticle.source, width / 2, height - 60);
        }

        // Transformă canvas în URL de imagine
        const reelImageUrl = canvas.toDataURL('image/jpeg', 0.9);
        setReelImage(reelImageUrl);
        setGenerating(false);
      } catch (error) {
        console.error('Eroare la desenarea imaginii pe canvas:', error);
        // Dacă desenarea imaginii eșuează, folosim un fundal colorat simplu
        createSimpleColorReel(canvas, selectedArticle, customText || '');
      }
    } catch (error) {
      console.error('Eroare la procesarea imaginii:', error);
      setError('Eroare la procesarea imaginii. Vă rugăm încercați cu alt articol.');
      setGenerating(false);
    }
  };

  // Generează un reel pentru articolul selectat
  const generateReel = async () => {
    if (!selectedArticle) {
      setError('Selectează un articol pentru a genera un reel.');
      return;
    }

    if (!selectedArticle.image) {
      setError('Articolul selectat nu are o imagine asociată. Alege alt articol sau contactează administratorul.');
      return;
    }

    setGenerating(true);
    setError(null);
    
    // Afișăm un mesaj în consolă pentru debugging
    console.log('Se începe generarea reelului pentru articolul:', cleanTitle(selectedArticle.title));
    console.log('URL imagine original:', selectedArticle.image);

    try {
      // Încarcă imaginea
      const img = new window.Image();
      img.crossOrigin = 'anonymous'; // Încercăm să permitem CORS, dar nu va funcționa pentru toate imaginile
      
      // Detectăm dacă e un URL extern sau unul generat intern
      let imageUrl = selectedArticle.image;
      
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
        procesareReelCuImagine(img);
      };

      // Definim handler-ul pentru erori de încărcare
      img.onerror = () => {
        console.error('Eroare la încărcarea imaginii:', imageUrl);
        console.log('Se încearcă utilizarea unei imagini default de calitate...');

        // În loc să afișăm eroare, vom folosi o imagine default de sport de înaltă calitate
        const sportImages = [
          '/images/sport/football.jpg',
          '/images/sport/basketball.jpg',
          '/images/sport/tennis.jpg',
          '/images/sport/swimming.jpg',
          '/images/sport/athletics.jpg',
          '/images/sport/default_sport.jpg'
        ];

        // Folosește un index aleatoriu pentru a selecta o imagine random din array
        const randomIndex = Math.floor(Math.random() * sportImages.length);
        const fallbackImagePath = sportImages[randomIndex];

        // Verifică dacă imaginea aleatorie există, dacă nu, folosește o imagine placeholder
        const fallbackImg = new window.Image();
        fallbackImg.crossOrigin = 'anonymous';
        fallbackImg.src = fallbackImagePath;

        fallbackImg.onload = () => {
          // Dacă imaginea aleatorie de sport s-a încărcat cu succes, o folosim
          procesareReelCuImagine(fallbackImg);
        };

        fallbackImg.onerror = () => {
          // Dacă și imaginea de sport eșuează, folosim un placeholder din serviciul extern
          const placeholderImg = new window.Image();
          placeholderImg.crossOrigin = 'anonymous';
          placeholderImg.src = `https://source.unsplash.com/1080x1920/?sport,${selectedArticle?.title.split(' ')[0] || 'sports'}`;
          
          placeholderImg.onload = () => {
            // Dacă imaginea de la Unsplash s-a încărcat cu succes, o folosim
            procesareReelCuImagine(placeholderImg);
          };
          
          placeholderImg.onerror = () => {
            // Dacă chiar și imaginea de la Unsplash eșuează, folosim fundal simplu colorat
            createSimpleColorReel(canvasRef.current, selectedArticle, customText || '');
          };
        };
      };
    } catch (error) {
      console.error('Eroare la încărcarea imaginii:', error);
      setError(`Eroare la încărcarea imaginii: ${error}`);
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

  // Funcție pentru generarea videoclipului TikTok folosind API-ul server
  const generateVideo = async () => {
    if (!reelImage) {
      setError('Generează mai întâi imaginea pentru reel');
      return;
    }

    setProcessingVideo(true);
    setError(null);

    try {
      // În loc să folosim FFmpeg.wasm în browser, apelăm API-ul nostru
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: reelImage,
          effect: videoEffect,
          duration: videoDuration
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la generarea video');
      }

      // Setăm URL-ul video returnat de server
      setReelVideo(data.videoUrl);
      
    } catch (error) {
      console.error('Eroare la generarea videoclipului:', error);
      setError(`Eroare la generarea videoclipului: ${error}`);
    } finally {
      setProcessingVideo(false);
    }
  };

  // Funcție pentru descărcarea videoclipului
  const handleVideoDownload = () => {
    if (!reelVideo) return;
    
    // Creem un element anchor pentru a declanșa descărcarea
    const link = document.createElement('a');
    
    // Verificăm dacă URL-ul este un blob URL sau o cale către server
    if (reelVideo.startsWith('blob:')) {
      // Dacă e un blob URL (versiunea veche), îl folosim direct
      link.href = reelVideo;
    } else {
      // Dacă e o cale către server, folosim URL-ul complet
      link.href = reelVideo;
    }
    
    // Setăm numele fișierului
    link.download = `tiktok-reel-${selectedArticle?.id || 'newsweek'}.mp4`;
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
          <div style={logoStyle}>
            <Link href="/admin" style={{ textDecoration: 'none', color: '#333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/logo.svg" alt="AiSport Logo" style={{ height: '30px', width: 'auto' }} />
                <span>Panou Administrare</span>
              </div>
            </Link>
          </div>
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
                    <ArticleCard 
                      key={article.id}
                      article={article}
                      onSelect={() => {
                        setSelectedArticle(article);
                        setCustomText(cleanTitle(article.title)); // Precompletează textul custom cu titlul curat
                        setReelImage(null); // Resetează imaginea reel-ului când se schimbă articolul
                      }}
                      isSelected={selectedArticle?.id === article.id}
                    />
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
                      border: '1px solid #ccc',
                      minHeight: '100px',
                      resize: 'vertical',
                      marginBottom: '15px'
                    }}
                    placeholder="Introdu textul personalizat pentru reel sau lasă gol pentru a folosi titlul articolului"
                  />
                  
                  <div style={{ marginBottom: '20px' }}>
                    <button 
                      onClick={generateReel} 
                      disabled={generating}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#0066ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: generating ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        width: '100%'
                      }}
                    >
                      {generating ? 'Generare în curs...' : 'Generează Reel'}
                    </button>
                  </div>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                  <h3>Previzualizare:</h3>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    
                    {reelImage && (
                      <div style={{ 
                        textAlign: 'center', 
                        marginBottom: '20px',
                        border: '1px solid #ddd',
                        padding: '10px',
                        borderRadius: '4px'
                      }}>
                        <img 
                          src={reelImage} 
                          alt="Previzualizare Reel" 
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '500px', 
                            marginBottom: '10px',
                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                        
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button 
                            onClick={handleDownload}
                            style={{
                              padding: '8px 15px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Descarcă Imagine
                          </button>
                          
                          <button 
                            onClick={generateVideo}
                            disabled={processingVideo}
                            style={{
                              padding: '8px 15px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: processingVideo ? 'not-allowed' : 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            {processingVideo ? 'Procesare video...' : 'Generează Video TikTok'}
                          </button>
                        </div>

                        {/* Opțiuni video */}
                        <div style={{ 
                          marginTop: '20px', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                          padding: '15px',
                          backgroundColor: '#f9fafb' 
                        }}>
                          <h4 style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Opțiuni video:</h4>
                          
                          <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                              Durată (secunde):
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input 
                                type="range" 
                                min="3" 
                                max="15" 
                                value={videoDuration}
                                onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                                style={{ flex: 1 }}
                              />
                              <span style={{ 
                                minWidth: '30px', 
                                textAlign: 'center',
                                fontWeight: 'bold' 
                              }}>
                                {videoDuration}s
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                              Efect:
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {['fade', 'zoom', 'slideUp', 'slideRight', 'pulse'].map((effect) => (
                                <button
                                  key={effect}
                                  onClick={() => setVideoEffect(effect)}
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: videoEffect === effect ? '#3b82f6' : '#e5e7eb',
                                    color: videoEffect === effect ? 'white' : '#374151',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                  }}
                                >
                                  {effect === 'fade' && 'Estompare'}
                                  {effect === 'zoom' && 'Zoom'}
                                  {effect === 'slideUp' && 'Glisare Sus'}
                                  {effect === 'slideRight' && 'Glisare Dreapta'}
                                  {effect === 'pulse' && 'Pulsare'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {reelVideo && (
                      <div style={{ 
                        textAlign: 'center', 
                        marginTop: '20px',
                        border: '1px solid #ddd',
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: '#f9fafb'
                      }}>
                        <h4>Video TikTok generat:</h4>
                        <video 
                          src={reelVideo} 
                          controls
                          autoPlay
                          loop
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '500px',
                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        
                        <div style={{ marginTop: '15px' }}>
                          <button 
                            onClick={handleVideoDownload}
                            style={{
                              padding: '8px 15px',
                              backgroundColor: '#6366f1',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Descarcă Video
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #ddd' }}>
                <p>Te rugăm să selectezi un articol din lista din stânga pentru a genera un reel.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 