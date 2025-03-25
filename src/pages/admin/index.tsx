import Head from 'next/head';
import Link from 'next/link';

export default function AdminPage() {
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

  const sectionStyle = {
    marginBottom: '2rem',
    padding: '1.5rem',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  const buttonStyle = {
    display: 'inline-block',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#0042FF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    textDecoration: 'none',
    marginTop: '1rem',
  };

  return (
    <div>
      <Head>
        <title>Administrare NewsWeek</title>
        <meta name="description" content="Panoul de administrare pentru site-ul de știri" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      {/* Header similar cu restul site-ului */}
      <header style={headerStyle}>
        <nav style={navStyle}>
          <Link href="/">
            <div style={logoStyle}>NewsWeek</div>
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
        <h1>Panou Administrare</h1>
        <p>Bine ați venit în panoul de administrare. Utilizați opțiunile de mai jos pentru a gestiona conținutul site-ului.</p>

        <section style={sectionStyle}>
          <h2>Gestionare Articole</h2>
          <p>Aici puteți crea, edita și șterge articole.</p>
          <Link href="/admin/create-article" style={buttonStyle}>
            Creează Articol Nou
          </Link>
        </section>

        <section style={sectionStyle}>
          <h2>Întreținere Bază de Date</h2>
          <p>Actualizați structura bazei de date pentru a asigura compatibilitatea cu noile funcții.</p>
          <button 
            style={buttonStyle} 
            onClick={() => {
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
            Actualizează Baza de Date
          </button>
        </section>

        <section style={sectionStyle}>
          <h2>Setări Site</h2>
          <p>Gestionați setările generale ale site-ului.</p>
          <Link href="/admin/settings" style={buttonStyle}>
            Setări
          </Link>
        </section>
      </main>
    </div>
  );
} 