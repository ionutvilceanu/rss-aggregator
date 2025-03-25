import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

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

  // Stiluri pentru layout și componente
  const headerStyle = {
    backgroundColor: '#0042FF', // Albastru similar cu golazo.ro
    color: 'white',
    padding: '1rem',
    marginBottom: '1rem',
  };

  const logoStyle = {
    fontSize: '1.5rem',
    fontWeight: 'bold' as const,
    color: 'white',
    display: 'inline-block',
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
    color: 'white',
    textDecoration: 'none',
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

  const imageStyle = {
    width: '100%',
    height: 'auto',
    objectFit: 'cover' as const,
    borderRadius: '4px',
  };

  const contentStyle = {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    color: '#333',
  };

  const sourceStyle = {
    marginTop: '2rem',
    padding: '1rem 0',
    borderTop: '1px solid #eee',
    color: '#0042FF',
    fontWeight: 'bold' as const,
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
        <title>{article.title}</title>
        <meta name="description" content={article.content.substring(0, 160)} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      {/* Header similar cu golazo.ro */}
      <header style={headerStyle}>
        <nav style={navStyle}>
          <Link href="/">
            <div style={logoStyle}>NewsWeek</div>
          </Link>
          <div style={navLinksStyle}>
            <Link href="/" style={navLinkStyle}>
              Acasă
            </Link>
            <Link href="/subscribe" style={navLinkStyle}>
              Abonare
            </Link>
          </div>
        </nav>
      </header>

      <main style={containerStyle}>
        <article>
          <header style={articleHeaderStyle}>
            <h1 style={titleStyle}>{article.title}</h1>
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
              <img
                src={article.image_url}
                alt={article.title}
                style={imageStyle}
              />
            </div>
          )}
          
          <div 
            style={contentStyle}
            dangerouslySetInnerHTML={{ __html: article.content }} 
          />
          
          {article.is_manual !== true && (
            <div style={sourceStyle}>
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Citește articolul original
              </a>
            </div>
          )}
        </article>
      </main>
    </div>
  );
} 