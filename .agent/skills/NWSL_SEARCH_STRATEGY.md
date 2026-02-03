---
description: How the application searches for NWSL team metadata and logos
---

# NWSL Search Strategy

This skill monitors how we extract NWSL team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
NWSL is categorized as "Soccer" by ESPN, so it follows the **Numeric ID** strategy, NOT the US Sports abbreviation strategy.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: It performs a Google Search for `"ESPN {team name} team id"`.
    - Examples: `17549` (Angel City FC), `9728` (Portland Thorns).
    - **CRITICAL DISTINCTION**: Even though NWSL is a US league, ESPN treats it as generic "soccer", so using `{league}` in the URL will try to ping `/teamlogos/nwsl/...` which **does not exist**. It MUST use `/teamlogos/soccer/500/...` with a number.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `nwslsoccer.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard NWSL team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: NWSL teams score **3 points** in priority resolving.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` under the Soccer section:

```typescript
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
```
This rule applies to **all** soccer leagues, including NWSL, Premier League, La Liga, etc.
