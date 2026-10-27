import type { ManualDeAyuda } from "./tipos";

/*
 * Manual para profesionales (docentes, entrenadores y guardavidas). Se escribe con los nombres que ve la persona en pantalla (menús, botones,
 * estados). Si cambia una pantalla, se corrige acá. Solo describe lo que la app hace hoy: nada que esté por venir.
 */
export const MANUAL_PROFESIONALES: ManualDeAyuda = {
  perfil: "profesionales",
  nombre: "Profesionales",
  titulo: "Manual para profesionales",
  bajada:
    "Para docentes, entrenadores y guardavidas: cómo armar tu perfil, hacerlo verificar y encontrar trabajo cerca tuyo. Usar UNIDOAR es gratis y no tiene comisiones.",
  capitulos: [
    {
      id: "empezar",
      titulo: "Empezar",
      articulos: [
        {
          slug: "crear-tu-cuenta",
          titulo: "Crear tu cuenta y completar el alta",
          resumen: "Los seis pasos del alta, de la cuenta a la documentación.",
          bloques: [
            { p: "Podés crear la cuenta con tu email y una contraseña, o con Google. Es gratis y UNIDOAR no cobra comisión por conseguir trabajo." },
            {
              pasos: [
                "**Tu cuenta**: en [Crear cuenta](/registro) elegí **Soy profesional**, escribí tu nombre, apellido, email y una contraseña, y aceptá los [términos y condiciones](/terminos). Con Google solo elegís tu cuenta de Google. Con el email, te mandamos un mail para confirmar la cuenta: abrilo y tocá el botón (si no llega, revisá la carpeta de spam).",
                "**Qué sos**: elegí si sos docente, entrenador/a o guardavidas, las asignaturas o disciplinas que das y si ya te recibiste o todavía estás estudiando.",
                "**Tu perfil**: fecha de nacimiento, DNI, teléfono o WhatsApp, domicilio y las zonas donde podés trabajar.",
                "**Tu CV**: subilo una sola vez; queda guardado para que te postules en dos toques.",
                "**Niveles y horarios**: con qué niveles trabajás y en qué días y franjas podés.",
                "**Documentación**: las fotos de tu DNI (frente y dorso) y tu título o, si todavía estudiás, la constancia de alumno regular. El certificado de buena conducta es optativo y lo cargás después, desde [Mi perfil](/docente/perfil).",
              ],
            },
            { nota: "Podés usar **Guardar y salir** en cualquier paso y seguir después: al ingresar te llevamos al paso donde quedaste." },
            { p: "Si ya tenés cuenta, ingresá desde [Ingresar](/ingresar). Si te olvidaste la contraseña, ahí mismo podés recuperarla." },
          ],
        },
        {
          slug: "verificar-tu-perfil",
          titulo: "Que verifiquemos tu perfil",
          resumen: "Qué revisa el equipo, qué significa cada estado y qué hacer si te piden una corrección.",
          bloques: [
            {
              p: "El equipo de UNIDOAR revisa tu identidad y tu documentación a mano. Un perfil verificado muestra el sello de **Perfil verificado** y es el que se ofrece para las suplencias de último momento. Mientras se revisa podés completar tu perfil y buscar trabajo.",
            },
            { p: "En [Mi perfil](/docente/perfil) ves en qué estado está:" },
            {
              lista: [
                "**Perfil sin verificar**: todavía no lo revisamos, o falta algo para poder hacerlo.",
                "**Perfil verificado**: ya lo revisamos y está todo bien.",
                "**Corregí tu documentación**: encontramos algo para corregir (una foto que no se lee, un dato que no coincide). Te contamos qué en el mismo perfil y por mail; subí lo que falta y vuelve a la revisión.",
                "**Verificación rechazada**: no pudimos verificarte. El motivo figura en tu perfil. Escribinos por [Contacto](/contacto) y vemos cómo seguir.",
              ],
            },
            {
              p: "**Qué te pedimos:** el frente y el dorso del DNI; el título (o, si todavía estudiás, la constancia de alumno regular y el porcentaje de materias aprobadas); y, si querés, el certificado de buena conducta (es optativo y se carga desde Mi perfil).",
            },
            {
              nota: "**Tus fotos del DNI no quedan guardadas:** las eliminamos dentro de las 24 horas de que verificamos tu perfil. El plazo empieza a correr con la verificación, no cuando las subís: hasta entonces las conservamos para poder revisarlas. Solo conservamos el número de DNI como constancia. El título, el certificado de buena conducta y la constancia de alumno regular sí quedan guardados, y solo los ve el equipo.",
            },
            {
              p: "Una vez verificado, tu nombre y apellido quedan fijos (para cambiarlos escribinos por [Contacto](/contacto)). Si te recibís después de verificarte, subí tu título desde Mi perfil y el equipo lo valida.",
            },
          ],
        },
        {
          slug: "completar-tu-perfil",
          titulo: "Completar y mantener tu perfil",
          resumen: "Qué datos conviene tener al día y cómo se usan para mostrarte búsquedas.",
          bloques: [
            {
              p: "Todo lo que cargaste en el alta se edita desde [Mi perfil](/docente/perfil): datos personales, asignaturas o disciplinas, niveles, horarios, zonas, CV y documentación.",
            },
            {
              lista: [
                "**Asignaturas o disciplinas:** sumá todas las que dés. Cuantas más cargues, en más búsquedas aparecés.",
                "**Zonas y radio:** las zonas donde trabajás definen qué búsquedas ves y a cuántos kilómetros están. Podés elegir hasta qué distancia querés ver ofertas, o ver toda la zona.",
                "**Niveles y horarios:** se usan para ordenarte entre los profesionales que una institución ve.",
                "**CV:** lo ve una institución solo si te postulaste a una de sus búsquedas o se lo enviaste vos.",
              ],
            },
            {
              p: "Tu teléfono y tu email **no son públicos**: una institución los ve solo si te postulaste a una de sus búsquedas o le mandaste tu CV. Si solo te invitó y no respondiste, no los ve.",
            },
            { nota: "Si cambiás el domicilio o las zonas, revisá también el radio: define qué tan lejos te muestran ofertas." },
          ],
        },
      ],
    },
    {
      id: "buscar-trabajo",
      titulo: "Buscar trabajo",
      articulos: [
        {
          slug: "buscar-trabajo",
          titulo: "Buscar trabajo: filtros, mapa y Buscá con IA",
          resumen: "Cómo encontrar búsquedas abiertas cerca tuyo y afinar lo que ves.",
          bloques: [
            { p: "En [Buscar trabajo](/docente/oportunidades) ves las búsquedas abiertas de las instituciones, con las urgentes primero. También podés mirarlas sin cuenta en [Búsquedas abiertas](/buscar-trabajo)." },
            {
              lista: [
                "**Buscador único:** escribí un nombre de institución o una materia, o contá qué buscás con tus palabras (por ejemplo «suplencia de inglés en primaria, de mañana»). Entendemos materias, niveles, turnos y tipo de búsqueda, y te mostramos qué entendimos. Si algo no se pudo aplicar, te lo decimos.",
                "**Filtros:** categoría, nivel, turno, tipo (titular, suplencia, temporada, freelance), instituciones verificadas y favoritas, y a cuántos kilómetros de tu zona.",
                "**Lista o mapa:** cambiás la vista con el selector. En el mapa cada pin es una búsqueda y se ve el radio que elegiste.",
                "**Favoritas:** tocá la estrella de una búsqueda para guardarla y verla después con el filtro **Favoritos**.",
                "**Compartir una búsqueda:** en el detalle de una oferta abierta, el botón **Compartir** te deja copiar el enlace o mandarlo por WhatsApp, redes o mail a quien pueda postularse. Quien lo abre ve la búsqueda sin necesidad de tener cuenta.",
              ],
            },
            { nota: "Los filtros quedan en la dirección de la página: podés copiarla y compartir tu búsqueda tal cual la ves." },
          ],
        },
        {
          slug: "busquedas-urgentes",
          titulo: "Búsquedas urgentes (suplencias rápidas)",
          resumen: "Qué son, cómo te avisamos y por qué conviene responder rápido.",
          bloques: [
            {
              p: "Una **búsqueda urgente** es una suplencia o un reemplazo que una institución necesita cubrir ya. Vence en el plazo que elige la institución al publicarla (24 horas si no lo cambia), así que quien responde primero y encaja tiene más chances. Cada búsqueda muestra cuánto falta.",
            },
            {
              lista: [
                "Las ves primero en [Buscar trabajo](/docente/oportunidades), con una franja naranja.",
                "Para mirar solo esas, activá **Solo búsquedas urgentes** en los filtros.",
                "Si tu perfil encaja, te avisamos en la campanita y por mail (podés apagar los mails en [Mi cuenta](/docente/cuenta)).",
                "Postularte funciona igual que en cualquier otra búsqueda. Ver la guía de abajo.",
              ],
            },
            { nota: "El aviso les llega a los perfiles que encajan con lo que pide la institución (categoría, disciplina, nivel y zona). Por defecto se avisa a perfiles **verificados**: tener tu perfil verificado te hace aparecer en más urgencias." },
          ],
        },
        {
          slug: "postularte",
          titulo: "Postularte a una búsqueda",
          resumen: "Cómo postularte, qué ve la institución y cómo retirar tu postulación.",
          bloques: [
            {
              pasos: [
                "Abrí la búsqueda y leé el detalle: puesto, horarios, zona y requisitos.",
                "Tocá **Postularme**. Si querés, escribile un mensaje a la institución (es opcional).",
                "Listo: la institución recibe tu perfil y tu CV. Seguís el estado desde [Postulaciones](/docente/postulaciones).",
              ],
            },
            {
              p: "Al postularte, la institución puede ver tu teléfono, tu email y tu CV para contactarte. Solo ve lo que cargaste en tu perfil; no ve tus fotos del DNI.",
            },
            {
              p: "Si cambiaste de idea, abrí la postulación en [Postulaciones](/docente/postulaciones) y tocá **Retirar postulación**: avisamos a la institución y se borran tus notas de esa búsqueda. Una postulación en la que ya te contrataron no se puede retirar.",
            },
            { nota: "No podés postularte con la verificación rechazada, ni a una búsqueda que ya se cerró." },
          ],
        },
        {
          slug: "invitaciones",
          titulo: "Cuando una institución te invita",
          resumen: "Qué es una invitación y cómo aceptarla.",
          bloques: [
            { p: "Una institución puede invitarte a postularte a una búsqueda suya. Te llega un aviso en la campanita y por mail." },
            {
              p: "Una invitación **no le da tu contacto a la institución**: para que lo vea tenés que aceptarla. Abrí la búsqueda (o la postulación en [Postulaciones](/docente/postulaciones)) y tocá **Aceptar la invitación y postularme**. La institución queda avisada y, desde ese momento, ve tu teléfono, tu email y tu CV.",
            },
            { p: "Si no te interesa, simplemente no respondas: no pasa nada y no se comparte ningún dato." },
          ],
        },
        {
          slug: "instituciones",
          titulo: "Instituciones: conocerlas y enviar tu CV",
          resumen: "Cómo mirar el perfil de una institución y mandarle tu CV sin esperar una búsqueda.",
          bloques: [
            {
              p: "En [Instituciones](/docente/instituciones) está el catálogo de colegios, clubes, institutos y gimnasios. Cada una tiene su perfil: sedes, descripción, fotos y las búsquedas que tiene abiertas. Podés filtrar por tipo y zona, verlas en el mapa y guardar tus favoritas con la estrella.",
            },
            {
              p: "Si te interesa una institución aunque hoy no busque a nadie, tocá **Enviar mi CV** en su perfil. Se envía **una vez por institución**, y al enviarlo le habilitás ver tu teléfono y tu email.",
            },
          ],
        },
      ],
    },
    {
      id: "despues-de-postularte",
      titulo: "Después de postularte",
      articulos: [
        {
          slug: "seguir-tus-postulaciones",
          titulo: "Seguir tus postulaciones",
          resumen: "Qué significa cada estado de una postulación.",
          bloques: [
            {
              p: "En [Postulaciones](/docente/postulaciones) están todas tus búsquedas, separadas en activas y cerradas. Cada una muestra un estado que cambia cuando la institución mueve tu postulación:",
            },
            {
              lista: [
                "**Postulación enviada:** la institución todavía no te movió de etapa.",
                "**Preseleccionada:** quedaste entre las personas que le interesan.",
                "**Entrevista agendada:** te propuso día y hora. Ver la guía de entrevistas.",
                "**Oferta recibida:** la institución te hizo una oferta.",
                "**Examen preocupacional pendiente / realizado:** si la institución pide el estudio médico para ingresar, te lo marca acá. Los resultados los maneja la institución: vos solo ves si está pendiente o realizado.",
                "**Contratada:** te contrataron.",
                "**Búsqueda cerrada:** la institución cubrió el puesto. Te avisamos en la campanita.",
              ],
            },
            {
              nota: "Si una institución archiva tu postulación no te avisamos en el momento: la ves como **Postulación enviada** hasta que la búsqueda se cierra. Que no te contesten enseguida no significa que te hayan descartado.",
            },
          ],
        },
        {
          slug: "entrevistas",
          titulo: "Entrevistas: responder y agendar",
          resumen: "Cómo confirmar la entrevista con «Voy» o «No puedo» y tener todo en tu agenda.",
          bloques: [
            {
              p: "Cuando la institución agenda una entrevista te llega un aviso por campanita y por mail, con el día y la hora. Abrí la postulación en [Postulaciones](/docente/postulaciones) para ver el detalle.",
            },
            {
              pasos: [
                "Tocá **Voy** para confirmar o **No puedo** si no podés. Con «No puedo» podés dejar un mensaje, por ejemplo proponiendo otro día.",
                "La institución recibe tu respuesta en su tablero y, si no podés, reprograma.",
                "Podés cambiar tu respuesta hasta que la entrevista pase.",
              ],
            },
            {
              p: "Los botones del mail **solo preseleccionan** tu respuesta: para enviarla hay que tocar el botón dentro de la app, con tu sesión abierta.",
            },
            { nota: "Si la institución cambia el día o la hora, tu respuesta anterior se borra y tenés que responder de nuevo." },
          ],
        },
      ],
    },
    {
      id: "mas-herramientas",
      titulo: "Más herramientas",
      articulos: [
        {
          slug: "cursos",
          titulo: "Cursos",
          resumen: "Cómo encontrar cursos de las instituciones e inscribirte.",
          bloques: [
            {
              p: "En [Cursos](/docente/cursos) están las capacitaciones que publican las instituciones. Podés buscar por texto, filtrar online o presencial y ver solo los que ya tenés anotados.",
            },
            {
              lista: [
                "Cada curso muestra **dónde se dicta**: «Online», o la dirección completa y a cuántos kilómetros queda de tu zona. Si una institución todavía no cargó la dirección, el curso lo avisa.",
                "Tocá **Inscribirme al curso** y listo. Los cursos en los que ya estás anotado se marcan con «Ya te inscribiste» y los podés ver todos juntos con el botón **Solo los que ya me inscribí**.",
                "Si el curso es online, la institución puede pasarte el enlace y la clave de la sala.",
              ],
            },
          ],
        },
        {
          slug: "compartir-tu-perfil",
          titulo: "Compartir tu perfil",
          resumen: "Cómo tener una página pública de tu perfil y apagarla cuando quieras.",
          bloques: [
            {
              p: "En [Mi perfil](/docente/perfil), la tarjeta **Compartir mi perfil** tiene un interruptor que viene **apagado**. Si lo prendés, tu perfil tiene una página con enlace propio que podés copiar, mandar por WhatsApp, compartir en otras redes o por mail (**Más opciones**) o ver.",
            },
            {
              lista: [
                "La página muestra tu nombre, foto, resumen, zonas, asignaturas, niveles, experiencia y formación, y el sello de verificado si lo tenés.",
                "**Nunca muestra** tu teléfono, email, CV, documentos ni domicilio.",
                "Los buscadores no la indexan y no contamos las visitas.",
                "Si apagás el interruptor, el enlace deja de funcionar para siempre. Si lo prendés de nuevo, se crea uno nuevo: es la forma de «renovar» un enlace que se difundió de más.",
              ],
            },
          ],
        },
        {
          slug: "tu-cuenta",
          titulo: "Tu cuenta: contraseña, avisos y baja",
          resumen: "Cambiar la contraseña, elegir qué mails recibís y pedir la baja.",
          bloques: [
            { p: "Todo está en [Mi cuenta](/docente/cuenta), abajo en el menú." },
            {
              lista: [
                "**Contraseña:** podés cambiarla cuando quieras. Al cambiarla se cierran tus otras sesiones abiertas.",
                "**Avisos por mail:** un interruptor apaga los mails de búsquedas, invitaciones, entrevistas y ofertas. Los mails de tu cuenta y de la verificación siempre se envían. La campanita sigue avisando.",
                "**Email de acceso:** no se cambia desde la app. Si lo necesitás, escribinos por [Contacto](/contacto).",
                "**Darse de baja:** con el botón **Darme de baja** podés pedir la baja desde ahí. El equipo la procesa y se borran tus datos de forma definitiva: perfil, postulaciones, CV y documentos.",
              ],
            },
            { p: "Para salir de tu sesión usá **Cerrar sesión** en el menú." },
            { p: "Más sobre qué hacemos con tus datos en la [política de privacidad](/privacidad)." },
          ],
        },
      ],
    },
  ],
  preguntas: [
    {
      pregunta: "¿Cuánto cuesta usar UNIDOAR siendo profesional?",
      respuesta: [{ p: "Nada. Armar tu perfil, postularte y todo lo demás es gratis, y UNIDOAR no cobra comisión por conseguir trabajo. Más en [Planes](/planes)." }],
    },
    {
      pregunta: "¿Para qué me piden el DNI y qué hacen con las fotos?",
      respuesta: [
        { p: "Para verificar que sos quien decís ser. Las **fotos del DNI se eliminan dentro de las 24 horas de que el equipo verifica tu perfil** (el plazo empieza con la verificación) y solo se conserva el número como constancia. Ver [Que verifiquemos tu perfil](/ayuda/profesionales/verificar-tu-perfil)." },
      ],
    },
    {
      pregunta: "Todavía estudio, ¿puedo registrarme?",
      respuesta: [
        { p: "Sí. En lugar del título subís la **constancia de alumno regular** y el porcentaje de materias aprobadas. Las instituciones ven que sos estudiante y cuánto avanzaste en la carrera. Cuando te recibís, subís tu título desde [Mi perfil](/docente/perfil)." },
      ],
    },
    {
      pregunta: "¿Cuánto tarda la verificación?",
      respuesta: [
        { p: "Depende de cuánta documentación haya para revisar. Mientras tanto podés usar la plataforma: buscar trabajo y postularte. Si falta algo, te avisamos en la campanita y por mail." },
      ],
    },
    {
      pregunta: "¿Quién ve mi teléfono, mi email y mi CV?",
      respuesta: [
        { p: "Solo una institución a la que te postulaste, a la que le enviaste tu CV o cuya invitación aceptaste. Una invitación sin responder no le da tu contacto a nadie. Ver [Cuando una institución te invita](/ayuda/profesionales/invitaciones)." },
      ],
    },
    {
      pregunta: "No veo búsquedas cerca mío, ¿qué hago?",
      respuesta: [
        {
          lista: [
            "Revisá en [Mi perfil](/docente/perfil) que tengas zonas y asignaturas cargadas.",
            "Ampliá el radio de distancia en los filtros o elegí ver toda la zona.",
            "Sacá filtros: por ejemplo el de nivel o turno achica mucho el resultado.",
            "Sumá más asignaturas: aparecés en más búsquedas.",
          ],
        },
      ],
    },
    {
      pregunta: "Me postulé y no me contestan, ¿me descartaron?",
      respuesta: [
        { p: "No necesariamente. Si una institución archiva tu postulación no te lo avisamos, y la ves como «Postulación enviada» hasta que la búsqueda se cierra. Ver [Seguir tus postulaciones](/ayuda/profesionales/seguir-tus-postulaciones)." },
      ],
    },
    {
      pregunta: "¿Puedo postularme a varias búsquedas a la vez?",
      respuesta: [{ p: "Sí, a todas las que quieras. Cada una se sigue por separado en [Postulaciones](/docente/postulaciones)." }],
    },
    {
      pregunta: "No me llegan los mails, ¿qué puedo hacer?",
      respuesta: [
        {
          lista: [
            "Revisá la carpeta de spam o promociones.",
            "Verificá en [Mi cuenta](/docente/cuenta) que los avisos por mail estén activados.",
            "Los avisos importantes siempre aparecen también en la campanita de la app.",
          ],
        },
      ],
    },
    {
      pregunta: "¿Cómo cambio mi email de acceso?",
      respuesta: [{ p: "No se cambia desde la app. Escribinos por [Contacto](/contacto) y lo resuelve el equipo." }],
    },
    {
      pregunta: "¿Cómo me doy de baja?",
      respuesta: [
        { p: "Desde [Mi cuenta](/docente/cuenta) podés pedir la baja. El equipo la procesa y se borran tus datos de forma definitiva. Ver [Tu cuenta](/ayuda/profesionales/tu-cuenta)." },
      ],
    },
  ],
};
