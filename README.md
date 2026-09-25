# Gender Shapes — parametric gender density mapper

A small static web app that maps identity, expression, anatomy and attraction
as density fields instead of points on a line. Bilingual (ESP / ENG).

Live site: https://tomasbombadillo.github.io/

A tree grows out of every shape you save, and all the trees make up a forest.

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
│   │   └── favicon.svg   # the tree: three colour-mixed leaves + trunk + floor-1 ring
│   └── js/
│       ├── i18n.js           # language detection, t(), DOM translation
│       ├── locales/
│       │   ├── en.js         # English strings (also the fallback)
│       │   └── es.js         # Spanish strings
│       ├── config.js         # Supabase connection + error messages
│       ├── engine.js         # heatmap canvas + the ORDER of the dimensions
│       ├── tree/
│       │   ├── model.js          # pure math: peaks → branches, colours, trunk
│       │   ├── geometry.js       # three.js geometry: branches, leaves, base, glass
│       │   ├── editor-view.js    # the tree beside the canvas (rotate, dim, grow)
│       │   └── forest-view.js    # "The forest": every saved tree in one scene
│       ├── share.js          # "share this page" dialog + QR code
│       ├── app.js            # state, routing, editor, saving, world, forest
│       └── vendor/
│           ├── qrcode.js         # qrcode-generator (MIT), unmodified
│           ├── three.custom.min.js   # trimmed three.js build (MIT), see below
│           └── three-entry.js    # the list of three.js parts that bundle contains
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

## The tree

Saving a shape grows a low-poly tree inside a glass cylinder (printed with
small butterflies). Every dimension is one floor, in this order, bottom → top
(the same order as the editor tabs, left → right):

1. Anatomical sex · 2. Gender identity · 3. Gender expression ·
4. Romantic attraction · 5. Sexual attraction

The order lives in one place: `CHARACTERISTICS` in `assets/js/engine.js`.

How the numbers become a tree (all in `assets/js/tree/model.js`, which has no
DOM or three.js in it, so it can be tested in Node):

| Data                          | Becomes                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| a peak's masc / fem / other   | the **direction** of its branch (same vector as the heatmap)   |
| its highest of the three      | the branch **length**                                          |
| its weight                    | the leaf sphere's **area** (radius ∝ √weight) and limb thickness |
| masc / fem / other proportions | the sphere's **colour**, mixed in OKLab from blue / pink / green |
| the floor's peaks             | trunk position: floor 1 on the axis, every other floor leans to the weighted centre of mass |
| peaks that point the same way, or whose spheres overlap | one shared limb that forks near the end |

Tunable constants (reach, trunk lean, sphere size, floor spacing…) are at the
top of `model.js`. Colours: `BASE_COLORS`.

Editor behaviour:

- **No tree while you create a shape for the first time.** It appears when you
  press *Save results* (or straight away when you load a stored shape).
- The circle canvas follows the sliders live; the tree does **not**. A floor's
  branches only grow (or regrow) when you leave its tab, or on save.
- The floor being edited is solid, the others fade, and the highlight glides
  between floors. The two arrows under the tree rotate it (tap = 45°, hold =
  keep spinning).
- *Start a new shape instead* hides the tree again until the next save.

## The forest

`The forest` shows every saved tree at once. Trees are planted on a spiral in
the order they were saved (`created_at`), so a new tree always grows on the
outside and nobody's tree moves; the ground and camera widen as it grows.
Hover a name in the list and every other tree (trunk and leaves) fades while that one
comes forward and its butterflies appear around it; they disappear when you move away.
The page needs WebGL; without it the tree and forest are simply not shown.

## Three.js bundle

Modern three.js no longer ships a plain `<script>` build, so
`assets/js/vendor/three.custom.min.js` is a trimmed bundle (only the parts in
`three-entry.js`, exposed as a global `THREE`). To rebuild it:

```bash
npm i three esbuild
npx esbuild assets/js/vendor/three-entry.js --bundle --format=iife \
  --global-name=THREE --minify --legal-comments=none \
  --outfile=assets/js/vendor/three.custom.min.js
```

If you use a new three.js class in `tree/`, add it to `three-entry.js` first.

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

`setup.sql` also adds a `created_at` column, which The forest uses to keep every
tree in place. It is safe to re-run on an existing project.

The anon key is public by design; access control comes from the RLS policies.
The provided policies are deliberately open (anyone can read, insert and
update). Since the world view fetches every row's `id`, anyone could overwrite
another entry. If that matters to you, move updates behind an RPC or a secret
edit token instead of the `id`.
