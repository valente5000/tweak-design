/* tweak-design playground v2 · per-layout scoping + element inspector */
(() => {
'use strict';

/* ── State ──────────────────────────────────────────────────────── */
const state = {
  manifest: null,
  tweaksDef: null,                // {color_tokens, size_tokens, selects, element_tweaks, groups}
  layouts: [],
  defaults: {},                   // factory defaults per tweak key

  // Tweak values: cascade is perLayout > _global > defaults
  tweakValues: {
    _global: {},                  // values applied across all layouts (opt-in)
    perLayout: {},                // {[layoutId]: {[key]: value}}
    _scope: {}                    // {[key]: 'layout' | 'global'}  - what the user picked for each control
  },

  // Element overrides per layout: {[layoutId]: {[selector]: {[prop]: value}}}
  elementOverrides: {},

  // Per-element selectorScope: {[layoutId]: {[selector]: 'layout' | 'global'}}
  // For now we keep element overrides as per-layout only (element global == applied to all layouts where selector exists, treat as advanced; ship simple first)

  annotations: [],
  viewMode: 1,
  paneLayouts: [],                // [layoutId, layoutId, layoutId]
  storageKey: '',
  paneFrames: [],
  paneStages: [],
  paneOverlays: [],
  panes: [],                      // root pane elements
  annCounter: 0,

  inspectMode: false,
  selectedElement: null,          // {layoutId, paneIdx, selector, label, props, computed}
};

/* ── Helpers ────────────────────────────────────────────────────── */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const make = (tag, attrs = {}, kids = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of [].concat(kids)) {
    if (k == null) continue;
    el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  }
  return el;
};
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };

const currentLayoutId = () => state.paneLayouts[0]; // canonical "focused" layout

/* ── Cascade resolution ─────────────────────────────────────────── */
function effectiveTweaks(layoutId) {
  const out = {};
  for (const k of Object.keys(state.defaults)) {
    out[k] = state.tweakValues.perLayout[layoutId]?.[k]
          ?? state.tweakValues._global[k]
          ?? state.defaults[k];
  }
  return out;
}
function effectiveElementCss(layoutId) {
  const overrides = state.elementOverrides[layoutId] || {};
  let css = '';
  for (const [sel, props] of Object.entries(overrides)) {
    const decls = Object.entries(props).map(([p, v]) => `${p}:${v} !important;`).join('');
    if (decls) css += `${sel}{${decls}}\n`;
  }
  return css;
}

/* ── Boot ───────────────────────────────────────────────────────── */
async function boot() {
  try {
    const r = await fetch('./layouts.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`layouts.json missing (${r.status})`);
    state.manifest = await r.json();
  } catch (e) {
    showFatalError(`Could not load layouts.json — ${e.message}`);
    return;
  }
  state.layouts = state.manifest.layouts || [];
  if (!state.layouts.length) { showFatalError('layouts.json has no layouts[]'); return; }

  state.storageKey = `tweak-design:${location.pathname}`;
  document.getElementById('projectTitle').textContent = state.manifest.title || 'design review';

  if (state.manifest.tweaks_manifest) {
    try {
      const r = await fetch(state.manifest.tweaks_manifest, { cache: 'no-store' });
      if (r.ok) state.tweaksDef = await r.json();
    } catch (_) {}
  }
  if (!state.tweaksDef) state.tweaksDef = await autoDetect(state.layouts[0].src);
  state.defaults = computeDefaults(state.tweaksDef);

  // Adopt the design system's accent for the playground UI itself.
  // No hardcoded brand color — the tool inherits the look of the design it reviews.
  const firstColor = (state.tweaksDef.color_tokens || [])[0];
  if (firstColor?.default) {
    document.documentElement.style.setProperty('--accent', firstColor.default);
  }

  const saved = restoreSession();
  if (saved) {
    state.tweakValues = saved.tweakValues || state.tweakValues;
    state.elementOverrides = saved.elementOverrides || {};
    state.annotations = saved.annotations || [];
    state.viewMode = saved.viewMode || 1;
    state.paneLayouts = saved.paneLayouts || [];
    state.annCounter = state.annotations.reduce((m, a) => Math.max(m, a.n || 0), 0);
  }
  // Ensure scope/perLayout objects exist
  state.tweakValues._global    ||= {};
  state.tweakValues.perLayout  ||= {};
  state.tweakValues._scope     ||= {};
  if (!state.paneLayouts.length || state.paneLayouts.length !== 3) {
    state.paneLayouts = [
      state.layouts[0].id,
      state.layouts[1]?.id || state.layouts[0].id,
      state.layouts[2]?.id || state.layouts[0].id,
    ];
  }

  renderAll();
  bindGlobalEvents();
}

function showFatalError(msg) {
  clear(document.body);
  document.body.appendChild(make('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center',
             height: '100vh', padding: '48px', textAlign: 'center', color: '#aaa',
             fontFamily: 'Inter, sans-serif' },
  }, [
    make('div', { style: { maxWidth: '600px' } }, [
      make('div', { style: { fontSize: '13px', letterSpacing: '0.16em',
                             textTransform: 'uppercase', color: 'var(--accent, #5B8DEF)',
                             marginBottom: '24px' } }, 'tweak-design · error'),
      make('div', { style: { fontSize: '18px', lineHeight: '1.5' } }, msg),
    ]),
  ]));
}

/* ── Auto-detection (frequency-ranked fallback) ─────────────────── */
/* When no tweaks.json is provided, we scan the loaded HTML for CSS custom
   properties and rank them by how often they're REFERENCED via var(--x).
   Most-referenced = most load-bearing = most worth exposing. We surface the
   top N. This is a fallback — the design-creator skill (huashu-design etc.)
   should normally declare tweaks.json with curated controls. */
