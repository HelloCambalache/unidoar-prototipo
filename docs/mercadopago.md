# Mercado Pago: débito automático mensual

Cada institución con un plan mensual puede activar el débito automático: se suscribe una vez en Mercado Pago (inicia sesión y carga su tarjeta ahí, nosotros nunca la vemos) y Mercado Pago cobra el plan todos los meses. Cada cobro aprobado marca como **paga** la factura de ese mes. El plan **Anual** no entra: se paga por adelantado y sigue manual.

Cómo funciona por dentro, para quien toque el código: `CLAUDE.md`, sección "Mercado Pago".

## Cómo lo vive la institución

1. Entra a **Plan y facturación** y toca **Activar débito automático**. No pide ningún dato: el monto sale de su plan y sus sedes.
2. Mercado Pago le abre su propia página: inicia sesión **con la cuenta que tenga** (no tiene que coincidir con ningún mail de UNIDOAR), carga la tarjeta y confirma.
3. Vuelve a UNIDOAR, que confirma la suscripción sola en unos segundos. Mercado Pago cobra el primer mes al suscribirse (se confirmó en la primera prueba) y después todos los meses. Si ese mes ya figuraba pago (por ejemplo, cancela el débito y se vuelve a suscribir en el mismo mes), el primer cobro se posterga hasta el próximo día de cobro, para no cobrarle dos veces.
4. Puede cancelarlo cuando quiera desde la misma tarjeta.

Por dentro, cada institución tiene **su propio plan** en Mercado Pago (con su monto) y una tabla (`planes_mp`) que dice de quién es cada plan. Hace falta porque cuando alguien se suscribe por el enlace de un plan, Mercado Pago **no dice quién fue** (deja vacíos el mail y la referencia): lo único que viaja con la suscripción es el plan. Es la forma que recomienda Mercado Pago para este caso y la que usan Biomea y Kumo. La alternativa, crear la suscripción desde nuestro servidor con el mail de la institución, no sirve: Mercado Pago exige entrar con ese mail exacto y falla con cuentas de otro país.

## Qué se necesita

| Variable (Vercel → Settings → Environment Variables) | Qué es | Dónde se saca |
|---|---|---|
| `MP_ACCESS_TOKEN` | El Access Token de la aplicación. **Obligatoria**: sin ella el débito automático está apagado (el botón ni aparece). Ver abajo cuál tiene que ser en cada etapa. | Mercado Pago → Tus integraciones → tu aplicación → Credenciales |
| `MP_WEBHOOK_SECRET` | La clave secreta de los avisos. **Opcional**: si está, se comprueba la firma de cada aviso y, si no coincide, queda anotado en el log; no bloquea nada. | Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones (aparece al guardar) |

Se cargan **solo en Production** y marcadas como **sensibles**. **Nunca pegues el token en un chat, un mail ni un commit.** `/api/salud` (con sesión de admin) muestra si están presentes (`mercadoPago`), nunca sus valores. Cada aplicación de Mercado Pago tiene su propio webhook y su propia clave: si cambiás el token por el de otra aplicación, hay que configurar el webhook también en esa.

> **Ojo con el token de prueba.** El Access Token `TEST-…` de la pestaña "Credenciales de prueba" de **tu aplicación real** **no sirve para suscripciones**: Mercado Pago contesta *"Both payer and collector must be real or test users"* (400), porque ese token hace que el que cobra sea "de prueba" y no hay pagador que combine. Se vio el 2026-10-20 en los logs de Vercel. Para probar hace falta una de las dos opciones de abajo.

## Puesta en marcha

1. **Base de datos:** `pnpm db:mercadopago` crea `suscripciones_mp`, `cobros_mp` y **`planes_mp`** con RLS, y deja el mail de `suscripciones_mp` como opcional. Es aditivo y se puede volver a correr. **Correrlo antes de desplegar el código que usa `planes_mp`.**
2. **Webhook:** en Tus integraciones → tu aplicación → Webhooks → Configurar notificaciones, cargar la URL
   `https://www.unidoar.com.ar/api/mercadopago/webhook`
   y activar los eventos de suscripciones: `subscription_preapproval` y `subscription_authorized_payment`. **El webhook de prueba y el de producción se configuran por separado** (cada uno con su URL y su clave).
3. **Variable en Vercel** (`MP_ACCESS_TOKEN`) y **volver a desplegar** (las variables se leen al arrancar).
4. **Probar** (una de las dos opciones de abajo).
5. **Producción:** el token tiene que ser el de producción (`APP_USR-…`) **antes de la primera institución real**. Con un token de prueba en producción, una institución podría suscribirse y **ningún cobro entraría a ningún lado**, sin ninguna señal.

## Opción A: probar sin plata (sandbox completo)

Hacen falta las dos cuentas de prueba y un token que salga de **una aplicación creada dentro de la cuenta del vendedor de prueba** (es el paso que se saltea siempre):

