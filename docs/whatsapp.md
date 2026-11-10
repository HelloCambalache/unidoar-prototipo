# Avisos por WhatsApp (API de WhatsApp Business de Meta)

UNIDOAR le manda por WhatsApp a quien lo pidió los avisos que ya salen por la campanita y por mail: **preselección, entrevista y oferta** (al profesional) y **postulantes nuevos y respuesta a una entrevista** (a la institución). Son siempre avisos de utilidad (algo que la persona hizo o espera): nada de promociones.

Todo está construido y **apagado**: sin las variables de abajo no se anota ni se manda nada, y las pantallas no ofrecen activarlo (la tarjeta «Avisos por WhatsApp» de Mi cuenta aparece sola cuando está en marcha). El código vive en `src/lib/whatsapp/` (reglas puras con prueba, cola, envío, webhook), la ruta del webhook en `src/app/api/whatsapp/webhook/route.ts` y el consentimiento en `src/lib/queries/whatsapp.ts` + `src/app/actions/whatsapp.ts`.

## Cómo funciona

- **Cola igual que la de mails** (`cola_whatsapp`): la acción anota el aviso dentro de su transacción (si se deshace, no sale) y se manda después con `after()`; el cron diario (`/api/cron/correos`) reintenta y purga (90 días). Lo que lleva más de 24 horas sin salir se descarta.
- **Sin consentimiento no sale nada.** La casilla de Mi cuenta viene apagada y activarla exige escribir el celular: el consentimiento queda atado a ESE número (`consentimientos_whatsapp`). Un teléfono del perfil o del alta no cuenta como permiso. Se vuelve a comprobar al mandar (si retiró el consentimiento o cambió de número mientras esperaba, no sale).
- **Baja:** desde Mi cuenta, o respondiendo **BAJA** (también «STOP», «PARAR», «CANCELAR») al número: el webhook retira el consentimiento de ese número y confirma. Cualquier otro mensaje que llegue recibe, una vez por día, «este número solo envía avisos y no recibe consultas…» (`RESPUESTA_AUTOMATICA`). **Nadie lee las respuestas**: si el cliente decide que alguien las atienda, hay que cambiar esto.
- **Topes:** 8 avisos por día a un mismo número (`TOPE_POR_NUMERO_POR_DIA`); un aviso de postulantes nuevos por búsqueda y por día (por hora en las rápidas); nunca a un profesional suspendido.
- **Un corte sin respuesta de Meta NO se reintenta**: la API no tiene clave de idempotencia y no hay forma de saber si el mensaje salió; un aviso que se pierde es mejor que uno repetido. Un 429/5xx o un código de «demasiados pedidos» sí se reintenta (hasta 3 veces).
- **Privacidad:** el teléfono es un dato personal. La baja de una cuenta (profesional, institución o alta sin terminar) borra su consentimiento y sus avisos; el historial de avisos se purga a los 90 días y en los logs el número sale enmascarado («••• 5876»).

## Lo que ya está hecho en Meta

| Qué | Valor |
|---|---|
| Portfolio comercial | «Unidoar» (`2102044603754959`), con nombre legal, domicilio, teléfono, sitio y CUIT cargados (sin verificar todavía) |
| App | «UNIDOAR avisos» (`1895219261693810`), en desarrollo |
| Cuenta de WhatsApp (WABA) | «Unidoar» (`2449721605557155`); la «Test Messaging Account» (`1717845163030502`) es aparte |
| Número | +54 9 11 7742-9611, nombre «Unidoar», estado Conectado |
| **Phone Number ID** | `1486649791194102` (es lo que va en `WHATSAPP_PHONE_NUMBER_ID`) |

## Variables de entorno (Vercel → Production)

Las carga una persona en Vercel; **ninguna pasa por el chat, un commit ni un log**.

