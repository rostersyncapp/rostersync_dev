#!/usr/bin/env ts-node
/**
 * NCAA Women's Basketball Roster Enrichment - Gemini AI
 * 
 * Enriches player data with:
 * - Simple Phonetic Spelling
 * - International Phonetic Alphabet (IPA)
 * - Chinese Character Spelling
 * - Hardware Safe Name (ALL CAPS)
 * 
 * Also verifies/utilizes team colors (Hex/RGB).
 * 
 * Usage: npx tsx scripts/enrich_ncaa_womens_basketball_gemini.ts [team-id] [limit]
 * Example: npx tsx scripts/enrich_ncaa_womens_basketball_gemini.ts south-carolina-gamecocks 5
 * Example: npx tsx scripts/enrich_ncaa_womens_basketball_gemini.ts all 1000
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
            const match = line.match(/^([^#\s=]+)\s*=\s*(.*)$/);
            if (match) {
                const key = match[1];
                let value = match[2].trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
        console.log('✅ Loaded .env file');
    }
} catch (e) {
    console.warn('⚠️ Could not load .env file');
}

// Initialize Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials. Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env or passed as env vars.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize Gemini
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
    console.error('❌ Missing Gemini API Key (VITE_GEMINI_API_KEY) in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Helper to convert Hex to RGB
function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
}

async function enrichPlayer(player: any, teamConfig: any): Promise<number> {
    console.log(`\n🤖 Enriching: ${player.player_name} (${teamConfig.name})`);

    // Prompt for Gemini
    const prompt = `
    You are a sports data expert. Provide the following for NCAA Women's Basketball player "${player.player_name}" (Team: ${teamConfig.name}):
    1. Simple Phonetic Pronunciation (e.g. "JuJu Watkins" -> "JOO-joo WOT-kinz")
    2. International Phonetic Alphabet (IPA) (e.g. "JuJu Watkins" -> "/ˈdʒuːdʒuː ˈwɒtkɪnz/")
    3. Chinese Character Spelling (e.g. "JuJu Watkins" -> "朱朱·沃特金斯")
    4. Hardware Safe Name (the player name in ALL CAPS, e.g. "JUJU WATKINS")
    
    Return ONLY a JSON object with keys: "phonetic", "ipa", "chinese", "hardware_safe".
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response:", text);
            return 0;
        }

        console.log(`   ✅ Phonetic: ${data.phonetic}`);
        console.log(`   ✅ IPA: ${data.ipa}`);
        console.log(`   ✅ Chinese: ${data.chinese}`);
        console.log(`   ✅ Hardware Safe: ${data.hardware_safe}`);

        // Pad jersey number if it's a single digit (1-9)
        let updatedJersey = player.jersey_number;
        if (updatedJersey && /^\d$/.test(updatedJersey)) {
            updatedJersey = `0${updatedJersey}`;
            console.log(`   🔢 Padding jersey: ${player.jersey_number} -> ${updatedJersey}`);
        }

        // Update database
        const { error } = await supabase
            .from('ncaa_womens_basketball_rosters')
            .update({
                phonetic_name: data.phonetic,
                ipa_name: data.ipa,
                chinese_name: data.chinese,
                jersey_number: updatedJersey,
                hardware_safe_name: data.hardware_safe?.toUpperCase() || player.player_name.toUpperCase()
            })
            .eq('id', player.id);

        if (error) {
            console.error(`   ❌ DB Error: ${error.message}`);
        } else {
            console.log(`   💾 Saved to database`);
        }

        // Return token usage
        const usage = response.usageMetadata;
        const totalTokens = usage?.totalTokenCount || 0;
        console.log(`   🎫 Tokens: ${totalTokens} (In: ${usage?.promptTokenCount || 0}, Out: ${usage?.candidatesTokenCount || 0})`);

        return totalTokens;

    } catch (error) {
        console.error(`   ❌ Gemini Error:`, error);
        return 0;
    }
}

async function runEnrichment(teamId?: string, limit: number = 5) {
    // Fetch teams to get colors
    const { data: teams } = await supabase.from('ncaa_womens_basketball_teams').select('*');
    const teamMap = new Map(teams?.map(t => [t.id, t]));

    let query = supabase
        .from('ncaa_womens_basketball_rosters')
        .select('*')
    //.is('phonetic_name', null); // Uncomment to strictly process missing

    if (teamId) {
        query = query.eq('team_id', teamId);
    }

    const { data: players, error } = await query.limit(limit);

    if (error) {
        console.error('❌ Error fetching players:', error);
        return;
    }

    if (!players || players.length === 0) {
        console.log('✅ No players found needing enrichment.');
        return;
    }

    console.log(`Found ${players.length} players to enrich...`);

    let sessionTotalTokens = 0;

    for (const player of players) {
        const team = teamMap.get(player.team_id);
        if (!team) continue;

        // Log color info
        const primaryRgb = hexToRgb(team.primary_color || '');
        const secondaryRgb = hexToRgb(team.secondary_color || '');
        console.log(`   🎨 Colors for ${team.name}: Hex [${team.primary_color}, ${team.secondary_color}] | RGB [${primaryRgb} / ${secondaryRgb}]`);

        const tokens = await enrichPlayer(player, team);
        sessionTotalTokens += tokens;

        // Rate limit
        await new Promise(res => setTimeout(res, 1000));
    }

    console.log(`\n🎫 Total Session Token Usage: ${sessionTotalTokens}`);
}

// CLI
const teamArg = process.argv[2];
const limitArg = process.argv[3] ? parseInt(process.argv[3]) : 5;

// If teamArg is 'all', run for all teams
const teamFilter = teamArg === 'all' ? undefined : teamArg;
const limitVal = teamArg === 'all' && !process.argv[3] ? 1000 : limitArg;

runEnrichment(teamFilter, limitVal)
    .then(() => {
        console.log('\n🎉 Done!\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
