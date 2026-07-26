# FitCV UI Elevation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform FitCV from "modern SaaS" to "Awwwards-tier Ethereal Glass" — new font/icon system, Double-Bezel card architecture, dark mode, scroll-reveal motion, floating glass topbar, command palette, performance optimization.

**Architecture:** Layer changes bottom-up — first CSS tokens + utility classes, then global components (Layout), then per-screen upgrades. Each phase produces independently verifiable visual output via `npm run dev`.

**Tech Stack:** React 19 + Vite 8, Tailwind CSS v4, framer-motion (12.x), `@phosphor-icons/react`, `@dnd-kit/core`, `sonner`, Cabinet Grotesk + Geist + JetBrains Mono.

## Global Constraints

- Cabinet Grotesk display, Geist body, JetBrains Mono for numbers — all self-hosted via `@fontsource/*` or Google Fonts `display=swap`
- `@phosphor-icons/react` weight `light` — no mixing with lucide-react
- All animations animate `transform` and `opacity` only — never `width`/`height`/`top`/`left`
- `prefers-reduced-motion` respected everywhere
- `min-h-[100dvh]` instead of `h-screen`
- Dark mode via `.dark` class + CSS variable swap — coexists with `data-portal="hr"`
- Double-Bezel: outer shell (2px padding + border) wraps inner core (rounded content)
- No pure `#000000` — use `#0a0a0f` for dark surfaces
- Files use layer architecture: `src/ui/`, `src/app/`, `src/api/`, `src/services/`, `src/data/`, `src/types/`

---

## File Structure

### Created Files
| File | Purpose |
|------|---------|
| `src/ui/components/RevealStagger.tsx` | Scroll-reveal stagger wrapper using framer-motion |
| `src/ui/components/FloatingTopbar.tsx` | Glass floating topbar replacement |
| `src/ui/components/CommandPalette.tsx` | Cmd+K search palette |
| `src/ui/components/FullPageSkeleton.tsx` | Loading fallback for lazy screens |
| `src/ui/components/ThemeToggle.tsx` | Dark mode toggle button |
| `src/ui/components/BezelCard.tsx` | Reusable Double-Bezel card wrapper |
| `src/ui/components/ToastProvider.tsx` | Sonner toast setup |
| `src/services/theme.ts` | Dark mode persistence + detection |

### Modified Files
| File | Changes |
|------|---------|
| `src/index.css` | Font faces, new tokens, glass/bezel classes, grain overlay, dark mode vars |
| `src/index.html` | Font preconnect links |
| `src/main.tsx` | Theme initialization |
| `src/app/App.tsx` | Lazy imports, Suspense wrapper |
| `src/ui/components/Layout.tsx` | Floating topbar, glass sidebar, theme toggle, grain overlay |
| `src/ui/components/ScoreRing.tsx` | Spring entrance animation |
| `src/data/navigation.tsx` | Lucide → Phosphor icon imports |
| All 19 screen files | Icon replacements, bezel wrappers |
| `src/ui/screens/AuthScreen.tsx` | Mesh gradient background, glass form card |
| `src/ui/screens/SeekerDashboard.tsx` | Bezel stat cards, scroll-reveal stagger |
| `src/ui/screens/HRDashboard.tsx` | Bezel stat cards, scroll-reveal stagger |
| `src/ui/screens/AnalyzerScreen.tsx` | Bezel drop zone, animated score |
| `src/ui/screens/PipelineScreen.tsx` | @dnd-kit drag-and-drop |

---

## Task 1: CSS Foundation — Tokens, Glass, Bezel, Grain

**Files:**
- Modify: `src/index.css` (lines 10-65: token block; add after line 952: new classes)
- Modify: `index.html` (preconnect links in `<head>`)

**Dependencies:** None (pure CSS)
**Produces:** CSS custom properties and utility classes used by all later tasks

- [ ] **Step 1: Add font preconnect to index.html**

Read `index.html` (project root), add inside `<head>` after `<meta name="viewport" />`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

- [ ] **Step 2: Update Google Fonts import**

In `src/index.css`, replace current `@import` line (line 1) with:

```css
@import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import 'tailwindcss';
```

- [ ] **Step 3: Update font CSS variables**

In `src/index.css`, replace the `--font-display` and `--font-body` lines inside `:root` block:

