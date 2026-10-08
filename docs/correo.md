# Correo de UNIDOAR

Hay dos canales de mail y no se mezclan:

| Canal | Qué manda | Quién lo manda | Dónde se configura |
|---|---|---|---|
| **Auth** | Confirmación de email, recuperación de contraseña, cambio de email y avisos de seguridad | Supabase | [supabase-auth.md](supabase-auth.md) y `supabase/plantillas-correo/` |
| **App** | Todo lo demás: verificación, contratación, facturación, invitaciones al equipo y avisos internos | Nuestro código, por la API de **Resend** | Este documento |

El inventario completo (qué mail existe, cuándo sale y a quién) está en [inventario-de-mails.md](inventario-de-mails.md); los IDs (M06, M24…) son los mismos en el código.

## Cómo funciona

```
acción (server action) ──► encolar…()  ──► cola_correos ──► after() ──► Resend ──► bandeja
   dentro de la transacción     fila "pendiente"     (cuando ya respondió)
```

1. **Se anota, no se manda.** La acción que origina el mail (una contratación, un pago, un pedido de baja…) llama a una función `encolar…` o a una de `src/lib/correo/eventos.ts` **dentro de su misma transacción**. Si la transacción se deshace, el mail no existe.
2. **Se despacha solo.** `encolar…` deja pedido un `after()` que corre cuando la respuesta de la acción ya terminó (la transacción ya está confirmada) y manda lo pendiente. Las acciones no tienen que acordarse de nada.
3. **Se reintenta.** Si Resend falla o la instancia se corta, la fila queda `pendiente` (hasta 5 intentos). La retoma el próximo despacho de cualquier acción o la tarea diaria `/api/cron/correos` (13:00 UTC, 10:00 en Argentina). Lo que lleva más de **48 horas** sin salir se descarta: un aviso viejo ya no sirve.
4. **Queda registro.** `cola_correos` guarda a quién, qué plantilla, con qué datos y cómo terminó (`enviado`, `omitido`, `fallido` y el motivo). La tarea diaria borra lo cerrado hace más de **90 días** (los datos llevan nombres y motivos). Está dicho en `/privacidad`.

El envío de dos despachos a la vez es seguro: cada mail se reclama con `FOR UPDATE SKIP LOCKED`, y a Resend se le manda `Idempotency-Key` con el id de la fila, así que un reintento no duplica el mail.

### Reglas que aplica el despacho

- **Avisos opcionales** (grupo `contratacion`: invitaciones, urgentes, preselección, entrevistas, ofertas, postulantes nuevos): no se mandan si la persona los apagó en **Mi cuenta → Avisos por mail** o con el enlace del pie (`usuarios.avisos_por_correo`). Llevan ese enlace y las cabeceras `List-Unsubscribe` / `List-Unsubscribe-Post` (baja de un clic). Los de cuenta, verificación, facturación e internos **no se pueden apagar**.
- **No repetir:** cada mail puede llevar una `clave`; no se anotan dos filas con la misma clave para el mismo destinatario (índice único `cola_correos_clave_uq`). Es lo que hace que una postulación se avise una sola vez, que M30 sea uno por búsqueda por día (por hora en las búsquedas rápidas) y que cada recordatorio de factura salga una vez.
- **Topes:** la plantilla puede definir `tope: { max, horas }` y el mail una `topeClave`: M21 (3 por día por persona), M06 (20 por día por institución), M60 (20 por hora en total, para que Contacto no llene la casilla del equipo) y M61 (30 por hora). Lo que excede se **omite** (queda anotado el motivo).
- **Contactos privados de una institución** (`contactos_institucion`) **no reciben nunca** ningún mail: no tienen cuenta ni dieron su consentimiento. Ninguna función de `eventos.ts` los toca.
- **Rutas de los enlaces:** se guardan como ruta interna (`/docente/perfil`) y al armar el mail se convierten en URL del sitio. Una ruta que apunte a otro sitio hace fallar ese mail (nunca se manda).
- **Sin seguimiento:** no hay píxeles ni enlaces con redirección. Revisá que en Resend esté desactivado el seguimiento de aperturas y clics del dominio.

