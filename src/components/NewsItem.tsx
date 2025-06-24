import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Funcție utilitară pentru curățarea titlurilor
function cleanTitle(title: string): string {
  if (!title) return '';
  
  // Elimină ** și alte caractere speciale de la începutul și sfârșitul titlului
  let cleanedTitle = title.replace(/^\*\*+\s*/, ''); // Elimină ** de la început
  cleanedTitle = cleanedTitle.replace(/\s*\*\*+$/, ''); // Elimină ** de la sfârșit
  
  // Elimină ghilimelele HTML entities (&quot;)
  cleanedTitle = cleanedTitle.replace(/&quot;/g, '"');
  
  // Elimină caracterele HTML entities
  cleanedTitle = cleanedTitle.replace(/&amp;/g, '&');
  cleanedTitle = cleanedTitle.replace(/&lt;/g, '<');
  cleanedTitle = cleanedTitle.replace(/&gt;/g, '>');
  
  return cleanedTitle.trim();
}

// Funcție pentru formatarea datei
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 2) {
    return 'Ieri';
  } else if (diffDays < 7 && diffDays > 1) {
    return `Acum ${diffDays} zile`;
  } else {
    return 'Azi';
  }
}

// Funcție pentru extragerea unui preview al conținutului
function getContentPreview(content: string, maxLength: number = 120): string {
  if (!content) return '';
  const cleanContent = content.replace(/<[^>]*>/g, ''); // Elimină HTML tags
  return cleanContent.length > maxLength 
    ? cleanContent.substring(0, maxLength) + '...'
    : cleanContent;
}

interface NewsItemProps {
  article: {
    id?: number;
    title: string;
    link: string;
    pubDate: string;
    image?: string;
    content?: string;
  };
  featured?: boolean;
}

