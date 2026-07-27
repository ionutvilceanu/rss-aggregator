import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function GenerateNews() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [count, setCount] = useState(5);

  const handleGenerateNews = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/generateNews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh, count }),
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
        <meta name="description" content="Panou de generare a știrilor sport folosind AI" />
      </Head>

      <header className="mb-8">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/admin">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="SportAzi Logo" className="h-8 w-auto" />
                <span className="text-xl font-bold">Panou Administrare</span>
              </div>
            </Link>
            <div className="flex gap-4">
              <Link href="/admin" className="text-gray-700 hover:text-blue-600">
                &larr; Înapoi la Admin
              </Link>
              <Link href="/" className="text-gray-700 hover:text-blue-600">
                Pagina principală
              </Link>
            </div>
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-4">Generare Știri Sport cu AI</h1>
      </header>

      <main>
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Generare automată din surse live</h2>
          <p className="mb-4">
            Sistemul caută subiecte sportive actuale din feed-uri RSS românești și internaționale
            (DigiSport, GSP, ProSport, Google News Sport, Marca, ESPN etc.), apoi generează articole
            originale cu OpenRouter AI, bazate pe faptele din surse.
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Agregare automată din 9+ surse RSS sport</li>
            <li>Context real din snippet-uri și titluri de știri</li>
            <li>Articole în română, 400-600 cuvinte, ton jurnalistic</li>
            <li>Anti-duplicare: nu regenerează subiecte procesate în ultimele 48h</li>
          </ul>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4">
              <label htmlFor="count" className="text-sm font-medium">
                Număr articole:
              </label>
              <select
                id="count"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="px-2 py-1 border rounded"
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="forceRefresh"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="mr-2 h-5 w-5 text-blue-600"
              />
              <label htmlFor="forceRefresh" className="text-sm font-medium">
                Forțează regenerarea (ignoră deduplicarea)
              </label>
            </div>
          </div>

          <button
            onClick={handleGenerateNews}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Se generează articole...' : `Generează ${count} Știri Sport`}
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

            {result.skipped?.length > 0 && (
              <p className="mt-2 text-sm">Sărite (duplicate): {result.skipped.join(', ')}</p>
            )}
            {result.errors?.length > 0 && (
              <p className="mt-2 text-sm text-orange-700">Erori: {result.errors.join('; ')}</p>
            )}

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
