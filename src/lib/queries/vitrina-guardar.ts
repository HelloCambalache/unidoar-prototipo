import "server-only";
import { revalidatePath } from "next/cache";
import type { Institucion } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { quitados } from "@/lib/archivos";
import { ROLES_CONTACTO, TIPOS_INSTITUCION } from "@/lib/catalogo";
import { borrarArchivos } from "@/lib/queries/archivos";
import { fotosDeInstitucion, guardarVitrina, novedadesDeInstitucion } from "@/lib/queries/vitrina";
import { esUrlPublicaPropia } from "@/lib/subidas";
import { cambiosDeVitrina, camposDeError, vitrinaSchema, type VitrinaGuardada } from "@/lib/vitrina";

/*
 * "Guardar cambios" del perfil público (la vitrina) de una institución. Lo comparten dos puertas: la de la propia
 * institución (`actualizarVitrina`, src/app/actions/institucion.ts) y la del equipo de UNIDOAR desde el backoffice
 * (`actualizarVitrinaComoAdmin`). Quien llama ya resolvió QUIÉN puede editar y de QUÉ institución; acá se valida el
 * contenido y se guarda, con las mismas reglas para las dos.
 */

/**
 * Valida y guarda el estado completo del formulario: datos, valores, galería y novedades en una sola transacción. Las fotos y
 * novedades que ya no vienen se borran, las que traen `id` se actualizan (solo si son de esta institución) y las demás se crean.
 * `quienSube` es la cuenta que subió las imágenes nuevas (la de la institución o la del admin): solo se aceptan imágenes que ya
 * estaban guardadas o que subió esa misma cuenta. Devuelve las listas con sus ids y los nombres de lo que cambió.
 */
export async function guardarVitrinaDeInstitucion(
  institucion: Institucion,
  quienSube: string,
  entrada: unknown,
): Promise<Resultado<{ guardado: VitrinaGuardada; cambios: string[] }>> {
  const r = vitrinaSchema.safeParse(entrada);
  if (!r.success) return fallo("Revisá los campos marcados.", camposDeError(r.error));
  const d = r.data;

  const campos: Record<string, string> = {};
  // El tipo y el rol de contacto son vocabularios cerrados; se tolera el valor que ya tenía guardado (cuentas viejas).
  if (d.tipo !== institucion.tipo && !(TIPOS_INSTITUCION as readonly string[]).includes(d.tipo)) {
    campos.tipo = "Elegí un tipo de la lista.";
  }
  if (d.contactoRol !== institucion.contactoRol && !(ROLES_CONTACTO as readonly string[]).includes(d.contactoRol)) {
    campos.contactoRol = "Elegí un rol de la lista.";
  }
  // Imágenes: la que ya estaba guardada o una que subió esta misma cuenta.
  if (d.logoUrl && d.logoUrl !== institucion.logoUrl && !esUrlPublicaPropia(d.logoUrl, quienSube)) {
    campos.logoUrl = "Ese archivo no es válido. Subí el logo de nuevo.";
  }
  if (d.portadaUrl && d.portadaUrl !== institucion.portadaUrl && !esUrlPublicaPropia(d.portadaUrl, quienSube)) {
    campos.portadaUrl = "Ese archivo no es válido. Subí la portada de nuevo.";
  }

  const [fotosAntes, novedadesAntes] = await Promise.all([fotosDeInstitucion(institucion.id), novedadesDeInstitucion(institucion.id)]);
  const porId = new Map(fotosAntes.map((f) => [f.id, f]));
  d.fotos.forEach((f, i) => {
    const actual = f.id ? porId.get(f.id) : undefined;
    if (actual?.url !== f.url && !esUrlPublicaPropia(f.url, quienSube)) campos[`fotos.${i}.url`] = "Subí la foto de nuevo.";
  });
  if (Object.keys(campos).length > 0) return fallo("Revisá los campos marcados.", campos);

  const cambios = cambiosDeVitrina({ ...institucion, fotos: fotosAntes, novedades: novedadesAntes }, d);
  // La huella de lo que la persona estaba viendo (la pantalla la manda junto con el resto): `guardarVitrina` la compara con lo que hay
  // al momento de guardar y, si otra persona del equipo guardó mientras tanto, no pisa lo suyo.
  const huellaEsperada = huellaDeLaEntrada(entrada);
  const guardado = await guardarVitrina(institucion.id, d, huellaEsperada);
  if (guardado.conflicto) return fallo(SE_CAMBIO_MIENTRAS_TANTO);

  // Lo que se reemplazó o se quitó (logo, portada, fotos de la galería) deja de ocupar lugar en Storage.
  await borrarArchivos(
    quitados(
      [institucion.logoUrl, institucion.portadaUrl, ...fotosAntes.map((f) => f.url)],
      [d.logoUrl, d.portadaUrl, ...guardado.fotos.map((f) => f.url)],
    ),
  );

  // El nombre y el logo se ven en el menú de toda el área, y la vitrina en las dos páginas de perfil y en el catálogo.
  revalidatePath("/institucion", "layout");
  revalidatePath(`/instituciones/${institucion.slug}`);
  revalidatePath(`/docente/instituciones/${institucion.slug}`);
  revalidatePath("/docente/instituciones");
  revalidatePath("/instituciones");
  return ok({ guardado: { fotos: guardado.fotos, novedades: guardado.novedades, huella: guardado.huella }, cambios });
}

const SE_CAMBIO_MIENTRAS_TANTO =
  "Otra persona del equipo guardó cambios en el perfil mientras lo editabas, y no los queremos pisar. Recargá la página para ver lo último y volvé a hacer tus cambios.";

/** La huella que mandó la pantalla (no es parte de lo que se valida y guarda: va aparte). Sin ella no se compara, como antes. */
function huellaDeLaEntrada(entrada: unknown): string | undefined {
  const huella = typeof entrada === "object" && entrada !== null ? (entrada as { huella?: unknown }).huella : undefined;
  return typeof huella === "string" ? huella : undefined;
}
