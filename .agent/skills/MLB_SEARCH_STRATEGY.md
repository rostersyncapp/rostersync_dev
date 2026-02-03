---
description: How the application searches for MLB team metadata and logos
---

# MLB Search Strategy

This skill monitors how we extract MLB team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For Major League Baseball (MLB) teams, we prioritize the **ESPN CDN** using the standard US Sports URL pattern.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/{code}.png&h=200&w=200`

- **Parameter `{code}`**: The AI is instructed to find the team's standard 3-letter ESPN abbreviation.
    - Examples: `nyy` (Yankees), `lad` (Dodgers), `bos` (Red Sox), `chc` (Cubs).

## 2. Fallback Discovery
If the ESPN abbreviation cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `mlb.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard MLB team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: MLB teams score **3 points** in priority resolving (e.g., "Giants" -> SF Giants (MLB priority vs NY Giants NFL priority is equal)).

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`, shared with NFL, NBA, and NHL:

```typescript
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
   - NFL: ne, dal, gb, etc. | NHL: bos, nyr, chi | NBA: lal, bos, chi | MLB: nyy, bos, lad
```
