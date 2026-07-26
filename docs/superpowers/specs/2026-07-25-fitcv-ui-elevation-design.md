# FitCV UI Elevation — Ethereal Glass Redesign

**Date:** 2026-07-25
**Status:** Draft (pending user review)
**Design Direction:** Ethereal Glass (SaaS / AI / Premium)

---

## 1. Design Dials

| Dial | Value | Meaning |
|------|-------|---------|
| DESIGN_VARIANCE | 8/10 | Bold / Asymmetric — break the centered-grid monotony |
| MOTION_INTENSITY | 7/10 | Standard scroll/stagger with spring physics |
| VISUAL_DENSITY | 5/10 | Standard — maintain current information density |

---

## 2. Typography & Icon System

### 2.1 Fonts

| Role | Current | New | Rationale |
|------|---------|-----|-----------|
| Display (headings h1-h4) | `Space Grotesk` | `Cabinet Grotesk` | Extreme geometric precision, tight tracking, premium aura. Available via fontsource or Google Fonts alternate. |
| Body | `Inter` | `Geist` | Lighter, more modern than Inter; Vercel-proven readability |
| Mono (numbers, scores, code) | — (inherits body) | `JetBrains Mono` | Tabular numbers align perfectly in ScoreRing and stats |

### 2.2 Google Fonts Strategy

Replace current `@import` in `index.css:1` with:

```html
<!-- index.html: Preconnect for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

```css
/* Self-host via next/font equivalent or use @font-face with display:swap */
/* Fallback: Google Fonts link with swap */
@import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

### 2.3 CSS Variable Updates

```css
--font-display: 'Cabinet Grotesk', 'Geist', system-ui, sans-serif;
--font-body: 'Geist', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### 2.4 Icons

| Item | Current | New | Rationale |
|------|---------|-----|-----------|
| Library | `lucide-react` | `@phosphor-icons/react` | Thinner stroke (1px vs 2px), more elegant |
| Weight | default | `light` | Phosphor Light = hairline precision. Chosen over `thin` for readability at smaller sizes. |
| Consistency | mixed | single weight everywhere | Unified visual language |
| Stroke | 2px | 1.5px | Matches glass aesthetic |

Navigation items, buttons, badges all switch to Phosphor. Lucide stays only if a specific icon has no Phosphor equivalent (rare).

### 2.5 Impacted Files

- `src/index.css` — font variables, `@import` URL
- `src/data/navigation.tsx` — replace lucide icon imports with phosphor
- All 19 screen files + 7 component files — replace `<IconName>` with phosphor equivalents

---

## 3. Card & Surface Architecture ("Double-Bezel")

### 3.1 New Card Token System

Every card surface gets a nested "outer shell + inner core" structure:

```
Outer shell:
  background: rgba(0,0,0,0.03)          /* light */
  background: rgba(255,255,255,0.05)    /* dark */
  padding: 2px
  border-radius: 22px
  border: 1px solid rgba(255,255,255,0.10)

Inner core:
  background: #ffffff                    /* light */
  background: #12121a                    /* dark */
  border-radius: 20px                    /* = 22px - 2px padding */
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.15)
  padding: 22px                          /* inner content padding */
```

### 3.2 CSS Variable Additions

```css
:root {
  --glass-bg: rgba(255, 255, 255, 0.70);
  --glass-bg-dark: rgba(0, 0, 0, 0.60);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-blur: 24px;
  --glass-saturate: 180%;

  --card-outer-bg: rgba(0, 0, 0, 0.03);
  --card-outer-border: rgba(255, 255, 255, 0.10);
  --card-outer-radius: 22px;
  --card-inner-bg: #ffffff;
  --card-inner-radius: 20px;

  --noise-opacity: 0.025;
  --mesh-blur: 120px;
}

[data-theme="dark"], .dark {
  --card-outer-bg: rgba(255, 255, 255, 0.05);
  --card-inner-bg: #12121a;
}
```

### 3.3 New CSS Classes

```css
/* Glass surface for topbar, modals, floating elements */
.fc-glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
}

/* Double-Bezel card wrapper */
.fc-card-bezel {
  background: var(--card-outer-bg);
  padding: 2px;
  border-radius: var(--card-outer-radius);
  border: 1px solid var(--card-outer-border);
}
.fc-card-bezel > .fc-card-inner {
  background: var(--card-inner-bg);
  border-radius: var(--card-inner-radius);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.15);
}

