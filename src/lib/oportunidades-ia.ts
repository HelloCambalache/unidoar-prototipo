import { interpretarBusqueda, palabrasSinAplicar, textoDeLaFrase } from "@/lib/busqueda-ia";
import { NIVELES, TURNOS } from "@/lib/catalogo";
import { ETIQUETA_FILTRO_CATEGORIA, type FiltrosOportunidades } from "@/lib/oportunidades";

/*
 * "Contanos qué buscás" para el profesional: la misma lectura de frase libre que usa la institución
 * (`interpretarBusqueda`), pero llevada a los filtros de las ofertas (`FiltrosOportunidades`). Función pura y sin
 * costo: no hay ningún modelo detrás. Solo se aplica lo que esta pantalla sabe filtrar; lo demás se devuelve en
 * `sinEntender` para decirlo, en vez de ignorarlo en silencio. Las palabras que no son filtro ni relleno se buscan como texto
 * (el buscador de ofertas es uno solo: la misma caja sirve para "inglés en primaria", para "San Andrés" y para "inglés San Andrés",
 * que es la materia más el nombre de la institución).
 */

export type LecturaDeFrase = {
  /** Los filtros que se aplican a las ofertas. */
  filtros: FiltrosOportunidades;
  /** Lo que se entendió y se aplicó, listo para mostrar. */
  leido: string[];
  reconocido: boolean;
  /**
   * Lo que se busca como texto en el puesto, la materia y la institución de las ofertas ("San Andrés"), además de los filtros
   * que la frase pidió. Ya viene aplicado en `filtros.q` (junto con la materia, si hay).
   */
  texto: string;
  /**
   * `filtros.q` sin el texto, o sea solo la materia (o nada): lo que se busca si la combinación con el texto no encuentra nada y
   * la pantalla muestra lo que dan los filtros solos.
   */
  qSinTexto: string | undefined;
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
  // Lo que se avisa como no aplicado es lo que no se pudo convertir en filtro NI se busca como texto (esto último ya se ve en «Entendimos»).
  const sinEntender = [...palabrasSinAplicar(r)];

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

  // El buscador es uno solo: lo escrito que no es filtro ("San Andrés", "ajedrez") se busca como texto, junto con la materia si la hay:
  // cada palabra de `q` tiene que estar en el puesto, la materia o la institución, así que «inglés San Andrés» es el inglés de esa institución.
  const texto = textoDeLaFrase(r);
  const qSinTexto = filtros.q;
  // (80 es el largo máximo de `q` en la URL: un valor más largo se descartaría entero al volver a leerlo.)
  if (texto) filtros.q = [filtros.q, texto].filter(Boolean).join(" ").slice(0, 80).trim();

  return { filtros, leido, reconocido: leido.length > 0, texto, qSinTexto, sinEntender: [...new Set(sinEntender)].slice(0, 4) };
}
