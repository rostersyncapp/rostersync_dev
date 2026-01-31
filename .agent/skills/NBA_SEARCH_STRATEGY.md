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
- **Implicit**: We rely on standard NBA team names being present in the input text.
- **Search**: If ambiguous, the `googleSearch` tool is used to confirm the team identity and current roster.

## 4. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`, shared with other major leagues:

```typescript
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
   - NFL: ne, dal, gb, etc. | NHL: bos, nyr, chi | NBA: lal, bos, chi | MLB: nyy, bos, lad
```