```css
--font-display: 'Cabinet Grotesk', 'Geist', system-ui, sans-serif;
--font-body: 'Geist', system-ui, -apple-system, sans-serif;
```

- [ ] **Step 4: Add new design tokens to :root**

After the existing shadow tokens in `:root`, add:

```css
/* Glass */
--glass-bg: rgba(255, 255, 255, 0.72);
--glass-border: rgba(255, 255, 255, 0.15);
--glass-blur: 24px;
--glass-saturate: 180%;

/* Double-Bezel card */
--card-outer-bg: rgba(0, 0, 0, 0.03);
--card-outer-border: rgba(255, 255, 255, 0.10);
--card-outer-radius: 22px;
--card-inner-bg: #ffffff;
--card-inner-radius: 20px;

/* Mesh orbs */
--mesh-blur: 120px;
--noise-opacity: 0.025;
```

- [ ] **Step 5: Add dark mode token overrides**

Add after the HR portal `[data-portal='hr']` block:

```css
/* Dark mode — class toggled by JS, works independently of data-portal */
.dark {
  --bg: #0a0a0f;
  --bg-grain: #0e0e14;
  --surface: #12121a;
  --surface-2: #181822;
  --ink: #000000;
  --ink-2: #0a0a10;
  --ink-3: #10101a;
  --border: #1e1e2a;
  --border-strong: #2a2a3a;
  --hairline: #181822;
  --text-primary: #e8e8ed;
  --text-secondary: #9e9eb0;
  --text-muted: #6b6b80;
  --accent: #3b82f6;
  --accent-soft: rgba(59, 130, 246, 0.12);
  --accent-glow: rgba(59, 130, 246, 0.25);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 6px 20px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 18px 50px rgba(0, 0, 0, 0.5);
  --card-outer-bg: rgba(255, 255, 255, 0.05);
  --card-inner-bg: #12121a;
}
.dark[data-portal='hr'] {
  --accent: #f59e0b;
  --accent-soft: rgba(245, 158, 11, 0.12);
  --accent-glow: rgba(245, 158, 11, 0.25);
}
```

- [ ] **Step 6: Add glass utility class**

Add after the `fc-progress` section:

```css
/* ============================================================
   Glass surface — floating topbar, modals, floating elements
   ============================================================ */
.fc-glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
}
.dark .fc-glass {
  background: rgba(0, 0, 0, 0.65);
}
```

- [ ] **Step 7: Add Double-Bezel card classes**

Add after the glass class:

```css
/* ============================================================
   Double-Bezel card — outer shell + inner core
   ============================================================ */
.fc-bezel {
  background: var(--card-outer-bg);
  padding: 2px;
  border-radius: var(--card-outer-radius);
  border: 1px solid var(--card-outer-border);
  transition: border-color 0.35s ease;
}
.fc-bezel:hover {
  border-color: var(--accent);
}
.fc-bezel__inner {
  background: var(--card-inner-bg);
  border-radius: var(--card-inner-radius);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15);
  padding: 22px;
  height: 100%;
}
.dark .fc-bezel__inner {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

- [ ] **Step 8: Add grain overlay and mesh orb utilities**

At the end of `src/index.css`, before the legacy aliases:

```css
/* ============================================================
   Film grain overlay — fixed, pointer-events-none
   ============================================================ */
.fc-grain {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: var(--noise-opacity);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
  mix-blend-mode: overlay;
}
.dark .fc-grain {
  opacity: calc(var(--noise-opacity) * 2);
}

/* ============================================================
   Mesh gradient orbs — decorative background blobs
   ============================================================ */
.fc-mesh-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(var(--mesh-blur));
  -webkit-filter: blur(var(--mesh-blur));
  pointer-events: none;
}
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: Build succeeds without errors (font import changes and new CSS vars are valid).

- [ ] **Step 10: Commit**

```bash
git add src/index.css index.html
git commit -m "feat(ui): add Ethereal Glass foundation — fonts, tokens, bezel, glass, grain, dark mode vars"
```

---

## Task 2: Theme Service + Dark Mode Toggle

**Files:**
- Create: `src/services/theme.ts`
- Create: `src/ui/components/ThemeToggle.tsx`
- Modify: `src/main.tsx`

**Dependencies:** Task 1 (CSS dark tokens)
**Produces:** `themeService` and `<ThemeToggle />` used by Layout

- [ ] **Step 1: Create theme service**

