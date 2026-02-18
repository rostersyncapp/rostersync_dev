/**
 * League and Team Configurations for Master Seeder
 */

export type SourceType = 'statmuse' | 'espn-api' | 'espn-html' | 'wikipedia' | 'baseball-cube';

export interface TeamConfig {
    id: string;
    name: string;
    slug: string;
    statmuseId?: number;
    espnId?: string;
    cubeId?: number;
    conference?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
    wikiMappings?: { name: string; untilYear?: number }[];
    abbrev?: string;
}

export interface LeagueConfig {
    name: string;
    table: string;
    source: SourceType;
    teams: TeamConfig[];
    baseUrl?: string;
    espnSport?: string;
    espnLeague?: string;
}

export const LEAGUE_CONFIGS: Record<string, LeagueConfig> = {
    nba: {
        name: 'NBA',
        table: 'nba_rosters',
        source: 'statmuse',
        teams: [
            { id: "atlanta-hawks", slug: "atlanta-hawks", statmuseId: 22, name: "Atlanta Hawks" },
            { id: "boston-celtics", slug: "boston-celtics", statmuseId: 1, name: "Boston Celtics" },
            { id: "brooklyn-nets", slug: "brooklyn-nets", statmuseId: 33, name: "Brooklyn Nets" },
            { id: "charlotte-hornets", slug: "charlotte-hornets", statmuseId: 53, name: "Charlotte Hornets" },
            { id: "chicago-bulls", slug: "chicago-bulls", statmuseId: 25, name: "Chicago Bulls" },
            { id: "cleveland-cavaliers", slug: "cleveland-cavaliers", statmuseId: 42, name: "Cleveland Cavaliers" },
            { id: "dallas-mavericks", slug: "dallas-mavericks", statmuseId: 46, name: "Dallas Mavericks" },
            { id: "denver-nuggets", slug: "denver-nuggets", statmuseId: 28, name: "Denver Nuggets" },
            { id: "detroit-pistons", slug: "detroit-pistons", statmuseId: 13, name: "Detroit Pistons" },
            { id: "golden-state-warriors", slug: "golden-state-warriors", statmuseId: 6, name: "Golden State Warriors" },
            { id: "houston-rockets", slug: "houston-rockets", statmuseId: 37, name: "Houston Rockets" },
            { id: "indiana-pacers", slug: "indiana-pacers", statmuseId: 30, name: "Indiana Pacers" },
            { id: "los-angeles-clippers", slug: "la-clippers", statmuseId: 41, name: "LA Clippers" },
            { id: "los-angeles-lakers", slug: "los-angeles-lakers", statmuseId: 15, name: "LA Lakers" },
            { id: "memphis-grizzlies", slug: "memphis-grizzlies", statmuseId: 52, name: "Memphis Grizzlies" },
            { id: "miami-heat", slug: "miami-heat", statmuseId: 48, name: "Miami Heat" },
            { id: "milwaukee-bucks", slug: "milwaukee-bucks", statmuseId: 39, name: "Milwaukee Bucks" },
            { id: "minnesota-timberwolves", slug: "minnesota-timberwolves", statmuseId: 49, name: "Minnesota Timberwolves" },
            { id: "new-orleans-pelicans", slug: "new-orleans-pelicans", statmuseId: 47, name: "New Orleans Pelicans" },
            { id: "new-york-knicks", slug: "new-york-knicks", statmuseId: 5, name: "New York Knicks" },
            { id: "oklahoma-city-thunder", slug: "oklahoma-city-thunder", statmuseId: 38, name: "OKC Thunder" },
            { id: "orlando-magic", slug: "orlando-magic", statmuseId: 50, name: "Orlando Magic" },
            { id: "philadelphia-76ers", slug: "philadelphia-76ers", statmuseId: 21, name: "Philadelphia 76ers" },
            { id: "phoenix-suns", slug: "phoenix-suns", statmuseId: 40, name: "Phoenix Suns" },
            { id: "portland-trail-blazers", slug: "portland-trail-blazers", statmuseId: 43, name: "Portland Trail Blazers" },
            { id: "sacramento-kings", slug: "sacramento-kings", statmuseId: 16, name: "Sacramento Kings" },
            { id: "san-antonio-spurs", slug: "san-antonio-spurs", statmuseId: 27, name: "San Antonio Spurs" },
            { id: "toronto-raptors", slug: "toronto-raptors", statmuseId: 51, name: "Toronto Raptors" },
            { id: "utah-jazz", slug: "utah-jazz", statmuseId: 45, name: "Utah Jazz" },
            { id: "washington-wizards", slug: "washington-wizards", statmuseId: 24, name: "Washington Wizards" }
        ]
    },
    nfl: {
        name: 'NFL',
        table: 'nfl_rosters',
        source: 'statmuse',
        teams: [
            { id: "baltimore-ravens", slug: "baltimore-ravens", statmuseId: 85, name: "Baltimore Ravens", abbrev: "BAL" },
            { id: "buffalo-bills", slug: "buffalo-bills", statmuseId: 67, name: "Buffalo Bills", abbrev: "BUF" },
            { id: "cincinnati-bengals", slug: "cincinnati-bengals", statmuseId: 80, name: "Cincinnati Bengals", abbrev: "CIN" },
            { id: "cleveland-browns", slug: "cleveland-browns", statmuseId: 58, name: "Cleveland Browns", abbrev: "CLE" },
            { id: "denver-broncos", slug: "denver-broncos", statmuseId: 68, name: "Denver Broncos", abbrev: "DEN" },
            { id: "houston-texans", slug: "houston-texans", statmuseId: 86, name: "Houston Texans", abbrev: "HOU" },
            { id: "indianapolis-colts", slug: "indianapolis-colts", statmuseId: 66, name: "Indianapolis Colts", abbrev: "IND" },
            { id: "jacksonville-jaguars", slug: "jacksonville-jaguars", statmuseId: 84, name: "Jacksonville Jaguars", abbrev: "JAX" },
            { id: "kansas-city-chiefs", slug: "kansas-city-chiefs", statmuseId: 69, name: "Kansas City Chiefs", abbrev: "KC" },
            { id: "las-vegas-raiders", slug: "las-vegas-raiders", statmuseId: 73, name: "Las Vegas Raiders", abbrev: "LV" },
            { id: "los-angeles-chargers", slug: "los-angeles-chargers", statmuseId: 74, name: "LA Chargers", abbrev: "LAC" },
            { id: "miami-dolphins", slug: "miami-dolphins", statmuseId: 77, name: "Miami Dolphins", abbrev: "MIA" },
            { id: "new-england-patriots", slug: "new-england-patriots", statmuseId: 70, name: "New England Patriots", abbrev: "NE" },
            { id: "new-york-jets", slug: "new-york-jets", statmuseId: 71, name: "New York Jets", abbrev: "NYJ" },
            { id: "pittsburgh-steelers", slug: "pittsburgh-steelers", statmuseId: 50, name: "Pittsburgh Steelers", abbrev: "PIT" },
            { id: "tennessee-titans", slug: "tennessee-titans", statmuseId: 72, name: "Tennessee Titans", abbrev: "TEN" },
            { id: "arizona-cardinals", slug: "arizona-cardinals", statmuseId: 7, name: "Arizona Cardinals", abbrev: "ARI" },
            { id: "atlanta-falcons", slug: "atlanta-falcons", statmuseId: 78, name: "Atlanta Falcons", abbrev: "ATL" },
            { id: "carolina-panthers", slug: "carolina-panthers", statmuseId: 83, name: "Carolina Panthers", abbrev: "CAR" },
            { id: "chicago-bears", slug: "chicago-bears", statmuseId: 4, name: "Chicago Bears", abbrev: "CHI" },
            { id: "dallas-cowboys", slug: "dallas-cowboys", statmuseId: 75, name: "Dallas Cowboys", abbrev: "DAL" },
            { id: "detroit-lions", slug: "detroit-lions", statmuseId: 46, name: "Detroit Lions", abbrev: "DET" },
            { id: "green-bay-packers", slug: "green-bay-packers", statmuseId: 18, name: "Green Bay Packers", abbrev: "GB" },
            { id: "los-angeles-rams", slug: "los-angeles-rams", statmuseId: 53, name: "LA Rams", abbrev: "LAR" },
            { id: "minnesota-vikings", slug: "minnesota-vikings", statmuseId: 76, name: "Minnesota Vikings", abbrev: "MIN" },
            { id: "new-orleans-saints", slug: "new-orleans-saints", statmuseId: 79, name: "New Orleans Saints", abbrev: "NO" },
            { id: "new-york-giants", slug: "new-york-giants", statmuseId: 35, name: "New York Giants", abbrev: "NYG" },
            { id: "philadelphia-eagles", slug: "philadelphia-eagles", statmuseId: 49, name: "Philadelphia Eagles", abbrev: "PHI" },
            { id: "san-francisco-49ers", slug: "san-francisco-49ers", statmuseId: 63, name: "San Francisco 49ers", abbrev: "SF" },
            { id: "seattle-seahawks", slug: "seattle-seahawks", statmuseId: 81, name: "Seattle Seahawks", abbrev: "SEA" },
            { id: "tampa-bay-buccaneers", slug: "tampa-bay-buccaneers", statmuseId: 82, name: "Tampa Bay Buccaneers", abbrev: "TB" },
            { id: "washington-commanders", slug: "washington-commanders", statmuseId: 48, name: "Washington Commanders", abbrev: "WAS" }
        ]
    },
    mlb: {
        name: 'MLB',
        table: 'mlb_rosters',
        source: 'statmuse',
        teams: [
            { id: "arizona-diamondbacks", slug: "arizona-diamondbacks", statmuseId: 97, name: "Arizona Diamondbacks" },
            { id: "atlanta-braves", slug: "atlanta-braves", statmuseId: 1, name: "Atlanta Braves" },
            { id: "baltimore-orioles", slug: "baltimore-orioles", statmuseId: 73, name: "Baltimore Orioles" },
            { id: "boston-red-sox", slug: "boston-red-sox", statmuseId: 69, name: "Boston Red Sox" },
            { id: "chicago-cubs", slug: "chicago-cubs", statmuseId: 2, name: "Chicago Cubs" },
            { id: "chicago-white-sox", slug: "chicago-white-sox", statmuseId: 70, name: "Chicago White Sox" },
            { id: "cincinnati-reds", slug: "cincinnati-reds", statmuseId: 19, name: "Cincinnati Reds" },
            { id: "cleveland-guardians", slug: "cleveland-guardians", statmuseId: 71, name: "Cleveland Guardians" },
            { id: "colorado-rockies", slug: "colorado-rockies", statmuseId: 95, name: "Colorado Rockies" },
            { id: "detroit-tigers", slug: "detroit-tigers", statmuseId: 72, name: "Detroit Tigers" },
            { id: "houston-astros", slug: "houston-astros", statmuseId: 87, name: "Houston Astros" },
            { id: "kansas-city-royals", slug: "kansas-city-royals", statmuseId: 89, name: "Kansas City Royals" },
            { id: "los-angeles-angels", slug: "los-angeles-angels", statmuseId: 85, name: "LA Angels" },
            { id: "los-angeles-dodgers", slug: "los-angeles-dodgers", statmuseId: 31, name: "LA Dodgers" },
            { id: "miami-marlins", slug: "miami-marlins", statmuseId: 96, name: "Miami Marlins" },
            { id: "milwaukee-brewers", slug: "milwaukee-brewers", statmuseId: 92, name: "Milwaukee Brewers" },
            { id: "minnesota-twins", slug: "minnesota-twins", statmuseId: 75, name: "Minnesota Twins" },
            { id: "new-york-mets", slug: "new-york-mets", statmuseId: 88, name: "New York Mets" },
            { id: "new-york-yankees", slug: "new-york-yankees", statmuseId: 76, name: "New York Yankees" },
            { id: "oakland-athletics", slug: "oakland-athletics", statmuseId: 74, name: "Oakland Athletics" },
            { id: "philadelphia-phillies", slug: "philadelphia-phillies", statmuseId: 27, name: "Philadelphia Phillies" },
            { id: "pittsburgh-pirates", slug: "pittsburgh-pirates", statmuseId: 22, name: "Pittsburgh Pirates" },
            { id: "san-diego-padres", slug: "san-diego-padres", statmuseId: 91, name: "San Diego Padres" },
            { id: "san-francisco-giants", slug: "san-francisco-giants", statmuseId: 25, name: "San Francisco Giants" },
            { id: "seattle-mariners", slug: "seattle-mariners", statmuseId: 93, name: "Seattle Mariners" },
            { id: "st-louis-cardinals", slug: "st-louis-cardinals", statmuseId: 67, name: "St. Louis Cardinals" },
            { id: "tampa-bay-rays", slug: "tampa-bay-rays", statmuseId: 98, name: "Tampa Bay Rays" },
            { id: "texas-rangers", slug: "texas-rangers", statmuseId: 86, name: "Texas Rangers" },
            { id: "toronto-blue-jays", slug: "toronto-blue-jays", statmuseId: 94, name: "Toronto Blue Jays" },
            { id: "washington-nationals", slug: "washington-nationals", statmuseId: 90, name: "Washington Nationals" }
        ]
    },
    nhl: {
        name: 'NHL',
        table: 'nhl_rosters',
        source: 'statmuse',
        teams: [
            { id: "anaheim-ducks", slug: "anaheim-ducks", statmuseId: 32, name: "Anaheim Ducks" },
            { id: "boston-bruins", slug: "boston-bruins", statmuseId: 6, name: "Boston Bruins" },
            { id: "buffalo-sabres", slug: "buffalo-sabres", statmuseId: 19, name: "Buffalo Sabres" },
            { id: "calgary-flames", slug: "calgary-flames", statmuseId: 21, name: "Calgary Flames" },
            { id: "carolina-hurricanes", slug: "carolina-hurricanes", statmuseId: 26, name: "Carolina Hurricanes" },
            { id: "chicago-blackhawks", slug: "chicago-blackhawks", statmuseId: 11, name: "Chicago Blackhawks" },
            { id: "colorado-avalanche", slug: "colorado-avalanche", statmuseId: 27, name: "Colorado Avalanche" },
            { id: "columbus-blue-jackets", slug: "columbus-blue-jackets", statmuseId: 36, name: "Columbus Blue Jackets" },
            { id: "dallas-stars", slug: "dallas-stars", statmuseId: 15, name: "Dallas Stars" },
            { id: "detroit-red-wings", slug: "detroit-red-wings", statmuseId: 12, name: "Detroit Red Wings" },
            { id: "edmonton-oilers", slug: "edmonton-oilers", statmuseId: 25, name: "Edmonton Oilers" },
            { id: "florida-panthers", slug: "florida-panthers", statmuseId: 33, name: "Florida Panthers" },
            { id: "los-angeles-kings", slug: "los-angeles-kings", statmuseId: 14, name: "LA Kings" },
            { id: "minnesota-wild", slug: "minnesota-wild", statmuseId: 37, name: "Minnesota Wild" },
            { id: "montreal-canadiens", slug: "montreal-canadiens", statmuseId: 1, name: "Montreal Canadiens" },
            { id: "nashville-predators", slug: "nashville-predators", statmuseId: 34, name: "Nashville Predators" },
            { id: "new-jersey-devils", slug: "new-jersey-devils", statmuseId: 23, name: "New Jersey Devils" },
            { id: "new-york-islanders", slug: "new-york-islanders", statmuseId: 22, name: "New York Islanders" },
            { id: "new-york-rangers", slug: "new-york-rangers", statmuseId: 10, name: "New York Rangers" },
            { id: "ottawa-senators", slug: "ottawa-senators", statmuseId: 30, name: "Ottawa Senators" },
            { id: "philadelphia-flyers", slug: "philadelphia-flyers", statmuseId: 16, name: "Philadelphia Flyers" },
            { id: "pittsburgh-penguins", slug: "pittsburgh-penguins", statmuseId: 17, name: "Pittsburgh Penguins" },
            { id: "san-jose-sharks", slug: "san-jose-sharks", statmuseId: 29, name: "San Jose Sharks" },
            { id: "seattle-kraken", slug: "seattle-kraken", statmuseId: 39, name: "Seattle Kraken" },
            { id: "st-louis-blues", slug: "st-louis-blues", statmuseId: 18, name: "St. Louis Blues" },
            { id: "tampa-bay-lightning", slug: "tampa-bay-lightning", statmuseId: 31, name: "Tampa Bay Lightning" },
            { id: "toronto-maple-leafs", slug: "toronto-maple-leafs", statmuseId: 5, name: "Toronto Maple Leafs" },
            { id: "utah-hockey-club", slug: "utah-hockey-club", statmuseId: 40, name: "Utah HC" },
            { id: "vancouver-canucks", slug: "vancouver-canucks", statmuseId: 20, name: "Vancouver Canucks" },
            { id: "vegas-golden-knights", slug: "vegas-golden-knights", statmuseId: 38, name: "Vegas Golden Knights" },
            { id: "washington-capitals", slug: "washington-capitals", statmuseId: 24, name: "Washington Capitals" },
            { id: "winnipeg-jets", slug: "winnipeg-jets", statmuseId: 35, name: "Winnipeg Jets" }
        ]
    },
    wnba: {
        name: 'WNBA',
        table: 'wnba_rosters',
        source: 'statmuse',
        teams: [
            { id: 'new-york-liberty', slug: 'new-york-liberty', statmuseId: 1, name: "New York Liberty" },
            { id: 'chicago-sky', slug: 'chicago-sky', statmuseId: 2, name: "Chicago Sky" },
            { id: 'washington-mystics', slug: 'washington-mystics', statmuseId: 3, name: "Washington Mystics" },
            { id: 'atlanta-dream', slug: 'atlanta-dream', statmuseId: 4, name: "Atlanta Dream" },
            { id: 'connecticut-sun', slug: 'connecticut-sun', statmuseId: 5, name: "Connecticut Sun" },
            { id: 'indiana-fever', slug: 'indiana-fever', statmuseId: 6, name: "Indiana Fever" },
            { id: 'phoenix-mercury', slug: 'phoenix-mercury', statmuseId: 7, name: "Phoenix Mercury" },
            { id: 'los-angeles-sparks', slug: 'los-angeles-sparks', statmuseId: 8, name: "LA Sparks" },
            { id: 'las-vegas-aces', slug: 'las-vegas-aces', statmuseId: 9, name: "Las Vegas Aces" },
            { id: 'golden-state-valkyries', slug: 'golden-state-valkyries', statmuseId: 10, name: "Golden State Valkyries" },
            { id: 'dallas-wings', slug: 'dallas-wings', statmuseId: 11, name: "Dallas Wings" },
            { id: 'minnesota-lynx', slug: 'minnesota-lynx', statmuseId: 12, name: "Minnesota Lynx" },
            { id: 'seattle-storm', slug: 'seattle-storm', statmuseId: 13, name: "Seattle Storm" },
            { id: 'charlotte-sting', slug: 'charlotte-sting', statmuseId: 14, name: "Charlotte Sting" },
            { id: 'cleveland-rockers', slug: 'cleveland-rockers', statmuseId: 15, name: "Cleveland Rockers" },
            { id: 'houston-comets', slug: 'houston-comets', statmuseId: 16, name: "Houston Comets" },
            { id: 'miami-sol', slug: 'miami-sol', statmuseId: 17, name: "Miami Sol" },
            { id: 'portland-fire', slug: 'portland-fire', statmuseId: 18, name: "Portland Fire" },
            { id: 'sacramento-monarchs', slug: 'sacramento-monarchs', statmuseId: 19, name: "Sacramento Monarchs" },
            { id: 'utah-starzz', slug: 'utah-starzz', statmuseId: 9, name: "Utah Starzz" },
            { id: 'orlando-miracle', slug: 'orlando-miracle', statmuseId: 5, name: "Orlando Miracle" },
            { id: 'detroit-shock', slug: 'detroit-shock', statmuseId: 11, name: "Detroit Shock" }
        ]
    },
    mls: {
        name: 'MLS',
        table: 'mls_rosters',
        source: 'espn-html',
        espnSport: 'soccer',
        espnLeague: 'USA.MLS',
        teams: [
            { id: '18418', name: 'Atlanta United FC', slug: 'atlanta-united-fc', abbrev: 'ATL' },
            { id: '20906', name: 'Austin FC', slug: 'austin-fc', abbrev: 'ATX' },
            { id: '9720', name: 'CF Montréal', slug: 'cf-montreal', abbrev: 'MTL' },
            { id: '21300', name: 'Charlotte FC', slug: 'charlotte-fc', abbrev: 'CLT' },
            { id: '182', name: 'Chicago Fire FC', slug: 'chicago-fire-fc', abbrev: 'CHI' },
            { id: '184', name: 'Colorado Rapids', slug: 'colorado-rapids', abbrev: 'COL' },
            { id: '183', name: 'Columbus Crew', slug: 'columbus-crew', abbrev: 'CLB' },
            { id: '193', name: 'D.C. United', slug: 'dc-united', abbrev: 'DC' },
            { id: '18267', name: 'FC Cincinnati', slug: 'fc-cincinnati', abbrev: 'CIN' },
            { id: '185', name: 'FC Dallas', slug: 'fc-dallas', abbrev: 'DAL' },
            { id: '6077', name: 'Houston Dynamo FC', slug: 'houston-dynamo-fc', abbrev: 'HOU' },
            { id: '20232', name: 'Inter Miami CF', slug: 'inter-miami-cf', abbrev: 'MIA' },
            { id: '187', name: 'LA Galaxy', slug: 'la-galaxy', abbrev: 'LA' },
            { id: '18966', name: 'LAFC', slug: 'lafc', abbrev: 'LAFC' },
            { id: '17362', name: 'Minnesota United FC', slug: 'minnesota-united-fc', abbrev: 'MIN' },
            { id: '18986', name: 'Nashville SC', slug: 'nashville-sc', abbrev: 'NSH' },
            { id: '189', name: 'New England Revolution', slug: 'new-england-revolution', abbrev: 'NE' },
            { id: '17606', name: 'New York City FC', slug: 'new-york-city-fc', abbrev: 'NYC' },
            { id: '190', name: 'New York Red Bulls', slug: 'new-york-red-bulls', abbrev: 'RBNY' },
            { id: '12011', name: 'Orlando City SC', slug: 'orlando-city-sc', abbrev: 'ORL' },
            { id: '10739', name: 'Philadelphia Union', slug: 'philadelphia-union', abbrev: 'PHI' },
            { id: '9723', name: 'Portland Timbers', slug: 'portland-timbers', abbrev: 'POR' },
            { id: '4771', name: 'Real Salt Lake', slug: 'real-salt-lake', abbrev: 'RSL' },
            { id: '191', name: 'San Jose Earthquakes', slug: 'san-jose-earthquakes', abbrev: 'SJ' },
            { id: '9726', name: 'Seattle Sounders FC', slug: 'seattle-sounders-fc', abbrev: 'SEA' },
            { id: '186', name: 'Sporting Kansas City', slug: 'sporting-kansas-city', abbrev: 'SKC' },
            { id: '21812', name: 'St. Louis CITY SC', slug: 'st-louis-city-sc', abbrev: 'STL' },
            { id: '7318', name: 'Toronto FC', slug: 'toronto-fc', abbrev: 'TOR' },
            { id: '9727', name: 'Vancouver Whitecaps', slug: 'vancouver-whitecaps', abbrev: 'VAN' },
            { id: '22529', name: 'San Diego FC', slug: 'san-diego-fc', abbrev: 'SDFC' }
        ]
    },
    nwsl: {
        name: 'NWSL',
        table: 'nwsl_rosters',
        source: 'espn-html',
        espnSport: 'soccer',
        espnLeague: 'USA.NWSL',
        teams: [
            { id: '21422', name: 'Angel City FC', slug: 'angel-city-fc' },
            { id: '22187', name: 'Bay FC', slug: 'bay-fc' },
            { id: '15360', name: 'Chicago Stars FC', slug: 'chicago-stars-fc' },
            { id: '15364', name: 'Gotham FC', slug: 'gotham-fc' },
            { id: '17346', name: 'Houston Dash', slug: 'houston-dash' },
            { id: '20907', name: 'Kansas City Current', slug: 'kansas-city-current' },
            { id: '15366', name: 'North Carolina Courage', slug: 'north-carolina-courage' },
            { id: '18206', name: 'Orlando Pride', slug: 'orlando-city-sc' },
            { id: '15362', name: 'Portland Thorns FC', slug: 'portland-thorns-fc' },
            { id: '20905', name: 'Racing Louisville FC', slug: 'racing-louisville-fc' },
            { id: '21423', name: 'San Diego Wave FC', slug: 'san-diego-wave-fc' },
            { id: '15363', name: 'Seattle Reign FC', slug: 'usa.reignfc' },
            { id: '19141', name: 'Utah Royals', slug: 'utah-royals-fc' },
            { id: '15365', name: 'Washington Spirit', slug: 'washington-spirit' }
        ]
    },
    usl: {
        name: 'USL Championship',
        table: 'usl_rosters',
        source: 'espn-html',
        espnSport: 'soccer',
        espnLeague: 'USA.USL.1',
        teams: [
            { id: '19405', name: 'Birmingham Legion FC', slug: 'birmingham-legion-fc' },
            { id: '131579', name: 'Brooklyn FC', slug: 'brooklyn-fc' },
            { id: '9729', name: 'Charleston Battery', slug: 'charleston-battery' },
            { id: '17830', name: 'Colorado Springs Switchbacks', slug: 'colorado-springs-switchbacks-fc' },
            { id: '19179', name: 'Detroit City FC', slug: 'detroit-city-fc' },
            { id: '19407', name: 'El Paso Locomotive FC', slug: 'el-paso-locomotive-fc' },
            { id: '18446', name: 'FC Tulsa', slug: 'fc-tulsa' },
            { id: '19411', name: 'Hartford Athletic', slug: 'hartford-athletic' },
            { id: '17360', name: 'Indy Eleven', slug: 'indy-eleven' },
            { id: '18987', name: 'Las Vegas Lights FC', slug: 'las-vegas-lights-fc' },
            { id: '21822', name: 'Lexington SC', slug: 'lexington-sc' },
            { id: '19410', name: 'Loudoun United FC', slug: 'loudoun-united-fc' },
            { id: '17832', name: 'Louisville City FC', slug: 'louisville-city-fc' },
            { id: '19409', name: 'Memphis 901 FC', slug: 'memphis-901-fc' },
            { id: '18159', name: 'Miami FC', slug: 'miami-fc' },
            { id: '21370', name: 'Monterey Bay FC', slug: 'monterey-bay-fc' },
            { id: '19408', name: 'New Mexico United', slug: 'new-mexico-united' },
            { id: '9725', name: 'North Carolina FC', slug: 'north-carolina-fc' },
            { id: '20687', name: 'Oakland Roots SC', slug: 'oakland-roots-sc' },
            { id: '18455', name: 'Orange County SC', slug: 'orange-county-sc' },
            { id: '17850', name: 'Phoenix Rising FC', slug: 'phoenix-rising-fc' },
            { id: '17827', name: 'Pittsburgh Riverhounds', slug: 'pittsburgh-riverhounds-sc' },
            { id: '22164', name: 'Rhode Island FC', slug: 'rhode-island-fc' },
            { id: '17828', name: 'Sacramento Republic FC', slug: 'sacramento-republic-fc' },
            { id: '18265', name: 'San Antonio FC', slug: 'san-antonio-fc' },
            { id: '17361', name: 'Tampa Bay Rowdies', slug: 'tampa-bay-rowdies' }
        ]
    },
    'ncaa-football': {
        name: 'NCAA Football',
        table: 'ncaa_football_rosters',
        source: 'espn-api',
        espnSport: 'football',
        espnLeague: 'college-football',
        teams: [
            { id: '333', name: 'Alabama', slug: 'alabama-crimson-tide', conference: 'SEC' },
            { id: '8', name: 'Arkansas', slug: 'arkansas-razorbacks', conference: 'SEC' },
            { id: '2', name: 'Auburn', slug: 'auburn-tigers', conference: 'SEC' },
            { id: '57', name: 'Florida', slug: 'florida-gators', conference: 'SEC' },
            { id: '61', name: 'Georgia', slug: 'georgia-bulldogs', conference: 'SEC' },
            { id: '96', name: 'Kentucky', slug: 'kentucky-wildcats', conference: 'SEC' },
            { id: '99', name: 'LSU', slug: 'lsu-tigers', conference: 'SEC' },
            { id: '344', name: 'Mississippi State', slug: 'mississippi-state-bulldogs', conference: 'SEC' },
            { id: '142', name: 'Missouri', slug: 'missouri-tigers', conference: 'SEC' },
            { id: '201', name: 'Oklahoma', slug: 'oklahoma-sooners', conference: 'SEC' },
            { id: '145', name: 'Ole Miss', slug: 'ole-miss-rebels', conference: 'SEC' },
            { id: '2579', name: 'South Carolina', slug: 'south-carolina-gamecocks', conference: 'SEC' },
            { id: '2633', name: 'Tennessee', slug: 'tennessee-volunteers', conference: 'SEC' },
            { id: '251', name: 'Texas', slug: 'texas-longhorns', conference: 'SEC' },
            { id: '245', name: 'Texas A&M', slug: 'texas-am-aggies', conference: 'SEC' },
            { id: '238', name: 'Vanderbilt', slug: 'vanderbilt-commodores', conference: 'SEC' },
            { id: '130', name: 'Michigan', slug: 'michigan-wolverines', conference: 'Big Ten' },
            { id: '194', name: 'Ohio State', slug: 'ohio-state-buckeyes', conference: 'Big Ten' }
        ]
    },
    'ncaa-men-basketball': {
        name: 'NCAA Men Basketball',
        table: 'ncaa_basketball_rosters',
        source: 'espn-api',
        espnSport: 'basketball',
        espnLeague: 'mens-college-basketball',
        teams: [
            { id: '333', name: 'Alabama', slug: 'alabama-crimson-tide', conference: 'SEC' },
            { id: '150', name: 'Duke', slug: 'duke-blue-devils', conference: 'ACC' },
            { id: '153', name: 'North Carolina', slug: 'north-carolina-tar-heels', conference: 'ACC' },
            { id: '2305', name: 'Kansas', slug: 'kansas-jayhawks', conference: 'Big 12' }
        ]
    },
    'wnba-historical': {
        name: 'WNBA Historical',
        table: 'wnba_rosters',
        source: 'wikipedia',
        teams: [
            {
                id: 'las-vegas-aces', name: 'Las Vegas Aces', slug: 'las-vegas-aces', wikiMappings: [
                    { name: 'Utah_Starzz', untilYear: 2002 },
                    { name: 'San_Antonio_Silver_Stars', untilYear: 2013 },
                    { name: 'San_Antonio_Stars', untilYear: 2017 },
                    { name: 'Las_Vegas_Aces' }
                ]
            },
            {
                id: 'dallas-wings', name: 'Dallas Wings', slug: 'dallas-wings', wikiMappings: [
                    { name: 'Detroit_Shock', untilYear: 2009 },
                    { name: 'Tulsa_Shock', untilYear: 2015 },
                    { name: 'Dallas_Wings' }
                ]
            }
        ]
    },
    'milb-triplea': {
        name: 'MiLB Triple-A',
        table: 'milb_rosters',
        source: 'baseball-cube',
        teams: [] // Dynamic fetching via source
    }
};
