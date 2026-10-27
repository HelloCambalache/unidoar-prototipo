import { interpretarBusqueda, textoDeLaFrase } from "@/lib/busqueda-ia";
import { NIVELES, TURNOS } from "@/lib/catalogo";
import { ETIQUETA_FILTRO_CATEGORIA, type FiltrosOportunidades } from "@/lib/oportunidades";

/*
 * "Contanos qué buscás" para el profesional: la misma lectura de frase libre que usa la institución
 * (`interpretarBusqueda`), pero llevada a los filtros de las ofertas (`FiltrosOportunidades`). Función pura y sin
 * costo: no hay ningún modelo detrás. Solo se aplica lo que esta pantalla sabe filtrar; lo demás se devuelve en
 * `sinEntender` para decirlo, en vez de ignorarlo en silencio. Si la frase no pide ningún filtro, se busca como texto
 * (el buscador de ofertas es uno solo: la misma caja sirve para "inglés en primaria" y para "San Andrés").
 */

export type LecturaDeFrase = {
  /** Los filtros que se aplican a las ofertas. */
  filtros: FiltrosOportunidades;
  /** Lo que se entendió y se aplicó, listo para mostrar. */
  leido: string[];
  reconocido: boolean;
  /**
   * Lo que se busca como texto en el puesto, la materia y la institución de las ofertas ("San Andrés"): solo cuando la frase
   * no pidió ningún filtro (un nombre o una materia sueltos). Ya viene aplicado en `filtros.q`.
   */
  texto: string;
  /** Lo que la frase pedía y no se pudo aplicar. */
  sinEntender: string[];
};

/**
 * `disciplinas` son las asignaturas del catálogo. Sin cuenta (`publico`) no hay favoritos. Las zonas no se leen a propósito:
 * la distancia de una oferta se mide desde el perfil de quien busca, no con un filtro por zona.
 */
export function leerFraseDeTrabajo(frase: string, disciplinas: string[], opciones: { publico?: boolean } = {}): LecturaDeFrase {
  const r = interpretarBusqueda(frase, { disciplinas }, { buscaTrabajo: true });
  const filtros: FiltrosOportunidades = {};
  const leido: string[] = [];
  const sinEntender = [...r.sinEntender];

  // La materia se busca como texto en el puesto y la disciplina de la oferta: con una sola alcanza.
  const [materia, ...otras] = r.filtros.disciplinas ?? [];
  if (materia) {
    filtros.q = materia;
    leido.push(materia);
  }
  sinEntender.push(...otras);

  if (r.filtros.categoria) {
    filtros.categoria = r.filtros.categoria;
    leido.push(ETIQUETA_FILTRO_CATEGORIA[r.filtros.categoria]);
  }

  if (r.filtros.nivel && (NIVELES as readonly string[]).includes(r.filtros.nivel)) {
    filtros.nivel = r.filtros.nivel as (typeof NIVELES)[number];
    leido.push(r.filtros.nivel);
  }

  // Una oferta tiene un solo turno: mañana y tarde juntos es el turno "Mañana y tarde"; con otros pares se toma el primero.
  const turnos = (r.filtros.disponibilidad ?? []).filter((t): t is (typeof TURNOS)[number] => (TURNOS as readonly string[]).includes(t));
  if (turnos.length > 0) {
    const mañanaYTarde = turnos.includes("Mañana") && turnos.includes("Tarde");
    const turno = mañanaYTarde ? "Mañana y tarde" : turnos[0]!;
    filtros.turno = turno;
    leido.push(turno === "Contraturno" || turno === "Fin de semana" || turno === "Mañana y tarde" ? turno : `Turno ${turno.toLowerCase()}`);
    const sobrantes = turnos.filter((t) => t !== turno && !(mañanaYTarde && (t === "Mañana" || t === "Tarde")));
    sinEntender.push(...sobrantes.map((t) => t.toLowerCase()));
  }

  if (r.filtros.rapidas) {
    filtros.rapidas = "1";
    leido.push("Búsqueda rápida");
  } else if (r.filtros.tipo) {
    filtros.tipo = r.filtros.tipo as FiltrosOportunidades["tipo"];
    leido.push(r.filtros.tipo);
  }

  if (r.filtros.soloVerificados) {
    filtros.verificadas = "1";
    leido.push("Instituciones verificadas");
  }
  if (r.filtros.soloFavoritos) {
    if (opciones.publico) sinEntender.push("favoritos");
    else {
      filtros.favoritos = "1";
      leido.push("Favoritos");
    }
  }

  // El buscador es uno solo: lo escrito que no pide ningún filtro ("Colegio San Andrés", "ajedrez") se busca como texto.
  const texto = textoDeLaFrase(r);
  if (texto) filtros.q = texto;

  return { filtros, leido, reconocido: leido.length > 0, texto, sinEntender: [...new Set(sinEntender)].slice(0, 4) };
}
