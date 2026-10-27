import type { ManualDeAyuda } from "./tipos";

/*
 * Manual del equipo de UNIDOAR: cómo se opera el backoffice. Es interno: solo se abre desde `/backoffice/ayuda` con una cuenta admin (documenta
 * criterios de verificación y movimientos de dinero). Se escribe con los nombres que ve el equipo en pantalla.
 */
export const MANUAL_EQUIPO: ManualDeAyuda = {
  perfil: "equipo",
  nombre: "Equipo UNIDOAR",
  titulo: "Manual del equipo",
  bajada:
    "Para quienes administran UNIDOAR: verificar profesionales e instituciones, cobrar, editar planes y precios, y mantener el contenido del sitio.",
  capitulos: [
    {
      id: "antes-de-empezar",
      titulo: "Antes de empezar",
      articulos: [
        {
          slug: "moverse-por-el-backoffice",
          titulo: "Moverse por el backoffice",
          resumen: "Qué hay en cada sección del menú y qué cuidados tener con lo que no se puede deshacer.",
          bloques: [
            {
              p: "El backoffice es el área del equipo. Entran solo las cuentas con rol **admin**: quien administra la plataforma las habilita con el comando `pnpm db:admin`. Cualquier otra cuenta vuelve a su propio inicio.",
            },
            {
              lista: [
                "**Panel → Operación:** cómo viene la plataforma.",
                "**Personas:** Verificación, Profesionales, Instituciones y Altas sin terminar.",
                "**Negocio:** Cobros, Planes y Referidos.",
                "**Contenido:** Categorías, Testimonios y Mensajes.",
              ],
            },
            {
              p: "**Todo lo que hace el equipo queda registrado** (quién, qué y cuándo); hoy ese historial se ve en la **Actividad del equipo** de la ficha de cada institución. Los avisos para el equipo (un mensaje de Contacto, documentación nueva para revisar, una baja solicitada, alguien que elige pagar por semestre) llegan por mail a la dirección interna configurada o, si no hay, a las cuentas admin: el backoffice no tiene campanita.",
            },
            {
              nota: "Las acciones que **no se pueden deshacer** (procesar una baja, borrar una cuenta sin terminar, eliminar un testimonio) piden confirmar; las bajas y las cuentas sin terminar, además, escribiendo el email o el nombre de la cuenta. Leé el resumen de lo que se va a borrar antes de confirmar.",
            },
          ],
        },
        {
          slug: "operacion",
          titulo: "Operación: cómo viene la plataforma",
          resumen: "El tablero para saber dónde hace falta ayudar: profesionales, búsquedas flojas e instituciones en riesgo.",
          bloques: [
            {
              p: "[Operación](/backoffice/operacion) se puede mirar por período (el selector de arriba). Tiene cuatro cifras y tres paneles:",
            },
            {
              lista: [
                "**Profesionales activos** y cuántos se sumaron en el período.",
                "**Primera postulación:** cuánto tarda en promedio una búsqueda en recibir la primera.",
                "**Búsquedas flojas:** abiertas con pocos postulantes tras una semana. El panel **Búsquedas para empujar por teléfono** las lista con el teléfono de la institución para llamarla.",
                "**Riesgo de no renovar:** instituciones sin actividad en el período.",
                "**Profesionales por zona:** dónde falta oferta para las búsquedas abiertas.",
                "**Profesionales por calidad de perfil:** cuánto de completo está el perfil de los profesionales.",
              ],
            },
            {
              nota: "Las cifras no cuentan las búsquedas de instituciones suspendidas. Si se prendió la opción de ocultar los datos de ejemplo, tampoco cuentan los profesionales e instituciones de ejemplo.",
            },
          ],
        },
      ],
    },
    {
      id: "personas",
      titulo: "Personas",
      articulos: [
        {
          slug: "verificar-profesionales",
          titulo: "Verificar profesionales",
          resumen: "La cola de verificación: qué revisar y cómo verificar, pedir una corrección o rechazar.",
          bloques: [
            {
              p: "[Verificación](/backoffice/verificacion) lista a los profesionales con el alta completa que esperan revisión, los más antiguos primero. Las pestañas separan **Toda la cola**, **En cola** y **Corrección pedida**.",
            },
            {
              pasos: [
                "Abrí la ficha y mirá la documentación: frente y dorso del DNI, el título o —si todavía estudia— la constancia de alumno regular, y el certificado de buena conducta si lo subió.",
                "Tildá lo que revisaste: **Revisé el DNI (identidad)** es obligatorio; en un estudiante hay que tildar también **Revisé la constancia de alumno regular**.",
                "Elegí: **Verificar**, **Pedir corrección** (con un mensaje para que la persona sepa qué subir de nuevo) o **Rechazar** (con el motivo; se le avisa).",
              ],
            },
            {
              lista: [
                "**Verificar borra las fotos del DNI** de la persona: hoy se borran en ese mismo momento. A la persona se le promete que se eliminan **dentro de las 24 horas de verificada su identidad**; el plazo corre desde la verificación, no desde que las subió, y mientras el perfil esté en corrección o rechazado las fotos se conservan. Se conserva el número de DNI (y el CUIL) como constancia. El título, el certificado de buena conducta y la constancia no se borran. La persona lo sabe: se le explica en el alta.",
                "Verificar a un **estudiante nunca marca su título** como verificado.",
                "Con **Corrección pedida** la persona sube lo que falta desde Mi perfil y vuelve a la cola.",
                "Un perfil **rechazado** puede reabrirse con **Reabrir la revisión** desde su ficha: pasa a «Corrección pedida» con un mensaje y puede volver a subir su documentación.",
                "Si una persona verificada se recibe y sube su título, le llega un mail al equipo: validalo con **Verificar título** en su ficha. Solo toca el título, no la identidad.",
              ],
            },
          ],
        },
        {
          slug: "gestionar-profesionales",
          titulo: "Gestionar la cuenta de un profesional",
          resumen: "Suspender, reactivar y procesar la baja de un profesional.",
          bloques: [
            { p: "En [Profesionales](/backoffice/docentes) buscás y filtrás a todas las personas con el alta completa; la ficha tiene los datos, la documentación, el historial y las acciones." },
            {
              lista: [
                "**Suspender cuenta:** pide un motivo, que queda registrado y se le manda a la persona. Una cuenta suspendida deja de aparecer en el sitio y en los buscadores, no puede usar la plataforma (ve un aviso de cuenta suspendida) y en las fichas de las instituciones se muestra como «Perfil suspendido» y sin su contacto. **Reactivar cuenta** la devuelve a la normalidad y avisa.",
                "**Procesar baja:** **borra los datos de la persona de forma definitiva** (perfil, postulaciones, CV, documentos, avisos y mails que la nombran) y su cuenta de acceso. Pide escribir el email de la cuenta, y muestra antes qué se va a llevar. Funciona aunque la persona no haya pedido la baja. Cuando pide la baja desde Mi cuenta, la ficha muestra «Baja solicitada».",
              ],
            },
            {
              nota: "Un perfil rechazado o suspendido sigue existiendo: si la persona vuelve a registrarse con el mismo email **no recibe ningún mail** (es a propósito, para no revelar quién tiene cuenta). Para destrabarla usá **Reactivar cuenta** o **Reabrir la revisión**.",
            },
            {
              p: "Una vez verificado el DNI, el **nombre y el apellido** de la persona quedan fijos. Si pide corregirlos, hoy se hace a mano en la base de datos.",
            },
          ],
        },
        {
          slug: "gestionar-instituciones",
          titulo: "Gestionar instituciones",
          resumen: "Verificar, suspender, editar el perfil y las sedes, cambiar el plan y dar de baja.",
          bloques: [
            { p: "En [Instituciones](/backoffice/instituciones) buscás por nombre, tipo, plan, estado o zona. La ficha muestra el equipo, las búsquedas, las facturas, el próximo cobro y la **Actividad del equipo**." },
            {
              lista: [
                "**Verificar institución / Quitar verificación:** revisás nombre, tipo y CUIT. Al verificar se le avisa a la institución que la recomendó (si la hubo). El nombre y el tipo de una institución verificada solo los cambia el equipo.",
                "**Suspender cuenta:** pide un motivo y bloquea el acceso del equipo de la institución. Si tiene débito automático vivo, una casilla (tildada por defecto) permite **cancelarlo también**: si Mercado Pago no responde, no se suspende nada y podés reintentar. **Reactivar cuenta** la devuelve y le recuerda que el débito sigue cancelado.",
                "**Editar perfil:** edita como la institución su perfil público, las **sedes** (con el CUE de cada una, que solo carga el equipo) y los **datos de la cuenta** (teléfono y CUIT). No se le avisa a la institución; queda en la actividad.",
                "**Plan:** podés asignarle cualquier plan. Desde Cobros se atienden los pedidos de cambio que hace la institución.",
                "**Procesar baja:** **no se puede deshacer**. Pide escribir el nombre exacto de la institución. Borra el equipo, las búsquedas con sus postulantes, los cursos y los contactos, pero **conserva lo fiscal**: datos de la institución y todas sus facturas (una deuda no se borra). Cancela antes el débito automático. Una institución dada de baja no se reactiva.",
              ],
            },
            {
              nota: "Las instituciones de ejemplo no se pueden dar de baja desde acá y una dada de baja deja de ofrecer suspender, plan y editar.",
            },
          ],
        },
        {
          slug: "altas-sin-terminar",
          titulo: "Altas sin terminar",
          resumen: "Cómo ver y borrar cuentas que se registraron y nunca terminaron el alta.",
          bloques: [
            {
              p: "[Altas sin terminar](/backoffice/altas-sin-terminar) muestra a quienes se registraron hace más de 24 horas y no terminaron: las que **eligieron un rol y no siguieron** y las que **nunca entraron al alta** (solo existen como cuenta de acceso). Indica en qué punto se quedó cada una.",
            },
            {
              p: "**Borrar** pide escribir el email de la cuenta y la elimina por completo, con sus archivos y su acceso. No se puede deshacer. Nunca borra cuentas admin, de ejemplo ni con el alta completa (esas se dan de baja desde su ficha), ni la propia.",
            },
            { nota: "Sirve para limpiar registros abandonados o falsos. No hay captcha en el registro a propósito: esta pantalla y los topes de envío son la defensa." },
          ],
        },
      ],
    },
    {
      id: "negocio",
      titulo: "Negocio",
      articulos: [
        {
          slug: "cobros-y-facturas",
          titulo: "Cobros y facturas",
          resumen: "Cómo se generan las facturas y cómo registrar un pago.",
          bloques: [
            {
              p: "[Cobros](/backoffice/cobros) lista las cuentas con su plan, su estado de pago y el próximo cobro. Cada cuenta tiene su ficha con las secciones **Medio de pago**, **Búsquedas puntuales**, **Meses bonificados**, **Precio** y **Facturación**.",
            },
            {
              lista: [
                "**Las facturas de cada mes se crean solas** todos los días a las 9:00 (hora de Argentina), para las cuentas que no están suspendidas ni son de ejemplo y que **ya tienen una factura cargada**. La primera factura de cada cuenta la cargás vos con **Cargar factura**.",
                "**Registrar pago:** en una factura impaga, para anotar que se pagó.",
                "**Registrar pago en efectivo:** en un solo paso, sobre la factura impaga del mes o creándola ya paga. El monto sale del plan, nunca se escribe a mano. Podés guardar una nota (por ejemplo, el número de recibo) y avisar a la institución con una casilla.",
                "**Anular pago:** deshace lo que hizo el pago: si el pago creó la factura, la elimina; si convirtió una impaga en un semestre, la devuelve a un solo mes.",
              ],
            },
            {
              p: "Cuando se registra un pago, la institución recibe un aviso en la campanita y un mail de pago registrado. Los mismos botones para registrar pagos están también en la ficha de la institución.",
            },
            {
              p: "**Mora:** si una factura impaga cumple más de 15 días de vencida, la cuenta queda **limitada** (no puede publicar ni reabrir búsquedas, publicar cursos ni invitar profesionales). La ficha de cobros lo muestra («Factura vencida hace N días: en período de gracia hasta…» o «Cuenta limitada por mora»). **No hace falta hacer nada para levantarla**: al registrar el pago de la factura, se levanta sola. No es una suspensión: eso sigue siendo manual.",
            },
          ],
        },
        {
          slug: "semestre-precio-y-busquedas-puntuales",
          titulo: "Semestre, precio acordado y búsquedas puntuales",
          resumen: "Los pagos especiales: semestre al contado, convenios y una sola búsqueda.",
          bloques: [
            {
              p: "**Registrar semestre al contado:** cuando una institución con abono mensual paga por adelantado, lo registrás desde su ficha de cobros. Queda **una factura paga que cubre los meses** del semestre (el monto sale del plan y de los meses que se pagan). Si el mes de inicio tenía una factura impaga, se convierte en la del semestre. No se puede registrar si algún mes de la ventana ya está pago, si otro mes de la ventana tiene una factura impaga, ni con la búsqueda puntual. Si la institución tenía débito automático, el registro lo cancela antes.",
            },
            {
              p: "**Precio acordado:** en la sección **Precio** de la ficha de cobros, **Acordar un precio**. Hay dos formas: **abono** (un abono propio, entre un peso y el precio de lista, que reemplaza a la lista; las sedes adicionales siguen con su descuento) y **convenio a medida** (un monto mensual fijo sin importar las sedes: es lo que se usa con las redes). Rige desde la próxima factura y solo mientras la institución siga en el plan para el que se acordó.",
            },
            {
              nota: "El plan **Multisede sin convenio a medida no se factura**: el valor de las redes se acuerda con cada una. Hasta cargar el convenio no se crean facturas ni se ofrece el débito automático.",
            },
            {
              p: "**Búsquedas puntuales:** una institución en el plan de una sola búsqueda paga por adelantado cada búsqueda. Cuando lo recibís, usás **Registrar pago de búsqueda puntual** en la sección Búsquedas puntuales de su ficha: queda una búsqueda disponible que la institución consume al publicar (y que vence con el plazo que figura en Planes). Un pago solo se puede anular si todavía no se usó. No son facturas: no aparecen en el «Historial de facturación» de la institución.",
            },
          ],
        },
        {
          slug: "pedidos-de-cambio-de-plan",
          titulo: "Pedidos de cambio de plan",
          resumen: "Cómo aprobar o rechazar lo que piden las instituciones desde Cambiar de plan.",
          bloques: [
            {
              p: "Cuando una institución pide otro plan desde Plan y facturación, el pedido llega a **Cobros** con las acciones **Aprobar** y **Rechazar**, y le avisamos a la institución lo que resuelvas. Aprobar actualiza el plan y, si corresponde, la factura del mes (no se crea la de un mes bonificado ni uno ya cubierto por un semestre).",
            },
            {
              lista: [
                "Una institución solo puede pedir el plan que corresponde a su tipo, o Multisede desde cierta cantidad de sedes. Un plan fuera de eso lo asigna el equipo a mano.",
                "Cuando una institución **elige pagar por semestre**, el equipo recibe un mail: coordiná el pago con ella y registralo con **Registrar semestre al contado**. Elegirlo no cobra nada ni cambia el plan.",
                "Si ya hay una institución con plan **Fundador**, ese plan no se ofrece en «Cambiar de plan»: si pasa a otro, pierde lo de fundadora y libera su lugar.",
              ],
            },
          ],
        },
        {
          slug: "planes-y-precios",
          titulo: "Planes y precios",
          resumen: "Cómo editar lo que cobra UNIDOAR y qué cambia al guardar.",
          bloques: [
            {
              p: "[Planes](/backoffice/planes) está ordenada como la página pública de precios: **Profesionales** (gratis), **Instituciones** (los planes que se ofrecen y las **Condiciones**), **Fundadoras** y **Búsqueda puntual**. Lo que guardás cambia la página de aranceles, el plan de cada cuenta y las facturas que se creen de ahora en más.",
            },
            {
              lista: [
                "**Precio de lista:** es el único que se muestra al público. **No hay precio mínimo**: los precios por institución se acuerdan desde Cobros.",
                "**Condiciones:** desde cuántas sedes corresponde Multisede, el descuento de cada sede adicional, el pack del semestre al contado (cuántos meses se pagan y cuántos se usan), qué tipos de institución pagan el arancel de colegios y los meses bonificados por recomendación.",
                "**Plan Fundador:** su precio **nunca** se muestra al público ni en el alta; lo recibe sola cada cuenta nueva mientras queden lugares (el cupo se edita acá).",
                "**Búsqueda puntual:** su precio y sus condiciones (días de vigencia, búsquedas abiertas a la vez, y si incluye cursos y el buscador).",
              ],
            },
            {
              p: "Al guardar, la pantalla pide confirmar con un resumen y avisa **cuántas instituciones tiene cada plan**. Si otra persona del equipo guardó mientras tanto, no pisa sus cambios y te pide recargar. «Últimos cambios» muestra qué se cambió y quién.",
            },
            {
              nota: "Un cambio de precio **rige para lo que venga**: las facturas ya emitidas conservan su monto. Cambiar el precio de un plan afecta lo que se factura de ahí en más a todas las cuentas que lo tienen.",
            },
          ],
        },
        {
          slug: "referidos",
          titulo: "Referidos",
          resumen: "Cómo aplicar el beneficio a quien recomendó y gestionar las devoluciones.",
          bloques: [
            {
              p: "[Referidos](/backoffice/referidos) tiene las pestañas **Para aplicar**, **En curso**, **Aplicados** y **Todos**. El paso de cada recomendación se calcula solo: se registró → verificada → ya pagó → beneficio aplicado.",
            },
            {
              lista: [
                "El beneficio solo se puede aplicar cuando la institución **recomendada ya pagó** (alguna factura paga): mirá la pestaña **Para aplicar**.",
                "**Aplicar el mes bonificado** crea los meses para quien recomendó. Hay un tope de **un mes bonificado por semestre**: lo que sobra queda guardado. Un mes bonificado no se factura; quien paga por semestre recibe un mes menos en el semestre.",
                "Si la institución tiene **débito automático**, Mercado Pago cobra igual y el equipo devuelve el monto a mano desde su cuenta: se anota en la pestaña **Devoluciones**.",
                "Podés **deshacer** un beneficio solo si todavía no se gastó ningún mes.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "contenido",
      titulo: "Contenido del sitio",
      articulos: [
        {
          slug: "categorias",
          titulo: "Categorías y asignaturas",
          resumen: "Cómo agregar, renombrar o quitar asignaturas y rubros.",
          bloques: [
            {
              p: "[Categorías](/backoffice/categorias) es el catálogo de **asignaturas o disciplinas** de cada categoría de cargo (Docente, Entrenador y Guardavidas, que son fijas). Es lo que ven las instituciones al publicar y los profesionales al armar su perfil.",
            },
            {
              lista: [
                "**Agregar** una asignatura a un rubro existente, o crear un rubro nuevo con su primera asignatura.",
                "**Renombrar** una asignatura: se actualiza también en los perfiles de los profesionales y en las búsquedas que ya la usan. Antes de confirmar ves a cuántos alcanza.",
                "**Eliminar** una asignatura: deja de ofrecerse al publicar y en el alta, pero se mantiene en lo que ya existe.",
                "**Renombrar un rubro** cambia el nombre en todas sus asignaturas.",
              ],
            },
          ],
        },
        {
          slug: "testimonios",
          titulo: "Testimonios",
          resumen: "Cómo cargar los testimonios de la portada y de las páginas de cada categoría.",
          bloques: [
            {
              p: "En [Testimonios](/backoffice/testimonios) cargás lo que dicen las instituciones. Los testimonios están agrupados por la página donde se muestran: **Portada**, **Docentes**, **Entrenadores** y **Guardavidas**. Solo se ven en el sitio los que están **visibles**; una página sin ninguno visible no muestra la sección.",
            },
            {
              pasos: [
                "Tocá **Agregar testimonio** (o **+ Agregar acá** en la página que quieras).",
                "Elegí dónde se muestra y escribí el testimonio **sin comillas** (el sitio las pone), el nombre y el cargo con la institución. La foto es opcional: sin foto se muestran las iniciales.",
                "Guardá. El nuevo va al final de su página.",
              ],
            },
            {
              lista: [
                "**Ocultar / Mostrar:** saca un testimonio del sitio sin borrarlo.",
                "**Editar:** cambia el texto, la foto o la página (al cambiar de página va al final de la nueva).",
                "**Eliminar:** lo borra para siempre, con su foto.",
                "Cada página admite hasta 12 testimonios (los ocultos también cuentan).",
              ],
            },
            {
              nota: "Cargá solo testimonios de personas que aceptaron que se publiquen con su nombre y su foto.",
            },
          ],
        },
        {
          slug: "mensajes",
          titulo: "Mensajes",
          resumen: "Las consultas que llegan desde el formulario de Contacto.",
          bloques: [
            {
              p: "[Mensajes](/backoffice/mensajes) reúne las consultas del formulario de [Contacto](/contacto), de la más nueva a la más vieja. Cada una trae el nombre y el email de quien escribe; además llega por mail al equipo, con «responder a» apuntando a esa persona.",
            },
            { nota: "El formulario tiene topes para evitar abuso: pocos mensajes por hora por email y un total por hora. Si alguien dice que no puede escribir, puede ser eso." },
          ],
        },
      ],
    },
  ],
  preguntas: [
    {
      pregunta: "¿Cómo le doy acceso al backoffice a otra persona?",
      respuesta: [{ p: "El rol admin lo habilita quien administra la plataforma con el comando `pnpm db:admin --email=<correo>` (y con `--rol=institucion` se lo quita). No se hace desde la pantalla." }],
    },
    {
      pregunta: "Registré un pago por error, ¿cómo lo deshago?",
      respuesta: [{ p: "En la factura usá **Anular pago**: vuelve a impaga (o se elimina, si el pago la había creado). Ver [Cobros y facturas](/backoffice/ayuda/cobros-y-facturas)." }],
    },
    {
      pregunta: "Una institución dice que no puede publicar una búsqueda, ¿qué reviso?",
      respuesta: [
        {
          lista: [
            "Mirá su ficha de cobros: puede estar **limitada por mora** (factura vencida hace más de 15 días). Se levanta sola al registrar el pago.",
            "Si está en el plan de **una sola búsqueda**, necesita un pago registrado: sin una búsqueda disponible no se puede publicar.",
            "Verificá que la cuenta no esté suspendida.",
          ],
        },
      ],
    },
    {
      pregunta: "¿Cambiar un precio modifica las facturas ya emitidas?",
      respuesta: [{ p: "No. Las facturas emitidas conservan su monto. El cambio rige para las que se creen de ahí en adelante. Ver [Planes y precios](/backoffice/ayuda/planes-y-precios)." }],
    },
    {
      pregunta: "¿Se puede reactivar una institución dada de baja?",
      respuesta: [{ p: "No. La baja es definitiva: si la institución vuelve, se crea una cuenta nueva. Se conservan sus datos fiscales y sus facturas." }],
    },
    {
      pregunta: "Un profesional rechazado quiere volver a intentar, ¿qué hago?",
      respuesta: [{ p: "Usá **Reabrir la revisión** en su ficha: pasa a «Corrección pedida» y la persona puede volver a subir su documentación. Ver [Verificar profesionales](/backoffice/ayuda/verificar-profesionales)." }],
    },
    {
      pregunta: "¿Dónde veo qué cambió el equipo en una institución?",
      respuesta: [{ p: "En la sección **Actividad del equipo** de la ficha de la institución: cada cambio de plan, verificación, edición, pago o acuerdo de precio queda con la fecha y quién lo hizo." }],
    },
  ],
};