## Variables de entorno

Todas son opcionales: **sin `RESEND_API_KEY` el envío está apagado** (no se manda ni se anota nada, así no se junta una cola que nadie despacha). `/api/salud` muestra el modo en `correo`.

| Variable | Para qué | Por defecto |
|---|---|---|
| `RESEND_API_KEY` | Clave de Resend (solo permiso de envío). Enciende el modo `resend` | — |
| `CORREO_MODO` | `consola` (imprime en el log en vez de enviar, para probar) o `apagado` | `resend` si hay clave |
| `CORREO_DE` | Remitente de los mails automáticos | `UNIDOAR <no-responder@unidoar.com.ar>` |
| `CORREO_RESPONDER_A` | A dónde llegan las respuestas | `hola@unidoar.com.ar` |
| `CORREO_DE_FACTURACION` | Remitente de los mails de facturación y plan | `UNIDOAR Facturación <facturacion@unidoar.com.ar>` |
| `CORREO_RESPONDER_A_FACTURACION` | Respuestas de facturación | `facturacion@unidoar.com.ar` |
| `CORREO_EQUIPO` | Destinatarios de los avisos internos (coma o espacio) | los emails de las cuentas admin |
| `CORREO_AVISAR_DESCARTES` | `si`: se le manda mail al docente al que se descarta (M28) | apagado |
| `CORREO_SECRETO` | Clave para firmar los enlaces de baja de avisos | la clave de servicio de Supabase |
| `NEXT_PUBLIC_SITE_URL` | Origen de los enlaces de los mails | el dominio de producción de Vercel |

## Activarlo en producción

1. **Dominio en Resend.** En Resend → Domains, agregá el dominio (por ejemplo `unidoar.com.ar`) y cargá en su DNS los registros que indica (SPF, DKIM y, si lo pide, el de retorno). Hasta que figure como *Verified* no se puede enviar desde `@unidoar.com.ar`. Mientras tanto, para probar, se puede usar un remitente de un dominio ya verificado (por ejemplo el de `cambalache.studio`) en `CORREO_DE` y `CORREO_DE_FACTURACION`.
2. **Clave.** En Resend → API Keys, creá una con permiso **Sending access** limitado a ese dominio.
3. **Variables en Vercel** (Production): `RESEND_API_KEY`, y las `CORREO_*` que quieras pisar. Si el dominio público es otro que el de Vercel, `NEXT_PUBLIC_SITE_URL` también. Redeployá.
4. **Verificá** `https://<sitio>/api/salud`: `correo` tiene que decir `"resend"`.
5. **Probá un mail real:** el formulario de `/contacto` manda un M60 al equipo en segundos; en Resend → Emails se ve el envío.
6. **Supabase Auth** usa su propio SMTP (con la misma cuenta de Resend): guía en [supabase-auth.md](supabase-auth.md).
7. Revisá los límites vigentes del plan de Resend (mails por día y por mes) contra el volumen esperado antes de abrir al público.

## Probar sin mandar nada

Con `CORREO_MODO=consola` el despacho imprime `[correo:consola] { para, asunto… }` en el log del servidor y marca la fila `enviado` (con `resend_id = "consola"`). Para probar en el servidor de desarrollo sin tocar `.env.local`, creá un `.env.development.local` con esa línea y borralo al terminar.

Ojo: **la base local es la de producción y su envío está encendido**. Las filas de prueba de `cola_correos` (y lo que se haya creado para generarlas) se borran a mano al terminar, y mientras existan, un despacho de producción (cualquier acción o el cron) las puede mandar de verdad. Probar solo con direcciones propias.

Las plantillas son código puro y tienen pruebas (`pnpm test`): `src/lib/correo/*.test.ts` (armado y escape, rutas, firma de baja, modos, claves y recordatorios, respuesta de Resend).

## Mails que ya salen

