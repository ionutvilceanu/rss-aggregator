import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { getCookie } from 'cookies-next';

// Funcție utilitară pentru curățarea titlurilor
function cleanTitle(title: string): string {
  if (!title) return '';
  
  // Elimină ** și alte caractere speciale de la începutul și sfârșitul titlului
  let cleanedTitle = title.replace(/^\*\*+\s*/, ''); // Elimină ** de la început
  cleanedTitle = cleanedTitle.replace(/\s*\*\*+$/, ''); // Elimină ** de la sfârșit
  
  // Elimină ghilimelele HTML entities (&quot;)
  cleanedTitle = cleanedTitle.replace(/&quot;/g, '"');
  
  // Elimină caracterele HTML entities
  cleanedTitle = cleanedTitle.replace(/&amp;/g, '&');
  cleanedTitle = cleanedTitle.replace(/&lt;/g, '<');
  cleanedTitle = cleanedTitle.replace(/&gt;/g, '>');
  
  return cleanedTitle.trim();
}

// Funcție pentru formatarea conținutului de articol
function formatArticleContent(content: string): string {
  if (!content) return '';
  
  // Pasul 1: Curăță entitățile HTML
  let formattedContent = content.replace(/&quot;/g, '"')
                               .replace(/&amp;/g, '&')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>');
  
  // Pasul 2: Elimină toate ** de la începutul paragrafelor
  formattedContent = formattedContent.replace(/\*\*+\s*/g, '');
  
  // Pasul 3: Caută referința la final și o separă
  const referenceRegex = /(\*\*Referință:\*\*|\*\*Referinta:\*\*|Referință:|Referinta:|Sursă:|Sursa:|Această știre este din|Aceasta știre este din)(.+)$/i;
  let reference = '';
  
  const referenceMatch = formattedContent.match(referenceRegex);
  if (referenceMatch) {
    reference = referenceMatch[0];
    formattedContent = formattedContent.replace(referenceRegex, '');
  }
  
  // Pasul 4: Împarte conținutul în propoziții
  const sentences = formattedContent.split(/(?<=[.!?])\s+/g).filter(s => s.trim().length > 0);
  
  // Pasul 5: Grupează propozițiile în paragrafe
  const paragraphs: string[] = [];
  let currentParagraph = '';
  let sentenceCount = 0;
  const maxSentencesPerParagraph = 3;
  
  sentences.forEach((sentence, index) => {
    // Începe un paragraf nou dacă:
    // 1. Fraza este un citat (începe și se termină cu ghilimele)
    // 2. Fraza conține un început de citat (așa cum ar fi într-un interviu)
    // 3. Am atins numărul maxim de propoziții per paragraf
    // 4. Fraza conține markeri specifici de schimbare a subiectului
    
    const isCitation = (sentence.trim().startsWith('"') && sentence.trim().endsWith('"')) || 
                       (sentence.trim().startsWith('„') && sentence.trim().endsWith('"'));
    const hasQuoteMarker = sentence.includes(':"') || sentence.includes('":') || 
                          sentence.includes(': "') || sentence.includes('" :') ||
                          sentence.includes('spus:') || sentence.includes('declarat:');
    const isNewSubject = sentence.includes('În altă ordine de idei') || 
                        sentence.includes('Pe de altă parte') ||
                        sentence.includes('Între timp') ||
                        sentence.includes('Cu toate acestea');
    
    // Dacă avem deja un paragraf și întâlnim un motiv să începem unul nou
    if (currentParagraph && (isCitation || hasQuoteMarker || sentenceCount >= maxSentencesPerParagraph || isNewSubject)) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = '';
      sentenceCount = 0;
    }
    
    // Adaugă fraza la paragraful curent
    currentParagraph += sentence + ' ';
    sentenceCount++;
    
    // Dacă e ultima propoziție, adaugă paragraful
    if (index === sentences.length - 1 && currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }
  });
  
  // Pasul 6: Creează conținutul HTML formatat
  let htmlContent = '';
  
  paragraphs.forEach((paragraph, index) => {
    const trimmedParagraph = paragraph.trim();
    
    // Verifică dacă e un citat
    if ((trimmedParagraph.startsWith('"') && trimmedParagraph.endsWith('"')) ||
        (trimmedParagraph.startsWith('„') && trimmedParagraph.endsWith('"'))) {
      htmlContent += `<blockquote>${trimmedParagraph}</blockquote>`;
    } 
    // Paragraf normal
    else {
      htmlContent += `<p>${trimmedParagraph}</p>`;
    }
  });
  
  // Adaugă referința dacă există
  if (reference) {
    htmlContent += `<p class="article-reference"><em>${reference.replace(/\*\*/g, '')}</em></p>`;
  }
  
  return htmlContent;
}

