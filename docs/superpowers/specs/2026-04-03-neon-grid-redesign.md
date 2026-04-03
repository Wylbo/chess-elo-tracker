# Neon Grid Redesign — Design Spec

**Date:** 2026-04-03  
**Status:** Approved

## Summary

Retheme the Chess ELO Tracker with a "Neon Grid / Charged" cyberpunk aesthetic. Same stacked layout and all existing features are preserved — this is a pure visual overhaul of `styles.css` and minor HTML additions (corner decorations, logo icon, header status bar).

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Direction | Neon Grid | Selected from 3 options (Dark Marble, Neon Grid, Indigo Dashboard) |
| Layout | Keep stacked | Existing Controls → Chart → Bottom Panel flow, mobile-friendly |
| Intensity | Charged | Grid + scanlines + glow — cyber feel without sacrificing readability |

---

## Color Palette

Replace the existing warm-brown token set with:

```css
--bg:            #080C14   /* page background */
--bg-panel:      #0C1220   /* panel fill */
--bg-elevated:   #0F1729   /* inputs, inner surfaces */
--border:        rgba(0,255,180,0.15)   /* default border */
--border-bright: rgba(0,255,180,0.40)  /* focused / active border */
--cyan:          #00FFB4   /* primary accent, player 1 */
--cyan-dim:      rgba(0,255,180,0.6)
--cyan-mute:     rgba(0,255,180,0.25)
--pink:          #FF64C8   /* secondary accent, player 2 */
--text:          #C8E0D8   /* primary text */
--text-dim:      rgba(180,210,195,0.6)
--text-mute:     rgba(140,170,155,0.4)
--success:       #39FF8F
--error:         #FF4466
--warning:       #FFB830   /* player 3 */
```

Chart line colors per player remain individually assigned (currently stored in `StorageService` / `AppConfig`). The existing color palette options can be updated to draw from neon values.

---

## Typography

Add `JetBrains Mono` alongside the existing `Space Grotesk` import:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- **Monospace (`JetBrains Mono`)**: labels, buttons, status text, badges, range buttons, tab names, hint text, section headers
- **Sans (`Space Grotesk`)**: player names, body prose, modal content

---

## Background Texture

Applied via `body::before` pseudo-element — no extra HTML:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 32px, rgba(0,255,180,0.025) 32px, rgba(0,255,180,0.025) 33px),
    repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(0,255,180,0.025) 32px, rgba(0,255,180,0.025) 33px);
  pointer-events: none;
  z-index: 0;
}
```

---

## Panel Changes

Each `.panel` gets:

1. **Scanlines** via `panel::before` pseudo-element — horizontal micro-lines at 4px intervals, `rgba(0,255,180,0.012)` opacity
2. **Corner bracket decorations** — four `<div class="panel-corner tl|tr|bl|br">` elements injected into each panel's HTML. Pure CSS, 12×12px, 1.5px cyan borders on two sides each.

No JS changes needed for these.

---

## Component-by-Component Changes

### Header
- Add a `<div class="logo-icon">♟</div>` before the title
- Title becomes monospace, cyan, uppercase: `ELO_TRACKER`
- Add subtitle line: `CHESS.COM RATING MONITOR`
- Add a right-side status bar: pulsing green dot + `API: ONLINE` + player count

### Form / Controls Panel
- Labels: monospace, uppercase, letter-spaced, muted
- Inputs: dark fill, focused state uses cyan border + 3px cyan glow ring
- "Add player" button → `ADD_PLAYER` in monospace, cyan outline style with glow
- "Refresh data" button → `REFRESH`, secondary ghost style

### Status Bar
- Add a `STATUS ›` label prefix in monospace muted text

### Players Collapsible
- Section header label: monospace uppercase
- Player rows: remove plain background, add **left-edge accent bar** (2px, player's assigned color, with matching box-shadow glow)
- Dots already exist — add `box-shadow: 0 0 8px <color>` to make them glow
- Rating, trend, time-class: monospace

### Range Buttons (1w/1m/3m…)
- Uppercase monospace: `1W`, `1M`, `3M`, `6M`, `1Y`, `MAX`
- Active state: cyan fill + border + subtle glow

### Chart
- Chart line colors pull from neon palette (assigned per player)
- Range overlay: cyan border + `rgba(0,255,180,0.08)` fill

### Tab Bar
- Tabs uppercase monospace: `WEEKLY_GAMES`, `OPENINGS`
- Active tab: cyan text, cyan border, subtle glow

### Weekly Games Table
- `th`: monospace, uppercase, letter-spaced, muted
- Game cells: colored left border (`success`/`error`/`cyan`) + matching neon box-shadow
- Accuracy badges: monospace, neon-tinted background

### Openings Panel
- Same table `th` treatment as weekly games
- Window buttons: monospace, active = cyan border

### Modal
- Panel background and borders adopt new palette
- Playback control buttons: dark fill, cyan on hover
- Active move highlight: cyan background instead of amber

---

## What Does NOT Change

- HTML structure and layout (stacked, same grid)
- JavaScript / controller logic — zero JS changes
- Feature set — no features added or removed
- Chessboard.js and Chart.js visual defaults (Chart.js datasets already use per-player colors; board pieces stay as-is)
- Mobile breakpoints — same responsive rules, values updated to new palette

---

## Files Changed

| File | Change |
|---|---|
| `index.html` | Add JetBrains Mono font, logo icon div, header status bar, corner bracket divs in each panel |
| `styles.css` | Full token replacement + all component restyle. Existing structure kept, values updated |

No other files need changing.
