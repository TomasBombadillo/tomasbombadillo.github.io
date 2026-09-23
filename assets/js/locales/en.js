/* English — also the fallback for any missing key in other languages. */
I18N.locales.en = {
  'meta.title': 'Parametric Gender Density Mapper',
  'meta.description': 'Map identity, expression, anatomy and attraction as density fields instead of points on a line.',

  /* Sidebar */
  'brand.name': 'Gender Shapes',
  'brand.sub': 'density mapper',
  'nav.home': 'Home',
  'nav.editor': 'My shape',
  'nav.lookup': 'Find by ID',
  'nav.world': 'The world',
  'nav.inspiration': 'Inspiration',
  'lang.group': 'Language',
  'menu.show': 'Show menu',
  'menu.hide': 'Hide menu',

  /* Home */
  'home.title': 'What shape is your gender?',
  'home.sub': 'Map identity, expression, anatomy and attraction as density fields rather than points on a line. Add as many peaks as you need — most people are not a single dot.',
  'home.cta': 'Discover your own gender shape',
  'home.cardLookup.title': 'I already have an ID',
  'home.cardLookup.desc': 'Paste your ID to view or edit what you saved.',
  'home.cardWorld.title': 'See the world',
  'home.cardWorld.desc': 'Everyone who has saved a shape, pooled into one view.',
  'home.credit': 'This model draws on <a href="https://www.itspronouncedmetrosexual.com/2018/10/the-genderbread-person-v4/" target="_blank" rel="noopener">The Genderbread Person</a> and <a href="https://transstudent.org/gender/" target="_blank" rel="noopener">Gender Unicorn</a> — <button class="view-link" data-view="inspiration" type="button">more on that</button>',

  /* Editor */
  'editor.title': 'Your shape',
  'editor.sub': 'Adjust each dimension, then save to get a shareable ID.',
  'editor.namePlaceholder': 'Display name...',
  'editor.save': 'Save Results',
  'editor.saving': 'Saving…',
  'editor.showName': 'Show my name in The world',

  /* Dimensions */
  'char.identity.title': 'Gender Identity',
  'char.identity.desc': 'Internal sense of self',
  'char.expression.title': 'Gender Expression',
  'char.expression.desc': 'Outward presentation and behavior',
  'char.sex.title': 'Anatomical Sex',
  'char.sex.desc': 'Physical traits and sex characteristics',
  'char.romantic.title': 'Romantic Attraction',
  'char.romantic.desc': 'Direction of romantic desires',
  'char.sexual.title': 'Sexual Attraction',
  'char.sexual.desc': 'Direction of physical/sexual desires',

  /* Peaks */
  'peak.prefix': 'Peak',
  'peak.add': '+ Add Peak',
  'peak.remove': 'Remove',
  'peak.weight': 'Weight / Time',
  'peak.masc': 'Masculine',
  'peak.fem': 'Feminine',
  'peak.other': 'Other',

  /* Canvas axis labels */
  'canvas.masc': 'Masc',
  'canvas.fem': 'Fem',
  'canvas.other': 'Other',

  /* ID banner */
  'banner.editing': 'Editing an existing entry.',
  'banner.overwrite': 'Saving will overwrite it.',
  'banner.id': 'ID:',
  'banner.copy': 'copy',
  'banner.copied': 'copied',
  'banner.newShape': 'start a new shape instead',

  /* Toasts */
  'toast.needName': 'Please enter a display name first.',
  'toast.noLibSave': 'Supabase library did not load. Check your connection and reload.',
  'toast.noLib': 'Supabase library did not load.',
  'toast.updateZero': 'Update matched zero rows — nothing was written. The table is missing an UPDATE policy for anonymous users (see supabase/setup.sql). Use "start a new shape instead" above to store this as a fresh entry.',
  'toast.noReadback': 'The row was written but could not be read back. Add a SELECT policy for anonymous users so the app can return your ID.',
  'toast.updated': 'Updated your existing shape.',
  'toast.saved': 'Saved. Your shape is now in the gallery.',
  'toast.newMode': 'Now creating a new entry. Saving will not touch the old one.',
  'toast.pasteId': 'Paste an ID first.',
  'toast.notFound': 'No shape found with that ID.',
  'toast.loaded': "Loaded {name}'s shape. Saving will update it.",
  'toast.openedNamed': "Opened {name}'s shape as a starting point. Saving creates your own entry.",
  'toast.openedUnnamed': 'Opened this shape as a starting point. Saving creates your own entry.',

  /* Lookup */
  'lookup.title': 'Find your shape',
  'lookup.sub': 'Paste the ID you got when you saved. It looks like <code>3f9a...-...</code>.',
  'lookup.placeholder': 'Paste your ID...',
  'lookup.load': 'Load',

  /* Inspiration */
  'insp.title': 'Inspiration',
  'insp.sub': 'Where this model comes from, and where to go from here.',
  'insp.gbp': 'The Genderbread Person',
  'insp.gu': 'Gender Unicorn',
  'insp.tool': 'This tool',
  'insp.text': 'This tool\'s five dimensions — identity, expression, anatomical sex, romantic attraction, and sexual attraction — aren\'t invented here. They come from two frameworks that reshaped how gender is taught. <a href="https://www.itspronouncedmetrosexual.com/2018/10/the-genderbread-person-v4/" target="_blank" rel="noopener">The Genderbread Person v4</a> broke gender into these same categories as independent scales, instead of one line running from "man" to "woman." <a href="https://transstudent.org/gender/" target="_blank" rel="noopener">The Gender Unicorn</a>, from Trans Student Educational Resources, refined that into the near-identical five-part structure used here, splitting attraction into romantic and sexual. What changed on this end: instead of static bars, each dimension is a density field — because most people aren\'t a single point, they\'re a range, sometimes several peaks at once.',
  'insp.resources': 'Other resources',
  'insp.tser': 'The org behind the Gender Unicorn. Free guides on pronouns, coming out, and legal rights, written for schools, families, and workplaces.',
  'insp.pflag': 'The oldest and largest org for LGBTQ+ people and their families — local support groups, and materials for parents navigating a child coming out.',
  'insp.glaad': 'A glossary of accurate, respectful terminology — useful if a word you\'ve heard is unfamiliar or feels outdated.',

  /* The world */
  'world.title': 'The world',
  'world.count.one': '{n} person so far',
  'world.count.other': '{n} people so far',
  'world.loading': 'Loading…',
  'world.empty': 'No shapes saved yet. Be the first.',
  'world.identities': 'Identities',
  'world.attractions': 'Attractions',
  'world.noOne': 'No one yet.',
  'world.allHidden': 'Everyone here has chosen to stay unnamed.',
  'world.anonymous': 'Anonymous',

  /* Share */
  'share.open': 'Share this page',
  'share.title': 'Share this page',
  'share.hint': 'Scan the QR code to open this page.',
  'share.copyLink': 'Copy link',
  'share.copyQr': 'Copy QR image',
  'share.copied': 'Copied!',
  'share.downloaded': "Your browser can't copy images, so the QR was downloaded instead.",
  'share.copyFailed': "Couldn't copy automatically — select the link and copy it.",
  'share.close': 'Close',
  'share.qrAlt': 'QR code that opens this page',
  'share.linkLabel': 'Page link',

  /* Supabase error explanations */
  'err.unknown': 'Unknown error.',
  'err.rls': 'Blocked by Row Level Security. The table exists but anonymous users are not allowed to write to it — you need an INSERT policy.',
  'err.noTable': 'Table "{table}" was not found in your database. Create it with supabase/setup.sql.',
  'err.column': 'A column in the table does not match what the app sends. Check that the table has display_name (text), shape (jsonb) and name_visible (boolean).',
  'err.uuid': 'That ID is not a valid UUID.',
  'err.network': 'Could not reach Supabase at all. Check the project URL, your internet connection, and whether the project is paused.'
};
