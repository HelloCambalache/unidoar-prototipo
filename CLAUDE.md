@AGENTS.md

# UNIDOAR — guía del proyecto

Marketplace que conecta **instituciones** (colegios, clubes, natatorios) con **docentes, entrenadores y guardavidas** verificados. Este repo es la app real (Next.js); el prototipo navegable original vive en `prototipo/` y es **solo referencia visual y de copy**. `HANDOFF.md` documenta pantallas y tokens de marca.

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript estricto, Tailwind 4, pnpm.
- **Supabase** (Vercel Marketplace) para todo lo de backend: **Postgres** accedido con **Drizzle ORM** + `postgres-js` (`src/db`), **Auth** (`@supabase/ssr`, sesión en cookies) y **Storage** (buckets `publico` y `privado`).
- Deploy: Vercel, proyecto `unidoar-prototipo` (equipo Cambalaches), funciones en `gru1` (junto a la base). `main` es producción y es donde se trabaja: se despliega solo en cada push. El prototipo estático quedó en `prototipo/` como referencia.
- **Dominio:** `https://www.unidoar.com.ar` (el DNS está en Vercel; `unidoar.com.ar` sin `www` redirige). Usar y compartir **solo ese**: la sesión y el enlace de confirmación del registro dependen del host, y `NEXT_PUBLIC_SITE_URL` (Vercel) apunta a él; también responde `unidoar-prototipo.vercel.app`, que sirve para `/api/salud` pero no para registrarse. En el código no hay ninguna dirección fija: todo sale de esa variable o del host del pedido.
- En Next 16 el antiguo `middleware` se llama **`proxy.ts`** (`src/proxy.ts`). Antes de usar una API de Next, leé la guía correspondiente en `node_modules/next/dist/docs/`.

## Comandos

```bash
pnpm dev            # servidor local
pnpm typecheck      # tsc --noEmit  (correrlo siempre antes de dar algo por hecho)
pnpm lint
pnpm test           # pruebas de la lógica pura (src/**/*.test.ts, node:test vía tsx): sin base, sin red, en menos de un segundo
pnpm db:push        # aplica src/db/schema.ts a la base (desarrollo)
pnpm db:rls         # activa RLS en todas las tablas (correrlo después de cada db:push)
pnpm db:storage     # crea los buckets de Storage
pnpm db:setup       # push + rls + storage + seed, de una
pnpm db:admin --email=<correo> [--rol=institucion]   # da (o quita) el rol admin: entra a /backoffice
pnpm db:vincular --institucion=<correo> --docente=<correo>   # liga cuentas reales de Supabase con los datos demo (rehacer tras cada db:seed)
pnpm db:seed        # catálogos + datos demo (es_demo=true); --solo-catalogos / --borrar-demo
pnpm db:limpiar-archivos [--borrar] [--horas=24] [--usuario=<uuid>]   # lista (y con --borrar elimina) los archivos de Storage que ninguna fila usa
vercel env pull .env.local --yes   # trae las variables de Supabase
```

Las reglas puras (facturación, CSV de contactos, tipos y paths de archivos, validaciones de fechas) tienen su prueba al lado del módulo (`algo.test.ts`): al tocarlas, correr `pnpm test` y sumar el caso que corresponda; si una regla nueva no toca base ni Next, escribirla como función pura para poder probarla así. Lo que toca base, Storage o pantallas se prueba a mano en el navegador.

Las variables viven en `.env.local` (no se commitea). `drizzle-kit` y `tsx` no cargan `.env.local` solos: los scripts `db:*` ya usan `dotenv`.

### Conexión a la base

La app se conecta por el **pooler de sesión** de Supabase (`DATABASE_URL`, puerto 5432, host `*.pooler.supabase.com`, que funciona por IPv4). **No usar el pooler de transacciones (6543)** para la app: con `postgres-js` y Next las consultas se traban de forma intermitente al reutilizar conexiones (lo medimos: 60 s de cuelgue, sesiones "active / ClientRead" que no terminan). La conexión directa (`db.<ref>.supabase.co`) es solo IPv6 y no sirve en redes IPv4 ni en Vercel. El límite lo pone el tamaño del pool de Supabase (por defecto 15 conexiones de servidor, compartidas por todas las instancias de Vercel, también las viejas tras un redeploy): si se agota, las páginas con varias consultas fallan con `EMAXCONNSESSION`. Por eso en Vercel cada instancia usa 2 conexiones (`maxConexiones()` en `src/db/index.ts`, ajustable con `DB_POOL_MAX`) y conviene subir el "Pool Size" en el panel de Supabase. `/api/salud` muestra el estado: variables presentes y si la base conecta, con el código del error.

