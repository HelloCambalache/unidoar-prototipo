import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { transaccion } from "@/db";
import { institucionSedes, instituciones, type Institucion } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { TIPOS_CON_CUE } from "@/lib/catalogo";
import { busquedasAbiertasPorSede, sedesDeInstitucion, sincronizarEspejo } from "@/lib/queries/sedes";
import { ubicarPorDireccion } from "@/lib/queries/ubicacion";
import { cambiosDeSedes, huellaDeSedes, puedeQuitarSede, sedesEntradaSchema, validarSedes, type SedeVista } from "@/lib/sedes";
import { claveDeDireccion, zonaDeUbicacion } from "@/lib/ubicacion";
import { camposDeError } from "@/lib/vitrina";

/*
 * "Guardar sedes": el estado completo de la lista de sedes de una institución. Lo comparten dos puertas: la de la propia
 * institución (`actualizarSedes`, src/app/actions/institucion.ts) y la del equipo desde el backoffice (`actualizarSedesComoAdmin`).
 * Quien llama ya resolvió QUIÉN puede editar y DE QUÉ institución; acá se valida y se guarda con las mismas reglas.
 */

const vacioANull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Valida y guarda las sedes en una sola transacción: las que ya no vienen se quitan (salvo que tengan búsquedas abiertas), las
 * que traen el `id` de una sede de esta institución se actualizan y las demás se crean (un `id` ajeno o inexistente se trata como
 * nueva: nunca se toca la sede de otra institución). Cada dirección nueva o cambiada se ubica de nuevo; el servidor no le cree
 * coordenadas al navegador, solo una firma suya (ver CLAUDE.md, "Ubicación automática de direcciones"). `puedeEditarCue`: solo el
 * equipo de UNIDOAR carga el CUE (y solo los tipos de institución que son establecimientos educativos lo tienen).
 * Devuelve las sedes como quedaron (con sus ids) y los nombres de lo que cambió.
 */
