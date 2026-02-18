
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEAM_ESPN_IDS: Record<string, number> = {
    'atlanta-dream': 20,
    'chicago-sky': 19,
    'connecticut-sun': 18,
    'indiana-fever': 5,
    'new-york-liberty': 9,
    'washington-mystics': 16,
    'dallas-wings': 3,
    'las-vegas-aces': 17,
    'los-angeles-sparks': 6,
    'minnesota-lynx': 8,
    'phoenix-mercury': 11,
    'seattle-storm': 14,
    'charlotte-sting': 1,
    'cleveland-rockers': 2,
    'detroit-shock': 12,
    'houston-comets': 4,
    'miami-sol': 7,
    'orlando-miracle': 10,
    'portland-fire': 132052,
    'sacramento-monarchs': 13,
    'san-antonio-stars': 17,
    'tulsa-shock': 2793,
    'utah-starzz': 15
};

async function enrichRoster(teamId: string, season: number) {
    const espnId = TEAM_ESPN_IDS[teamId];
    if (!espnId) {
        console.warn(`No ESPN ID for ${teamId}`);
        return;
    }

    const athletesUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/wnba/seasons/${season}/teams/${espnId}/athletes`;

    console.log(`\n🔍 Fetching athletes for ${teamId} (${season})...`);
    try {
        const res = await fetch(athletesUrl);
        if (!res.ok) {
            console.error(`  Failed to fetch athlete list: ${res.statusText}`);
            return;
        }
        const data: any = await res.json();
        const athleteRefs = data.items || [];
        console.log(`  Found ${athleteRefs.length} athletes.`);

        for (const ref of athleteRefs) {
            try {
                const athleteRes = await fetch(ref.$ref);
                if (!athleteRes.ok) continue;
                const player: any = await athleteRes.json();

                // Convert height from inches if displayHeight is missing
                let heightStr = player.displayHeight;
                if (!heightStr && player.height) {
                    const ft = Math.floor(player.height / 12);
                    const inch = Math.round(player.height % 12);
                    heightStr = `${ft}' ${inch}"`;
                }

                const record = {
                    team_id: teamId,
                    season_year: season,
                    player_name: player.fullName,
                    player_id: player.id,
                    jersey_number: player.jersey || null,
                    position: player.position?.abbreviation || player.position?.name || null,
                    height: heightStr || null,
                    weight: player.displayWeight || (player.weight ? `${player.weight} lbs` : null),
                    birth_date: player.dateOfBirth ? player.dateOfBirth.split('T')[0] : null,
                    years_pro: player.experience?.years || null,
                    status: 'active'
                };

                const { error } = await supabase
                    .from('wnba_rosters')
                    .upsert(record, {
                        onConflict: 'team_id,season_year,player_name'
                    });

                if (error) {
                    console.error(`  ❌ Error updating ${player.fullName}:`, error.message);
                } else {
                    console.log(`  ✅ Enriched ${player.fullName}`);
                }
            } catch (err: any) {
                console.error(`  ❌ Failed to process athlete ref: ${err.message}`);
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (err: any) {
        console.error(`  ❌ Error for ${teamId} ${season}:`, err.message);
    }
}

async function main() {
    const targets = [
        { team: 'atlanta-dream', season: 2008 },
        { team: 'chicago-sky', season: 2006 },
        { team: 'chicago-sky', season: 2007 },
        { team: 'chicago-sky', season: 2008 },
        { team: 'houston-comets', season: 2005 },
        { team: 'houston-comets', season: 2006 },
        { team: 'houston-comets', season: 2007 },
        { team: 'charlotte-sting', season: 2003 },
        { team: 'charlotte-sting', season: 2004 },
        { team: 'charlotte-sting', season: 2005 },
        { team: 'detroit-shock', season: 2003 },
        { team: 'detroit-shock', season: 2004 },
        { team: 'detroit-shock', season: 2005 },
        { team: 'detroit-shock', season: 2006 },
        { team: 'detroit-shock', season: 2007 },
        { team: 'sacramento-monarchs', season: 2002 },
        { team: 'sacramento-monarchs', season: 2003 },
        { team: 'sacramento-monarchs', season: 2004 },
        { team: 'sacramento-monarchs', season: 2005 },
        { team: 'sacramento-monarchs', season: 2006 },
        { team: 'sacramento-monarchs', season: 2007 },
        { team: 'cleveland-rockers', season: 2003 },
        { team: 'utah-starzz', season: 2002 },
        { team: 'portland-fire', season: 2002 }
    ];

    for (const target of targets) {
        await enrichRoster(target.team, target.season);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n🏁 Enrichment complete.');
}

main();
