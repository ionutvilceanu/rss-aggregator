// pages/index.tsx
import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import NewsItem from '../components/NewsItem';
import Link from 'next/link';
import Image from 'next/image';
import { getCookie } from 'cookies-next';

interface Article {
  id?: number;
  title: string;
  link: string;
  pubDate: string;
  image?: string;
  content: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: 15, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const authToken = getCookie('auth-token');
    setIsAdmin(authToken === 'admin-session-token');
    
    // Update clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchArticles = useCallback(async (page: number = 1) => {
    try {
      page > 1 ? setLoadingMore(true) : setLoading(true);
      const res = await fetch(`/api/fetchRSS?page=${page}&limit=${pagination.limit}`);
      const data = await res.json();
      if (page > 1) setArticles(prev => [...prev, ...data.articles]);
      else setArticles(data.articles);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pagination.limit]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const tickerText = articles.length
    ? articles.map(a => a.title).join('  •  ')
    : 'Se încarcă știrile sportive de ultimă oră…';

  const featuredArticles = articles.slice(0, 3);
  const regularArticles = articles.slice(3);

  return (
    <>
      <Head>
        <title>SportAzi.ro – Știri Sportive de Ultimă Oră | Fotbal, Tenis, Formula 1</title>
        <meta name="description" content="Cele mai importante știri sportive din România și străinătate. Fotbal, tenis, baschet, Formula 1 și multe altele. Actualizat în timp real." />
        <meta name="keywords" content="sport, știri sportive, fotbal, tenis, baschet, Formula 1, Liga 1, Champions League" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Professional Header */}
      <header className="professional-header">
        <div className="header-background"></div>
        <nav className="main-navigation">
          <div className="nav-wrapper">
            <Link href="/" className="brand-logo">
              <div className="logo-container">
                <Image
                  src="/logo.png"
                  alt="SportAzi.ro Logo"
                  width={45}
                  height={45}
                  priority
                  className="logo-image"
                />
                <div className="brand-text">
                  <span className="brand-name">SportAzi</span>
                  <span className="brand-domain">.ro</span>
                </div>
              </div>
            </Link>
            