| Variable | Qué es | De dónde sale |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | `1486649791194102` | Panel de la app → WhatsApp → Configuración de la API |
| `WHATSAPP_TOKEN` | Token **permanente** | Configuración del negocio → Usuarios → **Usuarios del sistema** → crear uno (rol Admin) → asignarle la app «UNIDOAR avisos» y la cuenta de WhatsApp «Unidoar» con control total → **Generar token** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, sin vencimiento |
| `WHATSAPP_APP_SECRET` | Clave secreta de la app | Panel de la app → Configuración de la app → Básica → «Clave secreta de la app» |
| `WHATSAPP_VERIFY_TOKEN` | Un texto largo al azar que inventás vos | El mismo texto va en Meta al configurar el webhook |
| `WHATSAPP_MODO` | (opcional) `consola` para probar sin mandar, `apagado` para cortar | |
| `WHATSAPP_API_VERSION` | (opcional) por defecto `v23.0` | |

`/api/salud` no muestra estas variables todavía; sin `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` todo queda apagado.

## Webhook

- **URL de devolución de llamada:** `https://www.unidoar.com.ar/api/whatsapp/webhook`
- **Token de verificación:** el valor de `WHATSAPP_VERIFY_TOKEN`.
- Panel de la app → WhatsApp → Configuración → Webhooks → **Verificar y guardar**, y suscribir el campo **`messages`** (estados de entrega y mensajes entrantes). Después, activar «Suscribir webhooks» en la cuenta «Unidoar» (Paso 2 → «Registra tu número»).
- **La firma se comprueba siempre** (`X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`) y bloquea: sin clave responde 503 y sin firma válida, 401. Mientras la app de Meta esté «En desarrollo» solo llegan webhooks de prueba; para los de producción hay que **publicar la app** (modo Activo).

## Plantillas (hay que crearlas y que Meta las apruebe)

Se crean en **WhatsApp Manager → Administrar plantillas → Crear plantilla**. Para todas: **categoría Utilidad**, **idioma Español (Argentina)** (`es_AR`), sin encabezado ni pie, **un botón «Visitar sitio web» con URL dinámica**: `https://www.unidoar.com.ar/{{1}}`, con el ejemplo de la ruta. El texto y los ejemplos tienen que ser IDÉNTICOS a `src/lib/whatsapp/plantillas.ts` (una prueba cuida las reglas de Meta; si se cambia un texto hay que crear otra plantilla con otro nombre).

**1. `unidoar_preseleccion`** — botón «Ver postulación»
> Novedad en tu postulación: {{1}} te preseleccionó para el puesto «{{2}}». Entrá a UNIDOAR para ver el detalle.

Ejemplos: `Colegio San Andrés`, `Profesor de Educación Física`. Ejemplo del botón: `docente/postulaciones?abrir=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42`

**2. `unidoar_entrevista`** — botón «Ver entrevista»
> Tenés una entrevista con {{1}} para el puesto «{{2}}»: {{3}}. Entrá a UNIDOAR para confirmar si podés ir.

Ejemplos: `Colegio San Andrés`, `Profesor de Educación Física`, `martes 12 de noviembre, 15:30`. Botón: igual que el 1.

**3. `unidoar_oferta`** — botón «Ver oferta»
> Novedad en tu postulación: {{1}} te hizo una oferta para el puesto «{{2}}». Entrá a UNIDOAR para revisarla y responder.

Ejemplos: `Colegio San Andrés`, `Profesor de Educación Física`. Botón: igual que el 1.

**4. `unidoar_postulantes`** — botón «Ver postulantes»
> Recibiste una postulación nueva para tu búsqueda «{{1}}». Entrá a UNIDOAR para ver el detalle.

Ejemplo: `Profesor de Educación Física`. Ejemplo del botón: `institucion/postulantes?busqueda=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42`

**5. `unidoar_respuesta_entrevista`** — botón «Ver postulantes»
> Novedad en tu entrevista para «{{1}}»: {{2}} {{3}}. Entrá a UNIDOAR para ver el detalle.

Ejemplos: `Profesor de Educación Física`, `María Gómez`, `confirmó que va`. Botón: igual que el 4.

