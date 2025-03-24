import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Head from 'next/head';

// Pagină care redirecționează la [id].tsx cu ID-ul obținut din API
export default function ArticleRedirect() {
  const router = useRouter();
  const { url } = router.query;

  useEffect(() => {
    if (!url) return;

    const fetchArticleByUrl = async () => {
      try {
        const res = await fetch(`/api/article?url=${encodeURIComponent(url as string)}`);
        if (!res.ok) {
          throw new Error('Eroare la preluarea articolului');
        }
        const data = await res.json();
        
        // Redirecționează către pagina articolului cu ID-ul obținut
        if (data && data.id) {
          router.replace(`/article/${data.id}`);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchArticleByUrl();
  }, [url, router]);

  return (
    <div>
      <Head>
        <title>Se încarcă articolul...</title>
      </Head>
      <div className="container mx-auto p-4">
        <p>Se încarcă articolul...</p>
      </div>
    </div>
  );
} 