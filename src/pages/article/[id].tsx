import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

interface Article {
  id: number;
  title: string;
  content: string;
  image_url: string;
  source_url: string;
  pub_date: string;
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

  if (loading) return <div className="container mx-auto p-4">Se încarcă...</div>;
  if (error) return <div className="container mx-auto p-4">Eroare: {error}</div>;
  if (!article) return <div className="container mx-auto p-4">Articolul nu a fost găsit</div>;

  return (
    <div>
      <Head>
        <title>{article.title}</title>
        <meta name="description" content={article.content.substring(0, 160)} />
      </Head>

      <main className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
        
        {article.image_url && (
          <div className="mb-4">
            <img
              src={article.image_url}
              alt={article.title}
              className="max-w-full h-auto rounded"
            />
          </div>
        )}
        
        <div className="mb-4">
          <p className="text-gray-600">
            {new Date(article.pub_date).toLocaleDateString()}
          </p>
        </div>
        
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: article.content }} />
        
        <div className="mt-4">
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Sursa originală
          </a>
        </div>
      </main>
    </div>
  );
} 