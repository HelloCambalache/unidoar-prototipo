import type { Metadata } from "next";

/*
 * Qué dice cada página cuando se comparte (WhatsApp, redes, mail) y cuando aparece en un buscador.
 *
 * La regla de fondo (pedido de Richi, 2026-11-10): quien recibe un enlace tiene que entender de entrada A QUIÉN le habla la página:
 *  - **docentes**: la persona que busca trabajo (docentes, entrenadores y guardavidas) → "Encontrá trabajo…", "Postulate…".
 *  - **instituciones**: quien busca profesionales (colegios, clubes, natatorios) → "Encontrá profesionales…", "Publicá una búsqueda…".
 *  - **general**: las páginas que sirven a los dos (inicio, registro, contacto, términos…) → dicen las dos cosas.
 *
 * Todo el texto vive acá, en un solo lugar, y es código puro (sin base ni Next en runtime) para poder cuidarlo con una prueba. Una página
 * pública se suma a `PAGINAS` y arma sus metadatos con `metadatosDePagina`: título, descripción, canónica y la IMAGEN de su público
 * (`/og/<público>.png`, dibujada por `og-compartir.tsx` y servida por `src/app/og/[archivo]/route.tsx`) salen de ahí, sin nada más que
 * recordar. Una página que habla a un público tiene que pasar por ese helper: si arma su propio `openGraph` a mano, pierde la imagen.
 */

export type Publico = "general" | "docentes" | "instituciones";

export const PUBLICOS: readonly Publico[] = ["general", "docentes", "instituciones"];

export const NOMBRE_DEL_SITIO = "UNIDOAR";
const SUFIJO = ` · ${NOMBRE_DEL_SITIO}`;

/** Medidas de la imagen de vista previa (la proporción que usan WhatsApp, Facebook, LinkedIn y X para la tarjeta grande). */
export const MEDIDAS_DE_IMAGEN = { width: 1200, height: 630 } as const;

/**
 * Se sube cuando cambia el DIBUJO de una imagen: WhatsApp y los navegadores recuerdan cada imagen por su dirección, y sin esto seguirían
 * mostrando la vieja en los enlaces ya compartidos.
 */
const VERSION_DE_LAS_IMAGENES = "1";

/** El archivo de la imagen de un público ("docentes.png") y su camino inverso (null si no es de ninguno). */
export const archivoDeImagen = (publico: Publico) => `${publico}.png`;
export function publicoDeArchivo(archivo: string): Publico | null {
  const nombre = archivo.endsWith(".png") ? archivo.slice(0, -4) : "";
  return PUBLICOS.find((p) => p === nombre) ?? null;
}
export const rutaDeImagen = (publico: Publico) => `/og/${archivoDeImagen(publico)}?v=${VERSION_DE_LAS_IMAGENES}`;

/** Qué muestra la imagen, para quien no la ve (lectores de pantalla y cuando WhatsApp no la carga). */
export const TEXTO_ALTERNATIVO: Record<Publico, string> = {
  general: "UNIDOAR: donde instituciones y profesionales se encuentran. Para docentes: encontrá trabajo. Para instituciones: encontrá profesionales verificados.",
  docentes: "UNIDOAR para docentes, entrenadores y guardavidas: encontrá trabajo cerca tuyo, gratis.",
  instituciones: "UNIDOAR para instituciones: encontrá profesionales verificados para tu colegio, club o natatorio.",
};

/** La imagen de un público lista para `openGraph.images` y `twitter.images`. */
export const imagenesParaCompartir = (publico: Publico) => [
  { url: rutaDeImagen(publico), ...MEDIDAS_DE_IMAGEN, alt: TEXTO_ALTERNATIVO[publico], type: "image/png" },
];

/** Lo que mide una buena vista previa: el título se corta cerca de los 70 caracteres y la descripción a los ~160. */
export const LIMITES = { titulo: 70, descripcionMin: 50, descripcion: 160, descripcionPagina: 175 } as const;

export type PaginaSeo = {
  /** A quién le habla la página (la prueba comprueba que el texto lo diga). */
  publico: Publico;
  titulo: string;
  descripcion: string;
  /** Dirección de la página sin parámetros: la canónica y el `og:url`. */
  ruta: string;
  /** El título va tal cual, sin el «· UNIDOAR» del final (portada e ingreso, que ya empiezan con la marca). */
  absoluto?: boolean;
};

