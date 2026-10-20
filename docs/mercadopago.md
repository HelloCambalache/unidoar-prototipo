# Mercado Pago: débito automático mensual

Cada institución con un plan mensual puede activar el débito automático: autoriza una vez en Mercado Pago (carga su tarjeta ahí, nosotros nunca la vemos) y Mercado Pago cobra el plan todos los meses. Cada cobro aprobado marca como **paga** la factura de ese mes. El plan **Anual** no entra: se paga por adelantado y sigue manual.

Cómo funciona por dentro, para quien toque el código: `CLAUDE.md`, sección "Mercado Pago". Se hizo igual que en Biomea (suscripciones de Mercado Pago con el SDK oficial, credenciales reales, sin cuentas de prueba), con una diferencia: acá cada institución tiene su propia suscripción con su monto (plan × sedes), en lugar de un único plan fijo.

## Qué se necesita

| Variable (Vercel → Settings → Environment Variables) | Qué es | Dónde se saca |
|---|---|---|
| `MP_ACCESS_TOKEN` | El Access Token de producción de la aplicación (empieza con `APP_USR-`). **Obligatoria**: sin ella el débito automático está apagado (el botón ni aparece). | Mercado Pago → Tus integraciones → tu aplicación → Credenciales de producción |
| `MP_WEBHOOK_SECRET` | La clave secreta de los avisos. **Opcional**: si está, se comprueba la firma de cada aviso y, si no coincide, queda anotado en el log; no bloquea nada. | Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones (aparece al guardar) |

Las dos se cargan **solo en Production** y marcadas como **sensibles**. **Nunca pegues el token en un chat, un mail ni un commit.** `/api/salud` (con sesión de admin) muestra si están presentes (`mercadoPago`), nunca sus valores.

## Puesta en marcha

1. **Base de datos** (ya corrida en producción el 2026-10-20): `pnpm db:mercadopago` crea `suscripciones_mp` y `cobros_mp` con RLS. Es aditivo: se puede volver a correr sin problema.
2. **Webhook:** en Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones, cargar la URL de producción
   `https://www.unidoar.com.ar/api/mercadopago/webhook`
   y activar los eventos de suscripciones: `subscription_preapproval` y `subscription_authorized_payment`. Guardar. Si querés, copiar la **clave secreta** a `MP_WEBHOOK_SECRET`.
3. **Variables en Vercel** (`MP_ACCESS_TOKEN` y, si querés, `MP_WEBHOOK_SECRET`) y **volver a desplegar** (las variables se leen al arrancar).
4. **Probar** (ver abajo) con una institución propia y recién después ofrecerlo a las demás.

## Cómo probar (con credenciales reales, como en Biomea)

No hacen falta cuentas de prueba. Se prueba con una institución propia, una tarjeta real y se cancela después:

1. Entrar a UNIDOAR con una institución (dueña o administradora) de un plan mensual y abrir **Plan y facturación**.
2. En "Débito automático", escribir el mail de **tu cuenta de Mercado Pago** y tocar **Activar débito automático**: te lleva a Mercado Pago.
3. Cargar la tarjeta y autorizar. **El primer cobro sale enseguida y es real**, por el precio del plan de esa institución (plan × sedes). Si preferís probar con poca plata, se puede bajar un rato el precio de un plan en `/backoffice/planes` antes de activar y volver a dejarlo después.
4. Al volver, la tarjeta dice "Falta autorizarlo… / Activo". Mercado Pago avisa por el webhook: la factura del mes pasa a **pagada** con el medio "Débito automático" y llegan la notificación y el mail de pago registrado. Si el aviso tardara, "Ya lo autoricé" actualiza el estado.
5. Para ver un **rechazo**: usar una tarjeta sin fondos. La tarjeta muestra "Mercado Pago no pudo cobrar…" y el equipo recibe un aviso.
6. **Cancelar** desde la misma tarjeta (Mercado Pago deja de cobrar) y, si hubo un cobro de prueba, devolverlo desde el panel de Mercado Pago (Actividad).

Si algo no llega: el panel de Mercado Pago (Webhooks) muestra cada aviso enviado y su respuesta; en Vercel → Logs, buscar `[mercadopago]`. "Simular notificación" del panel sirve para ver que el endpoint responde (con un número de prueba contesta 200 y lo ignora).

## Qué pasa en cada caso

- **Cobro aprobado:** se marca paga la factura del mes (si no existe, se crea ya paga), se avisa a la institución (campanita y mail) y queda en la auditoría como `factura.pagar` con origen `mercadopago`.
- **Cobro rechazado:** se anota y se avisa a la institución y al equipo; Mercado Pago lo reintenta solo.
- **Cobro "en proceso" que acredita después:** Mercado Pago **no siempre avisa** cuando eso pasa. Por eso el cron diario (`/api/cron/facturas`, 12:00 UTC) le pregunta a Mercado Pago por cada suscripción viva qué cobros tiene y anota los que falten; si recupera alguno, avisa al equipo. Es la red de seguridad que Biomea agregó después de perder un cobro real.
- **Mes que ya figuraba pago por otro medio:** no se pisa nada y se avisa al equipo ("Posible doble cobro") para revisar una devolución.
- **La persona reintenta con otra tarjeta y Mercado Pago crea una suscripción nueva:** si la nuestra seguía pendiente, la nueva pasa a ser la vigente (se liga por la referencia de la institución) y la vieja se cancela. Una suscripción duplicada de una institución que ya tenía el débito activo se cancela y se avisa. Una suscripción sin a quién ligar **no se cancela**: se avisa al equipo para que la mire.
- **La institución cancela o se da de baja:** se cancela primero en Mercado Pago; si no se pudiera, la baja no sigue.
- **Cambia el precio del plan, las sedes o el plan de la institución:** el cron diario compara lo que cobra cada suscripción con lo que hoy cuesta el plan y, si difiere, actualiza el monto en Mercado Pago **desde el próximo cobro** y avisa a la institución. Si pasó al plan Anual, se cancela la suscripción mensual.
- **Mercado Pago o la base caídas al llegar un aviso:** respondemos 500 y Mercado Pago reintenta cada 15 minutos hasta que salga.

## Qué falta comprobar contra Mercado Pago real

Es lo único que no se pudo probar sin sus cuentas: si exige que el mail de pago de la suscripción coincida con el de la cuenta de quien paga (por eso el campo es editable), el aspecto de la pantalla de autorización y qué hace Mercado Pago al reintentar con otra tarjeta. Si el mail da problemas, el plan B es el de Biomea: un plan de suscripción por monto (`preapproval_plan`) con su enlace de checkout, que no pide mail.
