
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    console.error('Please ensure .env contains valid credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BUCKET_NAME = 'logos';

async function migrateLogos() {
    console.log('Starting logo migration...');

    // 1. Fetch all teams
    const { data: teams, error: fetchError } = await supabase
        .from('teams')
        .select('*');

    if (fetchError) {
        console.error('Error fetching teams:', fetchError);
        return;
    }

    console.log(`Found ${teams.length} teams.`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const team of teams) {
        const { id, name, league, logo_url } = team;

        // Skip if no logo or already internal
        if (!logo_url) {
            console.log(`[SKIP] ${name}: No logo URL.`);
            skippedCount++;
            continue;
        }

        if (logo_url.includes('supabase.co') && logo_url.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)) {
            // Already migrated
            console.log(`[SKIP] ${name}: Already migrated.`);
            skippedCount++;
            continue;
        }

        // Skip if not an external URL we want to migrate (e.g. only ESPN?)
        // For now, migrate anything not in our bucket.

        console.log(`[PROCESSING] ${name} (${league})...`);

        try {
            // 2. Download the image
            const response = await fetch(logo_url);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Determine file extension
            const contentType = response.headers.get('content-type');
            let ext = 'png';
            if (contentType === 'image/jpeg') ext = 'jpg';
            else if (contentType === 'image/svg+xml') ext = 'svg';

            // Sanitized filename: league/team_slug.ext
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const filePath = `${league}/${slug}.${ext}`;

            // 3. Upload to Storage
            const { error: uploadError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .upload(filePath, buffer, {
                    contentType: contentType || 'image/png',
                    upsert: true
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // 4. Get Public URL
            const { data: publicUrlData } = supabase
                .storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            const newUrl = publicUrlData.publicUrl;

            // 5. Update Database
            const { error: updateError } = await supabase
                .from('teams')
                .update({ logo_url: newUrl })
                .eq('id', id);

            if (updateError) {
                throw new Error(`Database update failed: ${updateError.message}`);
            }

            console.log(`[SUCCESS] ${name}: Updated to ${newUrl}`);
            updatedCount++;

        } catch (err: any) {
            console.error(`[ERROR] ${name}:`, err.message);
            errorCount++;
        }
    }

    console.log('--------------------------------------------------');
    console.log(`Migration complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors:  ${errorCount}`);
}

migrateLogos().catch(console.error);
