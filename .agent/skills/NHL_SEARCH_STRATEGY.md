---
description: How the application searches for NHL team metadata and logos
---

# NHL Search Strategy

This skill monitors how we extract NHL team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 2)
For NHL teams, we prioritize the **ESPN CDN** using the standard US Sports URL pattern.

**Pattern:**
`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/{code}.png&h=200&w=200`

- **Parameter `{code}`**: The AI is instructed to find the team's standard 3-letter ESPN abbreviation.
    - Examples: `bos` (Bruins), `nyr` (Rangers), `chi` (Blackhawks), `tor` (Maple Leafs).
    - Note: NHL abbreviations are almost always 3 letters.

## 2. Fallback Discovery
If the ESPN abbreviation cannot be determined:
1.  **Wikipedia**: The AI searches for `"{team name} logo png"` prioritizing `upload.wikimedia.org`.
2.  **Official Sites**: Fallback to `nhl.com` or team sites.

## 3. Team Identification
- **Implicit**: We rely on standard NHL team names being present in the input text.
- **Search**: If ambiguous, the `googleSearch` tool is used to confirm the team identity and current roster.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`, shared with other major leagues:

```typescript
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
   - NFL: ne, dal, gb, etc. | NHL: bos, nyr, chi | NBA: lal, bos, chi | MLB: nyy, bos, lad
```
