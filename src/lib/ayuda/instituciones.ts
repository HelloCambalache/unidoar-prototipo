import type { ManualDeAyuda } from "./tipos";

/*
 * Manual para instituciones (colegios, clubes, institutos, gimnasios, natatorios…). Se escribe con los nombres que ve la persona en pantalla
 * (menús, botones, etapas). Si cambia una pantalla, se corrige acá. No pone precios: los valores vigentes están en Planes y los edita el equipo.
 */
export const MANUAL_INSTITUCIONES: ManualDeAyuda = {
  perfil: "instituciones",
  nombre: "Instituciones",
  titulo: "Manual para instituciones",
  bajada:
    "Para colegios, clubes, institutos y gimnasios: cómo publicar búsquedas, elegir a quién contratar, armar tu equipo y manejar tu plan.",
  capitulos: [
    {
      id: "empezar",
      titulo: "Empezar",
      articulos: [
        {
          slug: "crear-la-cuenta",
          titulo: "Crear la cuenta de tu institución",
          resumen: "Los tres pasos del alta y cómo elegir cómo usar UNIDOAR.",
          bloques: [
            {
              pasos: [
                "**Tu acceso:** en [Crear cuenta](/registro) elegí **Soy institución**, escribí tu email y una contraseña (o entrá con Google) y aceptá los [términos y condiciones](/terminos). Te mandamos un mail para confirmar la cuenta: tocá el botón.",
                "**Contanos sobre tu institución:** nombre, tipo (colegio, club, instituto, natatorio…), CUIT, teléfono y la dirección de tu sede, que se ubica sola mientras la escribís. Al final de este paso elegís **cómo querés usar UNIDOAR**: abono mensual, abono semestral o una sola búsqueda (está explicado en la guía de [plan y facturación](/ayuda/instituciones/plan-y-facturacion)).",
                "**Completá tu perfil:** logo, foto de portada y una descripción. Es opcional y lo podés cambiar después.",
              ],
            },
            {
              p: "Podés usar **Guardar y salir** en cualquier paso y retomar más tarde. Si otra institución te recomendó UNIDOAR, podés entrar por su enlace o, si solo te pasó el código, escribirlo en el campo «Código de referido» de **Tu acceso** (el primer paso): eso queda registrado para que ella reciba su beneficio (ver [Referidos](/ayuda/instituciones/referidos)). En el segundo paso lo vas a ver anotado, por si querés cambiarlo.",
            },
            {
              p: "El equipo de UNIDOAR revisa los datos de tu institución (nombre, tipo y CUIT) y la marca como **verificada**: se ve con un sello en el catálogo. Una vez verificada, el nombre y el tipo solo los cambia el equipo: si necesitás corregirlos, escribinos por [Contacto](/contacto).",
            },
            { nota: "Una invitación a un equipo no crea una institución nueva: si te invitaron, usá el enlace del mail. Ver [Tu equipo](/ayuda/instituciones/tu-equipo)." },
          ],
        },
        {
          slug: "perfil-y-sedes",
          titulo: "Perfil público y sedes",
          resumen: "Cómo te ven los profesionales y cómo cargar más de una sede.",
          bloques: [
            {
              p: "En [Mi perfil](/institucion/vitrina) editás lo que ven los profesionales en la página de tu institución: logo, portada, descripción, fotos, novedades y datos como alumnos, niveles o turnos. Solo el dueño y los administradores del equipo pueden editarlo.",
            },
            {
              p: "**Compartir tu perfil:** arriba, junto a **Ver perfil público**, el botón **Compartir** te deja copiar el enlace de la página de tu institución o mandarlo por WhatsApp, Facebook, LinkedIn, X o mail. Cualquiera que tenga el enlace la ve, con o sin cuenta. Lo mismo pasa con cada una de tus búsquedas abiertas (ver [Publicar una búsqueda](/ayuda/instituciones/publicar-una-busqueda)).",
            },
            {
              p: "Una institución puede tener **una o más sedes**. Se cargan en [Sedes](/institucion/sedes): la primera es la **sede principal** (no se puede quitar sin marcar otra) y cada una tiene nombre y dirección. La dirección se ubica sola mientras la escribís: si no la encuentra, completás partido y provincia a mano.",
            },
            {
              lista: [
                "Los profesionales ven todas tus sedes en tu perfil, numeradas, y un pin por sede en el mapa.",
                "Al publicar una búsqueda elegís en qué sede es (o en varias a la vez). Los kilómetros que ve cada profesional se miden desde esa sede.",
                "No podés quitar una sede que tenga búsquedas abiertas.",
                "Cada sede adicional suma al precio del plan, con un descuento: la pantalla Sedes te avisa cuánto antes de guardar.",
                "**CUE:** si tu tipo de institución lo pide (colegios, jardines, terciarios), lo escribís al crear la cuenta y queda en la sede principal. Después, y para las demás sedes, lo carga el equipo de UNIDOAR.",
              ],
            },
            { nota: "Si dos personas del equipo editan a la vez, el segundo guardado te avisa y te pide recargar, para que nadie pise los cambios del otro." },
          ],
        },
        {
          slug: "tu-equipo",
          titulo: "Tu equipo: invitar y roles",
          resumen: "Cómo sumar a otras personas de tu institución y qué puede hacer cada una.",
          bloques: [
            {
              p: "En [Equipo](/institucion/equipo) el dueño y los administradores invitan a otras personas. La invitación le llega por mail a quien invitás, con un enlace propio.",
            },
            {
              pasos: [
                "Tocá **Invitar a alguien**, escribí el email y elegí el rol.",
                "La persona abre el enlace del mail, crea su contraseña y confirma su email (tiene que ser el mismo con el que la invitaste).",
                "Al terminar ve la invitación y la **acepta con un toque** (o la rechaza). Recién ahí entra a tu equipo y recibís un aviso.",
              ],
            },
            {
              lista: [
                "**Dueño:** acceso total. Es único y no se puede invitar.",
                "**Administrador/a:** maneja el equipo (invita, cambia roles, quita gente), edita el perfil público y las sedes, y pide cambios de plan.",
                "Los demás roles —reclutador, coordinador, director, secretario, referente, facturación u otro— publican, mueven postulantes, contratan y ven los datos de contacto. **No** manejan el equipo, el perfil público, las sedes ni el plan.",
              ],
            },
            {
              p: "Las invitaciones **vencen a los 30 días**. Una vencida aparece como «Invitación vencida» y se reemplaza invitando de nuevo. Quien no es dueño puede salir del equipo desde su Mi cuenta.",
            },
          ],
        },
      ],
    },
    {
      id: "contratar",
      titulo: "Publicar y contratar",
      articulos: [
        {
          slug: "publicar-una-busqueda",
          titulo: "Publicar una búsqueda",
          resumen: "Búsqueda planificada o urgente, y cómo escribirla para que te encuentren.",
          bloques: [
            { p: "Entrá a [Publicaciones](/institucion/busquedas) y tocá **Publicar una búsqueda**, o usá el botón rojo **Búsqueda urgente** al pie de Buscar profesionales." },
            {
              pasos: [
                "Elegí el tipo: **Búsqueda planificada** (un cargo titular, suplencia, temporada o freelance) o **Búsqueda urgente** (una suplencia que hay que cubrir ya).",
                "Completá el puesto, la categoría, la disciplina, el nivel, el turno y la carga horaria. Si tenés más de una sede, elegís cuál (o varias a la vez: se crea una búsqueda igual por sede).",
                "Escribí el título, la descripción y los requisitos. Los botones **Sugerir** arman un texto de partida con lo que cargaste: podés probar otra redacción y cambiarlo a tu gusto.",
                "Mirá cuántos profesionales coinciden con lo que pedís y tocá **Publicar búsqueda**.",
              ],
            },
            {
              p: "Al publicar avisamos a los profesionales que encajan con tu búsqueda. Una **búsqueda urgente** vence en el plazo que elegís al publicarla («Responder antes de»: 24 horas si no lo cambiás) y les llega por campanita y por mail.",
            },
            { nota: "Los textos sugeridos no inventan beneficios ni sueldos: solo usan lo que cargaste y las tareas y requisitos habituales de la categoría. Revisalos y ajustalos." },
            {
              p: "**Compartir una búsqueda:** cada búsqueda abierta tiene su propia página pública. En [Publicaciones](/institucion/busquedas) y en el tablero de postulantes, el botón **Compartir** te deja copiar el enlace o mandarlo por WhatsApp, Facebook, LinkedIn, X o mail, para que te lleguen más postulantes. Quien abre el enlace ve el puesto, la descripción, los requisitos y lo que ofrecés, sin necesidad de tener cuenta, y puede crear la suya para postularse. Nunca ve quiénes se postularon. Si cerrás o pausás la búsqueda, el enlace pasa a decir que ya no está abierta y deja de mostrar el detalle.",
            },
            {
              p: "Desde [Publicaciones](/institucion/busquedas) podés **editar** una búsqueda, **cerrarla** cuando ya cubriste el puesto (avisamos a quienes se postularon) o **reabrirla** cuando quieras (una urgente vencida vuelve a abrir por 24 horas más; la de una sola búsqueda, solo mientras no pasó su plazo). Si tu cuenta tiene una factura vencida hace más de 15 días no se pueden publicar ni reabrir búsquedas hasta regularizarla (ver [Plan y facturación](/ayuda/instituciones/plan-y-facturacion)).",
            },
          ],
        },
        {
          slug: "tablero-de-postulantes",
          titulo: "Tablero de postulantes",
          resumen: "Las etapas de cada búsqueda, las entrevistas y cómo contratar.",
          bloques: [
            {
              p: "Cada búsqueda tiene su tablero: en [Publicaciones](/institucion/busquedas) tocá **Ver postulantes**. Las personas que se postularon (o aceptaron tu invitación) aparecen como tarjetas y se arrastran entre columnas:",
            },
            {
              lista: [
                "**Nuevos:** acaban de llegar.",
                "**Preseleccionados:** los que te interesan.",
                "**Entrevista:** agendaste una entrevista.",
                "**Oferta:** les enviaste una oferta.",
                "**Examen preocupacional:** pedís el estudio médico para ingresar (opcional).",
                "**Contratados:** se sumaron.",
              ],
            },
            {
              p: "La mayoría de los cambios de etapa le llegan al profesional como aviso en la campanita (y por mail, según la etapa); pasar a alguien a **Nuevos** no avisa. **Archivar** a alguien es silencioso: no se le avisa. Tocando una tarjeta abrís su ficha: perfil, CV, teléfono y email, las notas internas del equipo y la agenda.",
            },
            {
              pasos: [
                "**Entrevista:** desde la ficha elegí día y hora. El profesional recibe un aviso y responde **Voy** o **No puedo**; ves su respuesta en la tarjeta («confirmó ✓» o «No puede ir: reprogramá»). Si cambiás o quitás la entrevista, su respuesta se borra.",
                "**Contratar:** tocá **Contratar** en la ficha. Podés cerrar la búsqueda en el mismo paso (si todavía necesitás cubrir más cargos, destildalo). Al contratar avisamos a la persona; si la búsqueda se cierra, avisamos al resto.",
              ],
            },
            { nota: "Los datos de contacto y el CV solo se ven de quienes se postularon o te enviaron su CV. Una persona a la que solo invitaste no los muestra hasta que acepte la invitación." },
          ],
        },
        {
          slug: "examen-preocupacional",
          titulo: "Examen preocupacional",
          resumen: "Cómo usar la etapa si pedís el estudio médico, y cómo guardar los archivos.",
          bloques: [
            {
              p: "Si para ingresar a trabajar pedís el estudio médico, movés a la persona a la etapa **Examen preocupacional** (después de Oferta y antes de Contratados). Si no lo pedís, no usás esa etapa y no pasa nada.",
            },
            {
              lista: [
                "En la ficha, el checklist **Para ingresar a trabajar** tiene la casilla «Hizo el examen preocupacional». La persona ve si está **pendiente** o **realizado**.",
                "Podés **adjuntar los archivos del estudio** (hasta 5, en PDF o foto) y quitarlos cuando quieras.",
                "Al **Contratar** a alguien que sigue en esa etapa sin el examen, te pedimos confirmar con «Contratarla igual, sin el examen».",
              ],
            },
            {
              nota: "Es información de salud: los archivos se guardan en un espacio privado y **solo los ve tu institución**. El profesional no los ve (solo si está pendiente o realizado) y nunca se publican en una dirección abierta.",
            },
          ],
        },
      ],
    },
    {
      id: "encontrar-profesionales",
      titulo: "Encontrar profesionales",
      articulos: [
        {
          slug: "buscar-profesionales",
          titulo: "Buscar profesionales",
          resumen: "El buscador único, los filtros y cómo invitar a alguien a postularse.",
          bloques: [
            {
              p: "En [Buscar profesionales](/institucion/buscar-docentes) está el catálogo de docentes, entrenadores y guardavidas.",
            },
            {
              lista: [
                "**Un solo buscador:** escribí un nombre, una disciplina o contá qué necesitás («profe de inglés para secundario, turno mañana») y te armamos los filtros. Abajo ves qué entendimos y qué no pudimos aplicar. Un pedido urgente («para mañana mismo») te lleva a la pantalla de **Suplencias** (la que abre el botón **Búsqueda rápida**).",
                "**Filtros y orden:** nivel, tipo de búsqueda, disciplinas y zonas, solo verificados, favoritos y orden por recomendados, experiencia, cercanía o nombre.",
                "**Cercanía:** se mide desde la sede de la búsqueda que elijas o, sin elegir, desde tus sedes: cada profesional, a la más cercana.",
                "**Favoritos:** la estrella guarda a alguien para tenerlo a mano.",
              ],
            },
            {
              p: "Al abrir un perfil ves su formación, experiencia, zonas y disponibilidad, y el sello de verificado. Si es estudiante, la insignia dice cuánto de la carrera tiene aprobado. Desde ahí lo podés **invitar a postularse** a una de tus búsquedas abiertas: si tenés más de una, te preguntamos a cuál; si tenés una sola, se invita a esa.",
            },
            {
              nota: "Invitar **no te da su contacto**: lo ves cuando acepta la invitación (se postula) o te envía su CV. Hay un máximo de 60 invitaciones por día.",
            },
          ],
        },
        {
          slug: "profesionales-propios",
          titulo: "Tus propios contactos de profesionales",
          resumen: "Cómo cargar a mano o importar por CSV a profesionales que ya conocés.",
          bloques: [
            {
              p: "En [Profesionales](/institucion/base-de-docentes) tenés tu base de personas: las que se postularon, las que te enviaron su CV y las que cargaste vos.",
            },
            {
              lista: [
                "**Cargar perfil:** sumás a una persona a mano. Hace falta el nombre y un email o un teléfono.",
                "**Importar CSV:** subís un archivo de hasta 500 filas (512 KB), con coma, punto y coma o tabulación, y ves una vista previa antes de confirmar. Hay un máximo de 2.000 contactos por institución.",
                "No se duplican por email (ni por teléfono, cuando no hay email).",
              ],
            },
            {
              nota: "Los contactos que cargás son **privados de tu institución**: no son usuarios de UNIDOAR, no se mezclan con las búsquedas y **nunca reciben mails** de la plataforma. Cargá solo datos de personas que aceptaron que los tengas.",
            },
          ],
        },
        {
          slug: "cursos",
          titulo: "Publicar cursos",
          resumen: "Cómo ofrecer capacitaciones a los profesionales y gestionar a los inscriptos.",
          bloques: [
            { p: "En [Mis cursos](/institucion/cursos) publicás capacitaciones para los profesionales de la plataforma." },
            {
              lista: [
                "En **Mis cursos** ves y gestionás **solo los cursos que publicó tu institución**: los de otras instituciones no se muestran. Los profesionales, en cambio, ven los cursos de todas las instituciones en su sección de Cursos.",
                "Un curso puede ser **online** o **presencial**. En un curso presencial la **dirección es obligatoria**: los profesionales ven siempre dónde se dicta y a cuántos kilómetros les queda.",
                "Cada curso muestra quiénes se inscribieron. Cuando terminan podés marcar que lo completaron y **enviarles el certificado**.",
                "Podés editar un curso o borrarlo; si ya tiene inscriptos te pedimos confirmar.",
              ],
            },
            { nota: "Por lo general, la opción de una sola búsqueda no incluye la difusión de cursos." },
          ],
        },
      ],
    },
    {
      id: "plan",
      titulo: "Tu plan",
      articulos: [
        {
          slug: "plan-y-facturacion",
          titulo: "Plan y facturación",
          resumen: "Cómo se calcula lo que pagás, cómo pagás y qué pasa si una factura vence.",
          bloques: [
            {
              p: "En [Plan](/institucion/plan) ves tu plan actual, cuánto pagás con su desglose, tus facturas y tu forma de pago. Los valores vigentes están en [Planes](/planes). El resto del equipo la ve, pero solo el dueño y los administradores piden cambios de plan y manejan el débito.",
            },
            {
              lista: [
                "**Abono por institución:** según tu tipo, pagás el arancel de colegios o el de clubes y academias (según figura en Planes).",
                "**Sedes adicionales:** la primera sede paga el abono completo y cada sede adicional paga ese abono con descuento.",
                "**Redes y grandes cadenas:** el valor se acuerda con el equipo según el volumen. Escribinos por [Contacto](/contacto).",
                "**Pago semestral:** pagando por adelantado el semestre tenés un descuento. Lo elegís desde Cambiar de plan y el equipo lo coordina y lo registra cuando recibe el pago.",
              ],
            },
            {
              p: "Cada mes se genera tu factura y te avisamos por mail. Los pagos por transferencia o en efectivo los registra el equipo cuando los recibe. Si ves habilitado el **débito automático con Mercado Pago** en tu cuenta, lo activás desde esta pantalla: nunca vemos ni guardamos los datos de tu tarjeta.",
            },
            {
              p: "**Comprobante de pago por mail:** cada vez que se registra un pago —lo cargue el equipo o lo cobre el débito automático— el dueño y los administradores reciben un mail con el **comprobante** (número, plan, período, monto, medio de pago y fecha) y un botón para abrirlo en la app, donde lo podés imprimir o guardar como PDF. También lo encontrás cuando quieras en las facturas de [Plan](/institucion/plan).",
            },
            {
              p: "Para pedir otro plan usá **Cambiar de plan**: el pedido lo confirma el equipo. Solo se ofrecen los planes que corresponden a tu institución.",
            },
            {
              p: "**Tu plan se activa con el primer pago:** una cuenta nueva con abono (mensual o semestral) puede completar su perfil y recorrer la plataforma, pero **no puede publicar búsquedas, invitar profesionales ni publicar cursos** hasta que el equipo registre su primer pago. Escribinos por [Contacto](/contacto) o por WhatsApp y coordinamos el pago por transferencia o en efectivo: al registrarlo, el plan queda activo y se habilita todo sin que tengas que hacer nada.",
            },
            {
              p: "**Si una factura vence:** tenés 15 días de gracia antes de que se limite la cuenta. Te avisamos por mail y en un cartel dentro de la app. Pasados los 15 días **no se pueden publicar ni reabrir búsquedas, publicar cursos ni invitar profesionales** hasta pagar. Todo lo demás sigue funcionando —tu tablero, tus postulantes, el buscador y contratar— y al registrarse el pago se levanta solo.",
            },
            {
              p: "En los dos casos, cuando intentás publicar, invitar o crear un curso, la app te muestra un cuadro con **tu plan, lo que cuesta y cómo pagar**, para que sepas qué hacer sin salir de lo que estabas haciendo. No se pierde lo que habías escrito.",
            },
          ],
        },
        {
          slug: "una-sola-busqueda",
          titulo: "Una sola búsqueda (sin abono)",
          resumen: "Para cubrir una vacante puntual sin pagar un abono mensual.",
          bloques: [
            {
              p: "Si solo necesitás cubrir **una vacante**, elegís «Una sola búsqueda» al crear la cuenta. Pagás por cada búsqueda y no hay abono.",
            },
            {
              lista: [
                "El pago lo registra el equipo cuando lo recibe. Hasta entonces no podés publicar: pedilo por [Contacto](/contacto).",
                "Cada pago habilita **una búsqueda**, en una sola sede, que está abierta durante un plazo (figura en Plan).",
                "Al vencer el plazo, la búsqueda se cierra sola y avisamos a quienes se postularon.",
                "Por lo general no incluye el buscador de profesionales, la base de profesionales ni los cursos (lo que incluye tu plan figura en Plan).",
              ],
            },
            {
              p: "Si después querés usar la plataforma sin límites, podés pasarte al abono desde [Plan](/institucion/plan).",
            },
          ],
        },
        {
          slug: "referidos",
          titulo: "Referidos: recomendá UNIDOAR",
          resumen: "Cómo ganar meses bonificados cuando otra institución se suma y paga.",
          bloques: [
            {
              p: "En [Referidos](/institucion/referidos) tenés tu **enlace personal** y tu **código** (8 letras y números): copialos o mandá el enlace por WhatsApp. Cuando otra institución crea su cuenta desde tu enlace —o escribe tu código en el campo «Código de referido» al crear su acceso (el primer paso)— queda anotada como una recomendación tuya. Las dos formas valen igual.",
            },
            {
              lista: [
                "Cada recomendación avanza: **se registró**, **verificada**, **ya pagó** y, por último, **beneficio aplicado**.",
                "El beneficio es **un mes bonificado por cada institución recomendada**, cuando la recomendada abona su membresía. El equipo lo aplica y te avisa.",
                "Hay un tope de **un mes bonificado por semestre**: si ganás más, quedan guardados y se usan de a uno en los semestres siguientes.",
                "Un mes bonificado no se factura. Si pagás por débito automático, el cobro se hace igual y el equipo te devuelve ese mes. En «Plan» ves tus meses disponibles y usados.",
              ],
            },
            { nota: "No cuenta recomendarte a vos misma, a otra institución de la misma persona ni a una con el mismo CUIT." },
          ],
        },
        {
          slug: "tu-cuenta",
          titulo: "Mi cuenta: contraseña, avisos y baja",
          resumen: "Cambiar la contraseña, elegir los mails que recibís y pedir la baja de la institución.",
          bloques: [
            { p: "Todo está en [Mi cuenta](/institucion/cuenta), abajo en el menú." },
            {
              lista: [
                "**Contraseña:** podés cambiarla cuando quieras; se cierran tus otras sesiones.",
                "**Avisos por mail:** podés apagar el mail que avisa de postulantes nuevos en tus búsquedas. Los de facturación y de tu cuenta se envían siempre, y la campanita sigue avisando (las respuestas a tus entrevistas llegan solo por la campanita).",
                "**Email de acceso:** no se cambia desde la app; escribinos por [Contacto](/contacto).",
                "**Darse de baja:** el pedido lo procesa el equipo. Se borran tu equipo, tus búsquedas con sus postulantes, tus cursos y tus datos, pero **se conservan los datos fiscales y las facturas** (nombre, CUIT, condición fiscal, domicilio). Una cuenta dada de baja no se reactiva: si volvés, se crea una nueva.",
              ],
            },
            { p: "Más sobre qué datos guardamos en la [política de privacidad](/privacidad)." },
          ],
        },
      ],
    },
  ],
  preguntas: [
    {
      pregunta: "¿UNIDOAR cobra una comisión por contratar?",
      respuesta: [{ p: "No. UNIDOAR no cobra comisión por contratación: pagás tu plan (o una búsqueda puntual) y contratás a quien quieras. Más en [Planes](/planes)." }],
    },
    {
      pregunta: "¿Cuál es la diferencia entre una búsqueda planificada y una urgente?",
      respuesta: [
        { p: "La **planificada** es para un cargo titular, una suplencia, una temporada o un freelance. La **urgente** es una suplencia que necesitás cubrir ya: vence en el plazo que elegís (24 horas si no lo cambiás) y les avisa a los profesionales que encajan por campanita y por mail. Ver [Publicar una búsqueda](/ayuda/instituciones/publicar-una-busqueda)." },
      ],
    },
    {
      pregunta: "¿Cómo sé que los profesionales están verificados?",
      respuesta: [
        { p: "Los perfiles que revisó el equipo muestran el sello de **verificado**. El equipo controla la identidad con el DNI y la documentación. Si una persona es estudiante, la insignia lo aclara junto con el porcentaje de materias aprobadas." },
      ],
    },
    {
      pregunta: "¿Por qué no veo el teléfono ni el email de un profesional?",
      respuesta: [
        { p: "Solo se muestran de quienes se **postularon** a una de tus búsquedas o te **enviaron su CV**. Si solo los invitaste, se habilitan cuando aceptan la invitación. Ver [Tablero de postulantes](/ayuda/instituciones/tablero-de-postulantes)." },
      ],
    },
    {
      pregunta: "¿Puedo archivar a un postulante sin avisarle?",
      respuesta: [{ p: "Sí. Archivar es silencioso: no le llega ningún aviso. Si cerrás la búsqueda, todas las personas que estaban en ella reciben un aviso de cierre." }],
    },
    {
      pregunta: "¿Cómo invito a otra persona de mi institución?",
      respuesta: [{ p: "Desde [Equipo](/institucion/equipo), si sos dueña o administradora. Ver [Tu equipo](/ayuda/instituciones/tu-equipo)." }],
    },
    {
      pregunta: "Tenemos más de una sede, ¿cómo publico en cada una?",
      respuesta: [
        { p: "Al publicar elegís en qué sede es la búsqueda, o marcás varias y se crea una igual por sede. Las sedes se cargan en [Sedes](/institucion/sedes) y cada sede adicional suma al precio con un descuento." },
      ],
    },
    {
      pregunta: "¿Qué pasa si no pago una factura a tiempo?",
      respuesta: [
        { p: "Tenés 15 días de gracia. Pasados, no podés publicar ni reabrir búsquedas, publicar cursos ni invitar profesionales hasta pagar; lo demás sigue funcionando. Ver [Plan y facturación](/ayuda/instituciones/plan-y-facturacion)." },
      ],
    },
    {
      pregunta: "¿Por qué no me deja publicar una búsqueda ni invitar a un profesional?",
      respuesta: [
        {
          lista: [
            "**Tu plan todavía no está activo:** una cuenta nueva con abono se habilita cuando el equipo registra su primer pago. Escribinos por [Contacto](/contacto) y coordinamos.",
            "**Tenés una factura vencida hace más de 15 días:** al registrarse el pago se levanta sola. Mirá [Plan](/institucion/plan).",
            "**Estás en «Una sola búsqueda»:** necesitás una búsqueda pagada y disponible. Ver [Una sola búsqueda](/ayuda/instituciones/una-sola-busqueda).",
          ],
        },
      ],
    },
    {
      pregunta: "¿Cómo pago?",
      respuesta: [
        { p: "Cada mes se genera tu factura. Los pagos por transferencia o en efectivo los registra el equipo cuando los recibe, y si tu cuenta tiene habilitado el débito automático con Mercado Pago, lo activás en [Plan](/institucion/plan). Si necesitás ayuda con un pago, escribinos por [Contacto](/contacto)." },
      ],
    },
    {
      pregunta: "¿Qué es una institución fundadora?",
      respuesta: [
        { p: "Son las primeras instituciones que se suman a UNIDOAR (hoy, las primeras 50). Se identifican con una insignia de **Fundadora** en el catálogo y en su perfil, y aparecen en la portada del sitio." },
      ],
    },
    {
      pregunta: "¿Puedo cambiar el nombre o el tipo de mi institución?",
      respuesta: [
        { p: "Mientras no esté verificada, sí, desde Mi perfil. Una vez verificada, el nombre y el tipo los cambia el equipo: escribinos por [Contacto](/contacto)." },
      ],
    },
    {
      pregunta: "¿Cómo doy de baja la institución?",
      respuesta: [
        { p: "Desde [Mi cuenta](/institucion/cuenta) pedís la baja y el equipo la procesa. Se borran tus datos y tus búsquedas, pero se conservan los datos fiscales y las facturas. Ver [Mi cuenta](/ayuda/instituciones/tu-cuenta)." },
      ],
    },
  ],
};
