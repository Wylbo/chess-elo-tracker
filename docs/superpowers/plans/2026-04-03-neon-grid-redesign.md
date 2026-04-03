# Neon Grid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the Chess ELO Tracker with a cyberpunk "Neon Grid / Charged" aesthetic — glowing cyan accents, grid background texture, scanline panels, monospace type — while preserving all features and layout exactly.

**Architecture:** Pure visual overhaul touching only `styles.css` (full token + component restyle) and `index.html` (font import, logo icon, header status bar, corner bracket divs). Zero JS changes. The stacked Controls → Chart → Bottom Panel layout is unchanged.

**Tech Stack:** Vanilla CSS, HTML. JetBrains Mono (Google Fonts CDN) added alongside existing Space Grotesk. No build step — open `index.html` directly in a browser to verify.

---

## File Map

| File | What changes |
|---|---|
| `index.html` | Font link updated, `.header` restructured, `.panel-corner` divs added to all panels |
| `styles.css` | Complete replacement — same selector structure, all values updated to neon palette |

---

## Task 1: CSS Variables + Font Import

**Files:**
- Modify: `index.html` (font link, line 10)
- Modify: `styles.css` (`:root` block, lines 1–14)

- [ ] **Step 1: Update font link in `index.html`**

Replace the existing Google Fonts `<link>` (line 10) with:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Replace `:root` token block in `styles.css`**

Replace the entire `:root { ... }` block (lines 1–14) with:

```css
:root {
    --bg:            #080C14;
    --bg-panel:      #0C1220;
    --bg-elevated:   #0F1729;
    --border:        rgba(0,255,180,0.15);
    --border-bright: rgba(0,255,180,0.40);
    --cyan:          #00FFB4;
    --cyan-dim:      rgba(0,255,180,0.6);
    --cyan-mute:     rgba(0,255,180,0.25);
    --pink:          #FF64C8;
    --text:          #C8E0D8;
    --text-primary:  #C8E0D8;
    --text-secondary: rgba(180,210,195,0.6);
    --text-muted:    rgba(140,170,155,0.4);
    --text-dim:      rgba(180,210,195,0.6);
    --accent:        #00FFB4;
    --accent-soft:   rgba(0,255,180,0.7);
    --bg-main:       #080C14;
    --bg-surface:    #0C1220;
    --success:       #39FF8F;
    --error:         #FF4466;
    --warning:       #FFB830;
}
```

> Note: the old names (`--bg-main`, `--bg-surface`, `--accent`, `--text-primary`, etc.) are kept as aliases pointing to the new values so that any inline references in existing JS-rendered HTML still resolve correctly.

- [ ] **Step 3: Open `index.html` in a browser**

Verify the page background is now very dark navy (`#080C14`) and the title text changed color. The layout will still look broken at this stage — that's expected.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat(theme): add JetBrains Mono, replace CSS color tokens with neon palette"
```

---

## Task 2: Body, Background Grid Texture, Shell

**Files:**
- Modify: `styles.css` (`body`, `.shell` rules)

- [ ] **Step 1: Replace `body` rule**

```css
body {
    margin: 0;
    min-height: 100vh;
    font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 32px 16px 48px;
    position: relative;
}
```

- [ ] **Step 2: Add `body::before` grid texture immediately after the `body` rule**

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

- [ ] **Step 3: Update `.shell` to sit above the grid**

```css
.shell {
    max-width: 1100px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
}
```

- [ ] **Step 4: Verify in browser**

The page background should show a faint grid of crossing lines over the dark navy.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat(theme): add fixed grid texture to body background"
```

---

## Task 3: Header — HTML Restructure + Styles

**Files:**
- Modify: `index.html` (`.header` div, lines 26–29)
- Modify: `styles.css` (`.header`, `.title` rules)

- [ ] **Step 1: Replace the `.header` block in `index.html`**

