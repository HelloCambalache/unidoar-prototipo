# Inventario de mails de UNIDOAR

Los mails que recomendamos que mande el producto, de dónde sale cada uno y en qué orden hacerlos. Se armó a partir de los
eventos que **ya existen** en el código. Cada fila que dice "En la app" ya genera esa notificación (la campanita).

**Estado de la implementación** (cómo funciona y cómo se enciende: [correo.md](correo.md)):

- **Hechos, en el código:** M06, M11, M12, M13, M15, M20, M21, M23, M24, M25, M26, M27, M30, M50, M51, M52, M53, M54, M55, M56, M60, M61, M62 y M63. Salen cuando haya `RESEND_API_KEY`; sin ella no se manda ni se anota nada.
- **Hechos, plantillas para pegar en Supabase:** M01–M05 (`supabase/plantillas-correo/`; falta pegarlas y encender el SMTP: [supabase-auth.md](supabase-auth.md)).
- **Pendientes:** todo lo demás (columna "Prioridad" de cada tabla).

## Criterio

- **Mail solo cuando importa fuera de la app:** la persona tiene que actuar, tiene un plazo, o necesita un comprobante. Lo
  demás queda en la campanita o en un resumen.
- **Nunca un mail de más con datos sensibles:** el motivo de una corrección o un rechazo va en la app; el mail avisa y lleva
  al enlace (el motivo puede ir en el mail porque lo escribió una persona del equipo para ese docente, pero sin datos de
  documentos).
- **Los contactos que carga una institución en Profesionales no reciben nunca ningún mail:** no tienen cuenta ni dieron su
  consentimiento.
- **Prioridad:** **Lanzamiento** (hace falta para abrir al público), **Pronto** (en el primer mes), **Después** (mejora).

Canal: **Auth** = lo manda Supabase (se configuran las plantillas en su panel, con Resend como SMTP). **App** = lo manda
nuestro código con la API de Resend.

## 1. Cuenta y acceso

| ID | Mail | Cuándo | Para | Canal | Hoy | Prioridad |
|---|---|---|---|---|---|---|
| M01 | Confirmá tu email | Al registrarse (y al reenviar) | Docente, institución | Auth | Plantilla lista | Lanzamiento |
| M02 | Recuperá tu contraseña | "¿Olvidaste tu contraseña?" | Cualquiera | Auth | Plantilla lista | Lanzamiento |
| M03 | Confirmá tu email nuevo | Al pedir el cambio de email en Mi cuenta | Email nuevo | Auth | Falta la plantilla en español | Lanzamiento |
| M04 | Se pidió cambiar el email de tu cuenta | Al pedir el cambio (aviso de seguridad) | Email anterior | Auth | Falta activarlo y traducirlo | Lanzamiento |
| M05 | Tu contraseña cambió | Al cambiarla (aviso de seguridad) | Cualquiera | Auth | Falta activarlo y traducirlo | Pronto |
| M06 | Te invitaron a sumarte a {institución} | Al invitar a alguien al equipo | Persona invitada | App | Hoy se copia un enlace a mano | Lanzamiento |
| M07 | Te damos la bienvenida | Al completar el alta | Docente, institución | App | No existe | Pronto |

## 2. Verificación y estado de la cuenta

| ID | Mail | Cuándo | Para | Canal | Hoy | Prioridad |
|---|---|---|---|---|---|---|
| M10 | Recibimos tu documentación | Al terminar el alta con documentos | Docente | App | En la app | Pronto |
| M11 | Tu perfil está verificado | El equipo lo verifica | Docente | App | En la app | Lanzamiento |
| M12 | Necesitamos que corrijas tu documentación (con el motivo) | El equipo pide una corrección | Docente | App | En la app | Lanzamiento |
| M13 | No pudimos verificar tu perfil (con el motivo) | El equipo lo rechaza | Docente | App | En la app | Lanzamiento |
| M14 | Tu institución fue verificada / se quitó la verificación | El equipo cambia el sello | Institución (dueño y equipo) | App | En la app | Pronto |
| M15 | Tu cuenta fue suspendida (motivo y cómo regularizar) | El equipo suspende | Docente, institución | App | En la app | Lanzamiento |
| M16 | Reactivamos tu cuenta | El equipo reactiva | Docente, institución | App | En la app | Pronto |
| M17 | Recibimos tu pedido de baja | Al pedir la baja en Mi cuenta | Docente, institución | App | Solo un aviso en pantalla | Pronto |
| M18 | Tu baja quedó confirmada | El equipo la procesa | Docente, institución | App | No existe (se hace a mano) | Pronto |

M15 importa más de lo que parece: una cuenta suspendida solo ve la pantalla de "cuenta suspendida" y no la campanita.

## 3. Contratación (el corazón del producto)

**Para el docente**

