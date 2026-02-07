import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function escapeSql(str: string | null): string {
    if (!str) return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
}

async function seed() {
    console.log('Generating SQL for NCAA Seeding...');

    // 1. Load Data
    const conferenceMap = JSON.parse(readFileSync('conference_map.json', 'utf-8'));
    const ncaaData = JSON.parse(readFileSync('ncaa_data.json', 'utf-8')); // From API
    const teamsList = ncaaData.sports[0].leagues[0].teams.map((t: any) => t.team);

    // Create a map of API Team Name -> Team Data
    const apiTeamMap = new Map();
    teamsList.forEach((t: any) => {
        apiTeamMap.set(t.displayName, t);
        apiTeamMap.set(t.name, t);
        apiTeamMap.set(t.nickname, t);
    });

    // 2. Fetch Existing DB Data (We still use client for reads, usually allowed)
    const { data: existingConferences } = await supabase.from('conferences').select('id, name');
    const confMap = new Map(existingConferences?.map(c => [c.name, c.id]));

    const { data: existingTeams } = await supabase.from('teams').select('id, name').eq('league', 'ncaa');
    const teamMap = new Map(existingTeams?.map(t => [t.name, t.id]));

    let sqlOutput = '';

    // 3. Iterate and Seed
    for (const [confName, teamNames] of Object.entries(conferenceMap)) {
        let confId = confMap.get(confName);

        // Create Conference if missing
        if (!confId) {
            console.log(`Creating Conference SQL: ${confName}`);
            // Generate a new UUID for the conference if we can't insert it now.
            // But we need the ID for the teams.
            // So we must insert it first via SQL or just generate a random UUID locally.
            // Postgres has uuid_generate_v4() or gen_random_uuid().
            // But we need to know it for the FK.
            // So we will generate a UUID via crypto.randomUUID() in Node.

            confId = crypto.randomUUID();
            const div = confName === 'FBS Independents' ? 'FBS' : 'Division I';

            sqlOutput += `INSERT INTO conferences (id, name, league_id, division) VALUES ('${confId}', ${escapeSql(confName)}, 'ncaa', '${div}') ON CONFLICT (id) DO NOTHING;\n`;
            confMap.set(confName, confId);
        }

        // console.log(`Processing ${confName}...`);

        for (const teamName of (teamNames as string[])) {
            // Find API data
            let apiTeam = apiTeamMap.get(teamName);

            if (!apiTeam) {
                // console.warn(`  [MISSING API DATA] ${teamName}`);
                continue;
            }

            const logoUrl = apiTeam.logos?.[0]?.href || '';
            const primaryColor = apiTeam.color ? `#${apiTeam.color}` : null;
            const secondaryColor = apiTeam.alternateColor ? `#${apiTeam.alternateColor}` : null;

            const existingId = teamMap.get(teamName);

            if (existingId) {
                // Update
                sqlOutput += `UPDATE teams SET conference_id = '${confId}', logo_url = ${escapeSql(logoUrl)}, primary_color = ${escapeSql(primaryColor)}, secondary_color = ${escapeSql(secondaryColor)}, division = 'Division I', sport = 'Football' WHERE id = '${existingId}';\n`;
            } else {
                // Insert
                // Use random UUID for new team
                const newTeamId = crypto.randomUUID();
                sqlOutput += `INSERT INTO teams (id, name, league, conference_id, logo_url, primary_color, secondary_color, division, sport) VALUES ('${newTeamId}', ${escapeSql(teamName)}, 'ncaa', '${confId}', ${escapeSql(logoUrl)}, ${escapeSql(primaryColor)}, ${escapeSql(secondaryColor)}, 'Division I', 'Football');\n`;
            }
        }
    }

    writeFileSync('seed_ncaa.sql', sqlOutput);
    console.log('SQL Generated to seed_ncaa.sql');
}

seed().catch(console.error);