Replace:
```html
        <div class="header">
            <div class="title">Chess ELO Tracker</div>
            <!-- <div class="subtitle">Track Chess.com ratings for you and your friends. Add usernames, choose a time
                control, and toggle curves to see how everyone is progressing.</div> -->
        </div>
```

With:
```html
        <div class="header">
            <div class="header-left">
                <div class="logo-icon">♟</div>
                <div>
                    <div class="title">ELO_TRACKER</div>
                    <div class="title-sub">CHESS.COM RATING MONITOR</div>
                </div>
            </div>
            <div class="header-status">
                <div class="status-dot"></div>
                <span id="header-api-status">API: ONLINE</span>
                <span class="header-status-sep">|</span>
                <span id="header-player-count">0 PLAYERS</span>
            </div>
        </div>
```

- [ ] **Step 2: Replace `.header` and `.title` styles in `styles.css`**

Replace the existing `.header` and `.title` blocks with:

```css
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.logo-icon {
    width: 36px;
    height: 36px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 0 12px rgba(0,255,180,0.15), inset 0 0 8px rgba(0,255,180,0.05);
}

.title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--cyan);
    text-shadow: 0 0 20px rgba(0,255,180,0.4);
}

.title-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.12em;
    margin-top: 2px;
}

.header-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
}

.header-status-sep {
    color: rgba(0,255,180,0.2);
    margin: 0 2px;
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--cyan);
    box-shadow: 0 0 8px var(--cyan);
    animation: pulse-dot 2s ease-in-out infinite;
    flex-shrink: 0;
}

@keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--cyan); }
    50%       { opacity: 0.6; box-shadow: 0 0 4px var(--cyan); }
}

/* Remove old .subtitle rule — it's no longer in HTML */
```

- [ ] **Step 3: Verify in browser**

Header should show: chess icon on the left, `ELO_TRACKER` in glowing cyan monospace with `CHESS.COM RATING MONITOR` subtitle, and a pulsing dot + status text on the right.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat(theme): restyle header with logo icon, monospace title, status bar"
```

---

## Task 4: Panel Base — Scanlines + Corner Brackets

**Files:**
- Modify: `styles.css` (`.panel` rule)
- Modify: `index.html` (add corner divs inside all 3 `.panel` elements)

- [ ] **Step 1: Replace `.panel` rule in `styles.css`**

```css
.panel {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 18px;
    box-shadow: none;
    position: relative;
    overflow: hidden;
}

/* Scanline overlay */
.panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,255,180,0.012) 3px,
        rgba(0,255,180,0.012) 4px
    );
    pointer-events: none;
    border-radius: inherit;
    z-index: 0;
}

/* Corner bracket decorations */
.panel-corner {
    position: absolute;
    width: 12px;
    height: 12px;
    border-color: var(--cyan);
    border-style: solid;
    border-width: 0;
    opacity: 0.45;
    pointer-events: none;
    z-index: 1;
}
.panel-corner.tl { top: 7px; left: 7px; border-top-width: 1.5px; border-left-width: 1.5px; }
.panel-corner.tr { top: 7px; right: 7px; border-top-width: 1.5px; border-right-width: 1.5px; }
.panel-corner.bl { bottom: 7px; left: 7px; border-bottom-width: 1.5px; border-left-width: 1.5px; }
.panel-corner.br { bottom: 7px; right: 7px; border-bottom-width: 1.5px; border-right-width: 1.5px; }
```

- [ ] **Step 2: Add corner divs to the controls panel in `index.html`**

Inside `<div class="panel controls">`, add four corner divs as the first children:

```html
            <div class="panel controls">
                <div class="panel-corner tl"></div>
                <div class="panel-corner tr"></div>
                <div class="panel-corner bl"></div>
                <div class="panel-corner br"></div>
                <form id="add-form">
```

- [ ] **Step 3: Add corner divs to the chart panel**

Inside `<div class="panel chart-panel">`, add four corner divs as the first children:

```html
            <div class="panel chart-panel">
                <div class="panel-corner tl"></div>
                <div class="panel-corner tr"></div>
                <div class="panel-corner bl"></div>
                <div class="panel-corner br"></div>
                <div class="range-panel">