| ID | Mail | Cuándo | Para | Hoy | Prioridad | Notas |
|---|---|---|---|---|---|---|
| M20 | {Institución} te invitó a postularte a {puesto} | La institución lo invita | Docente | En la app | Lanzamiento | |
| M21 | Suplencia urgente cerca tuyo: {puesto} | Se publica una búsqueda rápida que encaja | Docentes con esa zona y asignatura | En la app | Lanzamiento | Tope de 3 por día por persona; el plazo va en el asunto |
| M22 | Nueva búsqueda que encaja con tu perfil | Se publica una búsqueda común | Docentes que encajan | En la app | Después | Mejor dentro del resumen semanal (M70) |
| M23 | Te preseleccionaron para {puesto} | La institución lo mueve a Preseleccionados | Docente | En la app | Pronto | |
| M24 | Entrevista agendada: {fecha y hora} | La institución la agenda | Docente | En la app | Lanzamiento | Con el día y la hora en el asunto; idealmente con archivo de calendario |
| M25 | Se canceló la entrevista | La institución la cancela | Docente | En la app | Lanzamiento | |
| M26 | Recibiste una oferta para {puesto} | La institución la envía | Docente | En la app | Lanzamiento | |
| M27 | ¡Te eligieron para {puesto}! | La institución lo contrata | Docente | En la app | Lanzamiento | |
| — | Te pidieron el examen preocupacional | La institución pasa a la persona a la etapa "Examen preocupacional" | Docente | **Solo campanita, sin mail** (a propósito) | — | Etapa nueva después de Oferta; no tiene plantilla |
| M28 | ~~Actualizaron tu postulación a {puesto} (no sigue)~~ | La institución archiva a un postulante | Docente | **No se avisa, a propósito** | — | Archivar es silencioso: ni mail ni campanita |

**Para la institución**

| ID | Mail | Cuándo | Para | Hoy | Prioridad | Notas |
|---|---|---|---|---|---|---|
| M30 | Tenés postulantes nuevos en {búsqueda} | Se postula alguien | Dueño y equipo con acceso | En la app | Lanzamiento | Agrupado: como máximo uno por búsqueda por día, más uno inmediato en búsquedas rápidas |
| M31 | {Docente} te envió su CV | Un docente le manda el CV | Dueño y equipo | En la app | Pronto | Agrupado en M30 |
| M32 | {Docente} retiró su postulación | Se baja de la búsqueda | Dueño y equipo | En la app | Después | Solo en la app |
| M33 | {Docente} se inscribió a {curso} | Se inscribe | Dueño y equipo | En la app | Después | En un resumen |
| M34 | {Persona} se sumó al equipo | Acepta la invitación | Dueño | En la app | Pronto | |

## 4. Cursos (docente)

| ID | Mail | Cuándo | Para | Hoy | Prioridad |
|---|---|---|---|---|---|
| M40 | Confirmamos tu inscripción a {curso} | Se inscribe | Docente | No existe | Pronto |
| M41 | Cancelaron el curso {curso} | La institución lo borra con inscriptos | Inscriptos | En la app | Pronto |
| M42 | Te enviaron el certificado de {curso} (+puntos) | La institución lo emite | Docente | En la app | Pronto |
| M43 | Mañana empieza {curso} | 24 horas antes | Inscriptos | No existe | Después |

## 5. Facturación y plan (institución)

Van desde `facturacion@unidoar.com.ar`, con ese mismo correo como respuesta. No se pueden desactivar.

| ID | Mail | Cuándo | Para | Hoy | Prioridad |
|---|---|---|---|---|---|
| M50 | Tu factura de {mes} ya está disponible | La crea el cron del día 1 (o el equipo) | Dueño y administradores | No existe | Lanzamiento |
| M51 | Tu factura vence en 3 días | 3 días antes del cobro | Dueño y administradores | Solo recordatorio manual por WhatsApp | Lanzamiento |
| M52 | Tu factura de {mes} está vencida | Pasada la fecha, y un segundo aviso a los 7 días | Dueño y administradores | Solo recordatorio manual por WhatsApp | Lanzamiento |
| M53 | Recibimos tu pago de {mes} | El equipo registra el pago | Dueño y administradores | En la app | Lanzamiento |
| M54 | Corregimos el registro de tu pago | El equipo anula un pago registrado | Dueño y administradores | En la app | Pronto |
| M55 | Recibimos tu pedido de cambio de plan | La institución lo pide | Dueño | No existe | Pronto |
| M56 | Aprobamos tu cambio de plan / no pudimos aprobarlo (con la nota) | El equipo resuelve | Dueño y administradores | En la app | Lanzamiento |
| M57 | Cambiamos el plan de {institución} | El equipo lo cambia | Dueño y administradores | En la app | Pronto |

## 6. Para el equipo de UNIDOAR (internos)

Llegan a un alias del equipo (por ejemplo `equipo@unidoar.com.ar`), no a una persona.

