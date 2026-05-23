# Audit UI Interaction Regression — Data Query Pages

**Date:** 2026-05-23
**Branch:** 110526

---

## 0. Executive summary

- **Root cause category:** C. Label/wrapper structure / CSS class mismatch
- **Most likely root cause:** `report-date-native` class applies `position: absolute; opacity: 0` — designed for the OLD `report-date-range-field` overlay pattern. The NEW `ReportDateRangeField` no longer uses that wrapper, so `report-date-native` inputs become zero-size invisible overlays that capture no user input, while the visible date inputs are standard browser date pickers that work independently. However, since the input IS there and the button IS there, this is NOT a complete blocker.
- **Secondary hypothesis:** `report-date-picker-btn`, `report-date-input-wrap`, `report-date-range-item`, `report-date-range-label`, `report-date-range-split` have NO CSS definitions. Without positioning/flex rules, the two-item layout may collapse or position unexpectedly. The button has no `display`, `position`, or `width` — it may be `display: inline` with 0×0 dimensions if the SVG doesn't give it size.
- **Affected pages:** All 4 — TotalProfit, OrderProfit, AdvQuery, MediaQuery
- **Is it caused by recent date picker changes?** Yes
- **Code-only fix?** Yes — CSS additions needed

---

## 1. Git/diff state

- **Branch:** `110526` ✅
- **Uncommitted changes:** `frontend/src/pages/Reports.tsx`, `frontend/src/lib/i18n.ts`
- **No backend changes** — purely frontend
- No Prisma, no migrations

---

## 2. Reports.tsx structure findings

### `ReportDateRangeField` — new implementation

```tsx
<div className="report-date-range-split">          // NO CSS EXISTS
  <div className="report-date-range-item">         // NO CSS EXISTS
    <span className="report-date-range-label">     // NO CSS EXISTS
    <div className="report-date-input-wrap">        // NO CSS EXISTS
      <input className="report-control report-date-native" />  // CSS: position:absolute; opacity:0 — ZERO SIZE
      <button className="report-date-picker-btn" /> // NO CSS EXISTS — may be 0×0
    </div>
  </div>
  <div className="report-date-range-item"> ... </div>
</div>
```

### Old implementation (before changes)

```tsx
<div className="report-date-range-field" onClick={openStartPicker}> // has CSS
  <span className="report-date-text">{label}</span>
  <CalendarDays />
  <div className="report-date-range-inputs">        // opacity: 0 overlay
    <input className="report-date-native" />        // opacity: 0, captures clicks
    <span className="report-date-range-sep" />
    <input className="report-date-native" />
  </div>
</div>
```

The OLD implementation used `report-date-range-field` with `position: relative` as a clickable container. The inner inputs with `report-date-native` were intentionally `opacity: 0` and `position: absolute; inset: 0` — a standard overlay pattern where the visible text/icon is on top and the transparent input underneath captures all clicks.

The NEW implementation removed the `report-date-range-field` wrapper but KEPT `report-date-native` class on visible inputs. This class was designed ONLY for the overlay pattern, not for visible inputs.

---

## 3. Missing CSS for new classes

| Class | Used in new component? | CSS defined? | Status |
|---|---|---|---|
| `.report-date-range-split` | ✅ | ❌ NO | **MISSING** |
| `.report-date-range-item` | ✅ | ❌ NO | **MISSING** |
| `.report-date-range-label` | ✅ | ❌ NO | **MISSING** |
| `.report-date-input-wrap` | ✅ | ❌ NO | **MISSING** |
| `.report-date-picker-btn` | ✅ | ❌ NO | **MISSING** |
| `.report-date-native` | ✅ | ✅ YES — but for overlay, not visible inputs | **WRONG USAGE** |

**Old classes still relevant (for `report-date-field`, `ReportDateField`):**
- `.report-date-field` ✅ — used in Data Entry pages
- `.report-date-range-field` ✅ — no longer used by Reports.tsx

---

## 4. Interaction blocker search results

All 4 pages share `ReportDateRangeField` — same component, same CSS issue.

