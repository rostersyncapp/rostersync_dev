import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'logos';

const TEAMS = [
    { "name": "Buffalo Bisons", "logoUrl": "https://www.mlbstatic.com/team-logos/422.svg", "league_id": "IL" },
    { "name": "Charlotte Knights", "logoUrl": "https://www.mlbstatic.com/team-logos/494.svg", "league_id": "IL" },
    { "name": "Columbus Clippers", "logoUrl": "https://www.mlbstatic.com/team-logos/445.svg", "league_id": "IL" },
    { "name": "Durham Bulls", "logoUrl": "https://www.mlbstatic.com/team-logos/234.svg", "league_id": "IL" },
    { "name": "Gwinnett Stripers", "logoUrl": "https://www.mlbstatic.com/team-logos/431.svg", "league_id": "IL" },
    { "name": "Indianapolis Indians", "logoUrl": "https://www.mlbstatic.com/team-logos/484.svg", "league_id": "IL" },
    { "name": "Iowa Cubs", "logoUrl": "https://www.mlbstatic.com/team-logos/451.svg", "league_id": "IL" },
    { "name": "Jacksonville Jumbo Shrimp", "logoUrl": "https://www.mlbstatic.com/team-logos/564.svg", "league_id": "IL" },
    { "name": "Lehigh Valley IronPigs", "logoUrl": "https://www.mlbstatic.com/team-logos/1410.svg", "league_id": "IL" },
    { "name": "Louisville Bats", "logoUrl": "https://www.mlbstatic.com/team-logos/416.svg", "league_id": "IL" },
    { "name": "Memphis Redbirds", "logoUrl": "https://www.mlbstatic.com/team-logos/235.svg", "league_id": "IL" },
    { "name": "Nashville Sounds", "logoUrl": "https://www.mlbstatic.com/team-logos/556.svg", "league_id": "IL" },
    { "name": "Norfolk Tides", "logoUrl": "https://www.mlbstatic.com/team-logos/568.svg", "league_id": "IL" },
    { "name": "Omaha Storm Chasers", "logoUrl": "https://www.mlbstatic.com/team-logos/541.svg", "league_id": "IL" },
    { "name": "Rochester Red Wings", "logoUrl": "https://www.mlbstatic.com/team-logos/534.svg", "league_id": "IL" },
    { "name": "Scranton/Wilkes-Barre RailRiders", "logoUrl": "https://www.mlbstatic.com/team-logos/531.svg", "league_id": "IL" },
    { "name": "St. Paul Saints", "logoUrl": "https://www.mlbstatic.com/team-logos/1960.svg", "league_id": "IL" },
    { "name": "Syracuse Mets", "logoUrl": "https://www.mlbstatic.com/team-logos/552.svg", "league_id": "IL" },
    { "name": "Toledo Mud Hens", "logoUrl": "https://www.mlbstatic.com/team-logos/512.svg", "league_id": "IL" },
    { "name": "Worcester Red Sox", "logoUrl": "https://www.mlbstatic.com/team-logos/533.svg", "league_id": "IL" },
    { "name": "Albuquerque Isotopes", "logoUrl": "https://www.mlbstatic.com/team-logos/342.svg", "league_id": "PCL" },
    { "name": "El Paso Chihuahuas", "logoUrl": "https://www.mlbstatic.com/team-logos/4904.svg", "league_id": "PCL" },
    { "name": "Las Vegas Aviators", "logoUrl": "https://www.mlbstatic.com/team-logos/400.svg", "league_id": "PCL" },
    { "name": "Oklahoma City Comets", "logoUrl": "https://www.mlbstatic.com/team-logos/238.svg", "league_id": "PCL" },
    { "name": "Reno Aces", "logoUrl": "https://www.mlbstatic.com/team-logos/2310.svg", "league_id": "PCL" },
    { "name": "Round Rock Express", "logoUrl": "https://www.mlbstatic.com/team-logos/102.svg", "league_id": "PCL" },
    { "name": "Sacramento River Cats", "logoUrl": "https://www.mlbstatic.com/team-logos/105.svg", "league_id": "PCL" },
    { "name": "Salt Lake Bees", "logoUrl": "https://www.mlbstatic.com/team-logos/561.svg", "league_id": "PCL" },
    { "name": "Sugar Land Space Cowboys", "logoUrl": "https://www.mlbstatic.com/team-logos/5434.svg", "league_id": "PCL" },
    { "name": "Tacoma Rainiers", "logoUrl": "https://www.mlbstatic.com/team-logos/529.svg", "league_id": "PCL" }
];

function slugify(text: string): string {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function migrateLogos() {
    console.log(`Starting migration for ${TEAMS.length} teams...`);

    for (const team of TEAMS) {
        try {
            console.log(`Processing ${team.name}...`);

            // 1. Download logo
            const response = await fetch(team.logoUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get('content-type') || 'image/svg+xml';

            // 2. Prepare Storage Path
            const { data: existingTeams } = await supabase
                .from('milb_teams')
                .select('id')
                .eq('name', team.name);

            let teamId = existingTeams && existingTeams.length > 0 ? existingTeams[0].id : null;

            if (!teamId) {
                if (team.name === 'Oklahoma City Comets') {
                    const { data: okc } = await supabase.from('milb_teams').select('id').ilike('name', '%Oklahoma City Dodgers%');
                    if (okc && okc.length > 0) teamId = okc[0].id;
                }
            }

            if (!teamId) {
                teamId = `${slugify(team.name)}-current`;
                console.log(`Generated new ID for ${team.name}: ${teamId}`);
            }

            const fileName = `${teamId}.svg`;
            const storagePath = `teams/milb/${fileName}`;

            // 3. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;

            // 4. Update/Insert in Database
            const { error: dbError } = await supabase
                .from('milb_teams')
                .upsert({
                    id: teamId,
                    name: team.name,
                    display_name: team.name,
                    logo_url: publicUrl,
                    league_id: team.league_id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (dbError) throw dbError;

            console.log(`✅ Success: ${team.name} -> ${publicUrl}`);

        } catch (error: any) {
            console.error(`❌ Failed: ${team.name}`, error.message);
        }
    }
}

migrateLogos();