async function autoDetect(src) {
  try {
    const r = await fetch(src, { cache: 'no-store' });
    if (!r.ok) return {};
    const html = await r.text();
    const declRe   = /(--[a-z0-9-]+)\s*:\s*([^;}\n]+)\s*[;}]/g;
    const refRe    = /var\(\s*(--[a-z0-9-]+)/g;
    const refCount = new Map();
    for (const m of html.matchAll(refRe)) refCount.set(m[1], (refCount.get(m[1]) || 0) + 1);
    const decls = new Map();
    for (const m of html.matchAll(declRe)) {
      if (!decls.has(m[1])) decls.set(m[1], m[2].trim());
    }
    const colorTokens = [], sizeTokens = [];
    for (const [name, raw] of decls) {
      const colorM = raw.match(/^(#[0-9a-fA-F]{3,8})$/);
      const sizeM  = raw.match(/^(-?[\d.]+)\s*(px|em|rem|%|deg|vh|vw)$/);
      const freq = refCount.get(name) || 0;
      if (colorM) {
        colorTokens.push({ var: name, default: colorM[1], label: humanize(name), group: 'auto', _freq: freq });
      } else if (sizeM) {
        const val = parseFloat(sizeM[1]);
        sizeTokens.push({
          var: name, default: sizeM[1], unit: sizeM[2], label: humanize(name),
          min: 0, max: Math.max(val * 3, val + 100), step: sizeM[2] === 'px' ? 1 : 0.05,
          group: 'auto', _freq: freq,
        });
      }
    }
    // Rank by frequency (most-referenced first), then by name. Take top 12 each.
    const byFreq = (a, b) => (b._freq - a._freq) || a.var.localeCompare(b.var);
    const top = (arr) => arr.sort(byFreq).slice(0, 12).map(({ _freq, ...t }) => t);
    return {
      title: 'Auto-detected tokens (ranked by usage frequency)',
      color_tokens: top(colorTokens),
      size_tokens: top(sizeTokens),
      groups: [{ id: 'auto', label: 'Auto-detected · top by usage' }],
    };
  } catch (_) { return {}; }
}
function humanize(v) {
  return v.replace(/^--/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function computeDefaults(def) {
  const out = {};
  for (const t of (def.color_tokens || [])) out[t.var] = t.default;
  for (const t of (def.size_tokens  || [])) out[t.var] = t.default;
  for (const s of (def.selects      || [])) out[s.id]  = s.default;
  return out;
}

function restoreSession() {
  try { const raw = localStorage.getItem(state.storageKey); if (raw) return JSON.parse(raw); }
  catch (_) {}
  return null;
}
function saveSession() {
  try {
    localStorage.setItem(state.storageKey, JSON.stringify({
      tweakValues: state.tweakValues,
      elementOverrides: state.elementOverrides,
      annotations: state.annotations,
      viewMode: state.viewMode,
      paneLayouts: state.paneLayouts,
    }));
  } catch (_) {}
}

/* ── Top nav ────────────────────────────────────────────────────── */
function renderTopNav() {
  const nav = $('#layoutNav');
  clear(nav);
  if (state.viewMode !== 1) {
    nav.appendChild(make('span', {
      class: 'section__hint',
      style: { fontSize: '11px', color: 'var(--ink-faint)' },
    }, `${state.viewMode} layouts side-by-side · use per-pane menus`));
    return;
  }
  if (state.layouts.length <= 6) {
    state.layouts.forEach(L => {
      nav.appendChild(make('button', {
        class: 'tab' + (L.id === state.paneLayouts[0] ? ' is-active' : ''),
        onclick: () => switchToLayout(L.id),
      }, L.label));
    });
  } else {
    const sel = make('select', {
      class: 'pane__select',
      onchange: (e) => switchToLayout(e.target.value),
    });
    state.layouts.forEach(L => {
      const o = make('option', { value: L.id }, L.label);
      if (L.id === state.paneLayouts[0]) o.selected = true;
      sel.appendChild(o);
    });
    nav.appendChild(sel);
  }
}

function switchToLayout(layoutId) {
  state.paneLayouts[0] = layoutId;
  // Clear selection on layout change (selected element no longer relevant)
  if (state.selectedElement) closeElementPanel();
  renderTopNav();
  renderCanvas();
  renderTweaks();          // re-render: effective values change with layout
  saveSession();
}

/* ── View modes ─────────────────────────────────────────────────── */
function bindModeButtons() {
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(parseInt(btn.dataset.mode, 10)));
  });
}
function setViewMode(mode) {
  state.viewMode = mode;
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', parseInt(b.dataset.mode, 10) === mode));
  if (state.selectedElement) closeElementPanel();
  renderTopNav();
  renderCanvas();
  renderTweaks();
  saveSession();
}

/* ── Canvas / panes ─────────────────────────────────────────────── */
function renderCanvas() {
  const canvas = $('#canvas');
  canvas.dataset.mode = state.viewMode;
  clear(canvas);
  state.paneFrames = []; state.paneStages = []; state.paneOverlays = []; state.panes = [];

  for (let i = 0; i < state.viewMode; i++) {
    const layoutId = state.paneLayouts[i];
    const layout = state.layouts.find(L => L.id === layoutId) || state.layouts[0];
    canvas.appendChild(renderPane(i, layout));
  }
  requestAnimationFrame(scaleAllPanes);
}

function renderPane(idx, layout) {
  const isSplit = state.viewMode > 1;
  const pane = make('section', { class: 'pane' + (state.inspectMode ? ' is-inspect' : ''), 'data-pane-idx': idx });

  const head = make('header', { class: 'pane__head' });
  if (!isSplit) head.hidden = true;
  const sel = make('select', {
    class: 'pane__select',
    onchange: (e) => {
      state.paneLayouts[idx] = e.target.value;
      if (state.selectedElement && state.selectedElement.paneIdx === idx) closeElementPanel();
      renderCanvas();
      renderTweaks();
      saveSession();
    },
  });
  state.layouts.forEach(L => {
    const o = make('option', { value: L.id }, L.label);
    if (L.id === layout.id) o.selected = true;
    sel.appendChild(o);
  });
  head.appendChild(sel);
  head.appendChild(make('span', { class: 'pane__id' }, layout.id));
  pane.appendChild(head);

  const stage = make('div', { class: 'pane__stage' });
  const wrap = make('div', { class: 'pane__frame-wrap' });
  const frame = make('iframe', { class: 'pane__frame', title: layout.label });
  const overlay = make('div', { class: 'pane__overlay' + (state.inspectMode ? ' is-inspect' : '') });

  wrap.appendChild(frame);
  wrap.appendChild(overlay);
  stage.appendChild(wrap);
  pane.appendChild(stage);

  state.paneFrames[idx] = frame;
  state.paneStages[idx] = stage;
  state.paneOverlays[idx] = overlay;
  state.panes[idx] = pane;

  loadIntoFrame(frame, layout, idx);
  bindAnnotationOverlay(idx, overlay, frame, layout.id);

  return pane;
}

