/* ------------------------------------------------------------------
   App state, routing and database calls.
   ------------------------------------------------------------------ */

let currentTab = CHARACTERISTICS[0].id;   // first floor
let treeVisible = false;      // the tree only appears once a shape has been saved (or loaded)
let currentRecordId = null;   // set once saved / loaded — enables editing
let peakSeq = 1;
let appData;                  // assigned after freshData is safe to call

/* Default peak names ("Peak 3" / "Pico 3") follow the active language.
   Names the user typed themselves are never touched. */
const DEFAULT_PEAK_NAME = /^(Peak|Pico) (\d+)$/;

function localizePeakName(name) {
  const m = DEFAULT_PEAK_NAME.exec(name || '');
  return m ? `${t('peak.prefix')} ${m[2]}` : name;
}

function freshData() {
  const d = {};
  CHARACTERISTICS.forEach(c => {
    d[c.id] = [{ id: `p${peakSeq++}`, name: `${t('peak.prefix')} 1`, masc: 80, fem: 20, otro: 10, freq: 100 }];
  });
  return d;
}

/* ---------- Routing ---------- */
const views = ['home', 'editor', 'lookup', 'world', 'forest', 'inspiration'];

const sidebarEl    = document.getElementById('sidebar');
const sidebarOpen  = document.getElementById('sidebarOpen');
const sidebarClose = document.getElementById('sidebarClose');
const sidebarScrim = document.getElementById('sidebarScrim');
let immersive = false;        // The world / The forest: full-screen views with a drawer menu

/* The world and forest views are immersive and full-screen, so there the sidebar becomes
   an overlay drawer: closed by default, opened with the ☰ button, closed with
   the ✕ inside the drawer (or the backdrop / Esc key).
   In every other view the sidebar is just a normal column. */
function setSidebarOpen(open) {
  sidebarEl.classList.toggle('hidden', immersive && !open);
  sidebarScrim.classList.toggle('hidden', !(immersive && open));
  sidebarOpen.classList.toggle('hidden', !(immersive && !open));
}

function setImmersive(on) {
  immersive = on;
  sidebarEl.classList.toggle('is-overlay', on);
  setSidebarOpen(!on);
}

function showView(name) {
  views.forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });

  setImmersive(name === 'world' || name === 'forest');

  if (name === 'editor') renderActiveView();
  if (name === 'world') loadWorld();
  if (name === 'forest') openForest(); else Forest.stop();
  window.scrollTo(0, 0);
}

sidebarOpen.addEventListener('click', () => {
  setSidebarOpen(true);
  sidebarClose.focus();
});

function closeDrawer() {
  setSidebarOpen(false);
  sidebarOpen.focus();
}
sidebarClose.addEventListener('click', closeDrawer);
sidebarScrim.addEventListener('click', closeDrawer);

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !immersive) return;
  if (document.querySelector('dialog[open]')) return;        // the share dialog handles its own Esc
  if (!sidebarEl.classList.contains('hidden')) closeDrawer();
});

// One delegated listener for every element that navigates (sidebar items,
// home cards, inline "more on that" links) — it survives re-translation,
// which replaces the inner HTML of some of those elements.
document.addEventListener('click', e => {
  const el = e.target.closest('[data-view]');
  if (el) showView(el.dataset.view);
});

document.getElementById('startBtn').addEventListener('click', () => showView('editor'));

/* ---------- Language toggle ---------- */
document.querySelectorAll('[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.lang !== I18N.lang) setLang(btn.dataset.lang);
  });
});

// Static text was already re-translated by setLang(); this re-renders
// everything that JavaScript builds on its own.
document.addEventListener('langchange', () => {
  if (!appData) return;   // first call, before boot has finished

  CHARACTERISTICS.forEach(c => {
    appData[c.id].forEach(p => { p.name = localizePeakName(p.name); });
  });
  initTabs();
  renderActiveView();
  if (currentRecordId) showIdBanner(currentRecordId);
  renderWorldChrome();
  renderWorldCanvases();
  renderForestChrome();
});

/* ---------- Editor UI ---------- */
function tabIndex(id) {
  return CHARACTERISTICS.findIndex(c => c.id === id);
}

