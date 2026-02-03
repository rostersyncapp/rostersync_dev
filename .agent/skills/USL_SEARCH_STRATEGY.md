---
description: How the application searches for USL Championship team metadata and logos
---

# USL Championship Search Strategy

This skill monitors how we extract USL Championship team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
The USL Championship (USA/Canada 2nd Tier) follows the **Global Soccer** strategy on ESPN, requiring a **numeric ID**.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: It performs a Google Search for `"ESPN {team name} team id"`.
    - Examples: `18567` (Phoenix Rising), `18572` (Sacramento Republic), `18562` (Louisville City).
    - **CRITICAL DISTINCTION**: Even though USL is a US league, it is categorized under generic "soccer" on ESPN. Do not use US Sports abbreviations like `/usl/500/phx.png`. You MUST use the numeric ID pattern.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `uslchampionship.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 2 (Other Pro)**.
- **Implicit**: We rely on standard USL team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: USL teams score **2 points** in priority resolving (e.g., "Sacramento" -> Sacramento Kings (NBA - Tier 1) > Sacramento Republic (USL - Tier 2)).

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` under the Soccer section:

```typescript
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
```