### Seguridad con Supabase

- La app **no usa la API REST de Supabase para datos**: se conecta directo a Postgres (rol `postgres`, que saltea RLS) desde el servidor. Por eso todas las tablas llevan **RLS activado sin políticas** (`pnpm db:rls`): la clave pública (anon) que viaja al navegador no puede leer ni escribir nada. Una tabla nueva sin RLS queda expuesta: correr `db:rls` después de cada `db:push`.
- La **clave de servicio** (`SUPABASE_SERVICE_ROLE_KEY`) solo se usa en servidor (`src/lib/supabase/admin.ts`); jamás con prefijo `NEXT_PUBLIC_`.
- `usuarios.id` es el uuid de `auth.users`. La sesión se valida con `getClaims()` (JWT) en `src/proxy.ts` y `src/lib/auth.ts`.
- Archivos: las subidas pasan por `/api/subir` (servidor); `publico` se lee por URL pública, `privado` (CV, documentos) solo con URL firmada generada en el servidor.
  - Vercel corta los pedidos de más de ~4,5 MB (`FUNCTION_PAYLOAD_TOO_LARGE`, medido en producción). Por eso el navegador achica las imágenes (hasta 3 intentos de calidad) y los **PDF de más de 4 MB (hasta 10) se suben directo a Storage con una URL firmada**: `/api/subir/firmar` da la URL de una carpeta de paso (`<usuario>/subidas/`), el navegador sube, y `/api/subir/confirmar` mira que sean los bytes de un PDF, que pese lo permitido y que sea de esa cuenta, y recién ahí guarda **esos mismos bytes** en su carpeta definitiva y borra el de paso (si no, lo borra). No se mueve el original porque Storage puede seguir sirviendo una copia vieja de un path ya tocado (se vio en pruebas). Así ningún archivo sin revisar llega a un path que las acciones acepten. Lo que no se confirma queda en `subidas/` hasta que `db:limpiar-archivos` lo barre.
  - Las imágenes que van al bucket `publico` se vuelven a codificar siempre en el navegador: se les saca el EXIF (puede traer el lugar donde se sacó la foto y esas URLs son públicas) y se limitan a 2000 px. Las del `privado` (documentos) se suben tal cual.
  - Los archivos reemplazados o quitados se borran de Storage al guardar: `borrarArchivos(quitados(antes, despues))` (`src/lib/queries/archivos.ts`), que corre después de guardar con éxito, no rompe la acción si falla y no borra un archivo que otra fila siga usando. Una acción nueva que guarde archivos tiene que llamarla, y la columna nueva sumarse a `estaEnUso`.
  - Lo que quedó huérfano igual (subidas abandonadas, o anteriores a esto) se limpia con `pnpm db:limpiar-archivos`: por defecto solo muestra qué borraría; `--borrar` borra. Mira toda la base (no una lista de columnas) y respeta un margen de 24 h para no tocar subidas en curso.
  - Documentación del docente (`docente_detalle.documentos`: `dniFrente`, `dniDorso`, `credencial`, `conducta`, todo en `privado`): se sube en el alta o después desde `/docente/perfil#documentacion` (`actualizarPerfilDocente`). Subir algo nuevo mientras está en `correccion` lo devuelve a `pendiente`, y si queda en revisión avisa a los admins (`avisarAAdmins`). Con la verificación hecha (DNI) o el título verificado no se puede cambiar desde el perfil, y con la verificación rechazada solo queda el certificado: el equipo lo resuelve por Contacto.

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
    correo/               mails de la app: cola, eventos, plantillas, envío por Resend (ver "Correo")
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

### Contactos privados de la institución

`contactos_institucion` (con RLS): profesionales que la institución carga a mano ("Cargar perfil") o por CSV ("Importar CSV") desde Profesionales. **No son docentes**: sin cuenta ni verificación, fuera de las búsquedas y sin cruzarse con los docentes registrados. Se leen y escriben siempre filtrando por la `institucion_id` de la sesión, y los gestiona cualquiera del equipo. Aparecen en la lista con origen "Cargado por vos" (`FilaBase.contacto`) y en su propia pestaña.
- Reglas de validación y lectura del CSV en `src/lib/contactos.ts`, compartidas con el navegador (que arma la vista previa); el servidor (`src/app/actions/contactos.ts`) vuelve a validar todo.
- Hasta 500 filas por archivo (512 KB) y 2000 contactos por institución. Hace falta nombre y un email o un teléfono. No se duplican por email ni, si la fila no tiene email, por teléfono (`claveDeTelefono` reconoce un mismo número escrito de distinta forma). El CSV acepta coma, punto y coma o tabulación y UTF-8 o Windows-1252 (el Excel en español).
- Son datos personales de gente que no tiene cuenta: tenerlo presente al redactar los términos y la política de privacidad.