function initTabs() {
  const tabsContainer = document.getElementById('dimTabs');
  tabsContainer.innerHTML = '';
  CHARACTERISTICS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = `dim-tab ${c.id === currentTab ? 'active' : ''}`;
    btn.innerText = t(`char.${c.id}.title`);
    btn.onclick = () => {
      // The floor we're leaving takes its snapshot now — the tree never
      // follows the sliders live, only when you move on to another dimension.
      if (treeVisible) TreeView.commitFloor(tabIndex(currentTab), appData[currentTab]);
      currentTab = c.id;
      initTabs();
      renderActiveView(true);
    };
    tabsContainer.appendChild(btn);
  });
}

/* Puts the tree panel into its slot, or hides the slot while there's no tree yet. */
function mountTree(animate) {
  const slot = document.getElementById('treeSlot');
  if (!slot) return;
  TreeView.detach();
  const ok = treeVisible && TreeView.attach(slot);
  slot.classList.toggle('hidden', !ok);
  if (ok) TreeView.setActive(tabIndex(currentTab), animate);   // highlight this dimension's floor
}

/* animate=true only when arriving via a tab click (the highlight glides to
   the new floor); every other re-render just shows the current floor. */
function renderActiveView(animate = false) {
  TreeView.detach();   // the panel lives in the DOM we're about to replace
  const container = document.getElementById('activeCharCard');
  container.innerHTML = `
    <div class="char-card">
      <div class="char-card-header">
        <h2>${escapeHtml(t(`char.${currentTab}.title`))}</h2>
        <p>${escapeHtml(t(`char.${currentTab}.desc`))}</p>
      </div>
      <div class="char-body">
        <div class="chart-panel">
          <canvas id="mainCanvas" width="320" height="320"></canvas>
        </div>
        <div class="chart-panel tree-slot hidden" id="treeSlot"></div>
      </div>
      <div class="peaks-row" id="peaks-list"></div>
    </div>
  `;
  renderPeaksList();
  draw();
  mountTree(animate);
}

function draw() {
  renderShape(document.getElementById('mainCanvas'), appData[currentTab]);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderPeaksList() {
  const listContainer = document.getElementById('peaks-list');
  const keepScroll = listContainer.scrollLeft;   // rebuilding must not jump the row back to the start
  listContainer.innerHTML = '';
  const peaks = appData[currentTab];

  peaks.forEach(st => {
    const peakCard = document.createElement('div');
    peakCard.className = 'peak-card';
    peakCard.innerHTML = `
      <div class="peak-card-header">
        <input type="text" class="peak-name-input" value="${escapeHtml(st.name)}"
               oninput="updatePeakName('${st.id}', this.value)">
        ${peaks.length > 1 ? `<button class="btn-remove" onclick="removePeak('${st.id}')">${escapeHtml(t('peak.remove'))}</button>` : ''}
      </div>
      ${sliderRow(st, 'freq', t('peak.weight'), 'dot-freq', true)}
      ${sliderRow(st, 'masc', t('peak.masc'), 'dot-masc')}
      ${sliderRow(st, 'fem', t('peak.fem'), 'dot-fem')}
      ${sliderRow(st, 'otro', t('peak.other'), 'dot-otro')}
    `;
    listContainer.appendChild(peakCard);
  });

  // New peaks appear to the right of the existing ones, so the "add" tile
  // is simply the last item in the row.
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'btn-add-peak';
  add.textContent = t('peak.add');
  add.onclick = () => addPeak();
  listContainer.appendChild(add);

  listContainer.scrollLeft = keepScroll;
}

function sliderRow(st, key, label, dotClass, isPct) {
  return `
    <div class="slider-row">
      <label><span class="dot ${dotClass}"></span> ${escapeHtml(label)}</label>
      <input type="range" min="0" max="100" value="${st[key]}"
             oninput="updatePeakSlider('${st.id}', '${key}', this)">
      <span class="val-display" id="val-${st.id}-${key}">${st[key]}${isPct ? '%' : ''}</span>
    </div>`;
}

window.updatePeakSlider = function (peakId, key, inputEl) {
  const peaks = appData[currentTab];
  const item = peaks.find(p => p.id === peakId);
  if (!item) return;

  let val = parseInt(inputEl.value, 10);
  if (key === 'freq') {
    const otherSum = peaks.filter(p => p.id !== peakId).reduce((a, p) => a + p.freq, 0);
    const maxAllowed = Math.max(0, 100 - otherSum);
    if (val > maxAllowed) { val = maxAllowed; inputEl.value = val; }
  }
  item[key] = val;
  const label = document.getElementById(`val-${peakId}-${key}`);
  if (label) label.innerText = key === 'freq' ? `${val}%` : val;
  draw();
};

window.updatePeakName = function (peakId, nameVal) {
  const item = appData[currentTab].find(p => p.id === peakId);
  if (item) item.name = nameVal;
};

window.addPeak = function () {
  const peaks = appData[currentTab];
  const currentSum = peaks.reduce((a, p) => a + p.freq, 0);
  peaks.push({
    id: `p${peakSeq++}`,
    name: `${t('peak.prefix')} ${peaks.length + 1}`,
    masc: 50, fem: 50, otro: 10,
    freq: Math.max(0, 100 - currentSum)
  });
  renderPeaksList();
  draw();
  const row = document.getElementById('peaks-list');
  row.scrollTo({ left: row.scrollWidth, behavior: 'smooth' });   // bring the new peak into view
};

window.removePeak = function (peakId) {
  appData[currentTab] = appData[currentTab].filter(p => p.id !== peakId);
  renderPeaksList();
  draw();
};

/* ---------- Toasts ---------- */
function showToast(el, message, isError) {
  el.innerText = message;
  el.style.background = isError ? '#fee2e2' : '#d1fae5';
  el.style.color = isError ? '#991b1b' : '#065f46';
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 6000);
}

