# agentation-vanilla

Visual annotation tool for vanilla JS development. Inspired by [Agentation](https://www.agentation.com/) for React — this is the vanilla JS alternative.

One script tag. Zero dependencies. No install, no account.

## Quick Start

Add one script tag to your app:

```html
<script src="https://cdn.jsdelivr.net/gh/mearnest-dev/agentation-vanilla@main/agentation-vanilla.js"></script>
```

A toolbar appears in the bottom-right corner. That's it.

### Dev-only loading

```html
<script>
  if (location.hostname === 'localhost') {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/gh/mearnest-dev/agentation-vanilla@main/agentation-vanilla.js';
    document.body.appendChild(s);
  }
</script>
```

## Features

- **Inspect mode** — hover to see selectors, styles, and dimensions. Click to pin and copy.
- **Annotate mode** — click elements or select text to drop numbered markers with notes
- **Intent tags** — tag annotations as bug, style, feature, or content
- **Copy as markdown** — paste directly into Claude Code, Cursor, or any AI tool
- **Per-page persistence** — annotations survive refreshes and navigation
- **Shadow DOM isolated** — won't touch your app's styles
- **Works with any stack** — or no stack at all

### Inspect Output

Click an element in inspect mode to pin it, then copy:

```
selector: section.features > div.card:nth-child(3)
classes: card
text: "Precise CSS selectors, computed styles, and element paths"
styles: padding: 24px; color: rgb(26, 26, 26); background-color: rgb(255, 255, 255); font-size: 16px
```

### Annotation Output

Copy all annotations as structured markdown your AI agent can act on:

```markdown
## [style] Annotation 1
**Element:** `div.card`
**Selector:** `section.features > div.card:nth-child(3)`
**Text:** "Precise CSS selectors, computed styles, and element paths"
**Styles:** `padding: 24px; color: rgb(26, 26, 26); font-size: 16px; width: 282px`
**Note:** round the corners, 12px

## [bug] Annotation 2
**Element:** `p`
**Selector:** `section.hero > p`
**Selected text:** "This is a demo page with various UI elements"
**Styles:** `color: rgb(102, 102, 102); font-size: 16px`
**Note:** change this copy
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `I` | Toggle inspect mode |
| `A` | Toggle annotate mode |
| `C` | Copy all annotations as markdown |
| `Esc` | Deactivate / close |

## Demo
Clone the repo

```bash
git clone https://github.com/mearnest-dev/agentation-vanilla.git
cd agentation-vanilla
npm run demo
```

Open http://localhost:3333/demo.

## License

MIT