Write `src/services/theme.ts`:

```ts
const THEME_KEY = "fitcv-theme"

export type Theme = "light" | "dark"

export function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === "light" || stored === "dark") return stored
  return null
}

export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function toggleTheme(): Theme {
  const current = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"
  const next: Theme = current === "dark" ? "light" : "dark"
  setStoredTheme(next)
  return next
}
```

- [ ] **Step 2: Initialize theme in main.tsx**

Read `src/main.tsx`, import and call theme init before render:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import { resolveTheme, applyTheme } from './services/theme'

applyTheme(resolveTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Create ThemeToggle component**

Write `src/ui/components/ThemeToggle.tsx`:

```tsx
import { useEffect, useState } from "react"
import { Sun, Moon } from "@phosphor-icons/react"
import { toggleTheme, resolveTheme, type Theme } from "@/services/theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (!localStorage.getItem("fitcv-theme")) {
        const sys = mq.matches ? "dark" : "light"
        setTheme(sys)
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const handle = () => {
    const next = toggleTheme()
    setTheme(next)
  }

  return (
    <button
      type="button"
      className="fc-icon-btn"
      onClick={handle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun size={18} weight="light" /> : <Moon size={18} weight="light" />}
    </button>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/services/theme.ts src/ui/components/ThemeToggle.tsx src/main.tsx
git commit -m "feat(ui): add theme service and dark mode toggle"
```

---

## Task 3: RevealStagger + ScoreRing Spring Animation

**Files:**
- Create: `src/ui/components/RevealStagger.tsx`
- Modify: `src/ui/components/ScoreRing.tsx`

**Dependencies:** Task 1 (animation CSS vars)
**Produces:** Reusable scroll-reveal and animated score components

- [ ] **Step 1: Create RevealStagger component**

Write `src/ui/components/RevealStagger.tsx`:

```tsx
import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}

export default function RevealStagger({
  children,
  className = "",
  delay = 0,
  y = 40,
}: Props) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Add spring entrance to ScoreRing**

Read `src/ui/components/ScoreRing.tsx`. Add framer-motion spring entrance around the SVG. Wrap the return in:

```tsx
import { motion, useReducedMotion } from "motion/react"

// Inside component, before return:
const reduce = useReducedMotion()

// Wrap SVG container:
<motion.div
  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
  whileInView={{ opacity: 1, scale: 1 }}
  viewport={{ once: true }}
  transition={{
    type: "spring",
    stiffness: 80,
    damping: 15,
    delay: 0.1,
  }}
  className={className}
  style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
>
  {/* existing SVG ring code */}
</motion.div>
```

Keep the existing `AnimatedNumber` children unchanged — the spring entrance is independent.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/RevealStagger.tsx src/ui/components/ScoreRing.tsx
git commit -m "feat(ui): add RevealStagger scroll animation and ScoreRing spring entrance"
```

---

## Task 4: Icons — Lucide to Phosphor Migration

**Files:**
- Modify: `src/data/navigation.tsx` (replace all lucide icon imports)
- Modify: All screen and component files that import from `lucide-react`

**Dependencies:** None (icon library swap)
**Produces:** Consistent `@phosphor-icons/react` light weight across codebase

- [ ] **Step 1: Install phosphor-icons**

```bash
npm install @phosphor-icons/react
```

- [ ] **Step 2: Update navigation config**

Read `src/data/navigation.tsx`. Replace all `lucide-react` icon imports with phosphor equivalents:

| Lucide | Phosphor (light weight) |
|--------|------------------------|
| `LayoutDashboard` | `LayoutDashboard` (exists in both — update import) |
| `Zap` | `Lightning` |
| `Lightbulb` | `Lightbulb` |
| `Clock` | `ClockCounterClockwise` |
| `CheckSquare` | `CheckSquare` |
| `BookOpen` | `BookOpenText` |
| `User` | `UserCircle` |
| `Briefcase` | `Briefcase` |
| `FileText` | `FileText` |
| `Users` | `UsersThree` |
| `Mail` | `Envelope` |
| `BarChart3` | `ChartBar` |
| `Settings` | `Gear` |

Change import line from:
```tsx
import { LayoutDashboard, Zap, ... } from "lucide-react"
```
to:
```tsx
import { LayoutDashboard, Lightning, ... } from "@phosphor-icons/react"
```

Add `weight="light"` prop to each icon in the navigation config objects.

- [ ] **Step 3: Update all screen and component files**

Grep for all `from "lucide-react"` imports across `src/ui/`:

```bash
rg 'from "lucide-react"' src/ --files-with-matches
```

For each file, replace the import line and add `weight="light"` to every `<IconName>` usage.

Phosphor icon name mapping (common ones):

| Lucide | Phosphor (light) |
|--------|-----------------|
| `Search` | `MagnifyingGlass` |
| `Bell` | `Bell` |
| `ChevronDown` | `CaretDown` |
| `ChevronLeft` | `CaretLeft` |
| `ChevronRight` | `CaretRight` |
| `ChevronUp` | `CaretUp` |
| `X` | `X` |
| `Plus` | `Plus` |
| `Minus` | `Minus` |
| `Upload` | `UploadSimple` |
| `Download` | `DownloadSimple` |
| `File` | `File` |
| `Trash2` | `TrashSimple` |
| `Edit3` | `PencilSimpleLine` |
| `Eye` | `Eye` |
| `EyeOff` | `EyeSlash` |
| `ArrowRight` | `ArrowRight` |
| `ArrowLeft` | `ArrowLeft` |
| `Check` | `Check` |
| `AlertCircle` | `WarningCircle` |
| `Info` | `Info` |
| `Loader2` | `Spinner` |
| `Menu` | `List` |
| `MoreHorizontal` | `DotsThreeOutline` |
| `Filter` | `Funnel` |
| `Grid` | `GridFour` |
| `List` | `ListBullets` |
| `Star` | `Star` |
| `Clock` | `Clock` |
| `Calendar` | `CalendarBlank` |
| `MapPin` | `MapPin` |
| `Building2` | `Buildings` |
| `GraduationCap` | `GraduationCap` |
| `Target` | `Crosshair` |
| `Award` | `Medal` |
| `TrendingUp` | `TrendUp` |
| `TrendingDown` | `TrendDown` |
| `Copy` | `CopySimple` |
| `Send` | `PaperPlaneRight` |
| `RefreshCw` | `ArrowsClockwise` |
| `Maximize2` | `ArrowsOutSimple` |
| `Minimize2` | `ArrowsInSimple` |
| `ExternalLink` | `ArrowSquareOut` |

For icons not listed, check the [Phosphor icon catalog](https://phosphoricons.com/) for the equivalent.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds, all icons render correctly.

- [ ] **Step 5: Commit**

```bash
git add src/data/navigation.tsx src/ui/
git commit -m "feat(ui): migrate icons from lucide-react to @phosphor-icons/react light weight"
```

---

## Task 5: Floating Glass Topbar + Layout Updates

**Files:**
- Create: `src/ui/components/FloatingTopbar.tsx`
- Modify: `src/ui/components/Layout.tsx`
- Modify: `src/ui/components/CommandPalette.tsx` (create placeholder first)

**Dependencies:** Task 2 (ThemeToggle), Task 4 (icons)
**Produces:** New floating topbar with glass effect, search, theme toggle

- [ ] **Step 1: Create FloatingTopbar component**

Write `src/ui/components/FloatingTopbar.tsx`:

```tsx
import { MagnifyingGlass, Bell } from "@phosphor-icons/react"
import ThemeToggle from "./ThemeToggle"

interface Props {
  userName: string
  userAvatarUrl?: string | null
  onSearchFocus?: () => void
}

export default function FloatingTopbar({
  userName,
  userAvatarUrl,
  onSearchFocus,
}: Props) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="fc-glass" style={{
      margin: "8px 16px 0",
      borderRadius: "var(--r-lg)",
      height: "var(--topbar-h)",
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "0 18px",
      flexShrink: 0,
      position: "relative",
      zIndex: 20,
    }}>
      <div className="fc-search" style={{ flex: 1, maxWidth: 360 }} onClick={onSearchFocus}>
        <MagnifyingGlass size={16} weight="light" color="var(--text-muted)" />
        <input
          type="search"
          placeholder="Search...  (Cmd+K)"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontFamily: "inherit",
            fontSize: 14,
            width: "100%",
          }}
          onFocus={onSearchFocus}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
        <ThemeToggle />

        <button type="button" className="fc-icon-btn" aria-label="Notifications">
          <Bell size={18} weight="light" />
        </button>

        <button
          type="button"
          className="fc-icon-btn"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
          aria-label="User menu"
        >
          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
              alt={userName}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                objectFit: "cover",
              }}
            />
          ) : (
            <span className="fc-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
              {initials}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {userName}
          </span>
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update Layout.tsx to use FloatingTopbar**

Read `src/ui/components/Layout.tsx`. Replace the existing topbar code with:

```tsx
import FloatingTopbar from "./FloatingTopbar"

// Inside the layout JSX, replace the old .fc-topbar with:
<FloatingTopbar
  userName={userName}
  userAvatarUrl={userAvatarUrl}
  onSearchFocus={() => {/* will connect to CommandPalette */}}
/>
```

Also add the grain overlay inside the layout wrapper:

```tsx
// After the main content area, before closing wrapper:
<div className="fc-grain" />
```

- [ ] **Step 3: Verify**

Run: `npm run build` + `npm run dev`
Expected: Topbar renders as floating glass pill, theme toggle works, dark mode toggles correctly.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/FloatingTopbar.tsx src/ui/components/Layout.tsx
git commit -m "feat(ui): floating glass topbar with search, theme toggle, user menu"
```

---

## Task 6: Command Palette (Cmd+K)

**Files:**
- Create: `src/ui/components/CommandPalette.tsx`
- Modify: `src/ui/components/Layout.tsx` (wire up search focus)

**Dependencies:** Task 4 (icons), Task 5 (topbar)
**Produces:** Global Cmd+K search palette

- [ ] **Step 1: Create CommandPalette component**

Write `src/ui/components/CommandPalette.tsx`:

```tsx
import { useEffect, useState, useCallback, useRef } from "react"
import { MagnifyingGlass, X } from "@phosphor-icons/react"
import type { Portal, ScreenId } from "@/types/app"

interface Item {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
}

interface Props {
  portal: Portal | null
  isOpen: boolean
  onClose: () => void
  onNavigate: (screen: ScreenId) => void
}

function screenItems(
  portal: Portal | null,
  onNavigate: (screen: ScreenId) => void,
): Item[] {
  if (portal === "seeker") {
    return [
      { id: "seeker-dashboard", label: "Dashboard", icon: null, action: () => onNavigate("seeker-dashboard") },
      { id: "analyzer", label: "Match Analyzer", icon: null, action: () => onNavigate("analyzer") },
      { id: "improvement", label: "Improvement Tips", icon: null, action: () => onNavigate("improvement") },
      { id: "cv-history", label: "CV History", icon: null, action: () => onNavigate("cv-history") },
      { id: "app-tracker", label: "Application Tracker", icon: null, action: () => onNavigate("app-tracker") },
      { id: "jd-library", label: "JD Library", icon: null, action: () => onNavigate("jd-library") },
      { id: "profile", label: "Profile", icon: null, action: () => onNavigate("profile") },
    ]
  }
  if (portal === "hr") {
    return [
      { id: "hr-dashboard", label: "Dashboard", icon: null, action: () => onNavigate("hr-dashboard") },
      { id: "job-posts", label: "Job Posts", icon: null, action: () => onNavigate("job-posts") },
      { id: "cv-ranking", label: "CV Ranking", icon: null, action: () => onNavigate("cv-ranking") },
      { id: "pipeline", label: "Pipeline", icon: null, action: () => onNavigate("pipeline") },
      { id: "auto-email", label: "Auto Email", icon: null, action: () => onNavigate("auto-email") },
      { id: "reports", label: "Reports", icon: null, action: () => onNavigate("reports") },
      { id: "hr-settings", label: "Settings", icon: null, action: () => onNavigate("hr-settings") },
    ]
  }
  return []
}

export default function CommandPalette({ portal, isOpen, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = screenItems(portal, onNavigate).filter(
    (item) =>
      !query || item.label.toLowerCase().includes(query.toLowerCase()),
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === "Enter" && items[selectedIndex]) {
        items[selectedIndex].action()
        onClose()
      }
    },
    [items, selectedIndex, onClose],
  )

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Palette card */}
      <div
        className="fc-glass"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <MagnifyingGlass size={18} weight="light" color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: 15,
              width: "100%",
            }}
          />
          <button
            type="button"
            className="fc-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} weight="light" />
          </button>
        </div>

        <div style={{ maxHeight: 300, overflowY: "auto", padding: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.action()
                onClose()
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: idx === selectedIndex ? "var(--accent-soft)" : "transparent",
                color: idx === selectedIndex ? "var(--accent-ink)" : "var(--text-primary)",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire CommandPalette into Layout**

In `Layout.tsx`, add state for command palette and pass to both FloatingTopbar and CommandPalette:

```tsx
import { useState, useEffect } from "react"
import CommandPalette from "./CommandPalette"

// Inside Layout component:
const [paletteOpen, setPaletteOpen] = useState(false)

// Add keyboard listener for Cmd+K / Ctrl+K
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setPaletteOpen((p) => !p)
    }
  }
  window.addEventListener("keydown", handler)
  return () => window.removeEventListener("keydown", handler)
}, [])