### Cuenta, ingreso y registro

- **Mi cuenta** existe para docente (`/docente/cuenta`) e institución (`/institucion/cuenta`): email de acceso, contraseña, avisos por mail (interruptor `cambiarAvisosPorCorreo`) y pedido de baja. Contraseña y email son acciones de cualquier rol (`src/app/actions/cuenta.ts`). La baja, tanto de la institución (`actions/institucion.ts`) como del docente (`actions/cuenta.ts`), es un **pedido**, no un borrado: queda en auditoría (`cuenta.baja_solicitada`), avisa a los admins y la procesa el equipo a mano; la ficha del backoffice muestra "Baja solicitada".
- **Cambio de email:** `cambiarEmail` pide la contraseña actual y deja que Supabase mande el enlace de confirmación; no cambia nada hasta que se confirma. Cuando la sesión ya trae el email nuevo, `usuarioActual()` pone al día `usuarios.email`, el contacto del perfil de docente (solo si era el mismo que el de la cuenta) y la membresía de equipo (`sincronizarEmailDeCuenta`, `src/lib/queries/email-cuenta.ts`). Quien ingresa solo con Google no puede cambiarlo. **Sin probar de punta a punta con un mail real** (hace falta el correo de producción funcionando).
- **Términos:** `usuarios.terminos_aceptados_en` y `terminos_version` guardan cuándo se aceptaron y cuál era la versión (`src/lib/terminos.ts`). El docente que se registra con email la lleva en `user_metadata`; con Google, en una cookie de una hora; en los dos casos se copia al crear la fila `usuarios` (`asegurarUsuario`). La institución la deja en el paso 2. **Al cambiar el texto de `/terminos`, subir `VERSION_TERMINOS` y `TERMINOS_ACTUALIZADOS`.** Las cuentas anteriores a este registro quedan sin constancia (null).
- **Google:** el botón "Continuar con Google" se muestra solo si Supabase informa el proveedor como activado (`googleHabilitado()`, lee `/auth/v1/settings` y guarda 5 minutos): no hay una variable aparte que cambiar.
- **Redirecciones:** todo destino que llega desde el navegador (`?next=`) se valida con `rutaInternaSegura` (`src/lib/acceso.ts`, con pruebas). Una versión anterior dejaba pasar `/..//sitio.com` (quedaba `//sitio.com` al normalizar y mandaba a otro dominio): si se toca, correr `pnpm test`.
- **Contraseñas:** el registro pide repetirla y todos los campos tienen "Ver / Ocultar" (`InputContrasena`).
- **Privacidad:** `/privacidad` describe lo que el sistema hace con los datos (quién ve qué, documentos, proveedores, cookies). Hay que actualizarla, y su fecha (`PRIVACIDAD_ACTUALIZADA`), cuando cambie ese comportamiento. Es un borrador técnico sin revisión legal: faltan, por ejemplo, la identificación del responsable del tratamiento, el registro de la base ante la AAIP y la cláusula de transferencia a servidores en Brasil.

### Correo

Dos canales que no se mezclan: los mails de **Auth** (confirmación, recuperación, cambio de email, avisos de seguridad) los manda Supabase con las plantillas de `supabase/plantillas-correo/`; **todo lo demás** lo manda nuestro código por la API de Resend (sin SDK). Guía completa: `docs/correo.md`; qué mail existe y a quién llega: `docs/inventario-de-mails.md` (los IDs M06, M24… son los del código).

