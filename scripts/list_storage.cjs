const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listFiles(path) {
    const { data, error } = await supabase.storage.from('logos').list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
        console.error(`Error listing files in ${path}:`, error);
        return;
    }

    console.log(`Files in ${path}:`);
    data.forEach(file => {
        console.log(` - ${file.name}`);
    });
}

async function run() {
    console.log('Checking storage for logos...');
    await listFiles('leagues');
    await listFiles('league_logos');
}

run();
