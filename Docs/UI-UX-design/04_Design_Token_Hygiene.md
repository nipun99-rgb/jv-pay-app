# 04 — Design Token Consistency & Hygiene

**Date:** July 1, 2026
**Reviewer:** Senior PM / Design Specialist
**Method:** Full audit of `App.css`, `JourneyPanel.css`, `SplitPane.css`, `SubcontractorTable.css`, `TestDashboard.css` for hardcoded values, duplicated patterns, and cross-file inconsistencies.

---

## 1. Executive Summary

The application has **no design token system**. All visual values — colors, spacing, shadows, border-radii, typography sizes, and transitions — are hardcoded as magic numbers spread across at least 5 CSS files. There are **3 separate button systems** implemented in CSS (`.btn-*`, `.ws-btn-*`, `.jsetup-btn-*`) that have never been unified. There are **4 separate active/selected state color values** used for what should be a single "primary accent" concept. This represents significant maintenance debt and makes any future work — contrast fixing, dark mode, brand reskin, or accessibility patching — require a search-and-replace operation across the entire CSS codebase.

---

## 2. The Three Parallel Button Systems

### System 1: `.btn-*` (App.css — used in Sidebar and App layout)
```css
.btn-new-project { background: #ffffff; border: 1px solid #d9d9d9; border-radius: 8px; }
.btn-collapse    { background: transparent; border: 1px solid #e0e0e0; border-radius: 8px; }
.btn-expand-sidebar { background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; }
```

### System 2: `.ws-btn-*` (App.css — used in ProjectDetail.jsx header)
```css
.ws-btn-primary  { background: #4f46e5; color: #fff; border-radius: 8px; }
.ws-btn-ai       { background: #7c3aed; color: #fff; border-radius: 8px; }
.ws-btn-accent   { background: #0ea5e9; color: #fff; border-radius: 8px; }
.ws-btn-ghost    { background: transparent; border: 1px solid #e2e8f0; border-radius: 8px; }
.ws-btn-danger   { background: #ef4444; border-radius: 8px; }
```

### System 3: `.jsetup-btn-*` (JourneyPanel.css — used in Phase setup steps)
```css
.jbtn-primary    { background: #4f46e5; color: #fff; border-radius: 6px; }
.jbtn-accent     { background: #7c3aed; color: #fff; border-radius: 6px; }
.jbtn-ghost      { background: transparent; border: 1px solid #e2e8f0; border-radius: 6px; }
.jbtn-running    { background: #d97706; color: #fff; border-radius: 6px; }
```

**Critical finding:** System 2 and System 3 implement the *same conceptual button variants* (`primary`, `accent`, `ghost`) but with different class prefixes (`ws-btn-` vs `jbtn-`) and slightly different border-radii (8px vs 6px). There is no shared source of truth.

---

## 3. The Four "Primary Accent" Color Values

The application uses four different hex values to mean the same thing — "selected/active/primary":

| Context | Value | Location |
|---|---|---|
| Phase card active state | `#4f46e5` | `JourneyPanel.css: .jcard-active` |
| Header action button primary | `#4f46e5` | `App.css: .ws-btn-primary` |
| Split pane divider active | `#4f46e5` | `SplitPane.css: .split-pane-divider:active` |
| Setup step icon | `#6366f1` | `App.css: .sidebar-logo-icon` |
| AI validate button | `#7c3aed` | `App.css: .ws-btn-ai` |
| Tab active underline | `#4f46e5` | `App.css: .ws-tab.active` |

`#4f46e5` (Indigo 600) and `#6366f1` (Indigo 500) coexist. These differ by 2 shades of the same hue but are used inconsistently to mean the same concept (primary brand color).

---

## 4. Full Hardcoded Value Inventory (Key Items)

### Colors — Background
| Value | Count of uses | Meaning |
|---|---|---|
| `#ffffff` | 8+ | Pure white surface |
| `#f8f9fc` | 3 | App background |
| `#f8fafc` | 4 | Card/panel background (nearly identical to above) |
| `#f9f9fb` | 2 | Sidebar gradient start |
| `#f3f4f8` | 1 | Sidebar gradient end |
| `#f1f5f9` | 3 | Hover states |

*Note: `#f8f9fc` and `#f8fafc` are visually indistinguishable to the human eye yet defined as separate values.*

