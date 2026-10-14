# Supabase Auth en producción: URLs, correo y plantillas

Lo que hay que configurar en el panel de Supabase (proyecto `uurahnorzppcyxvkzabd`) para que el registro, la confirmación de mail y la recuperación de contraseña anden en `https://www.unidoar.com.ar` (el sitio también responde en `unidoar-prototipo.vercel.app`). Nada de esto está en el código: se hace una vez desde el panel. Los nombres de los menús cambian seguido; si no encontrás uno, buscá por el nombre de la sección.

## 1. URLs permitidas

**Authentication → URL Configuration**

- **Site URL:** `https://www.unidoar.com.ar` (con `www`: el dominio sin `www` redirige, y las plantillas de mail arman el logo y los enlaces con esta dirección)
- **Redirect URLs** (una por línea):
  - `https://www.unidoar.com.ar/**`
  - `https://unidoar-prototipo.vercel.app/**`
  - `http://localhost:3000/**` (para seguir probando en local)

Sin esto, el enlace del mail lleva a la Site URL por defecto (`localhost`) o Supabase lo rechaza.

## 2. Correo propio (SMTP)

El correo de prueba que trae Supabase es solo para desarrollo: según su documentación manda muy pocos mails por hora y solo a direcciones del equipo del proyecto. **Con él, una persona real no recibe el mail de confirmación**, y no puede terminar de registrarse. Hace falta un servicio de correo propio. Se usa Resend, la misma cuenta que usa la app para el resto de los mails (tiene plan gratuito; revisá sus límites vigentes, porque las confirmaciones de registro y los mails de la app comparten el cupo):

1. La cuenta de Resend y el dominio `unidoar.com.ar` ya están creados y verificados (registros DKIM, de retorno y DMARC cargados en el DNS de Vercel; ver [correo.md](correo.md)).
2. **API Keys → Create API Key** con permiso de **Sending access**, **una clave aparte para Supabase** (por ejemplo "supabase-auth"): así se puede revocar una sin afectar a la otra. Copiarla: se muestra una sola vez.
3. En Resend, en el dominio, dejá **desactivado** el seguimiento de aperturas y clics (la política de privacidad dice que no hay seguimiento).
4. En Supabase, **Authentication → Emails → SMTP Settings** (en versiones anteriores: Project Settings → Authentication → SMTP) y activar **Enable custom SMTP**:

   | Campo | Valor |
   |---|---|
   | Sender email | `no-responder@unidoar.com.ar` |
   | Sender name | `UNIDOAR` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | la API key del paso 2 |

5. **Authentication → Rate Limits:** con SMTP propio se puede subir el límite de mails por hora (por defecto 30), si hace falta.

Otros proveedores sirven igual (Brevo, Postmark, SendGrid, Amazon SES): cambian el host, el puerto y las credenciales.

## 3. Plantillas en español

**Authentication → Emails → Templates.** Pegar el contenido de cada archivo de [`supabase/plantillas-correo/`](../supabase/plantillas-correo) y poner el asunto:

