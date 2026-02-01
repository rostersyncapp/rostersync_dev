
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

// Simple Title Case Helper (Copied from seed-all-teams.ts to match logic)
function toTitleCase(str: string) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    )
        .replace(/\bFc\b/g, 'FC') // Fix common acronyms
        .replace(/\bSc\b/g, 'SC')
        .replace(/\bRb\b/g, 'RB')
        .replace(/\bPsg\b/g, 'PSG')
        .replace(/\bNyc\b/g, 'NYC')
        .replace(/\bNy\b/g, 'NY')
        .replace(/\bLa\b/g, 'LA')
        .replace(/\bDc\b/g, 'DC')
        .replace(/\s*\(Fb\)\s*$/i, ''); // Strip (FB) suffix
}

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

    // Create a Set of all normalized names in the DB (Primary + Alt Names)
    const dbTeamNames = new Set<string>();

    // Also map primary name back to the DB record for checking
    const dbPrimaryMap = new Map<string, any>();

    for (const team of dbTeams) {
        const normalizedPrimary = team.name.toLowerCase().trim();
        dbTeamNames.add(normalizedPrimary);
        dbPrimaryMap.set(normalizedPrimary, team);

        if (team.alt_names && Array.isArray(team.alt_names)) {
            for (const alt of team.alt_names) {
                dbTeamNames.add(alt.toLowerCase().trim());
            }
        }
    }

    // 2. Check: In teamData.ts BUT NOT in DB
    // We need to simulate the "Primary Name" generation logic from seed-all-teams.ts
    // essentially converting the keys of ESPN_TEAM_IDS to Title Case and checking if they exist in DB (as primary or alt).

    const missingFromDb: string[] = [];

    const uniqueEspnIds = new Set<string>();

    for (const [rawName, meta] of Object.entries(ESPN_TEAM_IDS)) {
        // Skip dupe checks on ID if we just want to know if the CONCEPT of the team is there
        uniqueEspnIds.add(`${meta.league}:${meta.id}`);

        // The key in ESPN_TEAM_IDS is an alias. 
        // We expect this alias (converted to Title Case) to be either the Primary Name OR in Alt Names of a DB record.

        // Simulating the Title Case transformation that happens before insert
        const expectedName = toTitleCase(rawName).toLowerCase().trim();

        if (!dbTeamNames.has(expectedName)) {
            // Edge case: Sometimes the key in ESPN_TEAM_IDS is "ARSENAL" but DB has "Arsenal FC"
            // But if we seeded correctly, "Arsenal" should be an alt name.
            missingFromDb.push(rawName); // matched raw name for grep
        }
    }

    // 3. Reverse Check: Extra in DB?
    // This is harder because DB has "Manchester United", TS has "MAN UTD", "MANCHESTER UNITED", etc.
    // If a DB team has NO coverage in teamData.ts, it's "Extra".
    // Coverage means: Primary Name or Any Alt Name matches a Key in ESPN_TEAM_IDS (normalized).

    const tsKeysNormalized = new Set(Object.keys(ESPN_TEAM_IDS).map(k => toTitleCase(k).toLowerCase().trim()));
    const extraInDb: string[] = [];

    for (const team of dbTeams) {
        const pName = team.name.toLowerCase().trim();
        let covered = false;

        if (tsKeysNormalized.has(pName)) covered = true;

        if (!covered && team.alt_names) {
            for (const alt of team.alt_names) {
                if (tsKeysNormalized.has(alt.toLowerCase().trim())) {
                    covered = true;
                    break;
                }
            }
        }

        if (!covered) {
            extraInDb.push(team.name);
        }
    }

    // --- REPORT ---

    if (missingFromDb.length > 0) {
        console.log(`❌ ${missingFromDb.length} Keys in teamData.ts not found in Supabase (Need Seeding?):`);
        // Group by sport/league roughly?
        missingFromDb.slice(0, 20).forEach(t => console.log(`   - ${t}`));
        if (missingFromDb.length > 20) console.log(`   ...and ${missingFromDb.length - 20} more.`);
    } else {
        console.log('✅ All teamData.ts entries are covered in Supabase.');
    }

    console.log('');

    if (extraInDb.length > 0) {
        console.log(`⚠️  ${extraInDb.length} Teams in Supabase but NOT found in teamData.ts (Manual Adds?):`);
        extraInDb.slice(0, 20).forEach(t => console.log(`   - ${t}`));
        if (extraInDb.length > 20) console.log(`   ...and ${extraInDb.length - 20} more.`);
    } else {
        console.log('✅ All Supabase teams have matching definitions in teamData.ts.');
    }

    console.log('');
    console.log('Done.');
}

verifyTeams().catch(console.error);