```

- [ ] **Step 4: Add corner divs to the bottom panel**

Inside `<div class="bottom-panel panel" id="bottom-panel">`, add four corner divs as the first children:

```html
        <div class="bottom-panel panel" id="bottom-panel">
            <div class="panel-corner tl"></div>
            <div class="panel-corner tr"></div>
            <div class="panel-corner bl"></div>
            <div class="panel-corner br"></div>
            <div class="tab-bar">
```

- [ ] **Step 5: Make sure inner content sits above the scanline pseudo-element**

Add `position: relative; z-index: 1;` to `.controls`, `.chart-panel`, and `.bottom-panel` content wrappers — or ensure the direct children have `position: relative`. The simplest way is to add this rule:

```css
.panel > *:not(.panel-corner) {
    position: relative;
    z-index: 1;
}
```

- [ ] **Step 6: Verify in browser**

All three panels should show faint horizontal scanlines and small cyan bracket corners. Content should be fully readable on top.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css
git commit -m "feat(theme): add scanline overlay and corner bracket decorations to panels"
```

---

## Task 5: Form, Inputs, Buttons, Hint, Status

**Files:**
- Modify: `styles.css` (`form`, `label`, `input`/`select`, `.primary-btn`, `.secondary-btn`, `.hint`, `.status`)

- [ ] **Step 1: Update form layout and label styles**

Replace the `form` and `label` rules:

```css
form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-end;
}

label {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
}
```

- [ ] **Step 2: Update input and select styles**

```css
input,
select {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: 'Space Grotesk', sans-serif;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

input:focus,
select:focus {
    border-color: var(--border-bright);
    box-shadow: 0 0 0 3px rgba(0,255,180,0.08), 0 0 12px rgba(0,255,180,0.1);
}
```

- [ ] **Step 3: Update `.primary-btn`**

```css
.primary-btn {
    background: rgba(0,255,180,0.1);
    color: var(--cyan);
    border: 1px solid var(--border-bright);
    padding: 11px 18px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 150px;
    justify-content: center;
    box-shadow: 0 0 14px rgba(0,255,180,0.12);
    transition: box-shadow 0.15s ease, background 0.15s ease, transform 0.1s ease;
    cursor: pointer;
}

.primary-btn:hover {
    background: rgba(0,255,180,0.18);
    box-shadow: 0 0 20px rgba(0,255,180,0.22);
    transform: translateY(-1px);
}

.primary-btn:active {
    transform: translateY(0);
}
```

- [ ] **Step 4: Update `.secondary-btn`**

```css
.secondary-btn {
    background: transparent;
    color: var(--text-secondary);
    padding: 11px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.08em;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 140px;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.secondary-btn:hover {
    border-color: var(--border-bright);
    color: var(--text);
    transform: translateY(-1px);
}

.secondary-btn:active {
    transform: translateY(0);
}
```

- [ ] **Step 5: Update `.hint` and `.status`**

```css
.hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: -2px;
}

.hint::before {
    content: '// ';
    color: var(--border-bright);
}

.status {
    padding: 9px 12px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
}

.status[data-tone="success"] {
    border-color: rgba(57,255,143,0.4);
    color: #b8f5d8;
}

.status[data-tone="warn"] {
    border-color: rgba(255,184,48,0.4);
    color: #f5e4b8;
}

.status[data-tone="error"] {
    border-color: rgba(255,68,102,0.4);
    color: #f5b8c0;
}
```

- [ ] **Step 6: Verify in browser**

Form fields should have dark fills with cyan focus glow. "Add player" button should be a cyan-bordered ghost button. "Refresh data" should be a faint secondary style. Hint text should have `//` prefix.

- [ ] **Step 7: Commit**

```bash
git add styles.css
git commit -m "feat(theme): restyle form inputs, buttons, hint, and status bar"
```

---

## Task 6: Collapsible, Player List, Toggle

