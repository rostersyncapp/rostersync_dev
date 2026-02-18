#!/usr/bin/env ts-node
/**
 * WNBA Roster Data Enrichment Script
 * 
 * Scans a specific team/season roster and adds missing data required for PRO/STUDIO/NETWORK tiers:
 * - ESPN Player IDs
 * - Player headshot URLs
 * - Hardware Safe Name (ALL CAPS)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface EnrichedPlayerData {
    espn_id?: string;
    headshot_url?: string;
}

/**
 * Search for player on ESPN to get their ID and headshot
 */
async function fetchESPNPlayerData(playerName: string): Promise<EnrichedPlayerData | null> {
    try {
        // Clean up player name (remove notes like "(S)" for suspended)
        const cleanName = playerName.replace(/\s*\([^)]*\)/g, '').trim();
        const [lastName, firstName] = cleanName.split(', ');
        const searchName = `${firstName} ${lastName}`;

        console.log(`    🔍 Searching ESPN for: ${searchName}`);

        // Try ESPN's WNBA player search API  
        const searchUrl = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(searchName)}&sport=basketball&league=wnba&limit=5`;

        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            console.log(`    ⚠️  ESPN search failed: HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();

        // Look for athlete in results
        if (data.results && data.results.length > 0) {
            for (const result of data.results) {
                if (result.type === 'athlete' && result.athlete) {
                    const athlete = result.athlete;
                    const athleteName = (athlete.displayName || '').toLowerCase();

                    // Check if this is the right player
                    if (athleteName.includes(firstName.toLowerCase()) && athleteName.includes(lastName.toLowerCase())) {
                        const espnId = athlete.id || athlete.uid?.split(':').pop();
                        const headshot = athlete.headshot?.href || athlete.image?.href;

                        console.log(`    ✅ Found: ESPN ID ${espnId}`);

                        return {
                            espn_id: espnId,
                            headshot_url: headshot || `https://a.espncdn.com/combiner/i?img=/i/headshots/wnba/players/full/${espnId}.png`,
                        };
                    }
                }
            }
        }

        console.log(`    ❌ No match found on ESPN`);
        return null;
    } catch (error) {
        console.error(`    ❌ Error fetching ESPN data:`, error);
        return null;
    }
}

/**
 * Enrich a single player's data
 */
async function enrichPlayer(playerId: string, playerName: string): Promise<boolean> {
    console.log(`\n  👤 ${playerName}`);

    // Fetch ESPN data
    const espnData = await fetchESPNPlayerData(playerName);

    if (!espnData || !espnData.espn_id) {
        console.log(`    ⏭️  No enrichment data available`);
        return false;
    }

    // Update database
    const { error } = await supabase
        .from('wnba_rosters')
        .update({
            player_id: espnData.espn_id,
            hardware_safe_name: playerName.toUpperCase()
        })
        .eq('id', playerId);

    if (error) {
        console.error(`    ❌ Database update failed:`, error);
        return false;
    }

    console.log(`    💾 Updated with ESPN ID: ${espnData.espn_id}`);
    console.log(`    🖼️  Headshot URL: ${espnData.headshot_url}`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;
}

/**
 * Main enrichment function
 */
async function enrichTeamSeason(teamId: string, seasonYear: number) {
    console.log(`\n🏀 Enriching ${teamId.toUpperCase()} ${seasonYear}\n`);
    console.log('='.repeat(80));

    // Fetch current roster
    const { data: roster, error } = await supabase
        .from('wnba_rosters')
        .select('*')
        .eq('team_id', teamId)
        .eq('season_year', seasonYear)
        .order('player_name');

    if (error) {
        console.error('❌ Database error:', error);
        process.exit(1);
    }

    if (!roster || roster.length === 0) {
        console.log('❌ No roster data found for this team/season');
        process.exit(1);
    }

    console.log(`\n📊 Current Status:`);
    console.log(`  Total Players: ${roster.length}`);
    console.log(`  Players with ESPN IDs: ${roster.filter(p => p.player_id).length}`);
    console.log(`  Missing ESPN IDs: ${roster.filter(p => !p.player_id).length}\n`);

    // Display current roster data
    console.log(`📋 Current Roster Data:\n`);
    for (const player of roster) {
        const jersey = player.jersey_number?.padStart(2, ' ') || '--';
        const name = player.player_name.padEnd(25);
        const pos = player.position?.padEnd(3) || 'N/A';
        const espnId = player.player_id || 'MISSING';
        console.log(`  ${jersey} | ${name} | ${pos} | ESPN ID: ${espnId}`);
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`\n🔄 Starting Enrichment Process...\n`);

    let enrichedCount = 0;
    let skipCount = 0;

    for (const player of roster) {
        if (player.player_id) {
            console.log(`\n  👤 ${player.player_name}`);
            console.log(`    ⏭️  Already has ESPN ID: ${player.player_id}`);
            skipCount++;
            continue;
        }

        const success = await enrichPlayer(player.id, player.player_name);

        if (success) {
            enrichedCount++;
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📈 Enrichment Complete!\n`);
    console.log(`  ✅ Enriched: ${enrichedCount} players`);
    console.log(`  ⏭️  Skipped (already had data): ${skipCount} players`);
    console.log(`  ❌ Failed: ${roster.length - enrichedCount - skipCount} players`);

    // Final summary
    const { data: updatedRoster } = await supabase
        .from('wnba_rosters')
        .select('*')
        .eq('team_id', teamId)
        .eq('season_year', seasonYear);

    if (updatedRoster) {
        const completionRate = ((updatedRoster.filter(p => p.player_id).length / updatedRoster.length) * 100).toFixed(1);
        console.log(`\n  🎯 Data Completion: ${completionRate}% (${updatedRoster.filter(p => p.player_id).length}/${updatedRoster.length} players)`);
    }

    console.log('\n' + '='.repeat(80));
}

// CLI interface
const teamId = process.argv[2] || 'atlanta-dream';
const seasonYear = process.argv[3] ? parseInt(process.argv[3]) : 2011;

enrichTeamSeason(teamId, seasonYear)
    .then(() => {
        console.log('\n🎉 Done!\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
