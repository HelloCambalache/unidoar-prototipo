/*
 * Texto de /privacidad (Política de Privacidad y Protección de Datos Personales de UNIDOAR, versión 2 del 4 de noviembre de 2026). Es el documento
 * legal que redactó la titular de UNIDOAR: se carga tal cual, palabra por palabra, con la misma forma que los términos (src/lib/terminos-texto.ts).
 * NO se reescribe ni se corrige acá: un cambio se hace en el documento y se vuelve a cargar. Al cambiarlo hay que subir `PRIVACIDAD_ACTUALIZADA` y
 * `PRIVACIDAD_NUMERO_DE_VERSION` (src/lib/terminos.ts). Código puro (sin base ni Next) para poder probarlo.
 *
 * Lo que la página agrega al documento (y nada más): la fecha y el número de versión donde el documento tenía [FECHA] y [NÚMERO], y no se dibuja
 * el cuadro ☐ de la línea de aceptación (en la página no se puede tildar: la aceptación es la casilla del registro).
 */
import type { SeccionLegal } from "@/lib/terminos-texto";

/** Título del documento, como lo escribió la titular. */
export const TITULO_PRIVACIDAD = "POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES DE UNIDOAR";

/** Las 19 secciones y la constancia de lectura, en el orden del documento. */
export const SECCIONES_PRIVACIDAD: SeccionLegal[] = [
  {
    id: "responsable-del-tratamiento",
    titulo: "1. Responsable del tratamiento.",
    bloques: [
      { p: "La presente Política de Privacidad explica cómo se recopilan, utilizan, almacenan, comunican y protegen los datos personales tratados a través de UNIDOAR, su sitio web, aplicación móvil y panel de gestión." },
      { p: "El responsable de la base de datos y del tratamiento será: Castagnone, Esteban Alejandro, CUIT 20-18428153-9, con domicilio en Triunvirato 4023, Villa Adelina, Vicente López, Provincia de Buenos Aires, correo electrónico unidoar@gmail.com, en adelante, UNIDOAR." },
      { p: "Si determinadas operaciones son realizadas por terceros que actúan como proveedores tecnológicos o por instituciones educativas que utilizan la Plataforma, cada parte deberá actuar dentro de sus funciones y responsabilidades legales." },
    ],
  },
  {
    id: "alcance-de-esta-politica",
    titulo: "2. Alcance de esta Política.",
    bloques: [
      { p: "Esta Política se aplica a los datos personales de:" },
      {
        lista: [
          "Docentes que crean un perfil o se postulan a convocatorias.",
          "Representantes, empleados y usuarios autorizados de instituciones educativas.",
          "Personas que contactan a UNIDOAR o utilizan sus funcionalidades.",
          "Usuarios que participan en los sistemas de evaluación, beneficios o biblioteca de recursos.",
        ],
        marcador: "guion",
      },
      { p: "**La Política de Privacidad debe leerse e interpretarse junto con los Términos y Condiciones de Uso. La aceptación de ambas conjuntamente permite la utilización del servicio.**" },
    ],
  },
  {
    id: "datos-que-podemos-recopilar",
    titulo: "3. Datos que podemos recopilar.",
    bloques: [
      { p: "Según el tipo de usuario y las funcionalidades utilizadas, UNIDOAR podrá recopilar las siguientes categorías de información:" },
      {
        lista: [
          "Datos identificatorios: nombre, apellido, documento de identidad y fotografía, cuando resulte necesario y legalmente procedente.",
          "Datos de contacto: correo electrónico, teléfono y demás medios de comunicación proporcionados.",
          "Datos profesionales: formación, títulos, matrículas, experiencia, especialidades, disponibilidad y antecedentes profesionales relevantes para las convocatorias.",
          "Datos institucionales: denominación de la institución, domicilio, CUIT, datos de sus representantes y documentación necesaria para verificar su identidad o facultades.",
          "Datos de actividad en la Plataforma: cuenta, postulaciones, convocatorias, comunicaciones relacionadas con el Servicio, calificaciones, preferencias y registros de operaciones.",
          "Datos técnicos: información de conexión, dispositivo, sistema operativo, fecha y hora de acceso, registros de seguridad y datos técnicos necesarios para mantener y proteger la Plataforma.",
          "Datos comerciales: suscripciones, pagos, facturación y estado de contratación, cuando corresponda. Los datos completos de tarjetas u otros medios de pago serán tratados por los proveedores de pago cuando así funcione el sistema, conforme a sus respectivas políticas.",
        ],
        marcador: "letras",
      },
      { p: "UNIDOAR procurará limitar la recopilación a los datos adecuados, pertinentes y no excesivos para las finalidades informadas." },
    ],
  },
  {
    id: "finalidades-del-tratamiento",
    titulo: "4. Finalidades del tratamiento.",
    bloques: [
      { p: "Los datos podrán utilizarse para:" },
      {
        lista: [
          "Crear y administrar cuentas de usuarios.",
          "Elaborar y mostrar perfiles profesionales a instituciones educativas conforme a las funcionalidades y autorizaciones correspondientes.",
          "Publicar convocatorias, gestionar postulaciones y facilitar el contacto entre docentes e instituciones.",
          "Verificar la información y documentación en el alcance de los controles que efectivamente realice UNIDOAR.",
          "Administrar suscripciones, pagos, facturación y atención de reclamos.",
          "Gestionar el sistema de calificaciones y reputación, con las garantías previstas en los Términos y Condiciones.",
          "Administrar el Club UNIDOAR y las funcionalidades de la biblioteca de recursos.",
          "Atender consultas, solicitudes, reclamos y ejercicio de derechos.",
          "Cumplir obligaciones legales y responder a requerimientos válidos de autoridades competentes.",
          "Mejorar el funcionamiento y la seguridad de la Plataforma mediante análisis técnicos, preferentemente con datos agregados o disociados cuando sea posible.",
        ],
        marcador: "letras",
      },
      { p: "Los datos no se utilizarán para finalidades incompatibles con aquellas para las que fueron recopilados, salvo que exista una base jurídica válida que lo permita." },
    ],
  },
  {
    id: "caracter-obligatorio-o-facultativo-de-los-datos",
    titulo: "5. Carácter obligatorio o facultativo de los datos.",
    bloques: [
      { p: "Los datos estrictamente necesarios para crear una cuenta, prestar una funcionalidad o cumplir una obligación legal podrán ser requeridos como condición para acceder al servicio correspondiente." },
      { p: "Otros datos serán facultativos. En cada formulario se procurará identificar qué información es obligatoria y cuál es opcional." },
      { p: "La negativa a proporcionar datos necesarios podrá impedir el registro, la postulación o el uso de determinadas funcionalidades." },
      { p: "La información falsa o incompleta podrá afectar el funcionamiento del Servicio y dar lugar a la solicitud de correcciones o a las medidas previstas en los Términos y Condiciones." },
    ],
  },
  {
    id: "perfil-profesional-y-comunicacion-a-instituciones-educativas",
    titulo: "6. Perfil profesional y comunicación a instituciones educativas.",
    bloques: [
      { p: "Cuando un docente se registra en UNIDOAR, determinados datos de su perfil podrán ponerse a disposición de las instituciones educativas adheridas para facilitar la búsqueda y selección de candidatos." },
      { p: "Las instituciones educativas que reciban datos deberán utilizarlos únicamente para finalidades legítimas relacionadas con las convocatorias y cumplir sus propias obligaciones en materia de protección de datos." },
    ],
  },
  {
    id: "documentacion-de-identidad-y-formacion-profesional",
    titulo: "7. Documentación de identidad y formación profesional.",
    bloques: [
      { p: "La Plataforma podrá permitir la carga de DNI, fotografía, títulos, matrículas, certificados analíticos y otros documentos profesionales." },
      { p: "La carga de documentación no implica que UNIDOAR certifique oficialmente su autenticidad, vigencia o suficiencia profesional." },
      { p: "La Información Personal que provea el Usuario deberá ser completa, cierta y actualizada, no siendo responsable UNIDOAR por su parcialidad, inexactitud o falta de actualización. El Usuario tendrá la posibilidad de rectificar, actualizar, o suprimir su Información." },
      { p: "Las instituciones educativas deberán realizar las comprobaciones que les correspondan legalmente antes de contratar a un docente o permitir su ingreso al establecimiento, siendo su exclusiva responsabilidad." },
    ],
  },
  {
    id: "calificaciones-y-reputacion",
    titulo: "8. Calificaciones y reputación.",
    bloques: [
      { p: "Cuando exista un sistema de calificaciones, UNIDOAR podrá tratar la información necesaria para registrar y/o administrar evaluaciones vinculadas con prestaciones realizadas mediante la Plataforma." },
      { p: "La información se utilizará conforme a las finalidades informadas y las reglas de acceso establecidas." },
      { p: "Las solicitudes serán examinadas conforme a la legislación aplicable y los procedimientos de revisión de la Plataforma." },
    ],
  },
  {
    id: "base-juridica-y-consentimiento",
    titulo: "9. Base jurídica y consentimiento.",
    bloques: [
      { p: "Cuando la ley requiera consentimiento, éste deberá ser libre, expreso e informado y podrá revocarse expresamente conforme a la normativa vigente y a los Términos y Condiciones." },
      { p: "La aceptación de los Términos y Condiciones significa consentimiento expreso." },
    ],
  },
  {
    id: "destinatarios-y-proveedores",
    titulo: "10. Destinatarios y proveedores.",
    bloques: [
      { p: "UNIDOAR puede tratar, almacenar, recopilar, distribuir y/o utilizar la Información Personal para satisfacer los pedidos del Usuario respecto de contenidos, productos y/o servicios ofrecidos a través del Sitio, responder sus preguntas, comunicarse con el Usuario, mejorar el diseño y contenido del Sitio, hacer marketing interno y externo, formar perfiles de Usuario, facilitar la participación del Usuario y/o enviarle e-mails o correspondencia con fines promocionales." },
      { p: "Unidoar podrá relevar la Información Personal a terceros a fin de cumplir con procedimientos legales, tales como una orden de allanamiento, una citación u orden judicial o bien a requerimiento de las autoridades administrativas que recaben la Información Personal para el ejercicio de funciones propias de los poderes del Estado o en virtud de una obligación legal." },
      { p: "**El Usuario consiente expresamente que la Información Personal pueda ser compartida y/o utilizada por UNIDOAR. El Usuario brinda su consentimiento expreso para que UNIDOAR pueda ceder la Información Personal pulsando el botón \"Leí y Acepto la Política de Privacidad\" que figura al término de esta Política de Privacidad. Si el Usuario no desea que su Información Personal sea cedida a terceros, por favor, no haga click en el botón \"Leí y Acepto la Política de Privacidad\".**" },
      { p: "Los datos podrán ser accesibles, en la medida necesaria y conforme a la finalidad informada, por:" },
      {
        lista: [
          "Instituciones educativas adheridas, respecto de los perfiles y datos que necesiten para gestionar convocatorias.",
          "Proveedores de alojamiento, almacenamiento en la nube, mantenimiento, seguridad informática, mensajería y soporte técnico.",
          "Proveedores de pagos y facturación, cuando corresponda.",
          "Asesores profesionales y prestadores que necesiten acceder a determinada información para cumplir una tarea, bajo deberes de confidencialidad.",
          "Autoridades administrativas o judiciales cuando exista un requerimiento válido o una obligación legal.",
        ],
        marcador: "letras",
      },
    ],
  },
  {
    id: "almacenamiento",
    titulo: "11. Almacenamiento.",
    bloques: [
      { p: "UNIDOAR podrá utilizar proveedores tecnológicos para alojar y procesar información." },
      { p: "Los proveedores deberán acceder únicamente a la información necesaria para prestar sus servicios y estar sujetos a obligaciones de confidencialidad y seguridad adecuadas, eximiendo a UNIDOAR de responsabilidad al respecto." },
    ],
  },
  {
    id: "conservacion-y-eliminacion-de-los-datos",
    titulo: "12. Conservación y eliminación de los datos.",
    bloques: [
      { p: "Los datos se conservarán durante el tiempo necesario para cumplir las finalidades informadas, administrar la cuenta, prestar el servicio, atender reclamos y cumplir las obligaciones legales aplicables." },
      { p: "Cuando dejen de ser necesarios y no exista una causa legítima para conservarlos, se procederá a su eliminación, disociación o bloqueo, según corresponda." },
      { p: "La baja de una cuenta no implicará necesariamente la eliminación inmediata de todos los registros cuando su conservación sea legalmente exigible o resulte necesaria para atender responsabilidades pendientes." },
    ],
  },
  {
    id: "seguridad-y-confidencialidad",
    titulo: "13. Seguridad y confidencialidad.",
    bloques: [
      { p: "UNIDOAR podrá adoptar medidas técnicas y organizativas razonables al riesgo para proteger los datos. No obstante ningún sistema puede garantizar seguridad absoluta." },
      { p: "Estas medidas podrán incluir controles de acceso, autenticación, gestión de permisos, copias de seguridad, protección de sistemas, registros de actividad y obligaciones de confidencialidad para las personas que intervengan en el tratamiento." },
      { p: "Los usuarios deberán mantener seguras sus credenciales y comunicar los incidentes de seguridad de los que tomen conocimiento." },
      { p: "**Dadas las condiciones de seguridad que ofrece hoy Internet, el Usuario debe tener presente que, al divulgar su Información Personal en línea, ya sea al momento de suscribirse, contratar algún producto y/o servicio, la Información Personal puede ser recogida o utilizada por otros. Por lo tanto, si bien UNIDOAR realiza su mayor esfuerzo para proteger la Información Personal, UNIDOAR no será responsable por la difusión de Información Personal que pudieren realizar otros visitantes del Sitio, ni será responsable por los daños y perjuicios que dicha divulgación genere.**" },
      { p: "**UNIDOAR no asume responsabilidad alguna por los daños producidos en la computadora o dispositivos del Usuario o sus archivos como consecuencia de la utilización de los contenidos, productos y/o servicios ofrecidos en el Sitio, el envío o recepción de e-mails. UNIDOAR tampoco garantiza que los contenidos, archivos o programas disponibles a través del Sitio, o los e-mails enviados estén libres de virus, que no resulten dañinos, invasivos o destructivos del equipo del Usuario. Asimismo, cualquier falla, falta o retraso de los servicios o daños producidos en la computadora o dispositivos del Usuario como consecuencia del uso del Sitio no será responsabilidad de UNIDOAR.**" },
    ],
  },
  {
    id: "cookies-y-tecnologias-similares",
    titulo: "14. Cookies y tecnologías similares.",
    bloques: [
      { p: "Algunas de las páginas web del Sitio pueden utilizar \"cookies\". Las \"cookies\" son pequeños archivos de texto que se colocan en el navegador de la computadora del Usuario. La información que Unidoar guarda en las \"cookies\" que eventualmente utilice está relacionada con el seteo de las preferencias del Usuario para mantener sesiones, recordar preferencias, mejorar la seguridad y obtener información técnica sobre el uso del Servicio." },
      { p: "Las cookies estrictamente necesarias para el funcionamiento podrán tratarse según su finalidad técnica." },
      { p: "El usuario podrá modificar las opciones disponibles en el navegador o en el panel de preferencias, teniendo presente que bloquear determinadas cookies puede afectar algunas funcionalidades." },
    ],
  },
  {
    id: "comunicaciones-operativas-y-promocionales",
    titulo: "15. Comunicaciones operativas y promocionales.",
    bloques: [
      { p: "UNIDOAR podrá enviar mensajes necesarios para administrar cuentas, confirmar operaciones, informar sobre seguridad, gestionar postulaciones y comunicar cambios relevantes del Servicio." },
      { p: "Las comunicaciones promocionales o publicitarias se enviarán de acuerdo con la normativa aplicable y las preferencias del usuario." },
      { p: "Cuando corresponda, se ofrecerá un mecanismo sencillo para dejar de recibir comunicaciones comerciales, sin afectar los mensajes indispensables para la gestión de la cuenta o el cumplimiento de obligaciones legales." },
    ],
  },
  {
    id: "derechos-de-los-titulares-de-datos",
    titulo: "16. Derechos de los titulares de datos.",
    bloques: [
      { p: "El titular podrá ejercer los derechos reconocidos por la Ley 25.326, incluyendo:" },
      {
        lista: [
          "Acceso: conocer los datos personales registrados y la información legalmente exigible sobre su tratamiento.",
          "Rectificación y actualización: solicitar la corrección de datos inexactos o incompletos.",
          "Supresión: solicitar la eliminación de los datos cuando legalmente corresponda.",
          "Confidencialidad: solicitar las medidas que correspondan para proteger sus datos.",
          "Revocación del consentimiento: retirar expresamente el consentimiento otorgado.",
        ],
        marcador: "guion",
      },
      { p: "Las solicitudes podrán enviarse a unidoar@gmail.com, indicando el derecho que se desea ejercer y aportando la información razonablemente necesaria para verificar la identidad del solicitante y su justificación." },
    ],
  },
  {
    id: "enlaces-y-servicios-de-terceros",
    titulo: "17. Enlaces y servicios de terceros.",
    bloques: [
      { p: "La Plataforma podrá incluir enlaces a sitios, comercios o servicios externos, incluidos los participantes del Club UNIDOAR." },
      { p: "Una vez que el usuario acceda a un servicio externo, el tratamiento de sus datos se regirá por la política de privacidad del tercero correspondiente." },
    ],
  },
  {
    id: "modificaciones-de-esta-politica",
    titulo: "18. Modificaciones de esta Política.",
    bloques: [
      { p: "UNIDOAR podrá actualizar esta Política para reflejar cambios legales, tecnológicos o funcionales." },
      { p: "La versión vigente estará disponible en el sitio web, con su fecha de actualización." },
    ],
  },
  {
    id: "contacto-y-responsable",
    titulo: "19. Contacto y responsable.",
    bloques: [
      { p: "Para consultas, solicitudes o reclamos relativos al tratamiento de datos personales, el usuario podrá comunicarse con:" },
      {
        lista: [
          "Responsable:",
          "Nombre / Razón Social: Castagnone, Esteban Alejandro.",
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
    titulo: "Constancia de lectura y aceptación.",
    bloques: [
      { p: "**He leído y acepto la Política de Privacidad de UNIDOAR.**" },
      { p: "**La lectura de esta Política tiene por finalidad informar al usuario sobre el tratamiento de sus datos y expresa el consentimiento del usuario, junto a la aceptación de los Términos y Condiciones.**" },
    ],
  },
];
