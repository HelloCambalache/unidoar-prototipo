/*
 * Plantillas de los avisos por WhatsApp. Sin base ni red.
 *
 * WhatsApp solo deja escribirle a alguien que no nos escribió primero con una plantilla que Meta ya aprobó. Cada plantilla se crea UNA vez en
 * WhatsApp Manager (docs/whatsapp.md trae el texto exacto, listo para copiar) y acá está la misma definición: el nombre, el idioma, el texto con
 * sus variables ({{1}}, {{2}}…) y el botón. Si se cambia el texto acá hay que crear otra plantilla en Meta (una aprobada no se edita sin volver a
 * revisarla): por eso las pruebas comparan esto contra lo que dice la guía.
 *
 * Categoría «utilidad»: avisos de algo que la persona ya pidió o hizo (su postulación, su entrevista, su búsqueda). Nada de promociones: Meta cobra
 * más por marketing y rechaza una plantilla de utilidad que suena a publicidad.
 */

/** Código de idioma de las plantillas: «Español (Argentina)». */
export const IDIOMA_DE_PLANTILLAS = "es_AR";
export const CATEGORIA_DE_PLANTILLAS = "UTILITY";

/** El sitio al que lleva el botón de cada aviso. Es parte de lo que Meta aprobó (la plantilla lleva `https://…/{{1}}`): no sale del entorno. */
export const ORIGEN_DE_LOS_BOTONES = "https://www.unidoar.com.ar";

export type DestinatarioDeAviso = "docente" | "institucion";

export type DefinicionDePlantilla = {
  /** Nombre en Meta: minúsculas, números y guion bajo. */
  nombre: string;
  destinatario: DestinatarioDeAviso;
  /** Texto del cuerpo, con {{1}}, {{2}}… en orden. */
  cuerpo: string;
  /** Qué es cada variable, en orden. */
  variables: readonly string[];
  /** Un valor de ejemplo por variable (Meta los pide para aprobar la plantilla). */
  ejemplos: readonly string[];
  boton: { texto: string; ejemploDeRuta: string };
};

export const PLANTILLAS_WA = {
  unidoar_preseleccion: {
    nombre: "unidoar_preseleccion",
    destinatario: "docente",
    cuerpo: "Novedad en tu postulación: {{1}} te preseleccionó para el puesto «{{2}}». Entrá a UNIDOAR para ver el detalle.",
    variables: ["institucion", "puesto"],
    ejemplos: ["Colegio San Andrés", "Profesor de Educación Física"],
    boton: { texto: "Ver postulación", ejemploDeRuta: "docente/postulaciones?abrir=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42" },
  },
  unidoar_entrevista: {
    nombre: "unidoar_entrevista",
    destinatario: "docente",
    cuerpo: "Tenés una entrevista con {{1}} para el puesto «{{2}}»: {{3}}. Entrá a UNIDOAR para confirmar si podés ir.",
    variables: ["institucion", "puesto", "cuando"],
    ejemplos: ["Colegio San Andrés", "Profesor de Educación Física", "martes 12 de noviembre, 15:30"],
    boton: { texto: "Ver entrevista", ejemploDeRuta: "docente/postulaciones?abrir=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42" },
  },
  unidoar_oferta: {
    nombre: "unidoar_oferta",
    destinatario: "docente",
    cuerpo: "Novedad en tu postulación: {{1}} te hizo una oferta para el puesto «{{2}}». Entrá a UNIDOAR para revisarla y responder.",
    variables: ["institucion", "puesto"],
    ejemplos: ["Colegio San Andrés", "Profesor de Educación Física"],
    boton: { texto: "Ver oferta", ejemploDeRuta: "docente/postulaciones?abrir=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42" },
  },
  unidoar_postulantes: {
    nombre: "unidoar_postulantes",
    destinatario: "institucion",
    cuerpo: "Recibiste una postulación nueva para tu búsqueda «{{1}}». Entrá a UNIDOAR para ver el detalle.",
    variables: ["puesto"],
    ejemplos: ["Profesor de Educación Física"],
    boton: { texto: "Ver postulantes", ejemploDeRuta: "institucion/postulantes?busqueda=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42" },
  },
  unidoar_respuesta_entrevista: {
    nombre: "unidoar_respuesta_entrevista",
    destinatario: "institucion",
    cuerpo: "Novedad en tu entrevista para «{{1}}»: {{2}} {{3}}. Entrá a UNIDOAR para ver el detalle.",
    variables: ["puesto", "profesional", "respuesta"],
    ejemplos: ["Profesor de Educación Física", "María Gómez", "confirmó que va"],
    boton: { texto: "Ver postulantes", ejemploDeRuta: "institucion/postulantes?busqueda=2f6c1a9e-7b1d-4c3e-9a55-0d8f3b7c1e42" },
  },
} as const satisfies Record<string, DefinicionDePlantilla>;

