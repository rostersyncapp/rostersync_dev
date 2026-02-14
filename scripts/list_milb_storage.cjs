const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listFilesRecursive(path) {
    const { data, error } = await supabase.storage.from('logos').list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
        console.error(`Error listing files in ${path}:`, error);
        return;
    }

    for (const item of data) {
        if (item.id === null) {
            // It's a folder
            await listFilesRecursive(`${path}${item.name}/`);
        } else {
            console.log(`${path}${item.name}`);
        }
    }
}

async function run() {
    console.log('Listing files in logos/teams/milb/ ...');
    await listFilesRecursive('teams/milb/');
}

run();
