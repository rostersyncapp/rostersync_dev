
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ESPN_TEAM_IDS, KNOWN_TEAM_LOGOS } from '../services/teamData.ts';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Make sure .env file exists and contains these keys.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyTeams() {
    console.log('\n🔍 Verifying Team Data Integrity...\n');

    // 1. Fetch all teams from Supabase
    const { data: dbTeams, error } = await supabase
        .from('teams')
        .select('*');

    if (error) {
        console.error('Error fetching teams from DB:', error);
        return;
    }

    if (!dbTeams) {
        console.error('No teams found in database.');
        return;
    }

    console.log(`📊 Database contains ${dbTeams.length} teams.`);
    console.log(`📄 teamData.ts contains ${Object.keys(ESPN_TEAM_IDS).length} ESPN IDs and ${Object.keys(KNOWN_TEAM_LOGOS).length} Logos.\n`);

    const dbTeamMap = new Map(dbTeams.map(t => [t.name.toUpperCase(), t]));
    const espnIdMap = new Map(Object.entries(ESPN_TEAM_IDS));
    const logoMap = new Map(Object.entries(KNOWN_TEAM_LOGOS));

    // 2. Check: In teamData.ts BUT NOT in DB (Missing from seeded DB)
    const missingFromDb: string[] = [];
    for (const teamName of espnIdMap.keys()) {
        if (!dbTeamMap.has(teamName)) {
            missingFromDb.push(teamName);
        }
    }

    // 3. Check: In DB BUT NOT in teamData.ts (Orphaned / Not Syncable)
    const extraInDb: string[] = [];
    const dbMismatch: string[] = [];

    for (const team of dbTeams) {
        const nameUpper = team.name.toUpperCase();

        // Check existence
        if (!espnIdMap.has(nameUpper)) {
            extraInDb.push(team.name);
        } else {
            // Check branding mismatch
            const knownLogo = logoMap.get(nameUpper);
            if (knownLogo) {
                if (knownLogo.logoUrl !== team.logo_url) {
                    // dbMismatch.push(`${team.name} Logo Mismatch:\n   TS: ${knownLogo.logoUrl}\n   DB: ${team.logo_url}`);
                }
                if (knownLogo.primaryColor.toLowerCase() !== (team.primary_color || '').toLowerCase()) {
                    // dbMismatch.push(`${team.name} Color Mismatch:\n   TS: ${knownLogo.primaryColor}\n   DB: ${team.primary_color}`);
                }
            }
        }
    }

    // --- REPORT ---

    if (missingFromDb.length > 0) {
        console.log(`❌ ${missingFromDb.length} Teams in teamData.ts but NOT in Supabase (Need Seeding):`);
        missingFromDb.slice(0, 20).forEach(t => console.log(`   - ${t}`));
        if (missingFromDb.length > 20) console.log(`   ...and ${missingFromDb.length - 20} more.`);
    } else {
        console.log('✅ All teams in teamData.ts are present in Supabase.');
    }

    console.log('');

    if (extraInDb.length > 0) {
        console.log(`⚠️  ${extraInDb.length} Teams in Supabase but NOT in teamData.ts (Manual Adds / Renames?):`);
        extraInDb.slice(0, 20).forEach(t => console.log(`   - ${t}`));
        if (extraInDb.length > 20) console.log(`   ...and ${extraInDb.length - 20} more.`);
    } else {
        console.log('✅ All Supabase teams have definitions in teamData.ts.');
    }

    console.log('');
    console.log('Done.');
}

verifyTeams().catch(console.error);
