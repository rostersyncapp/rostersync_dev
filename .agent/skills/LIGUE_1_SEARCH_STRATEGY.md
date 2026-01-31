---
description: How the application searches for Ligue 1 team metadata and logos
---

# Ligue 1 Search Strategy

This skill monitors how we extract Ligue 1 team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
Ligue 1 (France) follows the **Global Soccer** strategy on ESPN, requiring a **numeric ID**.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: It performs a Google Search for `"ESPN {team name} team id"`.
    - Examples: `160` (Paris Saint-Germain), `162` (Marseille), `165` (Lyon), `163` (Monaco).
    - **Note**: DO NOT use abbreviations. Global soccer on ESPN relies strictly on these numeric IDs.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `ligue1.com` or team sites.

## 3. Team Identification
- **Implicit**: We rely on standard club names.
- **Search**: The `googleSearch` tool is used to resolve ambiguous names or verify current table standing.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` under the Soccer section:

```typescript
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
```