// Pass to FloatingTopbar:
<FloatingTopbar
  ...
  onSearchFocus={() => setPaletteOpen(true)}
/>

// Add before closing wrapper:
<CommandPalette
  portal={portal}
  isOpen={paletteOpen}
  onClose={() => setPaletteOpen(false)}
  onNavigate={onNavigate}
/>
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds. Press Cmd+K — palette opens, search filters screens, arrow keys navigate, Enter selects.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/CommandPalette.tsx src/ui/components/Layout.tsx
git commit -m "feat(ui): add Cmd+K command palette for screen navigation"
```

---

## Task 7: BezelCard Wrapper + Dashboard Stagger

**Files:**
- Create: `src/ui/components/BezelCard.tsx`
- Modify: `src/ui/screens/SeekerDashboard.tsx`
- Modify: `src/ui/screens/HRDashboard.tsx`

**Dependencies:** Task 1 (CSS bezel classes), Task 3 (RevealStagger)
**Produces:** Reusable bezel card + staggered dashboards

- [ ] **Step 1: Create BezelCard component**

Write `src/ui/components/BezelCard.tsx`:

```tsx
import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  className?: string
  innerClassName?: string
  as?: "div" | "section" | "article"
}

export default function BezelCard({
  children,
  className = "",
  innerClassName = "",
  as: Tag = "div",
}: Props) {
  return (
    <Tag className={`fc-bezel ${className}`}>
      <div className={`fc-bezel__inner ${innerClassName}`}>
        {children}
      </div>
    </Tag>
  )
}
```

- [ ] **Step 2: Update SeekerDashboard**

Read `src/ui/screens/SeekerDashboard.tsx`.

Replace card wrappers with `BezelCard` + `RevealStagger`. For the stat cards section:

```tsx
import BezelCard from "@/ui/components/BezelCard"
import RevealStagger from "@/ui/components/RevealStagger"

