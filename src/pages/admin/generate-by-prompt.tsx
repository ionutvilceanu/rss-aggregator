import { useState, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaCheck, FaSpinner, FaExclamationCircle, FaSearch } from 'react-icons/fa';

export default function GenerateByPrompt() {
  const [prompt, setPrompt] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Opțiuni adiționale
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [searchQueries, setSearchQueries] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const handleGenerateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('Promptul este obligatoriu');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);
      
      // Transformăm query-urile în array, dacă sunt furnizate
      const queryArray = enableWebSearch && searchQueries.trim() 
        ? searchQueries.split('\n').filter(q => q.trim().length > 0)
        : [];
        
      const response = await fetch('/api/generateNewsByPrompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          title: customTitle.trim() || undefined,
          enableWebSearch,
          searchQueries: queryArray,
          imageUrl: imageUrl.trim() || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la generarea articolului');
      }

      setResult(data);
      // Resetăm formularul dacă generarea a avut succes
      if (formRef.current) {
        // Nu resetăm complet pentru a păstra promptul și alte setări
      }
    } catch (err: any) {
      setError(err.message || 'A apărut o eroare la generarea articolului');
      console.error('Eroare:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Generează Articol din Prompt</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <form ref={formRef} onSubmit={handleGenerateArticle} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Prompt pentru AI*
              </label>
              <textarea
                id="prompt"
                name="prompt"
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Introdu promptul pentru generarea articolului..."
                required
              />
            </div>
            
            <div>
              <label htmlFor="customTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Titlu personalizat (opțional)
              </label>
              <input
                type="text"
                id="customTitle"
                name="customTitle"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Lasă gol pentru a folosi titlul generat de AI"
              />
            </div>
            
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                URL Imagine (opțional)
              </label>
              <input
                type="url"
                id="imageUrl"
                name="imageUrl"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL către imaginea articolului"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableWebSearch"
                name="enableWebSearch"
                checked={enableWebSearch}
                onChange={() => setEnableWebSearch(!enableWebSearch)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enableWebSearch" className="ml-2 block text-sm text-gray-700">
                Activează căutarea web
              </label>
            </div>
            
            {enableWebSearch && (
              <div>
                <label htmlFor="searchQueries" className="block text-sm font-medium text-gray-700 mb-1">
                  Query-uri pentru căutare web (unul pe linie)
                </label>
                <textarea
                  id="searchQueries"
                  name="searchQueries"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQueries}
                  onChange={(e) => setSearchQueries(e.target.value)}
                  placeholder="Introdu query-uri pentru căutare, unul pe linie"
                />
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" /> Se generează...
                  </>
                ) : (
                  <>
                    Generează Articol
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex items-center">
              <FaExclamationCircle className="text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}
        
        {result && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <div className="flex items-center mb-2">
              <FaCheck className="text-green-500 mr-2" />
              <p className="text-green-700 font-medium">Articol generat cu succes!</p>
            </div>
            
            <div className="mt-4">
              <h3 className="font-bold text-xl mb-2">{result.article.title}</h3>
              <div className="prose max-w-none mt-3">
                {result.article.content.split('\n').map((paragraph: string, i: number) => (
                  <p key={i} className="mb-2">{paragraph}</p>
                ))}
              </div>
              
              <div className="mt-6 flex justify-between">
                <Link 
                  href={`/admin/articles`}
                  className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                >
                  Vezi toate articolele
                </Link>
                
                <p className="text-sm text-gray-500">
                  ID: {result.article.id}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
} 