export const PAGINAS = {
  inicio: {
    publico: "general",
    titulo: "UNIDOAR: trabajo para docentes, profesionales para instituciones",
    descripcion:
      "Docentes, entrenadores y guardavidas: encontrá trabajo cerca tuyo, gratis. Colegios, clubes y natatorios: publicá una búsqueda y cubrí cargos en días.",
    ruta: "/",
    absoluto: true,
  },

  // Para docentes (buscan trabajo)
  buscarTrabajo: {
    publico: "docentes",
    titulo: "Buscá trabajo de docente, entrenador o guardavidas",
    descripcion:
      "Cargos y suplencias abiertos ahora en colegios, clubes y natatorios. Mirá sin cuenta; para postularte creás una, gratis para profesionales.",
    ruta: "/buscar-trabajo",
  },
  instituciones: {
    publico: "docentes",
    titulo: "Trabajá en colegios y clubes que ya contratan",
    descripcion:
      "Colegios, clubes, jardines y gimnasios que ya buscan profesionales en UNIDOAR. Mirá qué necesitan y mandales tu CV, gratis.",
    ruta: "/instituciones",
  },
  altaDocente: {
    publico: "docentes",
    titulo: "Creá tu cuenta gratis y buscá trabajo",
    descripcion:
      "Registrate como docente, entrenador o guardavidas y postulate a cargos y suplencias de colegios, clubes y natatorios. Es gratis.",
    ruta: "/onboarding/docente/1",
  },

  // Para instituciones (buscan profesionales)
  publicarBusqueda: {
    publico: "instituciones",
    titulo: "Publicá una búsqueda y encontrá profesionales verificados",
    descripcion:
      "Colegios, clubes y natatorios: publicá la vacante o la suplencia y recibí postulaciones de docentes, entrenadores y guardavidas verificados.",
    ruta: "/publicar-busqueda",
  },
  planes: {
    publico: "instituciones",
    titulo: "Planes para instituciones. Gratis para docentes",
    descripcion:
      "Para los profesionales UNIDOAR es gratis, siempre. Las instituciones pagan una suscripción mensual según su tipo o una tarifa por búsqueda, sin comisión por contratación.",
    ruta: "/planes",
  },
  altaInstitucion: {
    publico: "instituciones",
    titulo: "Sumá tu institución y encontrá profesionales verificados",
    descripcion:
      "Creá la cuenta de tu colegio, club o natatorio y publicá una búsqueda para cubrir cargos y suplencias con docentes, entrenadores y guardavidas verificados.",
    ruta: "/onboarding/institucion/1",
  },
  categorias: {
    publico: "instituciones",
    titulo: "Encontrá profesionales por categoría para tu institución",
    descripcion:
      "Elegí la categoría y mirá perfiles de profesionales verificados pensados para colegios, clubes y natatorios.",
    ruta: "/categorias",
  },
  // Las landings por categoría le hablan a quien busca profesionales (sus botones son «Publicar una búsqueda»).
  educadores: {
    publico: "instituciones",
    titulo: "Encontrá docentes verificados para tu institución",
    descripcion:
      "Profesores de Secundario y Terciario, y maestras y maestros de Nivel Inicial y Primario de tu zona, con identidad y título verificados.",
    ruta: "/educadores",
  },
  entrenadores: {
    publico: "instituciones",
    titulo: "Encontrá entrenadores verificados para tu club o gimnasio",
    descripcion:
      "Entrenadores y profes de gimnasio y de club de tu zona, con identidad y título verificados, por turno o por temporada.",
    ruta: "/entrenadores",
  },
  guardavidas: {
    publico: "instituciones",
    titulo: "Encontrá guardavidas habilitados para tu pileta o natatorio",
    descripcion:
      "Guardavidas y profesores de natación de tu zona, con habilitación e identidad verificadas antes de que los veas.",
    ruta: "/guardavidas",
  },

  // Para los dos
  registro: {
    publico: "general",
    titulo: "Creá tu cuenta: docentes e instituciones",
    descripcion:
      "Elegí cómo usás UNIDOAR: como docente, entrenador o guardavidas para buscar trabajo, o como institución para encontrar profesionales verificados.",
    ruta: "/registro",
  },
  ingresar: {
    publico: "general",
    titulo: "UNIDOAR · Ingresá a tu cuenta",
    descripcion:
      "Entrá a tu cuenta de UNIDOAR: docentes, mirá búsquedas y postulaciones; instituciones, mirá a tus postulantes y profesionales verificados.",
    ruta: "/ingresar",
    absoluto: true,
  },
  // Un enlace a una pantalla con sesión (la de buscar trabajo de un docente, la de buscar profesionales de una institución) lleva a /ingresar
  // cuando WhatsApp o una red arma su vista previa: según el área a la que apunta, el ingreso le habla al público de esa área.
  ingresarDocentes: {
    publico: "docentes",
    titulo: "UNIDOAR · Ingresá para buscar trabajo",
    descripcion:
      "Ingresá a tu cuenta de UNIDOAR para ver las búsquedas abiertas, postularte y seguir tus postulaciones. Gratis para docentes, entrenadores y guardavidas.",
    ruta: "/ingresar",
    absoluto: true,
  },
  ingresarInstituciones: {
    publico: "instituciones",
    titulo: "UNIDOAR · Ingresá para buscar profesionales",
    descripcion:
      "Ingresá a tu cuenta de UNIDOAR para publicar búsquedas, revisar postulantes y encontrar docentes, entrenadores y guardavidas verificados.",
    ruta: "/ingresar",
    absoluto: true,
  },
  contacto: {
    publico: "general",
    titulo: "Contacto: instituciones y docentes",
    descripcion:
      "¿Dudas sobre tu institución, tu perfil profesional o algo puntual? Escribinos y te respondemos en el día.",
    ruta: "/contacto",
  },
  quienesSomos: {
    publico: "general",
    titulo: "Quiénes somos",
    descripcion:
      "Un equipo con más de 35 años en la educación y el deporte que une experiencia y tecnología para que instituciones y profesionales se conecten de forma simple, directa y transparente.",
    ruta: "/quienes-somos",
  },
  ayuda: {
    publico: "general",
    titulo: "Centro de ayuda para docentes e instituciones",
    descripcion:
      "Guías y preguntas frecuentes de UNIDOAR para profesionales (docentes, entrenadores y guardavidas) y para instituciones.",
    ruta: "/ayuda",
  },
  terminos: {
    publico: "general",
    titulo: "Términos y condiciones",
    descripcion:
      "Términos y condiciones de uso y contratación de UNIDOAR: qué es la plataforma, el registro, las obligaciones de docentes e instituciones, los servicios pagos, la responsabilidad y la jurisdicción.",
    ruta: "/terminos",
  },
  privacidad: {
    publico: "general",
    titulo: "Política de privacidad",
    descripcion:
      "Política de privacidad y protección de datos personales de UNIDOAR: quién es el responsable, qué datos se recopilan, para qué se usan, quién puede verlos y cómo ejercer tus derechos.",
    ruta: "/privacidad",
  },
} as const satisfies Record<string, PaginaSeo>;