**Files:**
- Modify: `styles.css` (`.collapsible`, `.player-row`, `.dot`, `.player-*`, `.toggle`, `.pill`, `.ghost-btn`)

- [ ] **Step 1: Update collapsible styles**

```css
.collapsible {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elevated);
    overflow: hidden;
}

.collapsible + .collapsible {
    margin-top: 6px;
}

.collapsible-trigger {
    width: 100%;
    background: transparent;
    color: var(--text);
    padding: 10px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
    cursor: pointer;
    border: none;
}

.pill {
    background: rgba(0,255,180,0.1);
    color: var(--cyan);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
}

.chevron {
    font-size: 14px;
    color: var(--text-muted);
}

.collapsible-body {
    overflow: hidden;
    height: auto;
    opacity: 1;
    transition: height 0.22s ease, opacity 0.2s ease;
    will-change: height, opacity;
}

.collapsible-body.collapsed {
    height: 0;
    opacity: 0;
    pointer-events: none;
}

.collapsible-inner {
    padding: 10px 12px 12px;
}

.list {
    display: grid;
    gap: 6px;
}
```

- [ ] **Step 2: Update `.player-row` with left accent bar**

```css
.player-row {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
}

/* Left accent bar — color injected via inline style on the element */
.player-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--player-color, var(--border));
    box-shadow: 0 0 8px var(--player-color, transparent);
}

.player-row.placeholder {
    min-height: 54px;
    border-style: dashed;
    opacity: 0.5;
    pointer-events: none;
}

.player-row.disabled {
    background: rgba(15,23,41,0.6);
    border-color: rgba(0,255,180,0.06);
    opacity: 0.7;
}
```

> The `--player-color` CSS custom property is set via inline style on each `.player-row`. The `PlayerListController` already sets inline `style` for the dot color — in Task 9 of this plan we wire up the CSS variable. For now the bar is invisible (falls back to `--border`) but the structure is in place.

- [ ] **Step 3: Update dot, player-meta, text styles**

```css
.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    cursor: pointer;
    /* glow applied inline via box-shadow matching the dot background */
}

.player-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.player-name {
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.01em;
    color: var(--text);
}

.player-row.disabled .player-name {
    color: var(--text-muted);
}

.player-sub {
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.player-rating {
    font-weight: 700;
    color: var(--text-secondary);
}

.player-trend {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 700;
}

.player-trend.trend-up   { color: var(--success); }
.player-trend.trend-down { color: var(--error); }
.player-trend.trend-flat { color: var(--text-muted); }

.player-time-class { color: var(--text-muted); }

.player-row.disabled .player-trend,
.player-row.disabled .player-rating,
.player-row.disabled .player-time-class {
    color: var(--text-muted);
}
```

- [ ] **Step 4: Update toggle switch**

```css
.toggle {
    position: relative;
    width: 42px;
    height: 24px;
}

.toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: rgba(0,255,180,0.08);
    border-radius: 999px;
    transition: background 0.2s ease;
    border: 1px solid var(--border);
}

.slider::before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    top: 3px;
    background: var(--text-muted);
    border-radius: 50%;
    transition: transform 0.2s ease, background 0.2s ease;
}

.toggle input:disabled + .slider {
    background: rgba(0,255,180,0.03);
    border-color: rgba(0,255,180,0.06);
    cursor: not-allowed;
}

.toggle input:disabled + .slider::before {
    background: var(--border);
}

.toggle input:checked + .slider {
    background: rgba(0,255,180,0.15);
    border-color: var(--border-bright);
}

.toggle input:checked + .slider::before {
    transform: translateX(18px);
    background: var(--cyan);
    box-shadow: 0 0 6px var(--cyan);
}

.ghost-btn {
    background: transparent;
    color: var(--text-muted);
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.ghost-btn:hover {
    color: var(--text);
    border-color: var(--border);
    background: var(--bg-elevated);
}
```

- [ ] **Step 5: Wire up `--player-color` CSS variable in `PlayerListController`**