/* ── Iframe loading + shim ──────────────────────────────────────── */
async function loadIntoFrame(frame, layout, paneIdx) {
  try {
    const r = await fetch(layout.src, { cache: 'no-store' });
    if (!r.ok) throw new Error(`fetch failed ${r.status}`);
    let html = await r.text();
    html = injectShim(html);
    frame.srcdoc = html;
    frame.addEventListener('load', () => {
      pushTweaksToPane(paneIdx);
      pushElementsToPane(paneIdx);
      reapplyHighlights(layout.id, frame);
      if (state.inspectMode) postShim(frame, { type: 'tweak:inspect-mode', on: true });
    }, { once: true });
  } catch (e) {
    frame.srcdoc = `<div style="padding:48px;font-family:sans-serif;color:#900">Could not load ${layout.src} — ${e.message}</div>`;
  }
}

function postShim(frame, msg) {
  try { frame.contentWindow.postMessage(msg, '*'); } catch (_) {}
}

const SHIM_BODY = `(function(){
  var STYLE_ID = '__tweak_design_inject';
  var ELEM_ID  = '__tweak_design_elem';
  var HL_ID    = '__tweak_design_hl';
  var INSPECT_ID = '__tweak_design_inspect_style';
  var inspectOn = false;
  var hoverEl = null;

  function ensureStyle(id){
    var s = document.getElementById(id);
    if (!s){ s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
    return s;
  }
  function applyVars(vars){
    var s = ensureStyle(STYLE_ID);
    var rules = ':root,html{';
    for (var k in vars){ if (vars[k] != null) rules += k + ':' + vars[k] + ';'; }
    rules += '}';
    s.textContent = rules;
  }
  function applyElementCss(css){
    var s = ensureStyle(ELEM_ID);
    s.textContent = css || '';
  }
  function applyHighlight(selectors){
    var hl = ensureStyle(HL_ID);
    if (!selectors || selectors.length === 0){ hl.textContent = ''; return; }
    hl.textContent = selectors.join(',') + '{outline:2px dashed #ff5577 !important;outline-offset:3px;}';
  }
  function elementsAtRect(x, y, w, h){
    var pts = [
      [x+w*0.5, y+h*0.5],[x, y],[x+w, y],[x, y+h],[x+w, y+h],
      [x+w*0.25, y+h*0.5],[x+w*0.75, y+h*0.5],[x+w*0.5, y+h*0.25],[x+w*0.5, y+h*0.75]
    ];
    var found = new Set();
    pts.forEach(function(p){
      var els = document.elementsFromPoint(p[0], p[1]) || [];
      els.forEach(function(el){ if (el && el.tagName && el !== document.documentElement && el !== document.body) found.add(el); });
    });
    return Array.from(found).map(elementSelector);
  }
  function elementSelector(el){
    if (!el) return '';
    if (el.id) return '#' + el.id;
    var path = [];
    while (el && el.nodeType === 1 && el !== document.body){
      var seg = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string'){
        var cls = el.className.trim().split(/\\s+/).filter(Boolean).slice(0,2);
        if (cls.length) seg += '.' + cls.join('.');
      }
      path.unshift(seg);
      el = el.parentElement;
      if (path.length > 4) break;
    }
    return path.join('>');
  }
  function setInspectMode(on){
    inspectOn = on;
    var s = ensureStyle(INSPECT_ID);
    s.textContent = on
      ? '*:hover{outline:2px solid #66ccff !important;outline-offset:1px;cursor:cell !important;}'
      : '';
    if (!on && hoverEl){ hoverEl = null; }
  }
  function getComputed(el, props){
    var cs = window.getComputedStyle(el);
    var out = {};
    props.forEach(function(p){ out[p] = cs.getPropertyValue(p).trim(); });
    return out;
  }
  function captureElement(target){
    var sel = elementSelector(target);
    var common = ['font-size','color','font-weight','letter-spacing','line-height','padding',
                  'background-color','border-radius','opacity','text-align','text-transform','font-style'];
    var computed = getComputed(target, common);
    parent.postMessage({
      type: 'tweak:element-picked',
      selector: sel,
      tagName: target.tagName.toLowerCase(),
      computed: computed
    }, '*');
  }
  document.addEventListener('mouseover', function(e){
    if (!inspectOn) return;
    if (e.target === document.body || e.target === document.documentElement) return;
    hoverEl = e.target;
  }, true);
  document.addEventListener('click', function(e){
    if (!inspectOn) return;
    e.preventDefault(); e.stopPropagation();
    if (e.target && e.target !== document.body) captureElement(e.target);
  }, true);

  window.addEventListener('message', function(ev){
    var d = ev.data || {};
    if (d.type === 'tweak:apply'){ applyVars(d.vars || {}); }
    if (d.type === 'tweak:element-css'){ applyElementCss(d.css || ''); }
    if (d.type === 'tweak:highlight'){
      if (d.coords){
        var sels = elementsAtRect(d.coords.x, d.coords.y, d.coords.w, d.coords.h);
        applyHighlight(sels);
        ev.source.postMessage({ type: 'tweak:highlight:result', annId: d.annId, selectors: sels }, '*');
      } else { applyHighlight(d.selectors || []); }
    }
    if (d.type === 'tweak:clearHighlight'){ applyHighlight([]); }
    if (d.type === 'tweak:inspect-mode'){ setInspectMode(!!d.on); }
  });
  parent.postMessage({ type: 'tweak:ready' }, '*');
})();`;