const NewsItem: React.FC<NewsItemProps> = ({ article, featured = false }) => {
  const href = article.id 
    ? `/article/${article.id}` 
    : `/article?url=${encodeURIComponent(article.link)}`;

  return (
    <article className={`news-card ${featured ? 'featured' : ''}`}>
      <div className="card-container">
        {/* Image Section */}
        <div className="image-section">
        <Image
          src={article.image || '/default.png'}
            alt={cleanTitle(article.title)}
            width={featured ? 800 : 400}
            height={featured ? 500 : 250}
            priority={featured}
            className="article-image"
          />
          <div className="image-overlay">
            <div className="category-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12l2 2 4-4"/>
              </svg>
              Sport
            </div>
            {featured && (
              <div className="trending-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Trending
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="content-section">
          <div className="article-meta">
            <time className="publish-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              {formatDate(article.pubDate)}
            </time>
            <div className="read-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              2 min
            </div>
      </div>

          <Link href={href} className="article-link">
            <h3 className="article-title">{cleanTitle(article.title)}</h3>
          </Link>

          {featured && article.content && (
            <p className="article-preview">
              {getContentPreview(article.content, 150)}
            </p>
          )}

          <div className="article-footer">
            <Link href={href} className="read-more">
              <span>Citește articolul</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
          </Link>
<div className="engagement-metrics">
  <span className="metric">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    {(() => {
      if (typeof window === 'undefined') return '';
      const key = `views_${article.id ?? encodeURIComponent(article.link)}`;
      let v = sessionStorage.getItem(key);
      if (!v) {
        v = (Math.floor(Math.random() * 1000) + 100).toString();
        sessionStorage.setItem(key, v);
      }
      return v;
    })()}
  </span>
  <span className="metric">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    {(() => {
      if (typeof window === 'undefined') return '';
      const key = `comments_${article.id ?? encodeURIComponent(article.link)}`;
      let c = sessionStorage.getItem(key);
      if (!c) {
        c = (Math.floor(Math.random() * 50) + 5).toString();
        sessionStorage.setItem(key, c);
      }
      return c;
    })()}
  </span>
</div>

          </div>
        </div>
      </div>

      <style jsx>{`
        .news-card {
          position: relative;
          height: 100%;
          border-radius: 10px;
          overflow: hidden;
          background: white;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #f1f5f9;
        }

        .news-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
          border-color: #e2e8f0;
        }

        .news-card.featured {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }

        .news-card.featured .content-section {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
        }

        .card-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .image-section {
          position: relative;
          overflow: hidden;
          height: 180px;
          flex-shrink: 0;
        }

        .news-card.featured .image-section {
          height: 220px;
        }

        .article-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .news-card:hover .article-image {
          transform: scale(1.03);
        }

        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.05) 0%,
            rgba(0, 0, 0, 0.15) 100%
          );
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0.75rem;
        }

        .category-tag,
        .trending-badge {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: rgba(255, 255, 255, 0.95);
          color: #374151;
          padding: 0.3rem 0.6rem;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .trending-badge {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          border: none;
        }

        .content-section {
          flex: 1;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .news-card.featured .content-section {
          padding: 1.5rem;
          gap: 1rem;
        }

        .article-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: ${featured ? 'rgba(255, 255, 255, 0.8)' : '#64748b'};
        }

        .publish-time,
        .read-time {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-weight: 500;
        }

        .article-link {
          text-decoration: none;
          color: inherit;
        }

        .article-title {
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.3;
          margin: 0;
          color: ${featured ? 'white' : '#1e293b'};
          transition: color 0.3s ease;
          font-family: 'Inter', sans-serif;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-card.featured .article-title {
          font-size: 1.2rem;
          -webkit-line-clamp: 2;
        }

        .article-link:hover .article-title {
          color: ${featured ? '#fbbf24' : '#667eea'};
        }

        .article-preview {
          font-size: 0.85rem;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .article-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 0.75rem;
          border-top: 1px solid ${featured ? 'rgba(255, 255, 255, 0.15)' : '#f1f5f9'};
        }

        .read-more {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: ${featured ? 'white' : '#667eea'};
          text-decoration: none;
          font-weight: 600;
          font-size: 0.8rem;
          transition: all 0.3s ease;
        }

        .read-more:hover {
          color: ${featured ? '#fbbf24' : '#4f46e5'};
          transform: translateX(2px);
        }

        .engagement-metrics {
          display: flex;
          gap: 0.75rem;
        }

        .metric {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: ${featured ? 'rgba(255, 255, 255, 0.7)' : '#94a3b8'};
          font-weight: 500;
        }

        /* Responsive Design */
        @media (min-width: 640px) {
          .news-card {
            border-radius: 12px;
          }
          
          .image-section {
            height: 200px;
          }
          
          .news-card.featured .image-section {
            height: 280px;
          }
          
          .image-overlay {
            padding: 1rem;
          }
          
          .category-tag,
          .trending-badge {
            padding: 0.4rem 0.8rem;
            border-radius: 16px;
            font-size: 0.75rem;
          }
          
          .content-section {
            padding: 1.5rem;
            gap: 1rem;
          }
          
          .article-meta {
            font-size: 0.8rem;
          }
          
          .article-title {
            font-size: 1.1rem;
          }
          
          .news-card.featured .article-title {
            font-size: 1.4rem;
          }
          
          .article-preview {
            font-size: 0.9rem;
            line-height: 1.6;
          }
          
          .article-footer {
            padding-top: 1rem;
          }
          
          .read-more {
            font-size: 0.85rem;
          }
          
          .metric {
            font-size: 0.75rem;
          }
          
          .engagement-metrics {
            gap: 1rem;
          }
        }

        @media (max-width: 480px) {
          .news-card {
            border-radius: 8px;
          }
          
          .image-section {
            height: 160px;
          }
          
          .news-card.featured .image-section {
            height: 200px;
          }
          
          .image-overlay {
            padding: 0.5rem;
          }
          
          .category-tag,
          .trending-badge {
            padding: 0.25rem 0.5rem;
            font-size: 0.65rem;
            gap: 0.25rem;
          }
          
          .content-section {
            padding: 1rem;
            gap: 0.6rem;
          }
          
          .article-meta {
            font-size: 0.7rem;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }
          
          .article-title {
            font-size: 0.9rem;
            line-height: 1.25;
            -webkit-line-clamp: 2;
          }
          
          .news-card.featured .article-title {
            font-size: 1.1rem;
          }
          
          .article-preview {
            font-size: 0.8rem;
            line-height: 1.4;
            -webkit-line-clamp: 2;
          }
          
          .article-footer {
            flex-direction: column;
            gap: 0.75rem;
            align-items: stretch;
            padding-top: 0.75rem;
          }
          
          .read-more {
            justify-content: center;
            padding: 0.5rem;
            background: ${featured ? 'rgba(255, 255, 255, 0.1)' : 'rgba(102, 126, 234, 0.1)'};
            border-radius: 6px;
            font-size: 0.75rem;
          }
          
          .engagement-metrics {
            justify-content: center;
            gap: 1rem;
          }
          
          .metric {
            font-size: 0.65rem;
          }
        }

        @media (max-width: 360px) {
          .image-section {
            height: 140px;
          }
          
          .news-card.featured .image-section {
            height: 180px;
          }
          
          .content-section {
            padding: 0.875rem;
          }
          
          .article-title {
            font-size: 0.85rem;
          }
          
          .news-card.featured .article-title {
            font-size: 1rem;
          }
          
          .article-preview {
            font-size: 0.75rem;
          }
          
          .read-more {
            font-size: 0.7rem;
            padding: 0.4rem;
          }
        }
      `}</style>
    </article>
  );
};

export default NewsItem;
