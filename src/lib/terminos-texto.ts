/*
 * Texto de /terminos (Términos y Condiciones Generales de Uso). Es el documento legal que redactó la titular de UNIDOAR:
 * se carga tal cual, con solo la forma de la página (secciones numeradas, listas, negritas, un enlace a /privacidad).
 * Cambiar una palabra de acá cambia lo que aceptan las personas: hay que subir `VERSION_TERMINOS` y `TERMINOS_ACTUALIZADOS`
 * (src/lib/terminos.ts). Código puro (sin base ni Next) para poder probarlo.
 *
 * Marcas dentro de un texto: **negrita** y [texto](/ruta-interna).
 */

export type BloqueTexto = { p: string } | { lista: string[] };

export type SeccionTerminos = {
  id: string;
  titulo: string;
  bloques: BloqueTexto[];
  subsecciones?: { id: string; titulo: string; bloques: BloqueTexto[] }[];
};

/** Subtítulo de la página: a qué aplicación se refiere el documento. */
export const SUBTITULO_TERMINOS = "Aplicación UNIDOAR (www.unidoar.com / Aplicación Móvil)";

/** Lo que va antes de la sección 1. */
export const PREAMBULO_TERMINOS: string[] = [
  "El presente documento establece los Términos y Condiciones Generales de Uso de la aplicación móvil UNIDOAR (en adelante, la “App” o la “Plataforma”), operada bajo la estructura legal correspondiente a la Sociedad por Acciones Simplificada (SAS) constituida en la República Argentina (en adelante, “UNIDOAR”).",
  "La utilización por parte del Usuario de cualquiera de los servicios de la App implica su adhesión y aceptación expresa, plena y sin reservas a todas las Condiciones Generales de Uso aquí publicadas, así como a la [Política de Privacidad](/privacidad) de la plataforma. Al aceptar estos Términos y Condiciones, Usted: a) Afirma que ha leído libremente todos los enunciados, y b) Que los tiene por notificados, entendidos y aceptados en cumplimiento con la normativa aplicable de la República Argentina (Ley N° 25.326 de Protección de Datos Personales y normas complementarias).",
  "En caso de no estar de acuerdo con los presentes Términos y Condiciones, se solicita al Usuario que se abstenga de descargar, instalar, registrarse o utilizar la App y los servicios ofrecidos en ella.",
  "Para efectos de este documento, se utilizarán los términos “Usted” o “Usuario” para referirse a cualquier persona que acceda a la App, distinguiéndose operativamente entre “Postulantes” (docentes, profesores, instructores, entrenadores y guardavidas) e “Instituciones” (colegios, jardines, institutos de idiomas, institutos terciarios, clubes, gimnasios y centros deportivos).",
];