/* ---------- Save ---------- */
function buildShapePayload() {
  const shape = {};
  CHARACTERISTICS.forEach(c => {
    shape[c.id] = (appData[c.id] || []).map(p => ({
      name: p.name, masc: p.masc, fem: p.fem, otro: p.otro, freq: p.freq
    }));
  });
  return shape;
}

/* The banner doubles as the mode indicator: if it's showing, the next save
   is an UPDATE to that id, not a new row. Without this the two are invisible. */
function showIdBanner(id) {
  const banner = document.getElementById('idBanner');
  banner.innerHTML = `
    <div class="banner-line">
      <strong>${escapeHtml(t('banner.editing'))}</strong>
      ${escapeHtml(t('banner.overwrite'))}
    </div>
    <div class="banner-line">
      <span>${escapeHtml(t('banner.id'))}</span> <code>${escapeHtml(id)}</code>
      <button class="link-btn" id="copyIdBtn" type="button">${escapeHtml(t('banner.copy'))}</button>
      <button class="link-btn" id="newShapeBtn" type="button">${escapeHtml(t('banner.newShape'))}</button>
    </div>`;
  banner.classList.remove('hidden');

  document.getElementById('copyIdBtn').onclick = () => {
    navigator.clipboard?.writeText(id);
    document.getElementById('copyIdBtn').innerText = t('banner.copied');
  };
  document.getElementById('newShapeBtn').onclick = clearEditMode;
}

function clearEditMode() {
  currentRecordId = null;
  document.getElementById('idBanner').classList.add('hidden');
  document.getElementById('nameVisibleInput').checked = true;
  treeVisible = false;          // a new shape: no tree until it is saved
  mountTree(false);
  showToast(toastEl, t('toast.newMode'), false);
}

const saveBtn = document.getElementById('saveBtn');
const toastEl = document.getElementById('toast');

