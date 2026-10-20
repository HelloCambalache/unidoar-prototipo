# Débito automático: puntos para la revisión legal

Este documento no es texto legal: reúne **qué hace hoy el sistema** y **qué decisiones faltan**, para que la titular (o su abogado) los cubra en los Términos y en la Política de Privacidad. Los Términos se cargan tal cual los redactó la titular (`src/lib/terminos-texto.ts`); si se agrega algo, hay que subir `VERSION_TERMINOS` y `TERMINOS_ACTUALIZADOS` (`src/lib/terminos.ts`).

## Cómo funciona (hechos)

- **Quién:** instituciones con un plan **mensual**. El plan Anual se paga por adelantado y queda fuera.
- **Autorización:** la institución (dueño o administradores) se suscribe una sola vez en la página de Mercado Pago, con su propia cuenta. **UNIDOAR nunca ve ni guarda los datos de la tarjeta.**
- **Monto:** el del plan de la institución por la cantidad de sedes (si el plan es por sede). Se cobra en pesos, una vez por mes.
- **Cuándo:** el primer cobro sale **al suscribirse** y los siguientes el mismo día de cada mes. Si el mes en curso ya estaba pago (por ejemplo, la institución canceló y se vuelve a suscribir en el mismo mes), el primer cobro se posterga hasta el próximo día de cobro, para no cobrar dos veces el mismo mes. UNIDOAR hace que la factura de cada mes venza el día del débito.
- **Qué registra UNIDOAR:** el número de la suscripción en Mercado Pago, su estado, los cobros (fecha, monto y si se cobró o fue rechazado) y, si Mercado Pago lo informa, el mail de la cuenta con la que paga. Cada cobro aprobado marca la factura del mes como pagada.
- **Cambios de precio:** si cambia el precio del plan o las sedes, el monto se actualiza en Mercado Pago desde el próximo cobro. **Mercado Pago puede pedirle a la institución que apruebe un aumento** antes de seguir cobrando; si pasa, se le avisa al equipo.
- **Cancelar:** la institución lo cancela cuando quiere desde Plan y facturación (Mercado Pago deja de cobrar de inmediato). También se cancela al darla de baja y, si el equipo lo tilda, al suspenderla.
- **Cobro rechazado:** Mercado Pago reintenta solo (su documentación no fija cuántas veces). UNIDOAR avisa a la institución por la campanita y por mail, y avisa al equipo. Mientras no se cobre, la factura queda impaga.
- **Recordatorios de factura:** quien tiene el débito activo no recibe los mails "vence pronto" ni "está vencida".
- **Proveedor:** Mercado Pago procesa el cobro (ya figura en la Política de Privacidad). Recibe el monto del plan y el nombre del plan y de la institución; la cuenta y la tarjeta las carga la persona directamente en Mercado Pago.

## Qué conviene que cubran los Términos (a decidir por la titular)

1. **La autorización del débito:** que la institución autoriza cobros mensuales recurrentes por el monto de su plan, y hasta cuándo (hasta que lo cancele).
2. **Aumentos de precio:** con cuánta anticipación se avisan, y que pueden requerir una nueva aprobación en Mercado Pago.
3. **Cancelación:** desde dónde se hace, desde cuándo rige y qué pasa con el mes ya cobrado (¿se prorratea o se devuelve algo? hoy no hay una regla escrita).
4. **Cobros rechazados:** cuántos días de gracia hay, y qué consecuencias tiene no pagar (suspensión de la cuenta, baja). Hoy el sistema solo avisa; suspender es una decisión manual del equipo.
5. **Devoluciones:** quién las decide y cómo se piden. Hoy se hacen a mano desde el panel de Mercado Pago y se corrige la factura con "Anular pago".
6. **Suspensión y baja:** que al suspender o dar de baja el débito se cancela, y que al reactivar la cuenta la institución tiene que activarlo de nuevo.
7. **Facturación:** que sigue habiendo una factura por mes, cuándo se emite y a nombre de quién (los datos fiscales de la institución).
8. **Mercado Pago como tercero:** que el procesamiento del pago se rige además por sus propios términos.

## Qué conviene que cubra la Política de Privacidad

- Ya describe qué datos de débito guarda UNIDOAR y qué recibe Mercado Pago.
- Falta, como en el resto del documento, la revisión legal general (responsable del tratamiento, registro de la base y transferencia a servidores fuera del país).