Open [src/controllers/PlayerListController.js](src/controllers/PlayerListController.js) and find where player rows are rendered (look for `player-row` class being assigned). Add the `--player-color` inline style alongside the existing dot color assignment.

Find the line that sets the dot's background color — something like:
```js
dot.style.background = color;
```

On the **same `row` element**, add:
```js
row.style.setProperty('--player-color', color);
```

Also add a glow to the dot:
```js
dot.style.boxShadow = `0 0 8px ${color}`;
```

- [ ] **Step 6: Verify in browser**

Player rows should show a thin colored left edge bar matching each player's assigned color with a glow. Toggle switches should be cyan when active.

- [ ] **Step 7: Commit**

```bash
git add styles.css src/controllers/PlayerListController.js
git commit -m "feat(theme): restyle player list, collapsible, toggles with neon accents"
```

---

## Task 7: Range Buttons, Chart Panel, Range Selector

**Files:**
- Modify: `styles.css` (`.chart-panel`, `.range-panel`, `.range-buttons`, `.range-overlay`, `.chart-wrap`, `.range-selector-*`)

- [ ] **Step 1: Update chart panel and range panel**

```css
.chart-panel {
    padding: 16px 18px;
    display: grid;
    gap: 12px;
}

.range-panel {
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    display: grid;
    gap: 10px;
}

.range-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.range-values {
    font-family: 'JetBrains Mono', monospace;
    color: var(--cyan-dim);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.06em;
    white-space: nowrap;
    margin-left: auto;
}

.range-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
```

- [ ] **Step 2: Update range button styles**

```css
.range-buttons button {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 6px 11px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.06em;
    cursor: pointer;
    text-transform: uppercase;
    transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.range-buttons button:hover {
    border-color: var(--border-bright);
    color: var(--text);
}

.range-buttons button:active {
    transform: translateY(1px);
}

.range-buttons button.active {
    background: rgba(0,255,180,0.1);
    color: var(--cyan);
    border-color: var(--border-bright);
    box-shadow: 0 0 10px rgba(0,255,180,0.12);
}

.range-buttons button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.range-buttons button:disabled:hover {
    border-color: var(--border);
    color: var(--text-muted);
}
```

- [ ] **Step 3: Update chart wrap and range selector**

```css
.chart-wrap {
    position: relative;
    width: 100%;
    height: 420px;
}

.range-selector-panel {
    display: grid;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
}

.range-selector-wrap {
    position: relative;
    width: 100%;
    height: 80px;
    cursor: pointer;
}

#range-chart {
    display: block;
    width: 100% !important;
    height: 100% !important;
}

.range-overlay {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(0,255,180,0.07);
    border-left: 2px solid var(--cyan);
    border-right: 2px solid var(--cyan);
    box-shadow: 0 0 10px rgba(0,255,180,0.1);
    cursor: grab;
    user-select: none;
    transition: background 0.1s ease;
}

.range-overlay:hover {
    background: rgba(0,255,180,0.12);
}

.range-overlay.dragging {
    cursor: grabbing;
    background: rgba(0,255,180,0.15);
}

.range-overlay.left-resize,
.range-overlay.right-resize {
    cursor: col-resize;
}

.range-overlay::before,
.range-overlay::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 100%;
    top: 0;
    cursor: col-resize;
    background: transparent;
}

.range-overlay::before { left: -6px; }
.range-overlay::after  { right: -6px; }

canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
}
```

- [ ] **Step 4: Verify in browser**

Range buttons should be monospace uppercase. Active button (`6M` by default) should have a cyan glow box. Range overlay should be a translucent cyan band with glowing edges.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat(theme): restyle chart panel, range buttons, and range selector overlay"
```

---

## Task 8: Tab Bar + Weekly Games Table

**Files:**
- Modify: `styles.css` (`.tab-bar`, `.tab-btn`, `.weekly-table`, `.game-cell`, `.game-accuracy-badge`, `.analysis-progress`)
- Modify: `index.html` (update tab button text labels)

- [ ] **Step 1: Update tab button text in `index.html`**

Find the `.tab-bar` and update button text to uppercase monospace-friendly labels:

```html
            <div class="tab-bar">
                <button class="tab-btn tab-btn-active" data-tab="weekly">WEEKLY_GAMES</button>
                <button class="tab-btn" data-tab="openings">OPENINGS</button>
            </div>
