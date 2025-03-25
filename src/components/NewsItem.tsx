import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './NewsItem.module.css';

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
          alt={article.title}
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
            {article.title}
          </Link>
        ) : (
          <Link 
            href={`/article?url=${encodeURIComponent(article.link)}`}
            className={styles["news-title"]}
          >
            {article.title}
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