// In the JSX, wrap each section:
<RevealStagger>
  <div className="fc-page-head">
    <h1>Dashboard</h1>
  </div>
</RevealStagger>

// For stat cards grid:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {stats.map((stat, i) => (
    <RevealStagger key={stat.label} delay={i * 0.06}>
      <BezelCard>
        <div className="fc-stat__icon" style={{ background: `var(--${stat.color}-soft)` }}>
          {/* icon */}
        </div>
        <div className="fc-stat__value">{stat.value}</div>
        <div className="fc-stat__label">{stat.label}</div>
      </BezelCard>
    </RevealStagger>
  ))}
</div>
```

- [ ] **Step 3: Update HRDashboard**

Same pattern as SeekerDashboard. Read `src/ui/screens/HRDashboard.tsx`, wrap stat cards and sections with `BezelCard` + `RevealStagger`.

- [ ] **Step 4: Verify**

Run: `npm run build` + `npm run dev`
Expected: Dashboard cards render with bezel wrapper, scroll reveal stagger animates on scroll.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/BezelCard.tsx src/ui/screens/SeekerDashboard.tsx src/ui/screens/HRDashboard.tsx
git commit -m "feat(ui): add BezelCard wrapper and dashboard scroll-reveal stagger"
```

---

## Task 8: Auth Screen — Mesh Gradient Background + Glass Form