```

- [ ] **Step 2: Update tab bar and tab button styles**

```css
.bottom-panel {
    margin-top: 14px;
}

.tab-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
}

.tab-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    padding: 5px 14px;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
    width: auto;
}

.tab-btn:hover {
    background: var(--bg-elevated);
    color: var(--text);
}

.tab-btn-active {
    background: rgba(0,255,180,0.08);
    border-color: var(--border-bright);
    color: var(--cyan);
    box-shadow: 0 0 8px rgba(0,255,180,0.1);
}
```

- [ ] **Step 3: Update weekly table styles**

```css
.weekly-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    table-layout: fixed;
}

.weekly-table th,
.weekly-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid rgba(0,255,180,0.07);
}

.weekly-table th:first-child,
.weekly-table td:first-child {
    width: 160px;
}

.weekly-table th {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

.weekly-table tbody tr:last-child td {
    border-bottom: none;
}

.player-cell {
    display: flex;
    align-items: center;
    gap: 10px;
}

.player-cell .dot {
    flex-shrink: 0;
}
```

- [ ] **Step 4: Update game cell styles**

```css
.game-cell {
    cursor: pointer;
    transition: background 0.15s ease;
    border-radius: 6px;
    padding: 7px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    display: inline-flex;
    flex-direction: column;
    gap: 3px;
}

.game-cell:hover {
    background: rgba(0,255,180,0.04);
}

.game-cell.best {
    border-left: 2px solid var(--success);
    box-shadow: -2px 0 8px rgba(57,255,143,0.2);
}

.game-cell.worst {
    border-left: 2px solid var(--error);
    box-shadow: -2px 0 8px rgba(255,68,102,0.2);
}

.game-cell.random {
    border-left: 2px solid var(--cyan);
    box-shadow: -2px 0 8px rgba(0,255,180,0.15);
}

.game-cell-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
```

- [ ] **Step 5: Update accuracy badge styles**

```css
.game-accuracy-badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid transparent;
}

.game-accuracy-badge.high {
    background: rgba(57,255,143,0.1);
    color: var(--success);
    border-color: rgba(57,255,143,0.3);
}

.game-accuracy-badge.medium {
    background: rgba(255,184,48,0.1);
    color: var(--warning);
    border-color: rgba(255,184,48,0.3);
}

.game-accuracy-badge.low {
    background: rgba(255,68,102,0.1);
    color: var(--error);
    border-color: rgba(255,68,102,0.3);
}

.game-accuracy-badge.pending {
    background: rgba(0,255,180,0.05);
    color: var(--text-muted);
    border-color: var(--border);
}

.game-accuracy-badge.analyzing {
    background: rgba(0,255,180,0.08);
    color: var(--cyan);
    border-color: var(--border-bright);
    animation: pulse 1.5s ease-in-out infinite;
}

.game-accuracy-badge.failed {
    background: rgba(140,170,155,0.08);
    color: var(--text-muted);
    border-color: var(--border);
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.game-opponent {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
}

.game-result {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
}

.game-result.win  { color: var(--success); }
.game-result.loss { color: var(--error); }
.game-result.draw { color: var(--warning); }

.no-games-cell {
    color: var(--text-muted);
    font-style: italic;
    font-size: 12px;
}
```

- [ ] **Step 6: Update analysis progress bar**

```css
.analysis-progress {
    height: 3px;
    background: var(--bg-elevated);
    border-radius: 2px;
    margin-top: 10px;
    overflow: hidden;
}

.analysis-progress.hidden {
    display: none;
}

.analysis-progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--cyan), rgba(0,255,180,0.5), var(--cyan));
    background-size: 200% 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
    box-shadow: 0 0 8px var(--cyan), 0 0 16px rgba(0,255,180,0.3);
    animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
