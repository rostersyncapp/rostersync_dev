---
description: How the application searches for WNBA team metadata and logos
---

# WNBA Search Strategy

This skill monitors how we extract WNBA team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For WNBA teams, we use the standard **ESPN CDN** US Sports pattern.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/wnba/500/{code}.png&h=200&w=200`

- **Parameter `{code}`**: The AI is instructed to find the team's standard ESPN abbreviation.
    - Examples: `las` (Aces), `sea` (Storm), `ny` (Liberty), `min` (Lynx).
    - Note: This is dynamically handled by the `{league}` variable in `gemini.ts`. When `league` = `wnba`, the URL constructs correctly.

## 2. Fallback Discovery
If the ESPN abbreviation cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `wnba.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard WNBA team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: WNBA teams score **3 points** in priority resolving.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`. The general rule covers WNBA because the `league` variable is passed into the URL template:

```typescript
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
```
When a user selects "WNBA" (value: `wnba`), this resolves to `/teamlogos/wnba/500/...`.