**Files:**
- Modify: `src/ui/screens/AuthScreen.tsx`

**Dependencies:** Task 1 (CSS mesh orbs), Task 2 (theme)
**Produces:** Cinematic auth screen with animated gradient background

- [ ] **Step 1: Add mesh gradient orbs and glass form card**

Read `src/ui/screens/AuthScreen.tsx`.

Add floating mesh orbs behind the dark editorial panel:

```tsx
// Inside the dark panel section, add before content:
<div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
  <div
    className="fc-mesh-orb"
    style={{
      width: 400,
      height: 400,
      top: "-10%",
      right: "-10%",
      background: "radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)",
    }}
  />
  <div
    className="fc-mesh-orb"
    style={{
      width: 300,
      height: 300,
      bottom: "10%",
      left: "-5%",
      background: "radial-gradient(circle, rgba(79,70,229,0.25) 0%, transparent 70%)",
    }}
  />
</div>
```

Wrap the auth form panel in a BezelCard-like glass container:

```tsx
// Form panel wrapper
<div style={{
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 32,
  background: "var(--bg)",
}}>
  <div className="fc-bezel" style={{ width: "100%", maxWidth: 420 }}>
    <div className="fc-bezel__inner" style={{ padding: 32 }}>
      {/* existing form content */}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: Auth screen shows animated gradient background orbs, form in glass bezel card.

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/AuthScreen.tsx
git commit -m "feat(ui): cinematic auth screen with mesh gradient orbs and glass form card"
```

