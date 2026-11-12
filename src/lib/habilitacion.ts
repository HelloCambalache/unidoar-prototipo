import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { categoriasDe, tieneCategoria, type ConCategorias } from "@/lib/categorias-docente";
import { coincideAsignatura, normalizar } from "@/lib/coincidencia";

/*
 * A qué búsquedas puede postularse un profesional (2026-11-04, pedido del cliente: «que el docente solo pueda postularse a las materias o
 * áreas para las cuales está formalmente habilitado según su perfil»; se vio con alguien de Lengua que podía postularse a Educación Física).
 * Es una regla pura: sin base ni Next. La arma `habilitacionParaBusqueda` (src/lib/queries/habilitacion.ts) con el catálogo de rubros.
 *
 * Qué es «estar habilitado», según lo que la persona declaró en su perfil:
 *  1. La búsqueda tiene que ser de SU categoría (docente, entrenador o guardavidas).
 *  2. Y de una materia que dicta (la asignatura coincide, con las mismas equivalencias de «Tu materia») o de su misma ÁREA del catálogo
 *     (el rubro: quien da Lengua puede postularse a Historia, que es de «Lengua y sociales», pero no a Educación Física).
 *  Una persona sin asignaturas cargadas no tiene con qué comparar: no se la frena.
 * Una invitación de la institución no pasa por acá: si la institución invitó a alguien, aceptar es siempre posible.
 */

/** `categoría|asignatura` normalizada → rubro del catálogo (Categorías del backoffice). */
export type RubrosDelCatalogo = ReadonlyMap<string, string>;

export const claveDeRubro = (categoria: CategoriaDocente, asignatura: string) => `${categoria}|${normalizar(asignatura)}`;

export type PerfilParaHabilitar = ConCategorias & { asignaturas: string[] };
export type BusquedaParaHabilitar = { categoria: CategoriaDocente; disciplina: string };

export type Habilitacion =
  | { habilitado: true }
  | { habilitado: false; motivo: "categoria" | "materia"; mensaje: string };

function lista(items: string[]) {
  const unicos = [...new Set(items.map((i) => i.trim()).filter(Boolean))];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} y ${unicos[unicos.length - 1]}`;
}

export function habilitacionParaBusqueda(
  perfil: PerfilParaHabilitar,
  busqueda: BusquedaParaHabilitar,
  rubros: RubrosDelCatalogo,
): Habilitacion {
  // Un perfil puede tener varias categorías (docente y guardavidas…): alcanza con que la búsqueda sea de alguna de ellas.
  if (!tieneCategoria(perfil, busqueda.categoria)) {
    const propias = categoriasDe(perfil).map((c) => CATEGORIA_INFO[c].plural.toLowerCase());
    return {
      habilitado: false,
      motivo: "categoria",
      mensaje: `Esta búsqueda es para ${CATEGORIA_INFO[busqueda.categoria].plural.toLowerCase()} y tu perfil es de ${lista(propias)}. Solo podés postularte a las búsquedas de tu ${propias.length > 1 ? "categorías" : "categoría"}.`,
    };
  }

  const propias = perfil.asignaturas.filter((a) => a.trim());
  if (propias.length === 0) return { habilitado: true };
  if (coincideAsignatura(busqueda.disciplina, propias)) return { habilitado: true };

  // El área (rubro) se compara dentro de la categoría de la búsqueda: las asignaturas del perfil que son de otra categoría no cuentan.
  const rubroDeLaBusqueda = rubros.get(claveDeRubro(busqueda.categoria, busqueda.disciplina));
  if (rubroDeLaBusqueda && propias.some((a) => rubros.get(claveDeRubro(busqueda.categoria, a)) === rubroDeLaBusqueda)) {
    return { habilitado: true };
  }

  return {
    habilitado: false,
    motivo: "materia",
    mensaje: `Esta búsqueda es de ${busqueda.disciplina} y en tu perfil figurás con ${lista(propias)}. Solo podés postularte a las materias y áreas de tu perfil. Si también dictás esta materia, sumala en Mi perfil.`,
  };
}