saveBtn.addEventListener('click', async () => {
  const name = document.getElementById('displayNameInput').value.trim();
  if (!name) {
    showToast(toastEl, t('toast.needName'), true);
    document.getElementById('displayNameInput').focus();
    return;
  }
  if (!supabaseClient) {
    showToast(toastEl, t('toast.noLibSave'), true);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerText = t('editor.saving');

  const isUpdate = !!currentRecordId;

  try {
    const payload = {
      display_name: name,
      shape: buildShapePayload(),
      name_visible: document.getElementById('nameVisibleInput').checked
    };

    const result = isUpdate
      ? await supabaseClient.from(TABLE_NAME).update(payload).eq('id', currentRecordId).select('id')
      : await supabaseClient.from(TABLE_NAME).insert(payload).select('id');

    if (result.error) throw result.error;

    // No error + no rows is RLS filtering, not success. The cause differs by path.
    if (!result.data || result.data.length === 0) {
      throw new Error(isUpdate ? t('toast.updateZero') : t('toast.noReadback'));
    }

    currentRecordId = result.data[0].id;
    showIdBanner(currentRecordId);
    // The tree appears (or updates) now: every floor takes its snapshot from what was saved.
    treeVisible = true;
    TreeView.setShape(appData);
    mountTree(false);
    showToast(toastEl, isUpdate ? t('toast.updated') : t('toast.saved'), false);
  } catch (err) {
    console.error('Save failed:', err);
    showToast(toastEl, explainSupabaseError(err), true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = t('editor.save');
  }
});

/* ---------- Load by ID ---------- */
const lookupMsg = document.getElementById('lookupMsg');

document.getElementById('loadBtn').addEventListener('click', async () => {
  const id = document.getElementById('uuidInput').value.trim();
  if (!id) { showToast(lookupMsg, t('toast.pasteId'), true); return; }
  if (!supabaseClient) { showToast(lookupMsg, t('toast.noLib'), true); return; }

  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME).select('id, display_name, shape, name_visible').eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) { showToast(lookupMsg, t('toast.notFound'), true); return; }

    loadRecord(data, true);
    showView('editor');
    showToast(toastEl, t('toast.loaded', { name: data.display_name }), false);
  } catch (err) {
    console.error('Lookup failed:', err);
    showToast(lookupMsg, explainSupabaseError(err), true);
  }
});

/* editable=true only when the user proved they hold the ID (Find by ID).
   Browsing the gallery loads the shape as a starting point for a NEW entry. */
function loadRecord(record, editable) {
  currentRecordId = editable ? record.id : null;
  document.getElementById('displayNameInput').value = editable ? (record.display_name || '') : '';
  appData = freshData();
  CHARACTERISTICS.forEach(c => {
    const peaks = record.shape?.[c.id];
    if (Array.isArray(peaks) && peaks.length) {
      appData[c.id] = peaks.map(p => ({ ...p, name: localizePeakName(p.name), id: `p${peakSeq++}` }));
    }
  });
  if (editable) showIdBanner(record.id);
  else document.getElementById('idBanner').classList.add('hidden');
  // editable: reflect what's actually stored (missing/undefined = visible, matching the DB default).
  // not editable: this is a fresh entry being started, so default to visible regardless of the source shape.
  document.getElementById('nameVisibleInput').checked = editable ? (record.name_visible !== false) : true;
  // A stored shape is shown whole: the tree grows every floor straight away.
  treeVisible = true;
  TreeView.setShape(appData);
  initTabs();
  renderActiveView();
}

/* ---------- The world ---------- */
const ID_DIMS = ['identity', 'expression'];
const AT_DIMS = ['sexual', 'romantic'];
let worldRecords = [];
let worldStatus = 'idle';     // idle | loading | nolib | error | ready
let worldError = null;

async function loadWorld() {
  worldStatus = 'loading';
  worldError = null;
  renderWorldChrome();

  if (!supabaseClient) {
    worldStatus = 'nolib';
    renderWorldChrome();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('id, display_name, shape, name_visible')
      .limit(500);

    if (error) throw error;
    worldRecords = data || [];
    worldStatus = 'ready';
  } catch (err) {
    console.error('World view failed:', err);
    worldError = err;
    worldStatus = 'error';
  }

  renderWorldChrome();
  if (worldStatus === 'ready') renderWorldCanvases();
}

/* Everything textual in the world view, derived from state so it can be
   re-rendered when the language changes without hitting the database. */
function renderWorldChrome() {
  const countEl = document.getElementById('worldCount');
  const msg = document.getElementById('worldMsg');
  const n = worldStatus === 'ready' ? worldRecords.length : 0;

  countEl.textContent = t(n === 1 ? 'world.count.one' : 'world.count.other', { n });

  let text = '';
  if (worldStatus === 'loading') text = t('world.loading');
  else if (worldStatus === 'nolib') text = t('toast.noLib');
  else if (worldStatus === 'error') text = explainSupabaseError(worldError);
  else if (worldStatus === 'ready' && n === 0) text = t('world.empty');

  msg.textContent = text;
  msg.classList.toggle('hidden', !text);

  if (worldStatus === 'loading') document.getElementById('worldNames').innerHTML = '';
  else renderWorldNames();
}