export async function guardarSedesDeInstitucion(
  institucion: Pick<Institucion, "id" | "tipo">,
  entrada: unknown,
  opciones: { puedeEditarCue: boolean },
): Promise<Resultado<{ sedes: SedeVista[]; huella: string; cambios: string[] }>> {
  const r = sedesEntradaSchema.safeParse(entrada);
  if (!r.success) return fallo("Revisá los campos marcados.", camposDeError(r.error));
  const enviadas = r.data.sedes;

  const invalida = validarSedes(enviadas);
  if (invalida) return fallo(invalida.error, invalida.campos);

  const antes = await sedesDeInstitucion(institucion.id);
  const porId = new Map(antes.map((s) => [s.id, s]));
  const conCue = opciones.puedeEditarCue && TIPOS_CON_CUE.includes(institucion.tipo);

  // La huella de lo que la persona estaba viendo (la pantalla la manda junto con las sedes). Primero una comprobación rápida, antes de
  // ubicar las direcciones; y otra, la que vale, dentro de la transacción con la institución bloqueada. Sin huella no se compara.
  const huellaEsperada = huellaDeLaEntrada(entrada);
  if (huellaEsperada !== undefined && huellaDeSedes(antes, { conCue }) !== huellaEsperada) return fallo(SE_CAMBIARON_MIENTRAS_TANTO);

  // Las que ya no vienen: no se pueden quitar con búsquedas abiertas o pausadas (hay que cerrarlas o pasarlas a otra sede).
  const idsQueQuedan = new Set(enviadas.flatMap((s) => (s.id && porId.has(s.id) ? [s.id] : [])));
  const aQuitar = antes.filter((s) => !idsQueQuedan.has(s.id));
  if (aQuitar.length > 0) {
    const abiertas = await busquedasAbiertasPorSede(institucion.id);
    for (const s of aQuitar) {
      // Si era la principal, ya hay otra marcada como principal en la lista nueva (lo exige validarSedes): se puede quitar.
      const puede = puedeQuitarSede({ esPrincipal: false }, abiertas.get(s.id) ?? 0);
      if (!puede.ok) return fallo(`Sede «${s.nombre}»: ${puede.error}`);
    }
  }

  // Ubicación de cada sede: solo se vuelve a buscar si es nueva, si cambió la dirección o si le faltan las coordenadas.
  const guardar: {
    id: string | undefined;
    nombre: string;
    direccion: string;
    zona: string | null;
    lat: number | null;
    lng: number | null;
    partido: string | null;
    provincia: string | null;
    cue: string | null;
    esPrincipal: boolean;
  }[] = [];
  for (const s of enviadas) {
    const previa = s.id ? porId.get(s.id) : undefined;
    const cambioDireccion = !previa || claveDeDireccion(s.direccion) !== claveDeDireccion(previa.direccion ?? "");
    const u =
      cambioDireccion || previa.lat == null || previa.lng == null
        ? await ubicarPorDireccion({
            direccion: s.direccion,
            // Con la dirección nueva el partido de antes no sirve de pista; sin cambios, sí.
            partido: cambioDireccion ? null : previa?.partido,
            provincia: cambioDireccion ? null : previa?.provincia,
            token: s.ubicacion,
            osm: true,
          })
        : null;
    guardar.push({
      id: previa?.id,
      nombre: s.nombre.trim(),
      direccion: s.direccion,
      zona: vacioANull(s.zona) ?? (u ? zonaDeUbicacion(u) : (previa?.zona ?? null)),
      lat: u ? u.lat : (previa?.lat ?? null),
      lng: u ? u.lng : (previa?.lng ?? null),
      partido: cambioDireccion && u ? u.partido : (previa?.partido ?? null),
      provincia: cambioDireccion && u ? u.provincia : (previa?.provincia ?? null),
      cue: conCue ? vacioANull(s.cue) : (previa?.cue ?? null),
      esPrincipal: s.esPrincipal,
    });
  }

  const conflicto = await transaccion(async (tx) => {
    // Con la institución bloqueada, dos personas que guardan a la vez se turnan; la segunda ve lo que guardó la primera.
    await tx.select({ id: instituciones.id }).from(instituciones).where(eq(instituciones.id, institucion.id)).limit(1).for("update");
    if (huellaEsperada !== undefined && huellaDeSedes(await sedesDeInstitucion(institucion.id, tx), { conCue }) !== huellaEsperada) return true;

    // La principal anterior se suelta primero: el índice único solo admite una principal por institución.
    await tx
      .update(institucionSedes)
      .set({ esPrincipal: false })
      .where(and(eq(institucionSedes.institucionId, institucion.id), eq(institucionSedes.esPrincipal, true)));
    if (aQuitar.length > 0) {
      await tx
        .delete(institucionSedes)
        .where(and(eq(institucionSedes.institucionId, institucion.id), inArray(institucionSedes.id, aQuitar.map((s) => s.id))));
    }
    for (const { id, ...campos } of guardar) {
      if (id) await tx.update(institucionSedes).set(campos).where(and(eq(institucionSedes.id, id), eq(institucionSedes.institucionId, institucion.id)));
      else await tx.insert(institucionSedes).values({ ...campos, institucionId: institucion.id });
    }
    await sincronizarEspejo(tx, institucion.id);
    return false;
  });
  if (conflicto) return fallo(SE_CAMBIARON_MIENTRAS_TANTO);

  const despues = await sedesDeInstitucion(institucion.id);
  // Lo comparado es lo que se mandó (con el id de cada una) contra lo que había: las nuevas no tienen id todavía.
  const cambios = cambiosDeSedes(
    antes,
    guardar.map((g) => ({ id: g.id, nombre: g.nombre, direccion: g.direccion, zona: g.zona, cue: g.cue, esPrincipal: g.esPrincipal })),
  );
  return ok({ sedes: despues, huella: huellaDeSedes(despues, { conCue }), cambios });
}

const SE_CAMBIARON_MIENTRAS_TANTO =
  "Otra persona del equipo cambió las sedes mientras las editabas, y no queremos pisar sus cambios. Recargá la página para ver lo último y volvé a hacer los tuyos.";

/** La huella que mandó la pantalla (no es parte de lo que se valida y guarda: va aparte). Sin ella no se compara, como antes. */
function huellaDeLaEntrada(entrada: unknown): string | undefined {
  const huella = typeof entrada === "object" && entrada !== null ? (entrada as { huella?: unknown }).huella : undefined;
  return typeof huella === "string" ? huella : undefined;
}