/**
 * Qué página de ingreso mostrar según a dónde iba la persona (`?next=`, ya validado como ruta interna): las del área de docentes
 * (`/docente/…`) hablan de buscar trabajo, las de instituciones (`/institucion/…`) de buscar profesionales y el resto, a los dos.
 */
export function paginaDeIngreso(siguiente: string | null | undefined): PaginaSeo {
  const ruta = (siguiente ?? "").split(/[?#]/)[0];
  if (ruta === "/docente" || ruta.startsWith("/docente/")) return PAGINAS.ingresarDocentes;
  if (ruta === "/institucion" || ruta.startsWith("/institucion/")) return PAGINAS.ingresarInstituciones;
  return PAGINAS.ingresar;
}

/** El título tal como se ve al compartir: con la marca al final, salvo los que ya la llevan adelante. */
export const tituloParaCompartir = (p: Pick<PaginaSeo, "titulo" | "absoluto">) => (p.absoluto ? p.titulo : `${p.titulo}${SUFIJO}`);

/**
 * Los metadatos de una página pública: título, descripción, canónica, `openGraph` (lo que leen WhatsApp, Facebook, LinkedIn y el mail) y
 * `twitter`. Next NO mezcla estos objetos con los del layout (lo que una página declara reemplaza el objeto entero), por eso se arman
 * completos acá. La imagen no va: la pone el `opengraph-image.tsx` de la carpeta de la página.
 */
export function metadatosDePagina(p: PaginaSeo, tipo: "website" | "article" = "website"): Metadata {
  const titulo = tituloParaCompartir(p);
  const imagenes = imagenesParaCompartir(p.publico);
  return {
    title: p.absoluto ? { absolute: p.titulo } : p.titulo,
    description: p.descripcion,
    alternates: { canonical: p.ruta },
    openGraph: { type: tipo, locale: "es_AR", siteName: NOMBRE_DEL_SITIO, title: titulo, description: p.descripcion, url: p.ruta, images: imagenes },
    twitter: { card: "summary_large_image", title: titulo, description: p.descripcion, images: imagenes },
  };
}

/** Páginas que se arman con datos (una oferta, el perfil de una institución): mismo formato, con su propia dirección. */
export const metadatosDeContenido = metadatosDePagina;

/** Los manuales públicos del Centro de ayuda: uno para quien busca trabajo (profesionales) y otro para quien busca profesionales (instituciones). */
export type ManualPublico = "profesionales" | "instituciones";

/** El título de una guía del Centro de ayuda al compartirla: dice para quién es el manual (`Crear tu cuenta · Ayuda para profesionales`). */
export const tituloDeGuia = (manual: ManualPublico, titulo: string) => `${titulo} · Ayuda para ${manual}`;

/** Metadatos de una página del Centro de ayuda (el manual o una guía): le habla al público de ese manual (docentes o instituciones). */
export const metadatosDeAyuda = (o: { manual: ManualPublico; titulo: string; descripcion: string; ruta: string }): Metadata =>
  metadatosDePagina({ publico: o.manual === "instituciones" ? "instituciones" : "docentes", titulo: o.titulo, descripcion: o.descripcion, ruta: o.ruta });

/** Una sola línea y, si pasa del largo que se ve en una vista previa, cortada en una palabra con «…». */
export function recortarDescripcion(texto: string, max: number = LIMITES.descripcion): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`;
}

/** El título y el resumen de una oferta de trabajo compartida: lo primero que dice es que es una oferta (para docentes). */
export function textosDeOferta(o: { puesto: string; institucion: string; resumen: string | null; abierta: boolean }) {
  return {
    titulo: `Oferta de trabajo: ${o.puesto} · ${o.institucion}`,
    descripcion: o.abierta && o.resumen?.trim() ? recortarDescripcion(o.resumen) : "Esta búsqueda ya no está abierta.",
  };
}

/** El título y la descripción del perfil público de una institución compartido (le habla a docentes que quieran postularse). */
export function textosDeInstitucion(i: { nombre: string; tipo: string; descripcion: string | null }) {
  return {
    titulo: `${i.nombre} · Mirá sus búsquedas y postulate`,
    descripcion: i.descripcion?.trim()
      ? recortarDescripcion(i.descripcion)
      : `${i.tipo} en UNIDOAR. Mirá qué búsquedas tiene abiertas y mandale tu CV.`,
  };
}

/* ── Lo que dice la IMAGEN de cada público (la dibuja `og-compartir.tsx`) ───────────────────────────────────────────────────────────── */

export type CaraDeImagen = {
  /** La pastilla de color: lo primero que se lee. En mayúsculas porque se dibuja así. */
  pastilla: string;
  detalle: string;
  titulo: string;
  bajada: string;
  etiquetas: string[];
  /** Colores de la pastilla (el celeste pide texto oscuro). */
  color: string;
  colorTexto: string;
  foto: string;
};

export const IMAGEN_DOCENTES: CaraDeImagen = {
  pastilla: "PARA DOCENTES",
  detalle: "Docentes, entrenadores y guardavidas",
  titulo: "Encontrá trabajo cerca tuyo",
  bajada: "Postulate gratis a cargos y suplencias de colegios, clubes y natatorios.",
  etiquetas: ["Docentes", "Entrenadores", "Guardavidas"],
  color: "#DD553F",
  colorTexto: "#FFFFFF",
  foto: "hero-docente.jpg",
};

export const IMAGEN_INSTITUCIONES: CaraDeImagen = {
  pastilla: "PARA INSTITUCIONES",
  detalle: "Colegios, clubes y natatorios",
  titulo: "Encontrá profesionales verificados",
  bajada: "Publicá una búsqueda y cubrí cargos y suplencias en días.",
  etiquetas: ["Colegios", "Clubes", "Natatorios"],
  color: "#82D8E9",
  colorTexto: "#040B35",
  foto: "hero-profesor.jpg",
};

/** La imagen de las páginas que sirven a los dos públicos: dos tarjetas, una para cada uno. */
export const IMAGEN_GENERAL = {
  titulo: "Donde instituciones y profesionales se encuentran",
  tarjetas: [
    { ...IMAGEN_DOCENTES, texto: "Encontrá trabajo cerca tuyo, gratis" },
    { ...IMAGEN_INSTITUCIONES, texto: "Encontrá profesionales verificados" },
  ],
} as const;
