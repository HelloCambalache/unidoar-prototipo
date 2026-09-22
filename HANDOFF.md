# Handoff: Unidoar — Plataforma de búsqueda de docentes, entrenadores y guardavidas

## Overview
Unidoar conecta instituciones (colegios, clubes, natatorios) con docentes, profesores, entrenadores y guardavidas verificados. El objetivo del producto es acortar el tiempo de cobertura de cargos y suplencias, con búsqueda por zona/disciplina/disponibilidad, verificación de identidad y antecedentes, y seguimiento de postulantes.

Este paquete documenta un prototipo navegable de alta fidelidad que cubre: landing pública + 4 landings de categoría, onboarding de institución y de docente, app web de institución (dashboard, publicar búsqueda, buscador de docentes, pipeline de postulantes, equipo, cursos, plan/facturación, vitrina pública), app web de docente (oportunidades, postulaciones, instituciones, perfil, notificaciones), versiones mobile/app de ambos flujos, y un backoffice interno (verificación, docentes, instituciones, cobros, salud del marketplace).

## About the Design Files
Los archivos de este paquete son **referencias de diseño construidas en HTML** — prototipos navegables que muestran el look final y el comportamiento esperado, no código de producción para copiar tal cual. La tarea es **recrear estos diseños HTML en el entorno de código real del proyecto** (React, Vue, mobile nativo, etc.), usando sus patrones y librerías establecidos — o, si todavía no existe una base de código, elegir el framework más adecuado e implementar ahí.

El archivo principal es `Prototipo navegable.dc.html`. Es un único archivo con:
- Todo el template HTML/JSX-like en la sección `<x-dc>` (usa un motor de templates propio: `<sc-if value="{{ isX }}">` = renderizado condicional, `{{ prop }}` = interpolación de valores calculados en la clase de lógica).
- Toda la lógica de estado y navegación en el bloque `<script type="text/x-dc" data-dc-script"> class Component extends DCLogic { ... }`. Ahí están el `state` inicial, los métodos de navegación (`go(screen)`, `goX()` helpers) y el mapa completo `renderVals()` que calcula cada booleano `isX` que controla qué pantalla se muestra.

No hace falta ejecutar este runtime en el código final: usalo como especificación exacta de estructura, copy, estilos inline y transiciones de estado.

## Fidelity
**Alta fidelidad (hifi).** Colores finales, tipografía, espaciado y microinteracciones (hover, transiciones, drag&drop en el Kanban) están definidos. El desarrollador debe recrear la UI con fidelidad visual alta, adaptando los componentes a las librerías del proyecto de destino (o al Design System @cambalache/ui documentado abajo).

## Mapa de pantallas
El prototipo es una sola máquina de estados controlada por `state.screen` (pantallas principales) y sub-estados por área (`docAppTab`, `instAppTab`, `instAppMasScreen`, `searchesTab`, `pipelineView`, etc). Cada booleano `isX` en `renderVals()` decide si esa sección se muestra.