1. En Mercado Pago Developers → Tus integraciones → **Cuentas de prueba**, crear dos: **Vendedor** y **Comprador** (Argentina). Guardar usuario y contraseña de cada una.
2. Cerrar sesión y entrar a Mercado Pago **como el vendedor de prueba**.
3. Dentro de esa cuenta, **crear una aplicación**. En esa aplicación cargar el webhook de pruebas (URL y eventos del punto 2 de arriba) y copiar su **Access Token de pruebas**.
4. Cargarlo como `MP_ACCESS_TOKEN` en Vercel (Production, sensible) y redesplegar.
5. En UNIDOAR, con una institución de prueba: **Plan y facturación → Activar débito automático**.
6. En la página de Mercado Pago iniciar sesión **con la cuenta compradora**. El mail de esa cuenta no figura en el panel: sale de los dígitos del usuario (`TESTUSER328791889392025651` → `test_user_328791889392025651@testuser.com`), con su contraseña.
7. Pagar con una tarjeta de prueba de Argentina (las confirma Mercado Pago en su documentación; pueden cambiar):

   | Tarjeta | Número | Código | Vence |
   |---|---|---|---|
   | Mastercard | 5031 7557 3453 0604 | 123 | 11/30 |
   | Visa | 4509 9535 6623 3704 | 123 | 11/30 |
   | American Express | 3711 803032 57522 | 1234 | 11/30 |

   Titular según lo que se quiera provocar, con DNI 12345678: `APRO` cobro aprobado, `FUND` fondos insuficientes, `OTHE` rechazo general.
8. Al volver, la pantalla confirma sola. La factura del mes pasa a **pagada** con el medio "Débito automático" y llegan la notificación y el mail de pago registrado.
9. Para ver un **rechazo**: otra suscripción con titular `FUND` u `OTHE`. Para **cancelar**: el botón de la misma tarjeta.

**Crear el plan no prueba nada:** la mitad de las restricciones de Mercado Pago se aplican al autorizar. Hay que completar al menos una suscripción y un cobro.

## Opción B: probar en producción con una tarjeta real (como Biomea)

Con el Access Token de producción (`APP_USR-`) no hay tarjetas de prueba: un cobro es real. Se hace una sola prueba:

1. Cargar el token de producción en Vercel y configurar el webhook en modo producción. Redesplegar.
2. Con una institución propia, activar el débito con una tarjeta real. **El primer cobro sale al suscribirse**, por el precio del plan (plan × sedes). Para gastar poco, asignarle desde su ficha del backoffice el plan Multisede con 1 sede ($15.000).
3. Comprobar que la factura quedó paga y **cancelar el débito** desde la misma tarjeta.
4. **Devolver el cobro** desde el panel de Mercado Pago (Actividad).

Si algo no llega: el panel de Mercado Pago (Webhooks) muestra cada aviso enviado y su respuesta; en Vercel → Logs, buscar `[mercadopago]`. "Simular notificación" del panel sirve para ver que el endpoint responde (con un número de prueba contesta 200 y lo ignora).

## Antes de abrir a instituciones reales (lista para salir a producción)

Mientras el token sea de **prueba**, solo las instituciones de ejemplo ven el débito automático y pueden activarlo (una institución real no puede suscribirse a un cobro que no es real). `/api/salud` (con admin) informa `mercadoPago.modo` ("prueba" o "produccion"): es la forma de comprobar con qué token está corriendo producción. El orden:

1. **Probar lo que falta con el token de prueba:** un cobro rechazado (titular `FUND` u `OTHE`) y cancelar desde la tarjeta.
2. **Cancelar el débito de prueba** de cada institución de ejemplo que lo tenga (Plan y facturación → Cancelar débito automático), **con el token de prueba todavía cargado**: así Mercado Pago deja de cobrarlo.
3. **Limpiar las pruebas:** `pnpm db:mercadopago-limpiar` muestra qué se borraría y `pnpm db:mercadopago-limpiar --borrar` lo borra (planes, suscripciones y cobros de las instituciones de ejemplo; nunca de instituciones reales). Se niega si queda alguna suscripción viva. Si una factura quedó marcada paga por una prueba, se deshace con "Anular pago" en Cobros. Sin este paso, la revisión diaria le preguntaría a Mercado Pago por suscripciones que el token de producción no conoce.
4. **Cargar el token de producción** (`APP_USR-…`) en `MP_ACCESS_TOKEN` (Production, sensible) y **volver a desplegar**. Comprobar en `/api/salud` que `modo` pasó a "produccion": hasta entonces las instituciones reales no ven el débito.
5. **Configurar el webhook en modo producción** en el panel de Mercado Pago: el de prueba no sirve. Misma URL y los dos eventos; la clave secreta (opcional) es otra.
6. **Una prueba real chica** (opción B de arriba): activar con una tarjeta real, ver la factura paga, cancelar y devolver el cobro desde el panel de Mercado Pago.
7. **Términos y Privacidad:** los puntos para la revisión legal están en [debito-automatico-puntos-legales.md](debito-automatico-puntos-legales.md).

