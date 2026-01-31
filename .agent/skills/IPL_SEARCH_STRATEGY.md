---
description: How the application searches for IPL (Indian Premier League) team metadata and logos
---

# IPL Search Strategy

This skill monitors how we extract IPL team data and logos in `gemini.ts`.

## 1. Logo Discovery (Priority 1)
Unlike US Sports or Global Soccer, we **do not** have a reliable ESPN CDN pattern for the Indian Premier League in our current codebase.

**Strategy:**
We rely on the **Wikipedia / High Reliability** fallback.

- **Source**: `upload.wikimedia.org`
- **Search Query**: `"{team name} logo png"` or `"{team name} logo wikipedia"`
- **Why?**: Wikimedia uses high-quality SVGs or PNGs that are stable and consistent for cricket clubs.

## 2. Fallback Discovery
If Wikipedia fails:
1.  **Official Sites**: `iplt20.com` or official team sites (e.g., `chennaisuperkings.com`, `royalchallengers.com`).
2.  **ESPNcricinfo**: While ESPN covers cricket, the URL patterns are less standardized than their US/Soccer CDNs, so we default to the broader search.

## 3. Team Identification
- **Implicit**: We rely on standard franchise names (e.g., "Mumbai Indians", "CSK", "RCB").
- **Search**: The `googleSearch` tool is used to resolve abbreviations commonly used in cricket scores.

## 4. Usage in Code
This logic falls under the generic "Wikipedia" block in `gemini.ts`:

```typescript
4. WIKIPEDIA (HIGH RELIABILITY): Search Google for "{team name} logo png" or "{team name} logo wikipedia".
   - PREFER 'upload.wikimedia.org' URLs as they are stable and high quality.
```
