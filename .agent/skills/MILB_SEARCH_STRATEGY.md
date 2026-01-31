---
description: How the application searches for MiLB team metadata and logos
---

# MiLB Search Strategy

This skill monitors how we extract MiLB team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
For Minor League Baseball (MiLB) teams, we use the **mlbstatic.com** SVG pattern, which bypasses the unreliable ESPN CDN.

**Pattern:**
`https://www.mlbstatic.com/team-logos/{TEAM_ID}.svg`

- **Parameter `{TEAM_ID}`**: The AI is instructed to use the **HARDCODED** ID from the internal lookup table.
    - **Method**: The system prompt contains the exact ID for all 30 Triple-A teams.
    - Examples: `431` (Gwinnett Stripers), `494` (Charlotte Knights).
    - **Tip**: This returns high-quality SVGs instantly.

**Restriction:**
- **Avoid**: `images.ctfassets.net` (Contentful) URLs. These are often dynamic, low-res, or show the **wrong logo** (e.g., Parent Club logo on an article).
- **Prefer**: `mlbstatic` (Best) or `wikimedia` (Fallback).

## 2. Team Identification (Triple-A)
We have hardcoded a **Validation List** of all 30 Triple-A teams in the system prompt to prevent hallucinations (e.g., confusing Buffalo Bisons with Boston Red Sox).

**Key Teams:** 
Buffalo Bisons, Charlotte Knights, Columbus Clippers, Durham Bulls, Gwinnett Stripers, Indianapolis Indians, Iowa Cubs, Jacksonville Jumbo Shrimp, Lehigh Valley IronPigs, Louisville Bats, Memphis Redbirds, Nashville Sounds, Norfolk Tides, Omaha Storm Chasers, Rochester Red Wings, Scranton/Wilkes-Barre RailRiders, St. Paul Saints, Syracuse Mets, Toledo Mud Hens, Worcester Red Sox, Albuquerque Isotopes, El Paso Chihuahuas, Las Vegas Aviators, Oklahoma City Comets, Reno Aces, Round Rock Express, Sacramento River Cats, Salt Lake Bees, Sugar Land Space Cowboys, Tacoma Rainiers.

## 3. Roster Search
We prioritize the official MiLB roster pages.

**Search Pattern:**
`site:milb.com/{team-slug}/roster`
(e.g., `site:milb.com/buffalo-bisons/roster`)

## 4. Parent Club Constraint
We strictly instruct the AI to **ignore** MLB parent teams if the league is set to MiLB.
- **Valid:** "Charlotte Knights"
- **Invalid:** "Chicago White Sox" (Parent Club)
- This prevents the AI from latching onto the more famous MLB name often found in affiliate search results.

## 5. Fuzzy Matching & Typos
We have added explicit rules to handle common typos and short names:
- `Gwinnet` / `Stripers` -> **Gwinnett Stripers**
- `Bulls` -> **Durham Bulls**
- `Knights` -> **Charlotte Knights**
- `Jumbo Shrimp` -> **Jacksonville Jumbo Shrimp**
- `Sugar Land` -> **Sugar Land Space Cowboys**

## 6. Usage in Code
This logic is embedded in the `brandingInstruction` block of `gemini.ts`:

```typescript
- MLB/MiLB STATIC (BEST): Use 'https://www.mlbstatic.com/team-logos/{TEAM_ID}.svg'. Search for "MiLB team ID {team name}" to find the ID.
```