### Colors — Border
| Value | Count | Context |
|---|---|---|
| `#e0e0e0` | 3 | Sidebar/modal borders |
| `#e2e8f0` | 8+ | General borders (JourneyPanel, SplitPane, DataTable) |
| `#e5e5e5` | 2 | Sidebar dividers |
| `#d9d9d9` | 1 | New project button |

Four near-identical border grey values. No single border token.

### Border Radius
| Value | Count |
|---|---|
| `8px` | 12+ |
| `6px` | 6+ |
| `10px` | 3 |
| `4px` | 4 |
| `50%` | pill/circle shapes |

### Transition Curves
| Value | Count |
|---|---|
| `0.15s cubic-bezier(0.4, 0, 0.2, 1)` | 3 |
| `0.12s` | 4 |
| `0.2s ease` | 4 |
| `0.3s cubic-bezier(0.4, 0, 0.2, 1)` | 2 |

---

## 5. Proposed Design Token System (`:root` block)

```css
:root {
  /* ── Brand Colors ── */
  --color-primary:          #4f46e5;  /* Indigo 600 — primary actions */
  --color-primary-hover:    #4338ca;  /* Indigo 700 — hover state */
  --color-primary-subtle:   #eef2ff;  /* Indigo 50  — selected background */
  --color-accent:           #7c3aed;  /* Violet 600 — AI / special actions */
  --color-accent-info:      #0ea5e9;  /* Sky 500    — info actions */
  --color-danger:           #ef4444;  /* Red 500    — destructive */
  --color-warning:          #d97706;  /* Amber 600  — running / warning */
  --color-success:          #16a34a;  /* Green 600  — complete */

  /* ── Surface Colors ── */
  --surface-app:            #f8f9fc;
  --surface-panel:          #ffffff;
  --surface-card:           #f8fafc;
  --surface-hover:          #f1f5f9;
  --surface-sidebar-start:  #f9f9fb;
  --surface-sidebar-end:    #f3f4f8;

  /* ── Text Colors (WCAG AA compliant) ── */
  --text-primary:           #1a1a1a;
  --text-secondary:         #374151;  /* Was #333 — 12.6:1 on white */
  --text-tertiary:          #595959;  /* Was #777 — 7.0:1 on white (fixes WCAG) */
  --text-muted:             #757575;  /* Was #999 — 4.6:1 on white (fixes WCAG) */
  --text-placeholder:       #94a3b8;  /* Slate 400 — placeholders only */

  /* ── Border Colors ── */
  --border-light:           #e2e8f0;  /* General borders */
  --border-medium:          #d1d5db;  /* Emphasized borders */
  --border-strong:          #9ca3af;  /* Input focus */

  /* ── Geometry ── */
  --radius-xs:              4px;
  --radius-sm:              6px;
  --radius-md:              8px;
  --radius-lg:              10px;
  --radius-xl:              12px;
  --radius-pill:            9999px;

  /* ── Shadow / Elevation ── */
  --shadow-xs:              0 1px 3px rgba(0,0,0,0.06);
  --shadow-sm:              0 2px 8px rgba(0,0,0,0.06);
  --shadow-md:              0 4px 16px rgba(0,0,0,0.08);
  --shadow-accent:          0 4px 12px rgba(79,70,229,0.3);

  /* ── Transitions ── */
  --transition-fast:        0.12s ease;
  --transition-standard:    0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-medium:      0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:        0.3s cubic-bezier(0.4, 0, 0.2, 1);

  /* ── Spacing (optional, for consistency) ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
}
```

---

## 6. Migration Strategy

**Step 1 (One day):** Add the `:root` token block to the top of `App.css`.

**Step 2 (Two days):** Do a single-pass find-and-replace of the most impactful values in `App.css` only:
- All `#4f46e5` → `var(--color-primary)`
- All `#e2e8f0` → `var(--border-light)`
- All `8px` border-radius → `var(--radius-md)`
- All `0.15s cubic-bezier(0.4, 0, 0.2, 1)` → `var(--transition-standard)`

**Step 3 (Two days):** Consolidate the three button systems into one `.btn` component in a new `buttons.css` file.

**Step 4 (Ongoing):** Enforce a lint rule (via stylelint `declaration-no-important` and a custom `no-color-literals` rule) to prevent new hardcoded values entering the codebase.