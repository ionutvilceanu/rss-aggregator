import Head from 'next/head';
import { useEffect, useState } from 'react';
import NewsItem from '../components/NewsItem';
import Link from 'next/link';

interface Article {
  id?: number;
  title: string;
  link: string;
  pubDate: string;
  image?: string;
  content: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: 15, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch articole pentru pagina curentă
  const fetchArticles = async (page: number = 1) => {
    try {
      const isLoadingMore = page > 1;
      if (isLoadingMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const res = await fetch(`/api/fetchRSS?page=${page}&limit=${pagination.limit}`);
      const data = await res.json();
      
      if (isLoadingMore) {
        // Adaugă noile articole la cele existente
        setArticles(prevArticles => [...prevArticles, ...data.articles]);
      } else {
        // Înlocuiește articolele existente
        setArticles(data.articles);
      }
      
      setPagination(data.pagination);
    } catch (error) {
      console.error('Eroare la încărcarea articolelor:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Încarcă prima pagină de articole
  useEffect(() => {
    fetchArticles();
  }, []);

  // Handler pentru butonul "Încarcă mai multe"
  const handleLoadMore = () => {
    if (pagination.page < pagination.pages && !loadingMore) {
      fetchArticles(pagination.page + 1);
    }
  };

  // Stiluri inline pentru container, titlu și grilă
  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px',
  };

  const titleStyle = {
    fontSize: '32px',
    fontWeight: 'bold' as const,
    marginBottom: '16px',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px',
  };

  const buttonStyle = {
    display: 'block',
    margin: '24px auto',
    padding: '10px 20px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
  };

  return (
    <div>
      <Head>
        <title>RSS Aggregator</title>
        <meta
          name="description"
          content="Agregator de fluxuri RSS pentru știri sportive"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={containerStyle}>
        <h1 style={titleStyle}>NewsWeek</h1>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            Se încarcă știrile...
          </div>
        ) : (
          <>
            <div style={gridStyle}>
              {articles.map((article, index) => (
                <NewsItem key={index} article={article} />
              ))}
            </div>

            {pagination.page < pagination.pages && (
              <button 
                style={buttonStyle} 
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Se încarcă...' : 'Încarcă mai multe știri'}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
