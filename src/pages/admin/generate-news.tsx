import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function GenerateNews() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [customDate, setCustomDate] = useState('2025-04-03');
  const [useCustomDate, setUseCustomDate] = useState(true);

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
        body: JSON.stringify({ 
          forceRefresh,
          customDate: useCustomDate ? customDate : null,
          enableWebSearch
        }),
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
        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/admin">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="AiSport Logo" className="h-8 w-auto" />
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
        <h1 className="text-3xl font-bold mb-4">Generare Știri cu AI</h1>
      </header>

      <main>
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Generare Știri Automată</h2>
          <p className="mb-4">
            Această funcție va genera articole noi și îmbunătățite pe baza ultimelor 5 știri din sursele RSS.
            Algoritmul AI va:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Citi și analiza <strong>titlul și conținutul complet</strong> al articolelor originale</li>
            <li>Extrage informațiile cheie și faptele importante</li>
            <li>Efectua cercetare adițională despre subiect</li>
            <li>Genera un articol complet rescris, bine structurat și informatv</li>
            <li>Adăuga context și detalii relevante suplimentare</li>
            <li className="font-semibold text-green-700">Păstra actualitatea și referințele temporale din articolul original</li>
            {enableWebSearch && (
              <li className="font-semibold text-blue-700">Efectua căutări web pentru informații recente și context adițional</li>
            )}
          </ul>
          <p className="mb-6">
            Fiecare articol va avea minim 500 de cuvinte și va fi structurat cu introducere, cuprins detaliat
            și concluzie, folosind un stil jurnalistic profesionist.
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="forceRefresh"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="mr-2 h-5 w-5 text-blue-600"
              />
              <label htmlFor="forceRefresh" className="text-sm font-medium">
                Forțează reîmprospătarea (va regenera articole chiar dacă au fost procesate anterior)
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableWebSearch"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
                className="mr-2 h-5 w-5 text-blue-600"
              />
              <label htmlFor="enableWebSearch" className="text-sm font-medium">
                Activează căutarea web pentru informații actuale
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="useCustomDate"
                checked={useCustomDate}
                onChange={(e) => setUseCustomDate(e.target.checked)}
                className="mr-2 h-5 w-5 text-blue-600"
              />
              <label htmlFor="useCustomDate" className="text-sm font-medium mr-4">
                Folosește data personalizată:
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                disabled={!useCustomDate}
                className={`px-2 py-1 border rounded ${!useCustomDate ? 'bg-gray-100 text-gray-500' : ''}`}
              />
            </div>
          </div>

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