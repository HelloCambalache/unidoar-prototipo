@AGENTS.md

# UNIDOAR — guía del proyecto

Marketplace que conecta **instituciones** (colegios, clubes, natatorios) con **docentes, entrenadores y guardavidas** verificados. Este repo es la app real (Next.js); el prototipo navegable original vive en `prototipo/` y es **solo referencia visual y de copy**. `HANDOFF.md` documenta pantallas y tokens de marca.

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript estricto, Tailwind 4, pnpm.
- **Supabase** (Vercel Marketplace) para todo lo de backend: **Postgres** accedido con **Drizzle ORM** + `postgres-js` (`src/db`), **Auth** (`@supabase/ssr`, sesión en cookies) y **Storage** (buckets `publico` y `privado`).
- Deploy: Vercel, proyecto `unidoar-prototipo` (equipo Cambalaches). `main` sigue sirviendo el prototipo estático; el trabajo vive en `feat/app-dinamica`.
- En Next 16 el antiguo `middleware` se llama **`proxy.ts`** (`src/proxy.ts`). Antes de usar una API de Next, leé la guía correspondiente en `node_modules/next/dist/docs/`.

## Comandos

```bash
pnpm dev            # servidor local
pnpm typecheck      # tsc --noEmit  (correrlo siempre antes de dar algo por hecho)
pnpm lint
pnpm db:push        # aplica src/db/schema.ts a la base (desarrollo)
pnpm db:rls         # activa RLS en todas las tablas (correrlo después de cada db:push)
pnpm db:storage     # crea los buckets de Storage
pnpm db:setup       # push + rls + storage + seed, de una
pnpm db:admin --email=<correo> [--rol=institucion]   # da (o quita) el rol admin: entra a /backoffice
pnpm db:vincular --institucion=<correo> --docente=<correo>   # liga cuentas reales de Supabase con los datos demo (rehacer tras cada db:seed)
pnpm db:seed        # catálogos + datos demo (es_demo=true); --solo-catalogos / --borrar-demo
vercel env pull .env.local --yes   # trae las variables de Supabase
```

Las variables viven en `.env.local` (no se commitea). `drizzle-kit` y `tsx` no cargan `.env.local` solos: los scripts `db:*` ya usan `dotenv`.

### Conexión a la base

La app se conecta por el **pooler de sesión** de Supabase (`DATABASE_URL`, puerto 5432, host `*.pooler.supabase.com`, que funciona por IPv4). **No usar el pooler de transacciones (6543)** para la app: con `postgres-js` y Next las consultas se traban de forma intermitente al reutilizar conexiones (lo medimos: 60 s de cuelgue, sesiones "active / ClientRead" que no terminan). La conexión directa (`db.<ref>.supabase.co`) es solo IPv6 y no sirve en redes IPv4 ni en Vercel. El límite lo pone el tamaño del pool de Supabase (por defecto 15 conexiones de servidor, compartidas por todas las instancias de Vercel, también las viejas tras un redeploy): si se agota, las páginas con varias consultas fallan con `EMAXCONNSESSION`. Por eso en Vercel cada instancia usa 2 conexiones (`maxConexiones()` en `src/db/index.ts`, ajustable con `DB_POOL_MAX`) y conviene subir el "Pool Size" en el panel de Supabase. `/api/salud` muestra el estado: variables presentes y si la base conecta, con el código del error.

### Seguridad con Supabase

- La app **no usa la API REST de Supabase para datos**: se conecta directo a Postgres (rol `postgres`, que saltea RLS) desde el servidor. Por eso todas las tablas llevan **RLS activado sin políticas** (`pnpm db:rls`): la clave pública (anon) que viaja al navegador no puede leer ni escribir nada. Una tabla nueva sin RLS queda expuesta: correr `db:rls` después de cada `db:push`.
- La **clave de servicio** (`SUPABASE_SERVICE_ROLE_KEY`) solo se usa en servidor (`src/lib/supabase/admin.ts`); jamás con prefijo `NEXT_PUBLIC_`.
- `usuarios.id` es el uuid de `auth.users`. La sesión se valida con `getClaims()` (JWT) en `src/proxy.ts` y `src/lib/auth.ts`.
- Archivos: las subidas pasan por `/api/subir` (servidor); `publico` se lee por URL pública, `privado` (CV, documentos) solo con URL firmada generada en el servidor.

## Principio rector: nada hardcodeado

Todo lo que el prototipo tenía en el `state` inicial (instituciones, ofertas, postulantes, cursos, notificaciones, equipo, testimonios, zonas, asignaturas) sale de la base. Los datos de ejemplo están en `src/db/seed-data.ts`. Solo son constantes en código los **vocabularios cerrados** (`src/lib/catalogo.ts`: niveles, turnos, tipos, etapas, roles, colores de categoría).

## Arquitectura