Controls AFTER the date picker in filter toolbar:
- `TotalProfit`: Search input, Download button ✅
- `OrderProfit`: Business select, Search input, Download button ✅
- `AdvQuery`: Business select, Advertiser select, AdOrder select, AdId select, Type select, Rate select, Status select, Search input, Download button ✅
- `MediaQuery`: Same pattern ✅

The dropdown selects and buttons have their standard classes (`.report-control`, `.report-select`) which have correct CSS. But since `report-date-range-split` has no layout CSS, the toolbar layout may be broken.

---

## 5. Root cause evidence

**Primary:** `report-date-native` applied to visible inputs — the `position: absolute; opacity: 0` makes inputs 0-size, BUT they have no `width` set, so browser renders at auto-width. The issue is the class is semantically wrong and CSS was designed for overlay pattern.

**More likely blocker:** Missing CSS for ALL new classes means the two-date layout renders with browser defaults, likely collapsed/flexed incorrectly. The button may have no size if CSS doesn't define it.

**Evidence from CSS inspection:**
```css
/* ONLY existing CSS for any date-range in Reports.tsx */
.report-date-range-field { width: 220px; ... position: relative; ... }
.report-date-range-field:focus-within { border-color: var(--primary-btn); }
.report-date-range-inputs { position: absolute; inset: 0; opacity: 0; ... }
/* report-date-native used as OVERLAY in old pattern */
.report-date-native { position: absolute; inset: 0; opacity: 0; ... }
```

The new component uses NONE of these classes' layout properties. `report-date-range-split` has no CSS at all.

---

## 6. Minimal fix direction

**Option A — Re-add proper CSS (recommended):**
Add CSS for:
- `.report-date-range-split` — flex container with gap
- `.report-date-range-item` — flex column or inline layout
- `.report-date-input-wrap` — relative container for input + button
- `.report-date-range-label` — text label styles
- `.report-date-picker-btn` — inline-flex, pointer-events, calendar icon
- Remove `.report-date-native` from visible inputs and use plain input styling

**Option B — Revert to overlay pattern but keep split inputs:**
Keep the `report-date-range-field` wrapper with `position: relative` but put two visible inputs inside it. Use proper visible styling for inputs. Remove `report-date-native` overlay pattern entirely.

**Option C — Simplest fix: remove overlay CSS class from visible inputs:**
Change visible inputs from `className="report-control report-date-native"` to a class that doesn't have `position: absolute; opacity: 0`.

---

## 7. Suggested next fix prompt

Apply Option A with these exact changes:

**1. In `index.css`, after the existing `.report-date-sep` line (~line 267), add:**

```css
/* ReportDateRangeField — split start/end inputs */
.report-date-range-split {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.report-date-range-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.report-date-range-label {
  font-size: 11px;
  color: var(--text-sub);
  font-weight: 600;
  line-height: 1;
}
.report-date-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.report-date-input-wrap input {
  padding-right: 28px;
  width: 140px;
}
.report-date-picker-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-sub);
  display: flex;
  align-items: center;
  padding: 2px;
  pointer-events: auto;
  z-index: 1;
}
.report-date-picker-btn:hover { color: var(--primary-btn); }
```

**2. In `Reports.tsx`, change visible date inputs from:**
```tsx
<input className="report-control report-date-native" ... />
```
**to:**
```tsx
<input className="report-control" ... />
```
Remove `report-date-native` from visible date inputs — it's the overlay-pattern class.

---

## 8. Build/typecheck

Build passes cleanly. No TypeScript errors.

---

## 9. Non-date-picker controls

Even if date picker is broken, dropdowns/search/export button should still work. If ALL controls are blocked (including dropdowns and download button), the issue may be more severe — possibly the `report-date-range-split` div or one of its children has `pointer-events: none` applied by some inherited/global CSS, or the toolbar itself became unclickable due to a layout collapse pushing controls off-screen or behind another element.

Current assessment: the toolbar layout is broken because `.report-date-range-split` with no CSS defaults to `display: block` or `display: flex` with unknown behavior, and the items inside have no explicit sizing. The toolbar should still be visible and interactive, but the layout may be wrong.