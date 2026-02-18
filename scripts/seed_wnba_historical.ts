#!/usr/bin/env ts-node
/**
 * WNBA Historical Roster Seeding Script - Wikipedia Scraper (Supreme Version)
 * 
 * Populates the wnba_historical_rosters table with data from Wikipedia.
 * Handles relocations, name changes, complex templates, and diverse table structures.
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface WikiMapping { name: string; untilYear?: number; }
interface TeamConfig { id: string; wikiMappings: WikiMapping[]; startYear: number; endYear: number | null; }

const WNBA_TEAMS: TeamConfig[] = [
    { id: 'atlanta-dream', startYear: 2008, endYear: null, wikiMappings: [{ name: 'Atlanta_Dream' }] },
    { id: 'chicago-sky', startYear: 2006, endYear: null, wikiMappings: [{ name: 'Chicago_Sky' }] },
    {
        id: 'connecticut-sun', startYear: 1999, endYear: null, wikiMappings: [
            { name: 'Orlando_Miracle', untilYear: 2002 },
            { name: 'Connecticut_Sun' }
        ]
    },
    { id: 'indiana-fever', startYear: 2000, endYear: null, wikiMappings: [{ name: 'Indiana_Fever' }] },
    { id: 'new-york-liberty', startYear: 1997, endYear: null, wikiMappings: [{ name: 'New_York_Liberty' }] },
    { id: 'washington-mystics', startYear: 1998, endYear: null, wikiMappings: [{ name: 'Washington_Mystics' }] },
    {
        id: 'dallas-wings', startYear: 1998, endYear: null, wikiMappings: [
            { name: 'Detroit_Shock', untilYear: 2009 },
            { name: 'Tulsa_Shock', untilYear: 2015 },
            { name: 'Dallas_Wings' }
        ]
    },
    {
        id: 'las-vegas-aces', startYear: 1997, endYear: null, wikiMappings: [
            { name: 'Utah_Starzz', untilYear: 2002 },
            { name: 'San_Antonio_Silver_Stars', untilYear: 2013 },
            { name: 'San_Antonio_Stars', untilYear: 2017 },
            { name: 'Las_Vegas_Aces' }
        ]
    },
    { id: 'los-angeles-sparks', startYear: 1997, endYear: null, wikiMappings: [{ name: 'Los_Angeles_Sparks' }] },
    { id: 'minnesota-lynx', startYear: 1999, endYear: null, wikiMappings: [{ name: 'Minnesota_Lynx' }] },
    { id: 'phoenix-mercury', startYear: 1997, endYear: null, wikiMappings: [{ name: 'Phoenix_Mercury' }] },
    { id: 'seattle-storm', startYear: 2000, endYear: null, wikiMappings: [{ name: 'Seattle_Storm' }] },
    // Defunct / Historical Teams
    { id: 'charlotte-sting', startYear: 1997, endYear: 2006, wikiMappings: [{ name: 'Charlotte_Sting' }] },
    { id: 'cleveland-rockers', startYear: 1997, endYear: 2003, wikiMappings: [{ name: 'Cleveland_Rockers' }] },
    { id: 'houston-comets', startYear: 1997, endYear: 2008, wikiMappings: [{ name: 'Houston_Comets' }] },
    { id: 'miami-sol', startYear: 2000, endYear: 2002, wikiMappings: [{ name: 'Miami_Sol' }] },
    { id: 'portland-fire', startYear: 2000, endYear: 2002, wikiMappings: [{ name: 'Portland_Fire' }] },
    { id: 'sacramento-monarchs', startYear: 1997, endYear: 2009, wikiMappings: [{ name: 'Sacramento_Monarchs' }] },
    { id: 'orlando-miracle', startYear: 1999, endYear: 2002, wikiMappings: [{ name: 'Orlando_Miracle' }] },
    { id: 'detroit-shock', startYear: 1998, endYear: 2009, wikiMappings: [{ name: 'Detroit_Shock' }] },
    { id: 'tulsa-shock', startYear: 2010, endYear: 2015, wikiMappings: [{ name: 'Tulsa_Shock' }] },
    { id: 'utah-starzz', startYear: 1997, endYear: 2002, wikiMappings: [{ name: 'Utah_Starzz' }] },
    { id: 'san-antonio-stars', startYear: 2003, endYear: 2017, wikiMappings: [{ name: 'San_Antonio_Stars' }] }
];

interface WNBARosterEntry {
    team_id: string; season_year: number; player_name: string; player_id: string | null;
    jersey_number: string | null; position: string | null; height: string | null; weight: string | null;
    birth_date: string | null; college: string | null; years_pro: number | null;
    hardware_safe_name: string;
}

function cleanText(text: string): string {
    return text.replace(/\[\d+\]/g, '').replace(/[\n\t\r]/g, ' ').trim();
}

function getWikiNameForYear(team: TeamConfig, year: number): string {
    const mapping = team.wikiMappings.find(m => !m.untilYear || year <= m.untilYear);
    return mapping ? mapping.name : team.wikiMappings[team.wikiMappings.length - 1].name;
}

async function fetchWikipediaRoster(teamId: string, teamWikiName: string, seasonYear: number): Promise<WNBARosterEntry[]> {
    const url = `https://en.wikipedia.org/wiki/${seasonYear}_${teamWikiName}_season`;

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const players: WNBARosterEntry[] = [];

        // 1. Find the best candidate table
        let rosterTable = $('table').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes('pos.') && (text.includes('no.') || text.includes('number')) && (text.includes('player') || text.includes('name'));
        }).first();

        let isStatsTable = false;
        if (rosterTable.length === 0) {
            const rosterHeader = $('h2, h3').filter((i, el) => {
                const text = $(el).text().toLowerCase();
                return text.includes('roster') || text.includes('players');
            }).first();
            if (rosterHeader.length > 0) rosterTable = rosterHeader.nextAll('table').first();
        }

        if (rosterTable.length === 0) {
            rosterTable = $('table').filter((i, el) => {
                const text = $(el).text().toLowerCase();
                const hasPlayer = text.includes('player') || text.includes('name');
                const hasStats = text.includes('gp') || text.includes('games played');
                const hasPoints = text.includes('pts') || text.includes('points');
                return hasPlayer && hasStats && hasPoints;
            }).first();
            if (rosterTable.length > 0) isStatsTable = true;
        }

        if (rosterTable.length === 0) return [];

        // 2. Dynamic Column Mapping
        let posCol = -1, numCol = -1, nameCol = -1, heightCol = -1, weightCol = -1, dobCol = -1, fromCol = -1, yrsCol = -1;
        const headerRows = rosterTable.find('tr').slice(0, 5);
        headerRows.each((i, row) => {
            const cells = $(row).find('th, td');
            cells.each((j, cell) => {
                const text = $(cell).text().trim().toLowerCase().replace(/[^a-z. ]/g, '');
                if (text.match(/^(pos\.|pos|position)$/)) posCol = j;
                if (text.match(/^(no\.|no|number)$/)) numCol = j;
                if (text.match(/^(name|player)$/)) nameCol = j;
                if (text.match(/^(height|ht)$/)) heightCol = j;
                if (text.match(/^(weight|wt)$/)) weightCol = j;
                if (text.match(/^(dob|birth date|date of birth)$/)) dobCol = j;
                if (text.match(/^(from|college|school)$/)) fromCol = j;
                if (text.match(/^(yrs|exp|yrs pro)$/)) yrsCol = j;
            });
            if (nameCol !== -1) return false;
        });

        if (nameCol === -1) return [];

        // 3. Parse Rows
        rosterTable.find('tr').each((index, row) => {
            const cells = $(row).find('th, td'); // Stats tables often have names in TH
            if (cells.length > nameCol) {
                const playerName = cleanText(cells.eq(nameCol).text());
                if (!playerName || playerName.toLowerCase().match(/^(player|name|total|totals|team|team total|opponents)$/)) return;

                const position = posCol !== -1 ? cleanText(cells.eq(posCol).text()) : null;
                let jerseyNum = numCol !== -1 ? cleanText(cells.eq(numCol).text()) : null;

                // Pad jersey number if it's a single digit (1-9)
                if (jerseyNum && /^\d$/.test(jerseyNum)) {
                    jerseyNum = `0${jerseyNum}`;
                }

                const height = heightCol !== -1 ? cleanText(cells.eq(heightCol).text()) : null;
                const weight = weightCol !== -1 ? cleanText(cells.eq(weightCol).text()) : null;
                const dobText = dobCol !== -1 ? cleanText(cells.eq(dobCol).text()) : null;
                const college = fromCol !== -1 ? cleanText(cells.eq(fromCol).text()) : null;
                const yearsText = yrsCol !== -1 ? cleanText(cells.eq(yrsCol).text()) : '';

                let yearsPro: number | null = null;
                if (yearsText === 'R') yearsPro = 0;
                else if (/^\d+$/.test(yearsText)) yearsPro = parseInt(yearsText);

                let birthDate: string | null = null;
                const dobMatch = dobText?.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (dobMatch) birthDate = dobMatch[0];

                players.push({
                    team_id: teamId, season_year: seasonYear, player_name: playerName, player_id: null,
                    jersey_number: jerseyNum, position, height, weight, birth_date: birthDate, college, years_pro: yearsPro,
                    hardware_safe_name: playerName.toUpperCase(),
                });
            }
        });

        const uniquePlayersMap = new Map<string, WNBARosterEntry>();
        players.forEach(p => {
            const nameKey = p.player_name.toLowerCase().trim();
            if (!uniquePlayersMap.has(nameKey)) uniquePlayersMap.set(nameKey, p);
        });

        const result = Array.from(uniquePlayersMap.values());
        console.log(`  ✅ Found ${result.length} unique players${isStatsTable ? ' (from stats table)' : ''}`);
        return result;
    } catch (error) { return []; }
}

async function seedAllTeams() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const teamArg = args.find(arg => arg.startsWith('--team='))?.split('=')[1];
    const startYearArg = args.find(arg => arg.startsWith('--start='))?.split('=')[1];
    const endYearArg = args.find(arg => arg.startsWith('--end='))?.split('=')[1];

    const seedStartYear = startYearArg ? parseInt(startYearArg) : 1997;
    const seedEndYear = endYearArg ? parseInt(endYearArg) : 2025;

    console.log(`\n🏀 WNBA Historical Roster Seeding (Supreme)\n📅 ${seedStartYear} - ${seedEndYear}\n`);

    const teamsToProcess = teamArg
        ? WNBA_TEAMS.filter(t => t.id === teamArg)
        : WNBA_TEAMS;

    if (teamsToProcess.length === 0) {
        console.log(`❌ No teams found matching: ${teamArg}`);
        return;
    }

    for (const team of teamsToProcess) {
        const teamStartYear = Math.max(team.startYear, seedStartYear);
        const teamEndYear = team.endYear ? Math.min(team.endYear, seedEndYear) : seedEndYear;
        console.log(`\n🏆 ${team.id.toUpperCase()}`);

        for (let year = teamStartYear; year <= teamEndYear; year++) {
            const wikiName = getWikiNameForYear(team, year);
            console.log(`\n  📆 Season ${year} (${wikiName.replace(/_/g, ' ')})`);
            const players = await fetchWikipediaRoster(team.id, wikiName, year);
            if (players.length > 0) {
                const { error } = await supabase.from('wnba_rosters').upsert(players, { onConflict: 'team_id,season_year,player_name' });
                if (error) console.error(`  ❌ Database error:`, error);
                else console.log(`  💾 Saved ${players.length} players`);
            }
            await new Promise(res => setTimeout(res, 1500));
        }
    }
    console.log(`\n✅ Seeding Complete!`);
}

seedAllTeams()
    .then(() => process.exit(0))
    .catch(error => { console.error('\n❌ Fatal error:', error); process.exit(1); });