---

## Task 9: Pipeline Drag-and-Drop

**Files:**
- Modify: `src/ui/screens/PipelineScreen.tsx`

**Dependencies:** Task 1 (bezels), Task 7 (BezelCard)
**Produces:** Kanban with real drag-and-drop via @dnd-kit

- [ ] **Step 1: Install @dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Implement drag-and-drop kanban**

Read `src/ui/screens/PipelineScreen.tsx`. Replace button-based move with:

```tsx
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// Wrap columns with DndContext:
<DndContext
  sensors={sensors}
  collisionDetection={closestCorners}
  onDragEnd={handleDragEnd}
>
  {/* columns */}
</DndContext>

// Sortable card wrapper:
function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}
```

Apply `BezelCard` to each pipeline card. Add column styling with glass background.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: Pipeline cards are draggable between columns with smooth spring physics.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/PipelineScreen.tsx
git commit -m "feat(ui): add @dnd-kit drag-and-drop to pipeline kanban"
```

---

## Task 10: Toast System + Empty States

**Files:**
- Create: `src/ui/components/ToastProvider.tsx`
- Modify: `src/app/App.tsx` (add ToastProvider)
- Modify: screen files for empty states

**Dependencies:** Task 1 (glass styling)
**Produces:** Sonner toast notifications + improved empty states

- [ ] **Step 1: Install sonner**

```bash
npm install sonner
```

- [ ] **Step 2: Create ToastProvider**

Write `src/ui/components/ToastProvider.tsx`:

```tsx
import { Toaster } from "sonner"

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
        },
      }}
    />
  )
}
```

- [ ] **Step 3: Add ToastProvider to App.tsx**

Read `src/app/App.tsx`, add near the top of the main return:

```tsx
import ToastProvider from "@/ui/components/ToastProvider"

// Inside the main JSX return, before <Layout>:
<ToastProvider />
<Layout ...>
```

- [ ] **Step 4: Improve empty states**

Audit screens with empty states (CVHistoryScreen, JDLibraryScreen, ReportsScreen). For each, replace bare text with:

```tsx
import { UploadSimple, BookOpenText, ChartBar } from "@phosphor-icons/react"
import BezelCard from "@/ui/components/BezelCard"

// Pattern for each empty state:
<BezelCard>
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "48px 24px",
    textAlign: "center",
  }}>
    <div style={{
      width: 56, height: 56, borderRadius: 16,
      background: "var(--accent-soft)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <UploadSimple size={24} weight="light" color="var(--accent)" />
    </div>
    <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>
      No CVs uploaded yet
    </strong>
    <span style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 280 }}>
      Upload your first CV to get AI-powered match analysis and improvement suggestions.
    </span>
    <button className="fc-btn fc-btn--primary" onClick={...}>
      <UploadSimple size={16} weight="light" />
      Upload CV
    </button>
  </div>