**Estado (2026-11-10): las 5 se crearon y se enviaron a revisión desde WhatsApp Manager** (Utilidad, Spanish (ARG), botón «Visitar sitio web» con URL dinámica y su URL de muestra), cada una con **«Período de validez del mensaje» en 12 horas** (el máximo; por defecto son 10 minutos y un aviso a un celular apagado se perdería). Al enviar, Meta **comprueba la categoría contra el texto**: la primera redacción de la 4 («Hay postulantes nuevos para tu búsqueda…») salió marcada «La categoría no coincide» (la tomaba por Marketing, estilo alerta de empleos, y la iba a rechazar como Utilidad), así que se reescribió como un aviso de algo recibido («Recibiste una postulación nueva…»). Las otras cuatro pasaron sin esa advertencia. **Si se vuelve a escribir un texto, conviene crearlo igual y mirar si Meta objeta la categoría antes de confirmar: no confirmar nunca como Marketing** (cuesta más del doble y exige otro tipo de consentimiento).

Reglas de Meta que ya cumplen los textos: el cuerpo no empieza ni termina con una variable, las variables van en orden, no hay saltos de línea ni espacios de más. Meta puede **reclasificar** una plantilla de utilidad a marketing (cuesta más que una de utilidad) con un día de aviso. Una plantilla aprobada puede tardar de minutos a un día.

## Puesta en marcha, en orden

1. **ANTES de desplegar el código:** `pnpm db:whatsapp` (crea `consentimientos_whatsapp` y `cola_whatsapp`, con RLS; aditivo e idempotente). Sin las tablas, la baja de una cuenta falla.
2. Desplegar. Con las variables sin cargar no cambia nada para nadie.
3. Crear y aprobar las 5 plantillas (arriba).
4. Cargar el método de pago en WhatsApp Manager (**sin tarjeta Meta no deja mandar avisos iniciados por la empresa**, solo recibir).
5. Cargar `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN`; configurar el webhook en Meta.
6. Probar sin mandar: en local, `WHATSAPP_MODO=consola` imprime cada aviso (con el número enmascarado). Para probar con el servidor local contra producción, la base es la misma: probar solo con cuentas propias.
7. Cargar `WHATSAPP_TOKEN` (último paso: es el que enciende el envío real) y volver a desplegar.
8. Prueba real con el celular propio: activar los avisos en Mi cuenta con un profesional de prueba, preseleccionarlo desde una institución de prueba y ver que llega; escribir «BAJA» y ver que deja de llegar.
9. **Al activar, sumar a la ayuda** (`src/lib/ayuda/profesionales.ts` e `instituciones.ts`, guía «Tu cuenta»): «**Avisos por WhatsApp:** si activás la casilla en Mi cuenta y escribís tu celular, te avisamos por WhatsApp de … Podés dejar de recibirlos desde Mi cuenta o respondiendo BAJA.» (la ayuda solo describe lo que la app hace hoy: por eso no está escrita todavía). Y quitar el «si activaste esos avisos» de la pantalla de la oferta si ya es la regla general.
10. **Avisarle a quien redacta `/privacidad`** (la política es el documento de la titular): Meta (WhatsApp Business Platform) pasa a ser un proveedor que recibe teléfonos y el contenido de los avisos, hay un consentimiento propio y un historial de avisos que se purga a los 90 días.

## Límites y cosas a confirmar

- **Costo (tarifa en pesos de Meta, por mensaje entregado, verificada 2026-11-05):** utilidad AR$ 37,68 y marketing AR$ 89,56; respuestas dentro de las 24 horas, gratis hasta 1.000 por mes. No se pudo confirmar si incluye IVA.
- **Negocio sin verificar:** hasta 250 personas distintas por día y 2 números por empresa (20 al verificar). La verificación del negocio la hace el titular con sus documentos (Paso 3 del panel).
- **Quién lee las respuestas:** hoy nadie (respuesta automática). Decisión pendiente del cliente.
- **Argentina:** el número se guarda y se manda como `549…`; lo que llega de WhatsApp puede venir con o sin el 9, por eso se compara por los últimos 10 dígitos (`claveDeNumero`).
- **Probado:** reglas puras (teléfonos, plantillas, firma, lectura del webhook, estados, baja, tope, consentimiento, envío con una API simulada) y tipos/lint/compilación. **Sin probar contra Meta real:** el envío, el webhook y las plantillas aprobadas.