```

- [ ] **Step 7: Verify in browser**

Tab bar should show `WEEKLY_GAMES` in cyan with glow, `OPENINGS` in muted. Table headers should be monospace uppercase. Game cells should have colored left bars with neon shadows.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css
git commit -m "feat(theme): restyle tab bar, weekly games table, game cells, accuracy badges"
```

---

## Task 9: Openings Panel

**Files:**
- Modify: `styles.css` (`.openings-*` rules)

- [ ] **Step 1: Update openings filter styles**

```css
.openings-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
    margin-bottom: 14px;
}

.openings-player-field {
    min-width: 180px;
    max-width: 260px;
}

.openings-window-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.openings-window-btns {
    display: flex;
    gap: 4px;
}

.openings-window-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-muted);
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.06em;
    padding: 4px 10px;
    transition: color 0.15s, border-color 0.15s;
}

.openings-window-btn:hover {
    color: var(--text);
    border-color: var(--border-bright);
}

.openings-window-btn-active {
    border-color: var(--border-bright);
    color: var(--cyan);
    box-shadow: 0 0 8px rgba(0,255,180,0.1);
}
```

- [ ] **Step 2: Update openings chart and table styles**

```css
.openings-chart-wrap {
    margin-bottom: 20px;
    max-height: 320px;
}

.openings-chart-wrap canvas {
    max-height: 320px;
}

.openings-tables {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.openings-color-heading {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    margin: 0 0 8px;
    text-transform: uppercase;
}

.openings-table {
    border-collapse: collapse;
    font-size: 13px;
    width: 100%;
}

.openings-table th {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    padding: 6px 8px;
    text-align: left;
    user-select: none;
    white-space: nowrap;
    text-transform: uppercase;
}

.openings-table th:hover {
    color: var(--text-secondary);
}

.openings-table th.sort-active {
    color: var(--cyan);
}

.openings-table th.sort-active::after {
    content: ' ↓';
}

.openings-table th.sort-active.sort-asc::after {
    content: ' ↑';
}

.openings-table td {
    border-top: 1px solid rgba(0,255,180,0.06);
    color: var(--text);
    padding: 6px 8px;
}

.openings-table tr:hover td {
    background: rgba(0,255,180,0.03);
}

.openings-table .cell-eco {
    font-family: 'JetBrains Mono', monospace;
    color: var(--cyan);
    font-size: 11px;
}

.openings-table .cell-name {
    color: var(--text-secondary);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.openings-table .cell-other {
    color: var(--text-muted);
    font-style: italic;
}

.openings-table .cell-win  { color: var(--success); }
.openings-table .cell-loss { color: var(--error); }
.openings-table .cell-draw { color: var(--text-secondary); }
```

- [ ] **Step 3: Verify in browser**

Switch to the Openings tab. Table headers should be monospace uppercase muted. Active window button should be cyan-bordered. ECO codes should be cyan monospace.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "feat(theme): restyle openings panel filters and tables"
```

---

## Task 10: Modal + Color Picker

**Files:**
- Modify: `styles.css` (`.modal-*`, `.control-btn`, `.move-list`, `.color-picker`, `.color-swatch`)

- [ ] **Step 1: Update modal styles**

```css
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(6px);
}

.modal-overlay.hidden {
    display: none;
}

.game-modal {
    background: var(--bg-panel);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    max-width: 520px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 0 40px rgba(0,255,180,0.08), 0 20px 50px rgba(0,0,0,0.5);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
}

.modal-header h3 {
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--cyan);
}

.modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 24px;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    transition: color 0.12s;
}

.modal-close:hover {
    color: var(--text);
}

.modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.game-info {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    font-size: 12px;
}

.board-container {
    width: 100%;
    max-width: 400px;
}

#chess-board {
    width: 100%;
}

