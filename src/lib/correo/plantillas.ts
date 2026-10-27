import type { Remitente } from "./config";
import { rutaParaResponder } from "@/lib/entrevista-respuesta";
import { DIAS_DE_GRACIA, QUE_SE_LIMITA } from "@/lib/mora";

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
  /** `debitoCancelado` (solo instituciones): al suspender el equipo canceló también su débito automático. */
  M15: { nombre: string | null; institucion: string | null; motivo: string | null; debitoCancelado?: boolean };
  /** El equipo levantó la suspensión. Mismos datos que M15 (sin el motivo): profesional con `nombre`, institución con `institucion`. */
  /** `debitoCancelado` (solo instituciones): el débito automático sigue cancelado, así que se lo recuerda para que lo active de nuevo. */
  M16: { nombre: string | null; institucion: string | null; debitoCancelado?: boolean };
  M20: { institucion: string; puesto: string; ruta: string };
  M21: { institucion: string; puesto: string; zona: string | null; plazo: string | null; ruta: string };
  M23: { institucion: string; puesto: string; ruta: string };
  M24: { institucion: string; puesto: string; cuando: string; titulo: string | null; ruta: string };
  M25: { institucion: string; puesto: string; ruta: string };
  M26: { institucion: string; puesto: string; ruta: string };
  M27: { institucion: string; puesto: string; inicio: string | null; ruta: string };
  M30: { busqueda: string; rapida: boolean; ruta: string };
  M50: { institucion: string; periodo: string; monto: string; vence: string };
  M51: { institucion: string; periodo: string; monto: string; vence: string };
  /** `segundoAviso`: ya pasó más de una semana del vencimiento. */
  /** `ultimoDiaDeGracia`: hasta cuándo puede pagar antes de que se limite la cuenta (ver src/lib/mora.ts). */
  M52: { institucion: string; periodo: string; monto: string; vencio: string; segundoAviso: boolean; ultimoDiaDeGracia: string };
  /**
   * El pago registrado. Con `comprobante` el mail es el comprobante (los datos de la factura en una tabla y el enlace a la hoja de la app); sin él es solo
   * el aviso: la compra de una búsqueda puntual no es una factura y no tiene comprobante.
   */
  M53: {
    institucion: string;
    periodo: string;
    monto: string;
    comprobante?: { numero: string; plan: string; medio: string | null; pagadoEl: string; ruta: string };
  };
  M54: { institucion: string; periodo: string; monto: string };
  M55: { institucion: string; plan: string };
  /** `detalle`: lo que pasó con la factura del mes (la crearon, la ajustaron…), ya redactado. */
  M56: { institucion: string; plan: string; aprobado: boolean; nota: string | null; detalle: string | null };
  /** Mercado Pago no pudo cobrar el débito automático del mes (solo el primer rechazo de cada cobro; los reintentos avisan en la campanita). */
  M58: { institucion: string; periodo: string; monto: string };
  M60: { nombre: string; email: string; rol: string | null; mensaje: string };
  M61: { docente: string; detalle: string; ruta: string };
  M62: { cuenta: string; tipo: string; ruta: string };
  M63: { institucion: string; plan: string; ruta: string };
  /** Una institución eligió pagar el abono por semestre (al crear la cuenta o desde Plan y facturación): el equipo coordina el pago y lo registra. */
  M67: { institucion: string; total: string; meses: number; alCrearLaCuenta: boolean; ruta: string };
  /**
   * Mora (ver src/lib/mora.ts): `limitada: false` es el último aviso (quedan pocos días de gracia) y `limitada: true` avisa que la gracia terminó y la
   * cuenta quedó limitada. Una vez por factura y etapa.
   */
  M68: { institucion: string; limitada: boolean; periodo: string; monto: string; vencio: string; ultimoDiaDeGracia: string };
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
  /** Una tabla de datos (etiqueta y valor) debajo de los párrafos: el comprobante de un pago. */
  detalle?: { titulo: string; filas: { etiqueta: string; valor: string }[] };
  /** Texto de una persona (motivo, mensaje) que se muestra citado, respetando los saltos de línea. */
  cita?: string;
  boton?: { texto: string; ruta: string };
  /** Botones secundarios (con borde), debajo del principal: p. ej. "No puedo" y "Ver en la plataforma" en la entrevista. */
  otrosBotones?: { texto: string; ruta: string }[];
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

