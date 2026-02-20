#!/usr/bin/env ts-node
/**
 * Master Roster Enrichment - Hybrid Global Strategy
 * 
 * Features:
 * 1. Global Cache Lookup (Zero-cost reuse across leagues/seasons)
 * 2. Multi-Player Batching (10 players per Gemini request)
 * 3. Targeted Filtering (--league, --season, --team)
 * 4. Model: Gemini 1.5 Flash-8B (Extreme cost efficiency)
 * 
 * Usage: 
 *   npx tsx scripts/master_enrichment.ts --league=nba --limit=50
 *   npx tsx scripts/master_enrichment.ts --all --incremental
 *   npx tsx scripts/master_enrichment.ts --league=nfl --season=2020-2024
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const LEAGUE_CONFIG: Record<string, { table: string; teams_table?: string }> = {
    nba: { table: 'nba_rosters' },
    nhl: { table: 'nhl_rosters' },
    mlb: { table: 'mlb_rosters' },
    nfl: { table: 'nfl_rosters' },
    wnba: { table: 'wnba_rosters' },
    mls: { table: 'mls_rosters' },
    nwsl: { table: 'nwsl_rosters' },
    usl: { table: 'usl_rosters' },
    milb: { table: 'milb_rosters' },
    ncaa_fb: { table: 'ncaa_football_rosters' },
    ncaa_mb: { table: 'ncaa_basketball_rosters' },
    ncaa_wb: { table: 'ncaa_womens_basketball_rosters' }
};

const BATCH_SIZE = 10; // Players per AI request

// --- Initialization ---
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
    }
} catch (e) { }

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // Using 2.0 Flash as it's confirmed to work in this environment
    generationConfig: {
        responseMimeType: "application/json",
    }
});

// --- Logic ---

async function runMasterEnrichment() {
    const args = process.argv.slice(2);
    const leagueArg = args.find(a => a.startsWith('--league='))?.split('=')[1];
    const seasonArg = args.find(a => a.startsWith('--season='))?.split('=')[1];
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
    const isAll = args.includes('--all');

    const leaguesToProcess = isAll ? Object.keys(LEAGUE_CONFIG) : (leagueArg ? [leagueArg] : []);

    if (leaguesToProcess.length === 0) {
        console.error('❌ Specify a league (--league=nba) or use --all');
        return;
    }

    for (const leagueKey of leaguesToProcess) {
        const config = LEAGUE_CONFIG[leagueKey];
        if (!config) continue;

        console.log(`\n🚀 [${leagueKey.toUpperCase()}] Starting enrichment...`);

        // 1. Identify unique players needing enrichment in this league
        let query = supabase.from(config.table)
            .select('player_name')
            .is('phonetic_name', null)
            .order('player_name');

        if (seasonArg) {
            if (seasonArg.includes('-')) {
                const [start, end] = seasonArg.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(start)) query = query.gte('season_year', start);
                if (!isNaN(end)) query = query.lte('season_year', end);
            } else {
                query = query.eq('season_year', seasonArg);
            }
        }

        const { data: players, error } = await query.limit(limit * 3);
        if (error || !players) {
            console.error(`   ❌ Error fetching players for ${leagueKey}:`, error?.message);
            continue;
        }

        const uniqueNames = Array.from(new Set(players.map(p => p.player_name)));
        if (uniqueNames.length === 0) {
            console.log(`   ✅ No new players found in ${leagueKey}.`);
            continue;
        }

        console.log(`   📦 Found ${uniqueNames.length} unique names: ${uniqueNames.slice(0, 5).join(', ')}...`);

        // 2. PHASE 1: Cache Sync (Check Global Cache for matches)
        const { data: cachedData } = await supabase
            .from('global_player_enrichment')
            .select('*')
            .in('player_name', uniqueNames);

        const cacheMap = new Map(cachedData?.map(c => [c.player_name, c]));
        const needsEnrichment = uniqueNames.filter(name => !cacheMap.has(name));

        if (cachedData && cachedData.length > 0) {
            console.log(`   ♻️  Syncing ${cachedData.length} names from Global Cache: ${cachedData.map(c => c.player_name).join(', ')}`);
            for (const cached of cachedData) {
                await supabase.from(config.table).update({
                    phonetic_name: cached.phonetic_name,
                    ipa_name: cached.ipa_name,
                    chinese_name: cached.chinese_name,
                    hardware_safe_name: cached.hardware_safe_name
                }).eq('player_name', cached.player_name);
            }
        }

        if (needsEnrichment.length === 0) {
            console.log(`   ✅ All players synced from cache.`);
            continue;
        }

        // 3. PHASE 2: AI Enrich (Batch remaining names)
        console.log(`   🤖 Enriching ${needsEnrichment.length} new players via AI (Batches of ${BATCH_SIZE})...`);
        const finalEnrichmentList = needsEnrichment.slice(0, limit);

        for (let i = 0; i < finalEnrichmentList.length; i += BATCH_SIZE) {
            const batch = finalEnrichmentList.slice(i, i + BATCH_SIZE);
            await processBatch(batch, config.table);
            await new Promise(r => setTimeout(r, 1000)); // Rate limit
        }
    }
}

async function processBatch(names: string[], targetTable: string) {
    console.log(`      📝 Processing batch of ${names.length}: ${names.join(', ')}`);

    const prompt = `
    You are a sports linguist. For the following list of athletes, provide:
    1. phonetic: Simple phonetic spelling (e.g. LeBron James -> luh-BRON JAYMZ)
    2. ipa: International Phonetic Alphabet (e.g. /ləˈbrɒn ˈdʒeɪmz/)
    3. chinese: Standard simplified Chinese transliteration (e.g. 勒布朗·詹姆斯)
    4. hardware_safe: ALL CAPS name without special characters.

    Athletes:
    ${names.map((n, idx) => `${idx + 1}. ${n}`).join('\n')}

    IMPORTANT: Return a JSON object where the keys are the EXACT player names as provided in the list above. 
    DO NOT use numbers as keys. DO NOT include any other text.
    
    Example Structure:
    {
      "${names[0]}": { "phonetic": "...", "ipa": "...", "chinese": "...", "hardware_safe": "..." }
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        const data = JSON.parse(responseText);

        for (let idx = 0; idx < names.length; idx++) {
            const name = names[idx];

            // Handle various possible response structures (Object with names, Array of objects, Object with indices)
            let enriched = null;
            if (Array.isArray(data)) {
                // Try to find the object in the array that has the name as a key, or fall back to index
                enriched = data.find(item => item[name])?.[name] || data[idx]?.[name] || data[idx];
            } else {
                enriched = data[name] || data[idx.toString()] || data[idx];
            }

            if (!enriched) {
                console.warn(`         ⚠️ No data returned for: ${name}`);
                continue;
            }

            // Ensure we have the data object if Gemini nested it
            if (!enriched.phonetic && enriched[name]) enriched = enriched[name];

            // Final safety check
            if (!enriched.phonetic && !enriched.hardware_safe) {
                console.warn(`         ⚠️ Incomplete data for: ${name}`);
                continue;
            }

            // Update Global Cache
            await supabase.from('global_player_enrichment').upsert({
                player_name: name,
                phonetic_name: enriched.phonetic || null,
                ipa_name: enriched.ipa || null,
                chinese_name: enriched.chinese || null,
                hardware_safe_name: enriched.hardware_safe || name.toUpperCase()
            });

            // Update Target League Table
            await supabase.from(targetTable).update({
                phonetic_name: enriched.phonetic || null,
                ipa_name: enriched.ipa || null,
                chinese_name: enriched.chinese || null,
                hardware_safe_name: enriched.hardware_safe || name.toUpperCase()
            }).eq('player_name', name);

            console.log(`         ✅ Enriched: ${name}`);
        }
    } catch (e) {
        console.error(`      ❌ Batch Error:`, e);
    }
}

runMasterEnrichment().then(() => console.log('\n🏁 Master Enrichment Complete!'));
