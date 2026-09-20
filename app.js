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
const views = ['home', 'editor', 'lookup', 'gallery'];

function showView(name) {
  views.forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  if (name === 'editor') renderActiveView();
  if (name === 'gallery') loadGallery();
  window.scrollTo(0, 0);
}

document.getElementById('nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (btn) showView(btn.dataset.view);
});

document.querySelectorAll('.hero-card').forEach(card => {
  card.addEventListener('click', () => showView(card.dataset.view));
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
    const payload = { display_name: name, shape: buildShapePayload() };

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
  initTabs();
  renderActiveView();
}

/* ---------- Gallery ---------- */
async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '<p class="grid-msg">Loading…</p>';

  if (!supabaseClient) {
    grid.innerHTML = '<p class="grid-msg">Supabase library did not load.</p>';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('id, display_name, shape, created_at')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) throw error;

    grid.innerHTML = '';
    if (!data || data.length === 0) {
      grid.innerHTML = '<p class="grid-msg">No shapes saved yet. Be the first.</p>';
      return;
    }

    data.forEach(rec => {
      const card = document.createElement('button');
      card.className = 'gcard';
      card.type = 'button';

      const cv = document.createElement('canvas');
      cv.width = cv.height = 130;
      card.appendChild(cv);

      const nm = document.createElement('span');
      nm.className = 'gcard-name';
      nm.innerText = rec.display_name || 'Anonymous';
      card.appendChild(nm);

      const dt = document.createElement('span');
      dt.className = 'gcard-date';
      dt.innerText = rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '';
      card.appendChild(dt);

      grid.appendChild(card);
      renderCompositeThumb(cv, rec.shape);

      card.addEventListener('click', () => {
        loadRecord(rec, false);
        showView('editor');
        showToast(toastEl, `Opened ${rec.display_name || 'this'} shape as a starting point. Saving creates your own entry.`, false);
      });
    });
  } catch (err) {
    console.error('Gallery failed:', err);
    grid.innerHTML = `<p class="grid-msg">${escapeHtml(explainSupabaseError(err))}</p>`;
  }
}

/* ---------- Diagnostics ---------- */
const diagModal = document.getElementById('diagModal');
const diagOut = document.getElementById('diagOut');

document.getElementById('diagBtn').addEventListener('click', runDiagnostics);
document.getElementById('diagClose').addEventListener('click', () => diagModal.classList.add('hidden'));
diagModal.addEventListener('click', e => { if (e.target === diagModal) diagModal.classList.add('hidden'); });

async function runDiagnostics() {
  diagModal.classList.remove('hidden');
  const lines = [];
  const ok = s => `<span class="diag-ok">PASS</span>  ${s}`;
  const bad = s => `<span class="diag-bad">FAIL</span>  ${s}`;
  const paint = () => { diagOut.innerHTML = lines.join('\n'); };

  lines.push('Running…'); paint();
  lines.length = 0;

  // 1. SDK loaded?
  if (!supabaseClient) {
    lines.push(bad('Supabase SDK did not load from the CDN.'));
    paint(); return;
  }
  lines.push(ok('Supabase SDK loaded.'));
  lines.push(`       URL: ${SUPABASE_URL}`);
  lines.push(`       table: ${TABLE_NAME}`);
  paint();

  // 2. Can we read?
  try {
    const { error } = await supabaseClient.from(TABLE_NAME).select('id').limit(1);
    if (error) throw error;
    lines.push(ok('SELECT works — table exists and is readable.'));
  } catch (err) {
    lines.push(bad('SELECT failed.'));
    lines.push(`       ${explainSupabaseError(err)}`);
    lines.push(`       raw: ${err.code || '-'} ${err.message || ''}`);
  }
  paint();

  // 3. Can we write? (writes a real row, then reports its id)
  let testId = null;
  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .insert({ display_name: '__connection_test__', shape: {} })
      .select('id');
    if (error) throw error;
    if (!data || !data.length) {
      lines.push(bad('INSERT returned no row — INSERT policy exists but SELECT policy is missing.'));
    } else {
      testId = data[0].id;
      lines.push(ok(`INSERT works. Test row id: ${testId}`));
    }
  } catch (err) {
    lines.push(bad('INSERT failed.'));
    lines.push(`       ${explainSupabaseError(err)}`);
    lines.push(`       raw: ${err.code || '-'} ${err.message || ''}`);
  }
  paint();

  // 4. Can we update? A missing UPDATE policy returns success with zero rows,
  //    so editing an existing entry fails silently. This is the one that bites.
  if (testId) {
    try {
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .update({ display_name: '__connection_test_updated__' })
        .eq('id', testId)
        .select('id');
      if (error) throw error;
      if (!data || !data.length) {
        lines.push(bad('UPDATE matched zero rows — no UPDATE policy for anonymous users.'));
        lines.push('       Editing a saved shape will silently do nothing until you add one.');
      } else {
        lines.push(ok('UPDATE works — editing saved shapes will persist.'));
      }
    } catch (err) {
      lines.push(bad('UPDATE failed.'));
      lines.push(`       ${explainSupabaseError(err)}`);
    }
    paint();

    // 5. Tidy up after ourselves if DELETE is permitted
    try {
      const { error } = await supabaseClient.from(TABLE_NAME).delete().eq('id', testId);
      if (error) throw error;
      lines.push(ok('Test row cleaned up.'));
    } catch {
      lines.push(`       Note: could not auto-delete the test row (${testId}). Remove it manually.`);
    }
    paint();
  }
}

/* ---------- Boot ---------- */
appData = freshData();
initTabs();
showView('home');