/** "docente" → "profesional", "institucion" → "institución": cómo se nombra a quien pide la baja en lo que lee el equipo. */
const tipoDeCuenta = (tipo: string) => (tipo === "docente" ? "profesional" : tipo === "institucion" ? "institución" : tipo);

const minuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

export const PLANTILLAS: { [P in PlantillaId]: Definicion<P> } = {
  /* ───────── Cuenta ───────── */
  M06: {
    grupo: "cuenta",
    remitente: "app",
    // Por destinatario (ver `topeClave` en `invitarMiembro`): nadie recibe más de 3 invitaciones al día, la manden las instituciones que la manden.
    tope: { max: 3, horas: 24 },
    contenido: (d) => ({
      asunto: `${d.institucion} te invitó a sumarte a su equipo en UNIDOAR`,
      previa: `Te invitaron a ser parte del equipo de ${d.institucion}.`,
      titulo: `Te invitaron a sumarte a ${d.institucion}`,
      parrafos: [
        [d.invitadoPor ? n(d.invitadoPor) : "Una persona del equipo", " te invitó a ser parte del equipo de ", n(d.institucion), " en UNIDOAR, con el rol de ", n(d.rol), "."],
        ["Para aceptar, entrá al enlace y creá tu acceso con este mismo email: ", n(d.email), ". Cuando entres, vas a poder aceptar la invitación o rechazarla."],
      ],
      boton: { texto: "Aceptar la invitación", ruta: d.ruta },
      nota: ["Si no esperabas esta invitación, ignorá este mail: no te sumamos a ningún equipo si no la aceptás, y la invitación vence sola a los 30 días."],
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
        ["Ya eliminamos las fotos de tu DNI: solo conservamos el número, como constancia de lo que verificamos."],
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
        [
          d.institucion
            ? "Mientras esté suspendida el equipo no puede usar la plataforma ni la institución aparece en las búsquedas de los profesionales."
            : "Mientras esté suspendida no podés usar la plataforma ni aparecés en las búsquedas de las instituciones.",
          " Escribinos para ver cómo regularizarla.",
        ],
        ...(d.institucion && d.debitoCancelado
          ? [["También cancelamos el débito automático de tu plan: Mercado Pago no te va a cobrar mientras la cuenta esté suspendida. Cuando la reactivemos, podés activarlo de nuevo desde Plan y facturación."]]
          : []),
        // El motivo va al final, justo antes de la cita que lo muestra: así "El motivo:" encabeza lo que sigue.
        ...(d.motivo ? [["El motivo:"]] : []),
      ],
      cita: d.motivo ?? undefined,
      boton: { texto: "Escribirnos", ruta: "/contacto" },
    }),
  },
  M16: {
    grupo: "cuenta",
    remitente: "app",
    contenido: (d) => ({
      asunto: "Reactivamos tu cuenta de UNIDOAR",
      previa: "Tu cuenta de UNIDOAR volvió a estar activa.",
      titulo: "Reactivamos tu cuenta",
      parrafos: [
        d.institucion
          ? ["Hola: reactivamos la cuenta de ", n(d.institucion), " en UNIDOAR. El equipo ya puede volver a entrar y usar la plataforma con normalidad."]
          : ["Hola", d.nombre ? " " : "", d.nombre ? n(d.nombre) : "", ": reactivamos tu cuenta en UNIDOAR. Ya podés volver a entrar y volvés a aparecer en las búsquedas de las instituciones."],
        ...(d.institucion && d.debitoCancelado
          ? [["Tu débito automático sigue cancelado: si querés volver a pagar con débito, activalo de nuevo desde Plan y facturación."]]
          : []),
      ],
      boton: { texto: "Entrar a UNIDOAR", ruta: d.institucion ? "/institucion/dashboard" : "/docente/dashboard" },
    }),
  },

  /* ───────── Contratación: para el docente ───────── */
  M20: {
    grupo: "contratacion",
    remitente: "app",
    // Por persona (ver `topeClave` en `correoDeInvitacion`): cualquier institución puede invitar, y el asunto lleva su nombre y el puesto
    // que escribió. Sin un tope, una cuenta nueva podía llenarle la casilla a un profesional con el dominio de UNIDOAR.
    tope: { max: 5, horas: 24 },
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
      boton: { texto: "Voy a ir", ruta: rutaParaResponder(d.ruta, "voy") },
      otrosBotones: [
        { texto: "No puedo ir", ruta: rutaParaResponder(d.ruta, "no_puedo") },
        { texto: "Ver en la plataforma", ruta: d.ruta },
      ],
      nota: [
        "Los botones te llevan a tu postulación en UNIDOAR: ahí confirmás con un toque y, si no podés, le contás a la institución qué día te queda bien.",
      ],
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

  /* ───────── Contratación: para la institución ───────── */
  M30: {
    grupo: "contratacion",
    remitente: "app",
    contenido: (d) => ({
      asunto: `Tenés postulantes nuevos en ${d.busqueda}`,
      previa: `Hay profesionales que se postularon a ${d.busqueda}.`,
      titulo: "Tenés postulantes nuevos",
      parrafos: [
        ["Se postularon profesionales a tu búsqueda ", n(d.busqueda), ". Revisalos y movelos por las etapas del tablero."],
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
      parrafos: [
        ["La factura de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), " venció el ", n(d.vencio), "."],
        [
          "Tenés tiempo hasta el ",
          n(d.ultimoDiaDeGracia),
          `: pasada esa fecha, si el pago no se acreditó, no vas a poder ${QUE_SE_LIMITA} hasta que se regularice. Lo demás de tu cuenta sigue funcionando.`,
        ],
      ],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
      nota: ["Si ya la pagaste, respondé este mail con el comprobante y la registramos. Si necesitás otra fecha, escribinos."],
    }),
  },
  M68: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) =>
      d.limitada
        ? {
            asunto: "Tu cuenta está limitada por una factura vencida",
            previa: `La factura de ${d.periodo} sigue vencida y la cuenta quedó limitada.`,
            titulo: "Tu cuenta está limitada",
            parrafos: [
              ["La factura de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), " venció el ", n(d.vencio), " y pasaron más de ", String(DIAS_DE_GRACIA), " días."],
              [`Hasta que se acredite el pago no podés ${QUE_SE_LIMITA}. Lo demás de tu cuenta sigue funcionando, y apenas registremos el pago se levanta sola.`],
            ],
            boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
            nota: ["Si ya la pagaste, respondé este mail con el comprobante y la registramos. Si necesitás otra fecha, escribinos."],
          }
        : {
            asunto: `Tu cuenta se limita después del ${d.ultimoDiaDeGracia}`,
            previa: `Último aviso: pagá la factura de ${d.periodo} antes del ${d.ultimoDiaDeGracia}.`,
            titulo: "Último aviso antes de limitar tu cuenta",
            parrafos: [
              ["La factura de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), " venció el ", n(d.vencio), " y sigue sin pagarse."],
              [
                "Si el pago no se acredita hasta el ",
                n(d.ultimoDiaDeGracia),
                `, tu cuenta queda limitada: no vas a poder ${QUE_SE_LIMITA} hasta que se regularice. Lo demás sigue funcionando.`,
              ],
            ],
            boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
            nota: ["Si ya la pagaste, respondé este mail con el comprobante y la registramos. Si necesitás otra fecha, escribinos."],
          },
  },
  M53: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => {
      const c = d.comprobante;
      if (!c) {
        return {
          asunto: `Recibimos tu pago de ${minuscula(d.periodo)}`,
          previa: `Registramos el pago de ${d.periodo}.`,
          titulo: "Recibimos tu pago",
          parrafos: [["Registramos el pago de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), ". ¡Gracias!"]],
          boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
        };
      }
      return {
        asunto: `Comprobante de tu pago de ${minuscula(d.periodo)}`,
        previa: `Comprobante N.º ${c.numero} por ${d.monto}.`,
        titulo: "Recibimos tu pago",
        parrafos: [
          ["Registramos el pago de ", n(d.periodo), " de ", n(d.institucion), " por ", n(d.monto), ". ¡Gracias!"],
          ["Acá abajo está el comprobante. También lo podés ver, imprimir o guardar como PDF cuando quieras desde tu cuenta."],
        ],
        detalle: {
          titulo: "Comprobante de pago",
          filas: [
            { etiqueta: "N.º", valor: c.numero },
            { etiqueta: "Institución", valor: d.institucion },
            { etiqueta: "Plan", valor: c.plan },
            { etiqueta: "Período", valor: d.periodo },
            { etiqueta: "Monto", valor: d.monto },
            ...(c.medio ? [{ etiqueta: "Medio de pago", valor: c.medio }] : []),
            { etiqueta: "Pagado el", valor: c.pagadoEl },
          ],
        },
        boton: { texto: "Ver el comprobante", ruta: c.ruta },
        nota: ["Guardalo para tu administración. Si algún dato no está bien, respondé este mail."],
      };
    },
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

  M58: {
    grupo: "facturacion",
    remitente: "facturacion",
    contenido: (d) => ({
      asunto: `No pudimos cobrar tu débito automático de ${minuscula(d.periodo)}`,
      previa: "Mercado Pago no pudo cobrar tu plan. Revisá tu medio de pago.",
      titulo: "No pudimos cobrar tu débito automático",
      parrafos: [
        ["Mercado Pago no pudo cobrar el plan de ", n(d.institucion), " de ", n(d.periodo), " (", n(d.monto), ") en la tarjeta que autorizaste. Lo va a volver a intentar en los próximos días."],
        ["Para que no se corte, revisá que la tarjeta tenga saldo y esté vigente, o cambiá el medio de pago desde tu cuenta de Mercado Pago."],
      ],
      boton: { texto: "Ver mi plan y mis facturas", ruta: "/institucion/plan" },
      nota: ["Si ya lo resolviste, no tenés que hacer nada: cuando Mercado Pago logre cobrar, te avisamos."],
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
    // Un tope general: pedir y retirar la baja en un bucle no puede llenar la casilla del equipo.
    tope: { max: 30, horas: 24 },
    contenido: (d) => ({
      asunto: `${d.cuenta} pidió la baja`,
      previa: `Pedido de baja de ${tipoDeCuenta(d.tipo)}.`,
      titulo: "Pedido de baja",
      parrafos: [[n(d.cuenta), " (", tipoDeCuenta(d.tipo), ") pidió dar de baja su cuenta."]],
      boton: { texto: "Verlo en el backoffice", ruta: d.ruta },
    }),
  },
  M63: {
    grupo: "interno",
    remitente: "app",
    // Un tope general: pedir y cancelar un cambio de plan en un bucle no puede llenar la casilla del equipo.
    tope: { max: 30, horas: 24 },
    contenido: (d) => ({
      asunto: `${d.institucion} pidió cambiar de plan`,
      previa: `Pidió pasar al plan ${d.plan}.`,
      titulo: "Pedido de cambio de plan",
      parrafos: [[n(d.institucion), " pidió pasar al plan ", n(d.plan), "."]],
      boton: { texto: "Verlo en el backoffice", ruta: d.ruta },
    }),
  },
  M67: {
    grupo: "interno",
    remitente: "app",
    // Un tope general: elegir y deshacer el semestre en un bucle no puede llenar la casilla del equipo.
    tope: { max: 30, horas: 24 },
    contenido: (d) => ({
      asunto: `${d.institucion} eligió pagar por semestre`,
      previa: `Semestre de ${d.total} (${d.meses} meses).`,
      titulo: "Pago por semestre",
      parrafos: [
        [
          n(d.institucion),
          d.alCrearLaCuenta ? " eligió pagar el abono por semestre al crear su cuenta: " : " pidió pagar el abono por semestre: ",
          n(d.total),
          ` por ${d.meses} meses.`,
        ],
        [
          d.alCrearLaCuenta ? "Cuando verifiques la cuenta, coordiná" : "Coordiná",
          " el pago con la institución (transferencia o efectivo) y registralo en su ficha de cobros con «Registrar semestre al contado».",
        ],
      ],
      boton: { texto: "Abrir sus cobros", ruta: d.ruta },
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

/**
 * El logo de la cabecera de los mails es el de la web (isotipo con «UNIDOAR», `LogoMarca`) hecho imagen: `public/assets/unidoar-logo-mail.png`, sobre el mismo
 * azul de la cabecera del sitio. Se genera con `pnpm logo:correo` cuando cambia el de la web. Mide 660 px de ancho y se muestra a 220 (nítido en pantallas de
 * alta densidad). Las 13 plantillas de Supabase Auth (`supabase/plantillas-correo/`) llevan el mismo.
 */
const ANCHO_DEL_LOGO = 220;

export function armarMail<P extends PlantillaId>(id: P, datos: DatosDe[P], contexto: ContextoDeArmado): MailArmado {
  const definicion = PLANTILLAS[id] as Definicion<P>;
  const c = definicion.contenido(datos);
  const origen = contexto.origen.replace(/\/+$/, "");
  const urlBoton = c.boton ? urlInterna(origen, c.boton.ruta) : null;
  const urlDeBaja = esGrupoOpcional(definicion.grupo) && contexto.rutaDeBaja ? urlInterna(origen, contexto.rutaDeBaja) : null;
  const motivo = c.motivo ?? MOTIVO_POR_GRUPO[definicion.grupo];
  const asunto = limpiarAsunto(c.asunto);

  const parrafos = c.parrafos.map((p) => `        <p style="${ESTILO_PARRAFO}">${htmlDe(p)}</p>`).join("\n");
  const detalle = c.detalle
    ? `        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid #E3E1DC;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <tr><td colspan="2" style="padding:10px 16px;background:#F6F5F1;font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#6B706C;">${escaparHtml(c.detalle.titulo)}</td></tr>
${c.detalle.filas
  .map(
    (f) => `          <tr><td style="padding:9px 16px;border-top:1px solid #F0EFEA;width:38%;font-size:13px;line-height:1.4;color:#6B706C;">${escaparHtml(f.etiqueta)}</td><td style="padding:9px 16px;border-top:1px solid #F0EFEA;font-size:14px;line-height:1.4;font-weight:bold;color:#1F2421;">${escaparHtml(f.valor)}</td></tr>`,
  )
  .join("\n")}
        </table>`
    : "";
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
  const otros = (c.otrosBotones ?? []).map((b) => ({ texto: b.texto, url: urlInterna(origen, b.ruta) }));
  const otrosBotones = otros.length
    ? `        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:-10px 0 22px;"><tr>
${otros
  .map(
    (b) => `          <td style="padding:0 8px 8px 0;"><a href="${escaparHtml(b.url)}" style="display:inline-block;padding:11px 20px;border:1.5px solid #16214F;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#16214F;text-decoration:none;">${escaparHtml(b.texto)}</a></td>`,
  )
  .join("\n")}
        </tr></table>`
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
      <tr><td align="center" style="background:#040B35;padding:22px 24px;">
        <img src="${escaparHtml(origen)}/assets/unidoar-logo-mail.png" alt="UNIDOAR" width="${ANCHO_DEL_LOGO}" style="display:block;border:0;height:auto;max-width:${ANCHO_DEL_LOGO}px;">
      </td></tr>
      <tr><td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;color:#1F2421;">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#16214F;">${escaparHtml(c.titulo)}</h1>
${parrafos}
${detalle}
${cita}
${boton}
${otrosBotones}
${nota}
      </td></tr>
      <tr><td style="padding:16px 32px 26px;border-top:1px solid #F0EFEA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9AA09B;">
        ${escaparHtml(motivo)}${baja}<br>
        UNIDOAR · Educadores, entrenadores y guardavidas verificados · <a href="${escaparHtml(origen)}" style="color:#9AA09B;">${escaparHtml(origen.replace(/^https?:\/\//, ""))}</a>
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
    ...(c.detalle ? ["", c.detalle.titulo.toUpperCase(), ...c.detalle.filas.map((f) => `${f.etiqueta}: ${f.valor}`), ""] : []),
    ...(c.cita ? ["", ...c.cita.split(/\r?\n/).map((l) => `> ${l}`), ""] : []),
    ...(c.boton && urlBoton ? [`${c.boton.texto}: ${urlBoton}`] : []),
    ...otros.map((b) => `${b.texto}: ${b.url}`),
    ...(c.nota ? ["", textoDe(c.nota)] : []),
    "",
    "--",
    motivo,
    ...(urlDeBaja ? [`Dejar de recibir avisos por mail: ${urlDeBaja}`] : []),
    `UNIDOAR · ${origen}`,
  ];

  return { asunto, html, texto: lineas.join("\n"), urlDeBaja };
}
