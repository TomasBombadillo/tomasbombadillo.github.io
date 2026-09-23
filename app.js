/* ------------------------------------------------------------------
   App state, routing and database calls.
   ------------------------------------------------------------------ */

let currentTab = 'identity';
let currentRecordId = null;   // set once saved / loaded — enables editing
let peakSeq = 1;
let appData;                  // assigned after freshData is safe to call

function freshData() {
  const d = {};
  CHARACTERISTICS.forEach(c => {
    d[c.id] = [{ id: `p${peakSeq++}`, name: 'Peak 1', masc: 80, fem: 20, otro: 10, freq: 100 }];
  });
  return d;
}

/* ---------- Routing ---------- */
const views = ['home', 'editor', 'lookup', 'world', 'inspiration'];

function showView(name) {
  views.forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });

  // The world view is an immersive full-screen take with no sidebar —
  // hide it and surface a small button to bring it back.
  const isWorld = name === 'world';
  const sidebarToggle = document.getElementById('sidebarToggle');
  document.querySelector('.sidebar').classList.toggle('hidden', isWorld);
  sidebarToggle.classList.toggle('hidden', !isWorld);
  if (isWorld) {
    // Always start closed when (re-)entering, regardless of how a previous visit was left.
    sidebarToggle.textContent = '☰';
    sidebarToggle.setAttribute('aria-label', 'Show menu');
  }

  if (name === 'editor') renderActiveView();
  if (name === 'world') loadWorld();
  window.scrollTo(0, 0);
}

// A real open/close toggle, not a one-way reveal — otherwise there's no way
// back to the immersive view short of leaving and re-entering it.
document.getElementById('sidebarToggle').addEventListener('click', () => {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const nowHidden = sidebar.classList.toggle('hidden');
  toggle.textContent = nowHidden ? '☰' : '✕';
  toggle.setAttribute('aria-label', nowHidden ? 'Show menu' : 'Hide menu');
});

document.getElementById('nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (btn) showView(btn.dataset.view);
});

document.querySelectorAll('.hero-card, .view-link').forEach(el => {
  el.addEventListener('click', () => showView(el.dataset.view));
});

document.getElementById('startBtn').addEventListener('click', () => showView('editor'));

/* ---------- Editor UI ---------- */
function initTabs() {
  const tabsContainer = document.getElementById('dimTabs');
  tabsContainer.innerHTML = '';
  CHARACTERISTICS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = `dim-tab ${c.id === currentTab ? 'active' : ''}`;
    btn.innerText = c.title;
    btn.onclick = () => { currentTab = c.id; initTabs(); renderActiveView(); };
    tabsContainer.appendChild(btn);
  });
}

function renderActiveView() {
  const container = document.getElementById('activeCharCard');
  const char = CHARACTERISTICS.find(c => c.id === currentTab);
  container.innerHTML = `
    <div class="char-card">
      <div class="char-card-header">
        <h2>${char.title}</h2>
        <p>${char.desc}</p>
      </div>
      <div class="char-body">
        <div class="chart-panel">
          <canvas id="mainCanvas" width="320" height="320"></canvas>
        </div>
        <div class="controls-panel">
          <div id="peaks-list"></div>
          <button class="btn-add-peak" onclick="addPeak()">+ Add Peak</button>
        </div>
      </div>
    </div>
  `;
  renderPeaksList();
  draw();
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
  listContainer.innerHTML = '';
  const peaks = appData[currentTab];

  peaks.forEach(st => {
    const peakCard = document.createElement('div');
    peakCard.className = 'peak-card';
    peakCard.innerHTML = `
      <div class="peak-card-header">
        <input type="text" class="peak-name-input" value="${escapeHtml(st.name)}"
               oninput="updatePeakName('${st.id}', this.value)">
        ${peaks.length > 1 ? `<button class="btn-remove" onclick="removePeak('${st.id}')">Remove</button>` : ''}
      </div>
      ${sliderRow(st, 'freq', 'Weight / Time', 'dot-freq', true)}
      ${sliderRow(st, 'masc', 'Masculine', 'dot-masc')}
      ${sliderRow(st, 'fem', 'Feminine', 'dot-fem')}
      ${sliderRow(st, 'otro', 'Other', 'dot-otro')}
    `;
    listContainer.appendChild(peakCard);
  });
}

function sliderRow(st, key, label, dotClass, isPct) {
  return `
    <div class="slider-row">
      <label><span class="dot ${dotClass}"></span> ${label}</label>
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
    name: `Peak ${peaks.length + 1}`,
    masc: 50, fem: 50, otro: 10,
    freq: Math.max(0, 100 - currentSum)
  });
  renderPeaksList();
  draw();
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
      <strong>Editing an existing entry.</strong>
      Saving will overwrite it.
    </div>
    <div class="banner-line">
      <span>ID:</span> <code>${escapeHtml(id)}</code>
      <button class="link-btn" id="copyIdBtn" type="button">copy</button>
      <button class="link-btn" id="newShapeBtn" type="button">start a new shape instead</button>
    </div>`;
  banner.classList.remove('hidden');

  document.getElementById('copyIdBtn').onclick = () => {
    navigator.clipboard?.writeText(id);
    document.getElementById('copyIdBtn').innerText = 'copied';
  };
  document.getElementById('newShapeBtn').onclick = clearEditMode;
}

