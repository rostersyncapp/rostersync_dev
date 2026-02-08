import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_STORAGE_URL = 'https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/ncaa';
const TEAM_DATA_PATH = path.join(__dirname, '..', 'services', 'teamData.ts');

/**
 * Convert team name to kebab-case filename (matching migrate-logos.ts logic)
 */
function teamNameToFileName(teamName: string): string {
  return teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/**
 * Replace ESPN URL with Supabase URL in a line
 */
function replaceLogoUrl(line: string, teamName: string): string {
  const fileName = teamNameToFileName(teamName);
  const newUrl = `${SUPABASE_STORAGE_URL}/${fileName}.png`;
  return line.replace(/logoUrl:\s*"[^"]+"/, `logoUrl: "${newUrl}"`);
}

async function updateTeamDataNcaaLogos() {
  const content = fs.readFileSync(TEAM_DATA_PATH, 'utf-8');
  const lines = content.split('\n');
  
  let updatedCount = 0;
  const updatedLines: string[] = [];
  
  for (const line of lines) {
    // Check if this line has an NCAA logo URL
    if (line.includes('espncdn.com/i/teamlogos/ncaa')) {
      const teamNameMatch = line.match(/"([^"]+)":\s*\{/);
      
      if (teamNameMatch) {
        const teamName = teamNameMatch[1];
        const updatedLine = replaceLogoUrl(line, teamName);
        updatedLines.push(updatedLine);
        updatedCount++;
        console.log(`[${updatedCount}] ${teamName}`);
        continue;
      }
    }
    
    updatedLines.push(line);
  }
  
  fs.writeFileSync(TEAM_DATA_PATH, updatedLines.join('\n'), 'utf-8');
  console.log(`\n✅ Updated ${updatedCount} NCAA logo URLs in teamData.ts`);
}

updateTeamDataNcaaLogos().catch(console.error);