### Sitio público
| screen / flag | Descripción |
|---|---|
| `isLanding` | Landing principal. Predomina el azul marca (#040B35 header, #16214F hero). Hero con 3 fotos de fondo en fade automático (profesor / entrenador / universidad), 2 CTAs (Soy institución / Soy docente), fila de 3 stats, selector de categorías, "cómo funciona", tira de logos de instituciones en marquee, testimonios. |
| `isEducadores` | Landing de categoría Educadores. Predomina naranja #DD553F. Mismo layout base que landing principal: hero con foto propia, stats, "cómo funciona" adaptado ("si sos docente"), tarjeta de verificado, CTA de suplencias rápidas. |
| `isEntrenadores` | Landing de categoría Entrenadores. Predomina amarillo/ámbar #F59332. Mismo layout base. |
| `isGuardavidas` | Landing de categoría Guardavidas. Predomina celeste #82D8E9. Mismo layout base. |
| `isSignup` | Selector "Soy institución" / "Soy docente" a pantalla completa (no modal), con foto de fondo, deriva a los onboardings. |

### Onboarding
| screen / flag | Descripción |
|---|---|
| `isInstOnbPage` → `isInstOnb1/2/3` | Onboarding de institución en 3 pasos: datos de la institución (nombre, tipo, dirección, partido, provincia) → credenciales de acceso (con checkbox de términos y condiciones) → vestir la vitrina (foto de portada, logo). Fondo con foto e igual leve overlay/transparencia por paso. |
| `isDocOnbPage` → `isDocOnb1/2/3/4` | Onboarding de docente en 4 pasos: cuenta → subir CV (con estado "Detectado del CV") → revisar datos extraídos → confirmar zonas/disponibilidad. Incluye checkbox de términos y condiciones. |

### App web — Docente (`isDocentePage`, layout con sidebar oscura #33363B)
| screen / flag | Descripción |
|---|---|
| `isDocOportunidades` | Buscar trabajo: catálogo de búsquedas cerca, filtros. |
| `isDocRapidas` | Búsquedas rápidas / suplencias urgentes, con filtros propios y badge de urgencia. |
| `isDocCursos2` | Cursos ofrecidos por instituciones de la zona. |
| `isDocPostulaciones` | Mis postulaciones, tabs por etapa. |
| `isDocInstituciones` | Catálogo de instituciones (guardar favoritas, ver perfil). |
| `isDocInstPerfil` | Perfil público de una institución (logo, foto de portada, info, búsquedas activas). |
| `isDocOfertaDetalle` | Detalle de una oportunidad/oferta puntual. |
| `isDocPerfil` | Mi perfil de docente: datos, CV con dropdown expandible + descarga PDF, zonas, disponibilidad. |
| `isDocNotif` | Notificaciones. |

### App web — Institución (`isInstPage`, header #04062F)
| screen / flag | Descripción |
|---|---|
| `isInstPublicar` | Publicar búsqueda: tipo (titular/suplencia/cualquiera + urgente), disciplina, zona, etc. |
| `isInstDashboard` | Dashboard con resumen (postulantes, búsquedas activas) y accesos directos. |
| `isInstBuscador` | Buscar docentes: filtros (categoría, zona, disciplina) + grid de 3 tarjetas por fila con foto de perfil; hover toma el color de la categoría del docente. |
| `isInstRapidas` | Búsqueda rápida de institución, misma estructura de filtros que el buscador normal. |
| `isInstDocPerfil` | Perfil de un docente visto por la institución (botones Invitar / Ver CV, toasts de confirmación). |
| `isInstPipeline` | Pipeline de postulantes de una búsqueda puntual. Toggle Kanban (`isKanbanView`, drag&drop entre columnas Nuevos/Entrevista/Oferta) / Tabla (`isTableView`). Selección de etapa vía ícono/menú además del drag. |
| `isInstContratar` | Confirmación de contratación. |
| `isInstCursos` | Mis cursos: ABM básico de cursos que ofrece la institución (ej. RCP, natación). |
| `isInstEquipo` | Equipo: tabla de miembros, invitar nuevo miembro, ver ficha básica de cada uno. |
| `isInstVitrina` | Perfil público / vitrina editable inline (logo, foto de portada). |
| `isInstPlan` | Plan y facturación, cambio de plan. |
| `isInstHistorial` → `isSearchesActivas`/cerradas | Historial de búsquedas propias, tabs activas/cerradas. |

### Backoffice interno (`isBackofficePage`, header #1F2421)
| screen / flag | Descripción |
|---|---|
| `isBoVerif` | Cola de verificación de identidad/antecedentes: acciones Verificar / Pedir corrección / Rechazar. |
| `isBoDocentes` | Listado de docentes. |
| `isBoInst` | Listado de instituciones. |
| `isBoCobros` | Planes y cobros. |
| `isBoOperacion` | Salud del marketplace (métricas operativas). |

### Vistas app (mobile)
| flag | Descripción |
|---|---|
| `docAppOnboarded` / `docAppStep` (1..N) | Onboarding docente en formato mobile, mismos pasos/copy que el onboarding web. |
| `docAppTab`: home / buscar (`docAppBuscarRapida` toggle catálogo↔rápida) / postulaciones / perfil / instituciones | App docente mobile, bottom tab bar. Home agrega accesos directos (buscar trabajo, búsquedas rápidas, instituciones, dashboard, completar perfil). |
| `instAppOnboarded` / `instAppStep` | Onboarding institución en formato mobile. |
| `instAppTab`: dashboard / busquedas / docentes (`instAppDocentesRapida` toggle) / postulantes / mas | App institución mobile. "Más" (`instAppMasScreen`) agrupa equipo / cursos / perfil / plan. |

## Interacciones y comportamiento clave
- **Navegación**: función central `go(screen)` cambia `state.screen`; helpers `goX()` encapsulan transiciones compuestas (ej. `selectInstitucion()` → `screen: 'instOnb1'`).
- **Hero de landing**: 3 imágenes de fondo con `animation: heroFade 15s infinite`, cada una con `animation-delay` escalonado (0s, 5s, 10s) para crossfade continuo.
- **Marquee de logos**: `@keyframes logoMarquee` traslada el track de logos en loop infinito; al hacer hover cambian a color naranja o rosa de marca.
- **Menú categorías (nav)**: dropdown `.udoar-navdrop` que aparece al hover, con submenu de Educadores/Entrenadores/Guardavidas.
- **Verificado**: se muestra con un ícono de check circular en el color representativo de cada categoría (no un badge de texto genérico).
- **Pipeline de postulantes**: soporta drag&drop entre columnas Kanban (`onDragOver`/`onDrop`) y también un ícono/acción explícita para mover de etapa (accesible sin drag), con confirmación de a qué etapa mover.
- **CV de docente**: sección colapsable (dropdown) dentro del perfil, con botón de descarga en PDF.
- **Filtros de búsqueda**: buscador de docentes (institución) y buscar trabajo/búsquedas rápidas (docente) comparten la misma estructura de filtros (zona, categoría, disciplina) + buscador de texto; en mobile los filtros colapsan a un drawer/dropdown.
- **Responsive**: layout fluido con puntos de quiebre en 640/700/760/860px. Sidebar de app (`.udoar-app-sidebar`) se convierte en drawer con hamburguesa por debajo de 860px; nav de landing se convierte en hamburguesa por debajo de 760px; grids de 3/4 columnas colapsan a 2 y luego a 1 columna.
- **Toasts**: confirmaciones efímeras (guardado de perfil, invitación enviada, favorito) como notificación flotante arriba a la derecha, auto-dismiss ~2.2s.
- **Botones**: alturas mínimas 46px (default), 38px (sm), 52px (lg) — evitar botones "finitos"; siempre con estado hover distinguible.

## Design Tokens

### Colores de marca (paleta Unidoar)
| Uso | Hex |
|---|---|
| Azul marca / texto principal, header, fondo landing principal | `#040B35` (header), `#16214F` (hero/enlaces), `#02042D`/`#04062F` (headers de secciones) |
| Naranja — categoría Educadores / CTA primario | `#DD553F` |
| Ámbar — categoría Entrenadores | `#F59332` |
| Celeste — categoría Guardavidas | `#82D8E9` |
| Rosa/fucsia — acentos, estado "oferta enviada" | `#97125F` / fondo `#FBE0EF` |
| Verde éxito | `#1E7A4C` / fondo `#E7F5EF` |
| Fondo neutro app | `#EDEBE5` |
| Fondo secciones claras | `#FAFAF8` |
| Bordes | `#E3E1DC` |
| Texto secundario | `#6B706C` |
| Texto oscuro / labels | `#1F2421` |
| Backoffice header | `#1F2421` |

### Tipografía
- Display / números grandes: **Sora** (600–700).
- Cuerpo / UI: **Inter** (400–600).
- Escala: h1 landing 48px/1.1, h1 sección 22–24px/1.2, cuerpo 14–17px/1.5–1.6, labels/badges 12–13px.
- letter-spacing -0.015em a -0.025em en títulos display.

### Espaciado y forma
- Radios: 7–10px en cards/dropdowns, 999px en pills/badges/botones toggle.
- Sombra de card: 0 12px 30px rgba(31,36,33,.18) (dropdowns), 0 4px 10px rgba(0,0,0,.15) (CTAs sobre foto).
- Botones: min-height 46/38/52px según tamaño (ver arriba).

### Design system de componentes disponible
El proyecto tiene ligado el design system **CambalacheUI** (@cambalache/ui): Button, Input, Textarea, Select, Badge, Card, Modal, StatCard, Tabs, Table, Avatar, Checkbox, Toggle, Tooltip — con tokens --cbl-* (ver _ds/design-system-*/styles.css y _ds_bundle.js en el proyecto). El prototipo usa las clases cbl-btn, cbl-badge, cbl-table de este sistema como base y estilos inline de marca Unidoar encima. Si el codebase de destino no usa este DS, migrar a la librería de componentes que corresponda manteniendo los tokens de color/tipografía de Unidoar documentados arriba.

## Assets
Todas las imágenes están en la raíz del proyecto / assets/: logo (unidoar-logo-full.jpg y variantes), fotos de fondo de hero por categoría (hero-profesor.jpg, hero-entrenador.jpg, hero-universidad.png, y variantes cargadas por el usuario), fotos de perfil de docentes de ejemplo. Son fotos de stock/subidas por el usuario para maquetar — reemplazar por el banco de imágenes real del cliente en producción.

## Files in this package
- `Prototipo navegable.dc.html` — prototipo completo (fuente de verdad de estructura, copy y estilos).
- `assets/` — imágenes referenciadas por el prototipo (logo, fotos de fondo, fotos de perfil de ejemplo).

Abrir Prototipo navegable.dc.html directamente en un navegador para recorrer todo el flujo de forma interactiva.