function injectShim(html) {
  const tag = `<scr` + `ipt>${SHIM_BODY}</scr` + `ipt>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, tag + '</body>');
  return html + tag;
}

/* ── Push to iframe ─────────────────────────────────────────────── */
function pushTweaksToPane(paneIdx) {
  const frame = state.paneFrames[paneIdx];
  if (!frame) return;
  const layoutId = state.paneLayouts[paneIdx];
  const eff = effectiveTweaks(layoutId);
  const vars = {};
  for (const t of (state.tweaksDef.color_tokens || [])) vars[t.var] = eff[t.var];
  for (const t of (state.tweaksDef.size_tokens || []))  vars[t.var] = `${eff[t.var]}${t.unit || ''}`;
  for (const sel of (state.tweaksDef.selects || [])) {
    const opt = sel.options.find(o => o.value === eff[sel.id]);
    if (opt && opt.css) Object.assign(vars, opt.css);
  }
  postShim(frame, { type: 'tweak:apply', vars });
}
function pushElementsToPane(paneIdx) {
  const frame = state.paneFrames[paneIdx];
  if (!frame) return;
  const layoutId = state.paneLayouts[paneIdx];
  postShim(frame, { type: 'tweak:element-css', css: effectiveElementCss(layoutId) });
}
function pushAllPanes() {
  for (let i = 0; i < state.viewMode; i++) {
    pushTweaksToPane(i);
    pushElementsToPane(i);
  }
}

/* ── Sidebar tweaks ─────────────────────────────────────────────── */
function getScope(key) { return state.tweakValues._scope[key] || 'layout'; }
function setScope(key, scope) { state.tweakValues._scope[key] = scope; }

function effectiveValue(key) {
  const lid = currentLayoutId();
  return state.tweakValues.perLayout[lid]?.[key]
      ?? state.tweakValues._global[key]
      ?? state.defaults[key];
}
function valueSource(key) {
  const lid = currentLayoutId();
  if (state.tweakValues.perLayout[lid]?.[key] !== undefined) return 'layout';
  if (state.tweakValues._global[key] !== undefined) return 'global';
  return 'default';
}

function setTweakValue(key, value) {
  const scope = getScope(key);
  if (scope === 'global') {
    if (value === undefined || value === null) delete state.tweakValues._global[key];
    else state.tweakValues._global[key] = value;
  } else {
    const lid = currentLayoutId();
    state.tweakValues.perLayout[lid] ||= {};
    if (value === undefined || value === null) delete state.tweakValues.perLayout[lid][key];
    else state.tweakValues.perLayout[lid][key] = value;
  }
  pushAllPanes();
  saveSession();
}

function renderTweaks() {
  const cont = $('#tweaksContainer');
  clear(cont);
  const def = state.tweaksDef || {};
  const groupOrder = (def.groups || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const groupMap = new Map(groupOrder.map(g => [g.id, []]));
  const ungrouped = [];

  const all = [
    ...(def.color_tokens || []).map(t => ({ kind: 'color', def: t })),
    ...(def.size_tokens  || []).map(t => ({ kind: 'size',  def: t })),
    ...(def.selects      || []).map(t => ({ kind: 'select', def: t })),
  ];
  all.forEach(item => {
    const gid = item.def.group;
    if (gid && groupMap.has(gid)) groupMap.get(gid).push(item);
    else ungrouped.push(item);
  });

  groupOrder.forEach(g => {
    const items = groupMap.get(g.id);
    if (!items.length) return;
    cont.appendChild(make('div', { class: 'tweak-group' }, [
      make('div', { class: 'tweak-group__title' }, g.label),
      ...items.map(renderTweakItem),
    ]));
  });
  ungrouped.forEach(it => cont.appendChild(renderTweakItem(it)));

  const total = all.length;
  $('#scopeHint').textContent = state.viewMode === 1
    ? `📍 layout: ${(state.layouts.find(L => L.id === currentLayoutId()) || {}).label || ''}`
    : `🌐 split mode — chips affect first pane`;

  if (total === 0) {
    cont.appendChild(make('div', { class: 'empty' }, 'No tweaks. Add a tweaks.json or this layout has no CSS vars.'));
  }
}

function makeScopeChip(key) {
  const scope = getScope(key);
  const chip = make('button', {
    class: 'scope-chip' + (scope === 'global' ? ' scope-chip--global' : ''),
    title: scope === 'layout'
      ? 'Per-layout (only this layout). Click → apply globally.'
      : 'Global (all layouts). Click → apply only to this layout.',
    onclick: () => {
      const next = scope === 'layout' ? 'global' : 'layout';
      setScope(key, next);
      // Move existing value to the new scope
      const lid = currentLayoutId();
      const cur = effectiveValue(key);
      if (next === 'global') {
        state.tweakValues._global[key] = cur;
        delete state.tweakValues.perLayout[lid]?.[key];
      } else {
        state.tweakValues.perLayout[lid] ||= {};
        state.tweakValues.perLayout[lid][key] = cur;
      }
      pushAllPanes(); saveSession(); renderTweaks();
    },
  });
  chip.appendChild(make('span', { class: 'scope-chip__ico' }, scope === 'layout' ? '📍' : '🌐'));
  chip.appendChild(document.createTextNode(scope === 'layout' ? 'this' : 'all'));
  return chip;
}

function makeInheritedHint(key) {
  if (valueSource(key) === 'global' && getScope(key) === 'layout') {
    return make('span', { class: 'tweak__inherited', title: 'inherited from global' }, '🌐 inherited');
  }
  return null;
}

function makeResetBtn(key) {
  const def = state.defaults[key];
  const cur = effectiveValue(key);
  const isDefault = JSON.stringify(cur) === JSON.stringify(def);
  return make('span', {
    class: 'tweak__reset' + (isDefault ? ' is-hidden' : ''),
    title: 'reset to default',
    onclick: () => {
      // Clear from active scope
      const scope = getScope(key);
      if (scope === 'global') delete state.tweakValues._global[key];
      else delete state.tweakValues.perLayout[currentLayoutId()]?.[key];
      pushAllPanes(); saveSession(); renderTweaks();
    },
  }, '↺');
}

function renderTweakItem(item) {
  if (item.kind === 'color')  return renderColorTweak(item.def);
  if (item.kind === 'size')   return renderSizeTweak(item.def);
  if (item.kind === 'select') return renderSelectTweak(item.def);
}

function tweakLabelRow(key, labelText) {
  const inheritHint = makeInheritedHint(key);
  return make('div', { class: 'tweak__label' }, [
    labelText,
    make('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, [
      inheritHint,
      makeScopeChip(key),
      makeResetBtn(key),
    ]),
  ]);
}

function renderColorTweak(t) {
  const val = effectiveValue(t.var);
  const colorEl = make('input', { type: 'color', class: 'tweak__color', value: val });
  const hexEl = make('input', { type: 'text', class: 'tweak__hex', value: val });
  const sync = (v) => {
    setTweakValue(t.var, v);
    colorEl.value = v; hexEl.value = v;
    renderTweaks();
  };
  colorEl.addEventListener('input', () => sync(colorEl.value));
  hexEl.addEventListener('change', () => {
    const v = hexEl.value.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) sync(v); else hexEl.value = effectiveValue(t.var);
  });
  return make('div', { class: 'tweak' }, [
    tweakLabelRow(t.var, t.label),
    make('div', { class: 'tweak__color-row' }, [colorEl, hexEl]),
  ]);
}

function renderSizeTweak(t) {
  const val = parseFloat(effectiveValue(t.var));
  const range = make('input', { type: 'range', class: 'tweak__range', min: t.min ?? 0, max: t.max ?? 1000, step: t.step ?? 1, value: val });
  const num = make('input', { type: 'number', class: 'tweak__num', value: val, min: t.min ?? 0, max: t.max ?? 1000, step: t.step ?? 1 });
  const sync = (v) => {
    setTweakValue(t.var, String(v));
    range.value = v; num.value = v;
    renderTweaks();
  };
  range.addEventListener('input', () => sync(range.value));
  num.addEventListener('input', () => sync(num.value));
  return make('div', { class: 'tweak' }, [
    tweakLabelRow(t.var, t.label),
    make('div', { class: 'tweak__size-row' }, [range, num, make('span', { class: 'tweak__unit' }, t.unit || '')]),
  ]);
}

function renderSelectTweak(s) {
  const cur = effectiveValue(s.id);
  const seg = make('div', { class: 'tweak__seg' });
  s.options.forEach(o => {
    const btn = make('button', {
      class: 'tweak__seg-opt' + (o.value === cur ? ' is-active' : ''),
      onclick: () => { setTweakValue(s.id, o.value); renderTweaks(); },
    });
    if (o.preview_color) {
      btn.appendChild(make('span', { class: 'tweak__seg-dot', style: { background: o.preview_color } }));
    }
    btn.appendChild(document.createTextNode(o.label));
    seg.appendChild(btn);
  });
  return make('div', { class: 'tweak' }, [
    tweakLabelRow(s.id, s.label),
    seg,
  ]);
}

/* ── Inspect mode + element panel ───────────────────────────────── */
function setInspectMode(on) {
  state.inspectMode = on;
  $('#inspectBtn').classList.toggle('is-active', on);
  state.paneFrames.forEach(f => postShim(f, { type: 'tweak:inspect-mode', on }));
  state.paneOverlays.forEach(o => o.classList.toggle('is-inspect', on));
  state.panes.forEach(p => p.classList.toggle('is-inspect', on));
  // While inspecting, overlay should NOT capture clicks (let them pass to iframe)
  state.paneOverlays.forEach(o => o.style.pointerEvents = on ? 'none' : 'auto');
  if (!on && state.selectedElement) closeElementPanel();
}

function findElementTweak(selector) {
  const list = state.tweaksDef.element_tweaks || [];
  // Walk path from rightmost segment outward looking for matches
  // Try direct match first, then look for any ancestor in the selector that matches
  for (const e of list) {
    if (selector === e.selector) return e;
  }
  for (const e of list) {
    if (selector.includes(e.selector.replace(/^[#.]/, ''))) return e;
  }
  return null;
}

function onElementPicked(paneIdx, msg) {
  const layoutId = state.paneLayouts[paneIdx];
  const match = findElementTweak(msg.selector);
  const props = match?.props || ['font-size', 'color', 'font-weight', 'letter-spacing', 'line-height', 'padding'];
  const label = match?.label || msg.selector.split('>').pop();

  state.selectedElement = {
    layoutId, paneIdx,
    selector: match?.selector || msg.selector,
    label,
    props,
    computed: msg.computed,
    fromManifest: !!match,
  };
  renderElementPanel();
  // Also exit inspect mode now that we have a selection (so user can edit without accidental re-pick)
  setInspectMode(false);
}

function closeElementPanel() {
  state.selectedElement = null;
  $('#elementPanelSection').hidden = true;
  clear($('#elementPanelBody'));
}

function renderElementPanel() {
  const sec = $('#elementPanelSection');
  const body = $('#elementPanelBody');
  if (!state.selectedElement) { sec.hidden = true; return; }
  sec.hidden = false;
  clear(body);
  const sel = state.selectedElement;
  const layout = state.layouts.find(L => L.id === sel.layoutId);
  const overrides = state.elementOverrides[sel.layoutId]?.[sel.selector] || {};

  body.appendChild(make('div', { class: 'element-panel__head' }, [
    make('div', { class: 'element-panel__layout' }, layout?.label || sel.layoutId),
    make('div', { class: 'element-panel__label' }, sel.label + (sel.fromManifest ? ' · from manifest' : ' · default props')),
    make('div', { class: 'element-panel__selector' }, sel.selector),
  ]));

  sel.props.forEach(prop => {
    body.appendChild(renderPropControl(sel, prop, overrides[prop]));
  });
}

function setElementOverride(layoutId, selector, prop, value) {
  state.elementOverrides[layoutId] ||= {};
  state.elementOverrides[layoutId][selector] ||= {};
  if (value === undefined || value === null || value === '') {
    delete state.elementOverrides[layoutId][selector][prop];
    if (Object.keys(state.elementOverrides[layoutId][selector]).length === 0) {
      delete state.elementOverrides[layoutId][selector];
    }
  } else {
    state.elementOverrides[layoutId][selector][prop] = value;
  }
  pushAllPanes();
  saveSession();
}

function renderPropControl(sel, prop, currentOverride) {
  const computedVal = sel.computed[prop] || '';
  const value = currentOverride ?? computedVal;

  // Determine control type by prop name
  if (['color', 'background', 'background-color', 'border-color', 'outline-color'].includes(prop)) {
    return renderColorPropControl(sel, prop, value, computedVal);
  }
  if (['font-size', 'line-height', 'letter-spacing', 'padding', 'margin', 'border-radius',
       'gap', 'width', 'height'].includes(prop)) {
    return renderSizePropControl(sel, prop, value, computedVal);
  }
  if (prop === 'font-weight') {
    return renderSegmentedPropControl(sel, prop, value, ['300','400','500','600','700','800']);
  }
  if (prop === 'text-align') {
    return renderSegmentedPropControl(sel, prop, value, ['left','center','right','justify']);
  }
  if (prop === 'text-transform') {
    return renderSegmentedPropControl(sel, prop, value, ['none','uppercase','lowercase','capitalize']);
  }
  if (prop === 'font-style') {
    return renderSegmentedPropControl(sel, prop, value, ['normal','italic']);
  }
  if (prop === 'opacity') {
    return renderSizePropControl(sel, prop, value, computedVal, { min: 0, max: 1, step: 0.05, isUnitless: true });
  }
  if (prop === 'display') {
    return renderSegmentedPropControl(sel, prop, value, ['block','flex','grid','inline-block','none']);
  }
  return renderTextPropControl(sel, prop, value, computedVal);
}

function propLabelRow(sel, prop, currentOverride) {
  const reset = make('span', {
    class: 'tweak__reset' + (currentOverride === undefined ? ' is-hidden' : ''),
    title: 'reset to default',
    onclick: () => { setElementOverride(sel.layoutId, sel.selector, prop, null); renderElementPanel(); },
  }, '↺');
  return make('div', { class: 'tweak__label' }, [prop, reset]);
}

function rgbToHex(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb.startsWith('#') ? rgb : '#000000';
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function renderColorPropControl(sel, prop, value, computedVal) {
  const initial = value && value.startsWith('#') ? value : rgbToHex(value || computedVal || '#000000');
  const colorEl = make('input', { type: 'color', class: 'tweak__color', value: initial });
  const hexEl = make('input', { type: 'text', class: 'tweak__hex', value: initial });
  const sync = (v) => {
    setElementOverride(sel.layoutId, sel.selector, prop, v);
    colorEl.value = v; hexEl.value = v;
    renderElementPanel();
  };
  colorEl.addEventListener('input', () => sync(colorEl.value));
  hexEl.addEventListener('change', () => {
    const v = hexEl.value.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) sync(v);
  });
  return make('div', { class: 'tweak' }, [
    propLabelRow(sel, prop, state.elementOverrides[sel.layoutId]?.[sel.selector]?.[prop]),
    make('div', { class: 'tweak__color-row' }, [colorEl, hexEl]),
  ]);
}

function renderSizePropControl(sel, prop, value, computedVal, opts = {}) {
  const cur = String(value || computedVal || '0');
  const m = cur.match(/^(-?[\d.]+)(\D*)/);
  const num = m ? parseFloat(m[1]) : 0;
  const unit = opts.isUnitless ? '' : (m && m[2] ? m[2] : 'px');
  const min = opts.min ?? 0;
  const max = opts.max ?? Math.max(num * 3, num + 200);
  const step = opts.step ?? (unit === 'px' ? 1 : 0.05);
  const range = make('input', { type: 'range', class: 'tweak__range', min, max, step, value: num });
  const numEl = make('input', { type: 'number', class: 'tweak__num', value: num, min, max, step });
  const sync = (v) => {
    const final = opts.isUnitless ? String(v) : `${v}${unit}`;
    setElementOverride(sel.layoutId, sel.selector, prop, final);
    range.value = v; numEl.value = v;
    // Don't full re-render; just update reset visibility
    const resetEl = range.closest('.tweak').querySelector('.tweak__reset');
    if (resetEl) resetEl.classList.remove('is-hidden');
  };
  range.addEventListener('input', () => sync(range.value));
  numEl.addEventListener('input', () => sync(numEl.value));
  return make('div', { class: 'tweak' }, [
    propLabelRow(sel, prop, state.elementOverrides[sel.layoutId]?.[sel.selector]?.[prop]),
    make('div', { class: 'tweak__size-row' }, [range, numEl, make('span', { class: 'tweak__unit' }, unit)]),
  ]);
}

function renderSegmentedPropControl(sel, prop, value, options) {
  const cur = String(value || '').trim();
  const seg = make('div', { class: 'tweak__seg' });
  options.forEach(opt => {
    const btn = make('button', {
      class: 'tweak__seg-opt' + (opt === cur ? ' is-active' : ''),
      onclick: () => { setElementOverride(sel.layoutId, sel.selector, prop, opt); renderElementPanel(); },
    }, opt);
    seg.appendChild(btn);
  });
  return make('div', { class: 'tweak' }, [
    propLabelRow(sel, prop, state.elementOverrides[sel.layoutId]?.[sel.selector]?.[prop]),
    seg,
  ]);
}

function renderTextPropControl(sel, prop, value, computedVal) {
  const inp = make('input', { type: 'text', class: 'tweak__hex', value: value || computedVal || '', placeholder: computedVal });
  inp.addEventListener('change', () => {
    setElementOverride(sel.layoutId, sel.selector, prop, inp.value.trim());
    renderElementPanel();
  });
  return make('div', { class: 'tweak' }, [
    propLabelRow(sel, prop, state.elementOverrides[sel.layoutId]?.[sel.selector]?.[prop]),
    inp,
  ]);
}

/* ── Annotations (overlay) ──────────────────────────────────────── */
function bindAnnotationOverlay(paneIdx, overlay, frame, layoutId) {
  let dragging = false, startX = 0, startY = 0, dragRect = null;
  const TH = 5;
  const toFrameCoords = (cx, cy) => {
    const wrap = state.paneStages[paneIdx].firstElementChild;
    const r = wrap.getBoundingClientRect();
    const sx = (cx - r.left) * (1920 / r.width);
    const sy = (cy - r.top)  * (1080 / r.height);
    return { x: Math.max(0, Math.min(1920, sx)), y: Math.max(0, Math.min(1080, sy)) };
  };
  overlay.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || state.inspectMode) return;
    dragging = true;
    const p = toFrameCoords(e.clientX, e.clientY);
    startX = p.x; startY = p.y; dragRect = null;
  });
  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const p = toFrameCoords(e.clientX, e.clientY);
    const w = Math.abs(p.x - startX), h = Math.abs(p.y - startY);
    if (w < TH && h < TH) return;
    if (!dragRect) {
      dragRect = make('div', { class: 'annotation-rect' });
      state.paneStages[paneIdx].firstElementChild.appendChild(dragRect);
    }
    const x = Math.min(p.x, startX), y = Math.min(p.y, startY);
    Object.assign(dragRect.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  });
  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    const p = toFrameCoords(e.clientX, e.clientY);
    const w = Math.abs(p.x - startX), h = Math.abs(p.y - startY);
    if (dragRect) {
      dragRect.remove(); dragRect = null;
      addAnnotation({ type: 'rect', layoutId, x: Math.min(p.x, startX), y: Math.min(p.y, startY), w, h, text: '', dom: [] }, frame, paneIdx);
    } else if (w < TH && h < TH) {
      addAnnotation({ type: 'pin', layoutId, x: startX, y: startY, text: '' }, frame, paneIdx);
    }
  });
  overlay.addEventListener('mouseleave', () => {
    if (dragRect) { dragRect.remove(); dragRect = null; }
    dragging = false;
  });
}

function addAnnotation(ann, frame, paneIdx) {
  state.annCounter++;
  ann.id = `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  ann.n = state.annCounter;
  state.annotations.push(ann);
  saveSession();
  renderAnnotations();
  renderPaneVisuals(paneIdx);
  if (ann.type === 'rect' && frame) {
    postShim(frame, { type: 'tweak:highlight', coords: { x: ann.x, y: ann.y, w: ann.w, h: ann.h }, annId: ann.id });
  }
}

