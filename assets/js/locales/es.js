/* Español */
I18N.locales.es = {
  'meta.title': 'Mapeador paramétrico de densidad de género',
  'meta.description': 'Mapea la identidad, la expresión, la anatomía y la atracción como campos de densidad en lugar de puntos en una línea.',

  /* Sidebar */
  'brand.name': 'Formas de Género',
  'brand.sub': 'mapeador de densidad',
  'nav.home': 'Inicio',
  'nav.editor': 'Mi forma',
  'nav.lookup': 'Buscar por ID',
  'nav.world': 'El mundo',
  'nav.inspiration': 'Inspiración',
  'lang.group': 'Idioma',
  'menu.show': 'Mostrar menú',
  'menu.hide': 'Ocultar menú',

  /* Home */
  'home.title': '¿Qué forma tiene tu género?',
  'home.sub': 'Mapea la identidad, la expresión, la anatomía y la atracción como campos de densidad en lugar de puntos en una línea. Agrega tantos picos como necesites: la mayoría de las personas no somos un único punto.',
  'home.cta': 'Descubre la forma de tu género',
  'home.cardLookup.title': 'Ya tengo un ID',
  'home.cardLookup.desc': 'Pega tu ID para ver o editar lo que guardaste.',
  'home.cardWorld.title': 'Mira el mundo',
  'home.cardWorld.desc': 'Todas las personas que han guardado una forma, reunidas en una sola vista.',
  'home.credit': 'Este modelo se basa en <a href="https://www.itspronouncedmetrosexual.com/2018/10/the-genderbread-person-v4/" target="_blank" rel="noopener">The Genderbread Person</a> y <a href="https://transstudent.org/gender/" target="_blank" rel="noopener">Gender Unicorn</a> — <button class="view-link" data-view="inspiration" type="button">más sobre esto</button>',

  /* Editor */
  'editor.title': 'Tu forma',
  'editor.sub': 'Ajusta cada dimensión y luego guarda para obtener un ID que puedes compartir.',
  'editor.namePlaceholder': 'Nombre para mostrar...',
  'editor.save': 'Guardar resultados',
  'editor.saving': 'Guardando…',
  'editor.showName': 'Mostrar mi nombre en El mundo',

  /* Dimensions */
  'char.identity.title': 'Identidad de género',
  'char.identity.desc': 'Sentido interno de quién eres',
  'char.expression.title': 'Expresión de género',
  'char.expression.desc': 'Presentación y comportamiento externos',
  'char.sex.title': 'Sexo anatómico',
  'char.sex.desc': 'Rasgos físicos y características sexuales',
  'char.romantic.title': 'Atracción romántica',
  'char.romantic.desc': 'Dirección de los deseos románticos',
  'char.sexual.title': 'Atracción sexual',
  'char.sexual.desc': 'Dirección de los deseos físicos/sexuales',

  /* Peaks */
  'peak.prefix': 'Pico',
  'peak.add': '+ Agregar pico',
  'peak.remove': 'Quitar',
  'peak.weight': 'Peso / Tiempo',
  'peak.masc': 'Masculino',
  'peak.fem': 'Femenino',
  'peak.other': 'Otro',

  /* The tree & the forest */
  'nav.forest': "El bosque",
  'tree.alt': "Un árbol de estilo low-poly dentro de un cilindro de cristal decorado con mariposas. Cada piso del cilindro es una dimensión y sus ramas son los picos de esa dimensión. El piso resaltado es el que estás editando.",
  'tree.rotateCw': "Girar el árbol en sentido horario",
  'tree.rotateCcw': "Girar el árbol en sentido antihorario",
  'forest.title': "El bosque",
  'forest.count.one': "El bosque tiene {n} árbol",
  'forest.count.other': "El bosque tiene {n} árboles",
  'forest.loading': "Cargando…",
  'forest.empty': "Todavía no hay árboles. Planta el primero.",
  'forest.alt': "Un bosque con un árbol low-poly por cada persona que guardó una forma",
  'forest.noWebgl': "Tu navegador no puede dibujar gráficos 3D, así que no se puede mostrar el bosque.",

  /* Canvas axis labels */
  'canvas.masc': 'Masc',
  'canvas.fem': 'Fem',
  'canvas.other': 'Otro',

  /* ID banner */
  'banner.editing': 'Editando una entrada existente.',
  'banner.overwrite': 'Al guardar se sobrescribirá.',
  'banner.id': 'ID:',
  'banner.copy': 'copiar',
  'banner.copied': 'copiado',
  'banner.newShape': 'empezar una forma nueva en su lugar',

  /* Toasts */
  'toast.needName': 'Primero escribe un nombre para mostrar.',
  'toast.noLibSave': 'La biblioteca de Supabase no se cargó. Revisa tu conexión y recarga la página.',
  'toast.noLib': 'La biblioteca de Supabase no se cargó.',
  'toast.updateZero': 'La actualización no afectó ninguna fila: no se escribió nada. A la tabla le falta una política UPDATE para usuarios anónimos (ver supabase/setup.sql). Usa «empezar una forma nueva en su lugar» arriba para guardar esto como una entrada nueva.',
  'toast.noReadback': 'La fila se escribió, pero no se pudo leer de vuelta. Agrega una política SELECT para usuarios anónimos para que la app pueda devolverte tu ID.',
  'toast.updated': 'Se actualizó tu forma existente.',
  'toast.saved': 'Guardado. Tu forma está en El mundo y tu árbol está creciendo en El bosque.',
  'toast.newMode': 'Ahora estás creando una entrada nueva. Al guardar no se tocará la anterior.',
  'toast.pasteId': 'Primero pega un ID.',
  'toast.notFound': 'No se encontró ninguna forma con ese ID.',
  'toast.loaded': 'Se cargó la forma de {name}. Al guardar se actualizará.',
  'toast.openedNamed': 'Se abrió la forma de {name} como punto de partida. Al guardar se crea tu propia entrada.',
  'toast.openedUnnamed': 'Se abrió esta forma como punto de partida. Al guardar se crea tu propia entrada.',

  /* Lookup */
  'lookup.title': 'Encuentra tu forma',
  'lookup.sub': 'Pega el ID que recibiste al guardar. Se ve así: <code>3f9a...-...</code>.',
  'lookup.placeholder': 'Pega tu ID...',
  'lookup.load': 'Cargar',

  /* Inspiration */
  'insp.title': 'Inspiración',
  'insp.sub': 'De dónde viene este modelo y adónde ir desde aquí.',
  'insp.gbp': 'The Genderbread Person',
  'insp.gu': 'Gender Unicorn',
  'insp.tool': 'Esta herramienta',
  'insp.text': 'Las cinco dimensiones de esta herramienta —identidad, expresión, sexo anatómico, atracción romántica y atracción sexual— no se inventaron aquí. Provienen de dos marcos que cambiaron la forma en que se enseña el género. <a href="https://www.itspronouncedmetrosexual.com/2018/10/the-genderbread-person-v4/" target="_blank" rel="noopener">The Genderbread Person v4</a> dividió el género en estas mismas categorías como escalas independientes, en lugar de una sola línea que va de «hombre» a «mujer». <a href="https://transstudent.org/gender/" target="_blank" rel="noopener">The Gender Unicorn</a>, de Trans Student Educational Resources, lo refinó hasta la estructura de cinco partes casi idéntica que se usa aquí, separando la atracción en romántica y sexual. Lo que cambia en esta herramienta: en lugar de barras estáticas, cada dimensión es un campo de densidad, porque la mayoría de las personas no somos un solo punto, sino un rango, a veces con varios picos a la vez.',
  'insp.resources': 'Otros recursos',
  'insp.tser': 'La organización detrás del Gender Unicorn. Guías gratuitas sobre pronombres, salir del clóset y derechos legales, pensadas para escuelas, familias y lugares de trabajo. Sitio en inglés.',
  'insp.pflag': 'La organización más antigua y grande para personas LGBTQ+ y sus familias: grupos de apoyo locales y materiales para madres y padres cuyo hijo o hija sale del clóset. Sitio en inglés.',
  'insp.glaad': 'Un glosario de terminología precisa y respetuosa; útil si una palabra que escuchaste te resulta desconocida o anticuada. Sitio en inglés.',

  /* The world */
  'world.title': 'El mundo',
  'world.count.one': '{n} persona hasta ahora',
  'world.count.other': '{n} personas hasta ahora',
  'world.loading': 'Cargando…',
  'world.empty': 'Todavía no hay formas guardadas. Sé la primera persona.',
  'world.identities': 'Identidades',
  'world.attractions': 'Atracciones',
  'world.noOne': 'Todavía nadie.',
  'world.allHidden': 'Todas las personas aquí eligieron permanecer sin nombre.',
  'world.anonymous': 'Anónimo',

  /* Share */
  'share.open': 'Compartir esta página',
  'share.title': 'Compartir esta página',
  'share.hint': 'Escanea el código QR para abrir esta página.',
  'share.copyLink': 'Copiar enlace',
  'share.copyQr': 'Copiar imagen del QR',
  'share.copied': '¡Copiado!',
  'share.downloaded': 'Tu navegador no puede copiar imágenes, así que se descargó el QR.',
  'share.copyFailed': 'No se pudo copiar automáticamente: selecciona el enlace y cópialo.',
  'share.close': 'Cerrar',
  'share.qrAlt': 'Código QR que abre esta página',
  'share.linkLabel': 'Enlace de la página',

  /* Supabase error explanations */
  'err.unknown': 'Error desconocido.',
  'err.rls': 'Bloqueado por Row Level Security. La tabla existe, pero los usuarios anónimos no tienen permiso para escribir en ella: hace falta una política INSERT.',
  'err.noTable': 'No se encontró la tabla "{table}" en tu base de datos. Créala con supabase/setup.sql.',
  'err.column': 'Una columna de la tabla no coincide con lo que envía la app. Verifica que la tabla tenga display_name (text), shape (jsonb) y name_visible (boolean).',
  'err.uuid': 'Ese ID no es un UUID válido.',
  'err.network': 'No se pudo conectar con Supabase. Revisa la URL del proyecto, tu conexión a internet y si el proyecto está en pausa.'
};
