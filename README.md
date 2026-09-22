# Unidoar — Prototipo navegable

Prototipo navegable de alta fidelidad de **Unidoar**, la plataforma que conecta
instituciones (colegios, clubes, natatorios) con docentes, entrenadores y
guardavidas verificados.

Sitio estático, sin build. Es el prototipo del handoff de diseño publicado tal
cual, sin reescribir: sirve como fuente de verdad visual y de copy para el MVP.

> El MVP productivo vive en [`HelloCambalache/unidoar`](https://github.com/HelloCambalache/unidoar).
> Este repo es **solo la referencia de diseño**.

## Correr en local

Cualquier servidor estático sirve. No abras `index.html` con `file://`: el
runtime de componentes usa `fetch()` para traer `Footer.dc.html` y falla por CORS.

```bash
python3 -m http.server 8777
```

Después abrí http://127.0.0.1:8777

## Qué hay adentro

| Archivo | Qué es |
|---|---|
| `index.html` | El prototipo completo: template `<x-dc>` + la clase de lógica con toda la máquina de estados. |
| `Footer.dc.html` | Componente footer, importado 8 veces vía `<dc-import name="Footer">`. |
| `support.js` | Runtime del motor de templates (`<sc-if>`, `{{ prop }}`, `dc-import`). |
| `image-slot.js` | Helper de slots de imagen del tool de diseño. |
| `_ds/` | Design system CambalacheUI (`cbl-*`), tokens `--cbl-*` y fuentes Sora + Inter. |
| `assets/` | Logos, fotos de hero por categoría y fotos de perfil de ejemplo. |
| `HANDOFF.md` | Spec completa: mapa de pantallas, design tokens, interacciones. **Leelo antes de tocar el MVP.** |

## Cómo navegarlo

Es una sola máquina de estados: `state.screen` define la pantalla principal y
hay sub-estados por área (`docAppTab`, `instAppTab`, `pipelineView`, etc.).
El footer tiene atajos directos a los cinco flujos grandes: flujo docente,
flujo institución, backoffice, app docente y app institución.

El mapa completo de pantallas está en [`HANDOFF.md`](./HANDOFF.md).

## Notas

- Las fotos son de stock, para maquetar. En producción van por el banco real del cliente.
- Se publica con `noindex` — es un prototipo, no tiene que aparecer en Google.
- En consola aparece un `TypeError ... 'jsx'` del bundle del design system: es una
  carrera benigna en el init de React y no afecta el render.
