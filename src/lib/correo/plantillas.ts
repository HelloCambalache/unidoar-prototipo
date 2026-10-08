import type { Remitente } from "./config";

/*
 * Los mails de la app: qué dice cada uno, para quién es y cómo se arma el HTML y el texto plano. Es todo código puro
 * (sin base ni red) para poder probarlo. Los IDs (M06, M24…) son los del inventario: docs/inventario-de-mails.md.
 *
 * Los textos que vienen de personas (nombres, motivos, mensajes) se escapan SIEMPRE al armar el HTML. Lo único que
 * se escribe a mano acá es el marcado propio de cada mail, nunca el texto de los datos.
 */

export type GrupoCorreo = "cuenta" | "contratacion" | "facturacion" | "interno";

/** Los avisos de este grupo se pueden apagar desde Mi cuenta o con el enlace del pie. Los demás no. */
export const esGrupoOpcional = (grupo: GrupoCorreo) => grupo === "contratacion";

/** Lo que guarda la cola para armar cada mail. Todo serializable (va a una columna jsonb). Las rutas son internas ("/docente/…"). */
export type DatosDe = {
  /** Invitación al equipo de una institución. */
  M06: { institucion: string; rol: string; invitadoPor: string | null; email: string; ruta: string };
  M11: { nombre: string };
  M12: { nombre: string; motivo: string };
  M13: { nombre: string; motivo: string };
  /** Docente: `nombre` y sin `institucion`. Institución: `institucion` y sin `nombre` (le llega a todo el equipo). */
  M15: { nombre: string | null; institucion: string | null; motivo: string | null };
  M20: { institucion: string; puesto: string; ruta: string };
  M21: { institucion: string; puesto: string; zona: string | null; plazo: string | null; ruta: string };
  M23: { institucion: string; puesto: string; ruta: string };
  M24: { institucion: string; puesto: string; cuando: string; titulo: string | null; ruta: string };
  M25: { institucion: string; puesto: string; ruta: string };
  M26: { institucion: string; puesto: string; ruta: string };
  M27: { institucion: string; puesto: string; inicio: string | null; ruta: string };
  M28: { institucion: string; puesto: string; ruta: string };
  M30: { busqueda: string; rapida: boolean; ruta: string };
  M50: { institucion: string; periodo: string; monto: string; vence: string };
  M51: { institucion: string; periodo: string; monto: string; vence: string };
  /** `segundoAviso`: ya pasó más de una semana del vencimiento. */
  M52: { institucion: string; periodo: string; monto: string; vencio: string; segundoAviso: boolean };
  M53: { institucion: string; periodo: string; monto: string };
  M54: { institucion: string; periodo: string; monto: string };
  M55: { institucion: string; plan: string };
  /** `detalle`: lo que pasó con la factura del mes (la crearon, la ajustaron…), ya redactado. */
  M56: { institucion: string; plan: string; aprobado: boolean; nota: string | null; detalle: string | null };
  M60: { nombre: string; email: string; rol: string | null; mensaje: string };
  M61: { docente: string; detalle: string; ruta: string };
  M62: { cuenta: string; tipo: string; ruta: string };
  M63: { institucion: string; plan: string; ruta: string };
};

export type PlantillaId = keyof DatosDe;

/** Un trozo de párrafo: texto común o en negrita. Se arma así (y no con HTML) para poder escapar todo lo que viene de afuera. */
export type Parte = string | { negrita: string };
const n = (texto: string): Parte => ({ negrita: texto });

type Contenido = {
  asunto: string;
  /** Texto de vista previa en la bandeja de entrada. */
  previa: string;
  titulo: string;
  parrafos: Parte[][];
  /** Texto de una persona (motivo, mensaje) que se muestra citado, respetando los saltos de línea. */
  cita?: string;
  boton?: { texto: string; ruta: string };
  nota?: Parte[];
  /** Por qué recibe el mail, si no alcanza con la frase general de su grupo. */
  motivo?: string;
};

type Definicion<P extends PlantillaId> = {
  grupo: GrupoCorreo;
  remitente: Remitente;
  /** Como máximo `max` mails de este tope (la clave que pase quien encola) cada `horas`. Lo que excede se omite. */
  tope?: { max: number; horas: number };
  /** Si el mail es la respuesta natural a una persona (Contacto): a dónde responder. */
  responderA?: (datos: DatosDe[P]) => string | undefined;
  contenido: (datos: DatosDe[P]) => Contenido;
};

const minuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

export const PLANTILLAS: { [P in PlantillaId]: Definicion<P> } = {
  /* ───────── Cuenta ───────── */
  M06: {
    grupo: "cuenta",
    remitente: "app",
    tope: { max: 20, horas: 24 },
    contenido: (d) => ({
      asunto: `${d.institucion} te invitó a sumarte a su equipo en UNIDOAR`,
      previa: `Te invitaron a ser parte del equipo de ${d.institucion}.`,
      titulo: `Te invitaron a sumarte a ${d.institucion}`,
      parrafos: [
        [d.invitadoPor ? n(d.invitadoPor) : "Una persona del equipo", " te invitó a ser parte del equipo de ", n(d.institucion), " en UNIDOAR, con el rol de ", n(d.rol), "."],
        ["Para aceptar, entrá al enlace, elegí «Soy institución» y registrate con este mismo email: ", n(d.email), "."],
      ],
      boton: { texto: "Aceptar la invitación", ruta: d.ruta },
      nota: ["Si no esperabas esta invitación, ignorá este mail: no se suma nadie hasta que alguien cree la cuenta."],
      motivo: `Te escribimos porque ${d.institucion} te invitó a su equipo en UNIDOAR.`,
    }),
  },

  /* ───────── Verificación y estado de la cuenta (docente) ───────── */
  M11: {
    grupo: "cuenta",
    remitente: "app",
    contenido: (d) => ({
      asunto: "Tu perfil de UNIDOAR está verificado",
      previa: "Revisamos tu documentación: ya tenés el sello de verificado.",
      titulo: "¡Tu perfil está verificado!",
      parrafos: [
        ["Hola ", n(d.nombre), ": revisamos tu documentación y tu perfil ya tiene el sello de verificado."],
        ["Las instituciones lo ven en tu perfil y en tus postulaciones."],
      ],
      boton: { texto: "Ver mi perfil", ruta: "/docente/perfil" },
    }),
  },
  M12: {
    grupo: "cuenta",
    remitente: "app",
    contenido: (d) => ({
      asunto: "Necesitamos que corrijas tu documentación en UNIDOAR",
      previa: "Hay algo para corregir en tu documentación.",
      titulo: "Necesitamos que corrijas tu documentación",
      parrafos: [
        ["Hola ", n(d.nombre), ": revisamos tu documentación y para poder verificar tu perfil necesitamos que la corrijas."],
        ["Lo que tenés que corregir:"],
      ],
      cita: d.motivo,
      boton: { texto: "Corregir mi documentación", ruta: "/docente/perfil#documentacion" },
      nota: ["Cuando subas lo que falta, lo revisamos de nuevo."],
    }),
  },
  M13: {
    grupo: "cuenta",
    remitente: "app",
    contenido: (d) => ({
      asunto: "No pudimos verificar tu perfil de UNIDOAR",
      previa: "Revisamos tu documentación y no pudimos verificar tu perfil.",
      titulo: "No pudimos verificar tu perfil",
      parrafos: [
        ["Hola ", n(d.nombre), ": revisamos tu documentación y por ahora no pudimos verificar tu perfil."],
        ["El motivo:"],
      ],
      cita: d.motivo,
      boton: { texto: "Escribirnos", ruta: "/contacto" },
      nota: ["Si creés que se trata de un error o querés saber cómo seguir, escribinos y lo vemos."],
    }),
  },
  M15: {
    grupo: "cuenta",
    remitente: "app",
    contenido: (d) => ({
      asunto: "Suspendimos tu cuenta de UNIDOAR",
      previa: "Tu cuenta de UNIDOAR está suspendida.",
      titulo: "Suspendimos tu cuenta",
      parrafos: [
        d.institucion
          ? ["Hola: suspendimos la cuenta de ", n(d.institucion), " en UNIDOAR."]
          : ["Hola", d.nombre ? " " : "", d.nombre ? n(d.nombre) : "", ": suspendimos tu cuenta en UNIDOAR."],
        ...(d.motivo ? [["El motivo:"]] : []),
        [
          d.institucion
            ? "Mientras esté suspendida el equipo no puede usar la plataforma ni la institución aparece en las búsquedas de los docentes."
            : "Mientras esté suspendida no podés usar la plataforma ni aparecés en las búsquedas de las instituciones.",
          " Escribinos para ver cómo regularizarla.",
        ],
      ],
      cita: d.motivo ?? undefined,
      boton: { texto: "Escribirnos", ruta: "/contacto" },
    }),
  },

  /* ───────── Contratación: para el docente ───────── */
  M20: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `${d.institucion} te invitó a postularte a ${d.puesto}`,
      previa: `${d.institucion} vio tu perfil y quiere que te postules.`,
      titulo: `${d.institucion} te invitó a postularte`,
      parrafos: [[n(d.institucion), " vio tu perfil y te invita a postularte a su búsqueda ", n(d.puesto), "."]],
      boton: { texto: "Ver la búsqueda", ruta: d.ruta },
      nota: ["Es una invitación: si no te interesa, no hace falta que respondas."],
    }),
  },
  M21: {
    grupo: "contratacion",
    remitente: "app",
    tope: { max: 3, horas: 24 },
    contenido: (d) => ({
      asunto: `Suplencia urgente cerca tuyo: ${d.puesto}${d.plazo ? ` (hasta ${d.plazo})` : ""}`,
      previa: `${d.institucion} necesita cubrir ${d.puesto}.`,
      titulo: "Suplencia urgente cerca tuyo",
      parrafos: [
        [n(d.institucion), " necesita cubrir ", n(d.puesto), d.zona ? ` en ${d.zona}` : "", "."],
        ...(d.plazo ? [["Se reciben postulaciones hasta el ", n(d.plazo), "."]] : []),
        ["Te avisamos porque encaja con tus zonas y asignaturas."],
      ],
      boton: { texto: "Ver y postularme", ruta: d.ruta },
    }),
  },
  M23: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Te preseleccionaron para ${d.puesto}`,
      previa: `${d.institucion} te preseleccionó.`,
      titulo: "Te preseleccionaron",
      parrafos: [[n(d.institucion), " te preseleccionó para ", n(d.puesto), ". Entrá para ver cómo sigue tu postulación."]],
      boton: { texto: "Ver mi postulación", ruta: d.ruta },
    }),
  },
  M24: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Entrevista con ${d.institucion}: ${d.cuando}`,
      previa: `${d.institucion} agendó una entrevista con vos.`,
      titulo: "Tenés una entrevista agendada",
      parrafos: [
        [n(d.institucion), " agendó una entrevista con vos para ", n(d.puesto), "."],
        ["Cuándo: ", n(d.cuando)],
        ...(d.titulo ? [["Detalle: ", d.titulo]] : []),
      ],
      boton: { texto: "Ver los detalles", ruta: d.ruta },
      nota: ["Todos los detalles de la entrevista están en tu postulación."],
    }),
  },
  M25: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Se canceló tu entrevista con ${d.institucion}`,
      previa: `${d.institucion} canceló la entrevista agendada.`,
      titulo: "Se canceló la entrevista",
      parrafos: [[n(d.institucion), " canceló la entrevista que había agendado para ", n(d.puesto), ". Si hay una fecha nueva, la vas a ver en tu postulación."]],
      boton: { texto: "Ver mi postulación", ruta: d.ruta },
    }),
  },
  M26: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Recibiste una oferta de ${d.institucion}`,
      previa: `${d.institucion} te envió una oferta para ${d.puesto}.`,
      titulo: "Recibiste una oferta",
      parrafos: [[n(d.institucion), " te envió una oferta para ", n(d.puesto), ". Entrá para ver los detalles."]],
      boton: { texto: "Ver la oferta", ruta: d.ruta },
    }),
  },
  M27: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `¡Te eligieron para ${d.puesto}!`,
      previa: `${d.institucion} te eligió. ¡Felicitaciones!`,
      titulo: "¡Te eligieron!",
      parrafos: [
        [n(d.institucion), " te eligió para ", n(d.puesto), d.inicio ? `, con inicio el ${d.inicio}` : "", ". ¡Felicitaciones!"],
        ["Entrá para ver el detalle de tu postulación."],
      ],
      boton: { texto: "Ver mi postulación", ruta: d.ruta },
    }),
  },
  M28: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Actualizaron tu postulación a ${d.puesto}`,
      previa: `${d.institucion} actualizó tu postulación.`,
      titulo: "Actualizaron tu postulación",
      parrafos: [
        [n(d.institucion), " actualizó tu postulación a ", n(d.puesto), ": por ahora no seguirá en el proceso."],
        ["Hay otras búsquedas que pueden encajar con tu perfil."],
      ],
      boton: { texto: "Buscar trabajo", ruta: d.ruta },
    }),
  },

  /* ───────── Contratación: para la institución ───────── */
  M30: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Tenés postulantes nuevos en ${d.busqueda}`,
      previa: `Hay docentes que se postularon a ${d.busqueda}.`,
      titulo: "Tenés postulantes nuevos",
      parrafos: [
        ["Se postularon docentes a tu búsqueda ", n(d.busqueda), ". Revisalos y movelos por las etapas del tablero."],
        [d.rapida ? "Es una búsqueda rápida: cuanto antes los veas, mejor." : "Te mandamos como máximo un aviso por día por cada búsqueda."],
      ],
      boton: { texto: "Ver postulantes", ruta: d.ruta },
    }),
  },

  /* ───────── Facturación y plan ───────── */
  M50: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: `Tu factura de ${minuscula(d.periodo)} ya está disponible`,
      previa: `Factura de ${d.periodo} de ${d.institucion}.`,
      titulo: "Tu factura ya está disponible",
      parrafos: [
        ["Ya está disponible la factura de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), ". Vence el ", n(d.vence), "."],
        ["La ves, con su historial, en la sección Plan de tu cuenta."],
      ],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
      nota: ["Si tenés dudas sobre el pago, respondé este mail."],
    }),
  },
  M51: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: `Tu factura de ${minuscula(d.periodo)} vence el ${d.vence}`,
      previa: `Recordatorio: la factura de ${d.periodo} vence pronto.`,
      titulo: "Tu factura vence pronto",
      parrafos: [["La factura de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), " vence el ", n(d.vence), "."]],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
      nota: ["Si ya la pagaste, respondé este mail con el comprobante y la registramos."],
    }),
  },
  M52: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: `Tu factura de ${minuscula(d.periodo)} ${d.segundoAviso ? "sigue vencida" : "está vencida"}`,
      previa: `La factura de ${d.periodo} de ${d.institucion} está vencida.`,
      titulo: "Tu factura está vencida",
      parrafos: [["La factura de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), " venció el ", n(d.vencio), "."]],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
      nota: ["Si ya la pagaste, respondé este mail con el comprobante y la registramos. Si necesitás otra fecha, escribinos."],
    }),
  },
  M53: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: `Recibimos tu pago de ${minuscula(d.periodo)}`,
      previa: `Registramos el pago de ${d.periodo}.`,
      titulo: "Recibimos tu pago",
      parrafos: [["Registramos el pago de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), ". ¡Gracias!"]],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
    }),
  },
  M54: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: `Corregimos el registro de tu pago de ${minuscula(d.periodo)}`,
      previa: `Anulamos el pago registrado de ${d.periodo}.`,
      titulo: "Corregimos el registro de tu pago",
      parrafos: [
        ["Anulamos el registro del pago de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), ", que se había cargado por error."],
        ["Podés ver cómo quedó tu factura en la sección Plan."],
      ],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
      nota: ["Si algo no te cierra, respondé este mail."],
    }),
  },
  M55: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: "Recibimos tu pedido de cambio de plan",
      previa: `Pediste cambiar al plan ${d.plan}.`,
      titulo: "Recibimos tu pedido de cambio de plan",
      parrafos: [
        [n(d.institucion), " pidió cambiar al plan ", n(d.plan), "."],
        ["Lo revisamos y te avisamos por acá cuando esté resuelto."],
      ],
      boton: { texto: "Ver mi plan", ruta: "/institucion/plan" },
    }),
  },
  M56: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: d.aprobado ? `Aprobamos tu cambio al plan ${d.plan}` : "No pudimos aprobar tu cambio de plan",
      previa: d.aprobado ? `${d.institucion} ya está en el plan ${d.plan}.` : `Tu pedido de pasar al plan ${d.plan} no se aprobó.`,
      titulo: d.aprobado ? "Aprobamos tu cambio de plan" : "No pudimos aprobar tu cambio de plan",
      parrafos: d.aprobado
        ? [[n(d.institucion), " ya está en el plan ", n(d.plan), "."], ...(d.detalle ? [[d.detalle]] : []), ...(d.nota ? [["Una nota de nuestro equipo:"]] : [])]
        : [["No pudimos aprobar el pedido de ", n(d.institucion), " para pasar al plan ", n(d.plan), "."], ["El motivo:"]],
      cita: d.nota ?? undefined,
      boton: { texto: "Ver mi plan", ruta: "/institucion/plan" },
      nota: d.aprobado ? undefined : ["Si querés hablarlo, respondé este mail."],
    }),
  },

  /* ───────── Internos (llegan al equipo de UNIDOAR) ───────── */
  M60: {
    grupo: "interno",
    remitente: "app",
    // Cualquiera puede escribir en Contacto: un tope general evita que el formulario llene la casilla del equipo.
    tope: { max: 20, horas: 1 },
    responderA: (d) => d.email,
    contenido: (d) => ({
      asunto: `Contacto: ${d.nombre}`,
      previa: d.mensaje.slice(0, 120),
      titulo: "Mensaje nuevo desde Contacto",
      parrafos: [[n(d.nombre), " (", d.email, d.rol ? `, ${d.rol}` : "", ") escribió:"]],
      cita: d.mensaje,
      boton: { texto: "Abrir en el backoffice", ruta: "/backoffice/mensajes" },
      nota: ["Si respondés a este mail, la respuesta le llega a la persona."],
    }),
  },
  M61: {
    grupo: "interno",
    remitente: "app",
    tope: { max: 30, horas: 1 },
    contenido: (d) => ({
      asunto: `${d.docente} subió documentación para revisar`,
      previa: d.detalle,
      titulo: "Documentación para revisar",
      parrafos: [[n(d.docente), " ", d.detalle]],
      boton: { texto: "Revisar", ruta: d.ruta },
    }),
  },
  M62: {
    grupo: "interno",
    remitente: "app",
    contenido: (d) => ({
      asunto: `${d.cuenta} pidió la baja`,
      previa: `Pedido de baja de ${d.tipo}.`,
      titulo: "Pedido de baja",
      parrafos: [[n(d.cuenta), " (", d.tipo, ") pidió dar de baja su cuenta."]],
      boton: { texto: "Verlo en el backoffice", ruta: d.ruta },
    }),
  },
  M63: {
    grupo: "interno",
    remitente: "app",
    contenido: (d) => ({
      asunto: `${d.institucion} pidió cambiar de plan`,
      previa: `Pidió pasar al plan ${d.plan}.`,
      titulo: "Pedido de cambio de plan",
      parrafos: [[n(d.institucion), " pidió pasar al plan ", n(d.plan), "."]],
      boton: { texto: "Verlo en el backoffice", ruta: d.ruta },
    }),
  },
};