            <div className="header-center">
              <div className="status-indicators">
                <div className="live-status">
                  <div className="live-dot"></div>
                  <span className="live-label">LIVE</span>
                </div>
                <div className="current-time">
                  {currentTime.toLocaleTimeString('ro-RO', { 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>

            <div className="header-actions">
              {isAdmin && (
                <Link href="/admin" className="admin-access">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                  Admin
                </Link>
              )}
              <button className="mobile-menu">
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </div>
        </nav>

        {/* News Ticker */}
        <div className="news-ticker">
          <div className="ticker-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            BREAKING NEWS
          </div>
          <div className="ticker-wrapper">
            <div className="ticker-content">{tickerText}</div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content-area">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
              <div className="loading-message">Se încarcă știrile sportive...</div>
            </div>
          </div>
        ) : (
          <>
            {/* Featured Stories Section */}
            {featuredArticles.length > 0 && (
              <section className="featured-stories">
                <div className="section-header">
                  <h2 className="section-title">
                    <div className="title-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9 17 14.74 18.18 21.02 12 17.77 5.82 21.02 7 14.74 2 9 8.91 8.26 12 2"/>
                      </svg>
                    </div>
                    Știri de Top
                  </h2>
                </div>
                <div className="featured-layout">
                  {featuredArticles.map((article, index) => (
                    <div key={index} className={`featured-item ${index === 0 ? 'primary-story' : 'secondary-story'}`}>
                      <NewsItem article={article} featured={true} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All Articles Section */}
            <section className="all-articles">
              <div className="section-header">
                <h2 className="section-title">
                  <div className="title-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                  </div>
                  Toate Știrile
                </h2>
              </div>
              <div className="articles-layout">
                {regularArticles.map((article, i) => (
                  <NewsItem key={i} article={article} />
                ))}
              </div>
              
              {pagination.page < pagination.pages && (
                <div className="load-more-section">
                  <button
                    className="load-more-button"
                    onClick={() => fetchArticles(pagination.page + 1)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <div className="button-spinner"></div>
                        Se încarcă...
                      </>
                    ) : (
                      <>
                        <span>Încarcă mai multe știri</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Professional Footer */}
      <footer className="site-footer">
        <div className="footer-wrapper">
          <div className="footer-brand">
            <div className="footer-logo">
              <Image
                src="/logo.png"
                alt="SportAzi.ro"
                width={32}
                height={32}
                className="footer-logo-image"
              />
              <span className="footer-brand-text">SportAzi.ro</span>
            </div>
            <p className="footer-tagline">Știrile sportive care contează</p>
          </div>
          <div className="footer-details">
            <p>&copy; 2024 SportAzi.ro - Toate drepturile rezervate</p>
            <p>Actualizat în timp real din surse verificate</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #fafbfc;
          color: #1a202c;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Professional Header */
        .professional-header {
          position: relative;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          z-index: 100;
        }

        .header-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20" fill="white" opacity="0.05"><circle cx="10" cy="10" r="1"/><circle cx="30" cy="10" r="1"/><circle cx="50" cy="10" r="1"/><circle cx="70" cy="10" r="1"/><circle cx="90" cy="10" r="1"/></svg>') repeat;
        }

        .main-navigation {
          position: relative;
          z-index: 10;
          padding: 0.75rem 0;
        }

        .nav-wrapper {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0;
        }

        .brand-logo {
          text-decoration: none;
          color: white;
          margin-left: 1rem;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-image {
          border-radius: 6px;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
        }

        .brand-text {
          display: flex;
          align-items: baseline;
        }

        .brand-name {
          font-size: 1.5rem;
          font-weight: 800;
          color: white;
          font-family: 'Poppins', sans-serif;
          letter-spacing: -0.02em;
        }

        .brand-domain {
          font-size: 0.9rem;
          color: #ffd700;
          font-weight: 600;
          margin-left: 2px;
        }

        .header-center {
          display: flex;
          align-items: center;
        }

        .status-indicators {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .live-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.15);
          padding: 0.4rem 0.8rem;
          border-radius: 16px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: #ff4757;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(255, 71, 87, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
        }

        .live-label {
          color: white;
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
        }

        .current-time {
          color: white;
          font-weight: 600;
          font-size: 0.85rem;
          font-family: 'Inter', monospace;
          background: rgba(255, 255, 255, 0.1);
          padding: 0.4rem 0.8rem;
          border-radius: 10px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-right: 1rem;
        }

        .admin-access {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.6rem 1rem;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.8rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .admin-access:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .mobile-menu {
          display: none;
          flex-direction: column;
          gap: 3px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
        }

        .mobile-menu span {
          width: 18px;
          height: 2px;
          background: white;
          border-radius: 1px;
          transition: all 0.3s ease;
        }

        /* News Ticker */
        .news-ticker {
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          height: 40px;
          overflow: hidden;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ticker-badge {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 0 1rem;
          height: 100%;
          font-weight: 700;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          white-space: nowrap;
          z-index: 2;
          min-width: fit-content;
        }

        .ticker-wrapper {
          flex: 1;
          overflow: hidden;
          height: 100%;
          display: flex;
          align-items: center;
        }

        .ticker-content {
          color: white;
          font-weight: 400;
          font-size: 0.85rem;
          white-space: nowrap;
          padding-left: 1rem;
          animation: scroll-ticker 120s linear infinite;
        }

        @keyframes scroll-ticker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }

        /* Main Content */
        .content-area {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem 0;
        }

        .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 300px;
          margin: 0 1rem;
        }

        .loading-spinner {
          text-align: center;
        }

        .spinner-ring {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-message {
          color: #718096;
          font-weight: 500;
          font-size: 0.9rem;
        }

        /* Section Headers */
        .section-header {
          margin-bottom: 1.5rem;
          padding: 0 1rem;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 1.3rem;
          font-weight: 700;
          color: #2d3748;
          font-family: 'Poppins', sans-serif;
          margin: 0;
        }

        .title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          color: white;
        }

        /* Featured Stories */
        .featured-stories {
          margin-bottom: 3rem;
          padding: 0 1rem;
        }

        .featured-layout {
          display: grid;
          grid-template-columns: repeat(1, minmax(100px, 1fr));
          gap: 1.5rem;
        }

        .featured-item.primary-story {
          grid-row: span 1;
        }

        /* Articles Layout */
        .all-articles {
          padding: 0 1rem;
        }

        .articles-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        /* Load More */
        .load-more-section {
          display: flex;
          justify-content: center;
          margin-top: 2rem;
          padding: 0 1rem;
        }

        .load-more-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0.875rem 1.5rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.25);
          width: 100%;
          max-width: 280px;
        }

        .load-more-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.35);
        }

        .load-more-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Footer */
        .site-footer {
          background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
          color: white;
          padding: 2rem 0;
          margin-top: 3rem;
        }

        .footer-wrapper {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          text-align: center;
        }

        .footer-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .footer-logo-image {
          border-radius: 6px;
        }

        .footer-brand-text {
          font-size: 1.1rem;
          font-weight: 700;
          font-family: 'Poppins', sans-serif;
        }

        .footer-tagline {
          color: #cbd5e0;
          font-size: 0.85rem;
        }

        .footer-details {
          color: #cbd5e0;
          font-size: 0.8rem;
          line-height: 1.6;
        }

        /* Responsive Design */
        @media (min-width: 640px) {
          .content-area {
            padding: 2.5rem 0;
          }
          
          .section-header {
            padding: 0 1rem;
          }
          
          .featured-stories {
            padding: 0 1rem;
          }
          
          .all-articles {
            padding: 0 1rem;
          }
          
          .load-more-section {
            padding: 0 1rem;
          }
          
          .loading-state {
            margin: 0 1rem;
          }
          
          .articles-layout {
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
          }
          
          .load-more-button {
            max-width: 320px;
          }
          
          .ticker-content {
            font-size: 0.9rem;
          }
        }

        @media (min-width: 768px) {
          .brand-logo {
            margin-left: 2rem;
          }
          
          .header-actions {
            margin-right: 2rem;
          }
          
          .section-header {
            padding: 0 2rem;
          }
          
          .featured-stories {
            padding: 0 2rem;
          }
          
          .all-articles {
            padding: 0 2rem;
          }
          
          .load-more-section {
            padding: 0 2rem;
          }
          
          .loading-state {
            margin: 0 2rem;
          }
          
          .main-navigation {
            padding: 1rem 0;
          }
          
          .brand-name {
            font-size: 1.75rem;
          }
          
          .brand-domain {
            font-size: 1.1rem;
          }
          
          .header-center {
            display: flex;
          }
          
          .status-indicators {
            gap: 2rem;
          }
          
          .live-status {
            padding: 0.5rem 1rem;
            border-radius: 20px;
          }
          
          .live-dot {
            width: 8px;
            height: 8px;
          }
          
          .live-label {
            font-size: 0.8rem;
          }
          
          .current-time {
            font-size: 1rem;
            padding: 0.5rem 1rem;
            border-radius: 12px;
          }
          
          .admin-access {
            padding: 0.75rem 1.25rem;
            font-size: 0.9rem;
          }
          
          .news-ticker {
            height: 48px;
          }
          
          .ticker-badge {
            padding: 0 1.5rem;
            font-size: 0.8rem;
          }
          
          .ticker-content {
            padding-left: 2rem;
            font-size: 1rem;
          }
          
          .content-area {
            padding: 3rem 0;
          }
          
          .section-title {
            font-size: 1.5rem;
          }
          
          .title-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
          }
          
          .featured-stories {
            margin-bottom: 4rem;
          }
          
          .articles-layout {
            margin-bottom: 3rem;
          }
          
          .load-more-section {
            margin-top: 3rem;
          }
          
          .load-more-button {
            padding: 1rem 2rem;
            font-size: 0.95rem;
            max-width: 350px;
          }
          
          .site-footer {
            padding: 2.5rem 0;
            margin-top: 4rem;
          }
          
          .footer-wrapper {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            text-align: left;
            padding: 0 2rem;
          }
          
          .footer-brand {
            align-items: flex-start;
          }
          
          .footer-details {
            text-align: right;
          }
        }

        @media (min-width: 1024px) {
          .featured-layout {
            // grid-template-columns: 2fr 1fr;
            grid-template-columns: repeat(2, minmax(100px, 1fr));
            gap: 2rem;
          }
          
          .featured-item.primary-story {
            grid-row: span 2;
          }
          
          .articles-layout {
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          }
        }

        @media (max-width: 480px) {
          .brand-logo {
            margin-left: 0.75rem;
          }
          
          .header-actions {
            margin-right: 0.75rem;
          }
          
          .section-header {
            padding: 0 0.75rem;
          }
          
          .featured-stories {
            padding: 0 0.75rem;
          }
          
          .all-articles {
            padding: 0 0.75rem;
          }
          
          .load-more-section {
            padding: 0 0.75rem;
          }
          
          .loading-state {
            margin: 0 0.75rem;
          }
          
          .logo-container {
            gap: 0.4rem;
          }
          
          .brand-name {
            font-size: 1.3rem;
          }
          
          .brand-domain {
            font-size: 0.8rem;
          }
          
          .header-center {
            display: none;
          }
          
          .admin-access {
            padding: 0.5rem 0.8rem;
            font-size: 0.75rem;
          }
          
          .mobile-menu {
            display: flex;
          }
          
          .mobile-menu span {
            width: 16px;
          }
          
          .ticker-badge {
            padding: 0 0.75rem;
            font-size: 0.65rem;
          }
          
          .ticker-content {
            padding-left: 0.75rem;
            font-size: 0.8rem;
          }
          
          .content-area {
            padding: 1.5rem 0;
          }
          
          .section-title {
            font-size: 1.1rem;
          }
          
          .title-icon {
            width: 32px;
            height: 32px;
          }
          
          .load-more-button {
            padding: 0.75rem 1.25rem;
            font-size: 0.85rem;
          }
          
          .footer-brand-text {
            font-size: 1rem;
          }
          
          .footer-tagline {
            font-size: 0.8rem;
          }
          
          .footer-details {
            font-size: 0.75rem;
          }
          
          .footer-wrapper {
            padding: 0 0.75rem;
          }
        }

        @media (max-width: 360px) {
          .brand-logo {
            margin-left: 0.5rem;
          }
          
          .header-actions {
            margin-right: 0.5rem;
          }
          
          .section-header {
            padding: 0 0.5rem;
          }
          
          .featured-stories {
            padding: 0 0.5rem;
          }
          
          .all-articles {
            padding: 0 0.5rem;
          }
          
          .load-more-section {
            padding: 0 0.5rem;
          }
          
          .loading-state {
            margin: 0 0.5rem;
          }
          
          .brand-name {
            font-size: 1.2rem;
          }
          
          .content-area {
            padding: 1.25rem 0;
          }
          
          .section-header {
            margin-bottom: 1.25rem;
          }
          
          .articles-layout {
            gap: 1.25rem;
          }
          
          .footer-wrapper {
            padding: 0 0.5rem;
          }
        }
      `}</style>
    </>
  );
}
