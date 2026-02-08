
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET_NAME = 'logos';

async function checkLogos(prefix: string) {
    console.log(`\n--- Checking Logos for Prefix: ${prefix} ---`);

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(prefix, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
        });

    if (error) {
        console.error('Error listing files:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No files found.');
        return;
    }

    console.log(`Found ${data.length} files:`);
    data.forEach(file => {
        console.log(`- ${file.name}`);
    });
}

const prefix = process.argv[2];
if (!prefix) {
    console.error('Please specify a folder prefix (e.g. la-liga)');
    process.exit(1);
}

checkLogos(prefix).catch(console.error);