- **Cola ("outbox"):** `cola_correos` (creada a mano con RLS: Drizzle no lo conoce y un `db:push` llegó a apagárselo, así que **después de cualquier `db:push` correr `db:rls` y confirmar que ninguna tabla pública quedó sin RLS**). Las acciones llaman a `encolarParaUsuarios` / `encolarParaEquipo` / `encolarCorreo` (`src/lib/correo/cola.ts`), casi siempre a través de una función de `src/lib/correo/eventos.ts`, **dentro de su transacción**: si se deshace, el mail no existe. `encolar…` deja pedido el despacho con `after()` (corre con la transacción ya confirmada), así que las acciones no llaman a nada más. Los reintentos y los mails vencidos (48 h) los resuelve el cron `/api/cron/correos` (13:00 UTC), que también anota los recordatorios M51/M52 y purga el historial a los 90 días.
- **Apagado sin clave:** sin `RESEND_API_KEY` (o con `CORREO_MODO=apagado`) no se anota ni se manda nada; `CORREO_MODO=consola` solo imprime, para probar. `/api/salud` muestra el modo en `correo`. Variables y pasos para encenderlo: `docs/correo.md`.
- **Plantillas** (`src/lib/correo/plantillas.ts`, código puro con pruebas): el texto de las personas se escapa siempre y va como `Parte` o `cita`, nunca pegado en el HTML. Las rutas de los enlaces son internas y se arman contra `NEXT_PUBLIC_SITE_URL`; una ruta externa hace fallar ese mail. Un mail nuevo = su ID en `DatosDe` y `PLANTILLAS`, un ejemplo en `plantillas.test.ts`, una función en `eventos.ts` con su **clave de no-repetición**, y el inventario y `/privacidad` al día.
- **Cerrar una búsqueda avisa en la campanita, sin mail** (a propósito): `avisarCierreDeBusqueda` (`src/lib/queries/avisos.ts`; texto en `textoDeCierreDeBusqueda`, `src/lib/postulaciones.ts`) lo llaman `cerrarBusqueda` y `contratarPostulacion` con "cerrar". Avisa a quienes estaban en la búsqueda con cuenta y sin suspender, menos al contratado, y no repite en el día.
- **Quién decide si sale:** el grupo `contratacion` (invitaciones, urgentes, preselección, entrevistas, ofertas, postulantes nuevos) respeta `usuarios.avisos_por_correo` (interruptor en Mi cuenta y enlace de baja firmado, `/avisos/baja` + `/api/avisos/baja` para el POST de un clic); cuenta, verificación, facturación e internos no se pueden apagar. Hay topes (M21: 3 por día por persona, M06, M60, M61) y los **contactos privados de las instituciones no reciben nunca ningún mail**. **Archivar a un postulante (etapa interna `descartado`) es silencioso a propósito: no se le avisa ni en la campanita ni por mail** (no existe un M28); se entera, si la búsqueda se cierra, por el aviso de cierre.
- **La base local es la de producción y el envío de producción está encendido:** una fila pendiente de `cola_correos` que quede de una prueba la puede despachar producción de verdad (cualquier acción o el cron). Probar solo con `CORREO_MODO=consola` y direcciones propias, y borrar las filas al terminar.
- Facturación y plan salen desde `facturacion@` a dueño y administradores (`destinatariosDeFacturacion`); Contacto, documentación, bajas y pedidos de plan van al equipo (`CORREO_EQUIPO` o las cuentas admin, con "responder a" la persona en Contacto).

## Diseño

Alta fidelidad al prototipo. Tokens de marca ya definidos como tema de Tailwind (`src/app/globals.css`): `navy-*`, `naranja`, `ambar`, `celeste`, `rosa`, `verde`, `app`, `superficie`, `borde`, `tinta`, `apagado`, `sutil`. Tipografía: Inter (cuerpo) y Sora (títulos display, `font-display`). Botones con altura mínima 46/34/52px (`<Boton tamano>`), nunca "finitos". El HTML de cada pantalla del prototipo está en `prototipo/index.html` (mapa de líneas en `HANDOFF.md` y por `isXxx`); portá estructura, copy y estilos a Tailwind, no el runtime. Breakpoints responsive del prototipo: 560 / 640 / 760 / 860 / 900 / 1000 px.

Copy en español rioplatense (voseo: "Publicá", "Elegí"). Accesibilidad: controles reales (`button`/`a`), `label` en inputs, foco visible, contraste AA.

## Estado de la migración

**Hecho (71 páginas):** sitio público; registro, ingreso y altas; área docente completa (dashboard, buscar trabajo con mapa, postulaciones, instituciones, cursos, perfil, notificaciones); área institución completa (dashboard, publicar, publicaciones, tablero de postulantes, buscador de profesionales, base de profesionales con contactos propios, perfil/vitrina, cursos, equipo con invitaciones, plan, cuenta); backoffice (operación, verificación, docentes, instituciones, categorías, cobros, mensajes). El ciclo núcleo se probó de punta a punta en el navegador con una cuenta de institución y una de docente.

