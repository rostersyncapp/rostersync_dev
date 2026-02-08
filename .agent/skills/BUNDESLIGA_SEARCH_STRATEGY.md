---
description: How the application searches for Bundesliga team metadata and logos
---

# Bundesliga Search Strategy

This skill monitors how we extract Bundesliga team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
The Bundesliga (Germany) follows the **Global Soccer** strategy on ESPN, requiring a **numeric ID**.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: It performs a Google Search for `"ESPN {team name} team id"`.
    - Examples: `132` (Bayern Munich), `124` (Borussia Dortmund), `121` (Bayer Leverkusen).
    - **Note**: DO NOT use abbreviations. Global soccer on ESPN relies strictly on these numeric IDs.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `bundesliga.com` or team sites.

## 3. Team Identification
- **Strategy**: Uses [Core Team Identification](CORE_TEAM_IDENTIFICATION.md).
- **Priority**: **Tier 1 (Major Pro)**.
- **Implicit**: We rely on standard Bundesliga team names being present in `ESPN_TEAM_IDS` or `KNOWN_TEAM_LOGOS`.
- **Ambiguity**: Bundesliga teams score **3 points** in priority resolving.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` under the Soccer section:

```typescript
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
```