## Qué ve el equipo y qué ve la institución

- **Ficha de la institución (backoffice):** una tarjeta "Débito automático" con el estado, el monto, el próximo cobro, desde cuándo, la cuenta de Mercado Pago (si la informó) y los últimos 5 cobros, con los rechazos a la vista. Es solo lectura.
- **Inicio de la institución:** un aviso "Activá el débito automático" cuando ya está verificada y todavía no lo activó. Desaparece solo al activarlo.
- **Cobro rechazado:** además de la campanita, la primera vez le llega un mail a quien paga (no se repite en los reintentos).

## Qué pasa en cada caso

- **La persona se suscribe:** Mercado Pago avisa (o la persona vuelve a UNIDOAR) y la suscripción se ata a la institución por su plan. Se avisa a la institución y queda en la auditoría.
- **Cobro aprobado:** se marca paga la factura del mes (si no existe, se crea ya paga), se avisa a la institución (campanita y mail) y queda en la auditoría como `factura.pagar` con origen `mercadopago`.
- **Cobro rechazado:** se anota y se avisa a la institución y al equipo; Mercado Pago lo reintenta solo.
- **Cobro "en proceso" que acredita después:** Mercado Pago **no siempre avisa** cuando eso pasa. Por eso el cron diario (`/api/cron/facturas`, 12:00 UTC) le pregunta a Mercado Pago por cada suscripción viva qué cobros tiene y anota los que falten; si recupera alguno, avisa al equipo. También busca, durante 7 días, las suscripciones de los planes recién creados por si el aviso del alta nunca llegó.
- **Se suscribe (o se vuelve a suscribir) con el mes ya pago:** Mercado Pago cobra el primer mes al suscribirse, y eso sería un cobro doble. Por eso el plan se crea con una **prueba sin cobro** hasta el día de cobro del mes que viene: hoy no se cobra nada y el primer cobro es el del mes siguiente. La pantalla se lo avisa ("Este mes ya figura pago…"). Si el mes todavía no está pago, no hay prueba: el primer cobro sale enseguida y paga la factura de este mes. Si por algún motivo igual llegara un cobro de un mes ya pago, no se pisa nada y se avisa al equipo ("Posible doble cobro").
- **El día de cobro:** las facturas vencen el día de cobro de la institución (por defecto el 10) y Mercado Pago cobra el día en que la persona se suscribió. Para que la factura del mes no se vea "Vencida" antes del débito, al autorizarse la suscripción el día de cobro de la institución pasa a ser el día del alta (por ejemplo el 20). Se hace una sola vez; después el equipo lo puede cambiar a mano. Mientras el débito esté activo, la institución **no recibe los recordatorios de factura** ("vence pronto" y "está vencida"): si un cobro se rechaza, ya sale su propio aviso. Si el débito se pausa o se cancela, los recordatorios vuelven.
- **Mes que ya figuraba pago por otro medio:** no se pisa nada y se avisa al equipo ("Posible doble cobro") para revisar una devolución.
- **La persona se suscribe dos veces (otro plan o otra tarjeta):** si ya tenía el débito activo, la segunda se cancela y se avisa al equipo. Si la primera había quedado pendiente y la nueva está autorizada, la nueva pasa a ser la vigente y la pendiente se cancela. Una suscripción que no se puede atribuir a ninguna institución **no se cancela**: se avisa al equipo para que la mire.
- **La institución cancela o se da de baja:** se cancela primero en Mercado Pago; si no se pudiera, la baja no sigue.
- **El equipo suspende una institución con débito activo:** suspender no cancela el débito por sí solo, así que el diálogo de suspender trae la casilla **"Cancelar también el débito automático"**, tildada por defecto. Si se deja tildada, primero se cancela en Mercado Pago y después se suspende; si Mercado Pago no responde, no se suspende nada y se puede reintentar (o destildar la casilla para una suspensión urgente). La institución recibe el aviso y el mail de la suspensión con esa aclaración, y al reactivarla se le recuerda que el débito sigue cancelado y que lo active de nuevo desde Plan y facturación.
- **Cambia el precio del plan, las sedes o el plan de la institución:** el cron diario compara lo que cobra cada suscripción con lo que hoy cuesta el plan y, si difiere, actualiza el monto en Mercado Pago **desde el próximo cobro** y avisa a la institución. Un aumento puede sacar la suscripción de "autorizada" hasta que la persona apruebe el monto nuevo: si pasa, se avisa al equipo. Si pasó al plan Anual, se cancela la suscripción mensual.
- **Mercado Pago o la base caídas al llegar un aviso:** respondemos 500 y Mercado Pago reintenta cada 15 minutos hasta que salga.

## Qué falta comprobar contra Mercado Pago real

La primera suscripción de punta a punta (que la suscripción nazca con el plan que esperamos y que el aviso lo traiga), el aspecto de la pantalla de Mercado Pago, que el primer cobro salga al suscribirse, un cobro aprobado y uno rechazado, la cancelación y qué pasa al aumentar un monto.
