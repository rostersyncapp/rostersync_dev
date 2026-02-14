import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET_NAME = 'logos';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function downloadAndUploadLogos() {
    console.log('🚀 Starting MiLB Logo Migration to Internal Storage...');

    // 1. Fetch teams with external logo URLs
    const { data: teams, error: fetchError } = await supabase
        .from('milb_teams')
        .select('id, name, logo_url')
        .not('logo_url', 'is', null);

    if (fetchError) {
        console.error('❌ Error fetching teams:', fetchError);
        return;
    }

    console.log(`📡 Found ${teams.length} teams with logos. Starting migration...`);

    const storagePrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`;

    for (const team of teams) {
        if (team.logo_url?.startsWith(storagePrefix)) {
            console.log(`⏭️ [${team.name}] Already migrated.`);
            continue;
        }

        console.log(`🚚 [${team.name}] Migrating: ${team.logo_url}`);

        try {
            // 2. Download logo
            const response = await fetch(team.logo_url!, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());

            // Determine extension
            let ext = '.png';
            if (team.logo_url?.toLowerCase().endsWith('.gif')) ext = '.gif';
            else if (team.logo_url?.toLowerCase().endsWith('.png')) ext = '.png';
            else if (team.logo_url?.toLowerCase().endsWith('.jpg') || team.logo_url?.toLowerCase().endsWith('.jpeg')) ext = '.jpg';

            const fileName = `${team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${team.id.split('-').pop()}${ext}`;
            const storagePath = `teams/milb/${fileName}`;

            // 3. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType: blob.type,
                    upsert: true
                });

            if (uploadError) {
                console.error(`❌ [${team.name}] Upload failed:`, uploadError.message);
                continue;
            }

            const newUrl = `${storagePrefix}/${storagePath}`;

            // 4. Update Database
            const { error: updateError } = await supabase
                .from('milb_teams')
                .update({ logo_url: newUrl })
                .eq('id', team.id);

            if (updateError) {
                console.error(`❌ [${team.name}] DB update failed:`, updateError.message);
            } else {
                console.log(`✅ [${team.name}] Migrated successfully to: ${newUrl}`);
            }

            // Be polite to external server
            await new Promise(res => setTimeout(res, 500));

        } catch (err: any) {
            console.error(`❌ [${team.name}] Migration failed:`, err.message);
        }
    }

    console.log('\n✨ MiLB Logo Migration Complete!');
}

downloadAndUploadLogos().catch(console.error);