/* Gradient mesh background orbs */
.fc-mesh-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(var(--mesh-blur));
  pointer-events: none;
}
```

### 3.4 Film Grain Overlay

```css
.fc-grain {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
  opacity: var(--noise-opacity);
  background-image: url("data:image/svg+xml,..."); /* SVG noise pattern */
  mix-blend-mode: overlay;
}
```

### 3.5 Ảnh hưởng

- `src/index.css` — add all tokens + classes above
- `src/ui/components/Layout.tsx` — apply `.fc-glass` to topbar, add `.fc-grain` overlay
- All card usages (`fc-card`, `fc-stat`) — wrap in bezel structure
- `AuthScreen.tsx` — background gets mesh orbs
- Dashboard screens — cards get bezel + scroll reveal

---

## 4. Motion & Interaction System

### 4.1 Scroll-Reveal Stagger (Dashboard & Lists)

Replace existing `fc-stagger` CSS-only with framer-motion `whileInView` for better control:

```tsx
// Shared scroll-reveal wrapper component
// src/ui/components/RevealStagger.tsx
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
>
  {children}
</motion.div>
```

Timing: duration 600-800ms, custom cubic-bezier `(0.32, 0.72, 0, 1)`, stagger delay 60ms per child.

### 4.2 Magnetic Button Physics

```css
/* Enhanced button press */
.fc-btn:active {
  transform: translateY(1px) scale(0.97);
  transition-duration: 0.05s;
}

/* Button-in-Button: nested icon circle */
.fc-btn--primary .fc-btn__icon {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s ease;
}
.fc-btn--primary:hover .fc-btn__icon {
  transform: translateX(2px) scale(1.05);
}
```

### 4.3 Page Transitions (Direction-Aware)

```tsx
// In Layout.tsx — use direction-aware AnimatePresence
// instead of current flat fade
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};
```

### 4.4 Pipeline Drag & Drop

- Replace button-based column moves with `@dnd-kit/core` + `@dnd-kit/sortable`
- Cards: `scale: 1.02` when dragging, spring animation on drop
- Columns: highlight on hover-over during drag

### 4.5 Search → Command Palette

- Cmd+K / Ctrl+K triggers floating palette
- Uses `@phosphor-icons/react` search icon
- Lists: screens, recent candidates, recent jobs
- `cmdk` library or custom implementation

### 4.6 ScoreRing Entrance Animation

- Current: static SVG with dashoffset transition
- New: spring entrance on mount — ring draws around with `scale: 0.8 → 1.0` + number counts up via `AnimatedNumber`

---

## 5. Dark Mode (Full)

### 5.1 Implementation Strategy

CSS class-based: `.dark` on `<html>` + Tailwind `dark:` variant + CSS variable swap.

### 5.2 Token Mapping

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#f6f7fb` | `#0a0a0f` |
| `--bg-grain` | `#eef0f6` | `#0e0e14` |
| `--surface` | `#ffffff` | `#12121a` |
| `--surface-2` | `#fbfcfe` | `#181822` |
| `--ink` | `#0b1020` | `#000000` |
| `--ink-2` | `#161d33` | `#0a0a10` |
| `--text-primary` | `#0f172a` | `#e8e8ed` |
| `--text-secondary` | `#64748b` | `#9e9eb0` |
| `--border` | `#e7e9f1` | `#1e1e2a` |
| `--border-strong` | `#d7dae6` | `#2a2a3a` |
| `--shadow-sm` | light shadow | shadow with colored light |
| `--shadow-md` | light shadow | shadow with colored light |

### 5.3 Seeker Accent (Dark)

```css
.dark, [data-theme="dark"] {
  --accent: #3b82f6;          /* brighter blue for dark bg */
  --accent-soft: rgba(59, 130, 246, 0.12);
  --accent-glow: rgba(59, 130, 246, 0.25);
}
```

HR portal amber also gets brighter equivalents.

### 5.4 Compatibility with data-portal

Dark mode `.dark` class works alongside existing `data-portal="hr"` attribute — both can be present on `<html>` / root element. The `[data-portal="hr"]` override (amber accent) remains active in both light and dark themes.

### 5.6 Toggle Placement

Right side of topbar, next to notification bell. Sun/Moon icon from Phosphor.

### 5.5 Mesh Orbs in Dark

Deep blue/purple orbs with even larger blur (`blur-3xl`), lower opacity (`0.15`).

---

## 6. Navigation & Layout Updates

### 6.1 Floating Glass Topbar