</BezelCard>
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: Toasts show on actions, empty states have icon + message + CTA.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/ToastProvider.tsx src/app/App.tsx
git commit -m "feat(ui): add sonner toast system and improve empty states"
```

---

## Task 11: Lazy Loading + Performance

**Files:**
- Create: `src/ui/components/FullPageSkeleton.tsx`
- Modify: `src/app/App.tsx`

**Dependencies:** None
**Produces:** Code-split screens, smaller initial bundle

- [ ] **Step 1: Create FullPageSkeleton**

Write `src/ui/components/FullPageSkeleton.tsx`:

```tsx
export default function FullPageSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 28,
      }}
    >
      <div className="fc-skeleton" style={{ width: "40%", height: 28, borderRadius: 8 }} />
      <div className="fc-skeleton" style={{ width: "60%", height: 16, borderRadius: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="fc-skeleton fc-skeleton--card" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace static imports with lazy imports in App.tsx**

Read `src/app/App.tsx`. Replace:

```tsx
import SeekerDashboard from "@/ui/screens/SeekerDashboard"
// ... all imports
```

With:

```tsx
import { lazy, Suspense } from "react"

const SeekerDashboard = lazy(() => import("@/ui/screens/SeekerDashboard"))
const AnalyzerScreen = lazy(() => import("@/ui/screens/AnalyzerScreen"))
const ImprovementScreen = lazy(() => import("@/ui/screens/ImprovementScreen"))
const CVHistoryScreen = lazy(() => import("@/ui/screens/CVHistoryScreen"))
const AppTrackerScreen = lazy(() => import("@/ui/screens/AppTrackerScreen"))
const JDLibraryScreen = lazy(() => import("@/ui/screens/JDLibraryScreen"))
const HRDashboard = lazy(() => import("@/ui/screens/HRDashboard"))
const JobPostsScreen = lazy(() => import("@/ui/screens/JobPostsScreen"))
const CVRankingScreen = lazy(() => import("@/ui/screens/CVRankingScreen"))
const PipelineScreen = lazy(() => import("@/ui/screens/PipelineScreen"))
const AutoEmailScreen = lazy(() => import("@/ui/screens/AutoEmailScreen"))
const ReportsScreen = lazy(() => import("@/ui/screens/ReportsScreen"))
const ProfileScreen = lazy(() => import("@/ui/screens/ProfileScreen"))
import FullPageSkeleton from "@/ui/components/FullPageSkeleton"
```

Wrap the screen render area:

```tsx
<AnimatePresence mode="wait">
  <Suspense fallback={<FullPageSkeleton />}>
    <div key={screen}>{renderScreen()}</div>
  </Suspense>
</AnimatePresence>
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds. Check bundle size reduction via Vite build output (chunks listed).

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx src/ui/components/FullPageSkeleton.tsx
git commit -m "perf: add route-level code splitting with lazy + Suspense"
```

---

## Task 12: Screen Polish — Analyzer + BulkCvRanking

**Files:**
- Modify: `src/ui/screens/AnalyzerScreen.tsx`
- Modify: `src/ui/screens/BulkCvRankingPanel.tsx`

**Dependencies:** Task 1 (bezels, glass), Task 7 (BezelCard)
**Produces:** Bezel-wrapped analyzer and ranking screens with glass elements

- [ ] **Step 1: Update AnalyzerScreen**

Read `src/ui/screens/AnalyzerScreen.tsx`.

- Wrap the CV drop zone in `.fc-bezel` + `.fc-bezel__inner`
- Wrap score result card in `BezelCard`
- Wrap breakdown progress bars section in `BezelCard`

- [ ] **Step 2: Update BulkCvRankingPanel**

Read `src/ui/screens/BulkCvRankingPanel.tsx`.

- Wrap JD textarea section in BezelCard
- Wrap candidate list items in BezelCard
- Wrap CV preview panel in BezelCard with inner scrolling

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: All major cards in Analyzer and Ranking are now bezel-styled.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/AnalyzerScreen.tsx src/ui/screens/BulkCvRankingPanel.tsx
git commit -m "feat(ui): apply bezel card and glass styling to analyzer and ranking screens"
```

---

## Self-Review Completion

After all tasks are committed:

- [ ] All spec requirements have corresponding tasks (font/icon, bezel, dark mode, motion, floating topbar, command palette, pipeline drag, toast, lazy loading, screen polish)
- [ ] No placeholders in plan steps — all code is concrete
- [ ] Type consistency — `RevealStagger` props match between Task 3 and Task 7 usage; `CommandPalette` props match between Task 6 and Task 5 wiring
- [ ] Each task ends with independently verifiable output (build succeeds, visual change visible)
