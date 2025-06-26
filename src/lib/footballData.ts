interface TeamStanding {
  position: number;
  team: string;
  playedGames: number;
  points: number;
}

interface FootballDataTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
}

interface FootballDataStanding {
  position: number;
  team: FootballDataTeam;
  playedGames: number;
  points: number;
}

interface StandingsResponse {
  standings: Array<{
    table: FootballDataStanding[];
  }>;
}

// Cache pentru a evita apeluri repetate și a respecta limita de 10 calls/minut
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minute cache
const RATE_LIMIT_DELAY = 6000; // 6 secunde între apeluri pentru a respecta 10 calls/minut
let lastApiCall = 0;

async function makeApiCall(url: string): Promise<any> {
  const cacheKey = url;
  const now = Date.now();
  
  // Verifică cache-ul
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log('Returnez date din cache pentru:', url);
    return cached.data;
  }
  
  // Respectă rate limiting
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastCall;
    console.log(`Aștept ${waitTime}ms pentru rate limiting...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new Error('FOOTBALL_DATA_TOKEN nu este setat în variabilele de mediu');
  }
  
  try {
    lastApiCall = Date.now();
    console.log('Fac apel API către:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': token,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit depășit pentru Football-Data.org API');
      }
      throw new Error(`Football-Data API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Salvează în cache
    cache.set(cacheKey, { data, timestamp: now });
    
    return data;
  } catch (error) {
    console.error('Eroare la apelul Football-Data API:', error);
    throw error;
  }
}

/**
 * Obține clasamentul unei competiții
 * @param competitionCode Codul competiției (ex: 'SA' pentru Serie A, 'PL' pentru Premier League)
 * @returns Array cu poziții, echipe, meciuri jucate și puncte
 */
export async function fetchCompetitionStandings(competitionCode: string): Promise<TeamStanding[]> {
  try {
    const url = `https://api.football-data.org/v4/competitions/${competitionCode}/standings`;
    const data: StandingsResponse = await makeApiCall(url);
    
    if (!data.standings || !data.standings[0] || !data.standings[0].table) {
      console.warn('Nu s-au găsit date de clasament pentru competiția:', competitionCode);
      return [];
    }
    
    const standings = data.standings[0].table.map((standing: FootballDataStanding): TeamStanding => ({
      position: standing.position,
      team: standing.team.name,
      playedGames: standing.playedGames,
      points: standing.points
    }));
    
    console.log(`Obținut clasament pentru ${competitionCode}:`, standings.length, 'echipe');
    return standings;
  } catch (error) {
    console.error(`Eroare la obținerea clasamentului pentru ${competitionCode}:`, error);
    return [];
  }
}

/**
 * Obține statisticile unui jucător
 * @param playerId ID-ul jucătorului
 * @returns Datele jucătorului
 */
export async function fetchPlayerStats(playerId: number): Promise<any> {
  try {
    const url = `https://api.football-data.org/v4/persons/${playerId}`;
    const data = await makeApiCall(url);
    
    console.log('Obținute statistici pentru jucătorul:', playerId);
    return data;
  } catch (error) {
    console.error(`Eroare la obținerea statisticilor pentru jucătorul ${playerId}:`, error);
    return null;
  }
}

/**
 * Mapare coduri competiții populare
 */
export const COMPETITION_CODES = {
  'SERIE_A': 'SA',
  'PREMIER_LEAGUE': 'PL', 
  'LA_LIGA': 'PD',
  'BUNDESLIGA': 'BL1',
  'LIGUE_1': 'FL1',
  'CHAMPIONS_LEAGUE': 'CL',
  'EUROPA_LEAGUE': 'EL'
} as const;

/**
 * Găsește codul competiției bazat pe numele echipei
 */
