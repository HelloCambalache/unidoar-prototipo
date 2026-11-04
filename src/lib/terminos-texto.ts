/*
 * Texto de /terminos (Términos y Condiciones de Uso y Contratación de UNIDOAR, versión 2 del 4 de noviembre de 2026). Es el documento legal que
 * redactó la titular de UNIDOAR: se carga tal cual, palabra por palabra, con solo la forma de la página (secciones numeradas, listas con letras,
 * negritas y un enlace a /privacidad). NO se reescribe ni se corrige acá: un cambio se hace en el documento y se vuelve a cargar.
 * Cambiar una palabra de acá cambia lo que aceptan las personas: hay que subir `VERSION_TERMINOS`, `TERMINOS_ACTUALIZADOS` y
 * `TERMINOS_NUMERO_DE_VERSION` (src/lib/terminos.ts). Código puro (sin base ni Next) para poder probarlo.
 *
 * Marcas dentro de un texto: **negrita** y [texto](/ruta-interna).
 *
 * Lo que la página agrega al documento (y nada más): la fecha y el número de versión donde el documento tenía [FECHA] y [NÚMERO]; el enlace «aquí»
 * a /privacidad donde el documento dejaba un renglón en blanco; y no se dibuja el cuadro ☐ de las líneas de aceptación (en la página no se puede
 * tildar: la aceptación es la casilla del registro).
 */

/** Cómo se marca cada elemento de una lista: viñeta, letras (a., b., c.), guion o nada (líneas «Etiqueta: valor»). */
export type MarcadorDeLista = "letras" | "guion" | "ninguno";

export type BloqueTexto = { p: string } | { lista: string[]; marcador?: MarcadorDeLista };

export type SeccionLegal = {
  id: string;
  titulo: string;
  bloques: BloqueTexto[];
};

/** Título del documento, como lo escribió la titular. */
export const TITULO_TERMINOS = "TÉRMINOS Y CONDICIONES DE USO Y CONTRATACIÓN DE UNIDOAR";

