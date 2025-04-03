import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { getCookie } from 'cookies-next';

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
  const headerStyle = {
    padding: '1rem',
    marginBottom: '1rem',
    borderBottom: '1px solid #f0f0f0',
  };

  const logoStyle = {
    cursor: 'pointer',
  };

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '1rem',
  };

  const navLinkStyle = {
    color: '#333',
    textDecoration: 'none',
    fontWeight: 'medium',
  };

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

      {/* Header cu design minimalist */}
      <header style={headerStyle}>
        <nav style={navStyle}>
          <Link href="/">
            <div style={logoStyle}>
              <img src="/logo.svg" alt="AiSport Logo" style={{ height: '40px', width: 'auto' }} />
            </div>
          </Link>
          <div style={navLinksStyle}>
            <Link href="/" style={navLinkStyle}>
              Acasă
            </Link>
            <Link href="/subscribe" style={navLinkStyle}>
              Abonare
            </Link>
            {isAdmin && (
              <Link href="/admin" style={navLinkStyle}>
                Admin
              </Link>
            )}
          </div>
        </nav>
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
    </div>
  );
} 