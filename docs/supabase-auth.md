# Supabase Auth en producción: URLs, correo y plantillas

Lo que hay que configurar en el panel de Supabase (proyecto `uurahnorzppcyxvkzabd`) para que el registro, la confirmación de mail y la recuperación de contraseña anden en `https://unidoar-prototipo.vercel.app`. Nada de esto está en el código: se hace una vez desde el panel. Los nombres de los menús cambian seguido; si no encontrás uno, buscá por el nombre de la sección.

## 1. URLs permitidas

**Authentication → URL Configuration**

- **Site URL:** `https://unidoar-prototipo.vercel.app`
- **Redirect URLs** (una por línea):
  - `https://unidoar-prototipo.vercel.app/**`
  - `http://localhost:3000/**` (para seguir probando en local)

Sin esto, el enlace del mail lleva a la Site URL por defecto (`localhost`) o Supabase lo rechaza.

## 2. Correo propio (SMTP)

El correo de prueba que trae Supabase es solo para desarrollo: según su documentación manda muy pocos mails por hora y solo a direcciones del equipo del proyecto. **Con él, una persona real no recibe el mail de confirmación**, y no puede terminar de registrarse. Hace falta un servicio de correo propio. Ejemplo con Resend (tiene plan gratuito; revisá sus límites vigentes):

1. Crear la cuenta en resend.com con el mail del estudio.
2. **Domains → Add Domain:** `cambalache.studio`. Resend muestra unos registros DNS (SPF, DKIM y alguno más). Hay que cargarlos donde se administra el DNS del dominio y esperar a que figure como **Verified**.
3. **API Keys → Create API Key** con permiso de envío. Copiarla: se muestra una sola vez.
4. En Supabase, **Authentication → Emails → SMTP Settings** (en versiones anteriores: Project Settings → Authentication → SMTP) y activar **Enable custom SMTP**:

   | Campo | Valor |
   |---|---|
   | Sender email | `hello@cambalache.studio` (así, si alguien responde, le llega al estudio) |
   | Sender name | `UNIDOAR` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | la API key del paso 3 |

5. **Authentication → Rate Limits:** con SMTP propio se puede subir el límite de mails por hora (por defecto 30), si hace falta.

Otros proveedores sirven igual (Brevo, Postmark, SendGrid, Amazon SES): cambian el host, el puerto y las credenciales.

## 3. Plantillas en español

**Authentication → Emails → Templates.** Pegar el contenido de cada archivo de [`supabase/plantillas-correo/`](../supabase/plantillas-correo) y poner el asunto:

| Plantilla de Supabase | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirmar-registro.html` | `Confirmá tu cuenta en UNIDOAR` |
| Reset password | `recuperar-contrasena.html` | `Elegí una contraseña nueva en UNIDOAR` |
| Change email address | `cambio-email.html` | `Confirmá tu email nuevo en UNIDOAR` |

La app dispara estas tres (registro y reenvío de confirmación, recuperación y cambio de email desde Mi cuenta). Las plantillas de magic link, invitación y reautenticación de Supabase no se usan: la invitación al equipo la manda la propia app (ver [correo.md](correo.md)). Las plantillas usan `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` (así, al cambiar el dominio en la sección 1, los enlaces y el logo se actualizan solos, sin volver a pegarlas) y, para el saludo, el nombre que la app guarda al registrar a un docente (`{{ .Data.nombre }}`).

### Avisos de seguridad

Supabase también puede avisar a la persona cuando le cambian algo sensible de la cuenta. Son opcionales y se encienden aparte, en **Authentication → Emails** (el apartado de notificaciones de seguridad; si en tu versión del panel no aparece, se activan con la Management API: `mailer_notifications_password_changed_enabled` y `mailer_notifications_email_changed_enabled`). Recomendamos activar estas dos:

| Notificación de Supabase | Archivo | Asunto |
|---|---|---|
| Password changed | `aviso-contrasena-cambiada.html` | `Cambió la contraseña de tu cuenta de UNIDOAR` |
| Email address changed | `aviso-email-cambiado.html` | `El email de tu cuenta de UNIDOAR cambió` |

Las otras cinco (teléfono, métodos de ingreso y verificación en dos pasos) no aplican a UNIDOAR. Al pegar `aviso-email-cambiado.html`, mirá en la vista previa de Supabase que el email viejo y el nuevo no queden al revés (usa `{{ .OldEmail }}` y `{{ .Email }}`).

## 4. Que la confirmación esté activa

**Authentication → Sign In / Providers → Email:** **Confirm email** encendido. La app funciona con o sin confirmación: sin ella, cualquiera podría crear cuentas con mails ajenos.

## 5. Probar de punta a punta

Con un mail real, en el sitio de producción:

1. **Registro docente** (`/registro`): llega el mail en español, con la marca y el botón. Al tocarlo, vuelve al sitio y sigue en el alta.
2. **Registro institución:** igual, hacia el paso 2 del alta de institución.
3. **Abrir el mail en otro dispositivo** (por ejemplo, registrarse en la compu y abrir el mail en el celular). El enlace confirma la cuenta, pero la sesión solo se abre en el navegador donde se hizo el registro; en el otro, la app muestra *"El enlace venció o ya se usó. Ingresá con tu email y contraseña…"*. La cuenta queda confirmada y alcanza con ingresar con la contraseña.
4. **Reenviar confirmación** desde la pantalla de ingreso, con una cuenta sin confirmar.
5. **Recuperar contraseña** (`/ingresar/recuperar`): el enlace hay que abrirlo en el mismo navegador desde el que se pidió.
6. Mirar que los mails no caigan en spam; si caen, falta o está mal el SPF/DKIM del dominio (paso 2).

## Pendiente

- **Login con Google:** hay que crear las credenciales en Google Cloud y activar el proveedor en Supabase (Authentication → Sign In / Providers → Google), con `https://uurahnorzppcyxvkzabd.supabase.co/auth/v1/callback` como URI de redirección autorizada.
- **Apertura del enlace en otro dispositivo:** si molesta, se puede cambiar el enlace de las plantillas por uno con `token_hash` y que `/auth/callback` lo verifique con `verifyOtp`; así la sesión se abre en el dispositivo donde se abre el mail.
