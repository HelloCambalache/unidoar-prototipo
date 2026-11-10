import "server-only";
import type { EtapaPostulacion } from "@/db/schema";
import { claveDePostulantes } from "@/lib/correo/claves";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { encolarAviso } from "./cola";
import type { NombreDePlantilla } from "./plantillas";

/*
 * Un aviso por WhatsApp por cada cosa que pasa en el producto, a quienes lo pidieron (ver consentimiento.ts). Es el mismo criterio que `src/lib/correo/eventos.ts`
 * y las acciones llaman a estas funciones justo al lado de las del correo: acá se decide qué plantilla corresponde, qué dice y cuántas veces puede repetirse.
 * Todas corren dentro de la transacción de la acción y NUNCA la rompen (ver `encolarAviso`).
 *
 * Los avisos son siempre de utilidad (algo que la persona hizo o espera): preselección, entrevista y oferta para el profesional; postulantes nuevos y
 * respuesta a una entrevista para la institución. Nada de marketing.
 */

const enlaceDeLaPostulacion = (postulacionId: string) => `docente/postulaciones?abrir=${postulacionId}`;
const enlaceDelTablero = (busquedaId: string) => `institucion/postulantes?busqueda=${busquedaId}`;
const unico = (usuarioId: string | null | undefined) => (usuarioId ? [usuarioId] : []);

type Postulacion = { usuarioId: string | null; institucion: string; puesto: string; postulacionId: string };

/** Preselección y oferta. Una vez por postulación y etapa, aunque la muevan de un lado a otro. Archivar no manda nada (a propósito). */
export async function whatsappDeEtapa(ejecutor: Ejecutor, etapa: EtapaPostulacion, d: Postulacion) {
  const plantilla: NombreDePlantilla | null = etapa === "preseleccionados" ? "unidoar_preseleccion" : etapa === "oferta" ? "unidoar_oferta" : null;
  if (!plantilla) return;
  await encolarAviso(ejecutor, unico(d.usuarioId), plantilla, [d.institucion, d.puesto], enlaceDeLaPostulacion(d.postulacionId), () => `${plantilla}:${d.postulacionId}`);
}

/** Entrevista agendada. Si la reprograman a otra hora llega otro aviso (la clave incluye el momento). */
export async function whatsappDeEntrevista(ejecutor: Ejecutor, d: Postulacion & { cuando: Date; cuandoTexto: string }) {
  await encolarAviso(
    ejecutor,
    unico(d.usuarioId),
    "unidoar_entrevista",
    [d.institucion, d.puesto, d.cuandoTexto],
    enlaceDeLaPostulacion(d.postulacionId),
    () => `unidoar_entrevista:${d.postulacionId}:${d.cuando.getTime()}`,
  );
}

/** Hay postulantes nuevos: uno por búsqueda por día (por hora en las rápidas), a quienes tienen acceso a la institución y lo pidieron. */
export async function whatsappDePostulantes(ejecutor: Ejecutor, d: { usuarioIds: string[]; busquedaId: string; puesto: string; rapida: boolean }) {
  const clave = claveDePostulantes(d.busquedaId, d.rapida);
  await encolarAviso(ejecutor, d.usuarioIds, "unidoar_postulantes", [d.puesto], enlaceDelTablero(d.busquedaId), () => clave);
}

/** El profesional respondió la entrevista («Voy» o «No puedo»). Una por respuesta distinta de cada entrevista: cambiar de idea avisa de nuevo, apretar el mismo botón dos veces no. */
export async function whatsappDeRespuestaDeEntrevista(
  ejecutor: Ejecutor,
  d: { usuarioIds: string[]; postulacionId: string; busquedaId: string; puesto: string; profesional: string; respuesta: "voy" | "no_puedo"; cuando: Date },
) {
  await encolarAviso(
    ejecutor,
    d.usuarioIds,
    "unidoar_respuesta_entrevista",
    [d.puesto, d.profesional, d.respuesta === "voy" ? "confirmó que va" : "avisó que no puede ir"],
    enlaceDelTablero(d.busquedaId),
    () => `unidoar_respuesta_entrevista:${d.postulacionId}:${d.cuando.getTime()}:${d.respuesta}`,
  );
}
