# Gender Shapes — parametric gender density mapper

A small static web app that maps identity, expression, anatomy and attraction
as density fields instead of points on a line. Bilingual (ESP / ENG).

Live site: https://tomasbombadillo.github.io/

Inspired by [The Genderbread Person](https://www.itspronouncedmetrosexual.com/2018/10/the-genderbread-person-v4/)
and the [Gender Unicorn](https://transstudent.org/gender/).

## Project structure

```
.
├── index.html                # the single page; all views live here
├── .nojekyll                 # tells GitHub Pages to serve files as-is
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── img/
│   │   └── favicon.svg
│   └── js/
│       ├── i18n.js           # language detection, t(), DOM translation
│       ├── locales/
│       │   ├── en.js         # English strings (also the fallback)
│       │   └── es.js         # Spanish strings
│       ├── config.js         # Supabase connection + error messages
│       ├── engine.js         # canvas rendering (pure drawing, no page state)
│       ├── share.js          # "share this page" dialog + QR code
│       ├── app.js            # state, routing, editor, saving, world view
│       └── vendor/
│           └── qrcode.js     # qrcode-generator 2.0.4 (MIT), unmodified
└── supabase/
    └── setup.sql             # table + Row Level Security policies
```

Scripts are plain classic `<script>` tags (no build step) and **load order
matters** — it is set at the bottom of `index.html`.

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy (GitHub Pages)

Repo name `<user>.github.io` → Settings → Pages → deploy from the `main`
branch, `/ (root)`. Nothing to build.

## Languages

The UI language follows the browser the first time, then remembers the choice
made with the **ESP / ENG** toggle (stored in `localStorage`).

To change a text, edit its key in `assets/js/locales/en.js` and `es.js`.
To add a language: create `locales/xx.js`, add its `<script>` tag in
`index.html` before `config.js`, and add a `data-lang="xx"` button to the
toggle in the sidebar.

## Share / QR

The sidebar's share icon opens a dialog with a QR code of the current page
address, a **Copy link** button and a **Copy QR image** button. The QR is
generated in the browser (no external service). To force a fixed address
(e.g. while testing on localhost), set `SITE_URL` in `assets/js/config.js`.

## Backend (Supabase)

1. Create a project and run `supabase/setup.sql` in the SQL editor.
2. Put the project URL and **anon** key in `assets/js/config.js`.

The anon key is public by design; access control comes from the RLS policies.
The provided policies are deliberately open (anyone can read, insert and
update). Since the world view fetches every row's `id`, anyone could overwrite
another entry. If that matters to you, move updates behind an RPC or a secret
edit token instead of the `id`.
