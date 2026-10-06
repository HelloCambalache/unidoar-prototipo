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
  /** Singular / plural de "<sustantivo> verificado(s)" en los contadores. */
  verificados: [string, string];
  fotoHero: string;
  fotoTarjeta: string;
  posicionTarjeta: string;
  descripcionTarjeta: string;
  fotoUrgente: string;
  /** `background-position` de la foto de la banda de urgentes. */
  posicionUrgente: string;
  urgente: { titulo: string; bajada: string; tarjetaTitulo: string; tarjetaTexto: string };
  /** Colores de lo que va encima del color de acento (el celeste y el ámbar piden texto oscuro). */
  sobreAcento: { texto: string; botonFondo: string; botonTexto: string };
};

export const CATEGORIAS_PUBLICAS: Record<CategoriaDocente, CategoriaPublica> = {
  educador: {
    ruta: "/educadores",
    nombre: "Docentes",
    eyebrow: "Categoría · Educadores",
    titular: "Necesitás un profesor de Matemática o una maestra de grado para el lunes. No tres semanas de WhatsApp.",
    bajada:
      "UNIDOAR es el catálogo de docentes de tu zona —de Nivel Inicial a Terciario—, con identidad y título verificados, ordenados por afinidad. Sin comisión por contratación.",
    chips: ["Nivel Inicial", "Primario", "Secundario", "Terciario", "Música", "Matemática", "Idiomas"],
    cta: "Ver docentes de mi zona",
    bandaTitulo: "Con UNIDOAR, conseguís profesores de todas las materias, con horas cátedra claras",
    verificados: ["profesor verificado", "profesores verificados"],
    fotoHero: "/assets/bgProfesores.png",
    fotoTarjeta: "/assets/cat-profesores.jpg",
    posicionTarjeta: "20% center",
    descripcionTarjeta: "Inicial, primario, secundario y terciario",
    fotoUrgente: "/assets/profe-ciencias.jpg",
    posicionUrgente: "center 22%",
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
    eyebrow: "Categoría · Entrenadores / Instructores",
    titular: "Se te va un profe de sala el sábado. No tenés hasta el lunes.",
    bajada:
      "UNIDOAR conecta a tu gimnasio o club con entrenadores y profes de disciplina verificados de tu zona, disponibles por turno o por temporada.",
    chips: ["Personal trainer", "Funcional", "Musculación", "Natación", "Yoga y pilates", "Deportes de equipo"],
    cta: "Ver entrenadores de mi zona",
    bandaTitulo: "Con UNIDOAR, conseguís entrenadores y profes de sala disponibles por turno o temporada",
    verificados: ["entrenador verificado", "entrenadores verificados"],
    fotoHero: "/assets/bgEntrenadores-fixed.jpg",
    fotoTarjeta: "/assets/cat-entrenadores-gym.jpg",
    posicionTarjeta: "center",
    descripcionTarjeta: "Gimnasios y clubes",
    fotoUrgente: "/assets/cat-entrenadores.jpg",
    posicionUrgente: "center",
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
      "UNIDOAR verifica la habilitación y la identidad de cada guardavidas y profesor de natación antes de mostrártelo. Perfiles listos para temporada corta.",
    chips: ["Pileta", "Natatorio", "Río", "Mar", "Profesor de natación"],
    cta: "Ver guardavidas de mi zona",
    bandaTitulo: "Con UNIDOAR, conseguís guardavidas habilitados y profes de natación para temporada",
    verificados: ["guardavidas verificado", "guardavidas verificados"],
    fotoHero: "/assets/bgGuardavidas-fixed.jpg",
    fotoTarjeta: "/assets/cat-guardavidas-pileta.jpg",
    posicionTarjeta: "center",
    descripcionTarjeta: "Piletas y natatorios",
    fotoUrgente: "/assets/hero-guardavidas.jpg",
    posicionUrgente: "center",
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