function renderWorldCanvases() {
  if (worldStatus !== 'ready') return;
  renderPooledView(document.getElementById('worldIdentitiesBase'), worldRecords, ID_DIMS, VIRIDIS);
  renderPooledView(document.getElementById('worldAttractionsBase'), worldRecords, AT_DIMS, INFERNO);
}

function renderWorldNames() {
  const namesEl = document.getElementById('worldNames');
  namesEl.innerHTML = '';

  if (worldStatus !== 'ready') return;

  if (worldRecords.length === 0) {
    namesEl.innerHTML = `<p class="world-empty">${escapeHtml(t('world.noOne'))}</p>`;
    return;
  }

  // Hidden-name people still fully count toward the pooled graphs (see
  // loadWorld) — this only controls whether they're listed here.
  const visible = worldRecords
    .map((rec, i) => ({ rec, i }))
    .filter(({ rec }) => rec.name_visible !== false);

  if (visible.length === 0) {
    namesEl.innerHTML = `<p class="world-empty">${escapeHtml(t('world.allHidden'))}</p>`;
    return;
  }

  visible.forEach(({ rec, i }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'world-name-item';
    item.dataset.idx = i;
    item.textContent = rec.display_name || t('world.anonymous');
    namesEl.appendChild(item);
  });
}

function highlightWorldUser(rec) {
  document.getElementById('worldIdentitiesBase').style.opacity = '0.22';
  document.getElementById('worldAttractionsBase').style.opacity = '0.22';

  const idOverlay = document.getElementById('worldIdentitiesOverlay');
  const atOverlay = document.getElementById('worldAttractionsOverlay');

  renderShape(idOverlay, personPool(rec, ID_DIMS), { labels: false, grid: false, palette: VIRIDIS });
  renderShape(atOverlay, personPool(rec, AT_DIMS), { labels: false, grid: false, palette: INFERNO });

  // The pixels are drawn instantly; fading the canvas element's own opacity
  // in (see .canvas-stack canvas:last-child in styles.css) is what makes it
  // bloom in gently instead of popping into view.
  idOverlay.style.opacity = '1';
  atOverlay.style.opacity = '1';
}

function clearWorldHighlight() {
  document.getElementById('worldIdentitiesBase').style.opacity = '1';
  document.getElementById('worldAttractionsBase').style.opacity = '1';
  document.getElementById('worldIdentitiesOverlay').style.opacity = '0';
  document.getElementById('worldAttractionsOverlay').style.opacity = '0';
}

const worldNamesEl = document.getElementById('worldNames');

worldNamesEl.addEventListener('mouseover', e => {
  const item = e.target.closest('.world-name-item');
  if (!item) return;
  const rec = worldRecords[Number(item.dataset.idx)];
  if (rec) highlightWorldUser(rec);
});

worldNamesEl.addEventListener('mouseout', e => {
  const item = e.target.closest('.world-name-item');
  if (!item) return;
  if (item.contains(e.relatedTarget)) return; // still inside the same item
  clearWorldHighlight();
});

worldNamesEl.addEventListener('click', e => {
  const item = e.target.closest('.world-name-item');
  if (!item) return;
  const rec = worldRecords[Number(item.dataset.idx)];
  if (!rec) return;
  clearWorldHighlight();
  loadRecord(rec, false);
  showView('editor');
  showToast(
    toastEl,
    rec.display_name
      ? t('toast.openedNamed', { name: rec.display_name })
      : t('toast.openedUnnamed'),
    false
  );
});

/* ---------- The forest ---------- */
const forestCanvas = document.getElementById('forestCanvas');
let forestRecords = [];
let forestStatus = 'idle';      // idle | loading | nolib | nowebgl | error | ready
let forestError = null;

/* Opens the view: starts drawing, then (re)loads the trees. */
function openForest() {
  if (!Forest.start(forestCanvas)) forestStatus = 'nowebgl';
  loadForest();
}