- **Current:** full-width topbar, edge-to-edge
- **New:** `mx-4 mt-2`, `rounded-2xl`, `backdrop-blur-3xl`, glass border
- Inner height: still `64px`, but visually floating
- Search expands on focus with glass dropdown

### 6.2 Command Palette (Cmd+K)

- Trigger: `fc-search` input focus or Cmd+K
- Floating modal: glass surface, search input at top, results below
- Sections: Pages, Recent Candidates, Recent Jobs, Actions
- Keyboard nav: arrow keys, Enter to select, Escape to close

---

## 7. Screen-Specific Upgrades

### 7.1 AuthScreen

- **Background:** cinematic gradient mesh with 3 floating blur orbs animated via framer-motion (slow drift, 20s cycle)
- **Panel:** glass card with bezel wrapper, floating centered
- **Form:** staggered field reveal (60ms delay each)
- **Google button:** custom styling matching bezel pattern

### 7.2 SeekerDashboard / HRDashboard

- Stat cards: bezel wrapper + scroll-reveal stagger
- ScoreRing: spring entrance animation
- Spotlight card: keep existing framer-motion mouse tracking, enhance with glass effect
- Activity timeline: bezel-styled timeline items

### 7.3 AnalyzerScreen

- CV drop zone: bezel wrapper, glass hover state, animated border gradient on file accept
- Score result card: bezel wrapper, animated ring entrance
- Breakdown bars: spring progress animation

### 7.5 PipelineScreen

- Kanban columns: glass background, bezel inner cards
- Drag: `@dnd-kit` with magnetic snap
- Column headers: pill badges with phosphor icons

### 7.6 BulkCvRankingPanel

- Tab switcher: pill-style tabs with glass active state
- CV preview: bezel-framed iframe
- Threshold slider: custom styled with gradient track

---

## 8. Performance & Code Quality

### 8.1 Route-Level Code Splitting

```tsx
const SeekerDashboard = lazy(() => import("@/ui/screens/SeekerDashboard"))
const AnalyzerScreen = lazy(() => import("@/ui/screens/AnalyzerScreen"))
// ... all 14+ screens
```

Wrapper: `<Suspense fallback={<FullPageSkeleton />}>` wraps the screen render in `App.tsx:327` (inside `<AnimatePresence>`), not in Layout. Each screen's lazy import resolves independently.

### 8.2 Toast Notification System

Install `sonner` (1.6kB). Position: bottom-right. Styling: glass surface.

### 8.3 Empty States Audit

Screens needing improved empty states:
- CVHistoryScreen: "No CVs uploaded yet" + illustration + CTA
- JDLibraryScreen: "No saved job descriptions" + CTA
- PipelineScreen: empty column state per column
- ReportsScreen: "No data yet" + chart skeleton

### 8.4 Font Loading

- Preconnect links in `index.html`
- `font-display: swap` enforced
- Reserve `--font-display` fallback stack to prevent CLS

---

## 9. Implementation Order

| Phase | Items | Effort |
|-------|-------|--------|
| **1. Foundation** | CSS tokens, Double-Bezel classes, font preconnect, glass utility, grain overlay | 1 session |
| **2. Dark Mode** | Token mapping, `.dark` support, toggle, test both portals | 1 session |
| **3. Motion** | Scroll-reveal component, button physics, page transitions, ScoreRing spring | 1 session |
| **4. Fonts & Icons** | Replace fonts in CSS, replace lucide with phosphor across all files, update nav config | 2 sessions |
| **5. Nav & Layout** | Floating topbar, command palette, side drawer polish | 1 session |
| **6. Performance** | Lazy loading screens, sonner toast, empty states | 1 session |
| **7. Screen Polish** | Auth mesh background, pipeline drag-drop, dashboard cards -> bezel | 2 sessions |

**Total:** ~8-9 implementation sessions (estimate).

---

## 10. Anti-Patterns to Avoid

- ❌ Pure black `#000000` — use `#0a0a0f` or `#12121a` for dark
- ❌ Harsh drop shadows — use tinted/colored shadows matching background
- ❌ Lucide icons mixed with Phosphor — one family only
- ❌ Inter font — fully replaced by Geist
- ❌ 1px solid gray borders — use glass/bezel borders with transparency
- ❌ `shadow-md` generic — use custom shadow tokens with hue shift
- ❌ Animating width/height — use transform and opacity only
- ❌ `h-screen` — use `min-h-[100dvh]`