/** Las 25 cláusulas y el cierre de aceptación, en el orden del documento. */
export const SECCIONES_TERMINOS: SeccionLegal[] = [
  {
    id: "identificacion-y-objeto",
    titulo: "1. Identificación y objeto.",
    bloques: [
      { p: "Los presentes Términos y Condiciones regulan el acceso y la utilización de UNIDOAR, plataforma tecnológica integrada por un sitio web, una aplicación móvil y un panel de gestión destinado a instituciones educativas." },
      { p: "La plataforma es operada por Nombre / Razón Social: Castagnone, Esteban Alejandro; CUIT: 20-18428153-9; Domicilio Legal: Triunvirato 4023, Villa Adelina, Vicente López, Provincia de Buenos Aires; Correo Electrónico (Soporte / Privacidad): unidoar@gmail.com; Sitio Web: unidoar.com.ar; Teléfono de Contacto: 11 54735876, en adelante, UNIDOAR." },
      { p: "Su finalidad es facilitar exclusivamente la intermediación y/o vinculación entre instituciones educativas y docentes para la publicación de convocatorias, la cobertura de suplencias, cargos y otras oportunidades profesionales, así como ofrecer funcionalidades complementarias de comunicación, evaluación, beneficios y acceso a recursos pedagógicos." },
      { p: "Los contenidos del Sitio, la aplicación móvil y el panel de gestión (en adelante subsumidos en el término el Sitio) son aquellos a los que el Usuario y/o institución educativa (en adelante subsumidos en el término Usuario) tiene acceso ingresando a través del Sitio ubicado en la siguiente dirección: unidoar.com.ar (a confirmar / validar). UNIDOAR no supervisa ni controla los contenidos a los cuales el Usuario pueda tener acceso a través de un link o enlace ubicado en el Sitio, por lo que bajo ningún concepto será responsable por cualquier daño y/o pérdida que el Usuario pueda sufrir como resultado de la utilización de tales contenidos. El uso de los mismos se regirá exclusivamente por los términos y condiciones incluidos en el sitio o página web donde se encuentren dichos contenidos." },
    ],
  },
  {
    id: "aceptacion-y-contratacion-electronica",
    titulo: "2. Aceptación y contratación electrónica.",
    bloques: [
      { p: "El registro y la utilización de las funcionalidades que requieren una cuenta estarán sujetos a la aceptación de estos Términos y Condiciones y la Política de Privacidad." },
      { p: "La aceptación se realizará mediante una acción afirmativa, como seleccionar la casilla correspondiente y pulsar el botón de aceptación. El usuario deberá tener acceso al texto completo antes de aceptarlo." },
      { p: "UNIDOAR podrá conservar constancias electrónicas de la aceptación, incluyendo la identidad de la cuenta, la fecha, la hora y la versión del documento aceptado." },
      { p: "La aceptación electrónica producirá los efectos jurídicos que correspondan conforme a la legislación vigente." },
      { p: "Cuando corresponda, las condiciones particulares, las autorizaciones específicas y la Política de Privacidad se presentarán de forma diferenciada." },
      { p: "**Si el usuario no acepta estos Términos y Condiciones ni la Política der Privacidad, deberá abstenerse de utilizar las funcionalidades sujetas a ellos**." },
    ],
  },
  {
    id: "definiciones",
    titulo: "3. Definiciones.",
    bloques: [
      { p: "A los efectos de estos Términos:" },
      {
        lista: [
          "Plataforma: el sitio web, la aplicación móvil, el panel de gestión y los sistemas asociados a UNIDOAR.",
          "Docente: la persona que utiliza la Plataforma para publicar su perfil profesional y postularse a convocatorias.",
          "Institución Educativa: el colegio, jardín, instituto u otra entidad educativa que utiliza la Plataforma para publicar búsquedas y contactar docentes.",
          "Usuario: toda persona que accede a la Plataforma, incluidos docentes, representantes institucionales y usuarios autorizados.",
          "Convocatoria: publicación destinada a cubrir una suplencia, cargo, función o prestación profesional.",
          "Contenido: textos, imágenes, documentos, materiales pedagógicos, calificaciones y demás información incorporada a la Plataforma.",
        ],
        marcador: "guion",
      },
    ],
  },
  {
    id: "naturaleza-y-alcance-del-servicio",
    titulo: "4. Naturaleza y alcance del servicio.",
    bloques: [
      { p: "UNIDOAR es una plataforma tecnológica destinada a facilitar por su sola intermediación, el contacto entre instituciones educativas y docentes, en forma exclusiva y excluyente." },
      { p: "**UNIDOAR NO es parte de las relaciones laborales, profesionales o contractuales que eventualmente se establezcan entre los usuarios. No asumiendo responsabilidad alguna al respecto.**" },
      { p: "La Plataforma no garantiza que una convocatoria se traduzca en una contratación, que un docente resulte seleccionado ni que una institución encuentre un candidato determinado." },
      { p: "La publicación de un perfil, una convocatoria o una calificación tampoco constituye, por sí sola, una certificación de antecedentes, identidad, títulos, habilitaciones o idoneidad profesional." },
    ],
  },
  {
    id: "registro-y-cuentas-de-usuario",
    titulo: "5. Registro y cuentas de usuario.",
    bloques: [
      { p: "Para acceder a determinadas funcionalidades, el usuario deberá registrarse y proporcionar información exacta, completa y actualizada." },
      { p: "Cada usuario será responsable de la veracidad de los datos que suministre, de mantener la confidencialidad de sus credenciales y de comunicar cualquier acceso no autorizado del que tome conocimiento." },
      { p: "UNIDOAR podrá solicitar verificaciones de identidad o representación cuando sean necesarias para prevenir fraudes, proteger la seguridad del sistema o verificar la legitimidad de una cuenta, dentro de sus posibilidades." },
      { p: "La cuenta es personal para el usuario registrado y no podrá transferirse a terceros sin autorización." },
    ],
  },
  {
    id: "registro-de-instituciones-educativas",
    titulo: "6. Registro de instituciones educativas.",
    bloques: [
      { p: "La persona que registre una institución educativa deberá declarar que cuenta con facultades suficientes para actuar en su nombre y contratar los servicios ofrecidos por UNIDOAR." },
      { p: "La institución será responsable de acreditar su identidad y la representación invocada cuando le sea requerido." },
      { p: "La utilización de una cuenta institucional no exime a la institución ni a sus representantes de las obligaciones legales correspondientes." },
      { p: "La institución deberá mantener actualizados sus datos, identificar a las personas autorizadas a utilizar el panel y comunicar inmediatamente por los canales habilitados los cambios de representación o de permisos de acceso." },
    ],
  },
  {
    id: "obligaciones-de-los-docentes",
    titulo: "7. Obligaciones de los docentes.",
    bloques: [
      { p: "El docente se compromete a:" },
      {
        lista: [
          "Proporcionar información veraz sobre su identidad, formación, títulos, matrículas y experiencia.",
          "Mantener actualizados sus datos y documentación profesional.",
          "No utilizar documentación falsa, adulterada o perteneciente a terceros sin autorización.",
          "Utilizar la Plataforma de manera lícita y respetuosa.",
          "Respetar la confidencialidad de la información de las instituciones y de otros usuarios.",
          "No utilizar los datos obtenidos a través de UNIDOAR para fines ajenos a las convocatorias.",
          "Comunicar las inexactitudes relevantes de su perfil y solicitar las correcciones que correspondan.",
        ],
        marcador: "letras",
      },
      { p: "El docente será responsable de la información que proporcione." },
    ],
  },
  {
    id: "obligaciones-de-las-instituciones-educativas",
    titulo: "8. Obligaciones de las instituciones educativas.",
    bloques: [
      { p: "Las instituciones educativas se comprometen a:" },
      {
        lista: [
          "Publicar convocatorias auténticas y describir de manera clara las funciones, requisitos y condiciones relevantes.",
          "Utilizar la información de los docentes únicamente para finalidades legítimas relacionadas con los procesos de selección y contratación.",
          "Respetar la normativa laboral, contractual, educativa y de protección de datos personales.",
          "Verificar, antes de la contratación o del ingreso al establecimiento, la identidad y las habilitaciones que correspondan.",
          "Comprobar la autenticidad y vigencia de la documentación.",
          "Cumplir las obligaciones laborales, contractuales, previsionales, impositivas, de seguridad social, de riesgos del trabajo y de seguros, entre otras, que correspondan a la relación efectivamente establecida, siendo su exclusiva responsabilidad cumplir con ello.",
          "No utilizar los datos de contacto de los docentes para comunicaciones comerciales ajenas a la finalidad informada.",
        ],
        marcador: "letras",
      },
      { p: "**La institución será exclusiva y excluyentemente responsable de sus decisiones de selección, de las condiciones de contratación, desarrollo y conclusión de las relaciones con los postulantes y/o contratantes, y de las verificaciones que legalmente le correspondan**." },
    ],
  },
  {
    id: "convocatorias-y-seleccion",
    titulo: "9. Convocatorias y selección.",
    bloques: [
      { p: "Las instituciones educativas serán responsables por el contenido, la exactitud y la legitimidad de las convocatorias que publiquen." },
      { p: "UNIDOAR podrá moderar, restringir o retirar publicaciones que infrinjan estos Términos, vulneren derechos de terceros o presenten indicios razonables de fraude o ilegalidad, sin que ello implique asunción de responsabilidad a su cargo." },
      { p: "La postulación de un docente no genera derecho a ser seleccionado ni obligación de contratar para la institución educativa." },
      { p: "**Las condiciones definitivas de la relación entre el docente y la institución deberán acordarse directamente entre quienes la celebren y formalizarse cuando corresponda, deslindando a UNIDOAR de todo tipo de responsabilidad.**" },
    ],
  },
  {
    id: "verificacion-de-identidad-y-documentacion",
    titulo: "10. Verificación de identidad y documentación.",
    bloques: [
      { p: "UNIDOAR podrá ofrecer herramientas de revisión formal o tecnológica de la documentación aportada por los usuarios, dentro del alcance informado para cada funcionalidad. Sin que ello genere responsabilidad a su cargo." },
      { p: "Una revisión no equivale necesariamente a una certificación oficial de autenticidad, vigencia, habilitación o identidad física." },
      { p: "La institución educativa deberá efectuar las comprobaciones que legalmente le correspondan antes de permitir el ingreso del docente al establecimiento o celebrar una contratación. Siendo ello su exclusiva responsabilidad." },
      { p: "El tratamiento y almacenamiento de certificados de antecedentes penales es exclusiva y excluyente responsabilidad de la entidad educativa. UNIDOAR no recopila ni conserva tales certificados." },
    ],
  },
  {
    id: "sistema-de-calificaciones-y-reputacion",
    titulo: "11. Sistema de calificaciones y reputación.",
    bloques: [
      { p: "UNIDOAR podrá ofrecer un sistema de evaluación relacionado con las prestaciones realizadas a través de la Plataforma." },
      { p: "Las calificaciones deberán guardar relación con experiencias reales y ser expresadas de manera respetuosa." },
      { p: "No podrán utilizarse para difundir información falsa, insultante, intimidatoria o manifiestamente ajena a la prestación evaluada." },
      { p: "El docente podrá solicitar la revisión de una calificación cuando considere que contiene información inexacta, o vulnera estos Términos." },
      { p: "UNIDOAR establecerá un mecanismo para recibir y analizar esas solicitudes, pudiendo requerir información adicional, corregir datos inexactos o retirar contenidos que infrinjan las reglas aplicables." },
      { p: "La evaluación no constituye una certificación oficial de idoneidad profesional." },
      { p: "La publicación de calificaciones y la utilización de información identificable estarán sujetas, además, a la Política de Privacidad." },
    ],
  },
  {
    id: "club-unidoar-y-beneficios-de-terceros",
    titulo: "12. Club UNIDOAR y beneficios de terceros.",
    bloques: [
      { p: "UNIDOAR podrá ofrecer un programa de beneficios denominado Club UNIDOAR, que permita acceder a descuentos, promociones u otras ventajas ofrecidas por comercios o prestadores adheridos." },
      { p: "Cada comercio será exclusivo y excluyente responsable de sus ofertas, disponibilidad, calidad, condiciones de acceso, garantías y cumplimiento." },
      { p: "El Usuario podrá conocer el precio y las modalidades de contratación de cada producto y/o servicio en el momento en el que proceda a su adquisición, las que serán especificadas en forma clara en el Sitio. Si bien UNIDOAR puede optar por modificar en cualquier momento el precio o las modalidades de contratación, regirán para el Usuario el precio y las modalidades de contratación vigentes al momento en que éste brindó su consentimiento al contratar." },
      { p: "**En relación con los productos y/o servicios que terceros puedan ofrecer en el Sitio, UNIDOAR declara que no controla, supervisa ni asume responsabilidad alguna por la veracidad, calidad, seguridad o características de tales productos y/o servicios.**" },
      { p: "El Usuario que desee contratar algún producto y/o servicio pago ofrecido por UNIDOAR deberá pagar la tarifa correspondiente, indicada en el Sitio en el momento de la contratación. A tal fin, el Usuario deberá utilizar el medio de pago indicado. En este sentido, el Usuario reconoce y acepta que UNIDOAR se reserva el derecho de no brindar o entregar el producto y/o servicio contratado que no haya sido efectivamente cobrado por UNIDOAR, debido a la falta de pago por parte de cualquier empresa prestataria del medio de pago correspondiente." },
      { p: "Si el Usuario tuviese alguna duda referida al medio de pago elegido, la acreditación de la suma debida a UNIDOAR, o acerca de la utilización indebida de sus datos por parte de un tercero, podrá ponerse en contacto con Castagnone, Esteban Alejandro, cuyo número de teléfono es (Pendiente de confirmación), o enviar un e-mail a la siguiente dirección unidoar@gmail.com." },
      { p: "Las restricciones, vigencia y condiciones de cada beneficio deberán consultarse antes de utilizarlo." },
      { p: "**UNIDOAR puede a su vez facilitar enlaces desde el Sitio a otros sitios o páginas web. En ningún caso UNIDOAR supervisa o controla los productos, servicios o contenidos que tales sitios web o páginas web pueden ofrecer, por lo que no asume responsabilidad alguna por los eventuales daños que el Usuario pudiera sufrir como consecuencia del acceso, uso de contenidos o contratación de productos y/o servicios a través de tales sitios o páginas web**." },
      { p: "UNIDOAR podrá modificar o discontinuar beneficios, informándolo." },
    ],
  },
  {
    id: "biblioteca-de-recursos-y-contenidos-de-usuarios",
    titulo: "13. Biblioteca de recursos y contenidos de usuarios.",
    bloques: [
      { p: "La Plataforma podrá ofrecer espacios para compartir recursos y materiales pedagógicos." },
      { p: "El Sitio puede contener material, contenidos o información de propiedad intelectual de UNIDOAR o de terceros, por lo que el Usuario no podrá vender, alquilar, publicar, distribuir, emitir, retransmitir, facilitar a terceros, grabar o copiar (siendo esta enumeración meramente ejemplificativa) ningún material, contenido o información incluida en el Sitio sin la autorización previa y expresa de UNIDOAR o de la persona titular de dicho material, contenido o información, según sea el caso." },
      { p: "El Usuario acepta a su vez que UNIDOAR no supervisa ni asume responsabilidad alguna por la inclusión en el Sitio de materiales o contenidos que infrinjan derechos de terceros, incluidos sin limitación, derechos de propiedad industrial y/o intelectual." },
      { p: "Asimismo, el Usuario debe tener en cuenta que la información provista a través del Sitio, no debe interpretarse como asesoramiento, recomendación o sugerencia para realizar cualquier tipo de actividad, operación, contratación, etc., quedando UNIDOAR exento de todo tipo de responsabilidad por las decisiones que pudiera tomar el Usuario al respecto. UNIDOAR tampoco será responsable por la interpretación del material, contenido o información incluida en el Sitio, por los daños y/o perjuicios que el Usuario pueda llegar a sufrir como consecuencia de haber consultado las páginas de este Sitio, o por errores, omisiones, o inexactitud de la información contenida en el mismo." },
      { p: "El usuario que publique contenido declara que posee los derechos o autorizaciones necesarios para hacerlo y que su publicación no infringe derechos de autor, imagen, privacidad ni otros derechos de terceros, siendo exclusivo responsable por las eventuales infracciones en que pudiere incurrir." },
      { p: "El usuario conservará los derechos que le correspondan sobre sus materiales. Al cargarlos, concede a UNIDOAR la autorización, limitada a las operaciones necesarias para alojarlos, reproducirlos técnicamente y ponerlos a disposición conforme a las funcionalidades seleccionadas y las condiciones informadas." },
      { p: "No se entenderá otorgada una licencia general de explotación comercial ni una cesión de titularidad, salvo acuerdo expreso." },
      { p: "UNIDOAR podrá unilateralmente restringir o retirar contenidos ante casos de infracción, reclamos fundados o incumplimientos de estos Términos, sin que esto provoque responsabilidad a su respecto." },
    ],
  },
  {
    id: "propiedad-intelectual-de-unidoar",
    titulo: "14. Propiedad intelectual de UNIDOAR.",
    bloques: [
      { p: "Los derechos sobre la Plataforma, su software, diseño, estructura, bases de datos, logotipos, marcas, nombres comerciales, interfaces y contenidos propios pertenecen a UNIDOAR y/o a sus respectivos titulares." },
      { p: "El usuario no adquiere derechos de propiedad sobre esos elementos por el solo hecho de utilizar el Servicio." },
      { p: "Queda prohibida la reproducción, distribución, modificación, comunicación pública o explotación comercial no autorizada de dichos elementos, salvo consentimiento del titular o autorización legal." },
      { p: "Los derechos sobre obras de terceros seguirán perteneciendo a sus respectivos titulares." },
    ],
  },
  {
    id: "servicios-gratuitos-y-pagos",
    titulo: "15. Servicios gratuitos y pagos.",
    bloques: [
      { p: "UNIDOAR podrá ofrecer funcionalidades gratuitas y servicios pagos para instituciones educativas u otros usuarios." },
      { p: "Antes de contratar un servicio pago, se informarán claramente el precio, la moneda, los impuestos aplicables, la periodicidad, las prestaciones incluidas, la duración, las condiciones de renovación y los medios de cancelación." },
      { p: "Las condiciones particulares de suscripción o contratación podrán instrumentarse mediante una propuesta comercial o contrato complementario, que formará parte de la relación contractual una vez aceptado." },
      { p: "Los cambios de precio se comunicarán con antelación razonable." },
      { p: "La falta de pago podrá dar lugar a intimación, suspensión o cancelación del servicio pago, según las condiciones previamente informadas, más el reclamo a su cobro extrajudicial o judicial." },
      { p: "Las cancelaciones, devoluciones, retractaciones y demás derechos de los usuarios se regirán por las condiciones contratadas y por la normativa aplicable." },
    ],
  },
  {
    id: "disponibilidad-y-mantenimiento",
    titulo: "16. Disponibilidad y mantenimiento.",
    bloques: [
      { p: "UNIDOAR procurará mantener la Plataforma operativa y segura, pero pueden producirse interrupciones por mantenimiento, actualizaciones, fallas técnicas, conectividad, servicios de terceros o circunstancias fuera de su control razonable." },
      { p: "Cuando sea posible, se informarán las interrupciones programadas que afecten sustancialmente el Servicio." },
      { p: "UNIDOAR no garantiza que la Plataforma esté disponible sin interrupciones ni que resulte compatible con todos los dispositivos o sistemas, sin que sea responsable por ello." },
    ],
  },
  {
    id: "responsabilidad",
    titulo: "17. Responsabilidad.",
    bloques: [
      { p: "Cada usuario será responsable por sus actos, declaraciones, publicaciones, documentación y obligaciones legales." },
      { p: "UNIDOAR no garantiza la conducta, solvencia, idoneidad ni cumplimiento contractual de otros usuarios, ni responde por las relaciones que éstos establezcan." },
      { p: "Sin embargo, ninguna cláusula de estos Términos podrá interpretarse como una exclusión de responsabilidad prohibida por normas imperativas." },
    ],
  },
  {
    id: "reclamos-e-indemnidad",
    titulo: "18. Reclamos e indemnidad.",
    bloques: [
      { p: "El usuario deberá responder por los daños causados a y/o reclamos de UNIDOAR y/o terceros, que deriven de los propios incumplimientos del usuario, actos ilícitos o contenidos infractores." },
    ],
  },
  {
    id: "suspension-y-cancelacion-de-cuentas",
    titulo: "19. Suspensión y cancelación de cuentas.",
    bloques: [
      { p: "UNIDOAR podrá suspender o cancelar, sin generación de responsabilidad, cuentas cuando existan motivos razonables relacionados con fraude, suplantación de identidad, incumplimientos graves, riesgos de seguridad, uso ilícito o requerimientos de autoridad competente. La enumeración es meramente ejemplificativa." },
      { p: "El usuario podrá solicitar la baja de su cuenta por los medios habilitados. La baja no extinguirá obligaciones pendientes ni impedirá la conservación de información cuando exista una obligación legal o una causa legítima que lo justifique." },
      { p: "Los reclamos relativos al funcionamiento de la Plataforma podrán dirigirse a unidoar@gmail.com, indicando la cuenta, la situación y la información necesaria para su evaluación." },
      { p: "La conservación y supresión de datos se regirán por la Política de Privacidad." },
    ],
  },
  {
    id: "modificaciones-de-los-terminos",
    titulo: "20. Modificaciones de los Términos.",
    bloques: [
      { p: "UNIDOAR podrá actualizar unilateralmente estos Términos por cambios normativos, tecnológicos o comerciales, o por modificaciones del Servicio." },
      { p: "La versión vigente estará disponible en el sitio web y en la Plataforma, con indicación de su fecha de actualización." },
      { p: "Cuando corresponda una nueva aceptación, ésta se solicitará antes de aplicar las nuevas condiciones a las funcionalidades afectadas." },
    ],
  },
  {
    id: "comunicaciones",
    titulo: "21. Comunicaciones.",
    bloques: [
      { p: "Las comunicaciones operativas relativas a la cuenta, la seguridad, las postulaciones, las convocatorias y el funcionamiento del Servicio podrán enviarse por los medios de contacto registrados." },
      { p: "Las comunicaciones promocionales estarán sujetas a las opciones de consentimiento, oposición y baja que correspondan." },
      { p: "El usuario deberá mantener actualizados sus datos de contacto y revisar las notificaciones relevantes de su cuenta." },
    ],
  },
  {
    id: "legislacion-aplicable-y-jurisdiccion",
    titulo: "22. Legislación aplicable y jurisdicción.",
    bloques: [
      { p: "Estos Términos se rigen por las leyes de la República Argentina, incluyendo, según corresponda, el Código Civil y Comercial de la Nación, la Ley 24.240 de Defensa del Consumidor, la Ley 25.326 de Protección de los Datos Personales, la Ley 11.723 de Propiedad Intelectual, la Ley 25.506 de Firma Digital y demás normativa aplicable." },
      { p: "En las relaciones que no sean de consumo, la competencia se determinará conforme a las reglas legales correspondientes." },
      { p: "UNIDOAR y el Usuario se comprometen a intentar resolver en forma amistosa cualquier desacuerdo que pudiere surgir entre ellos." },
      { p: "Por cualquier reclamo judicial, serán competentes los tribunales o juzgados del departamento judicial de San Isidro." },
    ],
  },
  {
    id: "nulidad-parcial-e-integridad",
    titulo: "23. Nulidad parcial e integridad.",
    bloques: [
      { p: "Si alguna disposición fuera declarada inválida o inaplicable, las restantes conservarán su vigencia en la medida en que puedan subsistir legalmente." },
      { p: "**Estos Términos se complementan con la Política de Privacidad y, cuando corresponda, con las condiciones particulares de los servicios contratados.**" },
    ],
  },
  {
    id: "proteccion-de-datos-ver-politica-de-privacidad",
    titulo: "24. Protección de Datos (ver Política de Privacidad).",
    bloques: [],
  },
  {
    id: "contacto",
    titulo: "25. Contacto.",
    bloques: [
      { p: "Para consultas sobre estos Términos, el usuario podrá comunicarse con:" },
      {
        lista: [
          "Titular de UNIDOAR: Nombre / Razón Social: Castagnone, Esteban Alejandro.",
          "CUIT: 20-18428153-9.",
          "Domicilio Legal: Triunvirato 4023, Villa Adelina, Vicente López, Provincia de Buenos Aires.",
          "Correo Electrónico (Soporte / Privacidad): unidoar@gmail.com.",
          "Sitio Web: unidoar.com.ar.",
          "Teléfono de Contacto: 11 54735876.",
        ],
        marcador: "ninguno",
      },
    ],
  },
  {
    id: "aceptacion-final",
    titulo: "Aceptación.",
    bloques: [
      { p: "**He leído y acepto los Términos y Condiciones de Uso de UNIDOAR.**" },
      { p: "**La lectura de estos Términos y Condiciones expresa el consentimiento del usuario, junto a la aceptación de la Política de Privacidad. La Política de Privacidad se encuentra disponible en un documento separado accediendo** [aquí](/privacidad)**.**" },
    ],
  },
];

export type ParteDeTexto = { tipo: "texto" | "negrita"; texto: string } | { tipo: "enlace"; texto: string; href: string };

/**
 * Parte un texto en tramos según sus marcas. Un enlace solo puede ir a una ruta interna ("/privacidad"): nada que venga
 * de afuera se convierte en enlace, y el texto nunca se interpreta como HTML (se pinta como texto).
 */
export function partesDeTexto(texto: string): ParteDeTexto[] {
  const partes: ParteDeTexto[] = [];
  // El enlace tiene que empezar con una sola "/": "//sitio.com" es un sitio de afuera.
  const marca = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g;
  let desde = 0;
  for (const m of texto.matchAll(marca)) {
    if (m.index > desde) partes.push({ tipo: "texto", texto: texto.slice(desde, m.index) });
    if (m[1] !== undefined) partes.push({ tipo: "negrita", texto: m[1] });
    else partes.push({ tipo: "enlace", texto: m[2]!, href: m[3]! });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) partes.push({ tipo: "texto", texto: texto.slice(desde) });
  return partes;
}