export const esPlantilla = (id: string): id is PlantillaId => Object.hasOwn(PLANTILLAS, id);

/* ───────────────────────────── Armado ───────────────────────────── */

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escaparHtml = (texto: string) => texto.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** Un asunto va en una sola línea (un salto de línea abriría la puerta a meter cabeceras) y no muy largo. */
export function limpiarAsunto(asunto: string) {
  const plano = asunto.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return plano.length > 150 ? `${plano.slice(0, 147).trimEnd()}…` : plano;
}

/** Una ruta interna ("/docente/perfil#x") a URL completa. Cualquier otra cosa (otro sitio, "//host", "javascript:") se rechaza. */
export function urlInterna(origen: string, ruta: string): string {
  if (!ruta.startsWith("/") || ruta.startsWith("//") || ruta.includes("\\") || /[\u0000-\u001f]/.test(ruta)) {
    throw new Error(`Ruta no permitida en un mail: ${ruta.slice(0, 40)}`);
  }
  const base = origen.replace(/\/+$/, "");
  const url = new URL(ruta, `${base}/`);
  if (url.origin !== new URL(base).origin) throw new Error(`Ruta no permitida en un mail: ${ruta.slice(0, 40)}`);
  return url.toString();
}

const textoDe = (partes: Parte[]) => partes.map((p) => (typeof p === "string" ? p : p.negrita)).join("");
const htmlDe = (partes: Parte[]) => partes.map((p) => (typeof p === "string" ? escaparHtml(p) : `<b>${escaparHtml(p.negrita)}</b>`)).join("");

