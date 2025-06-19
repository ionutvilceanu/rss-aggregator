/**
 * Extrage nume de echipe de fotbal din text
 * Folosește regex pentru cuvinte cu majusculă și o listă de echipe cunoscute
 */

// Liste de echipe cunoscute pentru diferite liguri
const KNOWN_TEAMS = {
  // Serie A
  serieA: [
    'Juventus', 'Milan', 'Inter', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 
    'Fiorentina', 'Torino', 'Genoa', 'Sampdoria', 'Bologna', 'Sassuolo', 
    'Verona', 'Cagliari', 'Spezia', 'Venezia', 'Salernitana', 'Empoli', 
    'Udinese', 'AC Milan', 'Inter Milan', 'AS Roma', 'SS Lazio'
  ],
  
  // Premier League
  premierLeague: [
    'Manchester United', 'Manchester City', 'Liverpool', 'Chelsea', 'Arsenal', 
    'Tottenham', 'Leicester City', 'West Ham', 'Everton', 'Leeds United', 
    'Aston Villa', 'Newcastle', 'Brighton', 'Crystal Palace', 'Burnley', 
    'Southampton', 'Watford', 'Norwich City', 'Brentford', 'Wolves'
  ],
  
  // La Liga
  laLiga: [
    'Barcelona', 'Real Madrid', 'Atletico Madrid', 'Sevilla', 'Valencia', 
    'Villarreal', 'Real Sociedad', 'Athletic Bilbao', 'Real Betis', 'Osasuna', 
    'Celta Vigo', 'Espanyol', 'Getafe', 'Cadiz', 'Alaves', 'Mallorca', 
    'Granada', 'Levante', 'Elche', 'FC Barcelona'
  ],
  
  // Bundesliga
  bundesliga: [
    'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 
    'Eintracht Frankfurt', 'SC Freiburg', 'Union Berlin', 'FC Koln', 'Mainz', 
    'Hoffenheim', 'FC Augsburg', 'VfL Wolfsburg', 'VfB Stuttgart', 'Hertha Berlin', 
    'VfL Bochum', 'Arminia Bielefeld', 'Greuther Furth', 'Werder Bremen'
  ],
  
  // Ligue 1
  ligue1: [
    'Paris Saint-Germain', 'PSG', 'Marseille', 'Lyon', 'Monaco', 'Nice', 
    'Rennes', 'Strasbourg', 'Lens', 'Lille', 'Nantes', 'Montpellier', 
    'Reims', 'Angers', 'Troyes', 'Clermont', 'Lorient', 'Metz', 'Bordeaux', 'Saint-Etienne'
  ]
};

// Toate echipele într-o listă unică
const ALL_TEAMS = [
  ...KNOWN_TEAMS.serieA,
  ...KNOWN_TEAMS.premierLeague,
  ...KNOWN_TEAMS.laLiga,
  ...KNOWN_TEAMS.bundesliga,
  ...KNOWN_TEAMS.ligue1
];

/**
 * Extrage nume de echipe din text folosind regex și liste de echipe cunoscute
 * @param text Textul din care să extragă echipele
 * @returns Array cu numele echipelor găsite
 */
export function extractTeamNames(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const foundTeams = new Set<string>();
  
  // 1. Căutare exactă în lista de echipe cunoscute
  for (const team of ALL_TEAMS) {
    const regex = new RegExp(`\\b${escapeRegex(team)}\\b`, 'gi');
    if (regex.test(text)) {
      foundTeams.add(team);
    }
  }
  
  // 2. Regex pentru cuvinte cu majusculă (posibile nume de echipe)
  // Caută secvențe de 1-3 cuvinte care încep cu majusculă
  const capitalizedWordsRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g;
  const matches = text.match(capitalizedWordsRegex) || [];
  
  for (const match of matches) {
    // Filtrează cuvinte comune care nu sunt echipe
    if (isLikelyTeamName(match)) {
      foundTeams.add(match);
    }
  }
  
  // 3. Căutare pentru abrevieri și acronime (2-4 litere mari)
  const acronymRegex = /\b[A-Z]{2,4}\b/g;
  const acronyms = text.match(acronymRegex) || [];
  
  for (const acronym of acronyms) {
    // Verifică dacă acronimul este o echipă cunoscută
    if (isKnownAcronym(acronym)) {
      foundTeams.add(acronym);
    }
  }
  
  return Array.from(foundTeams);
}

/**
 * Verifică dacă un text pare să fie numele unei echipe
 */
function isLikelyTeamName(text: string): boolean {
  const commonWords = [
    'The', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 
    'By', 'From', 'Up', 'About', 'Into', 'Through', 'During', 'Before', 'After',
    'Above', 'Below', 'Between', 'Among', 'This', 'That', 'These', 'Those',
    'News', 'Sport', 'Football', 'Soccer', 'Match', 'Game', 'Player', 'Team',
    'League', 'Cup', 'Championship', 'Season', 'Goal', 'Goals', 'Win', 'Loss',
    'Draw', 'Points', 'Table', 'Standing', 'Position'
  ];
  
  // Nu consideră cuvinte comune ca fiind echipe
  if (commonWords.includes(text)) {
    return false;
  }
  
  // Consideră că sunt echipe dacă:
  // - Au 2+ cuvinte (ex: "Manchester United")
  // - Conțin cuvinte specifice fotbalului (ex: "FC", "United", "City")
  const teamIndicators = ['FC', 'AC', 'AS', 'CF', 'United', 'City', 'Town', 'Rovers', 'Wanderers', 'Athletic', 'Real', 'Club'];
  
  if (text.split(' ').length >= 2 || teamIndicators.some(indicator => text.includes(indicator))) {
    return true;
  }
  
  return false;
}

/**
 * Verifică dacă un acronim este o echipă cunoscută
 */
function isKnownAcronym(acronym: string): boolean {
  const knownAcronyms = ['PSG', 'FCB', 'BVB', 'RMA', 'ATM', 'LFC', 'AFC', 'CFC', 'MUFC', 'MCFC'];
  return knownAcronyms.includes(acronym);
}

/**
 * Escape caractere speciale pentru regex
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Găsește cea mai relevantă echipă din text (prima găsită din lista de echipe cunoscute)
 */
export function findPrimaryTeam(text: string): string | null {
  const teams = extractTeamNames(text);
  
  // Prioritizează echipele cunoscute
  for (const team of teams) {
    if (ALL_TEAMS.includes(team)) {
      return team;
    }
  }
  
  // Returnează prima echipă găsită
  return teams.length > 0 ? teams[0] : null;
}

/**
 * Determină liga unei echipe
 */
export function getTeamLeague(teamName: string): string | null {
  if (KNOWN_TEAMS.serieA.includes(teamName)) return 'Serie A';
  if (KNOWN_TEAMS.premierLeague.includes(teamName)) return 'Premier League';
  if (KNOWN_TEAMS.laLiga.includes(teamName)) return 'La Liga';
  if (KNOWN_TEAMS.bundesliga.includes(teamName)) return 'Bundesliga';
  if (KNOWN_TEAMS.ligue1.includes(teamName)) return 'Ligue 1';
  
  return null;
} 