import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface Article {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  source_url?: string;
  pub_date: string;
  is_manual: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [importingRSS, setImportingRSS] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fetchRSS?page=1&limit=100');
      const data = await response.json();
      setArticles(data.articles);
    } catch (err) {
      setError('Eroare la încărcarea articolelor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (id: number) => {
    if (!confirm('Ești sigur că vrei să ștergi acest articol?')) {
      return;
    }

    setDeleting(id);
    
    try {
      const response = await fetch(`/api/article/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Eroare la ștergerea articolului');
      }

      // Actualizăm lista de articole după ștergere
      setArticles(articles.filter(article => article.id !== id));
    } catch (err) {
      console.error('Eroare la ștergerea articolului:', err);
      setError('Eroare la ștergerea articolului');
    } finally {
      setDeleting(null);
    }
  };

  const handleImportRSS = async () => {
    if (!confirm('Doriți să importați știri noi din sursele RSS (inclusiv DigiSport)?')) {
      return;
    }

    setImportingRSS(true);
    setImportResult(null);
    
    try {
      const response = await fetch('/api/importRSS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'secure_cron_key' // În producție, acest lucru ar trebui gestionat mai sigur
        }
      });

      if (!response.ok) {
        throw new Error('Eroare la importul știrilor');
      }

      const data = await response.json();
      setImportResult(data);
      
      // Reîncărcăm articolele după import
      fetchArticles();
    } catch (err) {
      console.error('Eroare la importul RSS:', err);
      setError('Eroare la importul știrilor din RSS');
    } finally {
      setImportingRSS(false);
    }
  };

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

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '20px',
  };

  const thStyle = {
    textAlign: 'left' as const,
    padding: '10px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f2f2f2',
  };

  const tdStyle = {
    padding: '10px',
    borderBottom: '1px solid #ddd',
  };

  const createButtonStyle = {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#0070f3',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    marginTop: '20px',
  };

  const actionButtonStyle = {
    padding: '5px 10px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    margin: '0 5px',
  };

  const viewButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#0070f3',
    color: 'white',
  };

  const deleteButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#e53e3e',
    color: 'white',
  };

  return (
    <div>
      <Head>
        <title>Administrare | NewsWeek</title>
        <meta name="description" content="Administrare articole" />
      </Head>

      <header style={headerStyle}>
        <nav style={navStyle}>
          <Link href="/">
            <div style={logoStyle}>NewsWeek</div>
          </Link>
          <div style={navLinksStyle}>
            <Link href="/" style={navLinkStyle}>
              Acasă
            </Link>
            <Link href="/admin/create-article" style={navLinkStyle}>
              Creare Articol
            </Link>
            <Link href="/admin/generate-news" style={navLinkStyle}>
              Generare Știri AI
            </Link>
          </div>
        </nav>
      </header>

      <main style={containerStyle}>
        <h1>Administrare articole</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <Link href="/admin/create-article" style={createButtonStyle}>
            Creează articol nou
          </Link>
          
          <Link href="/admin/generate-news" style={{
            ...createButtonStyle,
            backgroundColor: '#22c55e', // Verde pentru a diferenția de butonul de creare
          }}>
            Generare Știri AI
          </Link>
          
          <button 
            onClick={handleImportRSS} 
            disabled={importingRSS}
            style={{
              ...createButtonStyle,
              backgroundColor: '#3b82f6', // Albastru pentru importul RSS
              cursor: importingRSS ? 'not-allowed' : 'pointer',
              opacity: importingRSS ? 0.7 : 1,
              border: 'none'
            }}
          >
            {importingRSS ? 'Importare în curs...' : 'Importă RSS (inclusiv DigiSport)'}
          </button>
        </div>
        
        {importResult && (
          <div style={{ 
            marginTop: '15px',
            backgroundColor: '#efffef', 
            border: '1px solid #22c55e',
            borderRadius: '4px',
            padding: '10px',
            color: '#166534'
          }}>
            <p style={{ fontWeight: 'bold' }}>Import RSS Reușit:</p>
            <p>{importResult.message}</p>
          </div>
        )}
        
        {error && (
          <div style={{ color: 'red', marginTop: '20px' }}>
            {error}
          </div>
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            Se încarcă articolele...
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Titlu</th>
                <th style={thStyle}>Data publicării</th>
                <th style={thStyle}>Tip</th>
                <th style={thStyle}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id}>
                  <td style={tdStyle}>{article.id}</td>
                  <td style={tdStyle}>{article.title}</td>
                  <td style={tdStyle}>
                    {new Date(article.pub_date).toLocaleDateString('ro-RO', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={tdStyle}>
                    {article.is_manual ? 'Manual' : 'RSS'}
                  </td>
                  <td style={tdStyle}>
                    <Link href={`/article/${article.id}`}>
                      <button style={viewButtonStyle}>Vezi</button>
                    </Link>
                    
                    <button
                      style={deleteButtonStyle}
                      onClick={() => handleDeleteArticle(article.id)}
                      disabled={deleting === article.id}
                    >
                      {deleting === article.id ? 'Se șterge...' : 'Șterge'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
} 