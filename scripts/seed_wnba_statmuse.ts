#!/usr/bin/env ts-node
/**
 * StatMuse WNBA Roster Scraper
 * 
 * Fetches high-fidelity roster data from StatMuse.
 * Supports current (2025) and historical seasons.
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match && !line.trim().startsWith('#')) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
        console.log('✅ Loaded .env file');
    }
} catch (e) {
    console.warn('⚠️ Could not load .env file');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface StatMuseTeam {
    id: string;
    slug: string;
    statmuseId: number;
}

const STATMUSE_TEAMS: StatMuseTeam[] = [
    { id: 'new-york-liberty', slug: 'new-york-liberty', statmuseId: 1 },
    { id: 'chicago-sky', slug: 'chicago-sky', statmuseId: 2 },
    { id: 'washington-mystics', slug: 'washington-mystics', statmuseId: 3 },
    { id: 'atlanta-dream', slug: 'atlanta-dream', statmuseId: 4 },
    { id: 'connecticut-sun', slug: 'connecticut-sun', statmuseId: 5 },
    { id: 'indiana-fever', slug: 'indiana-fever', statmuseId: 6 },
    { id: 'phoenix-mercury', slug: 'phoenix-mercury', statmuseId: 7 },
    { id: 'los-angeles-sparks', slug: 'los-angeles-sparks', statmuseId: 8 },
    { id: 'las-vegas-aces', slug: 'las-vegas-aces', statmuseId: 9 },
    { id: 'golden-state-valkyries', slug: 'golden-state-valkyries', statmuseId: 10 },
    { id: 'dallas-wings', slug: 'dallas-wings', statmuseId: 11 },
    { id: 'minnesota-lynx', slug: 'minnesota-lynx', statmuseId: 12 },
    { id: 'seattle-storm', slug: 'seattle-storm', statmuseId: 13 },
];

async function fetchStatMuseRoster(team: StatMuseTeam, year: number) {
    const url = `https://www.statmuse.com/wnba/team/${team.slug}-${team.statmuseId}/roster/${year}`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });

        if (!response.ok) {
            console.log(`  ⏭️  No data found for ${team.id} in ${year} (Status: ${response.status})`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const players: any[] = [];

        const table = $('table').first();
        if (!table.length) return [];

        table.find('tr').each((i, row) => {
            if (i === 0) return; // Skip header

            const cells = $(row).find('td');
            if (cells.length < 3) return;

            // StatMuse targets:
            // 0: No. (jersey)
            // 2: Player (Name) - targets the @lg:block span for full name
            // 3: Pos
            // 4: Ht
            // 5: Wt
            // 6: Birthdate
            // 8: College

            let jersey = cells.eq(0).text().trim();
            // Pad jersey number if it's a single digit (1-9)
            if (jersey && /^\d$/.test(jersey)) {
                jersey = `0${jersey}`;
            }

            // Target the span that usually has the full name (avoiding abbreviated initials)
            let name = cells.eq(2).find('span.@lg\\:block').text().trim();
            if (!name) name = cells.eq(2).find('a').first().text().trim();
            if (!name) name = cells.eq(2).text().trim();

            const pos = cells.eq(3).text().trim();
            const height = cells.eq(4).text().trim();
            const weight = cells.eq(5).text().trim();
            const dobRaw = cells.eq(6).text().trim();
            const college = cells.eq(8).text().trim();

            if (!name || name.toLowerCase() === 'player') return;

            // Clean DOB (StatMuse uses MM/DD/YYYY)
            let birthDate = null;
            if (dobRaw && dobRaw.includes('/')) {
                const parts = dobRaw.split('/');
                if (parts.length === 3) {
                    birthDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                }
            }

            players.push({
                team_id: team.id,
                season_year: year,
                player_name: name,
                jersey_number: jersey || null,
                position: pos || null,
                height: height || null,
                weight: weight || null,
                birth_date: birthDate,
                college: college || null,
                status: 'active'
            });
        });

        return players;
    } catch (error) {
        console.error(`  ❌ Error fetching ${team.id}:`, error);
        return [];
    }
}

async function seedStatMuse(startYear?: number, endYear?: number) {
    const sYear = startYear || 1997;
    const eYear = endYear || 2026;

    console.log(`\n💎 StatMuse WNBA Seeding & Cleanup\n📅 ${sYear} - ${eYear}\n`);

    const summary: any[] = [];

    for (const team of STATMUSE_TEAMS) {
        console.log(`\n🏆 ${team.id.toUpperCase()}`);
        let teamSaved = 0;
        let teamMissingYears: number[] = [];

        for (let year = sYear; year <= eYear; year++) {
            process.stdout.write(`  📆 Season ${year}... `);
            const players = await fetchStatMuseRoster(team, year);

            if (players.length > 0) {
                const { error } = await supabase
                    .from('wnba_rosters')
                    .upsert(players, {
                        onConflict: 'team_id,season_year,player_name',
                        ignoreDuplicates: false // We WANT to overwrite with StatMuse data (high fidelity)
                    });

                if (error) {
                    process.stdout.write(`❌ DB Error\n`);
                    console.error(`      ${error.message}`);
                } else {
                    process.stdout.write(`✅ Saved ${players.length} players\n`);
                    teamSaved += players.length;
                }
            } else {
                process.stdout.write(`⏭️  No data\n`);
                teamMissingYears.push(year);
            }
            await new Promise(res => setTimeout(res, 600)); // Slower to avoid rate limits
        }

        summary.push({
            team: team.id,
            totalSaved: teamSaved,
            missing: teamMissingYears
        });
    }

    // Final Summary Report
    console.log('\n' + '='.repeat(100));
    console.log(`📊 SEEDING SUMMARY REPORT (${sYear}-${eYear})`);
    console.log('='.repeat(100));

    summary.forEach(s => {
        const missingStr = s.missing.length > 0 ? `❌ Missing: ${s.missing.join(', ')}` : '✅ All seasons present';
        console.log(`${s.team.padEnd(25)} | 👥 ${s.totalSaved.toString().padStart(4)} players | ${missingStr}`);
    });
    console.log('='.repeat(100));
}

const args = process.argv.slice(2);
const start = args[0] ? parseInt(args[0]) : undefined;
const end = args[1] ? parseInt(args[1]) : undefined;

seedStatMuse(start, end)
    .then(() => {
        console.log('\n✅ StatMuse Seeding & Cleanup Complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
