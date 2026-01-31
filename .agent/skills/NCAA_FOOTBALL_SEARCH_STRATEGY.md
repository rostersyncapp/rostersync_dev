---
description: How the application searches for NCAA Football team metadata and logos
---

# NCAA Football Search Strategy

This skill monitors how we extract NCAA Football team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For NCAA Football, we use the **Standard Numeric ID** strategy (similar to soccer), because abbreviations are unreliable across ESPN's massive college database.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/{TEAM_ID}.png&w=200`

- **Parameter `{TEAM_ID}`**: The AI is instructed to find the **numeric** ESPN Team ID.
    - **Method**: Google Search for `"ESPN {team name} team id"`.
    - Examples: `333` (Alabama), `57` (Florida), `61` (Georgia).
    - **Note**: The directory is always `/i/teamlogos/ncaa/`, regardless of whether it's football or basketball.

## 2. Fallback Discovery
If the ESPN numeric ID cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to school sites (e.g., `rolltide.com`, `floridagators.com`).

## 3. Team Identification
- **Implicit**: We rely on standard university names.
- **Search**: The `googleSearch` tool is used to resolve ambiguous names (e.g., "USC" -> Southern Cal vs South Carolina).

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts` as Priority 2, right after Soccer:

```typescript
2. ESPN CDN for NCAA (Football/Basketball): https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/{TEAM_ID}.png&w=200
```