| ID | Mail | Cuándo | Hoy | Prioridad |
|---|---|---|---|---|
| M60 | Mensaje nuevo desde Contacto | Alguien escribe en el formulario | Solo queda guardado en el backoffice: si nadie mira, se pierde | Lanzamiento |
| M61 | {Docente} subió documentación para revisar | Sube DNI, título o certificado | En la app (a los admins) | Lanzamiento |
| M62 | {Cuenta} pidió la baja | Docente o institución | En la app (a los admins) | Lanzamiento |
| M63 | {Institución} pidió cambiar de plan | Lo pide en Plan | En la app (a los admins) | Lanzamiento |
| M64 | Institución nueva con el alta completa | Termina el alta | No existe | Pronto |
| M65 | Resumen diario del equipo | Todas las mañanas | No existe | Pronto |
| M66 | Falló una tarea automática o la base | El cron de facturas devuelve error, o `/api/salud` cae | No existe | Pronto |

M65 reemplaza a la mayoría de los avisos sueltos cuando haya volumen: pendientes de verificación, pagos vencidos y bajas pedidas, en un solo mail.

## 7. Resúmenes (para sumar uso)

| ID | Mail | Frecuencia | Para | Prioridad |
|---|---|---|---|---|
| M70 | Tus oportunidades de la semana: búsquedas nuevas en tus zonas y cuántas instituciones vieron tu perfil | Semanal | Docentes | Después |
| M71 | Tu semana en UNIDOAR: postulantes sin revisar y búsquedas por vencer | Semanal | Instituciones | Después |
| M72 | Terminá tu perfil (falta identidad, CV…) | A los 3 y a los 10 días del alta, una vez cada uno | Docentes con el perfil incompleto | Después |

"{Institución} vio tu perfil" no es un mail aparte: va dentro de M70 para no llenar la bandeja.

## Remitentes recomendados

| Dirección | Para qué | Notas |
|---|---|---|
| `no-responder@unidoar.com.ar` | Todos los mails automáticos de cuenta y contratación | Solo envía. Siempre con `Reply-To: hola@unidoar.com.ar` para que una respuesta no se pierda |
| `hola@unidoar.com.ar` | Contacto del sitio y respuestas | Recibe: con Cloudflare Email Routing se reenvía gratis a tu Gmail. Es la que va en el sitio público |
| `facturacion@unidoar.com.ar` | Mails de la sección 5 y consultas de cobro | Recibe, igual que `hola@` |
| `equipo@unidoar.com.ar` | Destino de los avisos internos (sección 6) | Alias que reenvía a las personas del equipo, así no depende de una sola |

El nombre visible es siempre "UNIDOAR" (o "UNIDOAR Facturación").

## Cómo se implementó (y lo que queda de la propuesta)

1. **Mails de Auth (M01–M05):** plantillas en español en el panel de Supabase, con el SMTP de Resend. Hechas; falta pegarlas y encender los avisos de seguridad.
2. **Mails de la app:** una cola en la base (`cola_correos`): cada mail se anota dentro de la transacción que origina el cambio (si se deshace, no sale) y se manda después, cuando ya respondió la acción, con reintentos y una tarea diaria de respaldo. Plantillas en `src/lib/correo/plantillas.ts`. Es un cambio respecto de la propuesta original (llamar a Resend desde `avisar`), para que ni una caída de Resend rompa una acción ni un mail salga por un cambio que se deshizo.
3. **Preferencias:** hoy un solo interruptor por cuenta (`usuarios.avisos_por_correo`) para el grupo de contratación, en Mi cuenta y con un enlace de baja de un clic en cada mail opcional. Los de cuenta, verificación, facturación e internos no se pueden desactivar. Una preferencia por grupo (cursos, resúmenes) queda para cuando existan esos mails.
4. **Sin seguimiento:** desactivar en Resend el seguimiento de aperturas y clics, para ser coherentes con la política de privacidad (la app no agrega ningún píxel ni redirección).
5. **Topes:** M21 (3 por día por persona), M30 (uno por búsqueda por día, por hora en las rápidas), M06, M60 y M61. Ver [correo.md](correo.md).
6. **Estilo:** español rioplatense, un solo botón por mail, versión en texto plano, sin adjuntos, enlaces siempre al dominio propio y una línea final con "por qué recibís este mail".
7. **Antes de enviar a gente real:** dominio verificado en Resend, y revisar los límites vigentes de su plan gratuito.

## Decisiones tomadas (se pueden cambiar)

- **M28, archivar a un postulante** (antes "descartar"): **no se avisa**, ni por mail ni en la campanita. Se enteran recién si la búsqueda se cierra (aviso de cierre, solo campanita).
- **M30, postulantes nuevos:** **agrupado**: un mail por búsqueda por día (por hora en las rápidas), con el primer postulante del período. No dice cuántos son.
- **Remitente de facturación:** **separado** (`facturacion@`), con ese mismo correo como respuesta; se cambia con `CORREO_DE_FACTURACION`.
- **M06, invitación al equipo:** **se manda por mail** al crear la invitación; el panel sigue mostrando el enlace para copiar por si no llega. El enlace es `/invitacion/<id>` y lleva a la persona **directo a esa institución** (email puesto, sin elegir tipo de cuenta); ver CLAUDE.md, "Invitaciones al equipo".