export function getCompetitionCodeByTeam(teamName: string): string | null {
  const teamName_lower = teamName.toLowerCase();
  
  // Serie A
  const serieATeams = ['juventus', 'milan', 'inter', 'napoli', 'roma', 'lazio', 'atalanta', 'fiorentina', 'torino', 'genoa', 'sampdoria', 'bologna', 'sassuolo', 'verona', 'cagliari', 'spezia', 'venezia', 'salernitana', 'empoli', 'udinese'];
  if (serieATeams.some(team => teamName_lower.includes(team))) {
    return COMPETITION_CODES.SERIE_A;
  }
  
  // Premier League
  const plTeams = ['manchester', 'liverpool', 'chelsea', 'arsenal', 'tottenham', 'leicester', 'west ham', 'everton', 'leeds', 'aston villa', 'newcastle', 'brighton', 'crystal palace', 'burnley', 'southampton', 'watford', 'norwich', 'brentford'];
  if (plTeams.some(team => teamName_lower.includes(team))) {
    return COMPETITION_CODES.PREMIER_LEAGUE;
  }
  
  // La Liga
  const laLigaTeams = ['barcelona', 'real madrid', 'atletico', 'sevilla', 'valencia', 'villarreal', 'real sociedad', 'athletic bilbao', 'betis', 'osasuna', 'celta', 'espanyol', 'getafe', 'cadiz', 'alaves', 'mallorca', 'granada', 'levante', 'elche'];
  if (laLigaTeams.some(team => teamName_lower.includes(team))) {
    return COMPETITION_CODES.LA_LIGA;
  }
  
  // Bundesliga
  const bundesligaTeams = ['bayern', 'dortmund', 'leipzig', 'leverkusen', 'frankfurt', 'freiburg', 'union berlin', 'koln', 'mainz', 'hoffenheim', 'augsburg', 'wolfsburg', 'stuttgart', 'hertha', 'bochum', 'arminia', 'greuther furth', 'bremen'];
  if (bundesligaTeams.some(team => teamName_lower.includes(team))) {
    return COMPETITION_CODES.BUNDESLIGA;
  }
  
  return null;
}

// Lista completă cu toate competițiile de fotbal
export const allFootballCompetitions = [
  // Competiții europene majore
  {
    id: 'uefa-champions-league',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europe',
    type: 'continental',
    season: '2024-2025',
    logo: '/logos/ucl.png',
    color: '#003B7F',
    participants: 36,
    format: 'group-knockout',
    code: 'CL'
  },
  {
    id: 'uefa-europa-league',
    name: 'UEFA Europa League',
    shortName: 'UEL',
    country: 'Europe',
    type: 'continental',
    season: '2024-2025',
    logo: '/logos/uel.png',
    color: '#FF6200',
    participants: 36,
    format: 'group-knockout',
    code: 'EL'
  },
  {
    id: 'uefa-conference-league',
    name: 'UEFA Europa Conference League',
    shortName: 'UECL',
    country: 'Europe',
    type: 'continental',
    season: '2024-2025',
    logo: '/logos/uecl.png',
    color: '#FF6B00',
    participants: 184,
    format: 'group-knockout',
    startDate: '2024-07-11',
    endDate: '2025-05-28'
  },

  // Ligi naționale majore
  {
    id: 'premier-league',
    name: 'Premier League',
    shortName: 'PL',
    country: 'England',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/premier-league.png',
    color: '#3D195B',
    participants: 20,
    format: 'round-robin',
    code: 'PL'
  },
  {
    id: 'la-liga',
    name: 'LaLiga',
    shortName: 'La Liga',
    country: 'Spain',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/la-liga.png',
    color: '#FF6900',
    participants: 20,
    format: 'round-robin',
    code: 'PD'
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/serie-a.png',
    color: '#004B87',
    participants: 20,
    format: 'round-robin',
    code: 'SA'
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/bundesliga.png',
    color: '#D20515',
    participants: 18,
    format: 'round-robin',
    code: 'BL1'
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    country: 'France',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/ligue1.png',
    color: '#003A70',
    participants: 18,
    format: 'round-robin',
    code: 'FL1'
  },

  // Liga României
  {
    id: 'romania-liga-1',
    name: 'Liga 1 România',
    shortName: 'Liga 1',
    country: 'Romania',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/liga1-romania.png',
    color: '#FFD700',
    participants: 16,
    format: 'round-robin',
    startDate: '2024-07-15',
    endDate: '2025-05-25',
    rounds: 30,
    teams: [
      'FCSB', 'CFR Cluj', 'Universitatea Craiova', 'Rapid București',
      'Sepsi OSK', 'UTA Arad', 'Dinamo București', 'Petrolul Ploiești',
      'FC Botoșani', 'Oțelul Galați', 'Poli Iași', 'Hermannstadt',
      'FC Voluntari', 'Unirea Slobozia', 'Gloria Buzău', 'AFC Hermannstadt'
    ]
  },

  // Competiții internaționale
  {
    id: 'fifa-club-world-cup-2025',
    name: 'FIFA Club World Cup 2025',
    shortName: 'FIFA CWC 2025',
    country: 'International',
    type: 'international',
    season: '2024-2025',
    logo: '/logos/fifa-cwc.png',
    color: '#326295',
    participants: 32,
    format: 'knockout',
    startDate: '2025-06-15',
    endDate: '2025-07-13'
  },

  // Alte ligi europene importante
  {
    id: 'eredivisie',
    name: 'Eredivisie',
    shortName: 'Eredivisie',
    country: 'Netherlands',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/eredivisie.png',
    color: '#FF6200',
    participants: 18,
    format: 'round-robin'
  },
  {
    id: 'primeira-liga',
    name: 'Primeira Liga',
    shortName: 'Liga Portugal',
    country: 'Portugal',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/primeira-liga.png',
    color: '#006600',
    participants: 18,
    format: 'round-robin'
  },
  {
    id: 'belgian-pro-league',
    name: 'Belgian Pro League',
    shortName: 'Pro League',
    country: 'Belgium',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/pro-league.png',
    color: '#000000',
    participants: 16,
    format: 'round-robin'
  }
];