function clearEditMode() {
  currentRecordId = null;
  document.getElementById('idBanner').classList.add('hidden');
  document.getElementById('nameVisibleInput').checked = true;
  showToast(toastEl, 'Now creating a new entry. Saving will not touch the old one.', false);
}

const saveBtn = document.getElementById('saveBtn');
const toastEl = document.getElementById('toast');

saveBtn.addEventListener('click', async () => {
  const name = document.getElementById('displayNameInput').value.trim();
  if (!name) {
    showToast(toastEl, 'Please enter a display name first.', true);
    document.getElementById('displayNameInput').focus();
    return;
  }
  if (!supabaseClient) {
    showToast(toastEl, 'Supabase library did not load. Check your connection and reload.', true);
    return;
  }

  saveBtn.disabled = true;
  const label = saveBtn.innerText;
  saveBtn.innerText = 'Saving…';

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
      if (isUpdate) {
        throw new Error(
          'Update matched zero rows — nothing was written. The table is missing an UPDATE policy for anonymous users (see setup.sql). Use "Save as new" below to store this as a fresh entry instead.'
        );
      }
      throw new Error(
        'The row was written but could not be read back. Add a SELECT policy for anonymous users so the app can return your ID.'
      );
    }

    currentRecordId = result.data[0].id;
    showIdBanner(currentRecordId);
    showToast(toastEl, isUpdate ? 'Updated your existing shape.' : 'Saved. Your shape is now in the gallery.', false);
  } catch (err) {
    console.error('Save failed:', err);
    showToast(toastEl, explainSupabaseError(err), true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = label;
  }
});

/* ---------- Load by ID ---------- */
const lookupMsg = document.getElementById('lookupMsg');

document.getElementById('loadBtn').addEventListener('click', async () => {
  const id = document.getElementById('uuidInput').value.trim();
  if (!id) { showToast(lookupMsg, 'Paste an ID first.', true); return; }
  if (!supabaseClient) { showToast(lookupMsg, 'Supabase library did not load.', true); return; }

  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME).select('id, display_name, shape').eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) { showToast(lookupMsg, 'No shape found with that ID.', true); return; }

    loadRecord(data, true);
    showView('editor');
    showToast(toastEl, `Loaded ${data.display_name}'s shape. Saving will update it.`, false);
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
      appData[c.id] = peaks.map(p => ({ ...p, id: `p${peakSeq++}` }));
    }
  });
  if (editable) showIdBanner(record.id);
  else document.getElementById('idBanner').classList.add('hidden');
  // editable: reflect what's actually stored (missing/undefined = visible, matching the DB default).
  // not editable: this is a fresh entry being started, so default to visible regardless of the source shape.
  document.getElementById('nameVisibleInput').checked = editable ? (record.name_visible !== false) : true;
  initTabs();
  renderActiveView();
}

/* ---------- The world ---------- */
const ID_DIMS = ['identity', 'expression'];
const AT_DIMS = ['sexual', 'romantic'];
let worldRecords = [];

async function loadWorld() {
  const idBase = document.getElementById('worldIdentitiesBase');
  const atBase = document.getElementById('worldAttractionsBase');
  const msg = document.getElementById('worldMsg');
  const countEl = document.getElementById('worldCount');
  const namesEl = document.getElementById('worldNames');

  msg.textContent = 'Loading…';
  msg.classList.remove('hidden');
  namesEl.innerHTML = '';

  if (!supabaseClient) {
    msg.textContent = 'Supabase library did not load.';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('id, display_name, shape, name_visible')
      .limit(500);

    if (error) throw error;
    worldRecords = data || [];

    countEl.textContent = worldRecords.length;
    if (worldRecords.length === 0) {
      msg.textContent = 'No shapes saved yet. Be the first.';
      msg.classList.remove('hidden');
    } else {
      msg.classList.add('hidden');
    }

    renderPooledView(idBase, worldRecords, ID_DIMS, VIRIDIS);
    renderPooledView(atBase, worldRecords, AT_DIMS, INFERNO);
    renderWorldNames();
  } catch (err) {
    console.error('World view failed:', err);
    msg.textContent = explainSupabaseError(err);
    msg.classList.remove('hidden');
  }
}

function renderWorldNames() {
  const namesEl = document.getElementById('worldNames');
  namesEl.innerHTML = '';

  if (worldRecords.length === 0) {
    namesEl.innerHTML = '<p class="world-empty">No one yet.</p>';
    return;
  }

  // Hidden-name people still fully count toward the pooled graphs (see
  // loadWorld) — this only controls whether they're listed here.
  const visible = worldRecords
    .map((rec, i) => ({ rec, i }))
    .filter(({ rec }) => rec.name_visible !== false);

  if (visible.length === 0) {
    namesEl.innerHTML = '<p class="world-empty">Everyone here has chosen to stay unnamed.</p>';
    return;
  }

  visible.forEach(({ rec, i }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'world-name-item';
    item.dataset.idx = i;
    item.textContent = rec.display_name || 'Anonymous';
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
  showToast(toastEl, `Opened ${rec.display_name || 'this'} shape as a starting point. Saving creates your own entry.`, false);
});

/* ---------- Boot ---------- */
appData = freshData();
initTabs();
showView('home');