# Mercado Pago: débito automático mensual

Cada institución con un plan mensual puede activar el débito automático: autoriza una vez en Mercado Pago (carga su tarjeta ahí, nosotros nunca la vemos) y Mercado Pago cobra el plan todos los meses. Cada cobro aprobado marca como **paga** la factura de ese mes. El plan **Anual** no entra: se paga por adelantado y sigue manual.

Cómo funciona por dentro, para quien toque el código: `CLAUDE.md`, sección "Mercado Pago". Se hizo igual que en Biomea (suscripciones de Mercado Pago con el SDK oficial; allá también se empezó con las credenciales de prueba de la aplicación y después se pasó a producción), con una diferencia: acá cada institución tiene su propia suscripción con su monto (plan × sedes), en lugar de un único plan fijo.

## Qué se necesita

| Variable (Vercel → Settings → Environment Variables) | Qué es | Dónde se saca |
|---|---|---|
| `MP_ACCESS_TOKEN` | El Access Token de la aplicación. **Obligatoria**: sin ella el débito automático está apagado (el botón ni aparece). **Primera etapa: el de prueba** (empieza con `TEST-`); **después, el de producción** (`APP_USR-`). | Mercado Pago → Tus integraciones → tu aplicación → Credenciales → pestaña "Credenciales de prueba" o "de producción" |
| `MP_WEBHOOK_SECRET` | La clave secreta de los avisos. **Opcional**: si está, se comprueba la firma de cada aviso y, si no coincide, queda anotado en el log; no bloquea nada. | Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones (aparece al guardar) |

Se cargan **solo en Production** y marcadas como **sensibles**. **Nunca pegues el token en un chat, un mail ni un commit.** `/api/salud` (con sesión de admin) muestra si están presentes (`mercadoPago`), nunca sus valores.

## Puesta en marcha

1. **Base de datos** (ya corrida en producción el 2026-10-20): `pnpm db:mercadopago` crea `suscripciones_mp` y `cobros_mp` con RLS. Es aditivo: se puede volver a correr sin problema.
2. **Webhook:** en Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones, cargar la URL
   `https://www.unidoar.com.ar/api/mercadopago/webhook`
   y activar los eventos de suscripciones: `subscription_preapproval` y `subscription_authorized_payment`. **El webhook de prueba y el de producción se configuran por separado** (cada uno con su URL y su clave): hay que cargarlo en el modo que corresponda a la etapa.
3. **Variable en Vercel** (`MP_ACCESS_TOKEN`) y **volver a desplegar** (las variables se leen al arrancar).
4. **Probar** (ver abajo).
5. **Pasar a producción:** cambiar `MP_ACCESS_TOKEN` por el de producción, configurar también el webhook en modo producción, redeployar y hacer **una** prueba real con una institución propia (ver "Etapa 2").

## Etapa 1: probar con las credenciales de prueba (sin plata)

La aplicación de Mercado Pago trae sus propias "Credenciales de prueba": alcanza con cargar ese Access Token (`TEST-…`). Con esas credenciales no se mueve plata y se paga con tarjetas de prueba.

1. Entrar a UNIDOAR con una institución (dueña o administradora) de un plan mensual y abrir **Plan y facturación**.
2. En "Débito automático", escribir un mail y tocar **Activar débito automático**: te lleva a Mercado Pago. **El mail tiene que ser distinto del de la cuenta de Mercado Pago dueña de la aplicación** (Mercado Pago no deja que una cuenta se pague a sí misma).
3. En Mercado Pago, pagar con una tarjeta de prueba de Argentina (las confirma Mercado Pago en su documentación; pueden cambiar):

   | Tarjeta | Número | Código | Vence |
   |---|---|---|---|
   | Mastercard | 5031 7557 3453 0604 | 123 | 11/30 |
   | Visa | 4509 9535 6623 3704 | 123 | 11/30 |
   | American Express | 3711 803032 57522 | 1234 | 11/30 |

   Titular según lo que se quiera provocar, con DNI 12345678: `APRO` cobro aprobado, `FUND` fondos insuficientes, `OTHE` rechazo general.
4. Al volver, la tarjeta dice "Falta autorizarlo… / Activo". Mercado Pago avisa por el webhook: la factura del mes pasa a **pagada** con el medio "Débito automático" y llegan la notificación y el mail de pago registrado. Si el aviso tardara, "Ya lo autoricé" actualiza el estado.
5. Para ver un **rechazo**: otra suscripción con titular `FUND` u `OTHE`. La tarjeta muestra "Mercado Pago no pudo cobrar…" y el equipo recibe un aviso.
6. **Cancelar** desde la misma tarjeta y comprobar que el estado pasa a "Cancelado".

**Lo que se confirma recién acá:** si el checkout de suscripciones de prueba deja pagar con esas tarjetas sin una cuenta compradora de prueba. Si Mercado Pago lo exigiera, habría que crear una cuenta de prueba compradora (Tus integraciones → Cuentas de prueba) y pagar con ella.

## Etapa 2: producción

Con el Access Token de producción (`APP_USR-`) **no existen tarjetas de prueba**: un cobro es real. Se hace una sola prueba, como en Biomea:

1. Cargar el token de producción en Vercel y configurar el webhook en modo producción. Redeployar.
2. Con una institución propia, activar el débito con una tarjeta real. **El primer cobro sale enseguida**, por el precio del plan (plan × sedes). Para gastar poco, asignarle desde su ficha del backoffice el plan Multisede con 1 sede ($15.000).
3. Comprobar que la factura quedó paga y **cancelar el débito** desde la misma tarjeta.
4. **Devolver el cobro** desde el panel de Mercado Pago (Actividad).

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

Si exige que el mail de pago de la suscripción coincida con el de la cuenta de quien paga (por eso el campo es editable), el aspecto de la pantalla de autorización y qué hace Mercado Pago al reintentar con otra tarjeta. Si el mail da problemas, el plan B es el de Biomea: un plan de suscripción por monto (`preapproval_plan`) con su enlace de checkout, que no pide mail.
