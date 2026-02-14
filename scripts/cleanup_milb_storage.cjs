const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deleteFiles(path) {
    console.log(`Listing files in logos bucket at path: ${path}`);
    const { data, error } = await supabase.storage.from('logos').list(path, {
        limit: 100,
        offset: 0
    });

    if (error) {
        console.error(`Error listing files in ${path}:`, error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No files found to delete.');
        return;
    }

    const filesToDelete = data
        .filter(item => item.id !== null) // Only files, not folders
        .map(item => `${path}${item.name}`);

    if (filesToDelete.length > 0) {
        console.log(`Deleting ${filesToDelete.length} files...`);
        const { error: deleteError } = await supabase.storage.from('logos').remove(filesToDelete);

        if (deleteError) {
            console.error('Error deleting files:', deleteError);
        } else {
            console.log('Successfully deleted batch of files.');
            // Recurse if there were exactly 100 items (might be more)
            if (data.length === 100) {
                await deleteFiles(path);
            }
        }
    }

    // Now check for subfolders
    for (const item of data) {
        if (item.id === null) {
            await deleteFiles(`${path}${item.name}/`);
        }
    }
}

async function run() {
    await deleteFiles('teams/milb/');
    console.log('Cleanup complete.');
}

run();
