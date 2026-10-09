import type { CSSProperties } from "react";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIA_INFO } from "@/lib/catalogo";

/**
 * Copy y recursos de cada categoría en el sitio público. Los colores salen de
 * CATEGORIA_INFO (catalogo.ts); acá solo vive lo que es específico de las landings.
 */
export type CategoriaPublica = {
  ruta: string;
  /** Nombre en menús y pastillas. */
  nombre: string;
  /** Texto de la etiqueta sobre el titular. */
  eyebrow: string;
  titular: string;
  bajada: string;
  chips: string[];
  /** Texto del botón principal del hero. */
  cta: string;
  bandaTitulo: string;
  /** Si hay, la banda azul los muestra como lista debajo del título; si no, el párrafo de siempre. */
  bandaPuntos?: string[];
  /** Singular / plural de "<sustantivo> verificado(s)" en los contadores. */
  verificados: [string, string];
  fotoHero: string;
  fotoTarjeta: string;
  descripcionTarjeta: string;
  fotoUrgente: string;
  urgente: { titulo: string; bajada: string; tarjetaTitulo: string; tarjetaTexto: string };
  /** Colores de lo que va encima del color de acento (el celeste y el ámbar piden texto oscuro). */
  sobreAcento: { texto: string; botonFondo: string; botonTexto: string };
};

export const CATEGORIAS_PUBLICAS: Record<CategoriaDocente, CategoriaPublica> = {
  educador: {
    ruta: "/educadores",
    nombre: "Docentes",
    eyebrow: "Categoría · Docentes",
    titular: "Resolvé suplencias e incorporaciones al instante, sin perder semanas de gestiones.",
    bajada:
      "UNIDOAR es el catálogo de profesionales de tu zona —de Nivel Inicial a Universitario—, con identidad y título verificados, ordenados por afinidad. Sin comisión por contratación.",
    chips: ["Nivel Inicial", "Primario", "Secundario", "Terciario", "Universitario", "Docentes especiales", "Música", "Matemática", "Idiomas"],
    cta: "Ver profesionales de mi zona",
    bandaTitulo: "Con UNIDOAR, conseguís profesores de todas las materias, con horas cátedra claras",
    verificados: ["profesor verificado", "profesores verificados"],
    fotoHero: "/assets/bgProfesores.png",
    fotoTarjeta: "/assets/cat-profesores.jpg",
    descripcionTarjeta: "Inicial, primario, secundario, terciario, universitario y docentes especiales",
    fotoUrgente: "/assets/profe-ciencias.jpg",
    urgente: {
      titulo: "Se te va un profesor a mitad de semestre. Publicá la búsqueda hoy",
      bajada: "Marcá la búsqueda como rápida y priorizamos profesores disponibles ya, con identidad verificada.",
      tarjetaTitulo: "Una licencia larga arranca el lunes",
      tarjetaTexto: "Publicás la suplencia y a mitad de semana ya tenés candidatos con título verificado.",
    },
    sobreAcento: { texto: "#FFFFFF", botonFondo: "#FFFFFF", botonTexto: CATEGORIA_INFO.educador.color },
  },
  entrenador: {
    ruta: "/entrenadores",
    nombre: "Entrenadores / Instructores",
    eyebrow: "Gimnasios, clubes y escuelas deportivas",
    titular: "¿Se te bajó un profe de última hora? Que la sala o la cancha no queden vacías. Cubrilo ya.",
    bajada:
      "UNIDOAR conecta a tu gimnasio o club con entrenadores y profes de disciplina verificados de tu zona, disponibles por turno o por temporada.",
    chips: ["Personal trainer", "Funcional", "Musculación", "Natación", "Yoga y pilates", "Deportes de equipo"],
    cta: "Soy institución · Busco entrenadores / instructores",
    bandaTitulo:
      "Con UNIDOAR conectás tu gimnasio, club o escuela deportiva con entrenadores y profesores validados de tu zona, listos para cubrir turnos eventuales o sumarse a tu staff.",
    bandaPuntos: [
      "Entrenadores y profes de sala disponibles por turno o temporada.",
      "Catálogo propio de tu zona con perfiles verificados.",
      "Suscripción mensual para todas las búsquedas del año.",
    ],
    verificados: ["entrenador verificado", "entrenadores verificados"],
    fotoHero: "/assets/bgEntrenadores-fixed.jpg",
    fotoTarjeta: "/assets/cat-entrenadores-gym.jpg",
    descripcionTarjeta: "Gimnasios y clubes",
    fotoUrgente: "/assets/cat-entrenadores.jpg",
    urgente: {
      titulo: "Se te va un entrenador el sábado. Publicá la búsqueda hoy",
      bajada: "Marcá la búsqueda como rápida y priorizamos entrenadores disponibles ya, con identidad verificada.",
      tarjetaTitulo: "Se va el profe de sala a mitad de temporada",
      tarjetaTexto: "Publicás la búsqueda y ves quién está disponible en tu zona esta misma semana.",
    },
    sobreAcento: { texto: "#1F2421", botonFondo: "#1F2421", botonTexto: "#FFFFFF" },
  },
  guardavidas: {
    ruta: "/guardavidas",
    nombre: "Guardavidas",
    eyebrow: "Categoría · Guardavidas",
    titular: "Abre la pileta el sábado y falta un guardavidas habilitado.",
    bajada:
      "UNIDOAR verifica identidad, título y habilitación oficial de cada guardavidas antes de mostrártelo. Perfiles listos y confiables para sumarse a tu staff cuando más lo necesitás.",
    chips: ["Pileta / Natatorio", "Club / Country", "Profesor de Natación / Guardavidas"],
    cta: "Soy institución · Busco guardavidas",
    bandaTitulo: "Con UNIDOAR, conseguís guardavidas habilitados y profes de natación para temporada",
    verificados: ["guardavidas verificado", "guardavidas verificados"],
    fotoHero: "/assets/bgGuardavidas-fixed.jpg",
    fotoTarjeta: "/assets/cat-guardavidas-pileta.jpg",
    descripcionTarjeta: "Piletas y natatorios",
    fotoUrgente: "/assets/hero-guardavidas.jpg",
    urgente: {
      titulo: "Falta un guardavidas para el fin de semana. Publicá la búsqueda hoy",
      bajada: "Marcá la búsqueda como rápida y priorizamos guardavidas habilitados y disponibles ya.",
      tarjetaTitulo: "Abre la pileta el sábado y falta un guardavidas",
      tarjetaTexto: "Publicás la búsqueda y ves quién está habilitado y disponible ya.",
    },
    sobreAcento: { texto: "#16214F", botonFondo: "#FFFFFF", botonTexto: CATEGORIA_INFO.guardavidas.ink },
  },
};

/** Variables CSS de acento de una categoría, para usar con `bg-(--acento)`, `text-(color:--acento-tinta)`, etc. */
export function estiloCategoria(categoria: CategoriaDocente): CSSProperties {
  const info = CATEGORIA_INFO[categoria];
  return {
    "--acento": info.color,
    "--acento-claro": info.tint,
    "--acento-tinta": info.ink,
    "--sobre-acento": CATEGORIAS_PUBLICAS[categoria].sobreAcento.texto,
  } as CSSProperties;
}

/** Botón principal en el color de la categoría (en línea, para ganarle a las variantes de <Boton>). */
export function estiloBotonAcento(categoria: CategoriaDocente): CSSProperties {
  return { background: CATEGORIA_INFO[categoria].color, color: CATEGORIAS_PUBLICAS[categoria].sobreAcento.texto };
}
