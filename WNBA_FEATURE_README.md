# WNBA Historical Rosters Feature

This feature allows users to browse and export WNBA team rosters from the league's inception in 1997 through the present day.

## Features

- **Complete Team Coverage**: All 26 WNBA teams (13 active, 13 historical)
- **Historical Data**: Roster data from 1997 season onward
- **Player Details**: Jersey numbers, positions, height, college, years of experience
- **Export Options**: All existing export formats (CSV, JSON, XML for various broadcast systems)
- **Search & Filter**: Search players by name, jersey number, or position

## Database Schema

### Tables

1. **`wnba_teams`** - Stores all WNBA teams (active and defunct)
   - Team ID, name, abbreviation, location
   - Colors and logos
   - Foundation year and active status

2. **`wnba_rosters`** - Stores player roster data
   - Player name, jersey number, position
   - Height, weight, birth date
   - College and years pro
   - Team and season year (foreign key)

### Key Indexes

- `idx_wnba_rosters_team_season` - Fast lookup by team and season
- `idx_wnba_rosters_season` - Season-based queries
- `idx_wnba_rosters_player` - Player name searches

## Components

### WNBARosterSelector
Main component for browsing and exporting rosters.

```tsx
import { WNBARosterSelector } from './components/WNBARosterSelector';

<WNBARosterSelector 
  subscriptionTier="PRO"
  onRosterSelect={(athletes, teamName, metadata) => {
    // Handle selected roster
  }}
/>
```

### WNBAPage
Example page implementation with full integration.

```tsx
import { WNBAPage } from './components/WNBAPage';

<WNBAPage subscriptionTier="PRO" />
```

## Services

### wnbaData.ts

Core service functions:

- `getWNBATeams()` - Fetch all teams
- `getWNBATeamSeasons(teamId)` - Get available seasons for a team
- `getWNBARoster(teamId, seasonYear)` - Fetch roster for team/season
- `getWNBARosterData(teamId, seasonYear)` - Complete roster with team info
- `convertWNBAPlayersToAthletes(players, seasonYear)` - Convert to Athlete type
- `getWNBATeamMetadata(team)` - Get metadata for exports

## Data Population

### StatMuse Scraper (Recommended)

The most accurate source for 2025 and historical data is StatMuse:

```bash
# Seed 2025 rosters for all teams (default)
npx tsx scripts/seed_wnba_statmuse.ts

# Seed specific range (e.g., 2020 to 2024)
npx tsx scripts/seed_wnba_statmuse.ts 2020 2024
```

### ESPN Seeding Script

Run the legacy seeding script to populate data from ESPN:

```bash
# Seed all teams and all seasons
npx ts-node scripts/seed-wnba-rosters.ts
```

### Wikipedia Historical Scraper

For deep historical data (1997-present), you can also use:

```bash
# Seed specific range from Wikipedia
npx ts-node scripts/seed_wnba_historical.ts 2000 2024
```

**Note**: The seeding script fetches data from ESPN's API. Early historical data (1997-2000s) may be incomplete.

## ESPN API Integration

The system fetches roster data from ESPN's public API:

```
https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/{team_id}/roster?season={year}
```

Rate limiting is implemented (500ms between requests, 1000ms between teams) to be respectful to ESPN's servers.

## Export Formats

All existing export formats are supported:

| Format | Tier Required | Description |
|--------|--------------|-------------|
| CSV_FLAT | BASIC | Simple CSV with player data |
| ICONIK_JSON | PRO | Iconik MAM metadata format |
| CATDV_JSON | PRO | CatDV MAM metadata format |
| ROSS_XML | PRO | Ross Video Xpression format |
| VIZRT_JSON | PRO | Vizrt JSON format |
| CHYRON_CSV | STUDIO | Chyron Prime format |
| NEWBLUE_CSV | STUDIO | NewBlue Titler format |
| TAGBOARD_CSV | STUDIO | Tagboard DDG format |
| VIZRT_XML | NETWORK | Vizrt XML format |
| VIZRT_DATACENTER_CSV | NETWORK | Vizrt DataCenter format |

## Database Migrations

Run the migration to create tables:

```bash
# Using Supabase CLI
supabase db push

# Or run the SQL file directly
supabase sql < supabase/migrations/20250211000000_create_wnba_historical_rosters.sql
```

## Integration Example

Add to your router/navigation:

```tsx
// In your main App.tsx or router
import { WNBAPage } from './components/WNBAPage';

// Add route
<Route path="/wnba-rosters" element={<WNBAPage subscriptionTier={userTier} />} />
```

Add to navigation menu:

```tsx
// In your navigation component
{
  name: 'WNBA Rosters',
  icon: <Users size={20} />,
  id: 'wnba-rosters'
}
```

## Data Completeness

### Expected Data Availability

- **2020-Present**: Complete rosters for all active teams
- **2010-2019**: Good coverage, may have minor gaps
- **2000-2009**: Partial coverage, varies by team
- **1997-1999**: Limited coverage, historical teams may have better data

### Teams with Best Historical Data

- Los Angeles Sparks (1997-present)
- New York Liberty (1997-present)
- Phoenix Mercury (1997-present)
- Houston Comets (1997-2008) - historical

### Teams with Limited Data

- Defunct teams may have incomplete rosters for final seasons
- Expansion teams (Atlanta 2008, Chicago 2006, etc.) won't have pre-foundation data

## Troubleshooting

### No Data for Team/Season

1. Check if team existed in that season (expansion teams)
2. Run seeding script for specific team/season
3. Some early seasons (1997-2000) have limited ESPN data

### Export Not Working

1. Verify user subscription tier supports format
2. Check that roster has players selected
3. Review browser console for errors

### Missing Historical Teams

Historical teams are included but marked as inactive:
- Charlotte Sting (1997-2006)
- Cleveland Rockers (1997-2003)
- Detroit Shock (1998-2009)
- Houston Comets (1997-2008)
- Miami Sol (2000-2002)
- Orlando Miracle (1999-2002)
- Portland Fire (2000-2002)
- Sacramento Monarchs (1997-2009)
- San Antonio Stars (2003-2017)
- Tulsa Shock (2010-2015)
- Utah Starzz (1997-2002)

## Future Enhancements

- [ ] Player headshot URLs
- [ ] Career statistics integration
- [ ] Team season records
- [ ] Playoff roster flags
- [ ] All-Star game rosters
- [ ] Draft history integration