const MOTIVO_POR_GRUPO: Record<GrupoCorreo, string> = {
  cuenta: "Te escribimos porque tenés una cuenta en UNIDOAR. Este aviso es parte del funcionamiento de tu cuenta.",
  contratacion: "Recibís este aviso porque tenés una cuenta en UNIDOAR.",
  facturacion: "Recibís este mail porque sos parte del equipo de una institución en UNIDOAR. Los avisos de facturación no se pueden desactivar.",
  interno: "Aviso interno del equipo de UNIDOAR.",
};

export type ContextoDeArmado = {
  origen: string;
  /** Ruta de la página de baja de esa cuenta (solo para los mails opcionales). */
  rutaDeBaja?: string | null;
};

export type MailArmado = {
  asunto: string;
  html: string;
  texto: string;
  /** URL completa de la baja, si el mail la lleva. */
  urlDeBaja: string | null;
};

const ESTILO_PARRAFO = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#3D423E;";

export function armarMail<P extends PlantillaId>(id: P, datos: DatosDe[P], contexto: ContextoDeArmado): MailArmado {
  const definicion = PLANTILLAS[id] as Definicion<P>;
  const c = definicion.contenido(datos);
  const origen = contexto.origen.replace(/\/+$/, "");
  const urlBoton = c.boton ? urlInterna(origen, c.boton.ruta) : null;
  const urlDeBaja = esGrupoOpcional(definicion.grupo) && contexto.rutaDeBaja ? urlInterna(origen, contexto.rutaDeBaja) : null;
  const motivo = c.motivo ?? MOTIVO_POR_GRUPO[definicion.grupo];
  const asunto = limpiarAsunto(c.asunto);

  const parrafos = c.parrafos.map((p) => `        <p style="${ESTILO_PARRAFO}">${htmlDe(p)}</p>`).join("\n");
  const cita = c.cita
    ? `        <blockquote style="margin:0 0 20px;padding:12px 16px;background:#F6F5F1;border-left:4px solid #DD553F;border-radius:6px;font-size:15px;line-height:1.6;color:#3D423E;white-space:pre-wrap;">${escaparHtml(c.cita)}</blockquote>`
    : "";
  const boton =
    c.boton && urlBoton
      ? `        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td style="background:#DD553F;border-radius:10px;">
          <a href="${escaparHtml(urlBoton)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${escaparHtml(c.boton.texto)}</a>
        </td></tr></table>
        <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#6B706C;">Si el botón no anda, copiá y pegá este enlace en tu navegador:</p>
        <p style="margin:0 0 22px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escaparHtml(urlBoton)}" style="color:#16214F;">${escaparHtml(urlBoton)}</a></p>`
      : "";
  const nota = c.nota ? `        <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#6B706C;">${htmlDe(c.nota)}</p>` : "";
  const baja = urlDeBaja
    ? `<br><a href="${escaparHtml(urlDeBaja)}" style="color:#6B706C;">Dejar de recibir avisos por mail</a> (los de tu cuenta y de facturación te siguen llegando)`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escaparHtml(asunto)}</title>
