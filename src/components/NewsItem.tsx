import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './NewsItem.module.css';

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

interface NewsItemProps {
  article: {
    id?: number;
    title: string;
    link: string;
    pubDate: string;
    image?: string;
  };
}

const NewsItem: React.FC<NewsItemProps> = ({ article }) => {
  return (
    <div className={styles["news-item"]}>
      <div className={styles["image-container"]}>
        <Image
          src={article.image || '/default.png'}
          alt={cleanTitle(article.title)}
          className={styles["news-image"]}
          width={300}
          height={200}
          priority={false}
          style={{ objectFit: 'cover' }}
        />
      </div>
      <div className={styles["content"]}>
        {article.id ? (
          <Link href={`/article/${article.id}`} className={styles["news-title"]}>
            {cleanTitle(article.title)}
          </Link>
        ) : (
          <Link 
            href={`/article?url=${encodeURIComponent(article.link)}`}
            className={styles["news-title"]}
          >
            {cleanTitle(article.title)}
          </Link>
        )}
        <p className={styles["news-date"]}>
          {new Date(article.pubDate).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default NewsItem;