// Adăugăm competițiile noi (păstrez pentru compatibilitate)
export const newCompetitions = [
  // FIFA Club World Cup 2025
  {
    id: 'fifa-club-world-cup-2025',
    name: 'FIFA Club World Cup 2025',
    shortName: 'FIFA CWC 2025',
    country: 'International',
    type: 'international',
    season: '2024-2025',
    logo: '/logos/fifa-cwc.png',
    color: '#326295',
    participants: 32,
    format: 'knockout',
    startDate: '2025-06-15',
    endDate: '2025-07-13'
  },
  
  // UEFA Conference League
  {
    id: 'uefa-conference-league',
    name: 'UEFA Europa Conference League',
    shortName: 'UECL',
    country: 'Europe',
    type: 'continental',
    season: '2024-2025',
    logo: '/logos/uecl.png',
    color: '#FF6B00',
    participants: 184,
    format: 'group-knockout',
    startDate: '2024-07-11',
    endDate: '2025-05-28'
  },
  
  // Romania Liga 1
  {
    id: 'romania-liga-1',
    name: 'Liga 1 România',
    shortName: 'Liga 1',
    country: 'Romania',
    type: 'domestic',
    season: '2024-2025',
    logo: '/logos/liga1-romania.png',
    color: '#FFD700',
    participants: 16,
    format: 'round-robin',
    startDate: '2024-07-15',
    endDate: '2025-05-25',
    rounds: 30,
    teams: [
      'FCSB', 'CFR Cluj', 'Universitatea Craiova', 'Rapid București',
      'Sepsi OSK', 'UTA Arad', 'Dinamo București', 'Petrolul Ploiești',
      'FC Botoșani', 'Oțelul Galați', 'Poli Iași', 'Hermannstadt',
      'FC Voluntari', 'Unirea Slobozia', 'Gloria Buzău', 'AFC Hermannstadt'
    ]
  }
];

// Funcții helper pentru competițiile noi
export const getFIFAClubWorldCup = () => {
  return allFootballCompetitions.find(comp => comp.id === 'fifa-club-world-cup-2025');
};

export const getUEFAConferenceLeague = () => {
  return allFootballCompetitions.find(comp => comp.id === 'uefa-conference-league');
};

export const getRomaniaLiga1 = () => {
  return allFootballCompetitions.find(comp => comp.id === 'romania-liga-1');
};

export const getAllCompetitions = () => {
  // Returnăm toate competițiile de fotbal
  return allFootballCompetitions;
};

export const getCompetitionsByCountry = (country: string) => {
  return allFootballCompetitions.filter(comp => 
    comp.country?.toLowerCase().includes(country.toLowerCase())
  );
};

export const getCompetitionsByType = (type: 'domestic' | 'continental' | 'international') => {
  return allFootballCompetitions.filter(comp => comp.type === type);
};

// Statistici pentru Liga 1 România
export const liga1Stats = {
  founded: 1909,
  mostTitles: 'FCSB (27 titluri)',
  currentChampion: 'FCSB',
  topScorer: 'Gică Hagi (144 goluri)',
  mostAppearances: 'Dorinel Munteanu (422 meciuri)',
  stadiums: {
    largest: 'Arena Națională (55,600)',
    smallest: 'Stadionul Municipal Slobozia (5,000)'
  }
}; 