function reapplyHighlights(layoutId, frame) {
  const sels = state.annotations
    .filter(a => a.type === 'rect' && a.layoutId === layoutId && (a.dom || []).length)
    .flatMap(a => a.dom);
  if (!sels.length) return;
  postShim(frame, { type: 'tweak:highlight', selectors: sels });
}

function renderPaneVisuals(paneIdx) {
  const wrap = state.paneStages[paneIdx]?.firstElementChild;
  if (!wrap) return;
  wrap.querySelectorAll('.annotation-pin, .annotation-rect').forEach(el => el.remove());
  const layoutId = state.paneLayouts[paneIdx];
  state.annotations.filter(a => a.layoutId === layoutId).forEach(a => {
    if (a.type === 'pin') {
      wrap.appendChild(make('div', { class: 'annotation-pin', style: { left: a.x + 'px', top: a.y + 'px' } }, String(a.n)));
    } else {
      const rect = make('div', { class: 'annotation-rect', style: { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' } });
      rect.appendChild(make('span', { class: 'annotation-rect__badge' }, String(a.n)));
      wrap.appendChild(rect);
    }
  });
}
function renderAllPaneVisuals() { for (let i = 0; i < state.viewMode; i++) renderPaneVisuals(i); }

function renderAnnotations() {
  $('#annotationCount').textContent = state.annotations.length;
  const cont = $('#annotationsContainer');
  clear(cont);
  if (!state.annotations.length) {
    cont.appendChild(make('div', { class: 'empty' }, 'Click on a layout to drop a pin · drag to mark a region.'));
    return;
  }
  const byLayout = {};
  state.annotations.forEach(a => { (byLayout[a.layoutId] ||= []).push(a); });
  for (const [lid, anns] of Object.entries(byLayout)) {
    const layout = state.layouts.find(L => L.id === lid);
    cont.appendChild(make('div', { class: 'ann-group__title' }, layout?.label || lid));
    anns.forEach(a => cont.appendChild(renderAnnItem(a)));
  }
  renderAllPaneVisuals();
}
function renderAnnItem(a) {
  const meta = a.type === 'pin'
    ? `📍 #${a.n} · pin (${Math.round(a.x)}, ${Math.round(a.y)})`
    : `▭ #${a.n} · rect (${Math.round(a.x)},${Math.round(a.y)})→(${Math.round(a.x + a.w)},${Math.round(a.y + a.h)})`;
  const text = make('textarea', { class: 'ann-item__text', rows: 2, placeholder: 'Note for this mark…' });
  text.value = a.text || '';
  text.addEventListener('input', () => { a.text = text.value; saveSession(); });
  const del = make('button', {
    class: 'ann-item__del', title: 'delete',
    onclick: () => {
      state.annotations = state.annotations.filter(x => x.id !== a.id);
      saveSession(); renderAnnotations();
      state.paneFrames.forEach((f, i) => {
        if (state.paneLayouts[i] === a.layoutId) reapplyHighlights(state.paneLayouts[i], f);
      });
    },
  }, '×');
  return make('div', { class: 'ann-item' }, [
    make('div', { class: 'ann-item__icon' + (a.type === 'pin' ? ' ann-item__icon--pin' : '') }, a.type === 'pin' ? '📍' : '▭'),
    make('div', { class: 'ann-item__body' }, [
      make('div', { class: 'ann-item__meta' }, meta),
      text,
    ]),
    del,
  ]);
}

/* ── Pane scaling ───────────────────────────────────────────────── */
function scaleAllPanes() {
  state.paneStages.forEach(stage => {
    if (!stage) return;
    const wrap = stage.firstElementChild;
    if (!wrap) return;
    const r = stage.getBoundingClientRect();
    const s = Math.min(r.width / 1920, r.height / 1080) * 0.94;
    wrap.style.transform = `translate(-50%, -50%) scale(${s})`;
  });
}
window.addEventListener('resize', () => { requestAnimationFrame(scaleAllPanes); });

/* ── Global wiring ──────────────────────────────────────────────── */
function bindGlobalEvents() {
  bindModeButtons();

  $('#inspectBtn').addEventListener('click', () => setInspectMode(!state.inspectMode));
  $('#elementPanelClose').addEventListener('click', closeElementPanel);

  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === 'tweak:highlight:result') {
      const a = state.annotations.find(x => x.id === d.annId);
      if (a) { a.dom = d.selectors || []; saveSession(); renderAnnotations(); }
    }
    if (d.type === 'tweak:element-picked') {
      // Find which pane sent this
      const paneIdx = state.paneFrames.findIndex(f => f && f.contentWindow === e.source);
      if (paneIdx >= 0) onElementPicked(paneIdx, d);
    }
  });

  $('#exportBtn').addEventListener('click', exportPrompt);
  $('#saveJsonBtn').addEventListener('click', saveJsonFile);
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all tweaks (global + per-layout) AND remove all annotations?')) return;
    state.tweakValues = { _global: {}, perLayout: {}, _scope: {} };
    state.elementOverrides = {};
    state.annotations = [];
    saveSession(); renderAll();
  });
  $('#modalClose').addEventListener('click', () => { $('#exportModal').hidden = true; });
  $('#copyAgainBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('#exportPre').textContent);
    $('#modalHint').textContent = 'Copied again ✓';
  });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === '1') setViewMode(1);
    else if (e.key === '2') setViewMode(2);
    else if (e.key === '3') setViewMode(3);
    else if (e.key === 'i' || e.key === 'I') setInspectMode(!state.inspectMode);
    else if (e.key === 'e' || e.key === 'E') exportPrompt();
    else if (e.key === 'Escape') {
      if (state.inspectMode) setInspectMode(false);
      else if (state.selectedElement) closeElementPanel();
      else $('#exportModal').hidden = true;
    }
    else if (e.key === 'ArrowRight' && state.viewMode === 1) {
      const i = state.layouts.findIndex(L => L.id === state.paneLayouts[0]);
      switchToLayout(state.layouts[(i + 1) % state.layouts.length].id);
    } else if (e.key === 'ArrowLeft' && state.viewMode === 1) {
      const i = state.layouts.findIndex(L => L.id === state.paneLayouts[0]);
      switchToLayout(state.layouts[(i - 1 + state.layouts.length) % state.layouts.length].id);
    }
  });
}

