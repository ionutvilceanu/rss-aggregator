import { useState, useRef } from 'react';
import Head from 'next/head';
// Comentat temporar useRouter deoarece nu este folosit în această componentă
// import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';

export default function CreateArticle() {
  // const router = useRouter(); // Comentat temporar - va fi folosit pentru redirecționare dacă este necesar
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    imageUrl: '',
    sourceUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastCreatedArticleId, setLastCreatedArticleId] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      imageUrl: value,
    }));
    
    // Actualizăm preview-ul când se schimbă URL-ul
    if (value) {
      setImagePreview(value);
    } else {
      setImagePreview(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Creăm un URL temporar pentru preview
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    // În acest stadiu, doar păstrăm fișierul în memorie pentru a-l încărca
    // mai târziu când formularul este trimis
    setSelectedFile(file);
    
    // Resetăm câmpul imageUrl când se încarcă un fișier
    setFormData((prev) => ({
      ...prev,
      imageUrl: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let finalImageUrl = formData.imageUrl;

      // Dacă avem un fișier selectat, îl încărcăm mai întâi
      if (selectedFile) {
        const formDataForUpload = new FormData();
        formDataForUpload.append('file', selectedFile);

        try {
          // Teoretic, aici ar trebui să existe un endpoint pentru încărcarea imaginilor
          // În practică, poți folosi un serviciu precum Cloudinary sau similar
          // În acest caz, presupunem că avem un endpoint /api/upload
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formDataForUpload,
          });

          if (!uploadResponse.ok) {
            throw new Error('Eroare la încărcarea imaginii');
          }

          const uploadData = await uploadResponse.json();
          finalImageUrl = uploadData.url; // URL-ul imaginii după încărcare
        } catch (uploadError: Error | unknown) {
          const errorMessage = uploadError instanceof Error 
            ? uploadError.message 
            : 'Eroare necunoscută';
          setError('Eroare la încărcarea imaginii: ' + errorMessage);
          setLoading(false);
          return;
        }
      }

      // Acum trimitem datele articolului cu URL-ul imaginii (dacă există)
      const response = await fetch('/api/article/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          imageUrl: finalImageUrl, // Folosim URL-ul imaginii încărcate sau valoarea directă
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Eroare la crearea articolului');
      }

      const newArticle = await response.json();
      setSuccess(true);
      setLastCreatedArticleId(newArticle.id);
      
      // Resetăm formularul după creare
      setFormData({
        title: '',
        content: '',
        imageUrl: '',
        sourceUrl: '',
      });
      setImagePreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Opțional: redirecționăm către pagina articolului creat
      // router.push(`/article/${newArticle.id}`);
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'A apărut o eroare la crearea articolului';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Stiluri pentru pagină
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
    fontWeight: 'bold',
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

  const containerStyle = {
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '0 1rem',
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  };

  const inputGroupStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  };

  const labelStyle = {
    fontWeight: 'bold',
  };

  const inputStyle = {
    padding: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '1rem',
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '250px',
    fontFamily: 'inherit',
  };

  const buttonStyle = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#0042FF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  };

  const errorStyle = {
    color: 'red',
    marginTop: '1rem',
  };

  const successStyle = {
    color: 'green',
    marginTop: '1rem',
  };

  const imagePreviewStyle = {
    marginTop: '1rem',
    maxWidth: '100%',
    height: 'auto',
    maxHeight: '300px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  };

  const fileInputContainerStyle = {
    marginTop: '1rem',
  };

  return (
    <div>
      <Head>
        <title>Creare Articol Nou</title>
        <meta name="description" content="Adaugă un articol nou manual" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      {/* Header similar cu golazo.ro */}
      <header style={headerStyle}>
        <nav style={navStyle}>
          <Link href="/">
            <div style={logoStyle}>AiSport</div>
          </Link>
          <div style={navLinksStyle}>
            <Link href="/" style={navLinkStyle}>
              Acasă
            </Link>
            <Link href="/subscribe" style={navLinkStyle}>
              Abonare
            </Link>
          </div>
        </nav>
      </header>

      <main style={containerStyle}>
        <h1>Creare Articol Nou</h1>
        <p>Folosește acest formular pentru a adăuga manual un articol nou. Articolele create manual vor apărea primele în pagina principală.</p>

        {/* Link pentru actualizarea bazei de date */}
        <div style={{ marginBottom: '1rem' }}>
          <a
            href="/api/alter-table"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0042FF',
              textDecoration: 'underline',
              fontSize: '0.9rem',
            }}
            onClick={(e) => {
              e.preventDefault();
              fetch('/api/alter-table')
                .then(response => response.json())
                .then(data => {
                  alert('Baza de date a fost actualizată: ' + data.message);
                })
                .catch(err => {
                  alert('Eroare la actualizarea bazei de date: ' + err.message);
                });
            }}
          >
            Actualizează baza de date înainte de a crea articole
          </a>
        </div>

        {success && (
          <div style={successStyle}>
            <p>Articolul a fost creat cu succes!</p>
            {/* Link pentru a vedea articolul creat */}
            <div style={{ marginTop: '0.5rem' }}>
              <a
                href={`/article/${lastCreatedArticleId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#0042FF',
                  textDecoration: 'underline',
                }}
              >
                Vezi articolul creat
              </a>
            </div>
          </div>
        )}

        {error && (
          <div style={errorStyle}>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={inputGroupStyle}>
            <label htmlFor="title" style={labelStyle}>
              Titlu *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              style={inputStyle}
              placeholder="Titlul articolului"
            />
          </div>

          <div style={inputGroupStyle}>
            <label htmlFor="content" style={labelStyle}>
              Conținut *
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              style={textareaStyle}
              placeholder="Scrieți conținutul articolului aici..."
            />
          </div>

          <div style={inputGroupStyle}>
            <label htmlFor="imageUrl" style={labelStyle}>
              URL Imagine
            </label>
            <input
              type="url"
              id="imageUrl"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleImageUrlChange}
              style={inputStyle}
              placeholder="https://example.com/image.jpg"
            />
            
            <div style={fileInputContainerStyle}>
              <p>sau încarcă o imagine:</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </div>

            {imagePreview && (
              <div style={{ marginTop: '1rem' }}>
                <p>Preview imagine:</p>
                {imagePreview.startsWith('blob:') ? (
                  // Pentru URL-uri de tip blob (fișiere locale) folosim img normal
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      maxHeight: '300px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                ) : (
                  // Pentru URL-uri externe folosim Image din Next.js
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={300}
                    height={300}
                    style={imagePreviewStyle}
                  />
                )}
              </div>
            )}
          </div>

          <div style={inputGroupStyle}>
            <label htmlFor="sourceUrl" style={labelStyle}>
              URL Sursă
            </label>
            <input
              type="url"
              id="sourceUrl"
              name="sourceUrl"
              value={formData.sourceUrl}
              onChange={handleChange}
              style={inputStyle}
              placeholder="https://example.com/article"
            />
          </div>

          <button
            type="submit"
            style={buttonStyle}
            disabled={loading}
          >
            {loading ? 'Se creează...' : 'Creează Articol'}
          </button>
        </form>
      </main>
    </div>
  );
} 