import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const LOGO_MAPPING: Record<string, string> = {
    // International League
    "Buffalo Bisons": "https://content.sportslogos.net/logos/36/924/thumbs/92450192013.gif",
    "Charlotte Knights": "https://content.sportslogos.net/logos/36/925/thumbs/92525922023.gif",
    "Columbus Clippers": "https://content.sportslogos.net/logos/36/926/thumbs/oigtz32bhlkqf7160weumhwnl.gif",
    "Durham Bulls": "https://content.sportslogos.net/logos/36/927/thumbs/4516.gif",
    "Gwinnett Stripers": "https://content.sportslogos.net/logos/36/6650/thumbs/665092762018.gif",
    "Gwinnett Braves": "https://content.sportslogos.net/logos/36/6650/thumbs/665092762018.gif",
    "Indianapolis Indians": "https://content.sportslogos.net/logos/36/928/thumbs/indianapolis-indians-logo-primary-2026-92893142026-thumb.png",
    "Iowa Cubs": "https://content.sportslogos.net/logos/36/6870/thumbs/687077902021.gif",
    "Lehigh Valley IronPigs": "https://content.sportslogos.net/logos/36/2548/thumbs/j0nleuh257g5ewoykfrb44oz6.gif",
    "Louisville Bats": "https://content.sportslogos.net/logos/36/929/thumbs/92912362016.gif",
    "Louisville RiverBats": "https://content.sportslogos.net/logos/36/929/thumbs/92912362016.gif",
    "Memphis Redbirds": "https://content.sportslogos.net/logos/36/6871/thumbs/687171292021.gif",
    "Nashville Sounds": "https://content.sportslogos.net/logos/36/6873/thumbs/687372062021.gif",
    "Norfolk Tides": "https://content.sportslogos.net/logos/36/930/thumbs/norfolk-tides-logo-primary-2016-2883-thumb.png",
    "Omaha Storm Chasers": "https://content.sportslogos.net/logos/36/6874/thumbs/687497082021.gif",
    "Omaha Royals": "https://content.sportslogos.net/logos/36/6874/thumbs/687497082021.gif",
    "Omaha Golden Spikes": "https://content.sportslogos.net/logos/36/6874/thumbs/687497082021.gif",
    "Rochester Red Wings": "https://content.sportslogos.net/logos/36/934/thumbs/93462542014.gif",
    "Scranton/Wilkes-Barre RailRiders": "https://content.sportslogos.net/logos/36/4937/thumbs/493717372013.gif",
    "Scranton/Wilkes-Barre Yankees": "https://content.sportslogos.net/logos/36/4937/thumbs/493717372013.gif",
    "Scranton/Wilkes-Barre Red Barons": "https://content.sportslogos.net/logos/36/4937/thumbs/493717372013.gif",
    "Syracuse Mets": "https://content.sportslogos.net/logos/36/6627/thumbs/662739042019.gif",
    "Syracuse Chiefs": "https://content.sportslogos.net/logos/36/6627/thumbs/662739042019.gif",
    "Syracuse SkyChiefs": "https://content.sportslogos.net/logos/36/6627/thumbs/662739042019.gif",
    "Toledo Mud Hens": "https://content.sportslogos.net/logos/36/937/thumbs/794wsl5qbo9qicg4hvj19nbt3.gif",
    "Pawtucket Red Sox": "https://content.sportslogos.net/logos/36/932/thumbs/93264472015.gif",
    "Richmond Braves": "https://content.sportslogos.net/logos/36/933/thumbs/4545.gif",
    "Ottawa Lynx": "https://content.sportslogos.net/logos/36/931/thumbs/4532.gif",

    // Pacific Coast League
    "Albuquerque Isotopes": "https://content.sportslogos.net/logos/37/1013/thumbs/101364422023.gif",
    "Albuquerque Dukes": "https://content.sportslogos.net/logos/37/1013/thumbs/101364422023.gif",
    "El Paso Chihuahuas": "https://content.sportslogos.net/logos/37/5076/thumbs/507631102014.gif",
    "Las Vegas Aviators": "https://content.sportslogos.net/logos/37/6667/thumbs/666757702023.gif",
    "Las Vegas 51s": "https://content.sportslogos.net/logos/37/1017/thumbs/4819.gif",
    "Las Vegas Stars": "https://content.sportslogos.net/logos/37/1017/thumbs/4819.gif",
    "Oklahoma City Dodgers": "https://content.sportslogos.net/logos/37/5545/thumbs/554577692015.gif",
    "Oklahoma City RedHawks": "https://content.sportslogos.net/logos/37/6923/thumbs/692325392025.gif",
    "Oklahoma RedHawks": "https://content.sportslogos.net/logos/37/6923/thumbs/692325392025.gif",
    "Reno Aces": "https://content.sportslogos.net/logos/37/2721/thumbs/7hgu5nc8mte4xetz87kx8diuu.gif",
    "Round Rock Express": "https://content.sportslogos.net/logos/37/1024/thumbs/102435962019.gif",
    "Sacramento River Cats": "https://content.sportslogos.net/logos/37/1025/thumbs/6ectyfh0szrs9qg01t3pkg2tg.gif",
    "Salt Lake Bees": "https://content.sportslogos.net/logos/37/1131/thumbs/113118642015.gif",
    "Salt Lake Stingers": "https://content.sportslogos.net/logos/37/1131/thumbs/113118642015.gif",
    "Salt Lake Buzz": "https://content.sportslogos.net/logos/37/1131/thumbs/113118642015.gif",
    "Tacoma Rainiers": "https://content.sportslogos.net/logos/37/1027/thumbs/102781552015.gif",
    "Fresno Grizzlies": "https://content.sportslogos.net/logos/37/1015/thumbs/mnblfliko7hyffe36q48hsbj5.gif",
    "Portland Beavers": "https://content.sportslogos.net/logos/37/1023/thumbs/4850.gif",
    "Tucson Sidewinders": "https://content.sportslogos.net/logos/37/1050/thumbs/5031.gif",
    "Tucson Padres": "https://content.sportslogos.net/logos/37/3027/full/r2g48hteqa8nrwa2z20jomo2w.gif",
    "New Orleans Zephyrs": "https://content.sportslogos.net/logos/40/1344/thumbs/134464192015.gif",
    "New Orleans Baby Cakes": "https://content.sportslogos.net/logos/36/6621/thumbs/662174242017.gif",
    "Colorado Springs Sky Sox": "https://content.sportslogos.net/logos/37/1014/thumbs/4811.gif",
    "Edmonton Trappers": "https://content.sportslogos.net/logos/37/1089/thumbs/4814.gif",
    "Calgary Cannons": "https://content.sportslogos.net/logos/37/1012/thumbs/4810.gif",
    "San Antonio Missions": "https://content.sportslogos.net/logos/37/1105/thumbs/110557452019.gif",
    "Wichita Wind Surge": "https://content.sportslogos.net/logos/36/6835/thumbs/683526972020.gif",
};

async function seedLogos() {
    console.log('🚀 Starting MiLB Logo Seeding...');

    const { data: teams, error: fetchError } = await supabase
        .from('milb_teams')
        .select('id, name');

    if (fetchError) {
        console.error('❌ Error fetching teams:', fetchError);
        return;
    }

    console.log(`📡 Found ${teams.length} teams. Processing logos...`);

    for (const team of teams) {
        const logoUrl = LOGO_MAPPING[team.name];
        if (logoUrl) {
            const { error: updateError } = await supabase
                .from('milb_teams')
                .update({ logo_url: logoUrl })
                .eq('id', team.id);

            if (updateError) {
                console.error(`❌ Error updating logo for ${team.name}:`, updateError);
            } else {
                console.log(`✅ Updated logo for: ${team.name}`);
            }
        } else {
            console.warn(`⚠️ No logo mapping found for: ${team.name}`);
        }
    }

    console.log('\n✨ Logo seeding complete!');
}

seedLogos().catch(console.error);