interface Article {
  id: number;
  title: string;
  content: string;
  image_url: string;
  source_url: string;
  pub_date: string;
  is_manual?: boolean;
}

export default function ArticlePage() {
  const router = useRouter();
  const { id } = router.query;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Verifică dacă utilizatorul este admin
  useEffect(() => {
    const authToken = getCookie('auth-token');
    setIsAdmin(authToken === 'admin-session-token');
  }, []);

  useEffect(() => {
    if (!id) return;

    async function fetchArticle() {
      try {
        const res = await fetch(`/api/article/${id}`);
        if (!res.ok) {
          throw new Error('Eroare la preluarea articolului');
        }
        const data = await res.json();
        setArticle(data);
      } catch (err) {
        setError('Eroare la preluarea articolului');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchArticle();
  }, [id]);

  const handleDeleteArticle = async () => {
    if (!confirm('Ești sigur că vrei să ștergi acest articol?')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/article/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      if (!response.ok) {
        throw new Error('Nu s-a putut șterge articolul');
      }
      
      // Redirecționăm către pagina principală după ștergere
      router.push('/');
    } catch (err) {
      console.error('Eroare la ștergerea articolului:', err);
      setError('Nu s-a putut șterge articolul');
      setIsDeleting(false);
    }
  };

  // Stiluri pentru layout și componente
  const containerStyle = {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 1rem',
  };

  const articleHeaderStyle = {
    marginBottom: '1.5rem',
  };

  const titleStyle = {
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    marginBottom: '1rem',
    lineHeight: '1.2',
  };

  const dateStyle = {
    color: '#666',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  };

  const imageContainerStyle = {
    marginBottom: '1.5rem',
    position: 'relative' as const,
    width: '100%',
  };

  const contentStyle = {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    color: '#333',
  };

  const blockquoteStyle = `
    blockquote {
      font-style: italic;
      border-left: 4px solid #0042FF;
      padding-left: 20px;
      margin: 20px 0;
      color: #555;
    }
    
    .article-reference {
      font-size: 0.9rem;
      color: #666;
      margin-top: 30px;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }
    
    p {
      margin-bottom: 1.5rem;
      text-align: justify;
    }
    
    p:first-of-type:first-letter {
      font-size: 3rem;
      font-weight: bold;
      float: left;
      margin-right: 8px;
      line-height: 1;
      color: #0042FF;
    }
  `;

  const sourceStyle = {
    marginTop: '2rem',
    padding: '1rem 0',
    borderTop: '1px solid #eee',
    color: '#0042FF',
    fontWeight: 'bold' as const,
  };

  const deleteButtonStyle = {
    backgroundColor: '#e53e3e',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontSize: '1rem',
    marginTop: '1rem',
  };

  if (loading) return (
    <div style={containerStyle}>
      <div style={{padding: '2rem', textAlign: 'center' as const}}>Se încarcă...</div>
    </div>
  );
  
  if (error) return (
    <div style={containerStyle}>
      <div style={{padding: '2rem', textAlign: 'center' as const}}>Eroare: {error}</div>
    </div>
  );
  
  if (!article) return (
    <div style={containerStyle}>
      <div style={{padding: '2rem', textAlign: 'center' as const}}>Articolul nu a fost găsit</div>
    </div>
  );

  return (
    <div>
      <Head>
        <title>{cleanTitle(article.title)}</title>
        <meta name="description" content={article.content.substring(0, 160)} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{blockquoteStyle}</style>
      </Head>

      {/* Header modern profesional */}
      <header className="main-header">
        <div className="header-container">
          <div className="brand-section">
          <Link href="/" className="brand-logo">
              <div className="logo-container">
                <Image
                  src="/logo.png"
                  alt="SportAzi.ro Logo"
                  width={45}
                  height={45}
                  priority
                  className="logo-image"
                />
                <div className="brand-text">
                  <span className="brand-name">SportAzi</span>
                  <span className="brand-domain">.ro</span>
                </div>
              </div>
            </Link>
            <span className="brand-tagline">Știri Sportive de Ultimă Oră</span>
          </div>

          <nav className="main-navigation">
            <Link href="/" className="nav-link">Acasă</Link>
            <Link href="/subscribe" className="nav-link">Abonare</Link>
            {isAdmin && (
              <Link href="/admin" className="nav-link">Admin</Link>
            )}
          </nav>

          <div className="header-actions">
            <div className="live-indicator">
              <span className="live-dot"></span>
              <span className="live-text">LIVE</span>
            </div>
            <div className="current-time">
              {new Date().toLocaleTimeString('ro-RO', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        </div>
      </header>

      <main style={containerStyle}>
        <article>
          <header style={articleHeaderStyle}>
            <h1 style={titleStyle}>{cleanTitle(article.title)}</h1>
            <p style={dateStyle}>
              Publicat: {new Date(article.pub_date).toLocaleDateString('ro-RO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </header>
          
          {article.image_url && (
            <div style={imageContainerStyle}>
              <Image
                src={article.image_url}
                alt={cleanTitle(article.title)}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '400px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                }}
                width={1000}
                height={600}
                priority
              />
            </div>
          )}
          
          <div 
            style={contentStyle}
            dangerouslySetInnerHTML={{ __html: formatArticleContent(article.content) }} 
          />
          
          {article.is_manual !== true && (
            <div style={sourceStyle}>
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Sursă: {article.source_url.split('/')[2]}
              </a>
            </div>
          )}

          {/* Adaugă butonul de ștergere doar pentru admin */}
          {isAdmin && (
            <button 
              onClick={handleDeleteArticle} 
              disabled={isDeleting}
              style={deleteButtonStyle}
            >
              {isDeleting ? 'Se șterge...' : 'Șterge Articolul'}
            </button>
          )}
        </article>
      </main>

      <style jsx>{`
        .main-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }

        .main-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
          pointer-events: none;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .brand-logo {
          display: block;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s ease;
          text-decoration: none;
        }

        .brand-logo:hover {
          transform: scale(1.05);
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .logo-image {
          border-radius: 8px;
        }

        .brand-text {
          display: flex;
          align-items: baseline;
          gap: 0;
        }

        .brand-name {
          font-size: 1.8rem;
          font-weight: 800;
          color: white;
          letter-spacing: -0.02em;
          transition: color 0.3s ease;
        }

        .brand-domain {
          font-size: 1.8rem;
          font-weight: 800;
          color: #ffd700;
          letter-spacing: -0.02em;
        }

        .brand-tagline {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
          margin-left: 1rem;
        }

        .main-navigation {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .nav-link {
          color: white;
          text-decoration: none;
          font-weight: 600;
          font-size: 1rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.3s ease;
          position: relative;
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 0, 0, 0.9);
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 700;
          animation: pulse 2s infinite;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
          animation: blink 1s infinite;
        }

        .live-text {
          color: white;
        }

        .current-time {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .header-container {
            padding: 0 1rem;
            flex-direction: column;
            gap: 1rem;
          }

          .brand-section {
            justify-content: center;
          }

          .brand-name {
            font-size: 1.5rem;
          }

          .main-navigation {
            gap: 1rem;
          }

          .nav-link {
            font-size: 0.9rem;
            padding: 0.4rem 0.8rem;
          }

          .header-actions {
            gap: 1rem;
          }

          .current-time {
            font-size: 0.9rem;
            padding: 0.4rem 0.8rem;
          }
        }

        @media (max-width: 480px) {
          .brand-name {
            font-size: 1.3rem;
          }

          .brand-tagline {
            font-size: 0.75rem;
          }

          .main-navigation {
            flex-wrap: wrap;
            justify-content: center;
          }

          .nav-link {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
} 