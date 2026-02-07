import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('sec_test_groups.json', 'utf-8'));
const teams = data.sports[0].leagues[0].teams;

console.log(`Found ${teams.length} teams.`);

if (teams.length > 0) {
    // Print all team names to verify SEC
    console.log('Teams:', teams.map((t: any) => t.team.displayName));
}
