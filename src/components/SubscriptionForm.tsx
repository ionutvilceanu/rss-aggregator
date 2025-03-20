import React, { useState } from 'react';

const RSS_FEEDS = [
  { name: 'Gazeta Dello Sport', url: 'https://www.gazzetta.it/rss/home.xml' },
  { name: 'Marca', url: 'https://e00-marca.uecdn.es/rss/portada.xml' },
  { name: 'L\'Equipe', url: 'https://www.lequipe.fr/rss/actu_rss.xml' },
  { name: 'El Mundo Deportivo', url: 'https://www.mundodeportivo.com/rss/home.xml' },
];

const SubscriptionForm: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const handleSubscriptionChange = (url: string) => {
    setSubscriptions(prev =>
      prev.includes(url) ? prev.filter(feed => feed !== url) : [...prev, url]
    );
  };

  return (
    <div>
      <h2>Subscription Form</h2>
      {RSS_FEEDS.map(feed => (
        <div key={feed.url} className="mb-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={subscriptions.includes(feed.url)}
              onChange={() => handleSubscriptionChange(feed.url)}
              className="mr-2"
            />
            {feed.name}
          </label>
        </div>
      ))}
    </div>
  );
};

export default SubscriptionForm; 