| ID | Cuándo | Para | Grupo |
|---|---|---|---|
| M06 | Se invita a alguien al equipo | La persona invitada (aunque no tenga cuenta) | cuenta |
| M11, M12, M13 | El equipo verifica, pide corregir o rechaza el perfil del docente | El docente | cuenta |
| M15 | El equipo suspende una cuenta | El docente, o todo el equipo de la institución | cuenta |
| M20 | Una institución invita a un docente a postularse | El docente | contratación |
| M21 | Se publica una búsqueda **rápida** que encaja | Docentes que encajan (tope 3 por día) | contratación |
| M23, M26 | Pasa a Preseleccionados / se le envía una oferta | El docente (una vez por postulación) | contratación |
| M24, M25 | Se agenda (o reprograma) / se cancela la entrevista | El docente | contratación |
| M27 | Lo contratan | El docente | contratación |
| M28 | Lo descartan | El docente — **apagado salvo `CORREO_AVISAR_DESCARTES=si`** | contratación |
| M30 | Se postula alguien | Quienes tienen acceso a la institución (uno por búsqueda por día; por hora en las rápidas) | contratación |
| M50 | Se crea una factura (cron o carga manual) | Dueño y administradores | facturación |
| M51, M52 | Falta poco para el vencimiento / está vencida (y a los 7 días) | Dueño y administradores | facturación |
| M53, M54 | Se registra un pago / se anula (si el equipo pidió avisar) | Dueño y administradores | facturación |
| M55 | Se pide un cambio de plan | Quien lo pidió | facturación |
| M56 | Se aprueba o rechaza el cambio de plan | Dueño y administradores | facturación |
| M60 | Mensaje desde Contacto | El equipo (responder a este mail contesta a la persona) | interno |
| M61 | Un docente sube documentación para revisar | El equipo | interno |
| M62 | Una cuenta pide la baja | El equipo | interno |
| M63 | Una institución pide cambiar de plan | El equipo | interno |

**Cerrar una búsqueda no manda mail:** avisa solo en la campanita (`avisarCierreDeBusqueda`, `src/lib/queries/avisos.ts`) a todos los que estaban en ella con cuenta y sin suspender, menos a quien fue contratado: "cerró la búsqueda «X»: el puesto ya se cubrió. ¡Gracias por postularte! Seguí postulándote a otras búsquedas." (a quien fue invitado y no se postuló, sin el "gracias por postularte"). Pasa al cerrarla con "Cerrar búsqueda" y al contratar con la casilla de cerrar; no se repite si se reabre y se vuelve a cerrar el mismo día. Es una decisión de producto: si algún día se quiere mail, sería un mail nuevo del grupo contratación.

Los recordatorios M51/M52 los anota la tarea diaria para las facturas impagas de instituciones activas (ni suspendidas ni de demostración) que vencen en los próximos 3 días o vencieron en los últimos 30. Una deuda más vieja no se recuerda por mail.

## Agregar un mail nuevo

1. Sumar su ID a `DatosDe` y su definición a `PLANTILLAS` en `src/lib/correo/plantillas.ts` (grupo, remitente, tope si hace falta y el contenido). Los textos de personas **no se concatenan en HTML**: van como `Parte` (`n(texto)` para negrita) o en `cita`, y se escapan solos.
2. Sumarle un ejemplo en `plantillas.test.ts` (la prueba falla si falta).
3. Agregar una función en `src/lib/correo/eventos.ts` que arme los datos y la `clave` (¿cuántas veces puede llegar lo mismo?), y llamarla desde la acción **dentro de su transacción**. Para un aviso interno, `encolarParaEquipo`.
4. Actualizar `docs/inventario-de-mails.md` y la tabla de arriba. Si cambia lo que se hace con los datos, también `/privacidad`.

## Pendiente

- Los mails que el inventario deja para después: bienvenida (M07), recibimos tu documentación (M10), institución verificada (M14), cuenta reactivada (M16), baja recibida y confirmada (M17–M18), búsquedas que encajan (M22) y los resúmenes semanales (M70–M72), CV recibido y equipo (M31–M34), cursos (M40–M43), plan cambiado por el equipo (M57), los internos M64–M66.
- **Reenviar una invitación al equipo** (hoy se manda al crearla; si no llega, se copia el enlace del panel).
- M30 avisa de la **primera** postulación del día por búsqueda; un resumen con la cantidad requeriría una tarea más.
- Archivo de calendario (`.ics`) en M24.
