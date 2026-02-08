---
description: The central logic for identifying teams and resolving naming ambiguities
---

# Core Team Identification Strategy

This detailed skill explains how `gemini.ts` identifies teams from user input and resolves ambiguities when multiple teams share similar names (e.g., "Sacramento" -> Kings vs. River Cats).

## 1. Dual-Source Search
To identify a team, the system simultaneously searches two internal lookup tables:
1.  **`KNOWN_TEAM_LOGOS`**: Contains branding data (logos, colors) for most teams.
2.  **`ESPN_TEAM_IDS`**: Contains metadata (IDs, Sport, League) and is often more comprehensive for major sports.

**Logic:**
- The system merges keys from both objects.
- It performs a fuzzy search (substring match) for the user's input against these keys.
- Matches are deduplicated by `logoUrl`.

## 2. Ambiguity Resolution (Priority System)
When multiple teams match the input (e.g., input "New York" matches "New York Yankees", "New York Mets", "New York Giants", "New York Jets", "New York Liberty"), the system uses a **Priority Score** to decide which team is the most likely intent.

### Scoring Algorithm
1.  **League Priority (Primary Sort)**: Teams in "Major" leagues appear first.
2.  **String Length (Secondary Sort)**: If priorities are equal, the longer name wins (assuming it's more specific).

### Priority Tiers

| Tier | Score | Description | Leagues Included |
| :--- | :--- | :--- | :--- |
| **1** | **3** | **Major Pro** | NBA, NFL, MLB, NHL, Premier League (`eng.1`), MLS, WNBA, Liga MX (`mex.1`), NWSL, La Liga (`esp.1`), Bundesliga (`ger.1`), Serie A (`ita.1`), Ligue 1 (`fra.1`), Eredivisie (`ned.1`) |
| **2** | **2** | **Other Pro** | USL Championship (`usl`), UEFA Champions League |
| **3** | **1** | **Minor/Amateur** | MiLB (`milb-aaa`), NCAA, and others |

## 3. Usage in Code
This logic is located in the `processRosterRawText` function in `gemini.ts`.

```typescript
// Example Logic
const getLeaguePriority = (league) => {
  if (majorLeagues.includes(league)) return 3;
  if (minorLeagues.includes(league)) return 2;
  return 1;
}

// Sort: High PriorityFirst, then LongestName matches
candidates.sort((a, b) => priority(b) - priority(a) || b.length - a.length);
```