**Pendiente:**
- **Cobro real:** no hay pasarela de pago. "Cambiar de plan" crea un pedido (`solicitudes_plan`) que el backoffice atiende; los pagos se registran a mano. Las facturas de cada mes las crea solo el cron `/api/cron/facturas` (ver abajo); la **primera** factura de cada cuenta la carga el equipo. Integrar Mercado Pago.
- **Facturas automáticas:** `vercel.json` programa `GET /api/cron/facturas` todos los días a las 12:00 UTC (9:00 en Argentina). Exige `Authorization: Bearer $CRON_SECRET` (variable de Vercel, mínimo 16 caracteres; sin ella responde 401 siempre; `/api/salud` muestra `tareasProgramadas.CRON_SECRET`). Crea la factura del mes en curso (`generarFacturasDelPeriodo`, reglas en `planificarFacturas` de `src/lib/cobros.ts`) solo para instituciones no suspendidas, que no son demo y que **ya tienen alguna factura**; nace pendiente, con el monto del plan y el día de cobro de la institución. Es idempotente (índice único por institución y mes), un plan anual cubre 12 meses, y deja auditoría sin usuario (`origen: automatica`). No marca vencidas. Anota el mail M50 (factura disponible) para dueño y administradores; los recordatorios M51/M52 los anota `/api/cron/correos`.
- **Correo, estado (2026-10-08):** el envío de la app está **encendido en producción** (Resend, dominio `unidoar.com.ar` verificado con DKIM/retorno/DMARC `p=none` en el DNS de Vercel; `/api/salud` → `correo: "resend"`). Se probó de verdad el mail de Contacto (M60) al equipo. El SMTP de Supabase con Resend y las plantillas de Auth (`docs/supabase-auth.md`) están configurados y **Supabase ya manda** (verificado el 2026-10-08: un pedido de recuperación devuelve 200; antes devolvía 500 "Error sending recovery email" con `535 Authentication credentials invalid` en los logs de Auth, por una API key mal pegada en el SMTP). Si la app muestra "No pudimos mandarte el mail…" es esto: ver "Si el mail no sale" en esa guía. **Registro de institución probado de punta a punta en producción (2026-10-08, `flor+institucion@cambalache.studio`):** llegó el mail de confirmación, se confirmó, se creó la fila `usuarios` y quedó la constancia de términos (`2026-09`). También se probó con envío real el pipeline (mover una postulación a Oferta y de vuelta a Preseleccionados: notificación en la campanita y mails M26/M23 `enviado` por Resend en el primer intento) y el interruptor de Avisos por mail de Mi cuenta. Las 13 plantillas de Supabase Auth (las 6 de autenticación y las 7 de avisos de seguridad) están en `supabase/plantillas-correo/` para que no salga ningún mail en inglés. Falta ver llegar y revisar el aspecto de una recuperación de contraseña y un cambio de email reales, y el registro de docente (con y sin Google), antes de abrir al público. Pendientes: buzones reales de `hola@` y `facturacion@` (mientras tanto las respuestas a los mails automáticos se pierden salvo que se cargue `CORREO_RESPONDER_A`, `CORREO_RESPONDER_A_FACTURACION` y `CORREO_EQUIPO` en Vercel; sin `CORREO_EQUIPO` los internos van a los emails de las cuentas admin), el mail público del sitio (`CONTACTO_SITIO.email` en `src/lib/publico.ts` dice `hola@unidoar.com`, sin `.ar`), la reputación del dominio nuevo (spam) y el resto del inventario (bienvenida, resúmenes, cursos…, reenviar invitaciones).
- Lectura automática del CV, material adjunto de cursos, y las vistas mobile "app" (`/app/docente`, `/app/institucion`).
- Login con Google: hay que crear las credenciales en Google Cloud y activarlo en Supabase; el botón aparece solo cuando Supabase lo tiene activado.
- Protección contra bots en el registro (captcha de Supabase): conviene activarla antes de abrir al público, porque con la confirmación por mail alguien podría gastar la cuota de envíos.
- Rendimiento: las páginas de contenido (`/planes`, `/terminos`…) se generan en cada visita porque la cabecera consulta la sesión; se puede cachear con Partial Prerendering.
- Las acciones de las cuentas suspendidas se filtran con `src/lib/visibilidad.ts`: sumar ahí cualquier condición nueva de visibilidad. Un docente suspendido que sigue en el historial de una institución (tablero de postulantes, Profesionales, ficha) se muestra como "Perfil suspendido" y **sin su contacto** (teléfono, email, WhatsApp): un lugar nuevo donde una institución vea el contacto de un docente tiene que ocultarlo con `suspendido`. Además, la ficha (`puedeContactar`) y la lista Profesionales solo muestran el contacto de quien se postuló a una búsqueda de la institución o le mandó su CV.