export const SECCIONES_TERMINOS: SeccionTerminos[] = [
  {
    id: "aceptacion",
    titulo: "1. Aceptación de los Términos y Condiciones",
    bloques: [
      {
        p: "El acceso, descarga y uso de la App atribuye la condición de Usuario de UNIDOAR e implica la aceptación total de cada una de las cláusulas aquí expresadas. Las modificaciones que UNIDOAR realice sobre estos términos entrarán en vigencia desde el momento de su publicación en la App.",
      },
    ],
  },
  {
    id: "servicio",
    titulo: "2. Descripción del Servicio y Naturaleza de la Plataforma",
    bloques: [
      {
        p: "UNIDOAR es una aplicación móvil desarrollada para optimizar el proceso de encuentro y vinculación laboral entre profesionales del ámbito educativo, deportivo, de lenguas y recreativo (docentes, profesores, instructores, entrenadores, guardavidas) y las instituciones que requieren cubrir posiciones (colegios, jardines, institutos de idiomas, institutos terciarios, clubes, gimnasios y centros deportivos).",
      },
      {
        p: "**UNIDOAR NO ES UNA EMPRESA DE SERVICIOS EVENTUALES NI UNA AGENCIA DE COLOCACIÓN LABORAL TRADICIONAL.** La App funciona exclusivamente como un canal tecnológico de intermediación y match automatizado. Por lo tanto, UNIDOAR no participa en los procesos de contratación final, no fija salarios, no asume el rol de empleador ni forma parte de los acuerdos laborales o contractuales que se pacten de manera directa entre las Instituciones y los Postulantes.",
      },
    ],
  },
  {
    id: "registro",
    titulo: "3. Registro y Cuentas de Usuario",
    bloques: [
      {
        p: "El uso de ciertas funcionalidades de la App requiere el registro previo de una cuenta de usuario mediante correo electrónico y contraseña o sistemas de autenticación válidos.",
      },
      {
        lista: [
          "**Seguridad de la Cuenta:** El Usuario es el único responsable de mantener la confidencialidad de sus credenciales de acceso y de toda la actividad que ocurra bajo su cuenta. En caso de uso no autorizado, deberá notificar a UNIDOAR de inmediato.",
          "**Veracidad de los Datos:** Toda la información provista al registrarse (datos personales, títulos, libretas de guardavidas, matrículas, experiencia o datos fiscales y legales de la Institución) revestirá carácter de declaración jurada.",
        ],
      },
    ],
  },
  {
    id: "tipos-de-usuario",
    titulo: "4. Condiciones Particulares según el Tipo de Usuario",
    bloques: [],
    subsecciones: [
      {
        id: "postulantes",
        titulo: "4.1. Sobre los Postulantes (Docentes, Profesores, Instructores, Entrenadores y Guardavidas)",
        bloques: [
          {
            lista: [
              "El servicio de registro y postulación a través de la App es gratuito para los profesionales.",
              "El Postulante se compromete a completar su perfil con información verídica y a mantener actualizados sus datos de contacto, títulos y habilitaciones obligatorias (tales como la Libreta y la Reválida anual vigente en el caso de los guardavidas).",
              "El Postulante comprende que su perfil, antecedentes y credenciales veraces serán visualizados exclusivamente por las Instituciones suscriptas a la App con el fin de evaluar posibles incorporaciones o coberturas, resguardando su privacidad frente a otros usuarios postulantes.",
            ],
          },
        ],
      },
      {
        id: "instituciones",
        titulo: "4.2. Sobre las Instituciones (Colegios, Jardines, Institutos de Idiomas, Institutos Terciarios, Clubes, Gimnasios y Centros Deportivos)",
        bloques: [
          {
            lista: [
              "El acceso al catálogo de talento y el uso de las herramientas de búsqueda dentro de la App es arancelado y se encuentra supeditado a la suscripción activa al plan contratado (ej. Plan Fundador, abonos mensuales o anuales).",
              "La Institución podrá emitir sus búsquedas laborales, filtrar por nivel, zona o especialidad y acceder a perfiles con identidad y credenciales validadas. Las transacciones comerciales y contrataciones de abonos se realizarán a través de los medios de pago habilitados por la SAS, emitiéndose la documentación fiscal correspondiente (Factura A o B según corresponda al perfil impositivo del cliente).",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "conducta",
    titulo: "5. Reglas de Conducta y Uso Prohibido de la App",
    bloques: [
      {
        p: "El Usuario se obliga a utilizar la App de conformidad con la ley aplicable, el orden público y la ética profesional. Queda terminantemente prohibido:",
      },
      {
        lista: [
          "Insertar o difundir contenidos ilícitos, discriminatorios, difamatorios o que violen derechos de terceros o la normativa de protección de menores.",
          "Introducir virus, software malicioso o realizar ataques técnicos que afecten la estabilidad o seguridad de la infraestructura de la App.",
          "Suplantar la identidad de otros usuarios o falsear credenciales, títulos o habilitaciones profesionales.",
          "Intentar extraer masivamente datos de la base de usuarios de la App o realizar ingeniería inversa sobre el software.",
          "Utilizar la App para enviar correo masivo no solicitado (Spam) o comercializar de forma directa el acceso a los contactos provistos por la plataforma a terceros ajenos.",
        ],
      },
      {
        p: "El incumplimiento de estas normas facultará a UNIDOAR para suspender o dar de baja de forma definitiva la cuenta del Usuario infractor, sin derecho a reclamo ni indemnización alguna.",
      },
    ],
  },
  {
    id: "propiedad-intelectual",
    titulo: "6. Propiedad Intelectual",
    bloques: [
      {
        p: "Todo el contenido de la App (incluyendo el diseño de interfaces, logotipos, marcas, textos, bases de datos, software, gráficos y código fuente) es propiedad exclusiva de la SAS operadora de UNIDOAR o cuenta con las licencias correspondientes. Su uso no autorizado, reproducción total o parcial, modificación o explotación comercial queda estrictamente prohibida y pasible de acciones legales.",
      },
    ],
  },
  {
    id: "datos-personales",
    titulo: "7. Protección de Datos Personales (Ley N° 25.326)",
    bloques: [
      {
        p: "Los datos personales aportados por los Usuarios serán tratados con estricta confidencialidad de conformidad con la Ley Nacional de Protección de Datos Personales N° 25.326.",
      },
      {
        lista: [
          "El Usuario otorga su consentimiento libre, expreso e informado para que sus datos sean almacenados y procesados con el único fin de cumplir con el objeto de la App (vincular la oferta y la demanda laboral educativa, de lenguas y deportiva).",
          "Los Postulantes aceptan que sus datos profesionales sean mostrados a las Instituciones habilitadas en la App.",
          "El Usuario podrá ejercer en todo momento sus derechos de acceso, rectificación y supresión de sus datos personales comunicándose a través de los canales de soporte oficiales de la plataforma.",
        ],
      },
    ],
  },
  {
    id: "responsabilidad",
    titulo: "8. Limitación de Responsabilidad",
    bloques: [
      { p: "UNIDOAR no asume responsabilidad alguna por:" },
      {
        lista: [
          "La veracidad, exactitud o vigencia de la información, títulos, antecedentes o documentación cargada de manera autónoma por los Postulantes o las Instituciones. Si bien la App implementa validaciones y filtros, la contratación final es exclusiva responsabilidad de las partes.",
          "Las negociaciones, acuerdos salariales, condiciones de contratación, incumplimientos laborales o conflictos de cualquier índole que surjan entre el Postulante y la Institución con motivo de una vinculación generada a través de la App.",
          "Daños en los dispositivos móviles de los Usuarios derivados del uso de la App, interrupciones temporales del servicio por fallas técnicas ajenas, casos fortuitos o fuerza mayor.",
        ],
      },
    ],
  },
  {
    id: "modificaciones",
    titulo: "9. Modificaciones de la App y de los Términos",
    bloques: [
      {
        p: "UNIDOAR se reserva el derecho de modificar, actualizar, suspender o discontinuar en cualquier momento y sin previo aviso las funcionalidades de la App, así como los presentes Términos y Condiciones, los cuales regirán desde su publicación digital en la plataforma.",
      },
    ],
  },
  {
    id: "jurisdiccion",
    titulo: "10. Jurisdicción y Ley Aplicable",
    bloques: [
      {
        p: "Los presentes Términos y Condiciones se rigen en todas y cada una de sus partes por las leyes de la República Argentina. Cualquier controversia, disputa o reclamo derivado de la existencia, validez, interpretación o ejecución de este contrato será sometida a la competencia de los Tribunales Ordinarios con asiento en la jurisdicción correspondiente a la sede legal de la sociedad operadora, renunciando expresamente las partes a cualquier otro fuero o jurisdicción que pudiera corresponderles.",
      },
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
