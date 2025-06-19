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