.playback-controls {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.control-btn {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 9px 16px;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
}

.control-btn:hover {
    border-color: var(--border-bright);
    box-shadow: 0 0 8px rgba(0,255,180,0.12);
    transform: translateY(-1px);
}

.control-btn:active {
    transform: translateY(0);
}

.control-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.move-display {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    font-size: 12px;
}

.move-list {
    max-height: 120px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    background: var(--bg-elevated);
    padding: 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    width: 100%;
    line-height: 1.6;
}

.move-list .move {
    display: inline-block;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
}

.move-list .move:hover {
    background: rgba(0,255,180,0.08);
}

.move-list .move.active {
    background: rgba(0,255,180,0.15);
    color: var(--cyan);
    border: 1px solid var(--border-bright);
}

.modal-footer {
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: center;
}

.modal-footer .secondary-btn {
    text-decoration: none;
}

/* Chessboard overrides */
.board-b72b1 {
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 0 20px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
}
```

- [ ] **Step 2: Update color picker**

```css
.color-picker {
    position: absolute;
    display: flex;
    gap: 8px;
    padding: 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(0,255,180,0.12), 0 8px 24px rgba(0,0,0,0.4);
    z-index: 20;
}

.color-picker.hidden {
    display: none;
}

.color-swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid transparent;
    padding: 0;
    background: transparent;
    cursor: pointer;
    transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.color-swatch:focus {
    outline: none;
}

.color-swatch:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.color-swatch.active {
    border-color: var(--text);
    box-shadow: 0 0 0 2px rgba(200,224,216,0.15);
}
```

- [ ] **Step 3: Update mobile breakpoints**

```css
@media (max-width: 720px) {
    body {
        padding: 20px 12px 36px;
    }

    form {
        flex-direction: column;
        align-items: stretch;
    }

    .player-row {
        grid-template-columns: auto 1fr auto;
    }

    .weekly-table th:first-child,
    .weekly-table td:first-child {
        display: none;
    }

    .game-modal {
        max-width: 100%;
        border-radius: 8px;
    }

    .board-container {
        max-width: 300px;
    }

    .openings-tables {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 4: Verify in browser**

Open a game replay modal. The modal should have a cyan-bordered panel with dark background. Active move should highlight in cyan. Playback buttons should glow on hover.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat(theme): restyle game modal, playback controls, move list, color picker"
```

---

## Task 11: Update AppConfig Player Color Palette

**Files:**
- Modify: `src/config/AppConfig.js`

- [ ] **Step 1: Open `AppConfig.js` and find the player color palette array**

Look for an array of hex color strings used as default player colors (used by `PlayerManager` when adding new players).

- [ ] **Step 2: Replace the palette with neon values**

Replace whatever colors are there with:

```js
PLAYER_COLORS: [
    '#00FFB4', // cyan
    '#FF64C8', // pink
    '#FFB830', // amber
    '#7C6EFF', // indigo
    '#FF6B6B', // coral
    '#00D4FF', // sky
    '#A8FF3E', // lime
    '#FF9F43', // orange
],
```

- [ ] **Step 3: Verify in browser**

Remove all players and re-add one. The first player's dot and chart line should be `#00FFB4` (cyan).

- [ ] **Step 4: Commit**

```bash
git add src/config/AppConfig.js
git commit -m "feat(theme): update default player color palette to neon values"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All spec sections covered — color tokens (Task 1), font (Task 1), background texture (Task 2), header (Task 3), panel scanlines + corners (Task 4), form/buttons/status (Task 5), player list (Task 6), range buttons + chart (Task 7), tabs + weekly games (Task 8), openings (Task 9), modal (Task 10), color palette (Task 11)
- [x] **Placeholders:** None found — all CSS values are concrete hex/rgba, all selectors are exact
- [x] **Type consistency:** No functions/types used across tasks (pure CSS + one JS property set in Task 6)
- [x] **CSS variable aliases:** Old token names (`--bg-main`, `--accent`, etc.) preserved as aliases in Task 1 so JS-rendered HTML using those variables doesn't break
