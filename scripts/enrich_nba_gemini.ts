/**
 * NBA Player Data Enrichment (Gemini AI)
 * Enriches NBA player data with phonetics, IPA, and Chinese characters.
 * Usage: npx tsx scripts/enrich_nba_gemini.ts [team_id] [--all] [--year=YYYY]
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match && !line.trim().startsWith('#')) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) process.env[key] = value;
            }
        });
        console.log('✅ Loaded .env file');
    }
} catch (e) {
    console.warn('⚠️ Could not load .env file');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
    console.error('❌ Missing credentials (Supabase or Gemini).');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface Player {
    id: string;
    player_name: string;
    team_id: string;
    season_year: number;
    college: string;
}

async function enrichPlayer(player: Player) {
    console.log(`🤖 Enriching ${player.player_name} (${player.team_id})`);

    const prompt = `
    You are an expert sports broadcaster and linguist. 
    Provide the following details for the NBA player:
    Name: ${player.player_name}
    Team: ${player.team_id}
    College: ${player.college || 'N/A'}

    Provide the output in strict JSON format. Each value MUST be a single string, NOT an object.
    {
        "phonetic": "The common phonetic spelling (e.g. LUKA DON-chich)",
        "ipa": "The International Phonetic Alphabet spelling (e.g. /ˈluːkə ˈdɒntʃɪtʃ/)",
        "chinese": "The standard Chinese character translation (e.g. 卢卡·东契奇)"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        text = text.replace(/```json\n?/, '').replace(/```\n?/, '').trim();
        const data = JSON.parse(text);

        const { error } = await supabase
            .from('nba_rosters')
            .update({
                phonetic_name: String(data.phonetic),
                ipa_name: String(data.ipa),
                chinese_name: String(data.chinese),
                hardware_safe_name: player.player_name.toUpperCase()
            })
            .eq('id', player.id);

        if (error) {
            console.error(`    ❌ DB Update Error:`, error);
        } else {
            console.log(`    ✅ Updated ${player.player_name}: ${data.phonetic}`);
        }

    } catch (e) {
        console.error(`    ❌ AI Error for ${player.player_name}:`, e);
    }
}

async function runEnrichment(teamId?: string, all: boolean = false, year?: number) {
    console.log(`🚀 Starting NBA Gemini Enrichment...`);

    let query = supabase.from('nba_rosters').select('*');

    if (teamId && !all) {
        query = query.eq('team_id', teamId);
    }

    if (year) {
        query = query.eq('season_year', year);
        console.log(`📅 Filtering by season: ${year}`);
    }

    query = query.is('phonetic_name', null);

    const { data: players, error } = await query.limit(500);

    if (error) {
        console.error('❌ Error fetching players:', error);
        return;
    }

    if (!players || players.length === 0) {
        console.log('✅ No players need enrichment.');
        return;
    }

    console.log(`📦 Found ${players.length} players to process.`);

    for (const player of players) {
        await enrichPlayer(player as Player);
        await new Promise(res => setTimeout(res, 2000));
    }
}

const args = process.argv.slice(2);
const teamFlag = args.find(a => !a.startsWith('--'));
const allFlag = args.includes('--all');
const yearArg = args.find(a => a.startsWith('--year='));
const year = yearArg ? parseInt(yearArg.split('=')[1]) : undefined;

runEnrichment(teamFlag, allFlag, year).then(() => {
    console.log('🏁 NBA Enrichment Complete!');
});
