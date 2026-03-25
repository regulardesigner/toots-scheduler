---
name: ui-design-system
description: >
  UI creation for the Toot Scheduler project. Use this skill whenever designing or building
  new UI elements, components, or layouts. Trigger when the user asks to add a button, form,
  card, modal, layout, or any visual element. This skill ensures all new UI respects the existing
  design: monochrome base with a single accent color, clean and minimal aesthetic.
  Always use this skill before writing any CSS or template code.
---

# UI Design System — Toot Scheduler

This app has a deliberate, minimal visual identity: **monochrome base, single accent, clean typography.**
Every new UI element must feel native — like it was always there.

---

## Color palette

The app supports both light and dark mode via `prefers-color-scheme`.

### Dark mode (default)
| Role              | Value                        |
|-------------------|------------------------------|
| Background        | `#242424`                    |
| Surface / Card    | `#333`                       |
| Text primary      | `rgba(255, 255, 255, 0.87)`  |
| Text secondary    | `lightgray` / `#aaa`         |
| Border / Divider  | `#333` – `#444`              |
| Input background  | `white` (on light surfaces)  |

### Light mode
| Role              | Value       |
|-------------------|-------------|
| Background        | `#ffffff`   |
| Surface / Card    | `#f8f8f8`   |
| Text primary      | `#213547`   |
| Text secondary    | `#666`      |
| Border            | `#333`      |

### Accent color (single, use sparingly)
| State         | Value       |
|---------------|-------------|
| Default       | `#646cff`   |
| Hover         | `#535bf2`   |
| Light hover   | `#747bff`   |

The accent appears on: links, focus rings, edit-mode buttons, hover borders.
Do **not** introduce new colors. If you need to communicate state (error, success),
use the existing patterns below.

### Semantic colors (use only for these roles)
| Role    | Value                              |
|---------|------------------------------------|
| Error   | text `#e74c3c`, bg `#fde8e7`       |
| Edit    | `#2b90d9` (Mastodon blue), hover `#2577b1` |
| Neutral | `#95a5a6` (cancel buttons)         |

---

## Typography

- **Body font:** `"Nunito Sans"` (variable font, loaded locally from `src/assets/fonts/`)
- **Display / headings:** `"Winky Sans"` (variable font, loaded locally)
- Base size: `1em`, line-height: `1.5`, weight: `400`
- Font smoothing: `-webkit-font-smoothing: antialiased`

Use `font-weight: 600–700` for labels and button text. Use `font-size: 0.9rem` for secondary text, labels, and metadata.

---

## Spacing and layout

- Use `rem` for spacing — base rhythm: `0.5rem`, `1rem`, `1.5rem`, `2rem`
- Gaps between flex items: `0.5rem` to `1rem`
- Container max-width: `600px`, centered with `margin: 0 auto`
- Padding inside cards/surfaces: `1rem`

---

## Component patterns

### Cards / Surfaces
```css
.my-card {
  background-color: #333;        /* dark mode */
  border-radius: 0.5rem;
  padding: 1rem;
}

@media (prefers-color-scheme: light) {
  .my-card { background-color: #f8f8f8; }
}
```

### Buttons

Two variants exist — use the right one:

**Primary action button** (schedule, save, confirm):
```css
.btn-primary {
  background-color: #333;
  color: white;
  border: none;
  padding: 0.8rem 1rem;
  border-radius: 3rem;        /* pill shape — always for main CTAs */
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  width: 100%;
}
.btn-primary:hover { background-color: #222; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
```

**Neutral / cancel button:**
```css
.btn-cancel {
  background-color: #95a5a6;
  color: white;
  /* same shape as primary */
}
.btn-cancel:hover:not(:disabled) { background-color: #7f8c8d; }
```

**Never** use the default browser button style. Always apply one of these two patterns.

### Form inputs and selects
```css
input, select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #333;
  border-radius: 4px;
  font-size: 0.9rem;
  background-color: white;
}
```

Wrap each input with a `.form-group` that uses `display: flex; flex-direction: column; gap: 0.5rem`.
Label style: `font-size: 0.9rem; color: #666`.

### Labels / metadata text
```css
.meta {
  font-size: 0.9rem;
  color: lightgray;           /* secondary info */
}
.tag {
  font-size: 0.9rem;
  color: #333;
  background-color: rgb(236, 236, 236);
  padding: 0.5rem 1rem;
  border-radius: 4px;
}
```

### Error message
```css
.error {
  color: #e74c3c;
  margin: 1rem 0;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: #fde8e7;
}
```
Always use `<p v-if="error" class="error">{{ error }}</p>` — never alert boxes or inline red text without a container.

---

## Responsive design

Add a `@media (max-width: 768px)` block to every component. Key adjustments:
- Switch flex rows to `flex-wrap: wrap` or `flex-direction: column`
- Set `flex-basis: 40%` on form groups that should share a row on mobile
- Full-width buttons (`width: 100%`)
- Reduce padding on the main container

---

## Scoped styles

Always use `<style scoped>` — never global styles from components.
Never use inline styles in templates.

---

## What to avoid

- ❌ Introducing new colors outside the palette above
- ❌ Using `box-shadow` heavily — the design is flat
- ❌ Gradients
- ❌ Multiple font sizes beyond `0.9rem` / `1rem` / `1.1rem` / `3.2em` (h1)
- ❌ Global CSS in component files
- ❌ Inline styles in templates
- ❌ Rounded corners bigger than `3rem` (reserved for pill buttons) or less than `4px`