```
src/
  app/                    rutas (URLs idénticas a las del prototipo, ver prototipo/vercel.json)
    docente/…             área docente   (layout con AppShell + requerirDocente)
    institucion/…         área institución (layout con AppShell + requerirInstitucion)
    backoffice/…          área admin (rol "admin"): operación, verificación, docentes, instituciones, categorías, cobros, mensajes
    onboarding/…          altas (el paso 1 es el registro con Supabase Auth; los demás exigen sesión)
    actions/*.ts          server actions ("use server"), una por dominio
  components/
    ui/                   Boton, Campo/Input/Select/Textarea/Casilla, Insignia/Avatar/Verificado
    app/app-shell.tsx     header + sidebar + campana de notificaciones
    icons.tsx             <Icono nombre="…"/> (íconos de línea del prototipo)
  db/                     schema.ts, index.ts (getDb), seed.ts, seed-data.ts
  lib/
    auth.ts               usuarioActual, requerirUsuario/Docente/Institucion, asegurarUsuario
    catalogo.ts           vocabularios + esquemas Zod de formularios
    acciones.ts           Resultado, ok(), fallo(), parsear() para server actions
    queries/*.ts          lecturas (server-only), una por dominio
    geo.ts perfil.ts planes.ts notificaciones.ts sql-texto.ts auditoria.ts utils.ts
```

### Reglas

1. **Lecturas** en `src/lib/queries/<dominio>.ts` (`import "server-only"`, siempre `getDb()`, nunca un cliente de base en el navegador). Las páginas son Server Components y llaman a las queries directo.
2. **Escrituras** solo en server actions (`src/app/actions/<dominio>.ts`, `"use server"`). Cada acción: (a) obtiene al usuario con `requerirUsuario`/`requerirInstitucion`/`requerirDocente`, (b) **verifica que el recurso le pertenece** (una institución solo toca sus búsquedas/postulaciones; un docente solo las suyas), (c) valida con Zod (`parsear`), (d) devuelve `Resultado`, (e) llama a `revalidatePath` de lo que cambió. Nunca confiar en un id que venga del cliente sin chequear propiedad.
3. **Notificaciones**: toda acción relevante (postulación nueva, invitación, cambio de etapa, entrevista, oferta, contratación, verificación) crea una con `notificar()` (`src/lib/queries/notificaciones.ts`) para quien corresponda.
4. **Interactividad**: Client Components solo donde hay estado de UI (drag & drop del kanban, filtros en vivo, drawers, mapa). Filtros que cambian el listado → querystring (`searchParams`) para que la URL sea compartible; los controles lo actualizan con `useRouter`/`<Link>`.
5. **Formularios**: `<form action={…}>` con `useActionState`; errores por campo con `Campo error={…}`. Sin estado local duplicado de lo que ya está en la base.
6. **Identidad**: la fila `usuarios` se crea en el onboarding (`asegurarUsuario(rol)`), no con un trigger ni un webhook. El rol decide el área; `admin` entra a todo.
7. **Distancias**: nunca "km" fijos; se calculan con `distanciaKm` (`src/lib/geo.ts`) entre el docente y la institución.

## Diseño

Alta fidelidad al prototipo. Tokens de marca ya definidos como tema de Tailwind (`src/app/globals.css`): `navy-*`, `naranja`, `ambar`, `celeste`, `rosa`, `verde`, `app`, `superficie`, `borde`, `tinta`, `apagado`, `sutil`. Tipografía: Inter (cuerpo) y Sora (títulos display, `font-display`). Botones con altura mínima 46/34/52px (`<Boton tamano>`), nunca "finitos". El HTML de cada pantalla del prototipo está en `prototipo/index.html` (mapa de líneas en `HANDOFF.md` y por `isXxx`); portá estructura, copy y estilos a Tailwind, no el runtime. Breakpoints responsive del prototipo: 560 / 640 / 760 / 860 / 900 / 1000 px.

Copy en español rioplatense (voseo: "Publicá", "Elegí"). Accesibilidad: controles reales (`button`/`a`), `label` en inputs, foco visible, contraste AA.

## Estado de la migración

**Hecho (71 páginas):** sitio público; registro, ingreso y altas; área docente completa (dashboard, buscar trabajo con mapa, postulaciones, instituciones, cursos, perfil, notificaciones); área institución completa (dashboard, publicar, publicaciones, tablero de postulantes, buscador de profesionales, base de profesionales, perfil/vitrina, cursos, equipo con invitaciones, plan, cuenta); backoffice (operación, verificación, docentes, instituciones, categorías, cobros, mensajes). El ciclo núcleo se probó de punta a punta en el navegador con una cuenta de institución y una de docente.

**Pendiente:**
- **Cobro real:** no hay pasarela de pago. "Cambiar de plan" crea un pedido (`solicitudes_plan`) que el backoffice atiende; las facturas se cargan a mano. Integrar Mercado Pago.
- **Correo:** no hay servicio de mails. Las invitaciones al equipo muestran un enlace para copiar; Supabase usa su correo de prueba (muy limitado) para confirmar cuentas.
- Lectura automática del CV, importación de profesionales por CSV, resubida de DNI/título por el docente tras una corrección, material adjunto de cursos, y las vistas mobile "app" (`/app/docente`, `/app/institucion`).
- Login con Google: hay que crear las credenciales en Google Cloud y activarlo en Supabase.
- Rendimiento: las páginas de contenido (`/planes`, `/terminos`…) se generan en cada visita porque la cabecera consulta la sesión; se puede cachear con Partial Prerendering.
- Las acciones de las cuentas suspendidas se filtran con `src/lib/visibilidad.ts`: sumar ahí cualquier condición nueva de visibilidad.
