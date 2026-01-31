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
- **Implicit**: We rely on standard MLS team names.
- **Search**: The `googleSearch` tool is used to resolve common names (e.g., distinguishing "New York Red Bulls" from "NYCFC").

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` under the Soccer section:

```typescript
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
   - Use Google Search to find "ESPN {team name} team id" to get the correct numeric ID
```
