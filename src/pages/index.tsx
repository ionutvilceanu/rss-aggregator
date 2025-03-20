import Head from 'next/head';
import { useEffect, useState } from 'react';
import NewsItem from '../components/NewsItem';

export default function Home() {
  const [articles, setArticles] = useState([]);

  // Fetch articole
  useEffect(() => {
    async function fetchArticles() {
      const res = await fetch('/api/fetchRSS');
      const data = await res.json();
      setArticles(data);
    }
    fetchArticles();
  }, []);

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
        <h1 style={titleStyle}>Flux de Știri</h1>

        <div style={gridStyle}>
          {articles.map((article, index) => (
            <NewsItem key={index} article={article} />
          ))}
        </div>
      </main>
    </div>
  );
}
