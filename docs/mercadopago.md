# Mercado Pago: débito automático mensual

Cada institución con un plan mensual puede activar el débito automático: autoriza una vez en Mercado Pago (carga su tarjeta ahí, nosotros nunca la vemos) y Mercado Pago cobra el plan todos los meses. Cada cobro aprobado marca como **paga** la factura de ese mes. El plan **Anual** no entra: se paga por adelantado y sigue manual.

Cómo funciona por dentro, para quien toque el código: `CLAUDE.md`, sección "Mercado Pago".

## Qué se necesita

| Variable (Vercel → Settings → Environment Variables) | Qué es | Dónde se saca |
|---|---|---|
| `MP_ACCESS_TOKEN` | El Access Token de la aplicación. **De prueba** mientras se prueba; después, el de producción. | Mercado Pago → Tus integraciones → tu aplicación → Credenciales |
| `MP_WEBHOOK_SECRET` | La clave secreta de los avisos, con la que se comprueba que un aviso lo mandó de verdad Mercado Pago | Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones (aparece al guardar) |

Las dos se cargan **solo en Production** y marcadas como **sensibles**. Hacen falta las dos a la vez: sin ellas el botón de "Activar débito automático" ni aparece y el aviso de Mercado Pago se rechaza. **Nunca pegues el token en un chat, un mail ni un commit.** `/api/salud` (con sesión de admin) muestra si están presentes (`mercadoPago`), nunca sus valores.

## Puesta en marcha (en este orden)

1. **Base de datos** (una sola vez, antes de desplegar el código): `pnpm db:mercadopago`. Crea `suscripciones_mp` y `cobros_mp` con RLS. Es aditivo y se puede correr de nuevo sin problema.
2. **Cuentas de prueba:** en Tus integraciones → tu aplicación → Cuentas de prueba, crear una **vendedora** y una **compradora**. Usar las credenciales de prueba de la vendedora para `MP_ACCESS_TOKEN`.
3. **Webhook:** en Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones, cargar la URL de producción
   `https://www.unidoar.com.ar/api/mercadopago/webhook`
   y activar los eventos de suscripciones: `subscription_preapproval` y `subscription_authorized_payment`. Guardar y copiar la **clave secreta** a `MP_WEBHOOK_SECRET`.
4. **Variables en Vercel** y volver a desplegar (las variables se leen al arrancar).
5. **Probar de punta a punta** (ver abajo).
6. **Pasar a producción:** cambiar `MP_ACCESS_TOKEN` por el de producción (y, si Mercado Pago da una clave de avisos distinta para producción, `MP_WEBHOOK_SECRET`), redeployar, y hacer **una** prueba real con una institución propia antes de ofrecerlo a las demás.

## Cómo probar con las cuentas de prueba

1. Entrar a UNIDOAR con una institución (dueña o administradora) de un plan mensual y abrir **Plan y facturación**.
2. En "Débito automático", escribir el mail de la cuenta **compradora de prueba** y tocar **Activar débito automático**: te lleva a Mercado Pago.
3. En Mercado Pago, entrar con la cuenta compradora de prueba y pagar con una de las **tarjetas de prueba** que da Mercado Pago (aprobada y, para otro intento, una rechazada).
4. Al volver, la tarjeta dice "Falta autorizarlo… / Activo". Mercado Pago avisa por el webhook: la factura del mes pasa a **pagada** con el medio "Débito automático" y llega la notificación (y el mail) de pago registrado.
5. Para ver un **rechazo**: usar la tarjeta de prueba rechazada; la tarjeta muestra "Mercado Pago no pudo cobrar…" y el equipo recibe un aviso.
6. Cancelar desde la misma tarjeta: Mercado Pago deja de cobrar y el estado pasa a "Cancelado".

Si algo no llega: en el panel de Mercado Pago (Webhooks) se ve cada aviso enviado y su respuesta; en Vercel → Logs, buscar `[mercadopago]`. El panel también tiene "Simular notificación": vale para probar que la firma anda (responde 200 aunque el número de prueba no exista).

## Qué pasa en cada caso

- **Cobro aprobado:** se marca paga la factura del mes (si no existe, se crea ya paga), se avisa a la institución (campanita y mail) y queda en la auditoría como `factura.pagar` con origen `mercadopago`.
- **Cobro rechazado:** se anota y se avisa a la institución y al equipo; Mercado Pago lo reintenta solo.
- **Mes que ya figuraba pago por otro medio:** no se pisa nada y se avisa al equipo ("Posible doble cobro") para revisar una devolución.
- **La institución cancela o se da de baja:** se cancela primero en Mercado Pago; si no se pudiera, la baja no sigue.
- **Cambia el precio del plan, las sedes o el plan de la institución:** el cron diario de facturas (`/api/cron/facturas`, 12:00 UTC) compara lo que cobra cada suscripción con lo que hoy cuesta el plan y, si difiere, actualiza el monto en Mercado Pago **desde el próximo cobro** y le avisa a la institución. Un cambio hecho hoy llega a Mercado Pago en la pasada de mañana. Si la institución pasó al plan Anual, se cancela la suscripción mensual.
- **Mercado Pago o la base caídas al llegar un aviso:** respondemos 500 y Mercado Pago reintenta cada 15 minutos hasta que salga.
