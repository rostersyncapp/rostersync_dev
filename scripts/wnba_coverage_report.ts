#!/usr/bin/env ts-node
/**
 * WNBA Historical Roster Coverage Report
 * 
 * Analyzes the database to show which teams and seasons have been successfully seeded
 * and which are missing from the Wikipedia data.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const WNBA_TEAMS = [
    { id: 'atlanta-dream', name: 'Atlanta Dream', startYear: 2008 },
    { id: 'chicago-sky', name: 'Chicago Sky', startYear: 2006 },
    { id: 'connecticut-sun', name: 'Connecticut Sun', startYear: 1999 },
    { id: 'indiana-fever', name: 'Indiana Fever', startYear: 2000 },
    { id: 'new-york-liberty', name: 'New York Liberty', startYear: 1997 },
    { id: 'washington-mystics', name: 'Washington Mystics', startYear: 1998 },
    { id: 'dallas-wings', name: 'Dallas Wings', startYear: 2018 },
    { id: 'las-vegas-aces', name: 'Las Vegas Aces', startYear: 2018 },
    { id: 'los-angeles-sparks', name: 'Los Angeles Sparks', startYear: 1997 },
    { id: 'minnesota-lynx', name: 'Minnesota Lynx', startYear: 1999 },
    { id: 'phoenix-mercury', name: 'Phoenix Mercury', startYear: 1997 },
    { id: 'seattle-storm', name: 'Seattle Storm', startYear: 2000 },
];

async function generateCoverageReport() {
    console.log('\n📊 WNBA Historical Roster Coverage Report\n');
    console.log('='.repeat(80));

    // Get all seeded data
    const { data: allRosters, error } = await supabase
        .from('wnba_historical_rosters')
        .select('team_id, season_year, player_name, jersey_number')
        .order('team_id, season_year, player_name');

    if (error) {
        console.error('❌ Database error:', error);
        process.exit(1);
    }

    // Aggregate by team and season
    const coverageByTeam = new Map<string, Map<number, number>>();

    for (const row of allRosters || []) {
        if (!coverageByTeam.has(row.team_id)) {
            coverageByTeam.set(row.team_id, new Map());
        }
        const seasonMap = coverageByTeam.get(row.team_id)!;
        seasonMap.set(row.season_year, (seasonMap.get(row.season_year) || 0) + 1);
    }

    let totalPlayers = 0;
    let totalSeasons = 0;
    let missingSeasonsCount = 0;

    const currentYear = new Date().getFullYear();

    // Report by team
    for (const team of WNBA_TEAMS) {
        const seasonData = coverageByTeam.get(team.id);

        console.log(`\n🏀 ${team.name} (${team.startYear}-present)`);
        console.log('-'.repeat(80));

        if (!seasonData || seasonData.size === 0) {
            console.log('  ❌ NO DATA - No seasons seeded for this team');
            const expectedSeasons = currentYear - team.startYear;
            missingSeasonsCount += expectedSeasons;
            continue;
        }

        // Group seasons into ranges for cleaner output
        const seasons = Array.from(seasonData.keys()).sort((a, b) => a - b);
        const ranges: Array<{ start: number; end: number; players: number }> = [];

        let currentRange: { start: number; end: number; players: number } | null = null;

        for (const year of seasons) {
            const playerCount = seasonData.get(year)!;

            if (!currentRange) {
                currentRange = { start: year, end: year, players: playerCount };
            } else if (year === currentRange.end + 1) {
                currentRange.end = year;
            } else {
                ranges.push(currentRange);
                currentRange = { start: year, end: year, players: playerCount };
            }
        }

        if (currentRange) {
            ranges.push(currentRange);
        }

        // Display coverage ranges
        console.log('  ✅ Available Seasons:');
        for (const range of ranges) {
            if (range.start === range.end) {
                console.log(`    - ${range.start}: ${seasonData.get(range.start)} players`);
            } else {
                const avgPlayers = Math.round(
                    Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i)
                        .reduce((sum, year) => sum + (seasonData.get(year) || 0), 0) /
                    (range.end - range.start + 1)
                );
                console.log(`    - ${range.start}-${range.end}: ${range.end - range.start + 1} seasons (avg ${avgPlayers} players/season)`);
            }
        }

        // Check for missing seasons within the team's existence
        const missingSeasons: number[] = [];
        for (let year = team.startYear; year < currentYear; year++) {
            if (year >= 2024) continue; // Don't count future seasons as missing
            if (!seasonData.has(year)) {
                missingSeasons.push(year);
            }
        }

        if (missingSeasons.length > 0) {
            console.log('  ⚠️  Missing Seasons:');
            // Group missing seasons into ranges
            const missingRanges: Array<{ start: number; end: number }> = [];
            let currentMissing: { start: number; end: number } | null = null;

            for (const year of missingSeasons) {
                if (!currentMissing) {
                    currentMissing = { start: year, end: year };
                } else if (year === currentMissing.end + 1) {
                    currentMissing.end = year;
                } else {
                    missingRanges.push(currentMissing);
                    currentMissing = { start: year, end: year };
                }
            }

            if (currentMissing) {
                missingRanges.push(currentMissing);
            }

            for (const range of missingRanges) {
                if (range.start === range.end) {
                    console.log(`    - ${range.start}`);
                } else {
                    console.log(`    - ${range.start}-${range.end}`);
                }
            }

            missingSeasonsCount += missingSeasons.length;
        }

        const teamTotal = Array.from(seasonData.values()).reduce((a, b) => a + b, 0);
        console.log(`  📊 Total: ${seasonData.size} seasons, ${teamTotal} players`);

        totalPlayers += teamTotal;
        totalSeasons += seasonData.size;
    }

    // Overall summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 OVERALL SUMMARY\n');
    console.log(`✅ Total Seasons Seeded: ${totalSeasons}`);
    console.log(`👥 Total Player Records: ${totalPlayers}`);
    console.log(`⚠️  Missing Seasons: ${missingSeasonsCount}`);

    // Check for jersey number coverage
    const { data: jerseyStats } = await supabase
        .from('wnba_historical_rosters')
        .select('jersey_number')
        .not('jersey_number', 'is', null);

    const jerseyPercentage = jerseyStats ?
        ((jerseyStats.length / totalPlayers) * 100).toFixed(1) : '0.0';

    console.log(`🔢 Jersey Numbers: ${jerseyStats?.length || 0}/${totalPlayers} (${jerseyPercentage}%)`);

    console.log('\n' + '='.repeat(80));
}

generateCoverageReport()
    .then(() => {
        console.log('\n✅ Report Complete!\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
