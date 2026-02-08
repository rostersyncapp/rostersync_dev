---
description: How the application searches for MLS (and general soccer) team metadata and logos
---

# MLS Search Strategy

This skill monitors how we extract MLS and general Soccer team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
For MLS and other Soccer leagues, we prioritize the **ESPN CDN** using a **numeric ID** pattern, which differs from the letter-code pattern used for NFL/NBA/NHL.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: It performs a Google Search for `"ESPN {team name} team id"`.
    - Examples: `19` (Orlando City), `182` (Inter Miami), etc.
    - **Why?**: Soccer leagues on ESPN are global and share a single `/soccer/` directory that uses unique numeric IDs to avoid abbreviation collisions.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be found:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `mlssoccer.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard MLS team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: MLS teams score **3 points** in priority resolving (e.g., "City" -> St. Louis City vs Orlando City vs NYCFC).

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` under the Soccer section:

```typescript
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
   - Use Google Search to find "ESPN {team name} team id" to get the correct numeric ID
```