async function loadForest() {
  if (forestStatus === 'nowebgl') { renderForestChrome(); return; }
  forestStatus = 'loading';
  forestError = null;
  renderForestChrome();

  if (!supabaseClient) { forestStatus = 'nolib'; renderForestChrome(); return; }

  try {
    // Oldest first: the forest grows outwards and nobody's tree ever moves.
    const columns = 'id, display_name, shape, name_visible';
    let res = await supabaseClient.from(TABLE_NAME).select(columns).order('created_at', { ascending: true }).limit(500);
    if (res.error && (res.error.code === '42703' || /created_at/i.test(res.error.message || ''))) {
      // The table has no created_at column yet (see supabase/setup.sql): fall back to id order.
      res = await supabaseClient.from(TABLE_NAME).select(columns).order('id', { ascending: true }).limit(500);
    }
    if (res.error) throw res.error;
    forestRecords = res.data || [];
    forestStatus = 'ready';
  } catch (err) {
    console.error('Forest view failed:', err);
    forestError = err;
    forestStatus = 'error';
  }

  renderForestChrome();
  if (forestStatus === 'ready') Forest.setRecords(forestRecords.map(r => ({ id: r.id, shape: r.shape })));
}

/* Title count, messages and names — derived from state so a language switch
   can redraw them without asking the database again. */
function renderForestChrome() {
  const n = forestStatus === 'ready' ? forestRecords.length : 0;
  document.getElementById('forestCount').textContent =
    t(n === 1 ? 'forest.count.one' : 'forest.count.other', { n });

  let text = '';
  if (forestStatus === 'loading') text = t('forest.loading');
  else if (forestStatus === 'nolib') text = t('toast.noLib');
  else if (forestStatus === 'nowebgl') text = t('forest.noWebgl');
  else if (forestStatus === 'error') text = explainSupabaseError(forestError);
  else if (forestStatus === 'ready' && n === 0) text = t('forest.empty');
  const msg = document.getElementById('forestMsg');
  msg.textContent = text;
  msg.classList.toggle('hidden', !text);

  const namesEl = document.getElementById('forestNames');
  namesEl.innerHTML = '';
  if (forestStatus !== 'ready' || n === 0) return;

  // Trees whose owner hid their name are still in the forest — they just aren't listed.
  const visible = forestRecords.map((rec, i) => ({ rec, i })).filter(({ rec }) => rec.name_visible !== false);
  if (visible.length === 0) {
    namesEl.innerHTML = `<p class="world-empty">${escapeHtml(t('world.allHidden'))}</p>`;
    return;
  }
  visible.forEach(({ rec, i }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'world-name-item';
    item.dataset.idx = i;
    item.textContent = rec.display_name || t('world.anonymous');
    namesEl.appendChild(item);
  });
}

const forestNamesEl = document.getElementById('forestNames');
const forestRecOf = e => {
  const item = e.target.closest('.world-name-item');
  return item ? { item, rec: forestRecords[Number(item.dataset.idx)] } : null;
};

// Hover (or keyboard focus) a name: every other tree dims, that tree comes forward.
forestNamesEl.addEventListener('mouseover', e => {
  const hit = forestRecOf(e);
  if (hit && hit.rec) Forest.highlight(hit.rec.id);
});
forestNamesEl.addEventListener('mouseout', e => {
  const hit = forestRecOf(e);
  if (!hit || hit.item.contains(e.relatedTarget)) return;
  Forest.highlight(null);
});
forestNamesEl.addEventListener('focusin', e => {
  const hit = forestRecOf(e);
  if (hit && hit.rec) Forest.highlight(hit.rec.id);
});
forestNamesEl.addEventListener('focusout', () => Forest.highlight(null));

// Click: open that person's shape (and tree) as a starting point — same as in The world.
forestNamesEl.addEventListener('click', e => {
  const hit = forestRecOf(e);
  if (!hit || !hit.rec) return;
  Forest.highlight(null);
  loadRecord(hit.rec, false);
  showView('editor');
  showToast(
    toastEl,
    hit.rec.display_name
      ? t('toast.openedNamed', { name: hit.rec.display_name })
      : t('toast.openedUnnamed'),
    false
  );
});

/* ---------- Boot ---------- */
setLang(detectLang(), { persist: false });   // before freshData(): default peak names need the language
appData = freshData();
initTabs();
showView('home');
