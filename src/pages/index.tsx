import Head from 'next/head';
import { useEffect, useState } from 'react';
import NewsItem from '../components/NewsItem';

const Home = () => {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const fetchArticles = async () => {
      const res = await fetch('/api/fetchRSS');
      const data = await res.json();
      setArticles(data);
    };
    fetchArticles();
  }, []);

  return (
    <div>
      <Head>
        <title>RSS Aggregator</title>
        <meta name="description" content="Agregator de fluxuri RSS pentru știri sportive" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto p-4">
        <h1 className="text-4xl font-bold mb-4">Flux de Știri</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(articles) && articles.map((article, index) => (
            <NewsItem key={index} article={article} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home; 