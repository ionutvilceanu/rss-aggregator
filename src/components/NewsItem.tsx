import React from 'react';

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
    <div className="border rounded-lg overflow-hidden shadow-md flex flex-col justify-between h-full">
      {/* Container cu raport 16:9 și imagine cu object-cover */}
      <div className="relative w-full pb-[56.25%] overflow-hidden">
        <img
          src={article.image || '/default.png'}
          alt={article.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <div className="p-4 bg-white flex flex-col flex-grow">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-bold text-black hover:text-red-500"
        >
          {article.title}
        </a>
        <p className="text-sm text-gray-600 mt-2">{article.pubDate}</p>
      </div>
    </div>
  );
};

export default NewsItem;