/* ── Export ─────────────────────────────────────────────────────── */
function buildPromptMarkdown() {
  const lines = [];
  lines.push(`# Design review feedback`);
  lines.push(``);
  lines.push(`_Project:_ ${state.manifest.title || 'untitled'}`);
  lines.push(`_Generated:_ ${new Date().toISOString()}`);
  lines.push(``);

  // Tweaks: global
  lines.push(`## Tweaks`);
  lines.push(``);
  const globalKeys = Object.keys(state.tweakValues._global);
  if (globalKeys.length) {
    lines.push(`### Global (apply to all layouts)`);
    globalKeys.forEach(k => {
      lines.push(`- \`${k}\`: \`${state.defaults[k]}\` → \`${state.tweakValues._global[k]}\``);
    });
    lines.push(``);
  }
  // Tweaks: per-layout
  for (const [lid, vals] of Object.entries(state.tweakValues.perLayout)) {
    const keys = Object.keys(vals);
    if (!keys.length) continue;
    const layout = state.layouts.find(L => L.id === lid);
    lines.push(`### Per-layout — ${layout?.label || lid}`);
    keys.forEach(k => {
      const def = state.defaults[k];
      lines.push(`- \`${k}\`: \`${def}\` → \`${vals[k]}\``);
    });
    lines.push(``);
  }
  if (!globalKeys.length && Object.values(state.tweakValues.perLayout).every(v => !Object.keys(v).length)) {
    lines.push(`_(no tweaks changed from default)_`);
    lines.push(``);
  }

  // Element overrides
  const elementLayouts = Object.entries(state.elementOverrides).filter(([_, sels]) => Object.keys(sels).length);
  if (elementLayouts.length) {
    lines.push(`## Element overrides`);
    elementLayouts.forEach(([lid, sels]) => {
      const layout = state.layouts.find(L => L.id === lid);
      lines.push(``);
      lines.push(`### ${layout?.label || lid}`);
      Object.entries(sels).forEach(([selector, props]) => {
        lines.push(`- **\`${selector}\`**`);
        Object.entries(props).forEach(([p, v]) => {
          lines.push(`  - \`${p}\`: \`${v}\``);
        });
      });
    });
    lines.push(``);
  }

  // Annotations
  lines.push(`## Annotations`);
  if (!state.annotations.length) {
    lines.push(`_(no annotations)_`);
  } else {
    const byLayout = {};
    state.annotations.forEach(a => { (byLayout[a.layoutId] ||= []).push(a); });
    for (const [lid, anns] of Object.entries(byLayout)) {
      const layout = state.layouts.find(L => L.id === lid);
      lines.push(``);
      lines.push(`### ${layout?.label || lid}`);
      anns.forEach(a => {
        const t = (a.text || '').trim() || '_(no note)_';
        if (a.type === 'pin') {
          lines.push(`- 📍 Pin #${a.n} at (${Math.round(a.x)}, ${Math.round(a.y)}) — ${t}`);
        } else {
          lines.push(`- ▭ Quadrant #${a.n} (${Math.round(a.x)},${Math.round(a.y)})→(${Math.round(a.x + a.w)},${Math.round(a.y + a.h)}) — ${t}`);
          if ((a.dom || []).length) lines.push(`  - DOM elements: ${a.dom.map(s => `\`${s}\``).join(', ')}`);
        }
      });
    }
  }

  lines.push(``);
  lines.push(`## Suggested next prompt`);
  lines.push(`> Apply tweaks above (respect Global vs Per-layout scope), apply element overrides as scoped CSS rules per layout, and address each annotation. For pins, treat coordinates as the focus point. For quadrants, the listed DOM elements are what to modify.`);

  return lines.join('\n');
}

async function exportPrompt() {
  const md = buildPromptMarkdown();
  $('#exportPre').textContent = md;
  $('#exportModal').hidden = false;
  $('#modalHint').textContent = 'Copied to your clipboard. Paste into your Claude conversation.';
  try { await navigator.clipboard.writeText(md); }
  catch (_) { $('#modalHint').textContent = 'Could not auto-copy — select all + copy manually.'; }
}

function saveJsonFile() {
  const data = {
    project: state.manifest.title,
    layouts: state.layouts,
    tweakValues: state.tweakValues,
    defaults: state.defaults,
    elementOverrides: state.elementOverrides,
    annotations: state.annotations,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'session.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ── Render orchestrator ────────────────────────────────────────── */
function renderAll() {
  renderTopNav();
  renderCanvas();
  renderTweaks();
  renderAnnotations();
  if (state.selectedElement) renderElementPanel(); else closeElementPanel();
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', parseInt(b.dataset.mode, 10) === state.viewMode));
}

document.addEventListener('DOMContentLoaded', boot);
})();
