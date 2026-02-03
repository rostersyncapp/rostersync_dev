---
description: How the application searches for NBA team metadata and logos
---

# NBA Search Strategy

This skill monitors how we extract NBA team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For NBA teams, we prioritize the **ESPN CDN** using the standard US Sports URL pattern.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/{code}.png&h=200&w=200`

- **Parameter `{code}`**: The AI is instructed to find the team's standard 3-letter ESPN abbreviation.
    - Examples: `lal` (Lakers), `bos` (Celtics), `gsw` (Warriors), `chi` (Bulls).
    - Note: NBA abbreviations are typically 3 letters, whereas NFL can be 2 or 3.

## 2. Fallback Discovery
If the ESPN abbreviation cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `nba.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard NBA team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: NBA teams score **3 points** in priority resolving (e.g., "Kings" -> Sacramento Kings > LA Kings).

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`, shared with other major leagues:

```typescript
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
   - NFL: ne, dal, gb, etc. | NHL: bos, nyr, chi | NBA: lal, bos, chi | MLB: nyy, bos, lad
```
