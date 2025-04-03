import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function GenerateNews() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateNews = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/generateNews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la generarea știrilor');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Generare Știri - Admin</title>
        <meta name="description" content="Panou de generare a știrilor folosind AI" />
      </Head>

      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Generare Știri cu AI</h1>
        <nav className="mb-6">
          <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
            &larr; Înapoi la Admin
          </Link>
          <Link href="/" className="text-blue-500 hover:text-blue-700">
            Pagina principală
          </Link>
        </nav>
      </header>

      <main>
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Generare Știri Automată</h2>
          <p className="mb-4">
            Această funcție va genera noi articole bazate pe ultimele 5 știri din baza de date folosind modelul Llama prin API-ul Groq.
            Fiecare articol va fi rescris cu o perspectivă jurnalistică și va include cercetare adițională despre subiect.
          </p>

          <button
            onClick={handleGenerateNews}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Se procesează...' : 'Generează Știri Noi'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Eroare:</p>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Succes:</p>
            <p>{result.message}</p>
            
            {result.articles && result.articles.length > 0 && (
              <div className="mt-4">
                <h3 className="font-bold mb-2">Articole generate:</h3>
                <ul className="list-disc pl-5">
                  {result.articles.map((article: any) => (
                    <li key={article.id} className="mb-2">
                      <Link href={`/article/${article.id}`} className="text-blue-500 hover:underline">
                        {article.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
} 