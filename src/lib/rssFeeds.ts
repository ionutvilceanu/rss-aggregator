export type RssFeedConfig = {
  url: string;
  category: 'ro' | 'intl' | 'discovery';
  name: string;
};

export const RSS_FEEDS: RssFeedConfig[] = [
  // România
  { url: 'https://www.digisport.ro/rss', category: 'ro', name: 'DigiSport' },
  { url: 'https://www.gsp.ro/rss.xml', category: 'ro', name: 'GSP' },
  { url: 'https://www.prosport.ro/feed', category: 'ro', name: 'ProSport' },
  { url: 'https://www.sport.ro/rss', category: 'ro', name: 'Sport.ro' },
  { url: 'https://www.fanatik.ro/rss', category: 'ro', name: 'Fanatik' },
  // Internațional
  { url: 'https://e00-marca.uecdn.es/rss/portada.xml', category: 'intl', name: 'Marca' },
  { url: 'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml', category: 'intl', name: 'Gazzetta' },
  { url: 'https://www.espn.com/espn/rss/soccer/news', category: 'intl', name: 'ESPN Soccer' },
  // Discovery
  {
    url: 'https://news.google.com/rss/search?q=(sport+OR+fotbal+OR+tenis+OR+baschet)+when:1d&hl=ro&gl=RO&ceid=RO:ro',
    category: 'discovery',
    name: 'Google News Sport RO',
  },
];

export const SPORT_KEYWORDS =
  /\b(fotbal|sport|meci|gol|liga|cup|campion|transfer|antrenor|jucător|jucator|echipă|echipa|națională|nationala|tenis|baschet|formula\s*1|f1|nba|uefa|champions|europa\s*league|superliga|fcsb|cfr|dinamo|rapid|universitatea|steaua|halep|hagi|messi|ronaldo|mbappé|mbappe|barcelona|real\s*madrid|manchester|liverpool|arsenal|chelsea|bayern|psg|inter|milan|juventus)\b/i;