</head>
<body style="margin:0;padding:0;background:#F6F5F1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escaparHtml(c.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1;padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E3E1DC;">
      <tr><td align="center" style="background:#16214F;padding:22px 24px;">
        <img src="${escaparHtml(origen)}/assets/unidoar-logo-horizontal.png" alt="UNIDOAR" width="150" style="display:block;border:0;height:auto;max-width:150px;">
      </td></tr>
      <tr><td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;color:#1F2421;">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#16214F;">${escaparHtml(c.titulo)}</h1>
${parrafos}
${cita}
${boton}
${nota}
      </td></tr>
      <tr><td style="padding:16px 32px 26px;border-top:1px solid #F0EFEA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9AA09B;">
        ${escaparHtml(motivo)}${baja}<br>
        UNIDOAR · Docentes, entrenadores y guardavidas verificados · <a href="${escaparHtml(origen)}" style="color:#9AA09B;">${escaparHtml(origen.replace(/^https?:\/\//, ""))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;

  const lineas = [
    c.titulo,
    "",
    ...c.parrafos.map((p) => textoDe(p)),
    ...(c.cita ? ["", ...c.cita.split(/\r?\n/).map((l) => `> ${l}`), ""] : []),
    ...(c.boton && urlBoton ? [`${c.boton.texto}: ${urlBoton}`] : []),
    ...(c.nota ? ["", textoDe(c.nota)] : []),
    "",
    "--",
    motivo,
    ...(urlDeBaja ? [`Dejar de recibir avisos por mail: ${urlDeBaja}`] : []),
    `UNIDOAR · ${origen}`,
  ];

  return { asunto, html, texto: lineas.join("\n"), urlDeBaja };
}
