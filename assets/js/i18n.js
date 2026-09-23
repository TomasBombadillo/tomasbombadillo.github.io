/* ------------------------------------------------------------------
   Tiny i18n layer (no dependencies).

   - Dictionaries live in assets/js/locales/*.js and register themselves
     on I18N.locales.<code>.
   - Static HTML is translated through data-* attributes:
       data-i18n="key"                  -> textContent
       data-i18n-html="key"             -> innerHTML (only for our own strings
                                           that contain links / <code>)
       data-i18n-placeholder="key"      -> placeholder attribute
       data-i18n-aria-label="key"       -> aria-label attribute
       data-i18n-title="key"            -> title attribute
       data-i18n-alt="key"              -> alt attribute
   - Dynamic strings in JS use t('key', { vars }).
   - To add a language: create locales/xx.js, add its <script> tag, and
     add a button with data-lang="xx" to the language toggle.
   ------------------------------------------------------------------ */

const I18N = {
  locales: {},
  lang: 'en',
  fallback: 'en',
  storageKey: 'gender-shapes-lang'
};

/* Saved choice wins; otherwise follow the browser; otherwise English. */
function detectLang() {
  try {
    const saved = localStorage.getItem(I18N.storageKey);
    if (saved && I18N.locales[saved]) return saved;
  } catch (_) { /* storage can be blocked (private mode) — ignore */ }

  const prefs = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'en'];
  for (const code of prefs) {
    const base = String(code).toLowerCase().slice(0, 2);
    if (I18N.locales[base]) return base;
  }
  return I18N.fallback;
}

/* t('key') or t('key', { name: 'Ana' }) — replaces {name} placeholders. */
function t(key, vars) {
  const dict = I18N.locales[I18N.lang] || {};
  const base = I18N.locales[I18N.fallback] || {};
  let str = key in dict ? dict[key] : (key in base ? base[key] : key);
  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
  }
  return str;
}

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  });
  root.querySelectorAll('[data-i18n-alt]').forEach(el => {
    el.setAttribute('alt', t(el.dataset.i18nAlt));
  });
}

function updateLangToggle() {
  document.querySelectorAll('[data-lang]').forEach(btn => {
    const active = btn.dataset.lang === I18N.lang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

/* Switches language, re-translates the static page and tells the rest of
   the app (via a 'langchange' event) to re-render its dynamic parts. */
function setLang(code, { persist = true } = {}) {
  if (!I18N.locales[code]) code = I18N.fallback;
  I18N.lang = code;

  if (persist) {
    try { localStorage.setItem(I18N.storageKey, code); } catch (_) { /* ignore */ }
  }

  document.documentElement.lang = code;
  document.title = t('meta.title');
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('meta.description'));

  applyTranslations();
  updateLangToggle();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
}
