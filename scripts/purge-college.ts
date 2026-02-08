
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function purgeCollegeSports() {
    console.log('🗑️  Purging College Sports from Database...');

    const leaguesToDelete = [
        'college-football',
        'mens-college-basketball',
        'ncaa-football',
        'ncaa-basketball'
    ];

    const { error, count } = await supabase
        .from('teams')
        .delete({ count: 'exact' })
        .in('league', leaguesToDelete);

    if (error) {
        console.error('Error deleting teams:', error);
    } else {
        console.log(`✅ Successfully deleted ${count} college teams from Supabase.`);
    }
}

purgeCollegeSports();
