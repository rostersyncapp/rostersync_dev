---
description: How the application searches for NCAA Basketball team metadata and logos
---

# NCAA Basketball Search Strategy

This skill monitors how we extract NCAA Basketball team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For NCAA Basketball, we use the **Standard Numeric ID** strategy (shared with Football).

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: Google Search for `"ESPN {team name} team id"`.
    - Examples: `150` (Duke), `153` (North Carolina), `2306` (Kansas State).
    - **Note**: The directory is `/i/teamlogos/ncaa/`, which covers all college sports.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to school sites.

## 3. Team Identification
- **Implicit**: We rely on standard university names.
- **Search**: The `googleSearch` tool is used to resolve ambiguous names.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` as Priority 2:

```typescript
2. ESPN CDN for NCAA (Football/Basketball): https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/{TEAM_ID}.png&w=200
```
