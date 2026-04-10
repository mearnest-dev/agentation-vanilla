# agentation-vanilla

Vanilla JS visual annotation tool for AI coding agents. Zero dependencies. Single script tag. Shadow DOM isolated.

Click elements on your page, add notes, and copy structured markdown that helps AI coding agents find the exact code you're referring to.

## Quick Start

Add one script tag to your app:

```html
<script src="https://cdn.jsdelivr.net/gh/mearnest-dev/agentation-vanilla@main/agentation-vanilla.js"></script>
```

Or dev-only:

```html
<script>
  if (location.hostname === 'localhost') {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/gh/mearnest-dev/agentation-vanilla@main/agentation-vanilla.js';
    document.body.appendChild(s);
  }
</script>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `I` | Toggle inspect mode |
| `A` | Toggle annotate mode |
| `C` | Copy annotations as markdown |
| `Esc` | Deactivate / close popover |

## Modes

**Inspect** — hover over any element to see its tag, classes, CSS selector path, computed styles, and dimensions. Click to pin the tooltip and copy selector info.

**Annotate** — click any element to pin a numbered marker and add a note. Click the marker again to edit or delete.

## Output

Clicking the copy button (or pressing `C`) copies structured markdown:

```markdown
# UI Annotations

**Page:** http://localhost:3333/demo
**Date:** 2026-04-10

## Annotation 1
**Element:** `button.btn-primary`
**Selector:** `body > div.app > section > button.btn-primary`
**Classes:** `btn btn-primary`
**Computed:** `display: flex; padding: 8px 16px; color: #fff; background-color: rgb(26, 26, 26)`
**Text:** "Get Started"
**Note:** This button should be wider on mobile
```

## Demo

```bash
npm run demo
```

Then open http://localhost:3333/demo.

## License

MIT
