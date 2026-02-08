
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function migrateLogos(league: string) {
    console.log(`\n--- Migrating Logos for League: ${league} ---`);

    // 1. Fetch teams for the league
    const { data: teams, error } = await supabase
        .from('teams')
        .select('id, name, logo_url')
        .eq('league', league);

    if (error) {
        console.error('Error fetching teams:', error.message);
        return;
    }

    console.log(`Found ${teams.length} teams.`);

    const storagePrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`;

    for (const team of teams) {
        if (!team.logo_url) {
            console.log(`[${team.name}] Skipping: No logo URL.`);
            continue;
        }

        if (team.logo_url.startsWith(storagePrefix)) {
            console.log(`[${team.name}] Skipping: Already in storage.`);
            continue;
        }

        console.log(`[${team.name}] Migrating: ${team.logo_url}`);

        try {
            // 2. Download logo
            const response = await fetch(team.logo_url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Determine extension
            let ext = path.extname(new URL(team.logo_url).pathname) || '.png';
            if (ext.includes('?')) ext = ext.split('?')[0];

            const fileName = `${team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}${ext}`;
            const storagePath = `${league}/${fileName}`;

            // 3. Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType: blob.type,
                    upsert: true
                });

            if (uploadError) {
                console.error(`[${team.name}] Upload failed:`, uploadError.message);
                continue;
            }

            const newUrl = `${storagePrefix}/${storagePath}`;
            console.log(`[${team.name}] Uploaded successfully: ${newUrl}`);

            // 4. Update Database
            const { error: updateError } = await supabase
                .from('teams')
                .update({ logo_url: newUrl })
                .eq('id', team.id);

            if (updateError) {
                console.error(`[${team.name}] DB update failed:`, updateError.message);
            } else {
                console.log(`[${team.name}] DB updated successfully.`);
            }

        } catch (err: any) {
            console.error(`[${team.name}] Migration failed:`, err.message);
        }
    }

    console.log('\n--- Migration Complete ---');
}

const league = process.argv[2];
if (!league) {
    console.error('Please specify a league (e.g. nfl, ita.1)');
    process.exit(1);
}

migrateLogos(league).catch(console.error);
