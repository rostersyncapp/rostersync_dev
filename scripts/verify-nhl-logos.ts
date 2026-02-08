
import fs from 'fs';
import path from 'path';

async function verifyNhlLogos() {
    const teamDataPath = path.join(process.cwd(), 'services/teamData.ts');
    const content = fs.readFileSync(teamDataPath, 'utf-8');

    // Regex to find NHL Supabase URLs
    const regex = /"https:\/\/rddqcxfalrlmlvirjlca\.supabase\.co\/storage\/v1\/object\/public\/logos\/nhl\/([^"']+\.png)"/g;

    let match;
    const urls: string[] = [];

    while ((match = regex.exec(content)) !== null) {
        urls.push(match[0].replace(/"/g, ''));
    }

    console.log(`Found ${urls.length} NHL logo URLs to verify.`);

    let successCount = 0;
    let failCount = 0;

    for (const url of urls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                // console.log(`[OK] ${url.split('/').pop()}`);
                successCount++;
            } else {
                console.error(`[FAIL] ${url} (Status: ${response.status})`);
                failCount++;
            }
        } catch (error) {
            console.error(`[ERROR] ${url}`, error);
            failCount++;
        }
    }

    console.log('---------------------------------------------------');
    console.log(`Verification Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);

    if (failCount > 0) {
        process.exit(1);
    }
}

verifyNhlLogos().catch(console.error);
