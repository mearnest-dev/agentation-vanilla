/**
 * agentation-vanilla v0.1.0
 * Vanilla JS visual annotation tool for AI coding agents.
 * Zero dependencies. Single script tag. Shadow DOM isolated.
 *
 * Usage: <script src="agentation-vanilla.js"></script>
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__agentationVanilla) return; // prevent double-init
  window.__agentationVanilla = true;

  // ── State ──────────────────────────────────────────────────────────
  let mode = 'off'; // 'off' | 'inspect' | 'annotate'
  const annotations = [];
  let hoveredEl = null;
  let annotatePopover = null;
  let pinnedInspect = null; // { el, selector, data }
  let justSelectedText = false;

  // ── Persistence ────────────────────────────────────────────────────
  // Normalize pathname: strip trailing slash and index.html for consistent keys
  const normalPath = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  const STORAGE_KEY = 'av_annotations_' + normalPath;

  function saveAnnotations() {
    try {
      const data = annotations.map(a => ({
        index: a.index, type: a.type, shortSelector: a.shortSelector,
        fullSelector: a.fullSelector, classes: a.classes, computed: a.computed,
        textContent: a.textContent, selectedText: a.selectedText,
        comment: a.comment, intent: a.intent, x: a.x, y: a.y,
        savedAt: Date.now(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function loadAnnotations() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(data)) return;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = Date.now();
      for (const a of data) {
        // Drop expired annotations
        if (a.savedAt && (now - a.savedAt) > maxAge) continue;
        // Drop annotations with empty or dead selectors
        if (!a.fullSelector) continue;
        try { if (!document.querySelector(a.fullSelector)) continue; } catch (_) { continue; }
        a._marks = [];
        annotations.push(a);
      }
      // Re-index in case some were dropped
      annotations.forEach((a, i) => a.index = i + 1);
      if (data.length !== annotations.length) saveAnnotations();
    } catch (_) {}
  }

  // ── Shadow DOM Host ────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'agentation-vanilla-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // ── Styles ─────────────────────────────────────────────────────────
  const styles = document.createElement('style');
  styles.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .av-toolbar {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      padding: 6px;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      user-select: none;
    }

    .av-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #999;
      cursor: pointer;
      font-size: 18px;
      transition: background 0.15s, color 0.15s;
      pointer-events: auto;
      position: relative;
    }
    .av-btn:hover { background: #2a2a2a; color: #fff; }
    .av-btn.active { background: #333; color: #60a5fa; }

    .av-btn svg { width: 22px; height: 22px; fill: currentColor; }

    .av-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      background: #60a5fa;
      color: #000;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      line-height: 1;
    }

    .av-divider {
      width: 1px;
      height: 24px;
      background: #333;
      margin: 0 2px;
    }

    /* Highlight overlay */
    .av-highlight {
      position: fixed;
      pointer-events: none;
      border: 2px solid #60a5fa;
      background: rgba(96, 165, 250, 0.08);
      transition: all 0.1s ease;
      z-index: 2147483646;
    }

    /* Inspector tooltip */
    .av-tooltip {
      position: fixed;
      pointer-events: none;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 14px 16px;
      color: #e5e5e5;
      font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
      font-size: 13px;
      line-height: 1.6;
      max-width: 480px;
      white-space: pre-wrap;
      word-break: break-all;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 2147483646;
    }
    .av-tooltip-tag { color: #f472b6; font-weight: 600; }
    .av-tooltip-class { color: #60a5fa; }
    .av-tooltip-selector { color: #a78bfa; }
    .av-tooltip-label { color: #666; }
    .av-tooltip-value { color: #e5e5e5; }

    .av-tooltip.pinned {
      pointer-events: auto;
      border-color: #60a5fa;
    }
    .av-tooltip-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #333;
    }
    .av-tooltip-copy {
      padding: 5px 14px;
      border: none;
      border-radius: 6px;
      background: #60a5fa;
      color: #000;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .av-tooltip-copy:hover { filter: brightness(1.15); }
    .av-tooltip-dismiss {
      padding: 5px 14px;
      border: none;
      border-radius: 6px;
      background: #333;
      color: #999;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    }
    .av-tooltip-dismiss:hover { filter: brightness(1.15); }

    /* Annotation markers */
    .av-marker {
      position: fixed;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #f59e0b;
      color: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 2147483645;
      transition: transform 0.15s;
    }
    .av-marker:hover { transform: scale(1.2); background: #ef4444; }
    .av-marker:hover .av-marker-num { display: none; }
    .av-marker:hover .av-marker-x { display: flex; }
    .av-marker-x { display: none; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; }

    /* Annotation popover (for adding note) */
    .av-popover {
      position: fixed;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      padding: 16px;
      pointer-events: auto;
      z-index: 2147483646;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      width: 360px;
    }
    .av-popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
      color: #999;
    }
    .av-popover-header strong { color: #f59e0b; }
    .av-popover textarea {
      width: 100%;
      height: 80px;
      background: #111;
      border: 1px solid #333;
      border-radius: 6px;
      color: #e5e5e5;
      font-family: inherit;
      font-size: 14px;
      padding: 10px;
      resize: vertical;
      outline: none;
    }
    .av-popover textarea:focus { border-color: #60a5fa; }
    .av-popover-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 10px;
    }
    .av-popover-btn {
      padding: 7px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .av-popover-btn.primary { background: #60a5fa; color: #000; font-weight: 600; }
    .av-popover-btn.secondary { background: #333; color: #999; }
    .av-popover-btn:hover { filter: brightness(1.15); }

    /* Copied toast */
    .av-toast {
      position: fixed;
      bottom: 76px;
      right: 20px;
      background: #065f46;
      color: #6ee7b7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      padding: 10px 20px;
      border-radius: 8px;
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s;
      z-index: 2147483646;
    }
    .av-toast.visible { opacity: 1; transform: translateY(0); }

    /* Text selection highlight */
    .av-text-highlight {
      background: rgba(245, 158, 11, 0.25);
      outline: 2px solid rgba(245, 158, 11, 0.5);
      border-radius: 2px;
    }

    /* Intent tags */
    .av-intent-row {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
    }
    .av-intent-tag {
      padding: 4px 10px;
      border: 1px solid #333;
      border-radius: 99px;
      background: transparent;
      color: #999;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }
    .av-intent-tag:hover { border-color: #666; color: #fff; }
    .av-intent-tag.selected { border-color: #60a5fa; background: rgba(96,165,250,0.15); color: #60a5fa; }
  `;
  shadow.appendChild(styles);

  // ── Container ──────────────────────────────────────────────────────
  const container = document.createElement('div');
  shadow.appendChild(container);

  // ── Highlight Overlay ──────────────────────────────────────────────
  const highlight = document.createElement('div');
  highlight.className = 'av-highlight';
  highlight.style.display = 'none';
  container.appendChild(highlight);

  // ── Inspector Tooltip ──────────────────────────────────────────────
  const tooltip = document.createElement('div');
  tooltip.className = 'av-tooltip';
  tooltip.style.display = 'none';
  container.appendChild(tooltip);

  // ── Toast ──────────────────────────────────────────────────────────
  const toast = document.createElement('div');
  toast.className = 'av-toast';
  toast.textContent = 'Copied to clipboard';
  container.appendChild(toast);

  // ── Markers Container ──────────────────────────────────────────────
  const markersContainer = document.createElement('div');
  container.appendChild(markersContainer);

  // ── Toolbar ────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'av-toolbar';
  toolbar.innerHTML = `
    <button class="av-btn" data-action="inspect" title="Inspect elements (I)">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
    </button>
    <button class="av-btn" data-action="annotate" title="Annotate elements (A)">
      <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
    </button>
    <div class="av-divider"></div>
    <button class="av-btn" data-action="copy" title="Copy markdown (C)">
      <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
    </button>
    <button class="av-btn" data-action="clear" title="Clear all annotations">
      <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
    </button>
  `;
  container.appendChild(toolbar);

  // ── Refs ───────────────────────────────────────────────────────────
  const inspectBtn = toolbar.querySelector('[data-action="inspect"]');
  const annotateBtn = toolbar.querySelector('[data-action="annotate"]');
  const copyBtn = toolbar.querySelector('[data-action="copy"]');
  const clearBtn = toolbar.querySelector('[data-action="clear"]');

  // ── Helpers ────────────────────────────────────────────────────────

  function getSelector(el) {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${current.id}`);
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c).slice(0, 3);
        if (classes.length) selector += '.' + classes.join('.');
      }
      // Add nth-child if ambiguous
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          selector += `:nth-child(${idx})`;
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ') || 'body';
  }

  function getShortSelector(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => c).slice(0, 2);
      if (classes.length) return `${tag}.${classes.join('.')}`;
    }
    return tag;
  }

  function getComputedInfo(el) {
    const cs = window.getComputedStyle(el);
    const props = ['display', 'padding', 'margin', 'color', 'background-color', 'font-size', 'border-radius', 'width', 'height'];
    const skip = ['none', 'auto', 'normal', '0px', 'rgba(0, 0, 0, 0)', 'transparent', 'block', 'inline'];
    const result = {};
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v && !skip.includes(v)) {
        result[p] = v;
      }
    }
    return result;
  }

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isOwnElement(el) {
    let current = el;
    while (current) {
      if (current === host) return true;
      current = current.parentElement;
    }
    return false;
  }

  function isTopLevel(el) {
    return el === document.body || el === document.documentElement;
  }

  function positionTooltip(rect) {
    const pad = 12;
    let top = rect.bottom + pad;
    let left = rect.left;

    // Estimate tooltip dimensions
    const tooltipRect = tooltip.getBoundingClientRect();
    const tw = tooltipRect.width || 350;
    const th = tooltipRect.height || 150;

    // Flip above if not enough space below
    if (top + th > window.innerHeight - 10) {
      top = rect.top - th - pad;
    }
    // Keep within viewport horizontally
    if (left + tw > window.innerWidth - 10) {
      left = window.innerWidth - tw - 10;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }

  function showToast(msg) {
    toast.textContent = msg || 'Copied to clipboard';
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 1500);
  }

  function updateBadge() {
    let badge = annotateBtn.querySelector('.av-badge');
    if (annotations.length === 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'av-badge';
      annotateBtn.appendChild(badge);
    }
    badge.textContent = annotations.length;
  }

  function setMode(newMode) {
    if (mode === newMode) newMode = 'off';
    mode = newMode;

    inspectBtn.classList.toggle('active', mode === 'inspect');
    annotateBtn.classList.toggle('active', mode === 'annotate');

    highlight.style.display = 'none';
    tooltip.style.display = 'none';
    tooltip.classList.remove('pinned');
    hoveredEl = null;
    pinnedInspect = null;

    document.body.style.cursor = mode === 'off' ? '' : 'crosshair';
  }

  // ── Annotation Markers ─────────────────────────────────────────────

  function renderMarkers() {
    markersContainer.innerHTML = '';
    for (const ann of annotations) {
      const marker = document.createElement('div');
      marker.className = 'av-marker';
      marker.title = ann.comment || '(no note)';
      marker.innerHTML = `<span class="av-marker-num">${ann.index}</span><span class="av-marker-x">&times;</span>`;

      // Position at the element's top-right
      const el = ann.fullSelector ? document.querySelector(ann.fullSelector) : null;
      if (el) {
        const rect = el.getBoundingClientRect();
        marker.style.top = (rect.top - 14) + 'px';
        marker.style.left = (rect.right - 14) + 'px';
      } else {
        marker.style.top = ann.y + 'px';
        marker.style.left = ann.x + 'px';
      }

      marker.addEventListener('click', () => {
        if (ann._marks) {
          for (const m of ann._marks) {
            if (m.parentNode) {
              const parent = m.parentNode;
              while (m.firstChild) parent.insertBefore(m.firstChild, m);
              m.remove();
              parent.normalize();
            }
          }
        }
        const idx = annotations.indexOf(ann);
        if (idx > -1) annotations.splice(idx, 1);
        annotations.forEach((a, i) => a.index = i + 1);
        saveAnnotations();
        closePopover();
        renderMarkers();
      });

      markersContainer.appendChild(marker);
    }
    updateBadge();
  }

  function showAnnotationDetail(ann, opts) {
    const isNew = opts && opts.isNew;
    closePopover();
    const el = ann.fullSelector ? document.querySelector(ann.fullSelector) : null;
    const rect = el ? el.getBoundingClientRect() : { top: ann.y, left: ann.x, bottom: ann.y + 20, right: ann.x + 20 };

    annotatePopover = document.createElement('div');
    annotatePopover.className = 'av-popover';

    // Position popover within viewport
    const popW = 360;
    const popH = 280;
    let popTop = rect.bottom + 8;
    let popLeft = rect.left;

    // Flip above if it would go below the viewport
    if (popTop + popH > window.innerHeight - 10) {
      popTop = rect.top - popH - 8;
    }
    // If still off-screen (element is tall), just pin to bottom
    if (popTop + popH > window.innerHeight - 10) {
      popTop = window.innerHeight - popH - 10;
    }
    // Never go above the top
    if (popTop < 10) popTop = 10;
    // Clamp horizontal
    popLeft = Math.max(10, Math.min(popLeft, window.innerWidth - popW - 10));

    annotatePopover.style.top = popTop + 'px';
    annotatePopover.style.left = popLeft + 'px';

    const intents = ['bug', 'style', 'feature', 'content'];
    annotatePopover.innerHTML = `
      <div class="av-popover-header">
        <strong>#${ann.index}</strong>
        <span>${esc(ann.shortSelector)}</span>
      </div>
      ${ann.selectedText ? `<div style="font-size:12px;color:#f59e0b;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">"${esc(ann.selectedText.slice(0, 60))}"</div>` : ''}
      <div class="av-intent-row">
        ${intents.map(i => `<button class="av-intent-tag${ann.intent === i ? ' selected' : ''}" data-intent="${i}">${i}</button>`).join('')}
      </div>
      <textarea placeholder="Add your note...">${ann.comment || ''}</textarea>
      <div class="av-popover-actions">
        <button class="av-popover-btn secondary" data-action="delete">Delete</button>
        <button class="av-popover-btn secondary" data-action="cancel">Cancel</button>
        <button class="av-popover-btn primary" data-action="save">Save</button>
      </div>
    `;

    const textarea = annotatePopover.querySelector('textarea');
    setTimeout(() => textarea.focus(), 50);

    // Intent tag selection
    annotatePopover.querySelectorAll('.av-intent-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const intent = tag.dataset.intent;
        ann.intent = ann.intent === intent ? '' : intent;
        annotatePopover.querySelectorAll('.av-intent-tag').forEach(t => t.classList.remove('selected'));
        if (ann.intent) tag.classList.add('selected');
      });
    });

    annotatePopover.querySelector('[data-action="save"]').addEventListener('click', () => {
      ann.comment = textarea.value.trim();
      closePopover();
      updateBadge();
      saveAnnotations();
    });

    function removeTextHighlight(a) {
      if (!a._marks) return;
      for (const m of a._marks) {
        if (m.parentNode) {
          const parent = m.parentNode;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          m.remove();
          parent.normalize();
        }
      }
    }

    annotatePopover.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      if (isNew) {
        removeTextHighlight(ann);
        const idx = annotations.indexOf(ann);
        if (idx > -1) annotations.splice(idx, 1);
        annotations.forEach((a, i) => a.index = i + 1);
        saveAnnotations();
      }
      closePopover();
      renderMarkers();
    });

    annotatePopover.querySelector('[data-action="delete"]').addEventListener('click', () => {
      removeTextHighlight(ann);
      const idx = annotations.indexOf(ann);
      if (idx > -1) annotations.splice(idx, 1);
      annotations.forEach((a, i) => a.index = i + 1);
      saveAnnotations();
      closePopover();
      renderMarkers();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        ann.comment = textarea.value.trim();
        closePopover();
        updateBadge();
        saveAnnotations();
      }
      if (e.key === 'Escape') closePopover();
    });

    container.appendChild(annotatePopover);
  }

  function closePopover() {
    if (annotatePopover) {
      annotatePopover.remove();
      annotatePopover = null;
    }
  }

  // ── Markdown Generator ─────────────────────────────────────────────

  function cleanText(str) {
    return str.replace(/\s+/g, ' ').trim();
  }

  function generateMarkdown() {
    if (annotations.length === 0) return '(No annotations)';

    const lines = [`# UI Annotations`, ``, `**Page:** ${window.location.href}`, `**Date:** ${new Date().toISOString().slice(0, 10)}`, ``];

    for (const ann of annotations) {
      const label = ann.intent ? `[${ann.intent}] ` : '';
      lines.push(`## ${label}Annotation ${ann.index}`);
      lines.push(`**Element:** \`${ann.shortSelector}\``);
      lines.push(`**Selector:** \`${ann.fullSelector || 'body'}\``);

      if (ann.selectedText) {
        lines.push(`**Selected text:** "${cleanText(ann.selectedText)}"`);
      } else if (ann.textContent) {
        lines.push(`**Text:** "${cleanText(ann.textContent)}"`);
      }

      const styleEntries = Object.entries(ann.computed);
      if (styleEntries.length) {
        const styleStr = styleEntries.map(([k, v]) => `${k}: ${v}`).join('; ');
        lines.push(`**Styles:** \`${styleStr}\``);
      }

      lines.push(`**Note:** ${ann.comment || '(no note)'}`);
      lines.push(``);
    }

    return lines.join('\n');
  }

  // ── Event Handlers ─────────────────────────────────────────────────

  function onMouseMove(e) {
    if (mode === 'off') return;
    if (pinnedInspect) return;
    if (isOwnElement(e.target)) return;
    if (isTopLevel(e.target)) return;

    const el = e.target;
    if (el === hoveredEl) return;
    hoveredEl = el;

    const rect = el.getBoundingClientRect();

    // Show highlight
    highlight.style.display = 'block';
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';

    if (mode === 'inspect') {
      // Show tooltip
      const tag = el.tagName.toLowerCase();
      const classes = (el.className && typeof el.className === 'string')
        ? el.className.trim().split(/\s+/).filter(c => c)
        : [];
      const selector = getSelector(el);
      const computed = getComputedInfo(el);
      const text = (el.textContent || '').trim().slice(0, 60);

      let html = `<span class="av-tooltip-tag">&lt;${esc(tag)}&gt;</span>`;
      if (el.id) html += `  <span class="av-tooltip-class">#${esc(el.id)}</span>`;
      if (classes.length) html += `  <span class="av-tooltip-class">.${esc(classes.join('.'))}</span>`;
      html += `\n<span class="av-tooltip-label">selector:</span> <span class="av-tooltip-selector">${esc(selector)}</span>`;

      if (text) html += `\n<span class="av-tooltip-label">text:</span> <span class="av-tooltip-value">"${esc(text)}${el.textContent.trim().length > 60 ? '...' : ''}"</span>`;

      const styleLines = Object.entries(computed);
      if (styleLines.length) {
        html += `\n<span class="av-tooltip-label">styles:</span>`;
        for (const [k, v] of styleLines) {
          html += `\n  <span class="av-tooltip-label">${esc(k)}:</span> <span class="av-tooltip-value">${esc(v)}</span>`;
        }
      }

      const dims = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      html += `\n<span class="av-tooltip-label">size:</span> <span class="av-tooltip-value">${dims}</span>`;

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      positionTooltip(rect);
    }
  }

  function onMouseOut(e) {
    if (mode === 'off') return;
    if (pinnedInspect) return;
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      highlight.style.display = 'none';
      tooltip.style.display = 'none';
      hoveredEl = null;
    }
  }

  function unpinInspect() {
    pinnedInspect = null;
    tooltip.classList.remove('pinned');
    tooltip.style.display = 'none';
    highlight.style.display = 'none';
    hoveredEl = null;
  }

  function pinInspect(el) {
    const selector = getSelector(el);
    const computed = getComputedInfo(el);
    const text = (el.textContent || '').trim().slice(0, 60);
    const tag = el.tagName.toLowerCase();
    const classes = (el.className && typeof el.className === 'string')
      ? el.className.trim().split(/\s+/).filter(c => c)
      : [];

    pinnedInspect = { el, selector };

    // Build copyable text
    let copyText = `selector: ${selector}`;
    if (classes.length) copyText += `\nclasses: ${classes.join(' ')}`;
    if (text) copyText += `\ntext: "${text}"`;
    const styleEntries = Object.entries(computed);
    if (styleEntries.length) {
      copyText += `\nstyles: ${styleEntries.map(([k, v]) => `${k}: ${v}`).join('; ')}`;
    }

    // Add copy/dismiss buttons to tooltip
    const actions = document.createElement('div');
    actions.className = 'av-tooltip-actions';
    const copyBtnEl = document.createElement('button');
    copyBtnEl.className = 'av-tooltip-copy';
    copyBtnEl.textContent = 'Copy';
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'av-tooltip-dismiss';
    dismissBtn.textContent = 'Dismiss';

    copyBtnEl.addEventListener('click', () => {
      navigator.clipboard.writeText(copyText).then(() => {
        showToast('Selector copied');
        unpinInspect();
      });
    });
    dismissBtn.addEventListener('click', () => {
      unpinInspect();
    });

    actions.appendChild(copyBtnEl);
    actions.appendChild(dismissBtn);
    tooltip.appendChild(actions);
    tooltip.classList.add('pinned');
  }

  function onClick(e) {
    // Skip if text selection just created an annotation
    if (justSelectedText) {
      justSelectedText = false;
      return;
    }

    if (mode === 'inspect') {
      if (isOwnElement(e.target)) return;
      if (isTopLevel(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      if (pinnedInspect) {
        unpinInspect();
        return;
      }

      pinInspect(e.target);
      return;
    }

    if (mode !== 'annotate') return;
    if (isOwnElement(e.target)) return;
    if (isTopLevel(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const el = e.target;

    // If element already annotated, show its detail instead of duplicating
    const existing = annotations.find(a => {
      if (!a.fullSelector) return false;
      const annotatedEl = document.querySelector(a.fullSelector);
      return annotatedEl === el;
    });
    if (existing) {
      showAnnotationDetail(existing);
      return;
    }

    const rect = el.getBoundingClientRect();

    const ann = {
      index: annotations.length + 1,
      type: 'element',
      shortSelector: getShortSelector(el),
      fullSelector: getSelector(el),
      classes: (el.className && typeof el.className === 'string') ? el.className.trim() : '',
      computed: getComputedInfo(el),
      textContent: (el.textContent || '').trim().slice(0, 80),
      comment: '',
      intent: '',
      x: rect.right - 14,
      y: rect.top - 14,
    };

    annotations.push(ann);
    saveAnnotations();
    renderMarkers();
    showAnnotationDetail(ann, { isNew: true });
  }

  // ── Toolbar Actions ────────────────────────────────────────────────

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.av-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'inspect') {
      closePopover();
      setMode('inspect');
    } else if (action === 'annotate') {
      closePopover();
      setMode('annotate');
    } else if (action === 'copy') {
      const md = generateMarkdown();
      navigator.clipboard.writeText(md).then(() => {
        showToast(`Copied ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}`);
      }).catch(() => {
        showToast('Copy failed — check permissions');
      });
    } else if (action === 'clear') {
      for (const a of annotations) {
        if (a._marks) {
          for (const m of a._marks) {
            if (m.parentNode) {
              const parent = m.parentNode;
              while (m.firstChild) parent.insertBefore(m.firstChild, m);
              m.remove();
              parent.normalize();
            }
          }
        }
      }
      annotations.length = 0;
      saveAnnotations();
      closePopover();
      renderMarkers();
      setMode('off');
      showToast('Cleared all annotations');
    }
  });

  // ── Keyboard Shortcuts ─────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    // Don't capture in shadow DOM inputs
    if (shadow.activeElement && (shadow.activeElement.tagName === 'TEXTAREA' || shadow.activeElement.tagName === 'INPUT')) return;

    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      closePopover();
      setMode('inspect');
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      closePopover();
      setMode('annotate');
    } else if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
      // Only raw 'c', not Cmd+C / Ctrl+C
      e.preventDefault();
      const md = generateMarkdown();
      navigator.clipboard.writeText(md).then(() => {
        showToast(`Copied ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}`);
      });
    } else if (e.key === 'Escape') {
      closePopover();
      setMode('off');
    }
  });

  // ── Text Selection Handler ──────────────────────────────────────────

  function onMouseUp(e) {
    if (mode !== 'annotate') return;
    if (isOwnElement(e.target)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    e.preventDefault();
    e.stopPropagation();
    justSelectedText = true;

    const text = sel.toString().trim().slice(0, 200);
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Find the real parent element before any DOM manipulation
    const startEl = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    // Walk up past any inline elements to get a meaningful parent
    let el = startEl;
    while (el && el.parentElement && ['SPAN', 'A', 'EM', 'STRONG', 'B', 'I'].includes(el.tagName)) {
      el = el.parentElement;
    }

    // Capture selector info before modifying DOM
    const shortSel = getShortSelector(el);
    const fullSel = getSelector(el);
    const classes = (el.className && typeof el.className === 'string') ? el.className.trim() : '';
    const computed = getComputedInfo(el);

    // Highlight using CSS highlight-style marks for each text node in range
    const marks = [];
    try {
      // Clone range contents, wrap in highlight spans
      const fragment = range.cloneContents();
      const mark = document.createElement('span');
      mark.className = 'av-text-highlight';
      range.deleteContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
      marks.push(mark);
    } catch (_) { /* complex selections — skip highlighting */ }

    const ann = {
      index: annotations.length + 1,
      type: 'text',
      shortSelector: shortSel,
      fullSelector: fullSel,
      classes: classes,
      computed: computed,
      textContent: text,
      selectedText: text,
      comment: '',
      intent: '',
      x: rect.right - 14,
      y: rect.top - 14,
      _marks: marks,
    };

    sel.removeAllRanges();
    annotations.push(ann);
    renderMarkers();
    showAnnotationDetail(ann, { isNew: true });
  }

  // ── Global Listeners ───────────────────────────────────────────────
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('mouseup', onMouseUp, true);

  // Reposition markers on scroll/resize
  let rafId = null;
  function onLayoutChange() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (annotations.length) renderMarkers();
    });
  }
  window.addEventListener('scroll', onLayoutChange, { passive: true });
  window.addEventListener('resize', onLayoutChange, { passive: true });

  // ── Init: Load Persisted Annotations ────────────────────────────────
  loadAnnotations();
  if (annotations.length) renderMarkers();

  console.log('%c[agentation-vanilla]%c loaded — press I to inspect, A to annotate', 'color:#60a5fa;font-weight:bold', 'color:inherit');
})();
