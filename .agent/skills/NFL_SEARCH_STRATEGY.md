---
description: How the application searches for NFL team metadata and logos
---

# NFL Search Strategy

This skill monitors how we extract NFL team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For NFL teams, we prioritize the **ESPN CDN** using a specific URL pattern.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/{code}.png&h=200&w=200`

- **Parameter `{code}`**: The AI is instructed to find the team's standard 2-3 letter ESPN abbreviation.
    - Examples: `ne` (Patriots), `dal` (Cowboys), `gb` (Packers), `kc` (Chiefs).
    - This is more reliable than searching for numeric IDs for major US sports.

## 2. Fallback Discovery
If the ESPN abbreviation cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `nfl.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard NFL team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: NFL teams score **3 points** in priority resolving (e.g., "Giants" -> NY Giants (NFL priority vs SF Giants MLB priority is equal, resolved by length or specific input)).

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`:

```typescript
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
   - NFL: ne, dal, gb, etc. | NHL: bos, nyr, chi | NBA: lal, bos, chi | MLB: nyy, bos, lad
```