| Plantilla de Supabase | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirmar-registro.html` | `Confirmá tu cuenta en UNIDOAR` |
| Reset password | `recuperar-contrasena.html` | `Elegí una contraseña nueva en UNIDOAR` |
| Change email address | `cambio-email.html` | `Confirmá tu email nuevo en UNIDOAR` |
| Magic link (o "Magic link or OTP") | `enlace-magico.html` | `Tu enlace para ingresar a UNIDOAR` |
| Invite user | `invitacion.html` | `Te invitaron a UNIDOAR` |
| Reauthentication | `reautenticacion.html` | `Tu código de verificación de UNIDOAR` |

**Confirmar registro y recuperar contraseña llevan un enlace propio** (`{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=signup` o `…&type=recovery`) en vez de `{{ .ConfirmationURL }}`: llega a `/auth/confirmar`, una pantalla con un botón: el token se verifica en el servidor (`verifyOtp`) cuando la persona lo toca, no al abrir la dirección (así un antivirus o los "vínculos seguros" de Outlook, que abren los enlaces para revisarlos, no lo gastan). El mail se puede abrir **desde cualquier dispositivo** (el celular, por ejemplo) y la sesión queda abierta ahí. Con `{{ .ConfirmationURL }}` el enlace pasa por Supabase y por `/auth/callback` (PKCE), que **solo anda en el mismo navegador donde se pidió** y, abierto en otro, ni siquiera confirma la cuenta. Las otras plantillas (cambio de email, magic link, invitación) siguen con `{{ .ConfirmationURL }}`. **Hay que pegar estas dos plantillas de nuevo en Supabase cuando el código ya esté desplegado** (si se pegan antes, el enlace da 404). Un mail viejo, de antes del cambio, sigue andando por `/auth/callback`.

**Ningún mail puede salir en inglés**, así que se cargan las seis, el asunto incluido (el que trae Supabase por defecto está en inglés). La app dispara hoy solo tres (registro y reenvío de confirmación, recuperación y cambio de email desde Mi cuenta); magic link, invitación y reautenticación no se usan (la invitación al equipo la manda la propia app, ver [correo.md](correo.md)), pero conviene tenerlas en español por si alguna vez se activan. Las plantillas usan `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` (así, al cambiar el dominio en la sección 1, los enlaces y el logo se actualizan solos, sin volver a pegarlas) y, para el saludo, el nombre que la app guarda al registrar a un docente (`{{ .Data.nombre }}`).

### Avisos de seguridad

Supabase también puede avisar a la persona cuando le cambian algo sensible de la cuenta. Son opcionales y se encienden aparte, en **Authentication → Emails** (el apartado de notificaciones de seguridad; si en tu versión del panel no aparece, se activan con la Management API: `mailer_notifications_password_changed_enabled` y `mailer_notifications_email_changed_enabled`). Recomendamos activar estas dos:

| Notificación de Supabase | Archivo | Asunto |
|---|---|---|
| Password changed | `aviso-contrasena-cambiada.html` | `Cambió la contraseña de tu cuenta de UNIDOAR` |
| Email address changed | `aviso-email-cambiado.html` | `El email de tu cuenta de UNIDOAR cambió` |

Las otras cinco (teléfono, métodos de ingreso y verificación en dos pasos) no aplican a UNIDOAR hoy y Supabase las trae apagadas, así que no se mandan. Si algún día se encienden, o para no tener nada en inglés en el panel, también están traducidas:

| Notificación de Supabase | Archivo | Asunto |
|---|---|---|
| Phone number changed | `aviso-telefono-cambiado.html` | `Cambió el teléfono de tu cuenta de UNIDOAR` |
| Sign-in method linked (o "Identity linked") | `aviso-metodo-ingreso-agregado.html` | `Se agregó un método de ingreso a tu cuenta de UNIDOAR` |
| Sign-in method removed (o "Identity unlinked") | `aviso-metodo-ingreso-quitado.html` | `Se quitó un método de ingreso de tu cuenta de UNIDOAR` |
| Verification method added (o "MFA factor enrolled") | `aviso-verificacion-agregada.html` | `Se agregó un método de verificación a tu cuenta de UNIDOAR` |
| Verification method removed (o "MFA factor unenrolled") | `aviso-verificacion-quitada.html` | `Se quitó un método de verificación de tu cuenta de UNIDOAR` |

Al pegar `aviso-email-cambiado.html`, mirá en la vista previa de Supabase que el email viejo y el nuevo no queden al revés (usa `{{ .OldEmail }}` y `{{ .Email }}`).

## 4. Que la confirmación esté activa

**Authentication → Sign In / Providers → Email:** **Confirm email** encendido. La app funciona con o sin confirmación: sin ella, cualquiera podría crear cuentas con mails ajenos.

## 5. Probar de punta a punta

Con un mail real, en el sitio de producción:

1. **Registro docente** (`/registro`): llega el mail en español, con la marca y el botón. Al tocarlo, vuelve al sitio y sigue en el alta.
2. **Registro institución:** igual, hacia el paso 2 del alta de institución.
3. **Abrir el mail en otro dispositivo** (por ejemplo, registrarse en la compu y abrir el mail en el celular). Con el enlace `/auth/confirmar` la cuenta queda confirmada y la sesión se abre en el celular; en la compu alcanza con ingresar con la contraseña. (Con el enlace viejo de Supabase **no confirmaba nada** —se comprobó el 2026-10-08 en una invitación al equipo— y la app mostraba *"El enlace venció o ya se usó…"*.)
4. **Reenviar confirmación** desde la pantalla de ingreso, con una cuenta sin confirmar.
5. **Recuperar contraseña** (`/ingresar/recuperar`): el enlace anda desde cualquier dispositivo; la sesión queda en el que lo abre.
6. Mirar que los mails no caigan en spam; si caen, falta o está mal el SPF/DKIM del dominio (paso 2).

## Si el mail no sale

La app muestra *"No pudimos mandarte el mail en este momento…"* (y deja en el log de Vercel "Supabase Auth no pudo mandar un mail") cuando Supabase no logra entregar el mail a su servidor SMTP. Para ver el motivo exacto: **Logs → Auth** en el panel de Supabase (no el log del API Gateway ni el SQL Editor), buscá el pedido que falló (`/signup`, `/recover`…) y leé el campo `error`:

| Error en el log | Qué es |
|---|---|
| `535 "Authentication credentials invalid"` | Usuario o contraseña del SMTP mal. Con Resend el usuario es `resend` y la contraseña es la **API key completa** (`re_…`), sin espacios. Supabase no muestra la clave guardada: para corregirla hay que escribir una nueva en el campo. Fue lo que pasó el 2026-10-08 |
| `550` / "domain is not verified" / remitente no permitido | El **Sender email** no es de un dominio verificado en Resend (acá, `unidoar.com.ar`) |
| Tiempo de espera / conexión rechazada | Host o puerto mal (`smtp.resend.com`, `465` o `587`) |

Una forma de probar sin crear cuentas: pedir la recuperación de contraseña de una cuenta que ya existe (el 500 "Error sending recovery email" aparece solo si el SMTP falla; con un email que no existe Supabase responde 200 sin intentar enviar). Un registro que falla por esto no deja usuarios a medias: Supabase deshace el alta.

## Pendiente

- **Login con Google:** hay que crear las credenciales en Google Cloud y activar el proveedor en Supabase (Authentication → Sign In / Providers → Google), con `https://uurahnorzppcyxvkzabd.supabase.co/auth/v1/callback` como URI de redirección autorizada.
- **Cambio de email desde Mi cuenta:** su plantilla sigue con el enlace de Supabase (mismo navegador). Pasarla a `token_hash` requiere decidir cómo se confirman los dos mails del cambio seguro (el viejo y el nuevo); sin probar.
