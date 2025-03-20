import React from 'react';
import './NewsItem.css';

interface NewsItemProps {
  article: {
    title: string;
    link: string;
    pubDate: string;
    image?: string;
  };
}

const NewsItem: React.FC<NewsItemProps> = ({ article }) => {
  return (
    <div className="news-item">
      <div className="image-container">
        <img
          src={article.image || '/default.png'}
          alt={article.title}
          className="news-image"
        />
      </div>
      <div className="content">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="news-title"
        >
          {article.title}
        </a>
        <p className="news-date">
          {new Date(article.pubDate).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default NewsItem;