export type NombreDePlantilla = keyof typeof PLANTILLAS_WA;

export const esPlantillaDeWhatsapp = (nombre: string): nombre is NombreDePlantilla => Object.hasOwn(PLANTILLAS_WA, nombre);

/** Lo que se guarda en la cola de cada aviso: los valores de las variables (en orden) y la ruta a la que lleva el botón (sin la barra del principio). */
export type DatosDeAviso = { variables: string[]; ruta: string };

/** Cuántos caracteres puede tener cada valor: el cuerpo entero no puede pasar de 1024 y un título larguísimo no tiene que romper el aviso. */
export const MAX_CARACTERES_POR_VALOR = 60;

/**
 * Deja un valor listo para ir en una plantilla. Meta rechaza un parámetro con saltos de línea, tabulaciones o más de 4 espacios seguidos, y no
 * acepta uno vacío: se juntan los espacios, se recorta con «…» si es muy largo y, si queda vacío, se usa `respaldo`.
 */
export function limpiarValor(texto: string | null | undefined, respaldo = "—"): string {
  const limpio = (texto ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (limpio === "") return respaldo;
  return limpio.length > MAX_CARACTERES_POR_VALOR ? `${limpio.slice(0, MAX_CARACTERES_POR_VALOR - 1).trimEnd()}…` : limpio;
}

/** La ruta del botón: relativa, sin barra al principio (la plantilla ya lleva el sitio) y de un solo tramo seguro. Lanza si no sirve. */
export function rutaDeBoton(ruta: string): string {
  const limpia = ruta.replace(/^\/+/, "");
  if (limpia === "" || limpia.length > 200 || /[\s\u0000-\u001f#]|\.\./.test(limpia) || /^[a-z][a-z0-9+.-]*:/i.test(limpia)) {
    throw new Error("La ruta del botón no es válida.");
  }
  return limpia;
}

/** Arma los datos que se anotan en la cola para una plantilla: valida cuántas variables lleva y las limpia. */
export function datosDeAviso(nombre: NombreDePlantilla, valores: readonly (string | null | undefined)[], ruta: string): DatosDeAviso {
  const definicion = PLANTILLAS_WA[nombre];
  if (valores.length !== definicion.variables.length) {
    throw new Error(`La plantilla ${nombre} lleva ${definicion.variables.length} valores y llegaron ${valores.length}.`);
  }
  return { variables: valores.map((v) => limpiarValor(v)), ruta: rutaDeBoton(ruta) };
}

/** El mensaje tal como lo va a leer la persona (para la consola y las pruebas): el texto con sus variables ya puestas. */
export function textoDeAviso(nombre: NombreDePlantilla, variables: readonly string[]): string {
  return PLANTILLAS_WA[nombre].cuerpo.replace(/\{\{(\d+)\}\}/g, (_todo, n: string) => variables[Number(n) - 1] ?? "");
}

/** La parte `template` del pedido a la API de Meta para mandar este aviso. */
export function cargaDeLaPlantilla(nombre: NombreDePlantilla, datos: DatosDeAviso) {
  return {
    name: PLANTILLAS_WA[nombre].nombre,
    language: { code: IDIOMA_DE_PLANTILLAS },
    components: [
      { type: "body", parameters: datos.variables.map((text) => ({ type: "text", text })) },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: datos.ruta }] },
    ],
  };
}

/** Cuántas variables usa un cuerpo, y si están en orden 1, 2, 3… sin saltos ni repetidas. */
export function variablesDelCuerpo(cuerpo: string): number[] {
  return [...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
}
